#!/usr/bin/env node
/**
 * tests/coherence-verify.mjs — [RONDA 2, instancia E] Coherencia interna del
 * enunciado de los 23 generadores × 400 semillas.
 *
 * Para cada problema se comprueba:
 *   1. Determinismo: `generate({seed:S})` dos veces da el mismo expr, la
 *      misma respuesta y el mismo id.
 *   2. Variación: cuántas expresiones distintas salen de 400 semillas.
 *   3. Respuesta canónica: `checkAnswer(p, answerToString(p.answer))`
 *      SIEMPRE correcto. Si falla es un bug crítico de interfaz.
 *   4. `answerToString` no lanza, no devuelve undefined y es idempotente.
 *   5. Distractores: 3, distintos entre sí y distintos de la correcta, y
 *      al menos uno plausible (un ±inf cuando la respuesta es DNE, el signo
 *      contrario cuando es infinito…).
 *   6. Interrogatorio: exactamente 4 opciones, `0 ≤ correct ≤ 3`, ninguna
 *      opción repetida y `checkQuiz(p, correct) === true`.
 *   7. Solución: `steps.length ≥ 2`, pasos con título, `keyStep` en rango,
 *      `solutionHtml` no lanza y pinta exactamente los pasos del problema.
 *   8. Signos: si un límite en punto sin lado responde DNE, `bothSides`
 *      (y la comprobación numérica propia) confirman que difieren de verdad.
 *
 *   node tests/coherence-verify.mjs        (400 semillas por generador)
 * Código de salida 0 si todo cuadra; 1 si hay bugs reales.
 */
import { loadEngine, engineFingerprint } from './lib/engine.mjs';
import { sweepGenerator, pad } from './lib/verify-run.mjs';

const SEEDS = Number(process.env.SEEDS || 400);
const CHUNK = Number(process.env.CHUNK || 50);

const L = loadEngine();
const ids = L.generatorList();
const fp = engineFingerprint();

console.log('RONDA 2 · Coherencia interna del enunciado (instancia E)');
console.log('motor: src/engine.js  md5=' + fp.md5 + '  (' + fp.bytes + ' bytes)');
console.log('semillas por generador: ' + SEEDS);
console.log('');

const tabla = [];
const problemas = [];
let total = 0, colgados = 0, totFallos = 0, totAvisos = 0;

for (const gid of ids) {
  const { rows, hangs, errors } = sweepGenerator(gid, SEEDS, {
    chunk: CHUNK, mode: 'coherence'
  });

  const exprs = new Set();
  let fallos = 0, avisos = 0;
  const detalle = [];
  const vistos = new Set();
  for (const r of rows) {
    if (r.expr) exprs.add(r.expr);
    if (r.verdict === 'error') {
      fallos++; fallos++;
      detalle.push({ seed: r.seed, msg: r.detail || 'error desconocido' });
      continue;
    }
    for (const m of (r.fallos || [])) {
      fallos++;
      if (!vistos.has(m.slice(0, 70))) { vistos.add(m.slice(0, 70)); detalle.push({ seed: r.seed, msg: m }); }
    }
    for (const m of (r.avisos || [])) {
      avisos++;
      if (!vistos.has('A:' + m.slice(0, 70))) {
        vistos.add('A:' + m.slice(0, 70));
        detalle.push({ seed: r.seed, msg: '(aviso) ' + m });
      }
    }
  }
  const colga = hangs.length;
  colgados += colga;
  total += rows.length;
  totFallos += fallos;
  totAvisos += avisos;

  tabla.push({ gen: gid, n: rows.length, distintos: exprs.size, fallos, avisos, colga });
  for (const d of detalle) problemas.push({ gen: gid, ...d });
  for (const h of hangs) problemas.push({ gen: gid, seed: h.seed, msg: 'COLGADO: la generación no termina (bucle infinito)' });
  for (const e of errors) problemas.push({ gen: gid, seed: e.from, msg: 'error: ' + e.error });
}

/* ---------------- informe ---------------- */

console.log(pad('generador', 28) + pad('casos', 8) + pad('exprs distintas', 17)
  + pad('fallos', 9) + pad('avisos', 9) + pad('colgado', 9));
console.log('-'.repeat(28 + 8 + 17 + 9 + 9 + 9));
for (const t of tabla) {
  const ratio = t.n ? Math.round(100 * t.distintos / t.n) : 0;
  console.log(pad(t.gen, 28) + pad(t.n, 8) + pad(t.distintos + ' (' + ratio + '%)', 17)
    + pad(t.fallos, 9) + pad(t.avisos, 9) + pad(t.colga, 9));
}
console.log('-'.repeat(28 + 8 + 17 + 9 + 9 + 9));
console.log(pad('TOTAL', 28) + pad(total, 8) + pad('', 17) + pad(totFallos, 9) + pad(totAvisos, 9) + pad(colgados, 9));
console.log('');

/* Variación: se avisa si un generador apenas produce ejercicios distintos. */
const pobre = tabla.filter((t) => t.n > 0 && t.distintos < t.n * 0.5);
if (pobre.length) {
  console.log('VARIACIÓN BAJA (< 50% de expresiones distintas):');
  for (const t of pobre) console.log('  · ' + t.gen + ': ' + t.distintos + ' distintas de ' + t.n);
  console.log('');
}

const erroresReales = problemas.filter((p) => !p.msg.startsWith('(aviso)'));
if (erroresReales.length) {
  console.log('PROBLEMAS REALES (' + erroresReales.length + ' tipos, primera aparición de cada uno):');
  console.log('');
  const byGen = new Map();
  for (const p of erroresReales) {
    if (!byGen.has(p.gen)) byGen.set(p.gen, []);
    byGen.get(p.gen).push(p);
  }
  for (const [g, ps] of byGen) {
    console.log('### ' + g + '  (' + ps.length + ')');
    for (const p of ps.slice(0, 8)) console.log('  semilla ' + p.seed + ': ' + p.msg);
    if (ps.length > 8) console.log('  … y ' + (ps.length - 8) + ' más');
    console.log('');
  }
} else {
  console.log('Sin problemas de coherencia graves.');
}

const avisos = problemas.filter((p) => p.msg.startsWith('(aviso)'));
if (avisos.length) {
  console.log('AVISOS (' + avisos.length + ' tipos):');
  console.log('');
  const vistos = new Set();
  for (const a of avisos) {
    const k = a.gen + '|' + a.msg;
    if (vistos.has(k)) continue;
    vistos.add(k);
    console.log('  · ' + a.gen + ' (semilla ' + a.seed + '): ' + a.msg.slice(7));
  }
  console.log('');
}

const hayBug = erroresReales.length > 0 || colgados > 0;
console.log(hayBug
  ? 'RESULTADO RONDA 2: HAY PROBLEMAS DE COHERENCIA.'
  : 'RESULTADO RONDA 2: todo coherente.');
process.exitCode = hayBug ? 1 : 0;
