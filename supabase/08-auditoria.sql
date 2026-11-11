-- Mis pedidos textiles · 08 · auditoría 2: permisos, conflictos, registro de errores y limpieza
-- Se ejecuta una vez en el SQL Editor de Supabase. Se puede volver a ejecutar sin problema.

-- 1) Administrador de la app (el que puede cambiar las fotos compartidas de Roly).
--    Por defecto, la primera cuenta creada. Para cambiarlo:  update admins set user_id = '<id>';
create table if not exists admins (user_id uuid primary key references auth.users on delete cascade);
alter table admins enable row level security;
insert into admins(user_id) select id from auth.users where not exists (select 1 from admins) order by created_at limit 1;
create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from admins where user_id = auth.uid())
$$;
grant execute on function es_admin() to authenticated;
drop policy if exists leer on admins;
create policy leer on admins for select to authenticated using (user_id = auth.uid());
grant select on admins to authenticated;

-- 2) Fotos de Roly: todos las ven, solo el administrador las sube o cambia
drop policy if exists "roly subir" on storage.objects;
drop policy if exists "roly cambiar" on storage.objects;
create policy "roly subir" on storage.objects for insert to authenticated with check (bucket_id = 'roly' and public.es_admin());
create policy "roly cambiar" on storage.objects for update to authenticated using (bucket_id = 'roly' and public.es_admin()) with check (bucket_id = 'roly' and public.es_admin());

-- 3) Invitados: cada propietario ve y borra solo los que ha invitado él
drop policy if exists leer on invitados;
drop policy if exists escribir on invitados;
drop policy if exists borrar on invitados;
create policy leer on invitados for select to authenticated using (invitado_por = auth.uid());
create policy escribir on invitados for insert to authenticated
  with check (invitado_por = auth.uid() and exists (select 1 from miembros where user_id = auth.uid() and rol = 'propietario'));
create policy borrar on invitados for delete to authenticated using (invitado_por = auth.uid());

-- 4) Control de conflictos al guardar un pedido
alter table pedidos add column if not exists editado timestamptz not null default now();
drop function if exists guardar_pedido(jsonb);
create function guardar_pedido(p jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid := (p->>'id')::uuid;
  v_num text;
  v_ed timestamptz;
  v_base timestamptz := nullif(p->>'editado_base','')::timestamptz;
  l jsonb; x jsonb; t jsonb;
  lids uuid[]; pids uuid[]; tallas text[];
begin
  -- Control de conflictos: si otra persona guardó este pedido después de abrirlo, no se pisa
  if v_base is not null and not coalesce((p->>'forzar')::boolean, false) then
    select editado into v_ed from pedidos where id = v_id;
    if v_ed is not null and v_ed > v_base + interval '1 second' then
      raise exception 'CONFLICTO: otra persona guardó este pedido mientras lo editabas' using errcode = 'P0409';
    end if;
  end if;
  insert into pedidos(id, empresa_id, cliente_id, fecha, entrega, entregado, referencia, notas,
                      descuento_pct, gastos_coste, gastos_venta, iva, coste, base, total, unidades, editado)
  values (v_id, (p->>'empresa_id')::uuid, nullif(p->>'cliente_id','')::uuid, (p->>'fecha')::date, nullif(p->>'entrega','')::date,
          coalesce((p->>'entregado')::boolean, false), nullif(p->>'referencia',''), nullif(p->>'notas',''),
          coalesce((p->>'descuento_pct')::numeric,0), coalesce((p->>'gastos_coste')::numeric,0), coalesce((p->>'gastos_venta')::numeric,0),
          coalesce((p->>'iva')::numeric,21), coalesce((p->>'coste')::numeric,0), coalesce((p->>'base')::numeric,0),
          coalesce((p->>'total')::numeric,0), coalesce((p->>'unidades')::int,0), now())
  on conflict (id) do update set
    cliente_id = excluded.cliente_id, fecha = excluded.fecha, entrega = excluded.entrega, referencia = excluded.referencia,
    notas = excluded.notas, descuento_pct = excluded.descuento_pct, gastos_coste = excluded.gastos_coste,
    gastos_venta = excluded.gastos_venta, iva = excluded.iva, coste = excluded.coste, base = excluded.base,
    total = excluded.total, unidades = excluded.unidades, editado = now()
    -- «entregado» no se toca al editar: se cambia solo con su botón
  returning numero, editado into v_num, v_ed;
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
  return jsonb_build_object('numero', v_num, 'editado', v_ed);
end $$;
revoke execute on function guardar_pedido(jsonb) from anon, public;
grant execute on function guardar_pedido(jsonb) to authenticated;

-- 5) Registro de errores de la app (se ven en Ajustes)
create table if not exists errores (
  id bigint generated always as identity primary key,
  creado timestamptz not null default now(),
  user_id uuid default auth.uid() references auth.users on delete cascade,
  empresa_id uuid references empresas on delete cascade,
  version text, ruta text, mensaje text not null check (length(mensaje) <= 500), detalle text check (length(detalle) <= 4000)
);
alter table errores enable row level security;
drop policy if exists apuntar on errores;
drop policy if exists leer on errores;
drop policy if exists borrar on errores;
create policy apuntar on errores for insert to authenticated with check (user_id = auth.uid() and (empresa_id is null or es_miembro(empresa_id)));
create policy leer on errores for select to authenticated using (user_id = auth.uid() or public.es_admin());
create policy borrar on errores for delete to authenticated using (user_id = auth.uid() or public.es_admin());
grant select, insert, delete on errores to authenticated;
create index if not exists i_errores_creado on errores(creado desc);

-- 6) Limpieza: tablas de la versión 1 que la app ya no usa (estados, presupuestos, historial)
drop trigger if exists t_historial on pedidos;
drop function if exists cambiar_estado(uuid, uuid, text);
drop function if exists registrar_estado();
drop table if exists pedido_historial;
drop table if exists presupuestos;
drop function if exists numerar_presupuesto();
alter table pedidos drop column if exists estado_id;
drop table if exists estados;
