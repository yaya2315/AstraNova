// mision-lisa-vuelolibre.js — «Vuelo Libre» (LISA Pathfinder)
// Regla única: tocá el lado de la nave que se está por acercar a una masa,
// para alejarla a tiempo. Esto es "control sin roce" (drag-free control) de
// verdad: las dos masas de prueba flotan en caída libre perfecta, fijas en
// el espacio — es la NAVE la que se mueve sola alrededor de ellas para no
// tocarlas nunca. Nunca al revés.
import { suscribir } from '../nucleo/bucle-animacion.js'
import { crearEntrada } from '../nucleo/entrada-unificada.js'
import { tono, ruido } from '../nucleo/audio-mision.js'
import { evaluarEstrellas } from '../nucleo/evaluador-estrellas.js'
import { crearAyuda, registrarDibujo } from '../nucleo/ayuda-paso-a-paso.js'
import { generarEtapas } from '../nucleo/progresion-dificultad.js'

registrarDibujo('lpf-alerta', () => `
  <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="60" y="30" width="80" height="60" rx="8" stroke="currentColor" stroke-width="3" opacity=".5"/>
    <circle cx="88" cy="60" r="7" fill="currentColor"/>
    <circle cx="112" cy="60" r="7" fill="currentColor"/>
    <path d="M140 44 L156 60 L140 76" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`)
registrarDibujo('lpf-empuje', () => `
  <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="60" y="30" width="80" height="60" rx="8" stroke="currentColor" stroke-width="3" opacity=".7"/>
    <circle cx="88" cy="60" r="7" fill="currentColor"/>
    <circle cx="112" cy="60" r="7" fill="currentColor"/>
    <path d="M40 45 L52 60 L40 75" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>
    <circle class="ayuda-dibujo-onda ayuda-dibujo-onda1" cx="30" cy="60" r="8" stroke="currentColor" stroke-width="2.5" opacity=".6"/>
    <circle class="ayuda-dibujo-onda ayuda-dibujo-onda2" cx="30" cy="60" r="14" stroke="currentColor" stroke-width="2.5" opacity=".3"/>
  </svg>`)

export const meta = {
  titulo: 'LISA Pathfinder · Vuelo Libre',
  acento: '#34D399',
  objetivo: 'Tocá el lado de la nave que se acerca a una masa, para alejarla a tiempo.',
  datoInicial: 'Adentro de LISA Pathfinder flotan dos cubos que nunca deben tocar nada. Cuando la nave se acerca a uno, hay que empujarla para el otro lado.',
  datoCierre: 'LISA Pathfinder mantuvo dos cubos de oro y platino flotando en caída libre casi perfecta durante meses, sin tocar nada — moviendo la nave alrededor de ellos, nunca al revés. Así se probó la tecnología para detectar ondas gravitacionales desde el espacio.',
}

const PARAMETROS_DIFICULTAD = {
  1: { lados: 4, pasos: 3 },
  2: { lados: 6, pasos: 4 },
  3: { lados: 8, pasos: 5 },
}

const SEGUNDOS_PISTA_AUTOMATICA = 45

function crearAleatorio(semilla) {
  let estado = semilla >>> 0
  return function () {
    estado = (estado + 0x6d2b79f5) | 0
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function anguloLado(i, n) {
  return -Math.PI / 2 + i * ((2 * Math.PI) / n)
}

// La secuencia nunca repite el mismo lado dos veces seguidas — cada paso
// siempre exige empujar la nave para un lado nuevo, nunca "ya estaba bien".
function generarRonda(azar, config) {
  const n = config.lados
  const secuencia = []
  let anterior = -1
  for (let i = 0; i < config.pasos; i++) {
    let candidato
    do { candidato = Math.floor(azar() * n) } while (candidato === anterior)
    secuencia.push(candidato)
    anterior = candidato
  }
  return { lados: n, secuencia, paso: 0, resuelto: false }
}

// 5 etapas por nivel: 1 tutorial fijo + 4 etapas reales que crecen en línea
// recta desde una base fácil hasta el objetivo de N1/N2/N3. La base queda
// deliberadamente por debajo del objetivo de N1 (3 lados en vez de 4) para
// que incluso el nivel más fácil muestre una curva real dentro de sus 4
// etapas, no solo un valor plano repetido (ver nucleo/progresion-dificultad.js).
const BASE_FACIL = { lados: 3, pasos: 1 }

function generarSecuenciaRondas(dificultad) {
  const d = PARAMETROS_DIFICULTAD[dificultad]
  return [
    BASE_FACIL,
    ...generarEtapas(BASE_FACIL, d, 4, ['lados', 'pasos']),
  ]
}

export function crearMision(contenedor, opciones) {
  const azar = crearAleatorio(opciones.semilla >>> 0 || Date.now())
  const escuchas = new Map()
  function emitir(evento, detalle) {
    for (const cb of escuchas.get(evento) ?? []) cb(detalle)
  }

  let destruido = false
  let pausado = false
  let quitarSuscripcion = null
  let entrada = null
  let quitarTeclado = null

  const secuenciaRondas = generarSecuenciaRondas(opciones.dificultad)
  let indiceRonda = 0
  let ronda = null
  let fallosReales = 0
  let tiempoInactividad = 0
  let manitaEl = null

  const estilo = document.createElement('style')
  estilo.textContent = CSS_JUEGO
  contenedor.appendChild(estilo)

  const raiz = document.createElement('div')
  raiz.className = 'lpf-raiz'
  raiz.innerHTML = `
    <div class="lpf-anillo-envoltorio">
      <div class="lpf-anillo" role="group" aria-label="Lados de la nave">
        <div class="lpf-nave">
          <span class="lpf-masa lpf-masa--a"></span>
          <span class="lpf-masa lpf-masa--b"></span>
        </div>
      </div>
    </div>
    <p class="lpf-anuncio" aria-live="polite"></p>
  `
  contenedor.appendChild(raiz)

  const anilloEl = raiz.querySelector('.lpf-anillo')
  const naveEl = raiz.querySelector('.lpf-nave')
  const anuncioEl = raiz.querySelector('.lpf-anuncio')
  const elementosLado = []

  function anunciar(texto) {
    anuncioEl.textContent = texto
  }

  const RADIO_PCT = 38

  function posicionLado(i, n) {
    const a = anguloLado(i, n)
    return { left: 50 + RADIO_PCT * Math.cos(a), top: 50 + RADIO_PCT * Math.sin(a) }
  }

  function construirAnilloDOM() {
    elementosLado.length = 0
    anilloEl.querySelectorAll('.lpf-lado').forEach((el) => el.remove())
    for (let i = 0; i < ronda.lados; i++) {
      const pos = posicionLado(i, ronda.lados)
      const boton = document.createElement('button')
      boton.type = 'button'
      boton.className = 'lpf-lado'
      boton.dataset.i = String(i)
      boton.tabIndex = i === 0 ? 0 : -1
      boton.setAttribute('aria-label', `Lado ${i + 1} de ${ronda.lados}`)
      boton.style.left = `${pos.left}%`
      boton.style.top = `${pos.top}%`
      anilloEl.appendChild(boton)
      elementosLado.push(boton)
    }
  }

  function marcarPeligro() {
    elementosLado.forEach((el) => el.classList.remove('lpf-lado--peligro'))
    const objetivo = ronda.secuencia[ronda.paso]
    elementosLado[objetivo]?.classList.add('lpf-lado--peligro')
    anunciar(`La nave se acerca por el lado ${objetivo + 1} de ${ronda.lados}.`)
    if (indiceRonda === 0) mostrarManita(objetivo, { persistente: true })
  }

  function quitarManita() {
    manitaEl?.remove()
    manitaEl = null
  }

  function mostrarManita(i, { persistente = false } = {}) {
    quitarManita()
    const boton = elementosLado[i]
    if (!boton) return
    manitaEl = document.createElement('div')
    manitaEl.className = 'lpf-manita'
    manitaEl.innerHTML = `
      <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="30" cy="24" r="14" fill="currentColor" opacity=".25"/>
        <circle cx="30" cy="24" r="7" fill="currentColor"/>
      </svg>`
    manitaEl.style.left = boton.style.left
    manitaEl.style.top = boton.style.top
    anilloEl.appendChild(manitaEl)
    if (!persistente) setTimeout(quitarManita, 2600)
  }

  function resaltarPistaLado() {
    if (destruido || !ronda || ronda.resuelto) return
    mostrarManita(ronda.secuencia[ronda.paso])
  }

  function reproducirAcierto(i) {
    naveEl.classList.remove('lpf-nave--choque')
    const dx = -Math.round(Math.cos(anguloLado(i, ronda.lados)) * 8)
    const dy = -Math.round(Math.sin(anguloLado(i, ronda.lados)) * 8)
    naveEl.style.setProperty('--lpf-dx', `${dx}px`)
    naveEl.style.setProperty('--lpf-dy', `${dy}px`)
    naveEl.classList.add('lpf-nave--empuje')
    setTimeout(() => naveEl.classList.remove('lpf-nave--empuje'), 400)
    tono({ frecuencia: 420, duracion: .12, tipo: 'sine', ganancia: .14 })
    setTimeout(() => tono({ frecuencia: 640, duracion: .16, tipo: 'triangle', ganancia: .12 }), 70)
  }

  function reproducirFallo() {
    naveEl.classList.add('lpf-nave--choque')
    setTimeout(() => naveEl.classList.remove('lpf-nave--choque'), 320)
    ruido({ duracion: .18, filtro: 700, ganancia: .1 })
  }

  function manejarClicLado(i) {
    if (destruido || pausado || !ronda || ronda.resuelto) return
    tiempoInactividad = 0
    ayuda?.marcarLogro()
    const objetivo = ronda.secuencia[ronda.paso]
    if (i === objetivo) {
      quitarManita()
      reproducirAcierto(i)
      anunciar('¡Nave alejada a tiempo!')
      ronda.paso += 1
      if (ronda.paso >= ronda.secuencia.length) {
        ronda.resuelto = true
        elementosLado.forEach((el) => el.classList.remove('lpf-lado--peligro'))
        emitir('progreso', (indiceRonda + 1) / secuenciaRondas.length)
        setTimeout(finalizarRonda, 900)
      } else {
        setTimeout(marcarPeligro, 500)
      }
    } else {
      // La ronda 0 es el tutorial fijo — no cuenta para las estrellas. Las
      // 4 rondas reales (1 a 4) sí, todas por igual.
      if (indiceRonda >= 1) fallosReales += 1
      reproducirFallo()
      anunciar('Ahí no había peligro — mirá bien qué lado se acerca.')
    }
  }

  function iniciarRonda() {
    quitarManita()
    ronda = generarRonda(azar, secuenciaRondas[indiceRonda])
    construirAnilloDOM()
    tiempoInactividad = 0
    marcarPeligro()
  }

  function finalizarRonda() {
    quitarManita()
    if (indiceRonda >= secuenciaRondas.length - 1) {
      finalizarPartida()
    } else {
      indiceRonda += 1
      setTimeout(iniciarRonda, 700)
    }
  }

  function finalizarPartida() {
    const { estrellas } = evaluarEstrellas({
      metricas: { fallosReales },
      umbrales: [
        { estrellas: 1, descripcion: 'Mantenerlas libres', condicion: () => true },
        { estrellas: 2, descripcion: 'Con pocos empujones de más', condicion: (m) => m.fallosReales <= 4 },
        { estrellas: 3, descripcion: 'Sin tocarlas nunca', condicion: (m) => m.fallosReales === 0 },
      ],
    })
    emitir('superada', { estrellas, fallosReales })
  }

  function cuadro(dt) {
    if (pausado || destruido || !ronda) return
    if (!ronda.resuelto) {
      tiempoInactividad += dt
      if (tiempoInactividad >= SEGUNDOS_PISTA_AUTOMATICA) {
        tiempoInactividad = 0
        resaltarPistaLado()
      }
    }
  }

  anilloEl.addEventListener('click', (e) => {
    const boton = e.target.closest('.lpf-lado')
    if (boton) manejarClicLado(Number(boton.dataset.i))
  })

  entrada = crearEntrada(raiz)
  quitarTeclado = entrada.on('tecla-abajo', ({ tecla, original }) => {
    const activo = document.activeElement
    if (!activo?.classList?.contains('lpf-lado')) return
    const i = Number(activo.dataset.i)
    if (tecla === ' ' || tecla === 'Enter') {
      original?.preventDefault?.()
      manejarClicLado(i)
      return
    }
    if (tecla !== 'ArrowLeft' && tecla !== 'ArrowRight') return
    original?.preventDefault?.()
    const n = ronda.lados
    const destino = tecla === 'ArrowRight' ? (i + 1) % n : (i - 1 + n) % n
    const elDestino = elementosLado[destino]
    if (!elDestino) return
    activo.tabIndex = -1
    elDestino.tabIndex = 0
    elDestino.focus()
    anunciar(`Lado ${destino + 1} de ${n}`)
  })

  const ayuda = crearAyuda(raiz, {
    id: 'lisa',
    pasos: [
      { texto: 'Tocá el lado donde la nave se está por acercar a una masa.', dibujo: 'lpf-alerta' },
      { texto: 'Eso la empuja para el otro lado, antes de que la toque.', dibujo: 'lpf-empuje' },
      { texto: 'Mientras nunca las toque, las masas siguen flotando libres.', dibujo: 'meta' },
    ],
    alAbrir: () => { pausado = true },
    alCerrar: () => { pausado = false },
    demostrar: () => demostrar(),
    siguientePista: () => resaltarPistaLado(),
  })

  function demostrar() {
    // Solo una vista previa: nunca llama al manejador real, así que "ver un
    // ejemplo" no puede hacer avanzar la ronda de verdad.
    pausado = true
    const objetivo = ronda.secuencia[ronda.paso]
    mostrarManita(objetivo, { persistente: true })
    setTimeout(() => {
      if (destruido) return
      reproducirAcierto(objetivo)
      setTimeout(() => {
        if (destruido) return
        quitarManita()
        pausado = false
      }, 500)
    }, 900)
  }

  return {
    iniciar() {
      iniciarRonda()
      quitarSuscripcion = suscribir(cuadro)
    },
    pausar() { pausado = true },
    reanudar() { pausado = false },
    destruir() {
      if (destruido) return
      destruido = true
      quitarSuscripcion?.()
      quitarTeclado?.()
      entrada?.destruir()
      ayuda.destruir()
      estilo.remove()
      contenedor.innerHTML = ''
      escuchas.clear()
    },
    on(evento, cb) {
      if (!escuchas.has(evento)) escuchas.set(evento, new Set())
      escuchas.get(evento).add(cb)
      return () => escuchas.get(evento)?.delete(cb)
    },
  }
}

const CSS_JUEGO = `
.lpf-raiz {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--e-4, 1rem);
  width: 100%;
  height: 100%;
  color: #e3fff2;
  font-family: inherit;
}
.lpf-anillo-envoltorio {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: clamp(220px, 40vh, 340px);
}
.lpf-anillo {
  position: relative;
  width: min(100%, 320px);
  aspect-ratio: 1;
}
.lpf-nave {
  position: absolute;
  left: 50%; top: 50%;
  width: 34%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border-radius: 22%;
  border: 2px solid rgba(52, 211, 153, .55);
  background: linear-gradient(160deg, rgba(52,211,153,.14), rgba(10,30,24,.6));
  box-shadow: 0 0 22px rgba(52, 211, 153, .25);
  --lpf-dx: 0px;
  --lpf-dy: 0px;
}
.lpf-nave--empuje { animation: lpf-empuje-nave .4s ease; }
@keyframes lpf-empuje-nave {
  0% { transform: translate(-50%, -50%); }
  35% { transform: translate(calc(-50% + var(--lpf-dx)), calc(-50% + var(--lpf-dy))); }
  100% { transform: translate(-50%, -50%); }
}
.lpf-nave--choque { animation: lpf-choque-nave .32s ease; }
@keyframes lpf-choque-nave {
  0%, 100% { border-color: rgba(52, 211, 153, .55); }
  50% { border-color: #ff8fa3; box-shadow: 0 0 22px rgba(255,143,163,.5); }
}
.lpf-masa {
  position: absolute;
  top: 50%;
  width: 16%;
  aspect-ratio: 1;
  border-radius: 30%;
  background: radial-gradient(circle, #fff7e0, #d4af6a 70%);
  box-shadow: 0 0 10px rgba(212, 175, 106, .6);
  transform: translateY(-50%);
}
.lpf-masa--a { left: 32%; transform: translate(-50%, -50%); }
.lpf-masa--b { left: 68%; transform: translate(-50%, -50%); }
.lpf-lado {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 15%;
  height: 15%;
  border: none;
  background: transparent;
  cursor: pointer;
}
.lpf-lado::before {
  content: '';
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: 40%;
  height: 40%;
  border-radius: 50%;
  background: rgba(52, 211, 153, .3);
  border: 1px solid rgba(52, 211, 153, .55);
  transition: background .15s ease, transform .15s ease, box-shadow .15s ease;
}
.lpf-lado:focus-visible::before { outline: 2px solid #fff; outline-offset: 2px; }
.lpf-lado--peligro::before {
  background: #ff8fa3;
  border-color: #ff8fa3;
  transform: translate(-50%, -50%) scale(1.25);
  box-shadow: 0 0 14px rgba(255, 143, 163, .7);
  animation: lpf-peligro-pulso 1s ease-in-out infinite;
}
@keyframes lpf-peligro-pulso {
  0%, 100% { box-shadow: 0 0 14px rgba(255,143,163,.7); }
  50% { box-shadow: 0 0 22px rgba(255,143,163,.95); }
}
.lpf-manita {
  position: absolute;
  transform: translate(-50%, -140%);
  width: 48px;
  height: 48px;
  color: #fff;
  pointer-events: none;
  animation: lpf-manita-tap 1s ease-in-out infinite;
  z-index: 3;
}
@keyframes lpf-manita-tap {
  0%, 100% { transform: translate(-50%, -140%); }
  50% { transform: translate(-50%, -115%); }
}
.lpf-anuncio { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
@media (prefers-reduced-motion: reduce) {
  .lpf-nave--empuje, .lpf-nave--choque, .lpf-lado--peligro::before, .lpf-manita { animation: none !important; }
  .lpf-lado::before { transition: none; }
}
`
