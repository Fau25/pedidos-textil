-- Fotos de producto de Roly: carpeta privada compartida por toda la familia.
-- Solo la ven usuarios con sesión (el registro es solo para invitados). Archivos: <REFERENCIA>.jpg
insert into storage.buckets (id, name, public) values ('roly', 'roly', false)
on conflict (id) do nothing;

drop policy if exists "roly leer" on storage.objects;
drop policy if exists "roly subir" on storage.objects;
drop policy if exists "roly cambiar" on storage.objects;
create policy "roly leer" on storage.objects for select to authenticated using (bucket_id = 'roly');
create policy "roly subir" on storage.objects for insert to authenticated with check (bucket_id = 'roly');
create policy "roly cambiar" on storage.objects for update to authenticated using (bucket_id = 'roly') with check (bucket_id = 'roly');
