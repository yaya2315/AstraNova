// Corre automáticamente después de `next build` (ver "postbuild" en package.json).
//
// Next.js necesita que el CSS y el JS vivan en out/_next/static/... con nombres
// hasheados y anidados — el propio runtime de Next (carga de chunks dinámicos,
// manifest de RSC) depende de esas rutas exactas. Intentar cambiarlas rompe el
// build (ver commit anterior: "Cannot find module .../_document.js").
//
// Como alternativa segura, este script copia (no mueve) esos mismos archivos a
// out/style.css y out/js/*.js — nombres simples, en la raíz de out/, fáciles de
// encontrar y abrir — sin tocar los originales de los que depende el sitio real.
import { readdirSync, statSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, basename } from 'node:path'

const OUT = join(process.cwd(), 'out')
const NEXT_STATIC = join(OUT, '_next', 'static')

function walk(dir) {
  let files = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) files = files.concat(walk(full))
    else files.push(full)
  }
  return files
}

// ── CSS: concatenar todos los .css en un único out/style.css ────────────────
const cssDir = join(NEXT_STATIC, 'css')
let cssFiles = []
try { cssFiles = walk(cssDir).filter(f => f.endsWith('.css')) } catch { /* sin CSS */ }
if (cssFiles.length) {
  const combined = cssFiles.map(f => readFileSync(f, 'utf8')).join('\n')
  writeFileSync(join(OUT, 'style.css'), combined)
}

// ── JS: copiar cada chunk a out/js/<nombre-simple>.js (nombres ya son únicos
//    por su hash, así que aplanar sin subcarpetas no genera colisiones) ──────
const jsOutDir = join(OUT, 'js')
rmSync(jsOutDir, { recursive: true, force: true })
mkdirSync(jsOutDir, { recursive: true })

let jsFiles = []
try { jsFiles = walk(NEXT_STATIC).filter(f => f.endsWith('.js')) } catch { /* sin JS */ }
for (const f of jsFiles) {
  copyFileSync(f, join(jsOutDir, basename(f)))
}

console.log(`[flatten-out] out/style.css (${cssFiles.length} archivo${cssFiles.length === 1 ? '' : 's'}), out/js/ (${jsFiles.length} archivos)`)
