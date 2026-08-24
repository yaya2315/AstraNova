// evaluador-estrellas.js
// Convierte las métricas de una partida en 0-3 estrellas más un desglose
// legible de por qué. Este módulo no conoce reglas de ningún juego: cada
// minijuego define sus propios umbrales y le pasa las métricas ya calculadas.
//
// umbrales: Array<{ estrellas: 1|2|3, descripcion: string, condicion: (metricas) => boolean }>
// Se evalúa de mayor a menor: si se cumple la condición de 3 estrellas, esa
// gana; si no, se prueba la de 2, luego la de 1. Si ninguna se cumple, 0.

export function evaluarEstrellas({ metricas, umbrales }) {
  const resultados = umbrales
    .map((u) => ({
      estrellas: u.estrellas,
      descripcion: u.descripcion,
      cumplido: !!u.condicion(metricas),
    }))
    .sort((a, b) => b.estrellas - a.estrellas)

  const logrado = resultados.find((r) => r.cumplido)

  return {
    estrellas: logrado ? logrado.estrellas : 0,
    // Desglose en orden ascendente (1,2,3) — más natural para mostrar como
    // lista de "qué falta para la siguiente estrella".
    desglose: [...resultados].sort((a, b) => a.estrellas - b.estrellas),
  }
}
