#!/usr/bin/env node
/**
 * make-check.mjs — genera tests/_check-inline.html: el arnés de comprobación
 * con los tres módulos INLINEados.
 *
 * Motivo: el servidor de desarrollo es de un solo hilo y Firefox carga los
 * scripts en paralelo, así que con <script src> la captura sale antes de que
 * terminen de cargar. Inlinando no hay peticiones y además se prueba
 * exactamente lo que se entrega.
 *
 *   node tests/make-check.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const r = (p) => readFileSync(join(ROOT, p), "utf8");
const guard = (s) => s.replace(/<\/script/gi, "<\\/script");

const plantilla = r("tests/browser-check.html");

// Sustituye los <script src> por su contenido y el <link> por un <style>.
// OJO: el reemplazo usa una FUNCIÓN a propósito. Si se pasara una cadena, las
// secuencias "$&", "$'" y "$`" que aparecen dentro del JS inlinado se
// interpretarían como referencias especiales y corromperían el HTML entero.
let html = plantilla.replace(
  /<script src="\.\.\/src\/theory-data\.js"><\/script>[\s\S]*?<script src="\.\.\/src\/app\.js"><\/script>/,
  () => `<script>${guard(r("src/theory-data.js"))}</script>\n` +
        `<script>${guard(r("src/engine.js"))}</script>\n` +
        `<script>${guard(r("src/app.js"))}</script>`
);
html = html.replace(/<link rel="stylesheet"[^>]*>/, () => `<style>${r("src/styles.css")}</style>`);

if (/script src=/.test(html)) {
  console.error("✖ quedan <script src> sin inlinear");
  process.exit(1);
}

const out = join(ROOT, "tests/_check-inline.html");
writeFileSync(out, html, "utf8");
console.log("✔ tests/_check-inline.html generado (" + (html.length / 1024).toFixed(1) + " KB)");