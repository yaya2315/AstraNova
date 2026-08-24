// audio-mision.js
// Audio 100% sintetizado con Web Audio API — cero archivos externos. Un solo
// AudioContext perezoso, creado recién en la primera interacción real del
// usuario (los navegadores bloquean audio sin gesto previo), más un flag
// global de silencio que respetan las tres funciones de disparo.

let contexto = null
let silenciado = false

function obtenerContexto() {
  if (!contexto) {
    const Constructor = window.AudioContext || window.webkitAudioContext
    contexto = new Constructor()
  }
  if (contexto.state === 'suspended') contexto.resume()
  return contexto
}

export function establecerSilencio(valor) {
  silenciado = !!valor
}

export function estaSilenciado() {
  return silenciado
}

/** Un tono simple. tipo: 'sine' | 'square' | 'sawtooth' | 'triangle'. */
export function tono({ frecuencia = 440, duracion = 0.2, tipo = 'sine', ganancia = 0.2 } = {}) {
  if (silenciado) return
  const ctx = obtenerContexto()
  const osc = ctx.createOscillator()
  const nodoGanancia = ctx.createGain()
  osc.type = tipo
  osc.frequency.value = frecuencia
  nodoGanancia.gain.setValueAtTime(ganancia, ctx.currentTime)
  nodoGanancia.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duracion)
  osc.connect(nodoGanancia).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + duracion)
}

/** Barrido de frecuencia — usado para aciertos, chirps, alarmas ascendentes/descendentes. */
export function barrido({ desde = 220, hasta = 880, duracion = 0.4, tipo = 'sine', ganancia = 0.2 } = {}) {
  if (silenciado) return
  const ctx = obtenerContexto()
  const osc = ctx.createOscillator()
  const nodoGanancia = ctx.createGain()
  osc.type = tipo
  osc.frequency.setValueAtTime(Math.max(desde, 1), ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(Math.max(hasta, 1), ctx.currentTime + duracion)
  nodoGanancia.gain.setValueAtTime(ganancia, ctx.currentTime)
  nodoGanancia.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duracion)
  osc.connect(nodoGanancia).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + duracion)
}

/** Ruido blanco filtrado — fallos, estática, texturas de fondo. */
export function ruido({ duracion = 0.3, filtro = 1200, ganancia = 0.15 } = {}) {
  if (silenciado) return
  const ctx = obtenerContexto()
  const muestras = Math.max(1, Math.floor(ctx.sampleRate * duracion))
  const buffer = ctx.createBuffer(1, muestras, ctx.sampleRate)
  const datos = buffer.getChannelData(0)
  for (let i = 0; i < muestras; i++) datos[i] = Math.random() * 2 - 1

  const fuente = ctx.createBufferSource()
  fuente.buffer = buffer
  const filtroPaso = ctx.createBiquadFilter()
  filtroPaso.type = 'lowpass'
  filtroPaso.frequency.value = filtro
  const nodoGanancia = ctx.createGain()
  nodoGanancia.gain.setValueAtTime(ganancia, ctx.currentTime)
  nodoGanancia.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duracion)

  fuente.connect(filtroPaso).connect(nodoGanancia).connect(ctx.destination)
  fuente.start()
  fuente.stop(ctx.currentTime + duracion)
}

/**
 * Los tres disparadores de arriba son de un solo uso y se limpian solos
 * (stop() programado). Si un juego necesita un oscilador SOSTENIDO (p. ej. un
 * drone que sube de tono con la temperatura), debe crear y guardar su propio
 * nodo con el contexto de abajo, y detenerlo en su propio destruir() — el
 * contrato de cada juego es responsable de limpiar lo que sostiene.
 */
export function obtenerContextoCompartido() {
  return obtenerContexto()
}
