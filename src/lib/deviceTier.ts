// ─────────────────────────────────────────────────────────────────────────────
// Detección de "gama" del dispositivo — no todos los celulares son iguales:
// un gama baja de 2-3GB de RAM se traba con la misma configuración que un
// gama media/alta corre bien. En vez de un único ajuste "celular sí/no"
// (IS_MOBILE), esto suma señales reales del navegador para clasificar el
// dispositivo en low/mid/high, y solo en `low` se prioriza rendimiento por
// sobre verse bien: menos segmentos, menos partículas y texturas más
// livianas (ver LOW_RES_TEXTURES más abajo).
//
// Señales usadas (todas opcionales — si el navegador no las expone, no
// suman ni restan, y el resultado por defecto es 'mid'):
//   navigator.deviceMemory      RAM aproximada en GB (Chrome/Edge/Opera)
//   navigator.hardwareConcurrency  núcleos de CPU (amplio soporte)
//   navigator.connection.effectiveType  velocidad de red estimada
// ─────────────────────────────────────────────────────────────────────────────

export type DeviceTier = 'low' | 'mid' | 'high'

function computeTier(): DeviceTier {
  if (typeof navigator === 'undefined') return 'mid'

  // Estas dos APIs no están en el tipado estándar de TS — de ahí el `any`.
  const nav = navigator as Navigator & {
    deviceMemory?: number
    connection?: { effectiveType?: string }
  }

  const mem   = nav.deviceMemory
  const cores = nav.hardwareConcurrency ?? 4
  const net   = nav.connection?.effectiveType

  let score = 0
  if (mem !== undefined) {
    if (mem <= 2) score -= 2
    else if (mem <= 4) score -= 1
    else score += 1
  }
  if (cores <= 4) score -= 1
  else if (cores >= 8) score += 1
  if (net === 'slow-2g' || net === '2g') score -= 2
  else if (net === '3g') score -= 1

  if (score <= -2) return 'low'
  if (score >= 1) return 'high'
  return 'mid'
}

// Se calcula una sola vez al cargar el módulo — mismo patrón que IS_MOBILE
// en SolarSystem.tsx, y por la misma razón: estos componentes solo se
// montan en cliente (dynamic import con ssr:false), así que no hay riesgo
// de desalinearse con una versión de servidor.
export const DEVICE_TIER: DeviceTier = computeTier()
export const IS_LOW_END = DEVICE_TIER === 'low'

// Texturas de menor peso para el nivel más bajo — solo se usan en celular
// Y cuando además el dispositivo mide "low". Si el usuario nota que el
// color de Urano/Saturno se ve raro acá, es porque estas texturas de
// respaldo son más simples que las 2k reales; para ese nivel se prioriza
// que cargue rápido y no se trabe por sobre la fidelidad del color.
import { withBasePath } from './basePath'
export const LOW_RES_TEXTURES: Record<string, string> = {
  Marte:    withBasePath('/textures/MARTE_bajaresol.png'),
  Júpiter:  withBasePath('/textures/JUPITER_bajaresol.png'),
  Saturno:  withBasePath('/textures/SATURNO_bajaresol.png'),
  Urano:    withBasePath('/textures/Urano_bajaresol.png'),
}
