# ASTRA NOVA — Proyecto Web

Plataforma web inmersiva de exploración espacial construida con **Next.js + React + TypeScript**.

## Estructura real del proyecto

| Archivo/Carpeta | Rol |
|---|---|
| `src/app/layout.tsx` | Plantilla base (`<html>`, fuentes, metadata SEO) |
| `src/app/page.tsx` | Página principal — ordena todas las secciones |
| `src/components/` | Componentes React (secciones, sistema solar 3D, fondo animado, navegación) |
| `src/lib/` | Datos (planetas, misiones, constelaciones) e ítems del menú |
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

### Archivos a mano: `./index.html`, `./style.css` y `./js/`

Next.js necesita que el HTML/CSS/JS **reales** vivan dentro de `out/` (rutas tipo `out/_next/static/...`, con nombres hasheados) — su propio motor de carga de módulos depende de esas rutas exactas, así que eso es lo que de verdad usa el sitio para funcionar.

Para tenerlos a mano sin andar abriendo `out/`, cada `npm run build` además copia esos mismos archivos **afuera de `out/`, directo en la raíz del proyecto**:

- `index.html` — copia del HTML compilado.
- `style.css` — todo el CSS ya compilado, en un solo archivo.
- `js/` — cada archivo JS (Next separa el código en varios para cargar más rápido), con nombres planos, sin subcarpetas.

Son copias de solo lectura para inspeccionar o abrir rápido en el editor — **no son un sitio funcional por sí solas** (el `index.html` de la raíz sigue apuntando a `/_next/...`, que solo existe dentro de `out/`). Para ver el sitio corriendo de verdad, seguí usando `out/` (Live Server sobre `out/index.html`, o `npm run start`). Editar `./js/`, `./style.css` o `./index.html` no cambia nada — hay que editar `src/` y volver a correr `npm run build`.
