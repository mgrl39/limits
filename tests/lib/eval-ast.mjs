/**
 * lib/eval-ast.mjs — Evaluador numérico INDEPENDIENTE del AST del motor.
 *
 * Este fichero NO usa nada de `src/engine.js`: recorre por su cuenta los
 * nodos `num/var/pi/pow/neg/add/sub/mul/div/sqrt/ln/exp/cos/sin/tan/abs`.
 * Es la herramienta central de la ronda 1: permite comprobar la respuesta
 * del motor "desde fuera", evaluando la función con números.
 *
 * Lenguaje de valores (unión discriminada):
 *   { q:[BigInt,BigInt] }  racional EXACTO normalizado
 *   { sq:[BigInt,BigInt] }  raíz cuadrada de un racional exacto positivo
 *   { f:number }           flotante (todo lo que no sea racional)
 *
 * Se lleva aritmética exacta en BigInt siempre que se puede, para evitar
 * las cancelaciones catastróficas que arruinarían la verificación
 * (p. ej. sqrt(x^2+2x+2) − x con x = 10^12 daría 0 en vez de 1).
 */

function gcdB(a, b) {
  if (a < 0n) a = -a;
  if (b < 0n) b = -b;
  while (b !== 0n) { const t = a % b; a = b; b = t; }
  return a;
}

/** Racional exacto normalizado (d > 0, gcd = 1). Devuelve null si d = 0. */
export function rat(n, d = 1n) {
  if (d === 0n) return null;
  if (d < 0n) { n = -n; d = -d; }
  const g = gcdB(n, d);
  if (g > 1n) { n /= g; d /= g; }
  return { q: [n, d] };
}

export const ZERO = { q: [0n, 1n] };
export const ONE = { q: [1n, 1n] };

/** Raíz entera por Newton (BigInt). */
function isqrt(n) {
  if (n < 0n) return null;
  if (n < 2n) return n;
  let x = n, y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (x + n / x) / 2n; }
  return x;
}

export const isExact = (v) => !!v && v.q !== undefined;
export const isSqrt = (v) => !!v && v.sq !== undefined;

/** Convierte cualquier valor a double. */
export function toNum(v) {
  if (!v) return NaN;
  if (v.q !== undefined) return v.q[1] === 0n ? NaN : Number(v.q[0]) / Number(v.q[1]);
  if (v.sq !== undefined) return Math.sqrt(Number(v.sq[0]) / Number(v.sq[1]));
  return v.f;
}

/* ---------- operaciones ---------- */

function normRaw(n, d) {
  if (d === 0n) return { f: NaN };
  if (d < 0n) { n = -n; d = -d; }
  const g = gcdB(n, d);
  if (g > 1n) { n /= g; d /= g; }
  return { q: [n, d] };
}

function vAdd(a, b) {
  if (isExact(a) && isExact(b)) return normRaw(a.q[0] * b.q[1] + b.q[0] * a.q[1], a.q[1] * b.q[1]);
  return { f: toNum(a) + toNum(b) };
}
function vNeg(a) {
  if (isExact(a)) return { q: [-a.q[0], a.q[1]] };
  return { f: -toNum(a) };
}
function vMul(a, b) {
  if (isExact(a) && isExact(b)) return normRaw(a.q[0] * b.q[0], a.q[1] * b.q[1]);
  return { f: toNum(a) * toNum(b) };
}
function vDiv(a, b) {
  if (isExact(a) && isExact(b)) return normRaw(a.q[0] * b.q[1], a.q[1] * b.q[0]);
  return { f: toNum(a) / toNum(b) };
}

/**
 * Resta ESTABLE por conjugado cuando aparecen raíces:
 *   sqrt(S) − r       → (S − r²) / (sqrt(S) + r)
 *   sqrt(S) − sqrt(T) → (S − T) / (sqrt(S) + sqrt(T))
 *   r − sqrt(S)       → (r² − S) / (r + sqrt(S))
 * El numerador se calcula EXACTO en BigInt, así que no hay pérdida.
 */
function vSub(a, b) {
  if (a && a.sq && b && b.q) {
    return vDiv(normRaw(
      a.sq[0] * b.q[1] * b.q[1] - b.q[0] * b.q[0] * a.sq[1],
      a.sq[1] * b.q[1] * b.q[1]
    ), vAdd(a, b));
  }
  if (a && a.sq && b && b.sq) {
    return vDiv(normRaw(
      a.sq[0] * b.sq[1] - b.sq[0] * a.sq[1],
      a.sq[1] * b.sq[1]
    ), vAdd(a, b));
  }
  if (a && a.q && b && b.sq) {
    return vDiv(normRaw(
      a.q[0] * a.q[0] * b.sq[1] - b.sq[0] * a.q[1],
      a.q[1] * a.q[1] * b.sq[1]
    ), vAdd(a, b));
  }
  if (isExact(a) && isExact(b)) return normRaw(a.q[0] * b.q[1] - b.q[0] * a.q[1], a.q[1] * b.q[1]);
  return { f: toNum(a) - toNum(b) };
}

function vAbs(a) {
  if (isExact(a)) return { q: [a.q[0] < 0n ? -a.q[0] : a.q[0], a.q[1]] };
  return { f: Math.abs(toNum(a)) };
}

/** Número de bits de un BigInt (para decidir si cabe en un double). */
function bitLen(b) {
  let v = b < 0n ? -b : b;
  let n = 0;
  while (v > 0n) { v >>= 1n; n++; }
  return n;
}

function vPow(a, b) {
  const cabe = (r, k) => bitLen(r[0]) * Math.abs(k) <= 900 && bitLen(r[1]) * Math.abs(k) <= 900;
  if (isExact(b) && b.q[1] === 1n && b.q[0] <= 4096n && b.q[0] >= -4096n) {
    const k = b.q[0];
    if (isExact(a) && cabe(a.q, Number(k))) {
      if (k >= 0n) return normRaw(a.q[0] ** k, a.q[1] ** k);
      if (a.q[0] !== 0n) return normRaw(a.q[1] ** (-k), a.q[0] ** (-k));
    }
    if (k === 1n) return a;
    return { f: Math.pow(toNum(a), Number(k)) };
  }
  // Exponente no entero (o demasiado grande para exacto): base positiva.
  if (isExact(a) && a.q[0] > 0n) {
    const e = toNum(b);
    const um1 = toNum(normRaw(a.q[0] - a.q[1], a.q[1])); // base − 1 sin pérdida
    const ln = Math.abs(um1) < 0.5 ? Math.log1p(um1) : Math.log(toNum(a));
    return { f: Math.exp(e * ln) };
  }
  return { f: Math.pow(toNum(a), toNum(b)) };
}

function vSqrt(a) {
  if (isExact(a)) {
    if (a.q[0] < 0n) return { f: NaN };
    // Se conserva el racional BAJO la raíz (no su raíz entera): la
    // estabilización por conjugado de vSub necesita S, no √S.
    return { sq: [a.q[0], a.q[1]] };
  }
  return { f: Math.sqrt(toNum(a)) };
}

/* ---------- exactitud del double ---------- */

const _dv = new DataView(new ArrayBuffer(8));

/** Racional EXACTO ([n,d]) que representa exactamente el double x. */
export function exactOfDouble(x) {
  if (!Number.isFinite(x)) return rat(0n);
  if (Number.isInteger(x) && Math.abs(x) < 1e15) {
    return rat(BigInt(x), 1n);
  }
  const neg = x < 0;
  _dv.setFloat64(0, Math.abs(x));
  const hi = _dv.getUint32(0), lo = _dv.getUint32(4);
  const expBits = (hi >>> 20) & 0x7ff;
  // mantisa = bit implícito (1<<52) + fracción, tal y como describe IEEE-754.
  const mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  if (mant === 0n && expBits === 0) return rat(0n);
  const e = expBits === 0 ? -1074 : expBits - 1075;
  const M = expBits === 0 ? mant : mant | (1n << 52n);
  let n = M, d = 1n;
  if (e >= 0) n <<= BigInt(e); else d = 1n << BigInt(-e);
  const r = rat(neg ? -n : n, d);
  return r || rat(0n);
}

/* ---------- recorrido del AST ---------- */

export function evalNode(node, xr) {
  switch (node.t) {
    case 'num': return { q: [node.v.n, node.v.d] };
    case 'var': return xr;
    case 'pi': return { f: Math.PI };
    case 'neg': return vNeg(evalNode(node.a, xr));
    case 'add': {
      let acc = evalNode(node.terms[0], xr);
      for (let i = 1; i < node.terms.length; i++) acc = vAdd(acc, evalNode(node.terms[i], xr));
      return acc;
    }
    case 'sub': return vSub(evalNode(node.a, xr), evalNode(node.b, xr));
    case 'mul': {
      let acc = evalNode(node.fs[0], xr);
      for (let i = 1; i < node.fs.length; i++) acc = vMul(acc, evalNode(node.fs[i], xr));
      return acc;
    }
    case 'div': return vDiv(evalNode(node.a, xr), evalNode(node.b, xr));
    case 'sqrt': return vSqrt(evalNode(node.a, xr));
    case 'abs': return vAbs(evalNode(node.a, xr));
    case 'ln': return { f: Math.log(toNum(evalNode(node.a, xr))) };
    case 'exp': return { f: Math.exp(toNum(evalNode(node.a, xr))) };
    case 'cos': return { f: Math.cos(toNum(evalNode(node.a, xr))) };
    case 'sin': return { f: Math.sin(toNum(evalNode(node.a, xr))) };
    case 'tan': return { f: Math.tan(toNum(evalNode(node.a, xr))) };
    case 'pow': return vPow(evalNode(node.a, xr), evalNode(node.b, xr));
    default: return { f: NaN };
  }
}

/* ---------- atajos numéricos ---------- */

const N1 = { t: 'num', v: { n: 1n, d: 1n } };
const N2 = { t: 'num', v: { n: 2n, d: 1n } };
const HALF = { t: 'num', v: { n: 1n, d: 2n } };

/**
 * 1 − cos(u) = 2·sen²(u/2). Sin este atajo, la resta 1 − cos(u) pierde
 * todas las cifras significativas cuando u → 0 (a u = 10^-8, cos(u)
 * devuelve exactamente 1 en coma flotante) y la verificación de los
 * límites notables daría un falso "no converge".
 */
function rewrite(node) {
  if (!node || typeof node !== 'object') return node;
  if (node.t === 'sub' && node.a && node.a.t === 'num' && node.a.v.isOne()
      && node.b && node.b.t === 'cos') {
    return {
      t: 'mul',
      fs: [
        N2,
        { t: 'pow', a: { t: 'sin', a: { t: 'mul', fs: [HALF, node.b.a] } }, b: N2 }
      ]
    };
  }
  // Se reescribe en profundidad (el patrón aparece anidado en un cociente).
  // NUNCA se muta el nodo: los del motor están congelados con Object.freeze.
  if (Array.isArray(node.terms)) return { t: 'add', terms: node.terms.map(rewrite) };
  if (Array.isArray(node.fs)) return { t: 'mul', fs: node.fs.map(rewrite) };
  if (node.a || node.b) {
    const out = { t: node.t };
    for (const k of Object.keys(node)) {
      if (k === 'a') out.a = rewrite(node.a);
      else if (k === 'b') out.b = rewrite(node.b);
      else out[k] = node[k];
    }
    return out;
  }
  return node;
}

/* ---------- API de alto nivel ---------- */

/** Evalúa la expresión del enunciado en el double x. */
export function evalExprAt(expr, x) {
  return toNum(evalNode(rewrite(expr), exactOfDouble(x)));
}

/** Elige el trozo aplicable a x (prefiere la igualdad exacta si x === a). */
function pickPiece(pieces, x) {
  const parsed = pieces.map((pc) => {
    const s = String(pc.cond || '').replace(/\s+/g, '');
    const m = /^x(<=|>=|<|>|=)?(-?\d+(?:\.\d+)?)$/.exec(s);
    return m ? { pc, op: m[1] || '=', a: Number(m[2]) } : null;
  });
  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i] && parsed[i].op === '=' && x === parsed[i].a) return parsed[i].pc;
  }
  for (let i = 0; i < parsed.length; i++) {
    const it = parsed[i];
    if (!it) continue;
    if ((it.op === '<' && x < it.a) || (it.op === '<=' && x <= it.a)
      || (it.op === '>' && x > it.a) || (it.op === '>=' && x >= it.a)) return it.pc;
  }
  return null;
}

/**
 * Evalúa la función que define el enunciado en el double x.
 * Si hay `statement.pieces` (funciones a trozos) se respeta la rama.
 */
export function evalStatement(statement, x) {
  const pieces = statement && statement.pieces;
  if (Array.isArray(pieces) && pieces.length) {
    const p = pickPiece(pieces, x);
    if (p) return evalExprAt(p.expr, x);
  }
  return evalExprAt(statement.expr, x);
}
