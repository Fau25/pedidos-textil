-- Mis pedidos textiles · v2: solo Pendiente / Entregado y catálogo con favoritos
alter table pedidos add column if not exists entregado boolean not null default false;
alter table pedidos add column if not exists entregado_en date;
update pedidos p set entregado = true, entregado_en = coalesce(p.entregado_en, p.actualizado::date)
  from estados e where e.id = p.estado_id and e.clave in ('entregado', 'cancelado') and not p.entregado;
create index if not exists i_pedidos_pendientes on pedidos(empresa_id, entregado, entrega);

alter table catalogo add column if not exists referencia text;
alter table catalogo add column if not exists tallas text[] not null default '{}';
alter table catalogo add column if not exists favorito boolean not null default true;
create index if not exists i_catalogo_empresa on catalogo(empresa_id, favorito, tipo);

-- Modelos de Roly habituales para todas las empresas que aún no los tengan
insert into catalogo(empresa_id, tipo, marca, modelo, referencia, colores, tallas, precio_compra, favorito, notas)
select e.id, m.tipo, 'Roly', m.modelo, m.referencia, m.colores, m.tallas, 0, true, m.notas from empresas e cross join (values
  ('Camiseta', 'Beagle', 'CA6554', array['Blanco','Negro','Marino','Azul royal','Rojo','Gris vigoré','Verde botella','Verde kelly','Naranja','Amarillo','Granate','Celeste','Turquesa','Chocolate','Rosa claro','Fucsia','Morado','Gris plomo']::text[], array['S','M','L','XL','XXL','3XL','4XL','1/2','3/4','5/6','7/8','9/10','11/12']::text[], null),
  ('Camiseta cuello pico', 'Samoyedo', 'CA6503', array['Blanco','Negro','Marino','Azul royal','Rojo','Gris vigoré','Verde botella','Granate']::text[], array['S','M','L','XL','XXL','3XL']::text[], 'Revisa los colores'),
  ('Camiseta técnica', 'Mónaco', null, array['Blanco','Negro','Marino','Azul royal','Rojo','Gris vigoré','Verde fluor','Amarillo fluor','Naranja fluor']::text[], array['S','M','L','XL','XXL','3XL']::text[], 'Revisa referencia y colores'),
  ('Sudadera con capucha', 'Urban', null, array['Blanco','Negro','Marino','Azul royal','Rojo','Gris jaspeado','Celeste','Rosa claro','Verde kelly','Granate','Verde botella']::text[], array['S','M','L','XL','XXL','3XL']::text[], null),
  ('Sudadera', 'Clásica', null, array['Blanco','Negro','Marino','Azul royal','Rojo','Gris vigoré','Verde botella','Granate','Celeste']::text[], array['S','M','L','XL','XXL','3XL','3/4','5/6','7/8','9/10','11/12']::text[], 'Revisa referencia y colores'),
  ('Sudadera media cremallera', 'Aneto', 'SU1109', array['Blanco','Negro','Marino','Azul royal','Rojo','Granate','Gris jaspeado','Verde botella']::text[], array['S','M','L','XL','XXL','3XL']::text[], null),
  ('Sudadera oversize', 'Otto', null, array['Blanco','Negro','Marino','Gris jaspeado']::text[], array['S','M','L','XL','XXL','3XL']::text[], 'Revisa referencia y colores'),
  ('Chaqueta softshell', 'Antártida', null, array['Negro','Marino','Rojo','Verde botella','Blanco perla','Gris plomo']::text[], array['S','M','L','XL','XXL','3XL']::text[], null),
  ('Chaqueta acolchada', 'Finland', null, array['Negro','Marino','Rojo','Granate','Azul eléctrico','Ébano','Verde militar']::text[], array['S','M','L','XL','XXL','3XL']::text[], null),
  ('Chaqueta acolchada', 'Norway', null, array['Negro','Marino']::text[], array['S','M','L','XL','XXL','3XL']::text[], null),
  ('Chaqueta softshell', 'Nebraska', null, array['Negro','Marino','Azul royal','Rojo','Verde botella','Aguamarina','Lima']::text[], array['S','M','L','XL','XXL','3XL']::text[], null),
  ('Chaqueta sudadera', 'Ulan', '6439', array['Blanco','Negro','Marino','Azul royal','Rojo','Gris jaspeado']::text[], array['XS','S','M','L','XL','XXL','3XL']::text[], null)
) as m(tipo, modelo, referencia, colores, tallas, notas)
where not exists (select 1 from catalogo c where c.empresa_id = e.id and c.marca = 'Roly' and c.modelo = m.modelo);
