-- Mis pedidos textiles · el usuario puede borrar su cuenta y todos sus datos.
-- Si es propietario de un taller, se borra el taller entero (pedidos, clientes, catálogo, tarifas…).
-- Los archivos (logo, diseños, fotos) los borra la app antes de llamar a esta función.
create or replace function public.borrar_mi_cuenta() returns void
language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  e uuid;
begin
  if u is null then raise exception 'Sin sesión'; end if;
  for e in select empresa_id from miembros where user_id = u and rol = 'propietario' loop
    delete from pedidos where empresa_id = e;   -- primero los pedidos (los clientes no se pueden borrar con pedidos)
    delete from empresas where id = e;          -- el resto se borra en cascada
  end loop;
  delete from miembros where user_id = u;
  delete from invitados where invitado_por = u or email = (select lower(email) from auth.users where id = u);
  delete from auth.users where id = u;
end $$;
revoke all on function public.borrar_mi_cuenta() from public, anon;
grant execute on function public.borrar_mi_cuenta() to authenticated;
