/* Smoke test rápido: monta la hoja de teoría con un DOM mínimo y
 * comprueba que todas las secciones se construyen sin ReferenceError.
 *   node tests/theoria-smoke.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* --- DOM mínimo ------------------------------------------------------- */
let presupuesto = 0;
function nodo(tag) {
  return {
    tagName: String(tag).toLowerCase(),
    nodeName: String(tag).toUpperCase(),
    children: [],
    attrs: {},
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    set textContent(v) { this._t = v; },
    get textContent() { return this._t != null ? this._t : ""; },
    set innerHTML(v) { this._h = v; },
    set className(v) { this._c = v; },
    get className() { return this._c || ""; },
    appendChild(c) { this.children.push(c); presupuesto++; return c; },
    removeChild(c) { return c; },
    cloneNode() { return nodo(tag); },
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k]; },
    addEventListener() {},
    querySelector() { return null; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 20 }; },
    scrollIntoView() {},
    parentNode: null
  };
}

const document = {
  createElement: nodo,
  createElementNS: (ns, tag) => nodo(tag),
  createTextNode: (t) => ({ nodeName: "#text", text: t }),
  getElementById: () => nodo("div"),
  body: nodo("body")
};
const g = {
  document,
  matchMedia: () => ({ matches: false }),
  addEventListener() {},
  requestAnimationFrame: (f) => f(),
  scrollY: 0, innerHeight: 800
};
g.window = g;

/* --- Carga los ficheros igual que hace teoria.html -------------------- */
const win = new Proxy(g, {
  get(t, k) { return k in t ? t[k] : undefined; },
  set(t, k, v) { t[k] = v; return true; }
});
global.window = win;

for (const f of ["src/engine.js", "src/ui-core.js", "src/pagina-teoria.js"]) {
  const src = readFileSync(join(ROOT, f), "utf8");
  new Function("window", "document", src)(win, document);
}

if (typeof win.construirTeoria !== "function") {
  console.error("✖ pagina-teoria.js no ha publicado construirTeoria");
  process.exit(1);
}

const main = nodo("main");
try {
  win.construirTeoria(main);
} catch (e) {
  console.error("✖ construirTeoria ha fallado:\n", e && e.stack);
  process.exit(1);
}

function recorrer(n, out = []) {
  if (!n || !n.children) return out;
  for (const c of n.children) {
    if (c.tagName === "section") out.push(c);
    recorrer(c, out);
  }
  return out;
}

const secciones = recorrer(main);
console.log(`✔ la hoja se monta: ${secciones.length} secciones, ${presupuesto} nodos`);
if (secciones.length < 15) {
  console.error("✖ faltan secciones");
  process.exit(1);
}
const h2 = secciones.map((s) => (s.children[0].children || []).map((c) => c.text).join(" "));
console.log("  " + h2.join("\n  "));