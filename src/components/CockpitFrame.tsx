'use client'

// Marco de "cubierta de observación" — puramente decorativo, simula mirar a
// través del cristal curvo de una nave: viñeta oscura hacia los bordes +
// un reflejo diagonal sutil de vidrio. Vive por encima del stack de capas
// pero por debajo del HUD fijo (SideNav/TopNav, z-998/999) para no restarles
// contraste — y pointer-events:none garantiza que nunca bloquea un clic,
// sin importar el z-index.
export default function CockpitFrame() {
  return (
    <div aria-hidden="true" className="fixed inset-0 z-[35] pointer-events-none overflow-hidden">
      {/* Viñeta + reborde curvo, como el marco de una ventanilla */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow: 'inset 0 0 3px rgba(255,255,255,0.05), inset 0 0 140px 50px rgba(2,6,23,0.9)',
          borderRadius: '42px',
        }}
      />
      {/* Reflejo de cristal — franja diagonal sutil, como luz rebotando en el vidrio */}
      <div
        className="absolute"
        style={{
          top: '-45%', left: '-25%', width: '75%', height: '190%',
          background:
            'linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.03) 48%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 52%, transparent 58%)',
          transform: 'rotate(-6deg)',
        }}
      />
    </div>
  )
}
