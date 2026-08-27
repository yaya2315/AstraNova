// start-static.mjs
// Servidor estático mínimo para previsualizar out/ en local, sin depender
// de ningún paquete externo. Sirve exactamente lo que va a servir GitHub
// Pages / Netlify / Vercel / cualquier hosting estático: out/index.html en
// "/", y el resto de los archivos tal cual están en out/.
import { createReadStream, promises as fs } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, normalize, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'out')
const port = Number(process.env.PORT ?? 3000)
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

const server = createServer(async (request, response) => {
  const requestPath = decodeURIComponent((request.url ?? '/').split('?')[0])
  const requestedFile = requestPath === '/' ? 'index.html' : requestPath.slice(1)
  const filePath = resolve(root, normalize(requestedFile))

  if (relative(root, filePath).startsWith('..')) {
    response.writeHead(403)
    response.end('Forbidden')
    return
  }

  try {
    const stats = await fs.stat(filePath)
    if (!stats.isFile()) throw new Error('Not a file')
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    })
    createReadStream(filePath).pipe(response)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Astra Nova disponible en http://127.0.0.1:${port}`)
})
