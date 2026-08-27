// postbuild.mjs — DEPRECADO, ya no se ejecuta automáticamente.
//
// Antes este script renombraba out/index.html → out/rey.html y el CSS real
// a rey.css "para identificarlos fácil". El problema: todo host estático
// real (GitHub Pages, Netlify, Vercel, un dominio propio, etc.) espera
// encontrar exactamente `index.html` en la raíz del sitio para servir "/".
// Al no existir ese archivo, el sitio no cargaba en ningún lado que no
// fuera el servidor local a medida (scripts/start-static.mjs), que era el
// único que sabía redirigir a rey.html.
//
// `npm run build` ahora deja `out/index.html` tal cual lo genera Next.js,
// así el sitio funciona igual en local, en GitHub Pages, o en cualquier
// otro hosting estático. Este archivo se deja solo como referencia
// histórica; no está enganchado a ningún script de package.json.
console.log('[postbuild] deprecado — no hace falta ejecutar esto, out/index.html ya es el HTML real.')
