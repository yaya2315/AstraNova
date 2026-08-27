// ayuda-paso-a-paso.js
// Sistema universal de ayuda para los minijuegos de misiones.
//
// Regla de oro: quien entiende el juego nunca ve este panel. Quien se traba
// lo encuentra en un segundo. No es un tutorial obligatorio y no interrumpe.
//
// Tres capas, cada vez más directa:
//   1. El botón "?" — siempre ahí, nunca insiste más de una vez por partida.
//   2. El panel — pasos de a uno, con un botón para VER UN EJEMPLO si el
//      juego expone demostrar().
//   3. La manita — si tras ver la ayuda el jugador sigue sin lograr nada,
//      llama a siguientePista() del juego para que señale qué tocar.
//
// API:
//   import { crearAyuda, registrarDibujo } from './ayuda-paso-a-paso.js'
//   const ayuda = crearAyuda(contenedor, {
//     id: 'webb',                 // para recordar en localStorage qué ya se vio
//     pasos: [ { texto:'…', dibujo:'arrastrar' }, … ],  // máximo 4
//     alAbrir:  () => juego.pausar(),
//     alCerrar: () => juego.reanudar(),
//     demostrar: () => juego.demostrar(),           // opcional
//     siguientePista: () => juego.siguientePista(),  // opcional
//   })
//   ayuda.marcarLogro()   // el juego llama esto cuando el jugador logra algo
//   ayuda.destruir()
//
// Los dibujos son SVG generados por código (sin imágenes externas). El
// catálogo base vive acá (arrastrar, tocar, esperar, meta); cada juego puede
// sumar los suyos con registrarDibujo(nombre, generador) antes de usarlos.

import { suscribir, desuscribir } from './bucle-animacion.js'

const CLAVE_AYUDA_VISTA = 'astra-ayuda-vista'
const SEGUNDOS_OFERTA = 20 // sin lograr nada → se ofrece ayuda (una vez)
const SEGUNDOS_MANITA = 20 // sin lograr nada tras ver la ayuda → aparece la manita
const SEGUNDOS_OFERTA_VISIBLE = 8 // cuánto dura el globito "¿Te ayudo?" si se ignora

function leerVistas() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_AYUDA_VISTA)) ?? {}
  } catch {
    return {}
  }
}
function marcarVistaGuardada(id) {
  try {
    const vistas = leerVistas()
    vistas[id] = true
    localStorage.setItem(CLAVE_AYUDA_VISTA, JSON.stringify(vistas))
  } catch {
    // localStorage puede fallar (privado, cuota llena) — no es crítico.
  }
}
function yaVistaGuardada(id) {
  return !!leerVistas()[id]
}

// ── Catálogo de dibujos ──────────────────────────────────────────────────
// Cada generador recibe el paso completo (por si un juego quiere pasar
// parámetros propios) y devuelve el string SVG. currentColor hereda de
// --acento-mision, así cada dibujo se tiñe solo con el color de su misión.
const catalogoDibujos = new Map()

export function registrarDibujo(nombre, generador) {
  catalogoDibujos.set(nombre, generador)
}

registrarDibujo('arrastrar', dibujarArrastrar)
registrarDibujo('tocar', dibujarTocar)
registrarDibujo('esperar', dibujarEsperar)
registrarDibujo('meta', dibujarMeta)

function dibujarArrastrar() {
  return `
    <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M40 60 H160" stroke="currentColor" stroke-width="3" stroke-dasharray="6 8" stroke-linecap="round" opacity=".45"/>
      <path d="M142 46 L162 60 L142 74" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>
      <g class="ayuda-dibujo-mano">
        <circle cx="55" cy="60" r="16" fill="currentColor" opacity=".18"/>
        <circle cx="55" cy="60" r="9" fill="currentColor"/>
      </g>
    </svg>`
}

function dibujarTocar() {
  // Los radios de base ya son distintos entre sí (no ambos empiezan en el
  // mismo punto): así, aunque la animación esté apagada por reduced-motion,
  // se siguen viendo como ondas creciendo desde el dedo, no un solo círculo.
  return `
    <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle class="ayuda-dibujo-onda ayuda-dibujo-onda1" cx="100" cy="60" r="14" stroke="currentColor" stroke-width="3" opacity=".7"/>
      <circle class="ayuda-dibujo-onda ayuda-dibujo-onda2" cx="100" cy="60" r="24" stroke="currentColor" stroke-width="3" opacity=".3"/>
      <circle cx="100" cy="60" r="9" fill="currentColor"/>
    </svg>`
}

function dibujarEsperar() {
  return `
    <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="60" r="30" stroke="currentColor" stroke-width="3" opacity=".55"/>
      <line x1="100" y1="60" x2="100" y2="40" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <line class="ayuda-dibujo-manecilla" x1="100" y1="60" x2="115" y2="60" stroke="currentColor" stroke-width="3" stroke-linecap="round"
        style="transform-origin: 100px 60px"/>
    </svg>`
}

function dibujarMeta() {
  return `
    <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g class="ayuda-dibujo-estrella" style="transform-origin: 100px 60px">
        <path d="M100 34 L108 54 L130 56 L113 70 L119 92 L100 80 L81 92 L87 70 L70 56 L92 54 Z" fill="currentColor"/>
      </g>
      <path d="M60 40 L66 46" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".5"/>
      <path d="M140 40 L134 46" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".5"/>
      <path d="M60 84 L66 78" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".5"/>
      <path d="M140 84 L134 78" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".5"/>
    </svg>`
}

// ── Trampa de foco (propia del panel, no la del modal) ──────────────────
function elementosFocables(raiz) {
  return [...raiz.querySelectorAll(
    'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
  )].filter((el) => el.offsetParent !== null)
}
function instalarTrampaFoco(panel) {
  function alTeclado(e) {
    if (e.key !== 'Tab') return
    // Sin esto, el Tab sigue burbujeando hasta la trampa de foco del modal
    // del motor (motor-misiones.js) — que ve un elemento con foco dentro de
    // .mision-modal, calcula SU PROPIA lista de focables (todo el modal, no
    // solo el panel) y termina moviendo el foco afuera de este panel.
    e.stopPropagation()
    const focables = elementosFocables(panel)
    if (focables.length === 0) return
    const primero = focables[0]
    const ultimo = focables[focables.length - 1]
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault(); ultimo.focus()
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault(); primero.focus()
    }
  }
  panel.addEventListener('keydown', alTeclado)
  return () => panel.removeEventListener('keydown', alTeclado)
}

// ── Componente principal ─────────────────────────────────────────────────
export function crearAyuda(contenedor, opciones) {
  const { id, pasos, alAbrir, alCerrar, demostrar, siguientePista } = opciones
  if (!id) throw new Error('crearAyuda: falta opciones.id (identifica la misión para recordar en localStorage qué ya se vio)')
  if (!Array.isArray(pasos) || pasos.length === 0) throw new Error('crearAyuda: falta opciones.pasos')
  if (pasos.length > 4 && typeof console !== 'undefined') {
    console.warn(`[ayuda-paso-a-paso] "${id}" tiene ${pasos.length} pasos — el máximo recomendado es 4. Simplificá el juego, no alargues la ayuda.`)
  }

  let destruido = false
  let pasoActual = 0
  let panelAbierto = false
  let vistaEstaPartida = false
  let ofrecidaEstaPartida = false
  let tiempoSinLogro = 0
  let quitarTrampa = null
  let botonAyudaOrigen = null
  let temporizadorOferta = null

  if (getComputedStyle(contenedor).position === 'static') {
    contenedor.style.position = 'relative'
  }

  const raiz = document.createElement('div')
  raiz.className = 'ayuda-raiz'
  raiz.innerHTML = `
    <button type="button" class="ayuda-boton" aria-haspopup="dialog">
      <span aria-hidden="true">?</span> ¿Cómo se juega?
    </button>
    <div class="ayuda-oferta" hidden>¿Te ayudo?</div>
    <div class="ayuda-panel-fondo" hidden>
      <div class="ayuda-panel" role="dialog" aria-modal="true" aria-label="Cómo se juega" tabindex="-1">
        <div class="ayuda-dibujo" aria-hidden="true"></div>
        <p class="ayuda-texto" aria-live="polite"></p>
        <div class="ayuda-nav">
          <button type="button" class="ayuda-anterior">← Anterior</button>
          <span class="ayuda-contador"></span>
          <button type="button" class="ayuda-siguiente">Siguiente →</button>
        </div>
        <button type="button" class="ayuda-ejemplo" hidden>▶ Ver un ejemplo</button>
      </div>
    </div>
  `
  contenedor.appendChild(raiz)

  const botonAyuda = raiz.querySelector('.ayuda-boton')
  const ofertaEl = raiz.querySelector('.ayuda-oferta')
  const panelFondo = raiz.querySelector('.ayuda-panel-fondo')
  const panel = raiz.querySelector('.ayuda-panel')
  const dibujoEl = raiz.querySelector('.ayuda-dibujo')
  const textoEl = raiz.querySelector('.ayuda-texto')
  const contadorEl = raiz.querySelector('.ayuda-contador')
  const botonAnterior = raiz.querySelector('.ayuda-anterior')
  const botonSiguiente = raiz.querySelector('.ayuda-siguiente')
  const botonEjemplo = raiz.querySelector('.ayuda-ejemplo')

  function pintarPaso() {
    const paso = pasos[pasoActual]
    const generador = catalogoDibujos.get(paso.dibujo)
    dibujoEl.innerHTML = generador ? generador(paso) : ''
    textoEl.textContent = paso.texto
    contadorEl.textContent = `Paso ${pasoActual + 1} de ${pasos.length}`
    botonAnterior.disabled = pasoActual === 0
    const esUltimo = pasoActual === pasos.length - 1
    botonSiguiente.textContent = esUltimo ? 'Entendido, ¡a jugar!' : 'Siguiente →'
    botonEjemplo.hidden = !(esUltimo && typeof demostrar === 'function')
  }

  function abrirPanel() {
    if (panelAbierto || destruido) return
    panelAbierto = true
    pasoActual = 0
    botonAyudaOrigen = document.activeElement
    ocultarOferta()
    pintarPaso()
    panelFondo.hidden = false
    tiempoSinLogro = 0
    if (!vistaEstaPartida) {
      vistaEstaPartida = true
      marcarVistaGuardada(id)
    }
    ofrecidaEstaPartida = true // ya encontró la ayuda: no hace falta seguir ofreciéndola
    quitarTrampa = instalarTrampaFoco(panel)
    alAbrir?.()
    botonSiguiente.focus()
  }

  function cerrarPanel({ reanudar = true } = {}) {
    if (!panelAbierto) return
    panelAbierto = false
    panelFondo.hidden = true
    quitarTrampa?.()
    quitarTrampa = null
    tiempoSinLogro = 0
    if (reanudar) alCerrar?.()
    const foco = botonAyudaOrigen && botonAyudaOrigen.isConnected ? botonAyudaOrigen : botonAyuda
    foco.focus()
  }

  function mostrarOferta() {
    ofrecidaEstaPartida = true
    botonAyuda.classList.add('ayuda-boton--destacado')
    ofertaEl.hidden = false
    setTimeout(() => { botonAyuda.classList.remove('ayuda-boton--destacado') }, 700)
    temporizadorOferta = setTimeout(ocultarOferta, SEGUNDOS_OFERTA_VISIBLE * 1000)
  }
  function ocultarOferta() {
    ofertaEl.hidden = true
    if (temporizadorOferta) { clearTimeout(temporizadorOferta); temporizadorOferta = null }
  }

  botonAyuda.addEventListener('click', abrirPanel)
  ofertaEl.addEventListener('click', abrirPanel)
  botonAnterior.addEventListener('click', () => {
    if (pasoActual > 0) { pasoActual -= 1; pintarPaso() }
  })
  botonSiguiente.addEventListener('click', () => {
    if (pasoActual < pasos.length - 1) { pasoActual += 1; pintarPaso() }
    else cerrarPanel()
  })
  botonEjemplo.addEventListener('click', () => {
    cerrarPanel({ reanudar: false })
    demostrar?.()
  })
  function alTecladoPanel(e) {
    // stopPropagation: si no, el Escape sigue hasta el keydown del propio
    // modal del motor (motor-misiones.js) y dispara SU confirmación de
    // salida por encima de esta — Escape acá solo debe cerrar la ayuda.
    if (e.key === 'Escape' && panelAbierto) { e.preventDefault(); e.stopPropagation(); cerrarPanel() }
  }
  panelFondo.addEventListener('keydown', alTecladoPanel)

  // -- cuadro compartido: cuenta "segundos sin lograr nada" solo cuando el
  // panel está cerrado (si está abierto, el juego ya está pausado por
  // completo y no debe correr ningún reloj). --
  function cuadro(dt) {
    if (panelAbierto || destruido) return
    tiempoSinLogro += dt
    const yaVioAyuda = vistaEstaPartida || yaVistaGuardada(id)
    if (!yaVioAyuda) {
      if (!ofrecidaEstaPartida && tiempoSinLogro >= SEGUNDOS_OFERTA) {
        mostrarOferta()
        tiempoSinLogro = 0
      }
    } else if (typeof siguientePista === 'function' && tiempoSinLogro >= SEGUNDOS_MANITA) {
      tiempoSinLogro = 0
      siguientePista()
    }
  }
  const quitarSuscripcion = suscribir(cuadro)

  return {
    /** El juego llama esto cuando el jugador logra algo real (reinicia el reloj de "sin lograr nada"). */
    marcarLogro() {
      tiempoSinLogro = 0
    },
    abrir: abrirPanel,
    cerrar: cerrarPanel,
    destruir() {
      if (destruido) return
      destruido = true
      quitarSuscripcion()
      ocultarOferta()
      quitarTrampa?.()
      raiz.remove()
    },
  }
}
