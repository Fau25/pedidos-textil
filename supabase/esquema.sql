-- Mis pedidos textiles · esquema de la base de datos (Fase 1)
-- Se ejecuta una vez en Supabase → SQL Editor. Es repetible: borra y recrea solo lo de esta app.

-- ───────── Empresas y miembros ─────────
create table if not exists empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nif text, direccion text, email text, telefono text, web text,
  logo_path text,
  iva numeric(5,2) not null default 21,
  margen numeric(6,2) not null default 40,
  validez_dias int not null default 30,
  condiciones text default 'Presupuesto válido durante 30 días. Plazo de entrega orientativo a contar desde la aceptación y la recepción del diseño. Forma de pago: 50 % al aceptar y 50 % a la entrega.',
  creado timestamptz not null default now()
);

create table if not exists miembros (
  empresa_id uuid not null references empresas on delete cascade,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  rol text not null default 'propietario' check (rol in ('propietario','editor','lector')),
  primary key (empresa_id, user_id)
);

create or replace function es_miembro(e uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from miembros where empresa_id = e and user_id = auth.uid())
$$;

create or replace function puede_editar(e uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from miembros where empresa_id = e and user_id = auth.uid() and rol in ('propietario','editor'))
$$;

-- Rellena empresa_id de las tablas hijas a partir de su tabla madre (el cliente no puede falsearlo)
create or replace function fijar_empresa() returns trigger
language plpgsql security definer set search_path = public as $$
declare e uuid;
begin
  execute format('select empresa_id from %I where id = $1', tg_argv[0])
    into e using (to_jsonb(new) ->> tg_argv[1])::uuid;
  if e is null then raise exception 'Referencia no válida'; end if;
  new.empresa_id := e;
  return new;
end $$;

create or replace function tocar_actualizado() returns trigger language plpgsql as $$
begin new.actualizado := now(); return new; end $$;

-- ───────── Maestros ─────────
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas on delete cascade,
  nombre text not null,
  contacto text, telefono text, email text, direccion text, nif text,
  facturacion text, notas text,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

create table if not exists proveedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas on delete cascade,
  nombre text not null,
  contacto text, telefono text, email text, web text, notas text,
  creado timestamptz not null default now()
);

create table if not exists catalogo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas on delete cascade,
  tipo text not null,
  marca text, modelo text,
  colores text[] not null default '{}',
  proveedor_id uuid references proveedores on delete set null,
  precio_compra numeric(10,2) not null default 0,
  precio_venta numeric(10,2),
  imagen_path text, notas text,
  creado timestamptz not null default now()
);

create table if not exists estados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas on delete cascade,
  clave text,               -- estados de sistema (para el panel de inicio); null en los añadidos
  nombre text not null,
  orden int not null default 0,
  color text not null default 'gris',
  final boolean not null default false
);

create table if not exists tecnicas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas on delete cascade,
  nombre text not null,
  orden int not null default 0
);

create table if not exists tarifas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas on delete cascade,
  tecnica_id uuid not null references tecnicas on delete cascade,
  desde int not null default 1,
  hasta int,                -- null = sin límite
  complejidad text not null default 'Normal',
  coste numeric(10,2) not null default 0,
  precio numeric(10,2) not null default 0
);

-- ───────── Numeración ─────────
create table if not exists contadores (
  empresa_id uuid not null references empresas on delete cascade,
  serie text not null,
  anio int not null,
  ultimo int not null default 0,
  primary key (empresa_id, serie, anio)
);

create or replace function siguiente_numero(e uuid, s text, a int) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into contadores(empresa_id, serie, anio, ultimo) values (e, s, a, 1)
  on conflict (empresa_id, serie, anio) do update set ultimo = contadores.ultimo + 1
  returning ultimo into n;
  return n;
end $$;

-- ───────── Pedidos ─────────
create table if not exists pedidos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas on delete cascade,
  numero text,
  cliente_id uuid references clientes on delete restrict,
  fecha date not null default current_date,
  entrega date,
  estado_id uuid references estados on delete restrict,
  referencia text, notas text,
  descuento_pct numeric(5,2) not null default 0,
  gastos_coste numeric(10,2) not null default 0,
  gastos_venta numeric(10,2) not null default 0,
  iva numeric(5,2) not null default 21,
  coste numeric(12,2) not null default 0,
  base numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  unidades int not null default 0,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  unique (empresa_id, numero)
);

create or replace function numerar_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
declare a int := extract(year from coalesce(new.fecha, current_date));
begin
  if new.numero is null then
    new.numero := 'P-' || a || '-' || lpad(siguiente_numero(new.empresa_id, 'P', a)::text, 4, '0');
  end if;
  return new;
end $$;

create table if not exists pedido_lineas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas on delete cascade,
  pedido_id uuid not null references pedidos on delete cascade,
  orden int not null default 0,
  tipo text not null default 'Camiseta',
  marca text, modelo text, color text,
  proveedor_id uuid references proveedores on delete set null,
  precio_compra numeric(10,2) not null default 0,
  precio_venta numeric(10,2),     -- null = se calcula con el margen
  imagen_path text, notas text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','pedido','recibido_parcial','recibido','en_personalizacion','listo','entregado'))
);

create table if not exists linea_tallas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas on delete cascade,
  linea_id uuid not null references pedido_lineas on delete cascade,
  talla text not null,
  cantidad int not null default 0 check (cantidad >= 0),
  orden int not null default 0,
  unique (linea_id, talla)
);

create table if not exists personalizaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas on delete cascade,
  pedido_id uuid not null references pedidos on delete cascade,
  orden int not null default 0,
  tecnica_id uuid references tecnicas on delete set null,
  tecnica text not null default 'Bordado',
  ubicacion text not null default 'Pecho izquierdo',
  aplicaciones int not null default 1 check (aplicaciones >= 1),
  diseno_path text,
  coste_ud numeric(10,2) not null default 0,
  precio_ud numeric(10,2) not null default 0,
  precio_manual boolean not null default false,
  notas text,
  estado text not null default 'pendiente' check (estado in ('pendiente','en_proceso','hecho'))
);

create table if not exists personalizacion_lineas (
  personalizacion_id uuid not null references personalizaciones on delete cascade,
  linea_id uuid not null references pedido_lineas on delete cascade,
  empresa_id uuid not null references empresas on delete cascade,
  primary key (personalizacion_id, linea_id)
);

create table if not exists pedido_historial (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas on delete cascade,
  pedido_id uuid not null references pedidos on delete cascade,
  estado_id uuid references estados on delete set null,
  estado_nombre text,
  nota text,
  user_id uuid default auth.uid(),
  creado timestamptz not null default now()
);

create or replace function registrar_estado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.estado_id is distinct from old.estado_id then
    insert into pedido_historial(empresa_id, pedido_id, estado_id, estado_nombre, nota)
    values (new.empresa_id, new.id, new.estado_id,
            (select nombre from estados where id = new.estado_id),
            coalesce(nullif(current_setting('app.nota', true), ''),
                     case when tg_op = 'INSERT' then 'Pedido creado' end));
  end if;
  return null;
end $$;

-- Cambiar estado con nota (queda en la línea temporal)
create or replace function cambiar_estado(p uuid, e uuid, nota text default null) returns void
language plpgsql security invoker set search_path = public as $$
begin
  perform set_config('app.nota', coalesce(nota, ''), true);
  update pedidos set estado_id = e where id = p;
  if not found then raise exception 'Pedido no encontrado'; end if;
end $$;

-- ───────── Presupuestos ─────────
create table if not exists presupuestos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas on delete cascade,
  pedido_id uuid not null references pedidos on delete cascade,
  numero text,
  version int not null default 1,
  estado text not null default 'borrador' check (estado in ('borrador','enviado','aceptado','rechazado')),
  fecha date not null default current_date,
  validez date,
  datos jsonb not null,           -- copia fija de cliente, líneas y totales
  base numeric(12,2) not null default 0,
  iva numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notas text,
  creado timestamptz not null default now(),
  unique (empresa_id, numero)
);

create or replace function numerar_presupuesto() returns trigger
language plpgsql security definer set search_path = public as $$
declare a int := extract(year from coalesce(new.fecha, current_date));
begin
  if new.numero is null then
    new.numero := 'PR-' || a || '-' || lpad(siguiente_numero(new.empresa_id, 'PR', a)::text, 4, '0');
  end if;
  return new;
end $$;

-- ───────── Disparadores ─────────
drop trigger if exists t_numerar on pedidos;
create trigger t_numerar before insert on pedidos for each row execute function numerar_pedido();
drop trigger if exists t_actualizado on pedidos;
create trigger t_actualizado before update on pedidos for each row execute function tocar_actualizado();
drop trigger if exists t_actualizado on clientes;
create trigger t_actualizado before update on clientes for each row execute function tocar_actualizado();
drop trigger if exists t_historial on pedidos;
create trigger t_historial after insert or update of estado_id on pedidos for each row execute function registrar_estado();
drop trigger if exists t_numerar on presupuestos;
create trigger t_numerar before insert on presupuestos for each row execute function numerar_presupuesto();

drop trigger if exists t_empresa on pedido_lineas;
create trigger t_empresa before insert or update of pedido_id on pedido_lineas for each row execute function fijar_empresa('pedidos','pedido_id');
drop trigger if exists t_empresa on linea_tallas;
create trigger t_empresa before insert or update of linea_id on linea_tallas for each row execute function fijar_empresa('pedido_lineas','linea_id');
drop trigger if exists t_empresa on personalizaciones;
create trigger t_empresa before insert or update of pedido_id on personalizaciones for each row execute function fijar_empresa('pedidos','pedido_id');
drop trigger if exists t_empresa on personalizacion_lineas;
create trigger t_empresa before insert on personalizacion_lineas for each row execute function fijar_empresa('personalizaciones','personalizacion_id');
drop trigger if exists t_empresa on pedido_historial;
create trigger t_empresa before insert on pedido_historial for each row execute function fijar_empresa('pedidos','pedido_id');
drop trigger if exists t_empresa on presupuestos;
create trigger t_empresa before insert or update of pedido_id on presupuestos for each row execute function fijar_empresa('pedidos','pedido_id');
drop trigger if exists t_empresa on tarifas;
create trigger t_empresa before insert or update of tecnica_id on tarifas for each row execute function fijar_empresa('tecnicas','tecnica_id');

-- ───────── Seguridad (RLS) ─────────
do $$
declare t text;
begin
  foreach t in array array['clientes','proveedores','catalogo','estados','tecnicas','tarifas','pedidos',
    'pedido_lineas','linea_tallas','personalizaciones','personalizacion_lineas','pedido_historial','presupuestos','contadores']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists leer on %I', t);
    execute format('drop policy if exists escribir on %I', t);
    execute format('create policy leer on %I for select to authenticated using (es_miembro(empresa_id))', t);
    execute format('create policy escribir on %I for all to authenticated using (puede_editar(empresa_id)) with check (puede_editar(empresa_id))', t);
  end loop;
end $$;

alter table empresas enable row level security;
drop policy if exists leer on empresas;
drop policy if exists editar on empresas;
create policy leer on empresas for select to authenticated using (es_miembro(id));
create policy editar on empresas for update to authenticated using (puede_editar(id)) with check (puede_editar(id));

alter table miembros enable row level security;
drop policy if exists leer on miembros;
create policy leer on miembros for select to authenticated using (es_miembro(empresa_id));

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, delete on empresas from authenticated;
revoke insert, update, delete on miembros, contadores from authenticated;

-- ───────── Alta de empresa (primer acceso) ─────────
create or replace function crear_empresa(nombre text) returns uuid
language plpgsql security definer set search_path = public as $$
declare e uuid; t uuid;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  if exists(select 1 from miembros where user_id = auth.uid()) then
    select empresa_id into e from miembros where user_id = auth.uid() limit 1;
    return e;
  end if;
  insert into empresas(nombre) values (coalesce(nullif(trim(nombre), ''), 'Mi taller')) returning id into e;
  insert into miembros(empresa_id, user_id, rol) values (e, auth.uid(), 'propietario');

  insert into estados(empresa_id, clave, nombre, orden, color, final) values
    (e,'borrador','Borrador',1,'gris',false),
    (e,'pte_presupuesto','Pendiente de presupuesto',2,'ambar',false),
    (e,'presupuesto_enviado','Presupuesto enviado',3,'azul',false),
    (e,'presupuesto_aceptado','Presupuesto aceptado',4,'azul',false),
    (e,'pte_compra','Pendiente de compra',5,'ambar',false),
    (e,'pedido_proveedor','Pedido al proveedor',6,'violeta',false),
    (e,'material_recibido','Material recibido',7,'violeta',false),
    (e,'en_personalizacion','En personalización',8,'violeta',false),
    (e,'listo','Listo para entregar',9,'verde',false),
    (e,'entregado','Entregado',10,'verde',true),
    (e,'cancelado','Cancelado',11,'rojo',true);

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

revoke execute on function crear_empresa(text) from anon;
revoke execute on function siguiente_numero(uuid, text, int) from anon, authenticated;

-- ───────── Archivos (logos, diseños, fotos) ─────────
insert into storage.buckets (id, name, public) values ('archivos', 'archivos', false)
on conflict (id) do nothing;

drop policy if exists "archivos leer" on storage.objects;
drop policy if exists "archivos subir" on storage.objects;
drop policy if exists "archivos cambiar" on storage.objects;
drop policy if exists "archivos borrar" on storage.objects;
create policy "archivos leer" on storage.objects for select to authenticated
  using (bucket_id = 'archivos' and es_miembro(((storage.foldername(name))[1])::uuid));
create policy "archivos subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'archivos' and puede_editar(((storage.foldername(name))[1])::uuid));
create policy "archivos cambiar" on storage.objects for update to authenticated
  using (bucket_id = 'archivos' and puede_editar(((storage.foldername(name))[1])::uuid));
create policy "archivos borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'archivos' and puede_editar(((storage.foldername(name))[1])::uuid));

-- ───────── Tiempo real ─────────
do $$
declare t text;
begin
  foreach t in array array['pedidos','pedido_lineas','clientes','presupuestos'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- Índices
create index if not exists i_pedidos_empresa on pedidos(empresa_id, fecha desc);
create index if not exists i_lineas_pedido on pedido_lineas(pedido_id);
create index if not exists i_tallas_linea on linea_tallas(linea_id);
create index if not exists i_pers_pedido on personalizaciones(pedido_id);
create index if not exists i_hist_pedido on pedido_historial(pedido_id, creado);
create index if not exists i_presu_pedido on presupuestos(pedido_id);
create index if not exists i_clientes_empresa on clientes(empresa_id, nombre);
