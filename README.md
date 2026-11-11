# Mis pedidos textiles

App web (instalable en el móvil) para llevar los pedidos de ropa personalizada de un taller: clientes, prendas con tallas y colores, personalización (bordado, serigrafía, vinilo, DTF), catálogo con fotos de Roly, presupuesto y ticket en PDF. Cada taller tiene sus datos separados y solo pueden registrarse las personas invitadas.

- Web: https://fau25.github.io/pedidos-textil/
- Código: Next.js 16 exportado como web estática + Tailwind 4 + TypeScript estricto
- Datos: Supabase (PostgreSQL con seguridad por filas, Auth, Storage, tiempo real)

## Estructura

| Carpeta | Qué hay |
| --- | --- |
| `app/` | Pantallas: inicio, pedidos (lista, ficha `ver/`, editor `nuevo/`), clientes, catálogo, ajustes |
| `components/` | Piezas de interfaz: marco (barras), editor de pedido, bloques de prenda y de personalización, hojas, avisos |
| `lib/` | Lógica: cálculos (`calculo.ts`, con pruebas), pedidos, Supabase (fotos firmadas, miniaturas, copias), PDF, registro de errores |
| `supabase/` | Migraciones SQL, en orden: `esquema.sql`, `02`…`08` |
| `pruebas/` | Pruebas de pantallas (Chrome con Supabase simulado), de base de datos (PGlite) y de rendimiento |
| `scripts/` | `copia-archivos.mjs`: descarga los archivos de Storage para la copia de seguridad |
| `public/sw.js` | Service worker: abre la app sin esperar a la red y guarda las fotos |

## Probar en local

```bash
npm ci
npm run lint              # revisión del código (oxlint)
npm test                  # cálculos
npm run prueba:sql        # permisos entre talleres, conflictos, borrar cuenta… (Postgres en memoria)
npm run build && npm run prueba:pantallas   # pantallas en Chrome
npm run dev               # http://localhost:3000/pedidos-textil
```

## Publicación

Cada push a `main` ejecuta el workflow **Publicar**, que revisa el código, pasa todas las pruebas, compila y publica en GitHub Pages. El service worker recibe la versión del commit y la app se actualiza sola al abrirla.

## Base de datos

Las migraciones se ejecutan a mano, en orden, en el SQL Editor de Supabase. La 08 añade el administrador, los permisos ajustados, el control de conflictos al guardar pedidos, el registro de errores y la limpieza de las tablas de la versión 1.

## Copias de seguridad

El workflow **Copia de seguridad** se ejecuta cada domingo. Guarda la base de datos (`pg_dump`) y los archivos de Storage, cifrados con AES-256, como artefacto del workflow durante 90 días. Necesita tres secretos en *Settings → Secrets and variables → Actions*:

- `SUPABASE_DB_URL`: cadena de conexión del *Session pooler* (Supabase → Connect), con la contraseña de la base.
- `SUPABASE_SERVICE_KEY`: clave *secret* / *service_role* (Supabase → Settings → API keys).
- `COPIA_CLAVE`: una frase larga que solo tú sepas; sin ella la copia no se puede abrir.

Para restaurar:

```bash
gpg -d copia-AAAA-MM-DD.tar.gz.gpg | tar xz
pg_restore --no-owner -d "$SUPABASE_DB_URL" copia/base.dump
```

Los archivos quedan en `copia/archivos/`.
