// entrada-unificada.js
// Normaliza puntero, teclado y táctil con Pointer Events — nunca mouse/touch
// por separado. Cada juego crea UNA instancia sobre su propio contenedor y la
// destruye al cerrarse. Los listeners de puntero van sobre el contenedor
// (para no capturar gestos fuera del juego); los de teclado van sobre window
// porque el foco puede estar en distintos hijos del juego (botones, sliders).

export function crearEntrada(elemento) {
  const teclasPulsadas = new Set()
  const escuchas = new Map() // nombre de evento -> Set<cb>
  const puntero = { x: 0, y: 0, activo: false }
  let arrastre = { activo: false, inicioX: 0, inicioY: 0 }

  function emitir(evento, detalle) {
    const cbs = escuchas.get(evento)
    if (!cbs) return
    for (const cb of [...cbs]) cb(detalle)
  }

  function alBajarTecla(e) {
    const tecla = e.key.length === 1 ? e.key.toLowerCase() : e.key
    teclasPulsadas.add(tecla)
    emitir('tecla-abajo', { tecla, original: e })
  }
  function alSubirTecla(e) {
    const tecla = e.key.length === 1 ? e.key.toLowerCase() : e.key
    teclasPulsadas.delete(tecla)
    emitir('tecla-arriba', { tecla, original: e })
  }

  // Posición relativa al tamaño LÓGICO del contenedor (clientWidth/Height),
  // no al tamaño renderizado — así un contenedor escalado por CSS (transform)
  // sigue dando coordenadas correctas para dibujar/hacer hit-test.
  function posicionRelativa(e) {
    const r = elemento.getBoundingClientRect()
    const sx = r.width ? elemento.clientWidth / r.width : 1
    const sy = r.height ? elemento.clientHeight / r.height : 1
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy }
  }

  function alPunteroAbajo(e) {
    const p = posicionRelativa(e)
    puntero.x = p.x; puntero.y = p.y; puntero.activo = true
    arrastre = { activo: true, inicioX: p.x, inicioY: p.y }
    emitir('puntero-abajo', { ...p, id: e.pointerId, boton: e.button, original: e })
  }
  function alPunteroMover(e) {
    const p = posicionRelativa(e)
    puntero.x = p.x; puntero.y = p.y
    emitir('puntero-mover', { ...p, arrastrando: arrastre.activo, id: e.pointerId, original: e })
  }
  function alPunteroArriba(e) {
    const p = posicionRelativa(e)
    puntero.activo = false
    arrastre.activo = false
    emitir('puntero-arriba', { ...p, id: e.pointerId, original: e })
  }
  function alPunteroCancelar() {
    puntero.activo = false
    arrastre.activo = false
  }

  // pointerdown consume el gesto (el juego decide si hace preventDefault, p.ej.
  // para impedir el scroll de la página al arrastrar) — no puede ser passive.
  elemento.addEventListener('pointerdown', alPunteroAbajo)
  elemento.addEventListener('pointermove', alPunteroMover, { passive: true })
  elemento.addEventListener('pointerup', alPunteroArriba, { passive: true })
  elemento.addEventListener('pointercancel', alPunteroCancelar, { passive: true })
  elemento.addEventListener('pointerleave', alPunteroCancelar, { passive: true })
  window.addEventListener('keydown', alBajarTecla, { passive: true })
  window.addEventListener('keyup', alSubirTecla, { passive: true })

  return {
    estaPulsada(tecla) {
      return teclasPulsadas.has(tecla.length === 1 ? tecla.toLowerCase() : tecla)
    },
    posicionPuntero() {
      return { x: puntero.x, y: puntero.y, activo: puntero.activo }
    },
    arrastreActivo() {
      return arrastre.activo
    },
    on(evento, cb) {
      if (!escuchas.has(evento)) escuchas.set(evento, new Set())
      escuchas.get(evento).add(cb)
      return () => escuchas.get(evento)?.delete(cb)
    },
    destruir() {
      elemento.removeEventListener('pointerdown', alPunteroAbajo)
      elemento.removeEventListener('pointermove', alPunteroMover)
      elemento.removeEventListener('pointerup', alPunteroArriba)
      elemento.removeEventListener('pointercancel', alPunteroCancelar)
      elemento.removeEventListener('pointerleave', alPunteroCancelar)
      window.removeEventListener('keydown', alBajarTecla)
      window.removeEventListener('keyup', alSubirTecla)
      escuchas.clear()
      teclasPulsadas.clear()
    },
  }
}
