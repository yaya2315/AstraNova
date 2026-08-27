import type { NextConfig } from 'next'

// Cuando el sitio se publica en una subcarpeta (p. ej. GitHub Pages de
// proyecto: usuario.github.io/nombre-repo/) hay que decirle a Next.js el
// prefijo real con NEXT_PUBLIC_BASE_PATH (formato "/nombre-repo", sin barra
// final). Lo calcula solo .github/workflows/deploy.yml. En Vercel, Netlify
// o un dominio propio en la raíz se deja vacío y no hace falta tocar nada.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

const nextConfig: NextConfig = {
  output: 'export',
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  transpilePackages: ['three'],
}

export default nextConfig
