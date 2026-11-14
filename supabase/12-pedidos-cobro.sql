-- Mis pedidos textiles · 12 · cobro de los pedidos: cuándo se cobró (para la pantalla de Cuentas)
alter table pedidos add column if not exists pagado_en timestamptz;
