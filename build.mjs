#!/usr/bin/env node
/**
 * build.mjs — ensambla la web en un ÚNICO fichero `index.html` autocontenido.
 *
 *   node build.mjs
 *
 * Fuentes (el orden importa: datos -> motor -> interfaz):
 *   src/styles.css
 *   src/theory-data.js -> window.THEORY   (hoja de referencia)
 *   src/engine.js      -> window.Lim      (motor matemático)
 *   src/app.js         -> window.App      (interfaz)
 *
 * Salida:
 *   index.html         -> un solo fichero, cero peticiones de red, cero CDN
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, "src");

const files = {
  css: join(SRC, "styles.css"),
  engine: join(SRC, "engine.js"),
  app: join(SRC, "app.js"),
};

/* src/theory-data.js NO se ensambla, a propósito.
 *
 * Contiene una versión de la hoja de referencia más completa (12 secciones,
 * 21 tablas y 23 chuletas) y merece la pena conservarla en el repositorio,
 * pero sus datos usan LaTeX en texto mientras que la interfaz construye
 * MathML a mano. Cablearla exige un conversor LaTeX->MathML que aún no
 * existe; incluirla ahora añadiría 70 KB que nadie lee.
 * La teoría que se muestra es la que lleva src/app.js en línea. */

for (const [name, path] of Object.entries(files)) {
  if (!existsSync(path)) {
    console.error(`\x1b[31m✖ Falta ${path}\x1b[0m`);
    process.exit(1);
  }
}

const read = (p) => readFileSync(p, "utf8");
const css = read(files.css).trim();
const engine = read(files.engine).trim();
const app = read(files.app).trim();

// Un `</script>` dentro de un string JS cerraría la etiqueta antes de tiempo.
const guard = (s) => s.replace(/<\/script/gi, "<\\/script");

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<meta name="description" content="Juego interactivo para practicar y dominar el cálculo de límites y continuidad de 2º de Bachillerato.">
<title>Límites — Juego de cálculo</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#8734;</text></svg>">
<style>
${css}
</style>
</head>
<body>
<noscript>
  <p style="padding:2rem;font-family:system-ui">
    Este juego necesita JavaScript activado para funcionar.
  </p>
</noscript>
<div id="app"></div>

<script>
${guard(engine)}
</script>
<script>
${guard(app)}
</script>
<script>
  window.App.start(document.getElementById("app"));
</script>
</body>
</html>
`;

const out = join(ROOT, "index.html");
writeFileSync(out, html, "utf8");

const kb = (n) => (n / 1024).toFixed(1) + " KB";
console.log("\x1b[32m✔\x1b[0m index.html generado");
console.log(`  styles.css      ${kb(css.length)}`);
console.log(`  engine.js       ${kb(engine.length)}`);
console.log(`  app.js          ${kb(app.length)}`);
console.log(`  ──────────────────────`);
console.log(`  total           ${kb(html.length)}`);