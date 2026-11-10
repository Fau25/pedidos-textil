-- Mis pedidos textiles · v2.1: guardado en una sola transacción y limpieza de lo que ya no se usa

-- 1) Quitar estados, historial y presupuestos con seguimiento
drop trigger if exists t_historial on pedidos;
drop function if exists cambiar_estado(uuid, uuid, text);
drop function if exists registrar_estado();
drop table if exists pedido_historial;
drop table if exists presupuestos;
drop function if exists numerar_presupuesto();
alter table pedidos drop column if exists estado_id;
drop table if exists estados;

-- 2) Alta de empresa sin estados
create or replace function crear_empresa(nombre text) returns uuid
language plpgsql security definer set search_path = public as $$
declare e uuid; t uuid;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  select empresa_id into e from miembros where user_id = auth.uid() limit 1;
  if e is not null then return e; end if;
  insert into empresas(nombre) values (coalesce(nullif(trim(nombre), ''), 'Mi taller')) returning id into e;
  insert into miembros(empresa_id, user_id, rol) values (e, auth.uid(), 'propietario');
  insert into tecnicas(empresa_id, nombre, orden) values (e,'Bordado',1) returning id into t;
  insert into tarifas(empresa_id, tecnica_id, desde, hasta, coste, precio) values
    (e,t,1,11,2.50,5.00),(e,t,12,49,1.80,3.50),(e,t,50,99,1.20,2.50),(e,t,100,null,0.90,1.90);
  insert into tecnicas(empresa_id, nombre, orden) values (e,'Serigrafía',2) returning id into t;
  insert into tarifas(empresa_id, tecnica_id, desde, hasta, coste, precio) values
    (e,t,1,24,2.20,4.50),(e,t,25,99,1.10,2.20),(e,t,100,null,0.60,1.30);
  insert into tecnicas(empresa_id, nombre, orden) values (e,'Vinilo textil',3) returning id into t;
  insert into tarifas(empresa_id, tecnica_id, desde, hasta, coste, precio) values
    (e,t,1,19,1.50,3.50),(e,t,20,null,1.00,2.50);
  insert into tecnicas(empresa_id, nombre, orden) values (e,'DTF',4) returning id into t;
  insert into tarifas(empresa_id, tecnica_id, desde, hasta, coste, precio) values
    (e,t,1,19,1.80,4.00),(e,t,20,99,1.30,2.90),(e,t,100,null,0.95,2.10);
  return e;
end $$;

-- 3) Guardar un pedido completo en una sola transacción (todo o nada).
--    Con permisos del usuario: las reglas RLS siguen aplicando.
create or replace function guardar_pedido(p jsonb) returns text
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid := (p->>'id')::uuid;
  v_num text;
  l jsonb; x jsonb; t jsonb;
  lids uuid[]; pids uuid[]; tallas text[];
begin
  insert into pedidos(id, empresa_id, cliente_id, fecha, entrega, entregado, referencia, notas,
                      descuento_pct, gastos_coste, gastos_venta, iva, coste, base, total, unidades)
  values (v_id, (p->>'empresa_id')::uuid, nullif(p->>'cliente_id','')::uuid, (p->>'fecha')::date, nullif(p->>'entrega','')::date,
          coalesce((p->>'entregado')::boolean, false), nullif(p->>'referencia',''), nullif(p->>'notas',''),
          coalesce((p->>'descuento_pct')::numeric,0), coalesce((p->>'gastos_coste')::numeric,0), coalesce((p->>'gastos_venta')::numeric,0),
          coalesce((p->>'iva')::numeric,21), coalesce((p->>'coste')::numeric,0), coalesce((p->>'base')::numeric,0),
          coalesce((p->>'total')::numeric,0), coalesce((p->>'unidades')::int,0))
  on conflict (id) do update set
    cliente_id = excluded.cliente_id, fecha = excluded.fecha, entrega = excluded.entrega, referencia = excluded.referencia,
    notas = excluded.notas, descuento_pct = excluded.descuento_pct, gastos_coste = excluded.gastos_coste,
    gastos_venta = excluded.gastos_venta, iva = excluded.iva, coste = excluded.coste, base = excluded.base,
    total = excluded.total, unidades = excluded.unidades
    -- «entregado» no se toca al editar: se cambia solo con su botón
  returning numero into v_num;
  if v_num is null then raise exception 'No tienes permiso para este pedido'; end if;

  -- Prendas
  select coalesce(array_agg((e->>'id')::uuid), '{}') into lids from jsonb_array_elements(coalesce(p->'lineas','[]')) e;
  delete from pedido_lineas where pedido_id = v_id and not (id = any(lids));
  for l in select * from jsonb_array_elements(coalesce(p->'lineas','[]')) loop
    insert into pedido_lineas(id, pedido_id, orden, tipo, marca, modelo, color, proveedor_id, precio_compra, precio_venta, notas, imagen_path)
    values ((l->>'id')::uuid, v_id, coalesce((l->>'orden')::int,0), coalesce(nullif(l->>'tipo',''),'Prenda'), nullif(l->>'marca',''),
            nullif(l->>'modelo',''), nullif(l->>'color',''), nullif(l->>'proveedor_id','')::uuid, coalesce((l->>'precio_compra')::numeric,0),
            nullif(l->>'precio_venta','')::numeric, nullif(l->>'notas',''), nullif(l->>'imagen_path',''))
    on conflict (id) do update set orden = excluded.orden, tipo = excluded.tipo, marca = excluded.marca, modelo = excluded.modelo,
      color = excluded.color, proveedor_id = excluded.proveedor_id, precio_compra = excluded.precio_compra,
      precio_venta = excluded.precio_venta, notas = excluded.notas, imagen_path = excluded.imagen_path
    where pedido_lineas.pedido_id = v_id;
    select coalesce(array_agg(z->>'talla'), '{}') into tallas from jsonb_array_elements(coalesce(l->'tallas','[]')) z where (z->>'cantidad')::int > 0;
    delete from linea_tallas where linea_id = (l->>'id')::uuid and not (talla = any(tallas));
    for t in select * from jsonb_array_elements(coalesce(l->'tallas','[]')) loop
      continue when (t->>'cantidad')::int <= 0;
      insert into linea_tallas(linea_id, talla, cantidad, orden) values ((l->>'id')::uuid, t->>'talla', (t->>'cantidad')::int, coalesce((t->>'orden')::int,0))
      on conflict (linea_id, talla) do update set cantidad = excluded.cantidad, orden = excluded.orden;
    end loop;
  end loop;

  -- Personalizaciones
  select coalesce(array_agg((e->>'id')::uuid), '{}') into pids from jsonb_array_elements(coalesce(p->'pers','[]')) e;
  delete from personalizaciones where pedido_id = v_id and not (id = any(pids));
  for x in select * from jsonb_array_elements(coalesce(p->'pers','[]')) loop
    insert into personalizaciones(id, pedido_id, orden, tecnica_id, tecnica, ubicacion, aplicaciones, coste_ud, precio_ud, precio_manual, diseno_path, notas)
    values ((x->>'id')::uuid, v_id, coalesce((x->>'orden')::int,0), nullif(x->>'tecnica_id','')::uuid, coalesce(x->>'tecnica','Bordado'),
            coalesce(x->>'ubicacion',''), greatest(1, coalesce((x->>'aplicaciones')::int,1)), coalesce((x->>'coste_ud')::numeric,0),
            coalesce((x->>'precio_ud')::numeric,0), coalesce((x->>'precio_manual')::boolean,false), nullif(x->>'diseno_path',''), nullif(x->>'notas',''))
    on conflict (id) do update set orden = excluded.orden, tecnica_id = excluded.tecnica_id, tecnica = excluded.tecnica, ubicacion = excluded.ubicacion,
      aplicaciones = excluded.aplicaciones, coste_ud = excluded.coste_ud, precio_ud = excluded.precio_ud, precio_manual = excluded.precio_manual,
      diseno_path = excluded.diseno_path, notas = excluded.notas
    where personalizaciones.pedido_id = v_id;
    delete from personalizacion_lineas where personalizacion_id = (x->>'id')::uuid;
    insert into personalizacion_lineas(personalizacion_id, linea_id)
      select (x->>'id')::uuid, k::uuid from jsonb_array_elements_text(coalesce(x->'lineas','[]')) k where k::uuid = any(lids)
      on conflict do nothing;
  end loop;
  return v_num;
end $$;
revoke execute on function guardar_pedido(jsonb) from anon;

-- 4) Regla de archivos: una carpeta que no es un id válido da «no permitido», no un error
create or replace function carpeta_empresa(nombre text) returns uuid
language sql immutable as $$
  select case when (storage.foldername(nombre))[1] ~ '^[0-9a-f-]{36}$' then ((storage.foldername(nombre))[1])::uuid end
$$;
drop policy if exists "archivos leer" on storage.objects;
drop policy if exists "archivos subir" on storage.objects;
drop policy if exists "archivos cambiar" on storage.objects;
drop policy if exists "archivos borrar" on storage.objects;
create policy "archivos leer" on storage.objects for select to authenticated using (bucket_id = 'archivos' and es_miembro(carpeta_empresa(name)));
create policy "archivos subir" on storage.objects for insert to authenticated with check (bucket_id = 'archivos' and puede_editar(carpeta_empresa(name)));
create policy "archivos cambiar" on storage.objects for update to authenticated using (bucket_id = 'archivos' and puede_editar(carpeta_empresa(name)));
create policy "archivos borrar" on storage.objects for delete to authenticated using (bucket_id = 'archivos' and puede_editar(carpeta_empresa(name)));
