-- Mis pedidos textiles · 14 · fotos de Roly públicas
-- Son las fotos de producto que Roly ya publica en su web: así se descargan directamente (y desde la caché de Supabase)
-- sin pedir antes una firma, y salen rápido también la primera vez en cada móvil.
-- Solo afecta al cajón «roly». Los logos y diseños (cajón «archivos») siguen privados.
-- Subir o cambiar fotos de Roly sigue siendo solo del administrador. Se puede volver a ejecutar sin problema.
update storage.buckets set public = true where id = 'roly';
