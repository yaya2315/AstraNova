# ASTRA NOVA — Proyecto Web

Plataforma web inmersiva de exploración espacial construida con **Next.js + React + TypeScript**.

## Estructura real del proyecto

| Archivo/Carpeta | Rol |
|---|---|
| `src/app/layout.tsx` | Plantilla base (`<html>`, fuentes, metadata SEO) |
| `src/app/page.tsx` | Página principal — ordena todas las secciones |
| `src/components/` | Componentes React (secciones, sistema solar 3D, fondo animado, navegación) |
| `src/hooks/` | Hooks reutilizables |
| `src/lib/data.ts` | Datos de los planetas del sistema solar |
| `style-general.css` | Estilos globales (importado desde `layout.tsx`) |

Ver [documentacion/ESTRUCTURA.md](documentacion/ESTRUCTURA.md) para el detalle completo de componentes.

## Scripts

```
npm run dev     # servidor de desarrollo (Turbopack)
npm run build   # build de producción
npm run start   # sirve el build de producción
```
