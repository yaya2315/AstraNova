// resize-textures.mjs
// Achica las texturas de public/textures/ que hoy son 8K/4K (varios MB cada
// una) a un tamaño real para cómo se ven en pantalla — son esferas que como
// mucho ocupan una fracción de la pantalla, 8K es desperdicio puro de ancho
// de banda y memoria de GPU (justo lo que hace lento el sitio en celular).
//
// Uso: npm run optimize:textures
//
// Antes de tocar nada, hace un backup de los originales en
// assets-originales/textures-original/ (fuera de public/, así no se suben
// al sitio) — por si el resultado no convence y hay que volver atrás.
//
// No pisa nada si ya corriste esto antes: si un archivo ya es más chico que
// su objetivo, lo deja como está.
import { readdirSync, mkdirSync, copyFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TEXTURES_DIR = join(ROOT, 'public', 'textures')
const BACKUP_DIR = join(ROOT, 'assets-originales', 'textures-original')

// Ancho máximo destino por archivo. 2048px alcanza de sobra para planetas
// que en pantalla miden como mucho unos cientos de px — no se nota la
// diferencia visual, sí se nota (mucho) en tiempo de carga.
const TARGETS = {
  '8k_sun.jpg': 2048,
  '8k_earth_daymap.jpg': 2048,
  '8k_mars.jpg': 2048,
  '8k_jupiter.jpg': 2048,
  '8k_saturn.jpg': 2048,
  '8k_saturn_ring_alpha.jpg': 1024, // el anillo es angosto, no necesita tanto
  '4k_venus_atmosphere.jpg': 2048,
  // Los 2k_* ya están en un tamaño razonable, no se tocan.
}
const JPEG_QUALITY = 82

async function main() {
  if (!existsSync(TEXTURES_DIR)) {
    console.error(`[optimize:textures] No se encontró ${TEXTURES_DIR}`)
    process.exit(1)
  }
  mkdirSync(BACKUP_DIR, { recursive: true })

  let totalBefore = 0
  let totalAfter = 0
  let skipped = 0

  for (const [filename, maxWidth] of Object.entries(TARGETS)) {
    const filePath = join(TEXTURES_DIR, filename)
    if (!existsSync(filePath)) {
      console.warn(`[optimize:textures] Salteado (no existe): ${filename}`)
      continue
    }

    const before = statSync(filePath).size
    const meta = await sharp(filePath).metadata()

    if (meta.width && meta.width <= maxWidth) {
      console.log(`[optimize:textures] ${filename} ya es de ${meta.width}px — sin cambios`)
      totalBefore += before
      totalAfter += before
      skipped++
      continue
    }

    // Backup del original tal cual, una sola vez (no lo pisa en corridas futuras).
    const backupPath = join(BACKUP_DIR, filename)
    if (!existsSync(backupPath)) copyFileSync(filePath, backupPath)

    const buffer = await sharp(backupPath)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer()

    // sharp no puede escribir sobre el mismo archivo que está leyendo si
    // input y output apuntan al mismo path en algunas plataformas — como ya
    // leímos desde backupPath, esto es seguro.
    await sharp(buffer).toFile(filePath)

    const after = statSync(filePath).size
    totalBefore += before
    totalAfter += after
    console.log(
      `[optimize:textures] ${filename}: ${(before / 1024 / 1024).toFixed(1)}MB → ${(after / 1024 / 1024).toFixed(1)}MB ` +
      `(${meta.width}px → ${maxWidth}px)`
    )
  }

  console.log('')
  console.log(`[optimize:textures] Total: ${(totalBefore / 1024 / 1024).toFixed(1)}MB → ${(totalAfter / 1024 / 1024).toFixed(1)}MB`)
  if (skipped < Object.keys(TARGETS).length) {
    console.log(`[optimize:textures] Originales de respaldo en: assets-originales/textures-original/`)
  }
  console.log('[optimize:textures] Listo. Corré "npm run build" y probá el sitio.')
}

main().catch(err => {
  console.error('[optimize:textures] Error:', err)
  process.exit(1)
})
