# ASTRA NOVA — Proyecto Web

## Los tres archivos reyes

| Archivo | Rol |
|---------|-----|
| `index.html` | Estructura HTML de la página |
| `css/estilos-principal.css` | Importa todos los estilos (CSS rey) |
| `js/main.js` | Importa todos los módulos JavaScript (JS rey) |

## Estructura de carpetas

```
Astra N/
├── index.html                        ← HTML REY
├── css/
│   ├── estilos-principal.css         ← CSS REY (solo @import)
│   ├── variables.css                 (colores, fuentes, tokens)
│   ├── base.css                      (reset + utilidades + responsive)
│   ├── navegacion.css                (navbar, logo, hamburger)
│   ├── hero.css                      (sección hero + planetas)
│   ├── sistema-solar.css             (sistema solar CSS 3D)
│   ├── secciones.css                 (historia, constelaciones, galería, misiones)
│   └── footer.css                    (pie de página)
├── js/
│   ├── main.js                       ← JS REY (solo import)
│   └── modulos/
│       ├── estrellas-animadas.js     (starfield canvas de fondo)
│       ├── sistema-solar-3d.js       (8 planetas CSS 3D + drag + info)
│       ├── mapa-constelaciones.js    (mapa estelar interactivo)
│       ├── navegacion.js             (scroll, progreso, links activos)
│       ├── posicion-mouse.js         (utilidad exportable)
│       └── posicion-scroll.js        (utilidad exportable)
└── _backup/
    └── script-original.js            (archivo anterior, solo referencia)
```

## Reglas del proyecto

- CSS y JS **siempre en archivos separados** — nunca incrustados en el HTML
- Nombres de archivos en **minúsculas con guiones**
- Para añadir estilos: crear archivo en `css/` e importarlo en `estilos-principal.css`
- Para añadir funcionalidad: crear módulo en `js/modulos/` e importarlo en `main.js`
