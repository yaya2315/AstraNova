// Corre automáticamente después de `next build` (ver "postbuild" en package.json).
// Next.js regenera out/ con nombres hasheados NUEVOS en cada build, así que este
// script tiene que renombrar y re-parchear las referencias cada vez, no es un
// paso de una sola vez.
//
// Qué SÍ se renombra (seguro, un solo archivo, referencias fáciles de parchear):
//   out/index.html                     → out/rey.html
//   out/_next/static/css/<hash>.css    → out/_next/static/css/rey.css
//
// Qué NO se renombra (y por qué): los 19 chunks de JS en out/_next/static/chunks/
// están referenciados desde DENTRO del propio runtime de webpack (un mapeo
// chunkId → nombre de archivo, embebido y minificado en webpack-*.js) además de
// desde el HTML. Ya se probó en este proyecto que tocar esos nombres rompe el
// build («Cannot find module .../_document.js»), así que quedan con sus hashes
// originales, anidados en _next/static/chunks/ como Next.js los necesita.
//
// Además, deja copias de referencia (rey.html, rey.css, y los JS reales tal cual)
// dentro de ./web/ en la raíz del proyecto (afuera de out/) — todas juntas en
// una sola carpeta en vez de sueltas al nivel principal, para que no ensucien
// la raíz junto a package.json, src/, etc.
import { readdirSync, statSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs'
import { join, basename } from 'node:path'

const ROOT = process.cwd()
const OUT = join(ROOT, 'out')
const CSS_DIR = join(OUT, '_next', 'static', 'css')
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

// ── 1. Renombrar el CSS real y parchear todas sus referencias ───────────────
const cssFiles = walk(CSS_DIR).filter(f => f.endsWith('.css'))
let cssRenamed = false
if (cssFiles.length === 1) {
  const oldName = basename(cssFiles[0])                 // ej: cc1f4c03966b144a.css
  const newPath = join(CSS_DIR, 'rey.css')
  renameSync(cssFiles[0], newPath)
  cssRenamed = true

  // Parchear la referencia en cualquier .html/.txt que la mencione
  for (const f of walk(OUT).filter(f => f.endsWith('.html') || f.endsWith('.txt'))) {
    const content = readFileSync(f, 'utf8')
    if (content.includes(oldName)) {
      writeFileSync(f, content.split(oldName).join('rey.css'))
    }
  }
}

// ── 2. Renombrar el HTML real: index.html → rey.html ─────────────────────────
const indexPath = join(OUT, 'index.html')
const reyHtmlPath = join(OUT, 'rey.html')
renameSync(indexPath, reyHtmlPath)

// ── 3. serve.json: para que `npx serve out` siga resolviendo "/" → rey.html ─
writeFileSync(join(OUT, 'serve.json'), JSON.stringify({
  rewrites: [{ source: '/', destination: '/rey.html' }],
}, null, 2))

// ── 4. Copias de referencia, todas juntas en ./web/ (afuera de out/) ─────────
const WEB_DIR = join(ROOT, 'web')
rmSync(WEB_DIR, { recursive: true, force: true })
mkdirSync(WEB_DIR, { recursive: true })

copyFileSync(reyHtmlPath, join(WEB_DIR, 'rey.html'))
if (cssRenamed) copyFileSync(join(CSS_DIR, 'rey.css'), join(WEB_DIR, 'rey.css'))

const jsOutDir = join(WEB_DIR, 'js')
mkdirSync(jsOutDir, { recursive: true })
const jsFiles = walk(NEXT_STATIC).filter(f => f.endsWith('.js'))
for (const f of jsFiles) copyFileSync(f, join(jsOutDir, basename(f)))

console.log(`[postbuild] out/rey.html, out/_next/static/css/rey.css — renombrados y parcheados`)
console.log(`[postbuild] ./web/ (raíz del proyecto): rey.html, rey.css, js/ (${jsFiles.length} archivos, siguen anidados por diseño de Next.js)`)
