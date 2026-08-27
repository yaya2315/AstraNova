// motorMisionesBridge.ts
// Puente entre React y el motor de minijuegos vanilla-JS servido desde
// /public/misiones/*. Esos archivos son módulos ES nativos (no bundleados
// por webpack) — se cargan como assets reales del navegador, igual que
// public/misiones-prueba.html ya los usa para pruebas. El comentario mágico
// `webpackIgnore` le dice a webpack que no intente resolverlos como parte
// del grafo de módulos de la app; por eso las rutas viven en variables
// (un string literal SÍ dispara el intento de resolución estática de TS).

type OpcionesMision = {
  dificultad?: 1 | 2 | 3
  modoAccesible?: boolean
  semilla?: number
  onSuperada?: (metricas: Record<string, unknown>) => void
}

// Juegos ya migrados al motor nuevo — se amplía a medida que se suman fases.
const JUEGOS_LISTOS: Record<string, string> = {
  europa: '/misiones/juegos/mision-europa-senales.js',
  webb: '/misiones/juegos/mision-webb-espejos.js',
  dragonfly: '/misiones/juegos/mision-dragonfly-vuelo.js',
  parker: '/misiones/juegos/mision-parker-escudo.js',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let promesaMotor: Promise<any> | null = null
let estilosInyectados = false

function asegurarEstilos() {
  if (estilosInyectados || typeof document === 'undefined') return
  estilosInyectados = true
  if (document.querySelector('link[data-misiones-estilos]')) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = '/misiones/estilos-misiones.css'
  link.dataset.misionesEstilos = 'true'
  document.head.appendChild(link)
}

async function cargarMotor() {
  asegurarEstilos()
  const rutaMotor = '/misiones/motor-misiones.js'
  if (!promesaMotor) promesaMotor = import(/* webpackIgnore: true */ rutaMotor)
  const motor = await promesaMotor
  for (const [id, ruta] of Object.entries(JUEGOS_LISTOS)) {
    if (!motor.misionEstaRegistrada(id)) {
      motor.registrarMision(id, () => import(/* webpackIgnore: true */ ruta))
    }
  }
  return motor
}

export async function abrirMisionDelMotor(id: string, opciones: OpcionesMision = {}) {
  const motor = await cargarMotor()
  await motor.abrirMision(id, opciones)
}
