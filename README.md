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

`npm run build` compila todo el código React/Three.js a archivos **HTML, CSS y JS reales** dentro de la carpeta [`out/`](out) — no necesita Node ni Next.js corriendo para verse, solo un servidor estático (los `<script>` usan rutas absolutas tipo `/_next/...`, por eso no se puede abrir `out/rey.html` con doble clic directo desde el explorador de archivos).

Formas de abrirlo fácil en VS Code:

1. **Extensión "Live Server"** (recomendado): clic derecho sobre `out/rey.html` → *Open with Live Server*.
2. **Terminal integrada de VS Code**: `npm run start` y abrir `http://localhost:3000` (resuelve solo a `rey.html` gracias a `out/serve.json`).

Cada vez que cambies algo en `src/`, corré `npm run build` de nuevo para regenerar `out/` con los cambios.

### El HTML y el CSS "rey" (el real) — y por qué el JS no tiene uno solo

De todos los archivos que genera el build, **solo hay un HTML real y un CSS real** — por eso `npm run build` los renombra automáticamente a algo identificable:

- `out/rey.html` — el HTML que de verdad sirve el sitio (antes `index.html`).
- `out/_next/static/css/rey.css` — el único CSS real (antes tenía un nombre hasheado tipo `cc1f4c03966b144a.css`).

El **JS no tiene un único "rey"**: Next.js separa el código en 19 archivos a propósito (carga más rápido, cada sección pesada como el sistema solar 3D se descarga solo cuando el usuario navega ahí). El archivo que carga y coordina a todos los demás es `webpack-*.js` (el runtime de módulos) — es lo más parecido a un "JS rey" conceptualmente, pero **no se puede renombrar**: tiene el mapeo `nombre de chunk → archivo` grabado adentro, y los otros 18 archivos están referenciados desde ahí. Ya se probó forzar esto (ver historial de commits) y rompió el build por completo.

Además, cada `npm run build` deja copias de referencia sueltas en la **raíz del proyecto** (afuera de `out/`), con los mismos nombres:

- `rey.html` — copia del HTML real.
- `rey.css` — copia del CSS real.
- `js/` — los 19 archivos JS reales, tal cual, sin subcarpetas.

Son copias de solo lectura para inspeccionar o abrir rápido en el editor — **no son un sitio funcional por sí solas** (el `rey.html` de la raíz sigue apuntando a `/_next/...`, que solo existe dentro de `out/`). Para ver el sitio corriendo de verdad, seguí usando `out/` (Live Server sobre `out/rey.html`, o `npm run start`). Editar `./js/`, `./rey.css` o `./rey.html` no cambia nada — hay que editar `src/` y volver a correr `npm run build`.
