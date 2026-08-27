// progresion-dificultad.js — helper compartido por los 6 juegos de misiones.
//
// Antes, cada juego armaba su secuencia de rondas a mano así:
//   [tutorial-facil, tutorial-facil-2, objetivoDelNivel, objetivoDelNivel]
// Es decir: dos rondas de práctica siempre iguales, y después el mismo
// objetivo del nivel elegido (N1/N2/N3) repetido dos veces sin ninguna
// escalada real entre medio. Resultado: cambiar de N1 a N3 se sentía como
// "un salto único", no como una curva — y con juegos cortos, casi no se
// notaba.
//
// Ahora cada misión tiene 5 ETAPAS por nivel: 1 tutorial fijo (siempre igual,
// enseña la regla) + 4 etapas reales que interpolan en línea recta desde una
// base fácil hasta el objetivo real de N1/N2/N3 — así SIEMPRE hay una curva
// de dificultad creciente dentro de cada nivel, y el objetivo final (el más
// difícil) sí depende del N1/N2/N3 elegido.
//
// generarEtapas(base, objetivo, cantidad, enteros)
//   base      → configuración más fácil posible (punto de partida, igual sin
//               importar el nivel elegido)
//   objetivo  → PARAMETROS_DIFICULTAD[dificultad] del nivel elegido (la meta
//               que se alcanza justo en la última etapa)
//   cantidad  → cuántas etapas generar (para las 4 etapas reales de una
//               misión de 5 etapas totales)
//   enteros   → nombres de campos que deben redondearse a entero (columnas,
//               sectores, posiciones, etc.) — los que no aparecen acá se
//               dejan como número flotante (ej. `brecha`, un umbral 0..1)
//
// Los campos booleanos (ej. incluirCentro en Webb) no se pueden "interpolar"
// de verdad: cambian de valor recién pasada la mitad del camino (t >= 0.5).
export function generarEtapas(base, objetivo, cantidad, enteros = []) {
  const etapas = []
  for (let i = 0; i < cantidad; i++) {
    const t = cantidad === 1 ? 1 : i / (cantidad - 1)
    const etapa = {}
    for (const clave of Object.keys(objetivo)) {
      const desde = base[clave]
      const hasta = objetivo[clave]
      if (typeof hasta === 'boolean') {
        etapa[clave] = t < 0.5 ? desde : hasta
      } else {
        const valor = desde + (hasta - desde) * t
        etapa[clave] = enteros.includes(clave) ? Math.round(valor) : valor
      }
    }
    etapas.push(etapa)
  }
  return etapas
}
