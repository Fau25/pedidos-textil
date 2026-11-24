-- Mis pedidos textiles · 15 · facturas y presupuestos sueltos (sin pedido ni trabajo), desde Cuentas
-- Necesita el 09 y el 13 (facturas). Se puede volver a ejecutar sin problema.

-- Por si quedara la tabla de presupuestos antigua (la v1 la borró el SQL 08)
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'presupuestos' and column_name = 'version') then
    raise exception 'Hay una tabla «presupuestos» antigua: ejecuta antes el SQL 08';
  end if;
end $$;

create table if not exists presupuestos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas on delete cascade,
  numero text not null,
  fecha date not null default current_date,
  validez date,
  datos jsonb not null,                 -- emisor, cliente, conceptos y totales (igual que en las facturas)
  base numeric(12,2) not null default 0,
  iva numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  factura_id uuid references facturas on delete set null,   -- si se convirtió en factura
  creado timestamptz not null default now(),
  creado_por uuid default auth.uid() references auth.users on delete set null,
  editado timestamptz,
  unique (empresa_id, numero)
);
alter table presupuestos enable row level security;
drop policy if exists leer on presupuestos;
create policy leer on presupuestos for select to authenticated using (es_miembro(empresa_id));
drop policy if exists editar on presupuestos;
create policy editar on presupuestos for update to authenticated using (puede_editar(empresa_id)) with check (puede_editar(empresa_id));
drop policy if exists borrar on presupuestos;
create policy borrar on presupuestos for delete to authenticated using (puede_editar(empresa_id));
grant select, delete on presupuestos to authenticated;
grant update (numero, fecha, validez, datos, base, iva, total, factura_id, editado) on presupuestos to authenticated;

-- Crea una factura o un presupuesto suelto con el número siguiente (F-2026-0001 / PR-2026-0001) o el que se indique
create or replace function crear_documento(p_tipo text, p_empresa uuid, p_datos jsonb, p_fecha date default null, p_numero text default null, p_validez date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  f date := coalesce(p_fecha, current_date); a int := extract(year from coalesce(p_fecha, current_date)); n text; r jsonb;
  b numeric := coalesce((p_datos->>'base')::numeric, 0); i numeric := coalesce((p_datos->>'iva')::numeric, 0); t numeric := coalesce((p_datos->>'total')::numeric, 0);
begin
  if p_empresa is null or not puede_editar(p_empresa) then raise exception 'No tienes permiso en este taller'; end if;
  if p_tipo = 'factura' then
    perform pg_advisory_xact_lock(hashtext('factura:' || p_empresa));
    n := coalesce(nullif(trim(p_numero), ''), 'F-' || a || '-' || lpad(siguiente_numero(p_empresa, 'F', a)::text, 4, '0'));
    insert into facturas(empresa_id, numero, fecha, datos, base, iva, total) values (p_empresa, n, f, p_datos, b, i, t)
    returning to_jsonb(facturas.*) into r;
  elsif p_tipo = 'presupuesto' then
    perform pg_advisory_xact_lock(hashtext('presupuesto:' || p_empresa));
    n := coalesce(nullif(trim(p_numero), ''), 'PR-' || a || '-' || lpad(siguiente_numero(p_empresa, 'PR', a)::text, 4, '0'));
    insert into presupuestos(empresa_id, numero, fecha, validez, datos, base, iva, total) values (p_empresa, n, f, p_validez, p_datos, b, i, t)
    returning to_jsonb(presupuestos.*) into r;
  else
    raise exception 'Tipo de documento desconocido: %', p_tipo;
  end if;
  return r;
end $$;
revoke all on function crear_documento(text, uuid, jsonb, date, text, date) from public, anon;
grant execute on function crear_documento(text, uuid, jsonb, date, text, date) to authenticated;
