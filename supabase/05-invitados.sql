-- Mis pedidos textiles · solo pueden crear cuenta los emails invitados
create table if not exists invitados (
  email text primary key check (email = lower(trim(email)) and email like '%@%'),
  invitado_por uuid default auth.uid(),
  creado timestamptz not null default now()
);
alter table invitados enable row level security;
drop policy if exists leer on invitados;
drop policy if exists escribir on invitados;
-- Los propietarios de un taller gestionan la lista
create policy leer on invitados for select to authenticated
  using (exists (select 1 from miembros where user_id = auth.uid() and rol = 'propietario'));
create policy escribir on invitados for all to authenticated
  using (exists (select 1 from miembros where user_id = auth.uid() and rol = 'propietario'))
  with check (exists (select 1 from miembros where user_id = auth.uid() and rol = 'propietario'));
grant select, insert, delete on invitados to authenticated;

-- Hook «Before User Created»: rechaza el alta si el email no está en la lista
create or replace function public.hook_solo_invitados(event jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare correo text := lower(trim(event -> 'user' ->> 'email'));
begin
  if correo is not null and exists (select 1 from invitados where email = correo) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403,
    'message', 'Este email no está invitado. Pide a quien te pasó la app que te invite desde Ajustes.'));
end $$;
grant execute on function public.hook_solo_invitados(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_solo_invitados(jsonb) from authenticated, anon, public;
grant usage on schema public to supabase_auth_admin;

-- Los usuarios que ya existen quedan en la lista
insert into invitados(email, invitado_por)
select lower(u.email), u.id from auth.users u where u.email is not null
on conflict (email) do nothing;
