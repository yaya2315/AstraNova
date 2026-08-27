// mision-parker-escudo.js — «Girar el Escudo» (Parker Solar Probe)
// Regla única: el escudo térmico siempre tiene que estar mirando al Sol. La
// nave real hace exactamente esto — su escudo de carbono aguanta 1.400°C de
// un lado mientras los instrumentos, del otro lado, se quedan a temperatura
// ambiente. Si el escudo mirara para cualquier otro lado, el calor la
// destruiría en segundos.
import { suscribir } from '../nucleo/bucle-animacion.js'
import { crearEntrada } from '../nucleo/entrada-unificada.js'
import { tono, ruido } from '../nucleo/audio-mision.js'
import { evaluarEstrellas } from '../nucleo/evaluador-estrellas.js'
import { crearAyuda, registrarDibujo } from '../nucleo/ayuda-paso-a-paso.js'
import { generarEtapas } from '../nucleo/progresion-dificultad.js'

registrarDibujo('ppe-escudo', () => `
  <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="150" cy="60" r="16" fill="currentColor" opacity=".9"/>
    <path d="M110 30 L110 90 A34 34 0 0 1 110 30 Z" fill="currentColor" opacity=".35"/>
    <path d="M70 40 L84 40" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".55"/>
    <path d="M70 60 L88 60" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".7"/>
    <path d="M70 80 L84 80" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".55"/>
  </svg>`)
registrarDibujo('ppe-vueltas', () => `
  <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="60" r="14" fill="currentColor"/>
    <ellipse cx="60" cy="60" rx="70" ry="30" stroke="currentColor" stroke-width="2.5" opacity=".3"/>
    <ellipse cx="60" cy="60" rx="46" ry="20" stroke="currentColor" stroke-width="2.5" opacity=".5"/>
    <circle cx="106" cy="60" r="6" fill="currentColor" opacity=".8"/>
  </svg>`)

export const meta = {
  titulo: 'Parker Solar Probe · Girar el Escudo',
  acento: '#F0C060',
  objetivo: 'Girá el escudo para que siempre tape al Sol.',
  datoInicial: 'Parker Solar Probe vuela tan cerca del Sol que su escudo térmico tiene que estar siempre del lado correcto, o el calor la destruiría.',
  datoCierre: 'Parker Solar Probe llegó a 6,2 millones de km del Sol — más cerca que ninguna otra nave. Su escudo aguanta 1.400°C de un lado, mientras el otro lado queda a temperatura ambiente.',
}

const PARAMETROS_DIFICULTAD = {
  1: { sectores: 4, pasos: 3 },
  2: { sectores: 6, pasos: 4 },
  3: { sectores: 8, pasos: 5 },
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

function anguloSector(i, n) {
  return -Math.PI / 2 + i * ((2 * Math.PI) / n)
}

// La secuencia nunca repite la misma dirección dos veces seguidas — así cada
// paso siempre exige un giro de verdad, nunca "ya estaba bien".
function generarRonda(azar, config) {
  const n = config.sectores
  const secuencia = []
  let anterior = -1
  for (let i = 0; i < config.pasos; i++) {
    let candidato
    do { candidato = Math.floor(azar() * n) } while (candidato === anterior)
    secuencia.push(candidato)
    anterior = candidato
  }
  // El escudo arranca mirando al sector opuesto al primer objetivo: el
  // primer giro también es un giro real, no un punto de partida ya resuelto.
  const anguloInicial = anguloSector((secuencia[0] + Math.floor(n / 2)) % n, n)
  return { sectores: n, secuencia, paso: 0, resuelto: false, anguloEscudo: anguloInicial }
}

// 5 etapas por nivel: 1 tutorial fijo + 4 etapas reales que crecen en línea
// recta desde una base fácil hasta el objetivo de N1/N2/N3 (ver
// nucleo/progresion-dificultad.js).
const BASE_FACIL = { sectores: 3, pasos: 1 }

function generarSecuenciaRondas(dificultad) {
  const d = PARAMETROS_DIFICULTAD[dificultad]
  return [
    BASE_FACIL,
    ...generarEtapas(BASE_FACIL, d, 4, ['sectores', 'pasos']),
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
  raiz.className = 'ppe-raiz'
  raiz.innerHTML = `
    <div class="ppe-anillo-envoltorio">
      <div class="ppe-anillo" role="group" aria-label="Direcciones alrededor de la nave">
        <div class="ppe-nave"><div class="ppe-escudo"></div></div>
        <div class="ppe-sol"></div>
      </div>
    </div>
    <p class="ppe-anuncio" aria-live="polite"></p>
  `
  contenedor.appendChild(raiz)

  const anilloEl = raiz.querySelector('.ppe-anillo')
  const naveEl = raiz.querySelector('.ppe-nave')
  const escudoEl = raiz.querySelector('.ppe-escudo')
  const solEl = raiz.querySelector('.ppe-sol')
  const anuncioEl = raiz.querySelector('.ppe-anuncio')
  const elementosSector = []

  function anunciar(texto) {
    anuncioEl.textContent = texto
  }

  const RADIO_PCT = 38

  function posicionSector(i, n) {
    const a = anguloSector(i, n)
    return { left: 50 + RADIO_PCT * Math.cos(a), top: 50 + RADIO_PCT * Math.sin(a) }
  }

  function construirAnilloDOM() {
    elementosSector.length = 0
    anilloEl.querySelectorAll('.ppe-sector').forEach((el) => el.remove())
    for (let i = 0; i < ronda.sectores; i++) {
      const pos = posicionSector(i, ronda.sectores)
      const boton = document.createElement('button')
      boton.type = 'button'
      boton.className = 'ppe-sector'
      boton.dataset.i = String(i)
      boton.tabIndex = i === 0 ? 0 : -1
      boton.setAttribute('aria-label', `Dirección ${i + 1} de ${ronda.sectores}`)
      boton.style.left = `${pos.left}%`
      boton.style.top = `${pos.top}%`
      boton.innerHTML = '<span class="ppe-sector-punto"></span>'
      anilloEl.appendChild(boton)
      elementosSector.push(boton)
    }
    pintarEscudo()
  }

  function pintarEscudo() {
    const grados = (ronda.anguloEscudo * 180) / Math.PI + 90
    escudoEl.style.transform = `rotate(${grados}deg)`
  }

  function moverSolAObjetivo() {
    const objetivo = ronda.secuencia[ronda.paso]
    const pos = posicionSector(objetivo, ronda.sectores)
    solEl.style.left = `${pos.left}%`
    solEl.style.top = `${pos.top}%`
    anunciar(`El Sol está en la dirección ${objetivo + 1} de ${ronda.sectores}.`)
    if (indiceRonda === 0) mostrarManita(objetivo, { persistente: true })
  }

  function quitarManita() {
    manitaEl?.remove()
    manitaEl = null
  }

  function mostrarManita(i, { persistente = false } = {}) {
    quitarManita()
    const boton = elementosSector[i]
    if (!boton) return
    manitaEl = document.createElement('div')
    manitaEl.className = 'ppe-manita'
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

  function resaltarPistaSector() {
    if (destruido || !ronda || ronda.resuelto) return
    mostrarManita(ronda.secuencia[ronda.paso])
  }

  function reproducirAcierto() {
    naveEl.classList.add('ppe-nave--pulso')
    setTimeout(() => naveEl.classList.remove('ppe-nave--pulso'), 500)
    tono({ frecuencia: 480, duracion: .16, tipo: 'triangle', ganancia: .16 })
    setTimeout(() => tono({ frecuencia: 720, duracion: .2, tipo: 'sine', ganancia: .14 }), 80)
  }

  function reproducirFallo(i) {
    const boton = elementosSector[i]
    boton?.classList.add('ppe-sector--fallo')
    setTimeout(() => boton?.classList.remove('ppe-sector--fallo'), 320)
    ruido({ duracion: .18, filtro: 900, ganancia: .1 })
  }

  function manejarClicSector(i) {
    if (destruido || pausado || !ronda || ronda.resuelto) return
    tiempoInactividad = 0
    ayuda?.marcarLogro()
    const objetivo = ronda.secuencia[ronda.paso]
    if (i === objetivo) {
      quitarManita()
      ronda.anguloEscudo = anguloSector(i, ronda.sectores)
      pintarEscudo()
      reproducirAcierto()
      anunciar('¡Escudo alineado!')
      ronda.paso += 1
      if (ronda.paso >= ronda.secuencia.length) {
        ronda.resuelto = true
        emitir('progreso', (indiceRonda + 1) / secuenciaRondas.length)
        setTimeout(finalizarRonda, 900)
      } else {
        setTimeout(moverSolAObjetivo, 500)
      }
    } else {
      // La ronda 0 es el tutorial fijo — no cuenta para las estrellas. Las
      // 4 rondas reales (1 a 4) sí, todas por igual.
      if (indiceRonda >= 1) fallosReales += 1
      reproducirFallo(i)
      anunciar('Ahí no está el Sol — probá otra dirección.')
    }
  }

  function iniciarRonda() {
    quitarManita()
    ronda = generarRonda(azar, secuenciaRondas[indiceRonda])
    construirAnilloDOM()
    tiempoInactividad = 0
    moverSolAObjetivo()
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
        { estrellas: 1, descripcion: 'Llegar cerca del Sol', condicion: () => true },
        { estrellas: 2, descripcion: 'Con pocos giros de más', condicion: (m) => m.fallosReales <= 4 },
        { estrellas: 3, descripcion: 'Sin perder de vista al Sol', condicion: (m) => m.fallosReales === 0 },
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
        resaltarPistaSector()
      }
    }
  }

  anilloEl.addEventListener('click', (e) => {
    const boton = e.target.closest('.ppe-sector')
    if (boton) manejarClicSector(Number(boton.dataset.i))
  })

  entrada = crearEntrada(raiz)
  quitarTeclado = entrada.on('tecla-abajo', ({ tecla, original }) => {
    const activo = document.activeElement
    if (!activo?.classList?.contains('ppe-sector')) return
    const i = Number(activo.dataset.i)
    if (tecla === ' ' || tecla === 'Enter') {
      original?.preventDefault?.()
      manejarClicSector(i)
      return
    }
    if (tecla !== 'ArrowLeft' && tecla !== 'ArrowRight') return
    original?.preventDefault?.()
    const n = ronda.sectores
    const destino = tecla === 'ArrowRight' ? (i + 1) % n : (i - 1 + n) % n
    const elDestino = elementosSector[destino]
    if (!elDestino) return
    activo.tabIndex = -1
    elDestino.tabIndex = 0
    elDestino.focus()
    anunciar(`Dirección ${destino + 1} de ${n}`)
  })

  const ayuda = crearAyuda(raiz, {
    id: 'parker',
    pasos: [
      { texto: 'Tocá la dirección donde está el Sol para girar el escudo hacia ahí.', dibujo: 'ppe-escudo' },
      { texto: 'El Sol va a ir cambiando de lugar en cada pasada — segui girando el escudo hacia él.', dibujo: 'ppe-vueltas' },
      { texto: 'Mientras el escudo lo tape, la nave está a salvo.', dibujo: 'meta' },
    ],
    alAbrir: () => { pausado = true },
    alCerrar: () => { pausado = false },
    demostrar: () => demostrar(),
    siguientePista: () => resaltarPistaSector(),
  })

  function demostrar() {
    // Solo una vista previa: nunca llama al manejador real, así que "ver un
    // ejemplo" no puede hacer avanzar la ronda ni girar el escudo de verdad.
    pausado = true
    const objetivo = ronda.secuencia[ronda.paso]
    mostrarManita(objetivo, { persistente: true })
    setTimeout(() => {
      if (destruido) return
      naveEl.classList.add('ppe-nave--pulso')
      tono({ frecuencia: 480, duracion: .16, tipo: 'triangle', ganancia: .12 })
      setTimeout(() => {
        if (destruido) return
        naveEl.classList.remove('ppe-nave--pulso')
        quitarManita()
        pausado = false
      }, 900)
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
.ppe-raiz {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--e-4, 1rem);
  width: 100%;
  height: 100%;
  color: #fff3e0;
  font-family: inherit;
}
.ppe-anillo-envoltorio {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: clamp(220px, 40vh, 340px);
}
.ppe-anillo {
  position: relative;
  width: min(100%, 320px);
  aspect-ratio: 1;
}
.ppe-nave {
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: 22%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, #fff7e0, #F0C060 70%);
  box-shadow: 0 0 24px rgba(240, 192, 96, .5);
}
.ppe-nave--pulso { animation: ppe-pulso-nave .5s ease; }
@keyframes ppe-pulso-nave {
  0% { box-shadow: 0 0 24px rgba(240,192,96,.5); }
  50% { box-shadow: 0 0 46px rgba(240,192,96,.9); }
  100% { box-shadow: 0 0 24px rgba(240,192,96,.5); }
}
.ppe-escudo {
  position: absolute;
  left: 50%; top: 8%;
  width: 30%;
  height: 46%;
  transform-origin: 50% 92%;
  transition: transform .3s ease;
  margin-left: -15%;
}
.ppe-escudo::before {
  content: '';
  position: absolute;
  left: 50%; bottom: 0;
  width: 16%;
  height: 100%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, .3);
  border-radius: 2px;
}
.ppe-escudo::after {
  content: '';
  position: absolute;
  left: 50%; top: 0;
  width: 92%;
  aspect-ratio: 1;
  transform: translate(-50%, -25%);
  border-radius: 50%;
  background: radial-gradient(circle, #ffffff, #dbe2ee 55%, rgba(219,226,238,0));
  box-shadow: 0 0 16px rgba(255,255,255,.75), 0 0 4px #fff;
}
.ppe-sector {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 15%;
  height: 15%;
  border: none;
  background: transparent;
  cursor: pointer;
}
.ppe-sector-punto {
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: 40%;
  height: 40%;
  border-radius: 50%;
  background: rgba(240, 192, 96, .35);
  border: 1px solid rgba(240, 192, 96, .6);
  transition: background .15s ease, transform .15s ease;
}
.ppe-sector:focus-visible .ppe-sector-punto { outline: 2px solid #fff; outline-offset: 2px; }
.ppe-sector--fallo .ppe-sector-punto { background: #ff8fa3; transform: scale(1.15); }
.ppe-sol {
  position: absolute;
  width: 13%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(circle, #fff7d6, #ffcf6b 55%, rgba(255,207,107,0));
  box-shadow: 0 0 20px 6px rgba(255, 207, 107, .6);
  transition: left .5s ease, top .5s ease;
  pointer-events: none;
}
.ppe-manita {
  position: absolute;
  transform: translate(-50%, -140%);
  width: 48px;
  height: 48px;
  color: #fff;
  pointer-events: none;
  animation: ppe-manita-tap 1s ease-in-out infinite;
  z-index: 3;
}
@keyframes ppe-manita-tap {
  0%, 100% { transform: translate(-50%, -140%); }
  50% { transform: translate(-50%, -115%); }
}
.ppe-anuncio { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
@media (prefers-reduced-motion: reduce) {
  .ppe-nave--pulso, .ppe-manita { animation: none !important; }
  .ppe-escudo, .ppe-sol, .ppe-sector-punto { transition: none; }
}
`
