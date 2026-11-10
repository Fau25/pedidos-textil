# Mis pedidos textiles

App web para gestionar pedidos de ropa personalizada (bordado, serigrafía, vinilo, DTF): clientes, prendas con matriz de tallas, personalizaciones, estados con historial y presupuestos automáticos en PDF.

- Web: https://fau25.github.io/pedidos-textil/
- Datos: Supabase (`supabase/esquema.sql`, se ejecuta en el SQL Editor). Cada usuario tiene su empresa y la base de datos (RLS) solo le deja ver lo suyo.
- Código: Next.js (exportado como web estática) + Tailwind. Se publica solo con GitHub Actions en cada push a `main`.

```bash
npm ci
npm test        # pruebas de los cálculos
npm run dev     # http://localhost:3000/pedidos-textil
```
