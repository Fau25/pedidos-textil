-- Mis pedidos textiles · 13 · facturas editables
-- Deja modificar (número, fecha, cliente, conceptos, totales…) y borrar las facturas emitidas a quien puede editar en el taller.
-- Se ejecuta una vez en el SQL Editor; se puede volver a ejecutar sin problema.
alter table facturas add column if not exists editado timestamptz;

drop policy if exists editar on facturas;
create policy editar on facturas for update to authenticated using (puede_editar(empresa_id)) with check (puede_editar(empresa_id));
drop policy if exists borrar on facturas;
create policy borrar on facturas for delete to authenticated using (puede_editar(empresa_id));

grant update (numero, fecha, datos, base, iva, total, editado) on facturas to authenticated;
grant delete on facturas to authenticated;
