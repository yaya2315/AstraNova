# ASTRA NOVA — Proyecto Web

Plataforma web inmersiva de exploración espacial construida con **Next.js + React + TypeScript**.

## Estructura real del proyecto

| Archivo/Carpeta | Rol |
|---|---|
| `src/app/layout.tsx` | Plantilla base (`<html>`, fuentes, metadata SEO) |
| `src/app/page.tsx` | Página principal — ordena todas las secciones |
| `src/components/` | Componentes React (secciones, sistema solar 3D, fondo animado, navegación) |
| `src/lib/` | Datos (planetas, misiones, constelaciones) e ítems del menú |
| `public/textures/` | Texturas JPG reales del sistema solar 3D (sol, planetas, anillo de Saturno) |
| `style-general.css` | Estilos globales (importado desde `layout.tsx`) |

Ver [documentacion/ESTRUCTURA.md](documentacion/ESTRUCTURA.md) para el detalle completo de componentes.

## Scripts

```
npm run dev     # servidor de desarrollo (Turbopack)
npm run build   # genera el sitio estático en out/ (index.html, _next/, texturas...)
npm run start   # sirve out/ en http://localhost:3000 para previsualizar antes de publicar
```

`npm run build` compila todo el código React/Three.js a **HTML, CSS y JS reales** dentro de [`out/`](out) — un sitio 100% estático, sin necesidad de Node ni de un servidor especial para funcionar. `out/index.html` es el archivo real que sirve el sitio (no hace falta renombrarlo ni usar un servidor a medida para que cargue).

## Publicar el sitio

### GitHub Pages (automático)

El repo ya incluye `.github/workflows/deploy.yml`. Al hacer push a `main`:

1. Activá Pages una sola vez: **Settings → Pages → Source: GitHub Actions**.
2. Cada push a `main` corre el build y publica `out/` automáticamente.
3. El workflow detecta solo si el sitio queda en la raíz (repo `tu-usuario.github.io`) o en una subcarpeta (`tu-usuario.github.io/nombre-repo/`) y ajusta las rutas de texturas y scripts (`NEXT_PUBLIC_BASE_PATH`) para que carguen bien en cualquiera de los dos casos.

### Vercel / Netlify / dominio propio

Cualquiera de los dos detecta Next.js solo: conectá el repo y usá `npm run build` con carpeta de salida `out`. No hace falta configurar nada más — el sitio queda en la raíz del dominio.

### Subir la carpeta `out/` a mano

También sirve para Cloudflare Pages, un hosting compartido, o cualquier CDN: corré `npm run build` y subí el contenido de `out/` tal cual. Si el sitio no queda en la raíz del dominio (por ejemplo `midominio.com/astra/`), definí `NEXT_PUBLIC_BASE_PATH=/astra` antes de buildear.
