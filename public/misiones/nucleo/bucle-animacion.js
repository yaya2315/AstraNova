// bucle-animacion.js
// Un único requestAnimationFrame compartido por todo el sistema de misiones.
// Ningún juego crea su propio rAF: se suscriben acá y reciben (dt, tiempoTotal)
// en cada cuadro. Si no queda nadie suscrito, el rAF se detiene solo — no hay
// trabajo de fondo cuando no hay ningún minijuego activo.

const suscriptores = new Set()
const DT_MAXIMO = 0.05 // segundos — evita saltos grandes al volver de una pestaña en segundo plano

let idCuadro = null
let ultimaMarca = null
let tiempoTotal = 0

function cuadro(marcaTiempo) {
  if (ultimaMarca === null) ultimaMarca = marcaTiempo
  let dt = (marcaTiempo - ultimaMarca) / 1000
  if (dt > DT_MAXIMO) dt = DT_MAXIMO
  ultimaMarca = marcaTiempo
  tiempoTotal += dt

  // Copia defensiva: si una fn suscrita se desuscribe a sí misma durante el
  // recorrido (común al terminar un juego), no queremos mutar el Set en vivo.
  for (const fn of [...suscriptores]) fn(dt, tiempoTotal)

  if (suscriptores.size > 0) {
    idCuadro = requestAnimationFrame(cuadro)
  } else {
    idCuadro = null
    ultimaMarca = null
  }
}

/** Suscribe fn(dt, tiempoTotal) al bucle compartido. Devuelve una función para desuscribirse. */
export function suscribir(fn) {
  suscriptores.add(fn)
  if (idCuadro === null) {
    ultimaMarca = null
    idCuadro = requestAnimationFrame(cuadro)
  }
  return () => desuscribir(fn)
}

export function desuscribir(fn) {
  suscriptores.delete(fn)
}

/** Solo para depuración/tests — no lo use la lógica de juego. */
export function _estadoInterno() {
  return { suscriptores: suscriptores.size, corriendo: idCuadro !== null, tiempoTotal }
}
