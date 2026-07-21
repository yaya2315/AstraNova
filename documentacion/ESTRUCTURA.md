# ASTRA NOVA — Estructura del Proyecto

## ¿Por qué no hay archivos HTML, CSS y JS separados?

Este proyecto usa **React + Next.js + TypeScript**.  
En este framework el HTML, CSS y JavaScript están unidos dentro de los archivos `.tsx` porque cada archivo es un *componente*: una pieza visual que lleva su propio marcado, estilos y lógica junta. Separarlos rompería la aplicación.

---

## Tipos de archivo usados

| Extensión | Lenguaje | Para qué sirve |
|-----------|----------|----------------|
| `.tsx` | TypeScript + JSX (HTML dentro de JS) | Componentes visuales de React |
| `.ts` | TypeScript puro | Datos, lógica, funciones reutilizables |
| `.css` | CSS | Estilos globales y variables de diseño |
| `.jpg` | Imagen | Texturas de planetas y fondo espacial |
| `.json` | JSON | Configuración del proyecto (Next.js, TypeScript, etc.) |

---

## Organización de carpetas

```
Astra N/
│
├── src/                        ← Todo el código fuente
│   │
│   ├── app/                    ← Estructura de páginas (Next.js App Router)
│   │   ├── layout.tsx          [TSX] Plantilla base: <html>, fuentes, metadata SEO
│   │   ├── page.tsx            [TSX] Página principal — ordena todas las secciones
│   │   └── globals.css         [CSS] Estilos globales: colores, botones, glass, animaciones
│   │
│   ├── components/             ← Piezas visuales (componentes React)
│   │   ├── SolarSystem.tsx     [TSX] Sistema solar 3D interactivo (Three.js / WebGL)
│   │   ├── Sections.tsx        [TSX] Secciones de la web: Hero, Historia, Constelaciones,
│   │   │                              Galería, Misiones, Footer
│   │   ├── Header.tsx          [TSX] Barra de navegación superior
│   │   ├── SideNav.tsx         [TSX] Navegación lateral con puntos de sección
│   │   ├── PremiumSpaceExperience.tsx  [TSX] Fondo animado con partículas y nebulosas
│   │   ├── CosmicBackground.tsx        [TSX] Canvas de estrellas en el fondo
│   │   ├── HeroPlanet.tsx      [TSX] Planeta 3D giratorio en la sección hero
│   │   └── StarField.tsx       [TSX] Campo de estrellas animado (canvas 2D)
│   │
│   ├── hooks/                  ← Funciones de lógica reutilizable (JavaScript puro)
│   │   ├── useMousePosition.ts [TS] Detecta la posición X/Y del mouse en pantalla
│   │   └── useScrollPosition.ts [TS] Detecta hasta qué punto scrolleó el usuario
│   │
│   └── lib/                    ← Datos y configuración
│       └── data.ts             [TS] Información de los 8 planetas: nombre, tamaño,
│                                     órbita, velocidad, textura, estadísticas, descripción
│
├── public/                     ← Archivos estáticos (se sirven tal cual)
│   ├── space-bg.jpg            [JPG] Imagen de fondo espacial
│   └── textures/               ← Texturas para el sistema solar 3D
│       ├── 8k_sun.jpg          [JPG] Textura del Sol (8K)
│       ├── 8k_earth_daymap.jpg [JPG] Textura de la Tierra (8K)
│       ├── 8k_mars.jpg         [JPG] Textura de Marte (8K)
│       ├── 8k_jupiter.jpg      [JPG] Textura de Júpiter (8K)
│       ├── 8k_saturn.jpg       [JPG] Textura de Saturno (8K)
│       ├── 8k_saturn_ring_alpha.jpg [JPG] Anillos de Saturno (máscara de transparencia)
│       ├── 4k_venus_atmosphere.jpg  [JPG] Textura de Venus con atmósfera (4K)
│       ├── 2k_mercury.jpg      [JPG] Textura de Mercurio (2K)
│       ├── 2k_uranus.jpg       [JPG] Textura de Urano (2K)
│       └── 2k_neptune.jpg      [JPG] Textura de Neptuno (2K)
│
├── next.config.ts              [TS] Configuración de Next.js (framework)
├── tailwind.config.ts          [TS] Configuración de Tailwind CSS (utilidades de estilo)
├── tsconfig.json               [JSON] Configuración de TypeScript (lenguaje)
├── package.json                [JSON] Lista de dependencias y scripts del proyecto
└── ESTRUCTURA.md               ← Este archivo
```

---

## Librerías externas usadas

| Librería | Tipo | Para qué sirve |
|----------|------|----------------|
| **Next.js** | Framework | Estructura de la web, rutas, optimización |
| **React** | Framework UI | Componentes, estado, interactividad |
| **TypeScript** | Lenguaje | JavaScript con tipos (evita errores) |
| **Three.js** | 3D / WebGL | Renderiza el sistema solar en 3D |
| **@react-three/fiber** | 3D | Conecta Three.js con React |
| **@react-three/drei** | 3D helpers | Controles de cámara, estrellas, HTML 3D |
| **Framer Motion** | Animación | Animaciones de entrada de las secciones |
| **Tailwind CSS** | CSS | Clases de estilos utilitarias |
