-- OPCIONAL · borra definitivamente las tablas que la app ya no usa (no se puede deshacer)
drop trigger if exists t_historial on pedidos;
drop function if exists cambiar_estado(uuid, uuid, text);
drop function if exists registrar_estado();
drop table if exists pedido_historial;
drop table if exists presupuestos;
drop function if exists numerar_presupuesto();
alter table pedidos drop column if exists estado_id;
drop table if exists estados;

