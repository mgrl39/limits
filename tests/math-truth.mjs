/**
 * math-truth.mjs — VERIFICACIÓN DE LA VERDAD MATEMÁTICA del motor.
 *
 * Usa el evaluador AST INDEPENDIENTE (tests/lib/eval-ast.mjs), que no
 * consulta el motor para nada: recorre el árbol y evalúa la expresión
 * numéricamente acercándose al objetivo. Luego compara la tendencia
 * observada con la respuesta que el motor declara.
 *
 * Además ejecuta cada tanda en un proceso hijo con timeout, porque hay
 * generadores con bucles while que pueden no terminar y un cuelgue
 * sincrónico no lo corta un try/catch.
 *
 *   node tests/math-truth.mjs [semillasPorGenerador]
 *
 * Sale con código 1 si hay discrepancias.
 */
import { createRequire } from "node:module";
import { sweepGenerator } from "./lib/verify-run.mjs";

const require = createRequire(import.meta.url);
global.window = global;
require("../src/engine.js");
const L = global.window.Lim;

const N = Number(process.argv[2] || 250);
const ids = L.generatorList();

console.log("\n  Verificación matemática independiente");
console.log("  " + "─".repeat(74));
console.log("  " + "generador".padEnd(26) + "casos".padStart(6) + "ok".padStart(6) + "malo".padStart(6) + "colgado".padStart(9));
console.log("  " + "─".repeat(74));

let tot = 0, ok = 0, mal = 0, colgados = 0;
const fallos = [];

for (const id of ids) {
  let r;
  try {
    r = sweepGenerator(id, N, { timeoutMs: 20000 });
  } catch (e) {
    console.log("  \x1b[31m✖\x1b[0m " + id.padEnd(24) + "  LANZA: " + e.message);
    continue;
  }
  const rows = (r && r.rows) || [];
  const arr = Array.isArray(rows) ? rows : [];
  const n = arr.length;
  // verdict: ok | discrepancia | exento | error
  const buenos = arr.filter(x => x && x.verdict === "ok").length;
  const malos = arr.filter(x => x && (x.verdict === "discrepancia" || x.verdict === "error")).length;
  const exentos = arr.filter(x => x && x.verdict === "exento").length;
  const hang = (r && Array.isArray(r.hangs)) ? r.hangs.length : 0;
  const errs = (r && Array.isArray(r.errors)) ? r.errors.length : 0;

  tot += n; ok += buenos; mal += malos; colgados += hang;
  const marca = (malos || hang || errs) ? "\x1b[31m✖\x1b[0m" : "\x1b[32m✔\x1b[0m";
  console.log("  " + marca + " " + id.padEnd(24) +
    String(n).padStart(6) + String(buenos).padStart(6) +
    (malos || errs ? "\x1b[31m" : "") + String(malos).padStart(6) + (malos || errs ? "\x1b[0m" : "") +
    (hang ? "\x1b[31m" : "") + String(hang).padStart(9) + (hang ? "\x1b[0m" : ""));

  for (const c of arr) {
    if (c && (c.verdict === "discrepancia" || c.verdict === "error") && fallos.length < 30) {
      fallos.push(`${id} semilla ${c.seed}: declara ${c.answer} · ${c.verdict}: ${c.detail || "?"}`);
    }
  }
  if (hang && fallos.length < 30) fallos.push(`${id}: ${hang} semilla(s) que NO TERMINAN (bucle infinito)`);
}

console.log("  " + "─".repeat(74));
console.log(`  total ${tot} · correctos ${ok} · discrepantes ${mal} · semillas colgadas ${colgados}\n`);
if (fallos.length) {
  console.log("  Discrepancias:");
  for (const f of fallos) console.log("   · " + f);
  console.log("");
}
process.exit(mal > 0 || colgados > 0 ? 1 : 0);