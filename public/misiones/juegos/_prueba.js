// _prueba.js — NO es una misión real. Ejercita el contrato completo
// (iniciar/pausar/reanudar/destruir/on) y los cuatro módulos del núcleo para
// validar motor-misiones.js durante la Fase 1. Se borra antes de producción.
import { suscribir } from '../nucleo/bucle-animacion.js'
import { crearEntrada } from '../nucleo/entrada-unificada.js'
import { tono } from '../nucleo/audio-mision.js'
import { evaluarEstrellas } from '../nucleo/evaluador-estrellas.js'

export const meta = {
  titulo: 'Misión de prueba',
  acento: '#5FD9C4',
  objetivo: 'Pulsa el círculo 5 veces, o presiona Enter para fallar a propósito.',
  datoInicial: 'Esto es un arnés de prueba del motor, no una misión real.',
  datoCierre: 'Fase 1 validada: bucle, entrada, audio y estrellas funcionando juntos.',
}

export function crearMision(contenedor, opciones) {
  const escuchas = new Map()
  let pulsos = 0
  let angulo = 0
  let activo = false

  function emitir(evento, detalle) {
    for (const cb of escuchas.get(evento) ?? []) cb(detalle)
  }

  contenedor.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;flex:1;color:#fff;">
      <p>Dificultad: ${opciones.dificultad} · Accesible: ${opciones.modoAccesible} · Semilla: ${opciones.semilla}</p>
      <button type="button" data-prueba-circulo style="width:96px;height:96px;border-radius:50%;background:${meta.acento};border:none;cursor:pointer;transform:rotate(0deg);"></button>
      <p data-prueba-contador>Pulsos: 0 / 5</p>
    </div>
  `
  const circulo = contenedor.querySelector('[data-prueba-circulo]')
  const contador = contenedor.querySelector('[data-prueba-contador]')

  const entrada = crearEntrada(contenedor)
  const quitarPuntero = entrada.on('puntero-abajo', () => {
    if (!activo) return
    pulsos += 1
    contador.textContent = `Pulsos: ${pulsos} / 5`
    tono({ frecuencia: 440 + pulsos * 40, duracion: 0.12 })
    if (pulsos >= 5) {
      const { estrellas } = evaluarEstrellas({
        metricas: { pulsos },
        umbrales: [
          { estrellas: 1, descripcion: 'Completar', condicion: (m) => m.pulsos >= 5 },
          { estrellas: 2, descripcion: 'Sin excederse', condicion: (m) => m.pulsos === 5 },
          { estrellas: 3, descripcion: 'Perfecto', condicion: (m) => m.pulsos === 5 },
        ],
      })
      emitir('superada', { estrellas, pulsos })
    }
  })
  const quitarTecla = entrada.on('tecla-abajo', ({ tecla }) => {
    if (tecla === 'Enter') emitir('fallada', 'Fallo forzado con Enter (prueba)')
  })

  function cuadro(dt) {
    angulo += dt * 90 // gira 90°/s — visual mínimo para probar el bucle compartido
    circulo.style.transform = `rotate(${angulo}deg)`
    emitir('progreso', Math.min(1, pulsos / 5))
  }

  let quitarSuscripcion = null

  return {
    iniciar() {
      activo = true
      quitarSuscripcion = suscribir(cuadro)
    },
    pausar() {
      activo = false
    },
    reanudar() {
      activo = true
    },
    destruir() {
      quitarSuscripcion?.()
      quitarPuntero()
      quitarTecla()
      entrada.destruir()
      contenedor.innerHTML = ''
    },
    on(evento, cb) {
      if (!escuchas.has(evento)) escuchas.set(evento, new Set())
      escuchas.get(evento).add(cb)
      return () => escuchas.get(evento)?.delete(cb)
    },
  }
}
