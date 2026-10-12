/**
 * lib/trends.mjs — Análisis de tendencias numéricas.
 *
 * Decide si la sucesión de valores observada al acercarse al objetivo
 * concuerda con la respuesta que da el motor. No usa nada del motor:
 * solo recibe números y la respuesta (ya extraída por el llamante).
 */

const EPS_LIST = [1e-1, 1e-2, 1e-3, 1e-4, 1e-5, 1e-6, 1e-7, 1e-8, 1e-9];

/** Puntos de muestreo para un objetivo en un punto `a`. */
export function pointSamples(a, side) {
  const out = [];
  for (const e of EPS_LIST) {
    if (side === '+') out.push(a + e);
    else if (side === '-') out.push(a - e);
    else { out.push(a - e); out.push(a + e); }
  }
  return out;
}

/** Puntos de muestreo para x → ±infinito: ±10^k, k = 1..12. */
export function infinitySamples(sign) {
  const out = [];
  for (let k = 1; k <= 12; k++) {
    const m = Math.pow(10, k);
    out.push(sign === '-' ? -m : m);
  }
  return out;
}

const finite = (xs) => xs.filter((v) => Number.isFinite(v));

/** |x| estrictamente creciente en las últimas `k` muestras. */
function magnitudeIncreasesTail(vals, k) {
  if (vals.length < k) return false;
  const tail = vals.slice(-k);
  for (let i = 1; i < tail.length; i++) {
    if (!(Math.abs(tail[i]) > Math.abs(tail[i - 1]) * (1 + 1e-12))) return false;
  }
  return true;
}

/** |errores| no crecientes (convergence monótona) en las últimas `k`. */
function errorDecreasesTail(vals, target, k) {
  if (vals.length < k) return false;
  const tail = vals.slice(-k).map((v) => Math.abs(v - target));
  for (let i = 1; i < tail.length; i++) {
    if (tail[i] > tail[i - 1] * (1 + 1e-9) + 1e-15) return false;
  }
  return true;
}

/**
 * Verifica convergencia a un valor finito.
 * Criterio: al menos 3 decimales significativos; si solo llega al 2% se
 * exige además que la tendencia sea monótona en las últimas 4 muestras.
 * (Cuando ya se han alcanzado los 3 decimales, exigir monotonoía no
 * significa nada: los errores se estancan en el suelo del double.)
 */
export function checkFinite(samples, vals, target) {
  const res = { verdict: 'ok', detail: '', nFinite: 0, nSamples: vals.length };
  const v = finite(vals);
  res.nFinite = v.length;
  if (v.length < 3) {
    return { ...res, verdict: 'discrepancia', detail: 'solo ' + v.length + ' muestras finitas de ' + vals.length };
  }
  const last = v[v.length - 1];
  const tol3 = 1e-3 * Math.max(1, Math.abs(target));
  const tol2 = 2e-2 * Math.max(1, Math.abs(target));
  const d3 = Math.abs(last - target);
  if (d3 <= tol3) {
    res.detail = 'error final ' + d3.toExponential(2) + ' (≥3 decimales)';
    return res;
  }
  const mono = errorDecreasesTail(v, target, 4);
  if (d3 <= tol2 && mono) {
    res.verdict = 'dudoso';
    res.detail = 'converge dentro del 2% de forma monótona pero no a 3 decimales: ' + d3.toExponential(2);
    return res;
  }
  res.verdict = 'discrepancia';
  res.detail = 'último valor ' + last + ' vs respuesta ' + target + ' (dif ' + d3.toExponential(3) + ')';
  return res;
}

const fmtS = (v) => (Number.isFinite(v) ? v.toExponential(2) : (v > 0 ? '+inf' : '-inf'));

/** |x| no decreciente en las últimas `k` muestras (magnitud extendida). */
function monoMagnitude(vals, k) {
  if (vals.length < k) return false;
  const tail = vals.slice(-k);
  for (let i = 1; i < tail.length; i++) {
    const a = Math.abs(tail[i - 1]), b = Math.abs(tail[i]);
    if (b < a * (1 - 1e-12)) return false;
  }
  return true;
}

/**
 * Verifica divergencia a +inf/−inf con el signo correcto.
 * Se aceptan ±Infinity como evidencia de la DIRECCIÓN: una exponencial que
 * desborda a +inf diverge a +inf; no es un fallo del motor.
 */
export function checkInfinite(samples, vals, sign) {
  const dir = sign > 0 ? Infinity : -Infinity;
  const fin = vals.filter(Number.isFinite);
  const overflow = vals.filter((v) => !Number.isFinite(v));
  const out = { verdict: 'ok', detail: '', nFinite: fin.length, nSamples: vals.length };
  if (fin.length + overflow.length < 4) {
    return { ...out, verdict: 'discrepancia', detail: 'solo ' + (fin.length + overflow.length) + ' muestras utilizables' };
  }
  const badSign = fin.filter((z) => Math.sign(z) !== sign)
    .concat(overflow.filter((v) => v !== dir));
  const ext = vals.filter((v) => Number.isFinite(v) || v === dir);
  if (badSign.length > 0) {
    out.verdict = 'discrepancia';
    out.detail = 'signo incorrecto en ' + badSign.length + '/' + vals.length + ' muestras (se esperaba '
      + (sign > 0 ? '+inf' : '−inf') + '): ' + badSign.slice(0, 3).map(fmtS).join(', ');
    return out;
  }
  if (fin.length < 4) {
    if (ext.length >= 2 && monoMagnitude(ext, Math.min(4, ext.length))) {
      out.detail = 'diverge a ' + (sign > 0 ? '+inf' : '−inf') + ' (con desborde a ±Infinity)';
      return out;
    }
    out.verdict = 'discrepancia';
    out.detail = 'no se puede observar la divergencia: ' + vals.slice(0, 6).map(fmtS).join(', ');
    return out;
  }
  if (!monoMagnitude(fin, 4)) {
    out.verdict = 'discrepancia';
    out.detail = 'no diverge monótonamente: ' + fin.slice(-5).map((z) => z.toExponential(2)).join(', ');
    return out;
  }
  const grew = Math.abs(fin[fin.length - 1]) > 10 * Math.abs(fin[0]);
  if (!grew) {
    out.verdict = 'dudoso';
    out.detail = 'diverge pero muy poco (factor ' + (Math.abs(fin[fin.length - 1]) / Math.abs(fin[0])).toFixed(2) + ')';
    return out;
  }
  out.detail = 'diverge a ' + (sign > 0 ? '+inf' : '−inf') + ' monótonamente';
  return out;
}

/** Clasifica la tendencia de una serie (para comparar laterales). */
export function classify(samples, vals) {
  const v = finite(vals);
  if (v.length < 3) return 'indeterminado';
  const last = v.slice(-4);
  const allPos = last.every((z) => z > 0);
  const allNeg = last.every((z) => z < 0);
  if ((allPos && magnitudeIncreasesTail(v, 4)) || (allNeg && magnitudeIncreasesTail(v, 4))) {
    return allPos ? '+inf' : '-inf';
  }
  const first = v[0], lastv = v[v.length - 1];
  if (Number.isFinite(first) && Number.isFinite(lastv) && Math.abs(lastv - first) <= 1e-6 * Math.max(1, Math.abs(first))) {
    return 'fin:' + first;
  }
  return 'indeterminado';
}

/** Verifica que el límite no existe: los dos laterales deben diferir. */
export function checkDne(leftVals, rightVals) {
  const li = classify('L', leftVals);
  const ri = classify('R', rightVals);
  const a = li.startsWith('fin:') ? Number(li.slice(4)) : null;
  const b = ri.startsWith('fin:') ? Number(ri.slice(4)) : null;
  if (a !== null && b !== null) {
    if (Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))) {
      return { verdict: 'ok', detail: 'laterales distintos: ' + a + ' ≠ ' + b };
    }
    return { verdict: 'discrepancia', detail: 'los laterales SÍ coinciden (' + a + '): el límite existe' };
  }
  if ((li === '+inf' && ri === '-inf') || (li === '-inf' && ri === '+inf')) {
    return { verdict: 'ok', detail: 'laterales ' + li + ' y ' + ri };
  }
  if (li !== 'indeterminado' && ri !== 'indeterminado' && li !== ri) {
    return { verdict: 'ok', detail: 'laterales distintos: ' + li + ' / ' + ri };
  }
  return {
    verdict: 'discrepancia',
    detail: 'no se observa divergencia distinta por los dos lados (' + li + ' / ' + ri + ')'
  };
}

/** Comprueba que el texto "x = r" es una asíntota vertical real. */
export function checkVerticalAsymptote(evalAt, r) {
  const out = [];
  for (const e of [1e-3, 1e-6, 1e-9]) {
    out.push(evalAt(r + e), evalAt(r - e));
  }
  const fin = out.filter((v) => Number.isFinite(v));
  const big = fin.filter((v) => Math.abs(v) > 1e6);
  const at = evalAt(r);
  if (big.length >= 2) {
    return { verdict: 'ok', detail: 'se dispara en ambos lados: ' + fin.map((v) => v.toExponential(1)).join(', ') };
  }
  if (at === 0) {
    return { verdict: 'discrepancia', detail: 'la función vale 0 en x = ' + r + ': ahí NO hay asíntota vertical' };
  }
  return { verdict: 'discrepancia', detail: 'la función no se dispara cerca de x = ' + r + ' (f = ' + at + ')' };
}

/** Comprueba que el texto "y = v" es la asíntota horizontal real. */
export function checkHorizontalAsymptote(vals, v) {
  const f = finite(vals);
  const res = checkFinite([], f, v);
  if (res.verdict === 'ok') res.detail = 'límite en el infinito = ' + v + ' — ' + res.detail;
  return res;
}
