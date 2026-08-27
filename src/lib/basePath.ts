// basePath.ts
// Prefijo de despliegue de los assets estáticos (texturas, scripts de
// misiones, cualquier archivo servido desde /public).
//
// - Vacío ('')      → sitio en la raíz de un dominio: Vercel, Netlify,
//                      dominio propio, o GitHub Pages de usuario/organización
//                      (usuario.github.io). Es el valor por defecto.
// - '/nombre-repo'  → sitio en una subcarpeta: GitHub Pages de proyecto
//                      (usuario.github.io/nombre-repo/).
//
// Se define en build time vía NEXT_PUBLIC_BASE_PATH (ver next.config.ts,
// que también lo usa para basePath/assetPrefix de Next, y
// .github/workflows/deploy.yml, que lo calcula solo). Nunca hay que
// escribir una ruta absoluta a mano en un componente — siempre pasarla
// por withBasePath() para que funcione sin importar dónde se publique.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''

/** Antepone BASE_PATH a una ruta que arranca en "/". */
export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`
}
