/**
 * lib/engine.mjs — Carga del motor de límites en Node (ESM).
 *
 * El motor (`src/engine.js`) es un script clásico sin `module.exports`,
 * así que se carga con `require` tras crear un `global.window` falso.
 *
 * CERO DEPENDENCIAS. Solo módulos nativos de Node.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);

export const TESTS_DIR = path.dirname(fileURLToPath(new URL('.', import.meta.url)));
export const PROJECT_DIR = path.resolve(TESTS_DIR, '..');
export const ENGINE_PATH = path.join(PROJECT_DIR, 'src', 'engine.js');

/** Carga `src/engine.js` y devuelve `window.Lim`. */
export function loadEngine(enginePath = ENGINE_PATH) {
  global.window = {};
  delete require.cache[require.resolve(enginePath)];
  require(enginePath);
  return global.window.Lim;
}

/** Huella del motor auditado (para que los hallazgos sean reproducibles). */
export function engineFingerprint(enginePath = ENGINE_PATH) {
  const buf = readFileSync(enginePath);
  return {
    md5: crypto.createHash('md5').update(buf).digest('hex'),
    bytes: buf.length
  };
}

/** Lista de ids de generador, en el orden del motor. */
export function generatorIds(L) {
  return L.generatorList();
}
