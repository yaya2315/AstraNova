import type { Metadata } from 'next'
import '../../style-general.css'
import AnimatedFavicon from '@/components/AnimatedFavicon'

export const metadata: Metadata = {
  title: 'ASTRA NOVA — Explora el Universo',
  description:
    'Plataforma web inmersiva de exploración espacial. Sistema solar 3D interactivo, historia cósmica, constelaciones y más.',
  keywords: ['astronomía', 'sistema solar', 'planetas', '3D', 'espacio', 'universo'],
  openGraph: {
    title: 'ASTRA NOVA — Explora el Universo',
    description: 'Experiencia espacial inmersiva con sistema solar 3D interactivo.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="ls-pre antialiased">
        <AnimatedFavicon />
        {children}
      </body>
    </html>
  )
}
