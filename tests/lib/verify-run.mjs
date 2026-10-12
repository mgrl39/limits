/**
 * lib/verify-run.mjs — Ejecución protegida de la generación de problemas.
 *
 * PROBLEMA REAL QUE ESTE MÓDULO RESUELVE: algunos generadores del motor
 * tienen bucles `while` que no terminan (p. ej. `while (a + b === 0) cc = cc + 1;`,
 * donde la condición no depende de `cc`). Como son bucles SÍNCRONOS de
 * JavaScript, un `try/catch` o un timeout dentro del propio proceso no
 * sirven: hay que lanzar cada tanda en un proceso hijo y matarlo.
 *
 * Estrategia:
 *   · cada tanda de semillas corre en un proceso hijo con `timeout`;
 *   · si la tanda expira, se biseca hasta identificar la semilla exacta
 *     que cuelga, y esa semilla se registra como HALLAZGO (no se cuelga
 *     la auditoría completa).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const WORKER = path.join(HERE, '..', 'workers', 'gen-worker.mjs');

/**
 * Ejecuta `workerScript` para un rango [from..to] de semillas del generador `gid`.
 * @returns {{ok:boolean, rows:Array, timedOut:boolean, killed:boolean}}
 */
export function runRange(workerScript, gid, from, to, timeoutMs, mode) {
  const args = [workerScript, gid, String(from), String(to)];
  if (mode) args.push(mode);
  const res = spawnSync(
    process.execPath,
    args,
    { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 256 * 1024 * 1024 }
  );
  if (res.error && res.error.code === 'ETIMEDOUT') {
    return { ok: false, rows: [], timedOut: true, killed: true };
  }
  if (res.status !== 0 && !res.stdout) {
    return {
      ok: false, timedOut: false, killed: false,
      error: (res.stderr || '').trim().split('\n').slice(-3).join(' | ')
    };
  }
  const rows = [];
  for (const line of String(res.stdout || '').split('\n')) {
    const s = line.trim();
    if (!s.startsWith('{')) continue;
    try { rows.push(JSON.parse(s)); } catch { /* línea corrupta: se ignora */ }
  }
  return { ok: true, rows, timedOut: false, killed: false };
}

/**
 * Recorre todas las semillas [1..count] del generador `gid` en tandas,
 * aislando (y registrando) las semillas que cuelgan el motor.
 * @returns {{rows:Array, hangs:Array, errors:Array}}
 */
export function sweepGenerator(gid, count, opts = {}) {
  const workerScript = opts.worker || WORKER;
  const chunk = opts.chunk || 50;
  const timeoutMs = opts.timeoutMs || 12000;
  const shortTimeoutMs = opts.shortTimeoutMs || 2500;
  const rows = [];
  const hangs = [];
  const errors = [];

  const rango = (a, b, ms) => {
    const r = runRange(workerScript, gid, a, b, ms, opts.mode);
    if (r.ok) { rows.push(...r.rows); return 'ok'; }
    if (r.timedOut) return 'cuelga';
    errors.push({ gid, from: a, to: b, error: r.error || 'proceso terminado con error' });
    return 'ok';
  };

  for (let from = 1; from <= count; from += chunk) {
    const to = Math.min(count, from + chunk - 1);
    if (rango(from, to, timeoutMs) === 'ok') continue;
    // La tanda expiró: bisecciono hasta aislar las semillas que cuelgan.
    const pila = [[from, to]];
    while (pila.length) {
      const seg = pila.pop();
      const a = seg[0], b = seg[1];
      const st = rango(a, b, shortTimeoutMs);
      if (st !== 'cuelga') continue;
      if (a === b) hangs.push({ gid, seed: a });
      else {
        const mid = (a + b) >> 1;
        pila.push([a, mid]);
        pila.push([mid + 1, b]);
      }
    }
  }
  rows.sort((a, b) => a.seed - b.seed);
  return { rows, hangs, errors };
}

/** Genera la tabla de texto al estilo informe. */
export function pad(s, n) {
  s = String(s);
  return s + ' '.repeat(Math.max(0, n - s.length));
}
