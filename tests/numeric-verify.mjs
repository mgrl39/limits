#!/usr/bin/env node
/**
 * tests/numeric-verify.mjs — [RONDA 1, instancia E] Verificación por fuerza
 * numérica bruta de la corrección matemática del motor.
 *
 * NO me fío del motor: reconstruyo la función desde `statement.expr` con un
 * intérprete propio del AST (tests/lib/eval-ast.mjs, aritmética exacta en
 * BigInt + estabilizaciones numéricas) y comparo la TENDENCIA observada con
 * la respuesta que el motor declara.
 *
 *   · target infinito  → x = ±10^k, k = 1..12
 *   · target punto     → x = a ± 10^-j, j = 1..9, por el lado pedido
 *                        (si no hay lado, se evalúan los dos costados por
 *                        separado y se exige que los dos converjan)
 *   · racional/numeric → convergen al valor, ≥3 decimales significativos y
 *                        tendencia monótona en las últimas 4 muestras
 *   · infinite         → divergencia con el signo correcto y monótona
 *   · dne              → los dos laterales difieren de verdad
 *   · text             → asíntota vertical (x = r) u horizontal (y = v),
 *                        comprobadas por separado
 *
 * Los generadores de `topic === 'continuidad'` quedan exentos aquí (no piden
 * el valor de un límite sino una decisión o un parámetro): se revisan a mano
 * en la ronda 3 (tests/manual-review.md).
 *
 * Cada tanda de semillas corre en un proceso hijo con timeout, porque hay
 * generadores con bucles infinitos que colgarían el proceso entero.
 *
 * Salida: tabla `generador | casos | concuerda | discrepancias` + el detalle
 * de cada fallo con su semilla reproducible. Código 1 si hay bugs reales.
 *
 *   node tests/numeric-verify.mjs        (400 semillas por generador)
 */
import { loadEngine, engineFingerprint } from './lib/engine.mjs';
import { sweepGenerator, pad } from './lib/verify-run.mjs';

const SEEDS = Number(process.env.SEEDS || 400);
const CHUNK = Number(process.env.CHUNK || 50);

const L = loadEngine();
const ids = L.generatorList();
const fp = engineFingerprint();

console.log('RONDA 1 · Verificación numérica bruta (instancia E)');
console.log('motor: src/engine.js  md5=' + fp.md5 + '  (' + fp.bytes + ' bytes)');
console.log('semillas por generador: ' + SEEDS + '  ·  18-24 puntos de muestreo por problema');
console.log('');

const table = [];
const findings = [];
let totalCases = 0, totalOk = 0, totalBad = 0, totalDub = 0, exempt = 0;

for (const gid of ids) {
  const { rows, hangs, errors } = sweepGenerator(gid, SEEDS, { chunk: CHUNK });
  const counts = { ok: 0, dudoso: 0, discrepancia: 0, error: 0, exento: 0 };
  for (const r of rows) {
    counts[r.verdict] = (counts[r.verdict] || 0) + 1;
    if (r.verdict === 'discrepancia' || r.verdict === 'error') findings.push({ gid, ...r });
  }
  exempt += counts.exento || 0;
  totalCases += rows.length;
  totalOk += counts.ok;
  totalDub += counts.dudoso;
  totalBad += counts.discrepancia + counts.error;

  const bad = counts.discrepancia + counts.error + hangs.length;
  table.push({
    gen: gid,
    casos: rows.length,
    ok: counts.ok,
    dud: counts.dudoso,
    mal: bad,
    colgado: hangs.length,
    topic: L.GENERATORS[gid].topic
  });

  for (const h of hangs) {
    findings.push({
      gid, seed: h.seed, verdict: 'COLGADO',
      detail: 'la generación NO TERMINA (bucle infinito dentro del generador)',
      expr: '(no se pudo generar)', target: '', answer: '', kind: ''
    });
  }
  for (const e of errors) {
    findings.push({
      gid, seed: e.from, verdict: 'error',
      detail: 'error al generar el rango ' + e.from + '..' + e.to + ': ' + e.error,
      expr: '', target: '', answer: '', kind: ''
    });
  }
}

/* ---------------- informe ---------------- */

console.log(pad('generador', 28) + pad('casos', 8) + pad('concorda', 10)
  + pad('dudoso', 9) + pad('MAL', 7) + pad('colgado', 9) + 'tópico');
console.log('-'.repeat(28 + 8 + 10 + 9 + 7 + 9 + 16));
for (const t of table) {
  console.log(pad(t.gen, 28) + pad(t.casos, 8) + pad(t.ok, 10) + pad(t.dud, 9)
    + pad(t.mal, 7) + pad(t.colgado, 9) + t.topic);
}
console.log('-'.repeat(28 + 8 + 10 + 9 + 7 + 9 + 16));
console.log(pad('TOTAL', 28) + pad(totalCases, 8) + pad(totalOk, 10) + pad(totalDub, 9)
  + pad(totalBad, 7) + pad('', 9) + exempt + ' exentos (continuidad)');
console.log('');

if (findings.length) {
  console.log('FALLOS (' + findings.length + ') — cada uno con su semilla reproducible:');
  console.log('');
  const byGen = new Map();
  for (const f of findings) {
    if (!byGen.has(f.gen)) byGen.set(f.gen, []);
    byGen.get(f.gen).push(f);
  }
  for (const [g, fs] of byGen) {
    console.log('### ' + g + '  (' + fs.length + ')');
    const shown = fs.slice(0, 5);
    for (const f of shown) {
      console.log('  semilla ' + f.seed + '  [' + f.kind + ' → "' + f.answer + '"]');
      console.log('    enunciado : ' + f.expr + '   ' + f.target);
      console.log('    veredicto : ' + f.verdict + ' — ' + f.detail);
      if (f.samples && f.samples.length) console.log('    observado : ' + f.samples.join(' , '));
    }
    if (fs.length > shown.length) console.log('  … y ' + (fs.length - shown.length) + ' más con el mismo patrón');
    console.log('');
  }
} else {
  console.log('Sin discrepancias numéricas.');
}

const hayBug = findings.length > 0;
console.log(hayBug
  ? 'RESULTADO RONDA 1: HAY FALLOS MATEMÁTICOS (' + findings.length + ').'
  : 'RESULTADO RONDA 1: todos los casos cuadran.');
// process.exitCode y NO process.exit: al escribir en una tubería,
// process.exit puede perder el búfer pendiente de salida.
process.exitCode = hayBug ? 1 : 0;
