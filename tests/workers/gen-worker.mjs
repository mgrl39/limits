/**
 * workers/gen-worker.mjs — Proceso hijo: genera problemas y los verifica.
 *
 * Uso:  node tests/workers/gen-worker.mjs <generatorId> <seedFrom> <seedTo> [modo]
 *
 * Imprime una línea JSON por cada semilla a stdout (nada más).
 * El padre (tests/numeric-verify.mjs o tests/coherence-verify.mjs) la
 * recoge. Al vivir en un proceso aparte, un `while` infinito del motor
 * no bloquea la auditoría: el padre lo mata con el timeout.
 */
import { loadEngine } from '../lib/engine.mjs';
import { verifyOne } from '../lib/verify-one.mjs';
import { coherenceOne } from '../lib/coherence-one.mjs';

const gid = process.argv[2];
const from = Number(process.argv[3]);
const to = Number(process.argv[4]);
const mode = process.argv[5] || 'numeric';

const L = loadEngine();
if (!L.GENERATORS[gid]) {
  process.stdout.write(JSON.stringify({ seed: from, error: 'generador inexistente: ' + gid }) + '\n');
  process.exit(0);
}

for (let seed = from; seed <= to; seed++) {
  let row;
  try {
    if (mode === 'coherence') {
      row = coherenceOne(L, gid, seed);
      row.gen = gid;
      row.verdict = (row.fallos && row.fallos.length) ? 'fallo' : 'ok';
    } else {
      row = verifyOne(L, gid, seed, mode);
      row.gen = gid;
    }
  } catch (e) {
    row = { seed, gen: gid, verdict: 'error', detail: (e && e.message) || String(e) };
  }
  process.stdout.write(JSON.stringify(row) + '\n');
}
