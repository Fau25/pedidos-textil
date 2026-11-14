-- Mis pedidos textiles · 11 · cobro de los trabajos: cuándo se cobró del todo (para las cuentas)
alter table trabajos add column if not exists pagado_en timestamptz;
update trabajos set pagado_en = coalesce(entregado_en, actualizado) where pagado_en is null and total > 0 and a_cuenta >= total;
