-- Mis pedidos textiles · 10 · trabajos («Recibí»): encargos rápidos en los que el cliente deja sus prendas
-- Cada trabajo recibe el número siguiente (T-0001, T-0002…) y genera su ticket de recogida.
-- Se ejecuta una vez en el SQL Editor; se puede volver a ejecutar sin problema.

create table if not exists trabajos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas on delete cascade,
  numero text,
  cliente_id uuid references clientes on delete set null,
  cliente_nombre text,
  cliente_telefono text,
  items jsonb not null default '[]',      -- [{id, que, cantidad, tecnica, detalle, diseno_path}]
  entrega date,
  total numeric(12,2) not null default 0,
  a_cuenta numeric(12,2) not null default 0,
  notas text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'listo', 'entregado')),
  listo_en timestamptz,
  entregado_en timestamptz,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  creado_por uuid default auth.uid() references auth.users on delete set null,
  unique (empresa_id, numero)
);
create index if not exists i_trabajos_empresa on trabajos(empresa_id, estado, entrega);

create or replace function numerar_trabajo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.numero is null then
    new.numero := 'T-' || lpad(siguiente_numero(new.empresa_id, 'T', 0)::text, 4, '0');
  end if;
  return new;
end $$;
drop trigger if exists t_numerar on trabajos;
create trigger t_numerar before insert on trabajos for each row execute function numerar_trabajo();
drop trigger if exists t_actualizado on trabajos;
create trigger t_actualizado before update on trabajos for each row execute function tocar_actualizado();

alter table trabajos enable row level security;
drop policy if exists leer on trabajos;
drop policy if exists escribir on trabajos;
create policy leer on trabajos for select to authenticated using (es_miembro(empresa_id));
create policy escribir on trabajos for all to authenticated using (puede_editar(empresa_id)) with check (puede_editar(empresa_id));
grant select, insert, update, delete on trabajos to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'trabajos') then
    alter publication supabase_realtime add table trabajos;
  end if;
end $$;
