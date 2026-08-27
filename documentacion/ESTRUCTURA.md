# ASTRA NOVA — Estructura del Proyecto

## ¿Por qué no hay archivos HTML, CSS y JS separados?

Este proyecto usa **React + Next.js + TypeScript**.
En este framework el HTML, CSS y JavaScript están unidos dentro de los archivos `.tsx` porque cada archivo es un *componente*: una pieza visual que lleva su propio marcado, estilos y lógica junta. Separarlos rompería la aplicación.

Si necesitas una versión con HTML/CSS/JS ya compilados y separados en archivos reales (para abrir con Live Server, por ejemplo), corré `npm run build` — genera la carpeta [`out/`](../out) con el sitio estático. Ver la sección "Abrir la versión independiente" en el [README](../README.md).

---

## Tipos de archivo usados

| Extensión | Lenguaje | Para qué sirve |
|-----------|----------|----------------|
| `.tsx` | TypeScript + JSX (HTML dentro de JS) | Componentes visuales de React |
| `.ts` | TypeScript puro | Datos, lógica, funciones reutilizables |
| `.css` | CSS | Estilos globales y variables de diseño |
| `.json` | JSON | Configuración del proyecto (Next.js, TypeScript, etc.) |

---

## Organización de carpetas

```
Astra Nova t-box/
│
├── src/                        ← Todo el código fuente
│   │
│   ├── app/                    ← Estructura de páginas (Next.js App Router)
│   │   ├── layout.tsx          [TSX] Plantilla base: <html>, fuentes, metadata SEO, importa style-general.css
│   │   └── page.tsx            [TSX] Página principal — TopNav móvil, DeepNavHUD y las 7 capas de contenido
│   │
│   ├── components/             ← Piezas visuales (componentes React)
│   │   ├── DeepNavEngine.tsx           [TSX] Motor de navegación por "capas" (scroll infinito con zoom)
│   │   ├── SolarSystem.tsx             [TSX] Sistema solar 3D interactivo (Three.js / WebGL), texturas reales de public/textures/
│   │   ├── Sections.tsx                [TSX] Secciones: Hero, Historia, Constelaciones, Galería, Misiones, Footer
│   │   ├── SideNav.tsx                 [TSX] Navegación lateral de escritorio (hidden lg:flex)
│   │   ├── MiniSolarSystem.tsx         [TSX] Logo animado (3 planetas orbitando), compartido por SideNav y TopNav
│   │   ├── PremiumSpaceExperience.tsx  [TSX] Fondo fijo: aurora WebGL + viñeta
│   │   ├── AuroraBg.tsx                [TSX] Shader WebGL de aurora boreal de fondo
│   │   └── LoadingScreen.tsx           [TSX] Pantalla de carga inicial
│   │
│   └── lib/                    ← Datos y configuración
│       ├── data.ts             [TS]  Planetas (con textureUrl), constelaciones, misiones, galería
│       └── navItems.tsx        [TSX] Ítems del menú (label + ícono + capa) compartidos entre SideNav y TopNav
│
├── public/                     ← Assets estáticos que Next.js sirve tal cual en /
│   └── textures/                8 texturas JPG reales (2K–8K) del sol, planetas y anillo de Saturno
│
├── style-general.css           [CSS] Estilos globales: colores, botones, glass, animaciones, deep-nav
├── next.config.ts              [TS] Configuración de Next.js (output: 'export' → genera out/)
├── tailwind.config.ts          [TS] Configuración de Tailwind CSS (utilidades de estilo)
├── tsconfig.json               [JSON] Configuración de TypeScript (lenguaje)
├── package.json                [JSON] Lista de dependencias y scripts del proyecto
├── .github/workflows/deploy.yml [YML] Build + publicación automática a GitHub Pages en cada push a main
└── documentacion/ESTRUCTURA.md ← Este archivo
```

El sistema solar 3D carga las texturas reales de `public/textures/*.jpg` vía `THREE.TextureLoader` (función `loadTexture` en `SolarSystem.tsx`) — no genera nada por canvas.

---

## Librerías externas usadas

| Librería | Tipo | Para qué sirve |
|----------|------|----------------|
| **Next.js** | Framework | Estructura de la web, rutas, export estático |
| **React** | Framework UI | Componentes, estado, interactividad |
| **TypeScript** | Lenguaje | JavaScript con tipos (evita errores) |
| **Three.js** | 3D / WebGL | Renderiza el sistema solar en 3D |
| **@react-three/fiber** | 3D | Conecta Three.js con React |
| **@react-three/drei** | 3D helpers | Controles de cámara (`OrbitControls`), estrellas, HTML 3D |
| **Framer Motion** | Animación | Transiciones de capas, menú móvil, entradas de sección |
| **Tailwind CSS** | CSS | Clases de estilos utilitarias |
