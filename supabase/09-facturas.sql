-- Mis pedidos textiles · 09 · facturas
-- Cada factura recibe el número siguiente de su serie y año (F-2026-0001, F-2026-0002…) y queda guardada tal cual se emitió:
-- no se puede cambiar ni borrar desde la app. Se ejecuta una vez en el SQL Editor; se puede volver a ejecutar sin problema.

create table if not exists facturas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas on delete cascade,
  pedido_id uuid unique references pedidos on delete set null,
  numero text not null,
  fecha date not null default current_date,
  datos jsonb not null,                 -- copia fija de lo facturado (emisor, cliente, líneas, totales)
  base numeric(12,2) not null default 0,
  iva numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  creado timestamptz not null default now(),
  creado_por uuid default auth.uid() references auth.users on delete set null,
  unique (empresa_id, numero)
);
alter table facturas enable row level security;
drop policy if exists leer on facturas;
create policy leer on facturas for select to authenticated using (es_miembro(empresa_id));
grant select on facturas to authenticated;
-- Sin políticas de insert/update/delete: solo se crean con emitir_factura y no se tocan después

create or replace function emitir_factura(p_pedido uuid, p_datos jsonb) returns facturas
language plpgsql security definer set search_path = public as $$
declare
  e uuid; f facturas; a int := extract(year from current_date);
begin
  select empresa_id into e from pedidos where id = p_pedido;
  if e is null or not puede_editar(e) then raise exception 'No tienes permiso para facturar este pedido'; end if;
  select * into f from facturas where pedido_id = p_pedido;
  if found then return f; end if;  -- ya estaba facturado: se devuelve la misma
  perform pg_advisory_xact_lock(hashtext('factura:' || e));
  insert into facturas(empresa_id, pedido_id, numero, datos, base, iva, total)
  values (e, p_pedido, 'F-' || a || '-' || lpad(siguiente_numero(e, 'F', a)::text, 4, '0'), p_datos,
          coalesce((p_datos->>'base')::numeric, 0), coalesce((p_datos->>'iva')::numeric, 0), coalesce((p_datos->>'total')::numeric, 0))
  returning * into f;
  return f;
end $$;
revoke all on function emitir_factura(uuid, jsonb) from public, anon;
grant execute on function emitir_factura(uuid, jsonb) to authenticated;
