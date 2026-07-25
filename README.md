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
npm run build   # genera el HTML/CSS/JS estático en out/
npm run start   # sirve la carpeta out/ ya generada
```

## Abrir la versión independiente (HTML/CSS/JS) en VS Code

`npm run build` compila todo el código React/Three.js a archivos **HTML, CSS y JS reales** dentro de la carpeta [`out/`](out) — no necesita Node ni Next.js corriendo para verse, solo un servidor estático (los `<script>` usan rutas absolutas tipo `/_next/...`, por eso no se puede abrir `out/index.html` con doble clic directo desde el explorador de archivos).

Formas de abrirlo fácil en VS Code:

1. **Extensión "Live Server"** (recomendado): clic derecho sobre `out/index.html` → *Open with Live Server*.
2. **Terminal integrada de VS Code**: `npm run start` y abrir `http://localhost:3000`.

Cada vez que cambies algo en `src/`, corré `npm run build` de nuevo para regenerar `out/` con los cambios.
