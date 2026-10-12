/* =====================================================================
 * engine.js — Motor matemático exacto y generador de ejercicios
 *             de límites (2º Bachillerato, LOMLOE).
 *
 * Expone un único global: window.Lim
 * Sin dependencias. Sin import/export. Sin eval ni new Function.
 *
 * Estructura del fichero:
 *   §1  Q        Racionales exactos sobre BigInt
 *   §2  Poly     Polinomios con coeficientes racionales
 *   §3  ast      AST de expresiones + render MathML / LaTeX / plano
 *   §4  limit    Motor de límites
 *   §5  rng      Generador pseudoaleatorio determinista
 *   §6  utils    Ayudas internas (formatos, quiz, distractores)
 *   §7  generadores (los 23)
 *   §8  niveles, tópicos y métodos
 *   §9  API de alto nivel (generate, checkAnswer, ...)
 *   §10 extensión al contrato (documentada)
 *
 * Para poder cargarse también en Node (tests) se deja al final:
 *   if (typeof module !== "undefined" && module.exports) module.exports = Lim;
 * ===================================================================== */

'use strict';

/* Para Node: si no existe window, la variable global sigue siendo válida.
 * En navegador, `window.Lim = Lim` se hace al final del fichero. */
var Lim = {};

/* =====================================================================
 * §1  RACIONALES EXACTOS SOBRE BigInt
 * ===================================================================== */

/** Máximo común divisor de dos BigInt (siempre positivo). */
function bgcd(a, b) {
  if (a < 0n) a = -a;
  if (b < 0n) b = -b;
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

/** Mínimo común múltiplo de dos BigInt positivos. */
function blcm(a, b) {
  if (a === 0n || b === 0n) return 0n;
  return (a / bgcd(a, b)) * b;
}

/** Racional exacto n/d normalizado: d > 0 y gcd(n,d) = 1. */
function Q(n, d) {
  if (!(this instanceof Q)) return new Q(n, d);
  if (n instanceof Q && d === undefined) {
    this.n = n.n;
    this.d = n.d;
    return;
  }
  if (n instanceof Q && d !== undefined) {
    return Q(n.mul(Q(d)));
  }
  let nn, dd;
  if (typeof n === "string" && n.indexOf("/") >= 0 && d === undefined) {
    const parts = n.split("/");
    const a = decimalToRatio(parts[0]);
    const b = decimalToRatio(parts[1]);
    nn = a[0];
    dd = a[1] * b[0];
  } else {
    const a = decimalToRatio(n);
    nn = a[0];
    dd = a[1];
    if (d !== undefined) {
      const b = decimalToRatio(d);
      dd = dd * b[0];
      nn = nn * b[1];
    }
  }
  if (dd === 0n) throw new Error("División por cero: denominador 0");
  if (dd < 0n) {
    nn = -nn;
    dd = -dd;
  }
  const g = bgcd(nn, dd);
  if (g > 1n) {
    nn = nn / g;
    dd = dd / g;
  }
  this.n = nn;
  this.d = dd;
}

/**
 * Convierte un número decimal (posible notación exponencial) al par
 * [numerador, denominador] exacto en BigInt.
 */
function decimalToRatio(x) {
  if (typeof x === "bigint") return [x, 1n];
  if (typeof x === "number") {
    if (!isFinite(x)) throw new TypeError("Número no finito");
    if (Number.isInteger(x)) return [BigInt(x), 1n];
    return decimalToRatio(String(x)); // "2.5" | "1e-7" | "1.25e+21"
  }
  let s = String(x).trim().replace(",", ".");
  let exp = 0;
  const e = s.search(/[eE]/);
  if (e >= 0) {
    exp = parseInt(s.slice(e + 1), 10) || 0;
    s = s.slice(0, e);
  }
  if (s.indexOf(".") >= 0) {
    const parts = s.split(".");
    exp -= parts[1].length;
    s = parts[0] + parts[1];
  }
  if (s === "" || s === "-" || s === "+") return [0n, 1n];
  const n = BigInt(s);
  if (exp > 0) return [n * 10n ** BigInt(exp), 1n];
  if (exp < 0) return [n, 10n ** BigInt(-exp)];
  return [n, 1n];
}

Q.prototype = {
  constructor: Q,
  num() { return this.n; },
  den() { return this.d; },
  add(r) { r = Q(r); return new Q(this.n * r.d + r.n * this.d, this.d * r.d); },
  sub(r) { r = Q(r); return new Q(this.n * r.d - r.n * this.d, this.d * r.d); },
  mul(r) { r = Q(r); return new Q(this.n * r.n, this.d * r.d); },
  div(r) {
    r = Q(r);
    if (r.n === 0n) throw new Error("División por cero en un racional");
    return new Q(this.n * r.d, this.d * r.n);
  },
  neg() { return new Q(-this.n, this.d); },
  inv() {
    if (this.n === 0n) throw new Error("El 0 no tiene inverso");
    return new Q(this.d, this.n);
  },
  abs() { return this.n < 0n ? this.neg() : this; },
  sign() { return this.n === 0n ? 0 : (this.n < 0n ? -1 : 1); },
  cmp(r) {
    r = Q(r);
    const l = this.n * r.d;
    const rr = r.n * this.d;
    return l < rr ? -1 : (l > rr ? 1 : 0);
  },
  eq(r) { return this.cmp(r) === 0; },
  lt(r) { return this.cmp(r) < 0; },
  le(r) { return this.cmp(r) <= 0; },
  gt(r) { return this.cmp(r) > 0; },
  ge(r) { return this.cmp(r) >= 0; },
  isZero() { return this.n === 0n; },
  isPos() { return this.n > 0n; },
  isNeg() { return this.n < 0n; },
  isOne() { return this.n === 1n && this.d === 1n; },
  isInt() { return this.d === 1n; },
  toString() {
    return this.d === 1n ? String(this.n) : String(this.n) + "/" + String(this.d);
  },
  toDisplay() { return this.toString(); },
  toNumber() { return Number(this.n) / Number(this.d); },
  pow(k) {
    if (k instanceof Q) {
      if (!k.isInt()) throw new Error("Exponente racional no entero");
      k = Number(k.n / k.d);
    }
    k = typeof k === "bigint" ? Number(k) : k;
    if (!Number.isInteger(k)) throw new Error("Exponente no entero: " + k);
    if (k >= 0) return new Q(this.n ** BigInt(k), this.d ** BigInt(k));
    if (this.n === 0n) throw new Error("0 elevado a exponente negativo");
    return new Q(this.d ** BigInt(-k), this.n ** BigInt(-k));
  },
  toJSON() { return this.toString(); }
};

/* Estáticos */
Q.ZERO = new Q(0n, 1n);
Q.ONE = new Q(1n, 1n);
Q.TWO = new Q(2n, 1n);
Q.minusOne = new Q(-1n, 1n);
Q.fromNumber = function (f) { const pr = decimalToRatio(f); return new Q(pr[0], pr[1]); };
Q.fromString = function (s) { return new Q(s); };
/** Raíz cuadrada exacta si el racional es un cuadrado perfecto; si no, null. */
Q.sqrtExact = function (q) {
  q = Q(q);
  if (q.n < 0n) return null;
  const rn = isqrt(q.n);
  const rd = isqrt(q.d);
  if (rn * rn !== q.n || rd * rd !== q.d) return null;
  return new Q(rn, rd);
};
/** Raíz entera por Newton (BigInt). */
function isqrt(n) {
  if (n < 0n) throw new Error("Raíz de un número negativo");
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

/* =====================================================================
 * §2  POLINOMIOS CON COEFICIENTES RACIONALES
 *     coefs[0] = término independiente
 * ===================================================================== */

/** Normaliza una lista de coeficientes: a Q, sin ceros finales. */
function normCoeffs(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    out.push(c === undefined || c === null ? Q.ZERO : Q(c));
  }
  while (out.length > 0 && out[out.length - 1].isZero()) out.pop();
  return out;
}

function Poly(coeffs) {
  if (!(this instanceof Poly)) return new Poly(coeffs);
  this.coeffs = normCoeffs(coeffs || []);
}

Poly.prototype = {
  constructor: Poly,
  degree() { return this.coeffs.length - 1; },
  isZero() { return this.coeffs.length === 0; },
  isOne() { return this.coeffs.length === 1 && this.coeffs[0].isOne(); },
  isConstant() { return this.coeffs.length === 1; },
  /** Coeficiente de grado k (0 si no existe). */
  coef(k) { return k >= 0 && k < this.coeffs.length ? this.coeffs[k] : Q.ZERO; },
  leading() { return this.coeffs.length ? this.coeffs[this.coeffs.length - 1] : Q.ZERO; },
  eval(q) {
    q = Q(q);
    let acc = Q.ZERO;
    for (let i = this.coeffs.length - 1; i >= 0; i--) acc = acc.mul(q).add(this.coeffs[i]);
    return acc;
  },
  deriv() {
    if (this.coeffs.length <= 1) return Poly.zero;
    const out = [];
    for (let i = 1; i < this.coeffs.length; i++) out.push(this.coeffs[i].mul(Q(BigInt(i))));
    return new Poly(out);
  },
  add(o) {
    o = asPoly(o);
    const n = Math.max(this.coeffs.length, o.coeffs.length);
    const out = [];
    for (let i = 0; i < n; i++) out.push(this.coef(i).add(o.coef(i)));
    return new Poly(out);
  },
  sub(o) {
    o = asPoly(o);
    const n = Math.max(this.coeffs.length, o.coeffs.length);
    const out = [];
    for (let i = 0; i < n; i++) out.push(this.coef(i).sub(o.coef(i)));
    return new Poly(out);
  },
  mul(o) {
    o = asPoly(o);
    if (this.isZero() || o.isZero()) return Poly.zero;
    const out = new Array(this.coeffs.length + o.coeffs.length - 1);
    for (let i = 0; i < out.length; i++) out[i] = Q.ZERO;
    for (let i = 0; i < this.coeffs.length; i++) {
      for (let j = 0; j < o.coeffs.length; j++) {
        out[i + j] = out[i + j].add(this.coeffs[i].mul(o.coeffs[j]));
      }
    }
    return new Poly(out);
  },
  /** Multiplica por una constante racional. */
  scale(c) { c = Q(c); return this.mul(Poly.constant(c)); },
  /** División euclídea: devuelve { q, r }. */
  divmod(o) {
    o = asPoly(o);
    if (o.isZero()) return { q: Poly.zero, r: Poly.zero };
    let r = this;
    let q = [];
    const nd = o.degree();
    const lr = o.leading();
    while (!r.isZero() && r.degree() >= nd) {
      const k = r.degree() - nd;
      const c = r.leading().div(lr);
      q[k] = (q[k] || Q.ZERO).add(c);
      r = r.sub(o.mul(new Poly([...Array(k).fill(Q.ZERO), c])));
    }
    return { q: new Poly(q), r: r };
  },
  /** División exacta: lanza Error si el resto no es cero. */
  divExact(o) {
    const d = this.divmod(o);
    if (!d.r.isZero()) throw new Error("La división no es exacta");
    return d.q;
  },
  degreeDiff(o) { o = asPoly(o); return this.degree() - o.degree(); },
  /** Divide por x^grado(o) (para comparar infinitos). */
  scaleToFit(o) {
    o = asPoly(o);
    const k = o.degree();
    if (k <= 0) return this;
    return new Poly(this.coeffs.slice(k));
  },
  /** División interna por (x - root); devuelve null si el resto no es 0. */
  _divLinear(root) {
    root = Q(root);
    if (this.isZero()) return null;
    const k = this.coeffs.length - 1;
    const out = new Array(k + 1);
    out[k] = this.coeffs[k];
    for (let i = k - 1; i >= 0; i--) {
      out[i] = this.coeffs[i].add(out[i + 1].mul(root));
    }
    if (!out[0].isZero()) return null;
    return new Poly(out.slice(1));
  },
  /** Divide por (x - root). Lanza si no es exacta. */
  factorLinear(root) {
    const r = this._divLinear(root);
    if (!r) throw new Error("(x - " + Q(root).toString() + ") no divide " + this.toString());
    return r;
  },
  /** Raíces racionales SIMPLES (teorema de las raíces racionales).
   *  a_n/p·q:  p | |a_0|  y  q | |a_n|  (considerando los coef. como fracción). */
  rationalRoots() {
    if (this.isZero()) return [];
    /* Se pasan los coeficientes a enteros (mcm de los denominadores)
       para poder aplicar el teorema de las raíces racionales. */
    let lcmD = 1n;
    for (const c of this.coeffs) lcmD = blcm(lcmD, c.d);
    const ic = this.coeffs.map((c) => c.mul(Q(lcmD)));
    const c0 = ic[0];
    const cd = ic[ic.length - 1];
    const n0 = c0.n < 0n ? -c0.n : c0.n;
    const nn = cd.n < 0n ? -cd.n : cd.n;
    const ps = divisorsOf(n0 === 0n ? 1n : n0);
    const qs = (nn === 1n) ? [1n] : divisorsOf(nn);
    const found = [];
    for (const p of ps) {
      for (const q of qs) {
        for (const s of [1n, -1n]) {
          const cand = new Q(s * p, q);
          if (this.eval(cand).isZero()) {
            let dup = false;
            for (const f of found) if (f.eq(cand)) { dup = true; break; }
            if (!dup) found.push(cand);
          }
        }
      }
    }
    found.sort((a, b) => a.cmp(b));
    return found;
  },
  /** Factorización completa sobre Q: { linear:[{root,mult}], rest }. */
  factorAll() {
    let rest = this;
    const linear = [];
    for (const r of this.rationalRoots()) {
      let mult = 0;
      for (;;) {
        const d = rest._divLinear(r);
        if (!d) break;
        rest = d;
        mult++;
        if (rest.isZero()) break;
      }
      if (mult > 0) linear.push({ root: r, mult: mult });
    }
    return { linear: linear, rest: rest };
  },
  toAST() { return polyToAST(this); },
  toString() { return this.isZero() ? "0" : AST.toPlain(this.toAST()); }
};

/* Divisores positivos de un BigInt pequeño (trial por sqrt). */
function divisorsOf(n) {
  const out = [];
  let i = 1n;
  while (i * i <= n) {
    if (n % i === 0n) {
      out.push(i);
      const j = n / i;
      if (j !== i) out.push(j);
    }
    i++;
  }
  out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return out;
}

function asPoly(o) {
  if (o instanceof Poly) return o;
  if (typeof o === "number" || typeof o === "string" || o instanceof Q) return Poly.constant(Q(o));
  throw new TypeError("Se esperaba un polinomio");
}

Poly.from = function (list) { return new Poly(list); };
Poly.zero = new Poly([]);
Poly.one = new Poly([Q.ONE]);
Poly.x = new Poly([Q.ZERO, Q.ONE]);
/** Polinomio constante. */
Poly.constant = function (c) { return new Poly([Q(c)]); };
/** Polinomio m·x + b */
Poly.lin = function (m, b) { return new Poly([Q(b), Q(m)]); };
/** Polinomio a·x² + b·x + c */
Poly.quad = function (a, b, c) { return new Poly([Q(c), Q(b), Q(a)]); };
/** Polinomio a·x³ + b·x² + c·x + d */
Poly.cubic = function (a, b, c, d) { return new Poly([Q(d), Q(c), Q(b), Q(a)]); };/* =====================================================================
 * §3  AST DE EXPRESIONES Y RENDER
 *     Nodos inmutables: { t: "...", ... }
 * ===================================================================== */

var AST = {};

/** Constructor interno de nodos (congela para evitar mutaciones). */
function node(t, props) {
  const o = { t: t };
  for (const k in props) o[k] = props[k];
  return Object.freeze(o);
}

AST.num = function (v) {
  if (v && typeof v === "object" && typeof v.t === "string") return v;   // ya es un nodo
  return node("num", { v: v instanceof Q ? v : Q(v) });
};
AST.var = function (name) { return node("var", { name: name || "x" }); };
AST.pow = function (a, b) { return node("pow", { a: asNode(a), b: asNode(b) }); };
AST.neg = function (a) { return node("neg", { a: asNode(a) }); };
/** Coacciona un argumento a nodo AST (acepta Q o número). */
function asNode(v) {
  if (v instanceof Q || typeof v === "number" || typeof v === "bigint" || typeof v === "string") {
    return AST.num(Q(v));
  }
  return v;
}

AST.add = function () {
  const terms = [];
  for (let i = 0; i < arguments.length; i++) {
    const t = asNode(arguments[i]);
    if (t && t.t === "add") terms.push.apply(terms, t.terms);
    else terms.push(t);
  }
  if (terms.length === 1) return terms[0];
  return node("add", { terms: terms });
};
AST.sub = function (a, b) { return node("sub", { a: asNode(a), b: asNode(b) }); };
AST.mul = function () {
  const fs = [];
  for (let i = 0; i < arguments.length; i++) {
    const f = asNode(arguments[i]);
    if (f && f.t === "mul") fs.push.apply(fs, f.fs);
    else fs.push(f);
  }
  if (fs.length === 1) return fs[0];
  return node("mul", { fs: fs });
};
AST.div = function (a, b) { return node("div", { a: asNode(a), b: asNode(b) }); };
AST.sqrt = function (a) { return node("sqrt", { a: asNode(a) }); };
AST.ln = function (a) { return node("ln", { a: asNode(a) }); };
AST.exp = function (a) { return node("exp", { a: asNode(a) }); };
AST.cos = function (a) { return node("cos", { a: asNode(a) }); };
AST.sin = function (a) { return node("sin", { a: asNode(a) }); };
AST.tan = function (a) { return node("tan", { a: asNode(a) }); };
AST.abs = function (a) { return node("abs", { a: asNode(a) }); };
AST.pi = node("pi", {});

/* --- helpers de construcción frequently usados en los generadores --- */
AST.powN = function (base, k) {
  if (k && typeof k === "object" && k.t) return AST.pow(base, k);
  return AST.pow(base, AST.num(Q(BigInt(k))));
};
AST.x = function () { return AST.var("x"); };
AST.divOf = function (num, den) { return AST.div(num, den); };
AST.lin = function (m, b) {
  const c = Q(b), mm = Q(m);
  if (mm.isZero()) return AST.num(c);
  if (c.isZero()) return mm.isOne() ? AST.x() : AST.mul(mm, AST.x());
  const mon = mm.isOne() ? AST.x() : AST.mul(mm, AST.x());
  return AST.add(mon, AST.num(c));
};

/** Polinomio → AST, en orden descendente de grado y con signos correctos. */
function polyToAST(p) {
  if (p.isZero()) return AST.num(Q.ZERO);
  const parts = [];
  for (let i = p.degree(); i >= 0; i--) {
    const c = p.coeffs[i];
    if (c.isZero()) continue;
    const mon = i === 0 ? null
      : (i === 1 ? AST.x() : AST.powN(AST.x(), i));
    const ac = c.abs();
    const term = mon === null ? AST.num(ac) : (ac.isOne() ? mon : AST.mul(AST.num(ac), mon));
    parts.push({ sign: c.sign(), ast: term });
  }
  let acc = null;
  for (const part of parts) {
    if (acc === null) acc = part.sign < 0 ? AST.neg(part.ast) : part.ast;
    else if (part.sign < 0) acc = AST.sub(acc, part.ast);
    else acc = AST.add(acc, part.ast);
  }
  return acc;
}

/* --- aplanado de sumas y productos ---------------------------------- */

/** Devuelve [{sign:±1, node}] con la suma totalmente descompuesta. */
function flattenSum(n, sign) {
  sign = sign || 1;
  switch (n.t) {
    case "add": {
      const out = [];
      for (const t of n.terms) out.push.apply(out, flattenSum(t, sign));
      return out;
    }
    case "sub": return flattenSum(n.a, sign).concat(flattenSum(n.b, -sign));
    case "neg": return flattenSum(n.a, -sign);
    default: {
      const sp = splitLeadingSign(n);
      return [{ sign: sign * sp.sign, node: sp.node }];
    }
  }
}

/** Saca el signo negativo inicial de un término (numérico o factor). */
function splitLeadingSign(n) {
  if (n.t === "num") {
    if (n.v.isNeg()) return { sign: -1, node: AST.num(n.v.neg()) };
    return { sign: 1, node: n };
  }
  if (n.t === "neg") return { sign: -1, node: n.a };
  if (n.t === "mul" && n.fs.length > 0) {
    const first = n.fs[0];
    if (first.t === "num" && first.v.isNeg()) {
      const rest = n.fs.slice(1);
      const av = first.v.neg();
      const fs = (av.isOne() ? rest : [AST.num(av)].concat(rest));
      return { sign: -1, node: fs.length === 1 ? fs[0] : AST.mul.apply(AST, fs) };
    }
  }
  return { sign: 1, node: n };
}

/** Factores de un producto, quitando los coeficientes 1 y la x^b implícita. */
function productFactors(n) {
  const fs = flattenMul(n);
  const out = [];
  for (const f of fs) {
    if (f.t === "num" && f.v.isOne()) continue;
    out.push(f);
  }
  return out.length ? out : fs;
}

function flattenMul(n) {
  if (n.t === "mul") {
    const out = [];
    for (const f of n.fs) {
      if (f.t === "mul") out.push.apply(out, flattenMul(f));
      else out.push(f);
    }
    return out;
  }
  return [n];
}

/* --- render plano ---------------------------------------------------- */

var PREC = { sum: 1, prod: 2, neg: 3, pow: 4, atom: 5 };

function wrapPlain(s, p, need) { return p < need ? "(" + s + ")" : s; }

/** ¿Se puede poner el factor siguiente sin asterisco? (3x, 2(x+1), x²) */
function implicitJoin(prev, next) {
  return /^[0-9.]+$/.test(prev) && /^[a-zA-Z(√|]/.test(next);
}

function plain(n, need) {
  need = need || 0;
  switch (n.t) {
    case "num": return n.v.toString();
    case "var": return n.name;
    case "pi": return "pi";
    case "pow": {
      const b = plain(n.a, PREC.pow);
      let e = plain(n.b, PREC.pow + 1);
      // x^2 y no x^(2)
      if (n.b.t === "num" && n.b.v.isInt()) e = n.b.v.toString();
      return wrapPlain(b + "^" + e, PREC.pow, need);
    }
    case "neg": return wrapPlain("-" + plain(n.a, PREC.prod), PREC.neg, need);
    case "div": {
      return wrapPlain(plain(n.a, PREC.prod) + "/" + plain(n.b, PREC.prod + 1), PREC.prod, need);
    }
    case "mul": {
      const sp = splitLeadingSign(n);
      const items = productFactors(sp.node).map((f) => plain(f, PREC.prod));
      let s = "";
      for (let i = 0; i < items.length; i++) {
        if (i > 0) s += implicitJoin(s, items[i]) ? "" : "*";
        s += items[i];
      }
      if (sp.sign < 0) s = "-" + s;
      return wrapPlain(s, PREC.prod, need);
    }
    case "add": case "sub": {
      const items = flattenSum(n);
      let s = "";
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const txt = plain(it.node, PREC.prod);
        if (i === 0) s += it.sign < 0 ? "-" : "";
        else s += it.sign < 0 ? "-" : "+";
        s += txt;
      }
      return wrapPlain(s, PREC.sum, need);
    }
    case "sqrt": return "sqrt(" + plain(n.a, 0) + ")";
    case "ln": return "ln(" + plain(n.a, 0) + ")";
    case "exp": return "e^(" + plain(n.a, 0) + ")";
    case "cos": return "cos(" + plain(n.a, 0) + ")";
    case "sin": return "sen(" + plain(n.a, 0) + ")";
    case "tan": return "tan(" + plain(n.a, 0) + ")";
    case "abs": return "abs(" + plain(n.a, 0) + ")";
    default: return "?";
  }
}

AST.toPlain = function (n) { return plain(n, 0); };

/* --- LaTeX (para tests y depuración) -------------------------------- */

function latex(n, need) {
  need = need || 0;
  const par = (s, p) => (p < need ? "\\left(" + s + "\\right)" : s);
  switch (n.t) {
    case "num": return n.v.toString();
    case "var": return n.name;
    case "pi": return "\\pi";
    case "pow": return par(latex(n.a, PREC.pow) + "^{" + latex(n.b, 0) + "}", PREC.pow);
    case "neg": return par("-" + latex(n.a, PREC.prod), PREC.neg);
    case "div": return par("\\frac{" + latex(n.a, 0) + "}{" + latex(n.b, 0) + "}", PREC.prod);
    case "mul": {
      const sp = splitLeadingSign(n);
      const items = productFactors(sp.node).map((f) => latex(f, PREC.prod));
      return par((sp.sign < 0 ? "-" : "") + items.join("\\,"), PREC.prod);
    }
    case "add": case "sub": {
      const items = flattenSum(n);
      let s = "";
      items.forEach((it, i) => {
        const txt = latex(it.node, PREC.prod);
        s += i === 0 ? (it.sign < 0 ? "-" : "") : (it.sign < 0 ? " - " : " + ");
        s += txt;
      });
      return par(s, PREC.sum);
    }
    case "sqrt": return "\\sqrt{" + latex(n.a, 0) + "}";
    case "ln": return "\\ln\\left(" + latex(n.a, 0) + "\\right)";
    case "exp": return "e^{" + latex(n.a, 0) + "}";
    case "cos": return "\\cos\\left(" + latex(n.a, 0) + "\\right)";
    case "sin": return "\\sen\\left(" + latex(n.a, 0) + "\\right)";
    case "tan": return "\\tan\\left(" + latex(n.a, 0) + "\\right)";
    case "abs": return "\\left|" + latex(n.a, 0) + "\\right|";
    default: return "?";
  }
}

AST.toLatex = function (n) { return latex(n, 0); };

/* --- MathML ---------------------------------------------------------- *
 * Se construye un árbol de descriptores {name, attrs, kids|text} y luego
 * se convierte a DOM real (navegador) o a string XML (Node / tests).
 * -------------------------------------------------------------------- */

function md(name, attrs, kids) {
  return { name: name, attrs: attrs || {}, kids: kids || null, text: null };
}
function mt(name, text, attrs) {
  return { name: name, attrs: attrs || {}, kids: null, text: String(text) };
}

var MO_MINUS = "−";

function mathmlDesc(n) {
  switch (n.t) {
    case "num": {
      if (n.v.d === 1n) return mt("mn", n.v.toString());
      const neg = n.v.isNeg();
      const mag = neg ? n.v.neg() : n.v;
      return md("mfrac", {}, [
        md("mrow", {}, [neg ? mt("mo", MO_MINUS) : mt("mn", String(mag.n))]),
        mt("mn", String(n.v.d))
      ]);
    }
    case "var": return mt("mi", n.name);
    case "pi": return mt("mi", "π");
    case "pow": {
      return md("msup", {}, [mathmlDesc(n.a), expDesc(n.b)]);
    }
    case "neg": {
      return md("mrow", {}, [mt("mo", MO_MINUS), mathmlDesc(n.a)]);
    }
    case "div": {
      return md("mfrac", { displaystyle: "true" }, [mathmlDesc(n.a), mathmlDesc(n.b)]);
    }
    case "mul": {
      const fs = productFactors(n);
      const kids = [];
      fs.forEach((f, i) => {
        if (i > 0) {
          const numNext = fs[i].t === "num";
          kids.push(mt("mo", numNext ? "·" : "⁢"));
        }
        kids.push(mathmlDesc(f));
      });
      return md("mrow", {}, kids);
    }
    case "add": case "sub": {
      const items = flattenSum(n);
      const kids = [];
      items.forEach((it, i) => {
        if (i === 0) {
          if (it.sign < 0) kids.push(mt("mo", MO_MINUS));
        } else {
          kids.push(mt("mo", it.sign < 0 ? MO_MINUS : "+"));
        }
        kids.push(mathmlDesc(it.node));
      });
      return md("mrow", {}, kids);
    }
    case "sqrt": return md("msqrt", {}, [mathmlDesc(n.a)]);
    case "ln": return fnDesc("ln", n.a);
    case "cos": return fnDesc("cos", n.a);
    case "sin": return fnDesc("sen", n.a);
    case "tan": return fnDesc("tan", n.a);
    case "exp": {
      return md("msup", {}, [mt("mi", "e"), md("mrow", {}, [mt("mo", "("), mathmlDesc(n.a), mt("mo", ")")])]);
    }
    case "abs": {
      return md("mrow", {}, [mt("mo", "|", { stretchy: true }), mathmlDesc(n.a), mt("mo", "|", { stretchy: true })]);
    }
    default: return mt("mi", "?");
  }
}

/** Exponente: entero simple → mn; negativo → mrow con signo. */
function expDesc(e) {
  if (e.t === "num" && e.v.isInt()) {
    const v = e.v;
    if (v.isNeg()) return md("mrow", {}, [mt("mo", MO_MINUS), mt("mn", String(-v.n))]);
    return mt("mn", String(v.n));
  }
  if (e.t === "neg") return md("mrow", {}, [mt("mo", MO_MINUS), mathmlDesc(e.a)]);
  return mathmlDesc(e);
}

function fnDesc(name, a) {
  return md("mrow", {}, [
    mt("mi", name),
    mt("mo", "⁡"),
    md("mrow", { stretchy: "true" }, [mt("mo", "("), mathmlDesc(a), mt("mo", ")")])
  ]);
}

const MATHML_NS = "http://www.w3.org/1998/Math/MathML";

function descToElement(d) {
  let el;
  if (typeof document !== "undefined" && document.createElementNS) {
    el = document.createElementNS(MATHML_NS, d.name);
  } else {
    /* Shim mínimo para Node (tests). */
    el = {
      nodeName: d.name,
      attributes: {},
      childNodes: [],
      textContent: "",
      setAttribute(k, v) { this.attributes[k] = String(v); return this; },
      appendChild(c) { this.childNodes.push(c); return c; }
    };
  }
  for (const k in d.attrs) el.setAttribute(k, d.attrs[k]);
  if (d.text !== null && d.text !== undefined) el.textContent = d.text;
  if (d.kids) for (const k of d.kids) el.appendChild(descToElement(k));
  return el;
}

const XML_ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

function xmlEscape(s) {
  return String(s).replace(/[&<>"]/g, (c) => XML_ESC[c]);
}

function descToString(d) {
  let s = "<" + d.name;
  for (const k in d.attrs) s += " " + k + '="' + xmlEscape(d.attrs[k]) + '"';
  if (d.kids && d.kids.length) {
    s += ">";
    for (const k of d.kids) s += descToString(k);
    return s + "</" + d.name + ">";
  }
  if (d.text !== null && d.text !== undefined) return s + ">" + xmlEscape(d.text) + "</" + d.name + ">";
  return s + "/>";
}

/** AST → Elemento MathML del DOM (con aria-label). */
AST.toMathML = function (n) {
  const root = md("math", { xmlns: MATHML_NS, display: "inline" }, [mathmlDesc(n)]);
  const el = descToElement(root);
  if (el.setAttribute) el.setAttribute("aria-label", AST.toPlain(n));
  return el;
};

/** AST → cadena XML MathML (útil en tests y para innerHTML controlado). */
AST.toMathMLString = function (n) {
  return descToString(md("math", { xmlns: MATHML_NS, display: "inline" }, [mathmlDesc(n)]));
};

/** Comparación estructural simplificada (conmutatividad de + y ×). */
AST.equals = function (a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.t !== b.t) return false;
  switch (a.t) {
    case "num": return a.v.eq(b.v);
    case "var": return a.name === b.name;
    case "pi": return true;
    case "pow": return AST.equals(a.a, b.a) && AST.equals(a.b, b.b);
    case "neg": return AST.equals(a.a, b.a);
    case "div": return AST.equals(a.a, b.a) && AST.equals(a.b, b.b);
    case "sqrt": case "ln": case "exp": case "cos": case "sin": case "tan": case "abs":
      return AST.equals(a.a, b.a);
    case "add": case "sub": {
      const xs = flattenSum(a).map((i) => i.sign + "|" + AST.toPlain(i.node)).sort();
      const ys = flattenSum(b).map((i) => i.sign + "|" + AST.toPlain(i.node)).sort();
      return xs.length === ys.length && xs.every((v, i) => v === ys[i]);
    }
    case "mul": {
      const xs = flattenMul(a).map(AST.toPlain).sort();
      const ys = flattenMul(b).map(AST.toPlain).sort();
      return xs.length === ys.length && xs.every((v, i) => v === ys[i]);
    }
    default: return false;
  }
};

/** Valida la forma del árbol (extensión útil para los tests). */
AST.validate = function (n, depth) {
  depth = depth || 0;
  if (!n || typeof n !== "object" || typeof n.t !== "string" || depth > 200) return false;
  const okChild = (c) => AST.validate(c, depth + 1);
  switch (n.t) {
    case "num": return n.v instanceof Q;
    case "var": return typeof n.name === "string";
    case "pi": return true;
    case "pow": return okChild(n.a) && okChild(n.b);
    case "neg": return okChild(n.a);
    case "add": return Array.isArray(n.terms) && n.terms.length >= 2 && n.terms.every(okChild);
    case "sub": return okChild(n.a) && okChild(n.b);
    case "mul": return Array.isArray(n.fs) && n.fs.length >= 2 && n.fs.every(okChild);
    case "div": case "sqrt": case "ln": case "exp": case "cos": case "sin": case "tan": case "abs":
      return okChild(n.a);
    default: return false;
  }
};/* =====================================================================
 * §4  MOTOR DE LÍMITES
 * ===================================================================== */

var limit = {};

limit.FINITE = function (q) { return { kind: "finite", value: Q(q) }; };
limit.INF = function (s) { return { kind: "inf", sign: s >= 0 ? 1 : -1 }; };
limit.DNE = function () { return { kind: "dne" }; };

/** Clave comparable de un resultado. */
limit.key = function (r) {
  if (!r) return "?";
  if (r.kind === "finite") return "f:" + r.value.toString();
  if (r.kind === "inf") return "i:" + (r.sign > 0 ? "+" : "-");
  return "dne";
};

limit.equals = function (a, b) { return limit.key(a) === limit.key(b); };

/** Descripción en español del resultado (para textos y feedback). */
limit.describe = function (r) {
  if (r.kind === "finite") return "el límite es " + r.value.toDisplay();
  if (r.kind === "inf") return "el límite es " + (r.sign > 0 ? "+infinito" : "−infinito");
  return "el límite no existe";
};

/**
 * Multiplicidad de `at` como raíz de p, y valor de esa derivada.
 * p = (x-at)^m · g con g(at) ≠ 0  →  devuelve { m, der }.
 */
function multiplicityAt(p, at) {
  at = Q(at);
  let d = p;
  let k = 0;
  for (let guard = 0; guard < 64; guard++) {
    if (d.isZero()) return { m: Infinity, der: Q.ZERO };
    const v = d.eval(at);
    if (!v.isZero()) return { m: k, der: v };
    d = d.deriv();
    k++;
  }
  return { m: Infinity, der: Q.ZERO };
}

/**
 * Signo del denominador justo al lado pedido de `at` (+1 = derecha, -1 = izquierda).
 * Se usa el desarrollo de Taylor: den(x) ≈ den^(m)(at)/m! · (x-at)^m.
 */
function signDenNear(den, at, side) {
  const s = side === "-" ? -1 : 1;
  const info = multiplicityAt(den, at);
  if (info.m === Infinity) return 0;
  const c = info.der.sign();
  if (c === 0) return 0;
  const right = c;
  const left = c * (info.m % 2 === 0 ? 1 : -1);
  return s > 0 ? right : left;
}

/**
 * Límite de num/den en el punto `at`.
 *   side: "+" (derecha), "-" (izquierda), null (los dos lados).
 * El contrato lo llama `limit.rational`; `atPoint` es el mismo método.
 */
function limitAtPoint(opts) {
  let num = asPoly(opts.num);
  let den = asPoly(opts.den);
  const at = Q(opts.at);
  const side = (opts.side === "+" || opts.side === "-") ? opts.side : null;

  if (den.isZero()) return limit.DNE();
  if (side === null) return limit.bothSides({ num: num, den: den, at: at }).at;
  if (num.isZero()) {
    // 0/(x-a) vale 0 en cualquier lado (salvo si el denominador es el polinomio 0)
    return limit.FINITE(Q.ZERO);
  }

  /* Se cancelan los factores (x-at) comunes hasta que se pueda decidir. */
  for (let guard = 0; guard < 64; guard++) {
    const denAt = den.eval(at);
    const numAt = num.eval(at);
    if (!denAt.isZero()) return limit.FINITE(numAt.div(denAt));
    if (!numAt.isZero()) {
      const sn = numAt.sign();
      const sd = signDenNear(den, at, side);
      if (sd === 0) return limit.DNE();
      return limit.INF(sn * sd);
    }
    // num(at) = den(at) = 0: comprobamos multiplicidades
    const mn = multiplicityAt(num, at);
    const md = multiplicityAt(den, at);
    const common = Math.min(mn.m, md.m);
    if (!isFinite(common) || !isFinite(md.m) || common < 1) return limit.DNE();
    for (let i = 0; i < common; i++) {
      const dn = den._divLinear(at);
      const nu = num._divLinear(at);
      if (!dn || !nu) return limit.DNE();
      den = dn;
      num = nu;
    }
    if (num.isZero() || den.isZero()) return limit.DNE();
  }
  return limit.DNE();
}

/* El contrato lo llama `limit.rational`; `atPoint` es su alias. */
limit.rational = limitAtPoint;
limit.atPoint = limitAtPoint;

/**
 * Límite en el infinito de num/den.
 *   sign: "+" (x → +∞) o "-" (x → −∞)
 */
limit.infinity = function (opts) {
  const num = asPoly(opts.num);
  const den = asPoly(opts.den);
  const sign = opts.sign === "-" ? "-" : "+";
  if (den.isZero()) return limit.DNE();
  if (num.isZero()) return limit.FINITE(Q.ZERO);

  const dd = num.degree() - den.degree();

  /* Signo de p(x) cuando x tiende a ±infinito. */
  const leadSignAtInf = function (p) {
    const lc = p.leading();
    const s = lc.sign();
    if (s === 0) return 0;
    return sign === "-" ? s * (p.degree() % 2 === 0 ? 1 : -1) : s;
  };

  if (dd > 0) {
    const s = leadSignAtInf(num) * leadSignAtInf(den);
    if (s === 0) return limit.DNE();
    return limit.INF(s);
  }
  if (dd < 0) return limit.FINITE(Q.ZERO);
  return limit.FINITE(num.leading().div(den.leading()));
};

/** Los dos laterales y el valor en el punto (dne si no coinciden). */
limit.bothSides = function (opts) {
  const base = { num: asPoly(opts.num), den: asPoly(opts.den), at: Q(opts.at) };
  const left = limit.atPoint(Object.assign({}, base, { side: "-" }));
  const right = limit.atPoint(Object.assign({}, base, { side: "+" }));
  const at = limit.equals(left, right) ? left : limit.DNE();
  return { left: left, right: right, at: at };
};

/* =====================================================================
 * §5  GENERADOR PSEUDOALEATORIO DETERMINISTA
 * ===================================================================== */

/** Mezclador de semillas de 32 bits (xmur3). */
function seedMix(seed) {
  let h = seed >>> 0;
  return function () {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** sfc32: rápido, determinista y con buena distribución. */
function makeRng(seed) {
  const mix = seedMix(seed);
  let a = mix() * 4294967296 >>> 0;
  let b = mix() * 4294967296 >>> 0;
  let c = mix() * 4294967296 >>> 0;
  let d = mix() * 4294967296 >>> 0;
  const next = function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  /* Descarta los primeros valores para des-correlacionar semillas parecidas. */
  for (let i = 0; i < 12; i++) next();

  const rng = next;
  rng.seed = seed;
  rng.int = function (min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    if (max < min) return min;
    return min + Math.floor(next() * (max - min + 1));
  };
  rng.pick = function (arr) { return arr[Math.floor(next() * arr.length) % arr.length]; };
  rng.bool = function (p) { return next() < (p === undefined ? 0.5 : p); };
  rng.shuffle = function (arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      const t = out[i];
      out[i] = out[j];
      out[j] = t;
    }
    return out;
  };
  /** Entero no nulo en [-m, m]. */
  rng.nonzero = function (m) {
    let v = 0;
    for (let i = 0; i < 30 && v === 0; i++) v = rng.int(-m, m);
    return v === 0 ? 1 : v;
  };
  /** Coeficiente "bonito": entero no nulo en [-m, m], nunca 0 ni 1 si se puede. */
  rng.coef = function (m, allowOne) {
    const opts = [];
    for (let i = -m; i <= m; i++) {
      if (i === 0) continue;
      if (!allowOne && (i === 1 || i === -1)) continue;
      opts.push(i);
    }
    return opts.length ? rng.pick(opts) : 1;
  };
  return rng;
}/* =====================================================================
 * §6  AYUDAS INTERNAS (respuestas, quizzes, pasos, formateo)
 * ===================================================================== */

/* --- Respuestas (objetos Answer del contrato) --- */
function ansRational(q) { return { kind: "rational", value: Q(q) }; }
function ansInf(s) { return { kind: "infinite", sign: s >= 0 ? 1 : -1 }; }
function ansDne() { return { kind: "dne" }; }
function ansChoice(options, correct) {
  return { kind: "choice", options: options.slice(), correct: correct };
}
function ansText(value) { return { kind: "text", value: String(value) }; }
function ansNumeric(v) { return { kind: "numeric", value: round6(v) }; }

/** Redondeo a 6 decimales (para resultados no racionales). */
function round6(v) {
  if (!isFinite(v)) return 0;
  return Number(v.toFixed(6));
}

/**
 * Formato para textos: los negativos usan el signo tipográfico "−"
 * (igual que en las fórmulas) y se omiten los signos + delante.
 */
/** Con signo, sin espacio detrás: "−3", "+4", "−2/x". */
function fmtSign(v) {
  return (v < 0 ? "−" : "+") + Math.abs(v);
}

/** Término con signo y espacio: "x² + 4", "x² − 3". */
function fmtTerm(v) {
  return (v < 0 ? "− " : "+ ") + Math.abs(v);
}


/** Formato español con coma decimal (solo para textos). */
function fmtDec(v, dec) {
  dec = dec === undefined ? 6 : dec;
  let s = Number(v).toFixed(dec);
  if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s.replace("-", "−").replace(".", ",");
}

/**
 * Clave comparable de una Answer (para no repetir distractores).
 * Las respuestas racionales y numéricas que valen lo mismo se consideran
 * la misma clave: si no, un distractor 0 colaría cuando la respuesta es 0.
 */
function answerKeyOf(a) {
  if (!a) return "?";
  switch (a.kind) {
    case "rational": return "#:" + Q(a.value).toNumber();
    case "infinite": return "i:" + (a.sign > 0 ? "+" : "-");
    case "dne": return "dne";
    case "numeric": return "#:" + Number(a.value);
    case "text": return "t:" + normText(a.value);
    case "choice": return "c:" + a.options.map(normText).join("|") + ":" + a.correct;
    default: return "?";
  }
}

/** Normaliza un texto para comparar: minúsculas, sin espacios sobrantes. */
function normText(s) {
  return String(s).toLowerCase()
    .replace(/[−–—]/g, "-")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim();
}

/** Normalización fuerte para comparar respuestas de texto ("x = 3" ≈ "x=3"). */
function normAnswerText(s) {
  return String(s).toLowerCase()
    .replace(/[−–—]/g, "-")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*(=)\s*/g, "=")
    .replace(/\s+/g, "");
}

/** Elige 3 distractores distintos de la respuesta correcta. */
function dist3(answer, candidates) {
  const good = [];
  const seen = {};
  seen[answerKeyOf(answer)] = true;
  const push = function (c) {
    if (!c) return;
    const k = answerKeyOf(c);
    if (seen[k]) return;
    seen[k] = true;
    good.push(c);
  };
  for (const c of (candidates || [])) push(c);
  /* Reserva de seguridad: siempre hay 3 alternativas con sentido. */
  const pool = [
    ansInf(1), ansInf(-1), ansDne(),
    ansRational(Q.ZERO), ansRational(Q.ONE), ansRational(Q.minusOne)
  ];
  if (answer.kind === "rational") {
    pool.push(ansRational(answer.value.add(Q.ONE)));
    pool.push(ansRational(answer.value.sub(Q.ONE)));
    pool.push(ansRational(answer.value.mul(Q.TWO)));
  }
  if (answer.kind === "numeric") {
    pool.push(ansNumeric(answer.value + 1));
    pool.push(ansNumeric(answer.value - 1));
  }
  if (answer.kind === "text") {
    pool.push(ansText(answer.value + " (otra)"));
  }
  for (const c of pool) { if (good.length >= 3) break; push(c); }
  if (good.length < 3) throw new Error("No se han podido construir 3 distractores");
  return good.slice(0, 3);
}

/* --- Quizzes --- */
const INDET_OPCIONES = ["0/0", "∞/∞", "∞−∞", "0·∞", "1^∞", "no hay indeterminación"];

/** Interrogatorio de indeterminación: 4 de las 6 etiquetas posibles. */
function quizIndet(correctLabel, rand, explain) {
  const others = INDET_OPCIONES.filter((o) => o !== correctLabel);
  const picked = rand.shuffle(others).slice(0, 3);
  const options = rand.shuffle([correctLabel].concat(picked));
  return {
    kind: "indeterminacion",
    question: "¿Qué indeterminación aparece al sustituir?",
    options: options,
    correct: options.indexOf(correctLabel),
    explain: explain
  };
}

/** Pregunta múltiple con el método correcto y 3 métodos que los alumnos confunden. */
function quizMC(kind, question, correctText, distractors, rand, explain) {
  const options = rand.shuffle([correctText].concat(distractors.slice(0, 3)));
  return {
    kind: kind,
    question: question,
    options: options,
    correct: options.indexOf(correctText),
    explain: explain
  };
}

/* --- Pasos y problemas --- */
function mkStep(title, detail, math, key) {
  return { title: title, detail: detail, math: math || null, key: !!key };
}

function buildProblem(gen, rand, parts) {
  const p = {
    id: gen.id + "-" + rand.seed,
    seed: rand.seed,
    generatorId: gen.id,
    title: gen.title,
    topic: gen.topic,
    difficulty: gen.difficulty,
    method: gen.method,
    statement: parts.statement,
    answer: parts.answer,
    quiz: parts.quiz,
    steps: parts.steps,
    keyStep: parts.keyStep === undefined ? 0 : parts.keyStep,
    distractors: parts.distractors
  };
  if (parts.internal) p.internal = parts.internal;
  return p;
}

function targetPoint(at, side) { return { type: "point", at: Q(at), side: side || null }; }
function targetInf(sign) { return { type: "infinity", sign: sign === "-" ? "-" : "+" }; }

/** Expresión AST de un cociente num/den. */
function ratioAST(num, den) { return AST.div(polyToAST(num), polyToAST(den)); }

/** Etiqueta legible del punto o dirección del límite. */
function targetLabel(t) {
  if (!t) return "";
  if (t.type === "infinity") return "x → " + (t.sign === "-" ? "−infinito" : "+infinito");
  const a = t.at.toDisplay();
  if (t.side === "+") return "x → " + a + "⁺";
  if (t.side === "-") return "x → " + a + "⁻";
  return "x → " + a;
}

/** Factorización legible de un polinomio como AST: lc·(x−r)(x−r)·resto. */
function factorAST(p) {
  if (p.isZero()) return AST.num(Q.ZERO);
  const fa = p.factorAll();
  const fs = [];
  for (const item of fa.linear) {
    const base = AST.sub(AST.x(), AST.num(item.root));
    fs.push(item.mult > 1 ? AST.pow(base, AST.num(Q(BigInt(item.mult)))) : base);
  }
  if (!fa.rest.isZero() && fa.rest.degree() >= 1) fs.push(polyToAST(fa.rest));
  const lc = p.leading();
  if (!lc.isOne() || fs.length === 0) fs.unshift(AST.num(lc));
  if (fs.length === 1) return fs[0];
  return AST.mul.apply(AST, fs);
}

/** Polinomio x^k. */
function xPow(k) {
  const cf = [];
  for (let i = 0; i < k; i++) cf.push(Q.ZERO);
  cf.push(Q.ONE);
  return new Poly(cf);
}

/**
 * Texto de p(x)/x^deg, mostrando los términos que han bajado de grado
 * como 1/x^k. Se usa en los pasos de "dividir entre x^n".
 */
function fitText(p, deg) {
  if (p.isZero()) return "0";
  const partes = [];
  for (let i = p.degree(); i >= 0; i--) {
    const c = p.coeffs[i];
    if (c.isZero()) continue;
    const k = i - deg;
    const mag = c.abs();
    /* con potencias positivas no se escribe el 1 (x^3); en las negativas sí
       (1/x^3), que se lee mejor */
    const coef = (mag.isOne() && k > 0) ? "" : mag.toDisplay();
    const signo = c.isNeg() ? (partes.length ? " − " : "−") : (partes.length ? " + " : "");
    if (k === 0) partes.push(signo + coef);
    else if (k > 0) partes.push(signo + coef + "x" + (k === 1 ? "" : "^" + k));
    else partes.push(signo + coef + "/x" + (-k === 1 ? "" : "^" + -k));
  }
  return partes.length ? partes.join("") : "0";
}

/** Texto de un polinomio para los `detail` de los pasos. */
function polyText(p) { return p.isZero() ? "0" : p.toString(); }

/**
 * Texto de m·x + b con signos y espacios correctos ("−4x − 3", "2x + 2",
 * "3", "−3"). Se usa en los pasos donde la expresión es larga.
 */
function linTxt(m, b) {
  const M = Number(m), B = Number(b);
  if (M === 0) return B === 0 ? "0" : fmtTerm(B).trim();
  const ini = M === 1 ? "x" : (M === -1 ? "−x" : fmtSign(M) + "x");
  if (B === 0) return ini;
  return ini + " " + fmtTerm(B).trim();
}

/** Texto de un cociente de racionales, con el signo bien puesto: "-1/3". */
function ratioTxt(a, b) {
  a = Q(a); b = Q(b);
  const r = a.div(b);
  return (r.isNeg() ? "−" : "") + r.abs().toDisplay();
}

/** Texto de k + b/x (útil al dividir entre x^n). */
function invTxt(k, b) {
  const K = Number(k), B = Number(b);
  if (K === 0 && B === 0) return "0";
  let out = K === 0 ? "" : (K === 1 ? "1" : K === -1 ? "−1" : String(K));
  if (B !== 0) out += (out ? " " + fmtSign(B).replace(/([−+])/, "$1 ") : (B === 1 ? "1" : B === -1 ? "−1" : String(B))) + "/x";
  return out;
}

/* =====================================================================
 * §7  GENERADORES (23)
 * ===================================================================== */

var GENERATORS = {};

/* ---------- 1. sustitución directa ---------- */
GENERATORS["subst-directa"] = {
  id: "subst-directa",
  title: "Sustitución directa",
  topic: "sustitucion",
  method: "sustitucion",
  difficulty: 1,
  make: function (rand) {
    const a = rand.int(-3, 4);
    let m = rand.coef(4, true);
    let b = rand.int(-4, 4);
    while (m * a + b === 0) b = rand.int(-4, 4);
    const num = Poly.quad(rand.int(-3, 3) || 1, rand.int(-4, 4), rand.int(-4, 4));
    const den = Poly.lin(m, b);
    const at = Q(a);
    const res = limit.atPoint({ num: num, den: den, at: at, side: null });
    const ans = ansRational(res.value);
    const numAt = num.eval(at);
    const denAt = den.eval(at);

    const steps = [
      mkStep("Sustituimos x = " + at.toDisplay(),
        "En un cociente de polinomios, si el denominador no se anula, el límite es el cociente de los valores.",
        AST.div(AST.num(numAt), AST.num(denAt))),
      mkStep("El denominador no se anula",
        "Al sustituir, el denominador vale " + denAt.toDisplay() + ", que no es cero. No hay ninguna indeterminación.",
        AST.num(denAt), true),
      mkStep("Resultado",
        "Dividimos: " + numAt.toDisplay() + " / " + denAt.toDisplay() + " = " + res.value.toDisplay() + ".",
        AST.div(AST.num(numAt), AST.num(denAt)))
    ];

    const other = Poly.quad(rand.int(-3, 3) || 1, rand.int(-4, 4), rand.int(-4, 4));
    const cands = [
      ansRational(numAt),
      ansRational(denAt),
      ansRational(other.eval(at).div(denAt)),
      ansRational(res.value.add(Q.ONE))
    ];
    return buildProblem(this, rand, {
      statement: { expr: ratioAST(num, den), target: targetPoint(at, null), kind: "limit" },
      answer: ans,
      quiz: quizIndet("no hay indeterminación", rand,
        "El denominador vale " + denAt.toDisplay() + " ≠ 0 al sustituir, así que no hay ninguna indeterminación: basta con sustituir."),
      steps: steps,
      keyStep: 1,
      distractors: dist3(ans, cands),
      internal: { num: num, den: den, at: at, side: null }
    });
  }
};

/* ---------- 2. sustitución con elementos (ln, e, cos, sen, raíces) ---------- */
GENERATORS["subst-elemental"] = {
  id: "subst-elemental",
  title: "Sustitución con elementos",
  topic: "sustitucion",
  method: "sustitucion",
  difficulty: 2,
  make: function (rand) {
    const v = rand.int(0, 6);
    let expr, at, ans, expl, pasos, cands;

    const lin = (m, b) => AST.lin(m, b);

    if (v === 0) {
      /* ln(g)/g con g(a) = 1 */
      const m = rand.int(2, 4);
      const a = rand.int(-3, 3);
      const b = 1 - m * a;
      const g = AST.lin(m, b);
      expr = AST.div(AST.ln(g), g);
      at = Q(a);
      ans = ansRational(Q.ZERO);
      expl = "En x = " + a + " la expresión de dentro vale " + (m * a + b) + ", es decir ln(1)/1 = 0.";
      pasos = [
        mkStep("Sustituimos x = " + a, "La expresión del logaritmo vale " + (m * a + b) + " ≠ 0, así que el logaritmo está definido.", expr),
        mkStep("Evaluamos las dos partes", "El numerador es ln(" + (m * a + b) + ") = ln(1) = 0 y el denominador vale " + (m * a + b) + ". El denominador no se anula.", AST.div(AST.num(Q.ZERO), AST.num(Q(BigInt(m * a + b)))), true),
        mkStep("Resultado", "0 / " + (m * a + b) + " = 0.", AST.num(Q.ZERO))
      ];
      cands = [ansRational(Q.ONE), ansRational(Q(BigInt(m * a + b))), ansInf(1), ansInf(-1)];
    } else if (v === 1) {
      /* cos(x)/(m x + b) */
      const a = rand.int(-3, 3);
      let m = rand.coef(4, true);
      let b = rand.int(-4, 4);
      while (m * a + b === 0) b = rand.int(-4, 4);
      const den = m * a + b;
      expr = AST.div(AST.cos(AST.x()), lin(m, b));
      at = Q(a);
      const val = Math.cos(a) / den;
      ans = ansNumeric(val);
      expl = "cos(" + a + ") = " + fmtDec(Math.cos(a)) + " y el denominador vale " + den + ".";
      pasos = [
        mkStep("Sustituimos x = " + a, "El denominador vale " + den + ", que no es cero: no hay indeterminación.", lin(m, b)),
        mkStep("Evaluamos el coseno", "cos(" + a + ") = " + fmtDec(Math.cos(a)) + ". El límite es ese valor dividido por " + den + ".", AST.div(AST.cos(AST.x()), lin(m, b)), true),
        mkStep("Resultado", "El límite es " + fmtDec(val) + " (aproximadamente).", AST.num(Q.fromNumber(round6(val))))
      ];
      cands = [
        ansNumeric(Math.cos(a)),
        ansNumeric(Math.cos(a + 1) / (m * (a + 1) + b)),
        ansNumeric(val * 2),
        ansRational(Q(BigInt(den)))
      ];
    } else if (v === 2) {
      /* e^(g)/g con g(a) = k ≠ 0 */
      const m = rand.int(1, 3);
      const a = rand.int(-2, 2);
      const k = rand.pick([-2, -1, 1, 2]);
      const b = k - m * a;
      const g = AST.lin(m, b);
      expr = AST.div(AST.exp(g), g);
      at = Q(a);
      const val = Math.exp(k) / k;
      ans = ansNumeric(val);
      expl = "El exponente y el denominador valen " + k + ": sale e^" + k + " / " + k + ".";
      pasos = [
        mkStep("Sustituimos x = " + a, "El exponente vale " + (m * a + b) + " ≠ 0, así que el denominador no se anula y se puede sustituir.", g),
        mkStep("Evaluamos la exponencial", "El exponente vale " + k + ", así que sale e^" + k + " = " + fmtDec(Math.exp(k)) + ". El límite es e^" + k + " / " + k + ".", AST.div(AST.exp(g), g), true),
        mkStep("Resultado", "El límite es " + fmtDec(val) + " (aproximadamente).", AST.num(Q.fromNumber(round6(val))))
      ];
      cands = [
        ansNumeric(Math.exp(k)),
        ansNumeric(Math.exp(k) * k),
        ansNumeric(val * 2),
        ansRational(Q(BigInt(k)))
      ];
    } else if (v === 3) {
      /* sqrt(g)/g con g(a) cuadrado perfecto */
      const sq = rand.pick([4, 9, 16]);
      const m = rand.int(1, 3);
      const a = rand.int(-3, 3);
      const b = sq - m * a;
      const g = AST.lin(m, b);
      expr = AST.div(AST.sqrt(g), g);
      at = Q(a);
      const root = Math.round(Math.sqrt(sq));
      const val = Q(BigInt(root)).div(Q(BigInt(sq)));
      ans = ansRational(val);
      expl = "La raíz es exacta (" + root + ") y el denominador vale " + sq + ": el resultado es un racional.";
      pasos = [
        mkStep("Sustituimos x = " + a, "El denominador vale " + sq + ", que no es cero.", g),
        mkStep("Evaluamos la raíz", "sqrt(" + sq + ") = " + root + " (raíz exacta). Entonces " + root + " / " + sq + ".", AST.div(AST.sqrt(g), g), true),
        mkStep("Resultado", "El límite es " + val.toDisplay() + ".", AST.num(val))
      ];
      cands = [ansRational(Q(BigInt(root))), ansRational(Q(BigInt(sq))), ansRational(Q(BigInt(root * root * root))), ansInf(1)];
    } else if (v === 4) {
      /* ln(g)/c */
      const g0 = rand.pick([2, 3, 5, 7, 10]);
      const c = rand.int(2, 4);
      const m = rand.int(1, 3);
      const a = rand.int(-3, 3);
      const b = g0 - m * a;
      const g = AST.lin(m, b);
      expr = AST.div(AST.ln(g), AST.num(Q(BigInt(c))));
      at = Q(a);
      const val = Math.log(g0) / c;
      ans = ansNumeric(val);
      expl = "El logaritmo no da un número racional: el resultado se deja como logaritmo o se aproxima.";
      pasos = [
        mkStep("Sustituimos x = " + a, "El argumento del logaritmo vale " + g0 + " > 0, así que el logaritmo existe.", g),
        mkStep("Evaluamos", "El logaritmo vale ln(" + g0 + ") = " + fmtDec(Math.log(g0)) + " y el denominador es " + c + ".", expr, true),
        mkStep("Resultado", "El límite es ln(" + g0 + ")/" + c + " ≈ " + fmtDec(val) + ".", AST.num(Q.fromNumber(round6(val))))
      ];
      cands = [
        ansNumeric(Math.log(g0)),
        ansNumeric(Math.log(g0) * c),
        ansNumeric(val * 2),
        ansRational(Q(BigInt(g0)))
      ];
    } else if (v === 5) {
      /* sen(x)/(m x + b) */
      const a = rand.int(-3, 3);
      let m = rand.coef(4, true);
      let b = rand.int(-4, 4);
      while (m * a + b === 0) b = rand.int(-4, 4);
      const den = m * a + b;
      expr = AST.div(AST.sin(AST.x()), lin(m, b));
      at = Q(a);
      const val = Math.sin(a) / den;
      ans = ansNumeric(val);
      expl = "sen(" + a + ") = " + fmtDec(Math.sin(a)) + " y el denominador vale " + den + ".";
      pasos = [
        mkStep("Sustituimos x = " + a, "El denominador vale " + den + " ≠ 0, así que no hay indeterminación.", lin(m, b)),
        mkStep("Evaluamos el seno", "sen(" + a + ") = " + fmtDec(Math.sin(a)) + ". El límite es ese valor entre " + den + ".", expr, true),
        mkStep("Resultado", "El límite es " + fmtDec(val) + " (aproximadamente).", AST.num(Q.fromNumber(round6(val))))
      ];
      cands = [
        ansNumeric(Math.sin(a)),
        ansNumeric(Math.sin(a + 1) / (m * (a + 1) + b)),
        ansNumeric(val * 2),
        ansRational(Q(BigInt(den)))
      ];
    } else {
      /* |x² − a²| / |x − a|  →  |x + a|  →  2|a| */
      const a = rand.nonzero(4);
      const dentro = Poly.from([Q(BigInt(-a * a)), Q.ZERO, Q.ONE]);   // x² − a²
      const fuera = AST.abs(AST.sub(AST.x(), AST.num(Q(BigInt(a)))));
      expr = AST.div(AST.abs(dentro.toAST()), fuera);
      at = Q(a);
      const valor = 2 * Math.abs(a);
      ans = ansRational(Q(BigInt(valor)));
      expl = "Sustituir da 0/0, pero dentro del valor absoluto se puede factorizar: |x² − a²| = " +
        "|(x − " + a + ")(x + " + a + ")| = |x − " + a + "|·|x + " + a + "|.";
      pasos = [
        mkStep("Sustituimos y sale 0/0",
          "En x = " + a + " el numerador vale |" + a + "² − " + a + "²| = 0 y el denominador vale |0| = 0.",
          AST.div(AST.num(Q.ZERO), AST.num(Q.ZERO)), true),
        mkStep("Factorizamos dentro del valor absoluto",
          "|x² − " + (a * a) + "| = |(x − " + a + ")(x + " + a + ")| = |x − " + a + "|·|x + " + a +
          "|. Ese |x − " + a + "| es justo el denominador, así que se cancela.",
          AST.div(AST.abs(dentro.toAST()), fuera)),
        mkStep("Sustituimos de nuevo",
          "Queda |x + " + a + "|, y al sustituir x = " + a + " vale |" + (2 * a) + "| = " + valor + ".",
          AST.num(Q(BigInt(valor))))
      ];
      cands = [ansRational(Q.ZERO), ansRational(Q(BigInt(-valor))), ansRational(Q(BigInt(2 * a))), ansInf(1)];
    }

    const quiz = quizIndet("no hay indeterminación", rand, expl);
    return buildProblem(this, rand, {
      statement: { expr: expr, target: targetPoint(at, null), kind: "limit", question: "Calcula el límite del enunciado." },
      answer: ans,
      quiz: quiz,
      steps: pasos,
      keyStep: 1,
      distractors: dist3(ans, cands)
    });
  }
};

/* ---------- 3. lateral con análisis de signos ---------- */
GENERATORS["lateral-signo"] = {
  id: "lateral-signo",
  title: "Límite lateral: signo del denominador",
  topic: "sustitucion",
  method: "lateral",
  difficulty: 2,
  make: function (rand) {
    const a = rand.int(-4, 4);
    let m = rand.coef(4, true);
    let b = rand.int(-4, 4);
    while (m * a + b === 0) b = rand.int(-4, 4);
    const side = rand.pick(["+", "-"]);
    const num = Poly.lin(m, b);
    const den = Poly.lin(1, -a);
    const at = Q(a);
    const res = limit.atPoint({ num: num, den: den, at: at, side: side });
    const ans = ansInf(res.sign);
    const numAt = num.eval(at);
    const signo = res.sign > 0 ? "positivo" : "negativo";
    const lado = side === "+" ? "la derecha" : "la izquierda";

    const pasos = [
      mkStep("Sustituimos x = " + at.toDisplay(),
        "El numerador vale " + numAt.toDisplay() + " (no se anula) y el denominador vale 0. No es 0/0, pero el cociente se dispara.",
        AST.div(AST.num(numAt), AST.num(Q.ZERO)), true),
      mkStep("Dividimos entre (x − " + at.toDisplay() + ")",
        "Como " + polyText(num) + " = " + m + "(x − " + at.toDisplay() + ") + " + numAt.toDisplay() + ", el cociente es " + m + " + " + numAt.toDisplay() + "/(x − " + at.toDisplay() + ").",
        ratioAST(num, den)),
      mkStep("Signo por " + lado,
        "Al acercarnos por " + lado + ", x − " + at.toDisplay() + " es " + (side === "+" ? "positivo" : "negativo") + ", así que " + numAt.toDisplay() + "/(x − " + at.toDisplay() + ") tiende a " + (res.sign > 0 ? "+infinito" : "−infinito") + ". El signo " + signo + " no depende de " + m + ".",
        AST.num(Q.ZERO))
    ];

    return buildProblem(this, rand, {
      statement: {
        expr: ratioAST(num, den),
        target: targetPoint(at, side),
        kind: "limit",
        question: "Calcula el límite por " + lado + "."
      },
      answer: ans,
      quiz: quizMC("metodo", "¿Qué hay que hacer para decidir el signo?",
        "Dividir entre (x − a) y estudiar el signo en el lado pedido",
        ["Sustituir directamente el denominador por su valor",
          "Clasificar la indeterminación y aplicar L'Hôpital",
          "Racionalizar con el conjugado"],
        rand,
        "El denominador se anula pero el numerador no, así que basta con saber si x − " + at.toDisplay() + " es positivo o negativo en el lado pedido."),
      steps: pasos,
      keyStep: 2,
      distractors: dist3(ans, [ansInf(-res.sign), ansRational(Q.ZERO), ansDne(), ansRational(numAt)]),
      internal: { num: num, den: den, at: at, side: side }
    });
  }
};

/* ---------- 4. laterales distintos: no existe ---------- */
GENERATORS["lateral-dne"] = {
  id: "lateral-dne",
  title: "Los dos laterales no coinciden",
  topic: "sustitucion",
  method: "lateral",
  difficulty: 3,
  make: function (rand) {
    const a = rand.int(-4, 4);
    let m = rand.coef(4, true);
    let b = rand.int(-4, 4);
    while (m * a + b === 0) b = rand.int(-4, 4);
    const num = Poly.lin(m, b);
    const den = Poly.lin(1, -a);
    const at = Q(a);
    const bs = limit.bothSides({ num: num, den: den, at: at });
    const ans = ansDne();
    const numAt = num.eval(at);

    const pasos = [
      mkStep("Sustituimos x = " + at.toDisplay(),
        "El numerador vale " + numAt.toDisplay() + " y el denominador vale 0. Aquí no hay 0/0: el denominador se anula solo.",
        AST.div(AST.num(numAt), AST.num(Q.ZERO)), true),
      mkStep("Límite por la derecha",
        "Con x − " + at.toDisplay() + " > 0 el cociente " + numAt.toDisplay() + "/(x − " + at.toDisplay() + ") tiende a " + (bs.right.sign > 0 ? "+infinito" : "−infinito") + ".",
        AST.num(Q.ZERO)),
      mkStep("Límite por la izquierda",
        "Con x − " + at.toDisplay() + " < 0 el mismo cociente tiende a " + (bs.left.sign > 0 ? "+infinito" : "−infinito") + ".",
        AST.num(Q.ZERO)),
      mkStep("Conclusión",
        "Los dos laterales son distintos (" + (bs.left.sign > 0 ? "+infinito" : "−infinito") +
        " y " + (bs.right.sign > 0 ? "+infinito" : "−infinito") + "), así que el límite no existe.",
        AST.div(AST.num(numAt), AST.num(Q.ZERO)))
    ];

    return buildProblem(this, rand, {
      statement: {
        expr: ratioAST(num, den),
        target: targetPoint(at, null),
        kind: "limit",
        question: "Calcula el límite en el punto."
      },
      answer: ans,
      quiz: quizMC("porque", "¿Por qué no existe este límite?",
        "Los límites por izquierda y por derecha son distintos",
        ["El denominador se anula",
          "La función no está definida en el punto",
          "El numerador se anula"],
        rand,
        "El denominador se anula, pero eso solo provoca infinitos: el límite no existe porque un lado va a " +
        (bs.left.sign > 0 ? "+infinito" : "−infinito") + " y el otro a " + (bs.right.sign > 0 ? "+infinito" : "−infinito") + "."),
      steps: pasos,
      keyStep: 3,
      distractors: dist3(ans, [ansInf(bs.left.sign), ansInf(bs.right.sign), ansRational(Q.ZERO)]),
      internal: { num: num, den: den, at: at, side: null }
    });
  }
};

/* ---------- 5. denominador anulado: ±infinito ---------- */
GENERATORS["den-anulado"] = {
  id: "den-anulado",
  title: "Denominador anulado: límite infinito",
  topic: "sustitucion",
  method: "denominador",
  difficulty: 3,
  make: function (rand) {
    const a = rand.int(-4, 4);
    let m = rand.coef(4, true);
    let b = rand.int(-4, 4);
    while (m * a + b === 0) b = rand.int(-4, 4);
    const k = rand.pick([1, 1, -1, 2]);
    const num = Poly.lin(m, b);
    const den = Poly.from([k * a * a, -2 * k * a, k]); // k(x − a)²
    const at = Q(a);
    const res = limit.atPoint({ num: num, den: den, at: at, side: null });
    const ans = ansInf(res.sign);
    const numAt = num.eval(at);

    const pasos = [
      mkStep("Sustituimos x = " + at.toDisplay(),
        "El numerador vale " + numAt.toDisplay() + " y el denominador vale 0. Como el numerador no se anula, no hay 0/0.",
        AST.div(AST.num(numAt), AST.num(Q.ZERO)), true),
      mkStep("El denominador es un cuadrado",
        polyText(den) + " = " + (k === 1 ? "" : (k === -1 ? "−" : k + "·")) + "(x − " + at.toDisplay() +
        ")². Un cuadrado no cambia de signo, así que el denominador es " +
        (k > 0 ? "positivo" : "negativo") + " en los dos lados.",
        ratioAST(num, den)),
      mkStep("Resultado",
        "El cociente mantiene el signo del numerador (" + numAt.toDisplay() + ", " + (numAt.isPos() ? "positivo" : "negativo") +
        ") y tiende a " + (res.sign > 0 ? "+infinito" : "−infinito") + " por los dos lados.",
        AST.num(Q.ZERO))
    ];

    return buildProblem(this, rand, {
      statement: {
        expr: ratioAST(num, den),
        target: targetPoint(at, null),
        kind: "limit",
        question: "Calcula el límite en el punto."
      },
      answer: ans,
      quiz: quizIndet("no hay indeterminación", rand,
        "El numerador vale " + numAt.toDisplay() + " y el denominador 0: no hay 0/0, sino un cociente que se va a infinito."),
      steps: pasos,
      keyStep: 1,
      distractors: dist3(ans, [ansInf(-res.sign), ansRational(Q.ZERO), ansDne()]),
      internal: { num: num, den: den, at: at, side: null }
    });
  }
};

/* ---------- 6. asíntota vertical ---------- */
GENERATORS["asintote-vertical"] = {
  id: "asintote-vertical",
  title: "Asíntota vertical",
  topic: "sustitucion",
  method: "factorizar",
  difficulty: 3,
  make: function (rand) {
    const r = rand.int(-4, 4);
    const c = r * r * r + r;               // raíz única de x³ + x − c
    const den = Poly.from([-c, 1, 0, 1]);  // x³ + x − c
    const num = rand.pick([
      Poly.quad(1, rand.int(-3, 3), rand.int(-4, 4)),
      Poly.lin(rand.coef(4, true), rand.int(-4, 4)),
      Poly.from([rand.int(-4, 4), rand.int(-3, 3), 0, 1])
    ]);
    /* El numerador NO puede anularse en la raíz: si se anula, no hay asíntota vertical. */
    let guard = 0;
    while (num.eval(Q(r)).isZero() && guard++ < 40) {
      num.coeffs[0] = num.coeffs[0].add(Q.ONE);
    }
    const ans = ansText("x = " + r);
    const otra = -r;

    const pasos = [
      mkStep("Buscar las raíces del denominador",
        "Las asíntotas verticales están donde el denominador se anula y el numerador no. Tenemos que resolver " +
        polyText(den) + " = 0.",
        polyToAST(den), true),
      mkStep("La única raíz real es x = " + r,
        "La derivada de x³ + x es 3x² + 1, que siempre es positiva, así que el polinomio es estrictamente creciente y " +
        "tiene una sola raíz real. Se comprueba sustituyendo: " + r + "³ + " + r + " = " + c + ".",
        AST.num(Q.ZERO)),
      mkStep("La asíntota vertical",
        "Como el numerador vale " + num.eval(Q(r)).toDisplay() + " en ese punto (no se anula), la asíntota vertical es la recta x = " + r + ".",
        AST.sub(AST.x(), AST.num(Q(BigInt(r)))))
    ];

    return buildProblem(this, rand, {
      statement: {
        expr: ratioAST(num, den),
        target: targetPoint(Q(r), null),
        kind: "asyptote",
        question: "¿Cuál es la asíntota vertical de f?"
      },
      answer: ans,
      quiz: quizMC("metodo", "¿Cómo se localiza una asíntota vertical?",
        "Hallando las raíces del denominador y escribiendo x = raíz",
        ["Igualando el numerador y el denominador",
          "Buscando las raíces del numerador",
          "Dividiendo el polinomio entre x − a"],
        rand,
        "Una asíntota vertical aparece donde el denominador se hace cero y el numerador no: " + polyText(den) +
        " = 0 tiene una única raíz real, x = " + r + "."),
      steps: pasos,
      keyStep: 0,
      distractors: dist3(ans, [
        ansText("x = " + otra),
        ansText("y = 0"),
        ansText("x = " + c),
        ansText("x = 0")
      ])
    });
  }
};

/* ---------- 7. en el infinito: término dominante ---------- */
GENERATORS["inf-polinomio"] = {
  id: "inf-polinomio",
  title: "Término dominante de un polinomio",
  topic: "infinito",
  method: "dominantePolinomio",
  difficulty: 2,
  make: function (rand) {
    const deg = rand.int(2, 4);
    const lead = rand.coef(3, true);
    const p = randPoly(rand, deg, lead);
    const sign = rand.pick(["+", "-"]);
    const res = limit.infinity({ num: p, den: Poly.one, sign: sign });
    const ans = ansInf(res.sign);
    const dir = sign === "+" ? "+infinito" : "−infinito";
    const paridad = deg % 2 === 0 ? "par" : "impar";

    const pasos = [
      mkStep("Es un polinomio: manda el término de mayor grado",
        "En " + polyText(p) + " el término dominante es " +
        (lead === 1 ? "x^" + deg : lead === -1 ? "−x^" + deg : lead + "x^" + deg) +
        ", porque es el de mayor exponente.",
        AST.powN(AST.x(), deg), true),
      mkStep("Dividimos entre x^" + deg,
        "Al dividir entre " + (deg === 1 ? "x" : "x^" + deg) + " queda (" + fitText(p, deg) + "): solo sobrevive el término " +
        (lead === 1 ? "1" : (lead === -1 ? "−1" : lead)) +
        ", y los demás se anulan porque 1/x, 1/x²… van a 0.",
        polyToAST(p.scaleToFit(xPow(deg)))),
      mkStep("Signo en " + dir,
        "x^" + deg + " tiende a +infinito siempre, así que el signo lo pone " +
        (lead === 1 ? "el 1" : (lead === -1 ? "el −1" : "el " + lead)) +
        (sign === "-" ? ". Como el grado " + deg + " es " + paridad + ", al ir a −infinito el signo se " + (deg % 2 === 0 ? "mantiene" : "invierte") + "." : "."),
        AST.num(Q(BigInt(lead))))
    ];

    return buildProblem(this, rand, {
      statement: { expr: polyToAST(p), target: targetInf(sign), kind: "limit" },
      answer: ans,
      quiz: quizIndet("no hay indeterminación", rand,
        "No hay cociente: es un polinomio, así que basta con el término de mayor grado, que aquí es " + lead + "x^" + deg + "."),
      steps: pasos,
      keyStep: 0,
      distractors: dist3(ans, [ansInf(-res.sign), ansRational(Q.ZERO), ansDne(), ansRational(Q(BigInt(lead)))]),
      internal: { num: p, den: Poly.one, infSign: sign }
    });
  }
};

/** Polinomio de grado exactamente `deg`, con coeficientes LEADING y aleatorios. */
function randPoly(rand, deg, lead, constLead) {
  const cf = [rand.int(-4, 4), rand.int(-4, 4), rand.int(-4, 4), rand.int(-4, 4)];
  if (lead === undefined) lead = rand.coef(3, constLead !== false);
  switch (deg) {
    case 0: return Poly.constant(cf[0]);
    case 1: return Poly.lin(lead, cf[0]);
    case 2: return Poly.quad(lead, cf[0], cf[1]);
    case 3: return Poly.cubic(lead, cf[0], cf[1], cf[2]);
    default: return Poly.from([cf[0], cf[1], cf[2], cf[3], lead]);
  }
}

/* ---------- 8. en el infinito: grados (∞/∞) ---------- */
GENERATORS["inf-grados"] = {
  id: "inf-grados",
  title: "Comparar grados en el infinito",
  topic: "infinito",
  method: "grados",
  difficulty: 3,
  make: function (rand) {
    const ddeg = rand.int(1, 2);
    const extra = rand.int(1, 2);
    const ndeg = ddeg + extra;
    const num = randPoly(rand, ndeg);
    const den = randPoly(rand, ddeg);
    const sign = rand.pick(["+", "-"]);
    const res = limit.infinity({ num: num, den: den, sign: sign });
    const ans = ansInf(res.sign);
    const ratio = num.leading().div(den.leading());

    const pasos = [
      mkStep("Ambos polinomios crecen: ∞/∞",
        "El numerador es de grado " + ndeg + " y el denominador de grado " + ddeg +
        ". Los dos se van a infinito, así que no basta con sustituir.",
        ratioAST(num, den), true),
      mkStep("Dividimos por la mayor potencia de x",
        "Al dividir numerador y denominador entre x^" + ddeg + " (el grado del denominador) queda (" + fitText(num, ddeg) + ") / (" +
        fitText(den, ddeg) + "): en el numerador sobrevive " + (extra === 1 ? "una x" : "x^" + extra) +
        " y el denominador ya solo tiene constantes.",
        null),
      mkStep("Resultado",
        "x^" + extra + " tiende a " + (sign === "-" && extra % 2 === 1 ? "−infinito" : "+infinito") +
        " y el cociente de principales es " + ratio.toDisplay() + ", así que el límite es " +
        (res.sign > 0 ? "+infinito" : "−infinito") + ".",
        AST.num(ratio))
    ];

    return buildProblem(this, rand, {
      statement: { expr: ratioAST(num, den), target: targetInf(sign), kind: "limit" },
      answer: ans,
      quiz: quizIndet("∞/∞", rand,
        "Numeral y denominador se van a infinito: la indeterminación es ∞/∞ y se resuelve comparando los grados."),
      steps: pasos,
      keyStep: 1,
      distractors: dist3(ans, [
        ansRational(den.leading().div(num.leading())),
        ansInf(-res.sign),
        ansRational(Q.ZERO),
        ansRational(ratio)
      ]),
      internal: { num: num, den: den, infSign: sign }
    });
  }
};

/* ---------- 9. en el infinito: grado menor → 0 ---------- */
GENERATORS["inf-cero"] = {
  id: "inf-cero",
  title: "Grado del numerador menor: límite 0",
  topic: "infinito",
  method: "grados",
  difficulty: 3,
  make: function (rand) {
    const ndeg = rand.int(1, 2);
    const ddeg = ndeg + rand.int(1, 2);
    const num = randPoly(rand, ndeg);
    const den = randPoly(rand, ddeg);
    const sign = rand.pick(["+", "-"]);
    const res = limit.infinity({ num: num, den: den, sign: sign });
    const ans = ansRational(res.value);
    const ratio = num.leading().div(den.leading());

    const pasos = [
      mkStep("Los dos términos se van a infinito: ∞/∞",
        "Grado del numerador: " + ndeg + ". Grado del denominador: " + ddeg + ". Hay que comparar.",
        ratioAST(num, den), true),
      mkStep("Dividimos entre x^" + ndeg,
        "Al dividir entre " + (ndeg === 1 ? "x" : "x^" + ndeg) + " queda (" + fitText(num, ndeg) + ") / (" + fitText(den, ndeg) +
        "): en el numerador solo queda el término constante " + num.leading().toDisplay() +
        " y en el denominador sobrevive el término de mayor grado, x^" + (ddeg - ndeg) +
        ". El denominador se lleva la mano.",
        AST.div(AST.num(Q.ONE), AST.powN(AST.x(), ddeg - ndeg))),
      mkStep("Resultado",
        "El cociente tiende a " + (ddeg - ndeg === 1 ? "1/x" : "1/x^" + (ddeg - ndeg)) + ", y eso tiende a 0. El límite es 0.",
        AST.num(Q.ZERO))
    ];

    return buildProblem(this, rand, {
      statement: { expr: ratioAST(num, den), target: targetInf(sign), kind: "limit" },
      answer: ans,
      quiz: quizIndet("∞/∞", rand,
        "Los dos polinomios se van a infinito: hay una indeterminación ∞/∞ que se resuelve comparando los grados."),
      steps: pasos,
      keyStep: 1,
      distractors: dist3(ans, [ansInf(1), ansInf(-1), ansRational(ratio), ansRational(ratio.mul(Q.minusOne))]),
      internal: { num: num, den: den, infSign: sign }
    });
  }
};

/* ---------- 10. en el infinito: mismos grados ---------- */
GENERATORS["inf-mismo-grado"] = {
  id: "inf-mismo-grado",
  title: "Mismos grados: cociente de principales",
  topic: "infinito",
  method: "grados",
  difficulty: 3,
  make: function (rand) {
    const deg = rand.int(1, 3);
    const num = randPoly(rand, deg, undefined, true);
    const den = randPoly(rand, deg, undefined, true);
    const sign = rand.pick(["+", "-"]);
    const res = limit.infinity({ num: num, den: den, sign: sign });
    const ans = ansRational(res.value);
    const ln = num.leading(), ld = den.leading();

    const pasos = [
      mkStep("Mismo grado: ∞/∞",
        "Numerador y denominador son de grado " + deg + ". Al dividir entre x^" + deg +
        " desaparece la indeterminación.",
        ratioAST(num, den), true),
      mkStep("Dividimos entre x^" + deg,
        "Al dividir entre " + (deg === 1 ? "x" : "x^" + deg) + " queda (" + fitText(num, deg) + ") / (" + fitText(den, deg) +
        "): en ambos queda un coeficiente constante y los demás términos se anulan.",
        AST.div(AST.num(ln), AST.num(ld))),
      mkStep("Resultado",
        "El límite es el cociente de principales " + ln.toDisplay() + " : " + ld.toDisplay() + " = " +
        res.value.toDisplay() + ". Da igual si vamos a +infinito o a −infinito: los grados son los mismos.",
        AST.num(res.value))
    ];

    return buildProblem(this, rand, {
      statement: { expr: ratioAST(num, den), target: targetInf(sign), kind: "limit" },
      answer: ans,
      quiz: quizIndet("∞/∞", rand,
        "Los dos cocientes crecen igual de rápido: hay ∞/∞ y se resuelve con el cociente de los coeficientes principales."),
      steps: pasos,
      keyStep: 1,
      distractors: dist3(ans, [ansRational(ld.div(ln)), ansInf(1), ansRational(Q.ZERO)]),
      internal: { num: num, den: den, infSign: sign }
    });
  }
};

/* ---------- 11. jerarquía de crecimiento ---------- */
GENERATORS["inf-jerarquia"] = {
  id: "inf-jerarquia",
  title: "Jerarquía de crecimiento en el infinito",
  topic: "infinito",
  method: "jerarquia",
  difficulty: 4,
  make: function (rand) {
    const v = rand.int(0, 3);
    const a = rand.int(2, 3);
    const b = rand.int(2, 4);
    let expr, ans, pasos, cands, expl;

    if (v === 0) {
      /* a^x + x^b → +infinito */
      expr = AST.add(AST.powN(AST.num(Q(BigInt(a))), AST.x()), AST.powN(AST.x(), AST.num(Q(BigInt(b)))));
      ans = ansInf(1);
      expl = "Una exponencial de base mayor que 1 crece más rápido que cualquier polinomio, así que el término que manda es " + a + "^x.";
      pasos = [
        mkStep("Comparamos los dos sumandos", "Tenemos una exponencial (" + a + "^x) y un polinomio (x^" + b + "). La exponencial siempre gana a la larga.", expr, true),
        mkStep("Jerarquía de crecimiento", "Exponencial > polinomio > logaritmo > constante. No hace falta saber cuánto vale cada uno.", AST.num(Q.ONE)),
        mkStep("Resultado", "El término dominante es " + a + "^x, así que el límite es +infinito.", AST.num(Q.ONE))
      ];
      cands = [ansInf(-1), ansRational(Q.ZERO), ansDne()];
    } else if (v === 1) {
      /* x^b / e^(c x) → 0 */
      const c = rand.int(1, 3);
      expr = AST.div(AST.powN(AST.x(), AST.num(Q(BigInt(b)))), AST.exp(AST.mul(AST.num(Q(BigInt(c))), AST.x())));
      ans = ansRational(Q.ZERO);
      expl = "El denominador es una exponencial y el numerador un polinomio: en el cociente manda el denominador.";
      pasos = [
        mkStep("Es un cociente ∞/∞", "Arriba hay x^" + b + " y abajo e^(" + c + "x). Los dos se van a infinito.", expr, true),
        mkStep("La exponencial crece más rápido", "La jerarquía es exponencial > polinomio, así que el denominador crece mucho más deprisa que el numerador.", AST.div(AST.powN(AST.x(), AST.num(Q(BigInt(b)))), AST.exp(AST.num(Q(BigInt(c)))))),
        mkStep("Resultado", "El cociente se hace cada vez más pequeño: el límite es 0.", AST.num(Q.ZERO))
      ];
      cands = [ansInf(1), ansInf(-1), ansRational(Q.ONE)];
    } else if (v === 2) {
      /* (1/a)^x → 0 */
      expr = AST.pow(AST.div(AST.num(Q.ONE), AST.num(Q(BigInt(a)))), AST.x());
      ans = ansRational(Q.ZERO);
      expl = "La base 1/" + a + " es menor que 1, así que la exponencia es decreciente y se acerca a 0.";
      pasos = [
        mkStep("Base menor que 1", "La base es 1/" + a + ", que está entre 0 y 1. Al elevado a x, la potencia se hace cada vez más pequeña.", expr, true),
        mkStep("Comportamiento cuando 0 < base < 1", "Si 0 < a < 1, entonces a^x → 0 cuando x → +infinito. Es al revés que con las bases mayores que 1.", AST.num(Q.ZERO)),
        mkStep("Resultado", "El límite es 0.", AST.num(Q.ZERO))
      ];
      cands = [ansInf(1), ansInf(-1), ansRational(Q.ONE)];
    } else {
      /* ln(x)/x^b → 0 */
      expr = AST.div(AST.ln(AST.x()), AST.powN(AST.x(), AST.num(Q(BigInt(b)))));
      ans = ansRational(Q.ZERO);
      expl = "El logaritmo crece más despacio que cualquier potencia de x, así que en el cociente manda el denominador.";
      pasos = [
        mkStep("Es un cociente ∞/∞", "El numerador es un logaritmo y el denominador x^" + b + ". Los dos crecen sin límite.", expr, true),
        mkStep("El logaritmo es el más lento", "Jerarquía: exponencial > polinomio > logaritmo > constante. El polinomio del denominador crece mucho más que ln(x).", AST.div(AST.ln(AST.x()), AST.num(Q.ONE))),
        mkStep("Resultado", "El límite es 0.", AST.num(Q.ZERO))
      ];
      cands = [ansInf(1), ansInf(-1), ansRational(Q.ONE)];
    }

    return buildProblem(this, rand, {
      statement: { expr: expr, target: targetInf("+"), kind: "limit" },
      answer: ans,
      quiz: quizMC("metodo", "¿Cómo se decide cuál de los dos términos manda?",
        "Comparando el crecimiento: exponencial > polinomio > logaritmo > constante",
        ["Sustituyendo x por un número muy grande y calculando",
          "Sumando los valores que toma cada término por separado",
          "Aplicando la fórmula del número e a los dos sumandos"],
        rand, expl),
      steps: pasos,
      keyStep: 0,
      distractors: dist3(ans, cands)
    });
  }
};

/* ---------- 12. asíntota horizontal ---------- */
GENERATORS["inf-horizontal"] = {
  id: "inf-horizontal",
  title: "Asíntota horizontal",
  topic: "infinito",
  method: "grados",
  difficulty: 3,
  make: function (rand) {
    const iguales = rand.bool(0.45);
    const ndeg = rand.int(1, 2);
    const ddeg = iguales ? ndeg : ndeg + rand.int(1, 2);
    const num = randPoly(rand, ndeg, undefined, true);
    const den = randPoly(rand, ddeg, undefined, true);
    const sign = rand.pick(["+", "-"]);
    const res = limit.infinity({ num: num, den: den, sign: sign });
    const valor = res.kind === "finite" ? res.value : Q.ZERO;
    const y = "y = " + valor.toDisplay();
    const ans = ansText(y);

    const pasos = [
      mkStep("La asíntota horizontal es el límite en el infinito",
        "La asíntota horizontal es la recta y = " + valor.toDisplay() + ", es decir el valor del límite cuando x tiende a infinito.",
        AST.div(polyToAST(num), polyToAST(den)), true),
      mkStep("Comparamos los grados",
        "El numerador es de grado " + ndeg + " y el denominador de grado " + ddeg + ". " +
        (iguales
          ? "Tienen el mismo grado, así que el límite es el cociente de los coeficientes principales: " +
            ratioTxt(num.leading(), den.leading()) + "."
          : "El numerador tiene menos grado: al dividir entre x^" + ndeg + " el numerador se queda con una constante y " +
            "el denominador se va a infinito, así que el límite es 0."),
        null),
      mkStep("Resultado",
        "El límite es " + valor.toDisplay() + ", así que la asíntota horizontal es " + y + ".",
        AST.num(valor))
    ];

    const otro = den.leading().div(num.leading());
    return buildProblem(this, rand, {
      statement: {
        expr: ratioAST(num, den),
        target: targetInf(sign),
        kind: "asyptote",
        question: "¿Cuál es la asíntota horizontal de f?"
      },
      answer: ans,
      quiz: quizMC("metodo", "¿Cómo se calcula la asíntota horizontal?",
        "Dividiendo numerador y denominador entre la mayor potencia de x y calculando el límite",
        ["Buscando las raíces del denominador (esas son las verticales)",
          "Sustituyendo x = 0 en la función",
          "Igualando los grados del numerador y del denominador"],
        rand,
        "La asíntota horizontal es el valor del límite en el infinito; aquí sale " + valor.toDisplay() + "."),
      steps: pasos,
      keyStep: 0,
      distractors: dist3(ans, [
        ansText("y = " + otro.toDisplay()),
        ansText(iguales ? "y = 0" : "x = 0"),
        ansText("x = 0"),
        ansText("no tiene asíntota horizontal")
      ]),
      internal: { num: num, den: den, infSign: sign }
    });
  }
};

/* ---------- 13. ∞ − ∞ en cocientes: común denominador ---------- */
GENERATORS["inf-menos-inf-factor"] = {
  id: "inf-menos-inf-factor",
  title: "∞ − ∞: común denominador",
  topic: "indeterminacion",
  method: "restar",
  difficulty: 4,
  make: function (rand) {
    const t = rand.pick([1, 2]);
    const p = rand.int(-4, 4), q = rand.int(-4, 4);
    let c = rand.int(-4, 4), d = rand.int(-3, 3);
    while (c === 0 || d === 0) { c = rand.int(-4, 4); d = rand.int(-3, 3); }
    if (t === 2 && d === c) d = d + 1;
    const A = Poly.quad(1, 0, p);          // x² + p
    const B1 = Poly.lin(1, c);             // x + c
    let num, den, expr, trozo2;
    if (t === 1) {
      const B2 = Poly.quad(1, 0, d);       // x² + d
      const C = Poly.from([Q.ZERO, Q.ZERO, Q.ZERO, Q.ONE]); // x³
      num = A.mul(B2).sub(C.mul(B1));
      den = B1.mul(B2);
      expr = AST.sub(AST.div(A.toAST(), B1.toAST()), AST.div(C.toAST(), B2.toAST()));
      trozo2 = "x³/(x² " + fmtTerm(d).trim() + ")";
    } else {
      const A2 = Poly.quad(1, 0, q);       // x² + q
      const B2 = Poly.lin(1, d);           // x + d
      num = A.mul(B2).sub(A2.mul(B1));
      den = B1.mul(B2);
      expr = AST.sub(AST.div(A.toAST(), B1.toAST()), AST.div(A2.toAST(), B2.toAST()));
      trozo2 = "(x² " + fmtTerm(q).trim() + ")/(x " + fmtTerm(d).trim() + ")";
    }
    const sign = rand.pick(["+", "-"]);
    const res = limit.infinity({ num: num, den: den, sign: sign });
    const ans = ansRational(res.value);
    const mal = t === 1 ? ansRational(Q(BigInt(c))) : ansRational(Q(BigInt(c - d)));
    const trozo1 = "(x² " + fmtTerm(p).trim() + ")/(x " + fmtTerm(c).trim() + ")";

    const pasos = [
      mkStep("Los dos cocientes se van a infinito: ∞ − ∞",
        "No se pueden restar infinitos directamente. Hay que convertirlos en un solo cociente.",
        expr, true),
      mkStep("Ponemos en común denominador",
        "(" + trozo1 + ") − " + trozo2 + ". Multiplicamos el primer cociente por " +
        (t === 1 ? "x² " + fmtTerm(d).trim() : "x " + fmtTerm(d).trim()) +
        " y el segundo por " + linTxt(1, c) + ", y queda " +
        AST.toPlain(AST.div(polyToAST(num), polyToAST(den))) + ".",
        AST.div(polyToAST(num), polyToAST(den))),
      mkStep("Simplificamos y comparamos grados",
        "El cociente se reduce a (" + polyText(num) + ") / (" + polyText(den) + "). Numerador y denominador tienen el mismo grado (" +
        num.degree() + "), así que el límite es el cociente de sus coeficientes principales.",
        AST.div(polyToAST(num.scaleToFit(num)), polyToAST(den.scaleToFit(den)))),
      mkStep("Resultado",
        "El límite es " + res.value.toDisplay() + ". Da igual que vayamos a +infinito o a −infinito.",
        AST.num(res.value))
    ];

    return buildProblem(this, rand, {
      statement: { expr: expr, target: targetInf(sign), kind: "limit" },
      answer: ans,
      quiz: quizIndet("∞−∞", rand,
        "Se restan dos cocientes que se van a infinito: la indeterminación es ∞−∞ y se resuelve poniendo en común denominador."),
      steps: pasos,
      keyStep: 0,
      distractors: dist3(ans, [mal, ansInf(1), ansInf(-1)]),
      internal: { num: num, den: den, infSign: sign }
    });
  }
};

/* ---------- 14. ∞ − ∞ con conjugado ---------- */
GENERATORS["inf-menos-inf-conjugado"] = {
  id: "inf-menos-inf-conjugado",
  title: "∞ − ∞ con raíces: el conjugado",
  topic: "indeterminacion",
  method: "racionalizar",
  difficulty: 4,
  make: function (rand) {
    const t = rand.pick([1, 2]);
    let expr, ans, pasos, cands;
    if (t === 1) {
      const p = rand.int(1, 6), q = rand.int(1, 6);
      const x2 = AST.powN(AST.x(), 2);
      expr = AST.sub(AST.sqrt(AST.sub(x2, AST.num(Q(BigInt(p))))),
        AST.sqrt(AST.add(x2, AST.num(Q(BigInt(q))))));
      ans = ansRational(Q.ZERO);
      const suma = p + q;
      pasos = [
        mkStep("∞ − ∞: no se pueden restar",
          "Las dos raíces se van a infinito y su diferencia no se puede calcular sin más.",
          expr, true),
        mkStep("Multiplicamos por el conjugado",
          "(A − B)(A + B) / (A + B) = (A² − B²)/(A + B) = [(x² − " + p + ") − (x² + " + q + ")] / " +
          "[√(x² − " + p + ") + √(x² + " + q + ")] = −" + suma + " / [√(x² − " + p + ") + √(x² + " + q + ")].",
          AST.div(AST.neg(AST.num(Q(BigInt(suma)))),
            AST.add(AST.sqrt(AST.sub(x2, AST.num(Q(BigInt(p))))), AST.sqrt(AST.add(x2, AST.num(Q(BigInt(q)))))))),
        mkStep("El denominador tiende a infinito",
          "Las dos raíces se van a infinito, así que su suma también. Un número partido por algo que tiende a infinito es 0.",
          AST.num(Q.ZERO)),
        mkStep("Resultado", "El límite es 0.", AST.num(Q.ZERO))
      ];
      cands = [ansRational(Q.ONE), ansRational(Q(BigInt(-suma))), ansInf(1)];
    } else {
      const a = rand.pick([2, -2, 4, -4]);
      const b = rand.int(-4, 4);
      const rad = Poly.quad(1, a, b);
      const radTxt = rad.toString();
      expr = AST.sub(AST.sqrt(rad.toAST()), AST.x());
      ans = ansRational(Q(BigInt(a / 2)));
      pasos = [
        mkStep("∞ − ∞: no se pueden restar",
          "La raíz y el polinomio se van a infinito a la vez, así que no se pueden restar directamente.",
          expr, true),
        mkStep("Multiplicamos por el conjugado",
          "(√(" + radTxt + ") − x) · (√(" + radTxt + ") + x) / (√(" + radTxt + ") + x) = (" + radTxt +
          " − x²) / (√(" + radTxt + ") + x) = (" + (Poly.lin(a, b).toString()) +
          ") / (√(" + radTxt + ") + x).",
          AST.div(AST.add(AST.mul(AST.num(Q(BigInt(a))), AST.x()), AST.num(Q(BigInt(b)))),
            AST.add(AST.sqrt(rad.toAST()), AST.x()))),
        mkStep("Dividimos entre x",
          "Al dividir numerador y denominador entre x, y usando √(" + radTxt + ")/x → 1, queda (" +
          invTxt(a, b) + ") / (1 + 1) = " + a + " / 2 = " + (a / 2) + ".",
          AST.div(AST.num(Q(BigInt(a / 2))), AST.num(Q.TWO))),
        mkStep("Resultado", "El límite es " + (a / 2) + ".", AST.num(Q(BigInt(a / 2))))
      ];
      cands = [ansRational(Q(BigInt(-a / 2))), ansRational(Q(BigInt(a))), ansRational(Q.ONE)];
    }
    const sign = "+";
    return buildProblem(this, rand, {
      statement: { expr: expr, target: targetInf(sign), kind: "limit" },
      answer: ans,
      quiz: quizIndet("∞−∞", rand,
        "Se restan dos expresiones que se van a infinito: la indeterminación es ∞−∞ y se resuelve multiplicando por el conjugado."),
      steps: pasos,
      keyStep: 0,
      distractors: dist3(ans, cands)
    });
  }
};

/* ---------- 15. 0/0 con factores notables ---------- */
GENERATORS["cero-cero-notables"] = {
  id: "cero-cero-notables",
  title: "0/0 con factor notable",
  topic: "indeterminacion",
  method: "factorizar",
  difficulty: 3,
  make: function (rand) {
    const t = rand.pick([1, 2, 3]);
    const a = rand.int(-4, 4);
    const denBase = Poly.lin(1, -a);            // x − a
    /* b nunca puede ser −a: el denominador no debe tener raíz doble */
    let b = rand.nonzero(4);
    if (b === -a) b = (a + 1 <= 4) ? a + 1 : a - 1;
    let num, den, esperado, cands;

    den = denBase;
    if (t === 1) {
      /* (x − a)(x + b) / (x − a)  →  a + b */
      num = Poly.quad(1, b - a, -a * b);
      esperado = Q(BigInt(a + b));
      cands = [ansRational(Q(BigInt(b))), ansRational(Q.ZERO), ansRational(Q(BigInt(a * b)))];
    } else if (t === 2) {
      /* (x − a)(x + c) / (x − a)(x + b)  →  (a + c)/(a + b) */
      const cc = rand.nonzero(4);
      const num1 = Poly.quad(1, cc - a, -a * cc);   // (x − a)(x + c)
      const den1 = Poly.quad(1, b - a, -a * b);    // (x − a)(x + b)
      num = num1;
      den = den1;
      esperado = Q(BigInt(a + cc)).div(Q(BigInt(a + b)));
      cands = [ansRational(Q(BigInt(a + cc))), ansRational(Q.ZERO), ansRational(Q(BigInt(a + cc - a - b)))];
    } else {
      /* (x − a)(x + b)(x + c) / (x − a)  →  (a + b)(a + c) */
      const cc = rand.nonzero(4);
      num = Poly.lin(1, -a).mul(Poly.lin(1, b)).mul(Poly.lin(1, cc));
      esperado = Q(BigInt(a + b)).mul(Q(BigInt(a + cc)));
      cands = [
        ansRational(Q(BigInt(a + b))),
        ansRational(Q(BigInt(a + cc))),
        ansRational(Q.ZERO)
      ];
    }
    const at = Q(a);
    const res = limit.atPoint({ num: num, den: den, at: at, side: null });
    const valor = res.kind === "finite" ? res.value : esperado;

    const pasos = [
      mkStep("Sustituimos y sale 0/0",
        "El numerador vale " + num.eval(at).toDisplay() + " y el denominador vale 0. Aquí no se puede sustituir directamente.",
        AST.div(AST.num(Q.ZERO), AST.num(Q.ZERO)), true),
      mkStep("Factorizamos y cancelamos",
        polyText(num) + " = " + AST.toPlain(factorAST(num)) + " y el denominador es (x − " + at.toDisplay() +
        "). Cancelamos el factor común (x − " + at.toDisplay() + "), que solo vale 0 en el punto y no altera el límite.",
        AST.div(factorAST(num), factorAST(den))),
      mkStep("Sustituimos de nuevo",
        "Ya sin indeterminación: en x = " + at.toDisplay() + " el cociente vale " + valor.toDisplay() + ".",
        AST.num(valor))
    ];

    return buildProblem(this, rand, {
      statement: { expr: ratioAST(num, den), target: targetPoint(at, null), kind: "limit" },
      answer: ansRational(valor),
      quiz: quizIndet("0/0", rand,
        "Al sustituir, numerador y denominador se anulan a la vez: la indeterminación es 0/0. Se factoriza, se cancela (x − " +
        at.toDisplay() + ") y se vuelve a sustituir."),
      steps: pasos,
      keyStep: 1,
      distractors: dist3(ansRational(valor), cands),
      internal: { num: num, den: den, at: at, side: null }
    });
  }
};

/* ---------- 16. 0/0 en un cúbico (Ruffini) ---------- */
GENERATORS["cero-cero-ruffini"] = {
  id: "cero-cero-ruffini",
  title: "0/0 en un cúbico: Ruffini",
  topic: "indeterminacion",
  method: "factorizar",
  difficulty: 4,
  make: function (rand) {
    const ra = [];
    while (ra.length < 3) {
      const v = rand.int(-4, 4);
      if (ra.indexOf(v) < 0) ra.push(v);
    }
    const r1 = ra[0], r2 = ra[1], r3 = ra[2];
    const num = Poly.lin(1, -r1).mul(Poly.lin(1, -r2)).mul(Poly.lin(1, -r3));
    const den = Poly.lin(1, -r2);
    const at = Q(r2);
    const res = limit.atPoint({ num: num, den: den, at: at, side: null });
    const ans = ansRational(res.value);
    const cociente = num.divExact(den);

    const pasos = [
      mkStep("Sustituimos y sale 0/0",
        "El numerador vale 0 en x = " + r2 + " y el denominador también. Hay que factorizar antes de cancelar.",
        AST.div(AST.num(Q.ZERO), AST.num(Q.ZERO)), true),
      mkStep("Síntesis de Ruffini con " + (r2 < 0 ? "(x + " + (-r2) + ")" : "(x − " + r2 + ")"),
        "Al dividir " + polyText(num) + " entre " + (r2 < 0 ? "(x + " + (-r2) + ")" : "(x − " + r2 + ")") +
        " con el teorema del resto sale el cociente " +
        polyText(cociente) + ", y el resto es 0. O sea: " + AST.toPlain(factorAST(num)) + ".",
        AST.div(polyToAST(cociente), AST.num(Q.ONE))),
      mkStep("Factorizamos el cociente",
        "El cociente tiene las raíces " + r1 + " y " + r3 + ": " + polyText(cociente) + " = " +
        AST.toPlain(factorAST(cociente)) + ".",
        factorAST(cociente)),
      mkStep("Cancelamos y sustituimos",
        "Queda " + AST.toPlain(factorAST(cociente)) + ". En x = " + r2 + ": (" + r2 + " − " + r1 + ")(" + r2 + " − " + r3 + ") = " +
        res.value.toDisplay() + ".",
        AST.num(res.value))
    ];

    return buildProblem(this, rand, {
      statement: { expr: ratioAST(num, den), target: targetPoint(at, null), kind: "limit" },
      answer: ans,
      quiz: quizIndet("0/0", rand,
        "Sale 0/0 al sustituir. La técnica es la síntesis de Ruffini: dividir el numerador entre (x − " + r2 + "), cancelar y volver a sustituir."),
      steps: pasos,
      keyStep: 1,
      distractors: dist3(ans, [
        ansRational(Q(BigInt(r2 - r1))),
        ansRational(Q(BigInt(r2 - r3))),
        ansRational(Q.ZERO)
      ]),
      internal: { num: num, den: den, at: at, side: null }
    });
  }
};

/* ---------- 17. 0/0 con factor común repetido ---------- */
GENERATORS["cero-cero-comun"] = {
  id: "cero-cero-comun",
  title: "Factor común en varios sumandos",
  topic: "indeterminacion",
  method: "restar",
  difficulty: 4,
  make: function (rand) {
    const t = rand.pick([1, 2]);
    const a = rand.int(-3, 3);
    const m1 = rand.int(1, 4);
    const m2 = rand.int(1, 4);
    const ans = ansRational(Q(BigInt(m1 + m2)));
    let num, den, expr, pasos;

    if (t === 1) {
      const r = rand.int(1, 3);
      const n1 = Poly.lin(m1, -m1 * a + r);
      const n2 = Poly.lin(m2, -m2 * a - r);
      den = Poly.lin(1, -a);
      num = n1.add(n2);
      expr = AST.add(AST.div(n1.toAST(), den.toAST()), AST.div(n2.toAST(), den.toAST()));
      pasos = [
        mkStep("Cada sumando por separado no tiene límite",
          "El primer sumando tiende a " + (r > 0 ? "+infinito" : "−infinito") + " y el segundo a " + (r > 0 ? "−infinito" : "+infinito") +
          ": tenemos ∞ − ∞ y no se pueden sumar por separado.",
          expr, true),
        mkStep("Ponemos en común denominador",
          "Los dos sumandos comparten el denominador, así que solo hay que sumar los numeradores: [" + polyText(n1) + " + " +
          polyText(n2) + "] / (x − " + a + ") = " + polyText(num) + " / (x − " + a + ") = " + (m1 + m2) + "(x − " + a + ") / (x − " + a + ").",
          AST.div(polyToAST(num), polyToAST(den))),
        mkStep("Cancelamos el factor común",
          "Se cancela (x − " + a + "), que solo vale 0 justo en el punto y por tanto no cambia el límite. Queda la constante " + (m1 + m2) + ".",
          AST.num(Q(BigInt(m1 + m2))))
      ];
    } else {
      const d1 = Poly.lin(1, -a);
      const d2 = Poly.from([a * a, -2 * a, 1]);
      const n1 = Poly.lin(m1, -m1 * a);
      const n2 = d2.scale(Q(BigInt(m2)));
      den = d1.mul(d2);
      num = n1.mul(d2).add(n2.mul(d1));
      expr = AST.add(AST.div(n1.toAST(), d1.toAST()), AST.div(n2.toAST(), d2.toAST()));
      pasos = [
        mkStep("Aparece (x − " + a + ") dos veces",
          "El factor (x − " + a + ") aparece en los dos denominadores, así que está al cuadrado. Cada sumando se va a infinito: ∞ − ∞.",
          expr, true),
        mkStep("Ponemos en común denominador",
          "El denominador común es (x − " + a + ")²: [" + polyText(n1) + "·(x − " + a + ") + " + polyText(n2) +
          "] / (x − " + a + ")² = " + (m1 + m2) + "(x − " + a + ")² / (x − " + a + ")².",
          AST.div(polyToAST(num), polyToAST(den))),
        mkStep("Cancelamos el factor común",
          "Se cancela (x − " + a + ")² y queda la constante " + (m1 + m2) + ".",
          AST.num(Q(BigInt(m1 + m2))))
      ];
    }
    const at = Q(a);
    const res = limit.atPoint({ num: num, den: den, at: at, side: null });
    return buildProblem(this, rand, {
      statement: {
        expr: expr, target: targetPoint(at, null), kind: "limit",
        question: "Calcula el límite del enunciado."
      },
      answer: ans,
      quiz: quizMC("metodo", "¿Qué hay que hacer con esos sumandos?",
        "Poner en común denominador y cancelar el factor (x − " + a + ")",
        ["Sustituir x = " + a + " en cada sumando por separado",
          "Racionalizar cada sumando con su conjugado",
          "Comparar los grados de cada numerador y denominador"],
        rand,
        "Los sumandos se van a infinito por separado (∞ − ∞), pero juntos comparten el factor (x − " + a + "): hay que poner en común denominador y cancelar."),
      steps: pasos,
      keyStep: 0,
      distractors: dist3(ans, [
        ansRational(Q(BigInt(m1))),
        ansRational(Q(BigInt(m2))),
        ansRational(Q.ZERO)
      ]),
      internal: { num: num, den: den, at: at, side: null }
    });
  }
};

/* ---------- 18. 0 · ∞ ---------- */
GENERATORS["cero-por-infinito"] = {
  id: "cero-por-infinito",
  title: "Indeterminación 0 · ∞",
  topic: "indeterminacion",
  method: "transformar",
  difficulty: 4,
  make: function (rand) {
    const v = rand.int(0, 2);
    const p = rand.int(1, 4);
    const q = rand.int(1, 3);
    const r = v + 1;
    const mono = AST.powN(AST.x(), p);
    const expo = AST.neg(AST.mul(AST.num(Q(BigInt(q))), AST.powN(AST.x(), r)));
    const expr = AST.mul(mono, AST.exp(expo));
    const ans = ansRational(Q.ZERO);
    const pasos = [
      mkStep("Una parte se anula y la otra se dispara: 0 · ∞",
        "x^" + p + " se va a infinito y e^(−" + (q === 1 ? "" : q + "·") + "x^" + r +
        ") se anula. Cuidado: 0 · ∞ no se puede resolver multiplicando los dos límites por separado.",
        expr, true),
      mkStep("Lo pasamos a cociente",
        "x^" + p + " · e^(−" + (q === 1 ? "" : q + "·") + "x^" + r + ") = x^" + p + " / e^(" +
        (q === 1 ? "" : q + "·") + "x^" + r + "). Ahora la pregunta es: ¿qué crecimiento manda?",
        AST.div(mono, AST.exp(AST.mul(AST.num(Q(BigInt(q))), AST.powN(AST.x(), r))))),
      mkStep("Comparamos el crecimiento",
        "Una exponencial crece siempre más rápido que cualquier polinomio: e^(" + (q === 1 ? "" : q + "·") +
        "x^" + r + ") supera a x^" + p + " para x grande, así que el denominador se lleva la mano.",
        AST.div(AST.num(Q.ONE), AST.exp(AST.num(Q.ONE)))),
      mkStep("Resultado",
        "El denominador se lleva la mano, así que el cociente (y el producto original) tiende a 0.",
        AST.num(Q.ZERO))
    ];

    return buildProblem(this, rand, {
      statement: { expr: expr, target: targetInf("+"), kind: "limit" },
      answer: ans,
      quiz: quizIndet("0·∞", rand,
        "Un factor tiende a 0 y el otro a infinito: la indeterminación es 0·∞. Se pasa a cociente y se compara el crecimiento."),
      steps: pasos,
      keyStep: 0,
      distractors: dist3(ans, [ansInf(1), ansInf(-1), ansDne()])
    });
  }
};

/* ---------- 19. 1^∞ y el número e ---------- */
GENERATORS["uno-elevado-infinito"] = {
  id: "uno-elevado-infinito",
  title: "Indeterminación 1^∞",
  topic: "indeterminacion",
  method: "numeroE",
  difficulty: 5,
  make: function (rand) {
    let m = rand.pick([1, 2, -1, -2]);
    let pr = rand.int(-3, 3);
    while (pr === 0) pr = rand.int(-3, 3);
    let n = rand.int(-3, 3);
    const q = rand.int(-4, 4);
    const s = rand.int(-4, 4);
    let p = pr + rand.int(-2, 2);
    while (p === pr) p = pr + rand.int(-2, 2) || 1;
    const L = m * (p - pr);
    const numAST = Poly.quad(1, p, q);
    const denAST = Poly.quad(1, pr, s);
    const base = AST.div(numAST.toAST(), denAST.toAST());
    const expo = m === 1 ? AST.add(AST.x(), AST.num(Q(BigInt(n))))
      : (m === -1 ? AST.sub(AST.neg(AST.x()), AST.num(Q(BigInt(n))))
        : AST.add(AST.mul(AST.num(Q(BigInt(m))), AST.x()), AST.num(Q(BigInt(n)))));
    const expr = AST.pow(base, expo);
    const valor = Math.exp(L);
    const ans = ansNumeric(valor);

    const pasos = [
      mkStep("La base tiende a 1 y el exponente a infinito: 1^∞",
        "Al dividir la base entre x² los coeficientes principales se igualan (los dos son 1), así que la base → 1; " +
        "el exponente (" + m + "x " + fmtTerm(n).trim() + ") → " + (m > 0 ? "+infinito" : "−infinito") +
        ". Estamos ante 1^∞ sin más datos: hay que usar la fórmula del número e.",
        expr, true),
      mkStep("Usamos 1^∞ = e^L",
        "Escribimos base = 1 + (base − 1) y usamos (1 + u)^v → e^(v·u) cuando u → 0. " +
        "Entonces L = lim (" + m + "x " + fmtTerm(n).trim() + ") · (base − 1).",
        AST.pow(AST.num(Q.ONE), expo)),
      mkStep("Calculamos base − 1",
        "base − 1 = [" + polyText(numAST) + " − (" + polyText(denAST) + ")] / (" + polyText(denAST) + ") = [" +
        linTxt(p - pr, q - s) + "] / (" + polyText(denAST) + "), y al dividir entre x² queda (" +
        invTxt(p - pr, q - s) + ") / (1 " + (pr === 0 ? "" : fmtSign(pr).replace(/([−+])/, "$1 ") + "/x ") +
        (s === 0 ? "" : fmtSign(s).replace(/([−+])/, "$1 ") + "/x²") + "). Eso tiende a " +
        fmtSign(p - pr) + "/x.",
        AST.div(AST.add(AST.mul(AST.num(Q(BigInt(p - pr))), AST.x()), AST.num(Q(BigInt(q - s)))),
          denAST.toAST())),
      mkStep("Obtenemos L",
        "L = lim (" + m + "x) · " + (p - pr) + "/x = " + m + " · " + (p - pr) + " = " + L + ".",
        AST.num(Q(BigInt(L)))),
      mkStep("Resultado",
        "El límite es e^" + L + " ≈ " + fmtDec(valor) + ".",
        AST.num(Q.fromNumber(round6(valor))))
    ];

    return buildProblem(this, rand, {
      statement: { expr: expr, target: targetInf("+"), kind: "limit" },
      answer: ans,
      quiz: quizIndet("1^∞", rand,
        "La base tiende a 1 y el exponente a infinito: la indeterminación es 1^∞ y se resuelve con la fórmula del número e."),
      steps: pasos,
      keyStep: 0,
      distractors: dist3(ans, [ansNumeric(Math.exp(-L)), ansNumeric(L), ansRational(Q.ONE), ansInf(1)])
    });
  }
};

/* ---------- 20. límites notables ---------- */
GENERATORS["sen-x-partido-x"] = {
  id: "sen-x-partido-x",
  title: "Límites notables del seno",
  topic: "indeterminacion",
  method: "notable",
  difficulty: 4,
  make: function (rand) {
    const v = rand.pick([1, 2, 3, 4]);
    let expr, ans, pasos, cands, nombre;
    const ax = function (k) { return AST.mul(AST.num(Q(BigInt(k))), AST.x()); };

    if (v === 1) {
      const k = rand.int(1, 4);
      expr = AST.div(AST.sin(ax(k)), ax(k));
      ans = ansRational(Q.ONE);
      nombre = "lim sen(kx)/(kx) = 1";
      pasos = [
        mkStep("Sustituimos y sale 0/0", "En x = 0, sen(0) = 0 y el denominador también es 0.", AST.div(AST.num(Q.ZERO), AST.num(Q.ZERO)), true),
        mkStep("Usamos el límite notable", "sen u / u → 1 cuando u → 0. Aquí u = " + k + "x, que también tiende a 0.", expr),
        mkStep("Resultado", "El límite es 1, sea cual sea el valor de " + k + ".", AST.num(Q.ONE))
      ];
    } else if (v === 2) {
      const k = rand.int(1, 3);
      const u = AST.mul(AST.num(Q(BigInt(k))), AST.x());
      expr = AST.div(AST.sub(AST.num(Q.ONE), AST.cos(u)), AST.pow(u, AST.num(Q.TWO)));
      ans = ansRational(new Q(1n, 2n));
      nombre = "lim (1 − cos u)/u² = 1/2";
      pasos = [
        mkStep("Sustituimos y sale 0/0", "En x = 0: 1 − cos(0) = 0 y el denominador 0² = 0.", AST.div(AST.num(Q.ZERO), AST.num(Q.ZERO)), true),
        mkStep("Usamos el límite notable del coseno", "Se sabe que (1 − cos u)/u² → 1/2 cuando u → 0. Con u = " + k + "x → 0 el resultado no cambia.", expr),
        mkStep("Resultado", "El límite es 1/2.", AST.num(new Q(1n, 2n)))
      ];
    } else if (v === 3) {
      const j = rand.int(1, 3);
      const k = rand.int(1, 4);
      const m = j * k;
      expr = AST.div(AST.sin(ax(k)), AST.sin(ax(m)));
      ans = ansRational(Q(BigInt(k)).div(Q(BigInt(m))));
      nombre = "lim sen(kx)/sen(mx) = k/m";
      pasos = [
        mkStep("Sustituimos y sale 0/0", "Los dos senos valen 0 al sustituir x = 0.", AST.div(AST.num(Q.ZERO), AST.num(Q.ZERO)), true),
        mkStep("Dividimos numerador y denominador entre x", "sen(" + k + "x)/sen(" + m + "x) = [sen(" + k + "x)/(" + k + "x)] / [sen(" + m + "x)/(" + m + "x)] · " + k + "/" + m + ". Los dos corchetes valen 1.", expr, true),
        mkStep("Resultado", "Queda " + k + "/" + m + " = " + ans.value.toDisplay() + ".", AST.num(ans.value))
      ];
    } else {
      const k = rand.int(1, 4);
      expr = AST.div(AST.x(), AST.sin(ax(k)));
      ans = ansRational(Q.ONE.div(Q(BigInt(k))));
      nombre = "lim x/sen(kx) = 1/k";
      pasos = [
        mkStep("Sale 0/0 al sustituir", "x = 0 y sen(" + k + "x) = 0.", AST.div(AST.num(Q.ZERO), AST.num(Q.ZERO)), true),
        mkStep("Invertimos el límite notable", "sen u / u → 1, así que u / sen u → 1. Con u = " + k + "x: sen(" + k + "x)/(" + k + "x) → 1 y por tanto x/sen(" + k + "x) = (1/" + k + ")·(" + k + "x)/sen(" + k + "x) → 1/" + k + ".", expr, true),
        mkStep("Resultado", "El límite es 1/" + k + ".", AST.num(ans.value))
      ];
    }

    return buildProblem(this, rand, {
      statement: { expr: expr, target: targetPoint(Q.ZERO, null), kind: "limit" },
      answer: ans,
      quiz: quizMC("metodo", "¿Qué técnica se usa aquí?",
        "Usar un límite notable: sen u / u = 1 (y sus variantes)",
        ["Sustituir directamente los valores de seno y coseno",
          "Racionalizar con el conjugado",
          "Comparar los grados de numerador y denominador"],
        rand,
        "Al sustituir sale 0/0 y la función se anula. Se aplica el límite notable " + nombre + ", que ya está demostrado."),
      steps: pasos,
      keyStep: 1,
      distractors: dist3(ans, [ansRational(Q.ZERO), ansRational(ans.value.mul(Q.TWO)), ansInf(1)])
    });
  }
};

/* ---------- 21. función a trozos: límites laterales ---------- */
/**
 * Construye una función a trozos cuyo punto de unión es `a`.
 * Devuelve el primer trozo (polinomio), el segundo (polinomio o cociente),
 * su texto y el valor del límite por la derecha (todo exacto con Q).
 *
 * @param forzarContinua si es true se busca un segundo trozo que coincida
 *        con el primero en el punto, para que el ejercicio tenga sentido.
 */
function makePieces(rand, a, forzarContinua) {
  const at = Q(a);
  const p1 = Poly.quad(1, rand.int(-3, 3), rand.int(-4, 4));
  const izquierda = p1.eval(at);
  const lder = Poly.lin(1, rand.int(-5, 5));
  const derecha = lder.eval(at);

  if (rand.bool(0.5)) {
    /* Segundo trozo lineal: se elige la pendiente para que cuadre o no. */
    const c = forzarContinua ? derecha.toNumber() : rand.int(-5, 5);
    const m = c - a;
    if (m === 0 || Math.abs(m) > 8) return makePieces(rand, a, forzarContinua);
    const p2 = Poly.lin(m, -m * a + c);
    return {
      p1: p1, ast1: p1.toAST(), ast2: p2.toAST(), texto2: polyText(p2),
      izquierda: izquierda, derecha: p2.eval(at), racional: false
    };
  }

  /* Segundo trozo racional (m·x + n)/(x + w), con w ≠ −a */
  const m = rand.coef(3, true);
  let w = rand.int(-2, 2);
  let intentos = 0;
  while (w === -a && intentos++ < 8) w = rand.int(-2, 2);
  if (w === -a) w = -a + 1;
  /* n se elige para que el cociente valga `objetivo` en x = a */
  const objetivo = forzarContinua ? izquierda : Q(BigInt(rand.int(-4, 4)));
  const n = objetivo.mul(at.add(Q(BigInt(w)))).sub(Q(BigInt(m)).mul(at));
  const num = Poly.lin(m, n);
  const den = Poly.lin(1, w);
  return {
    p1: p1, ast1: p1.toAST(), ast2: AST.div(num.toAST(), den.toAST()),
    texto2: "(" + polyText(num) + ")/" + polyText(den),
    izquierda: izquierda, derecha: num.eval(at).div(den.eval(at)), racional: true
  };
}

GENERATORS["trozos-limites"] = {
  id: "trozos-limites",
  title: "Límites laterales en una función a trozos",
  topic: "continuidad",
  method: "continuidad",
  difficulty: 4,
  make: function (rand) {
    const a = rand.int(-3, 3);
    const piezas = makePieces(rand, a, rand.bool(0.5));
    const at = Q(a);
    const izq = piezas.izquierda, der = piezas.derecha;
    const iguales = izq.eq(der);
    const ans = iguales ? ansRational(izq) : ansDne();

    const pasos = [
      mkStep("Límite por la izquierda (x < " + a + ")",
        "En ese trozo f(x) = " + polyText(piezas.p1) + ", así que el límite por la izquierda es el valor que toma: " + izq.toDisplay() + ".",
        piezas.ast1, true),
      mkStep("Límite por la derecha (x > " + a + ")",
        "En ese trozo f(x) = " + piezas.texto2 + ". El límite por la derecha es el valor de ese trozo en x = " + a + ": " +
        der.toDisplay() + "." + (piezas.racional ? " El denominador no se anula en ese punto." : ""),
        piezas.ast2),
      mkStep("Comparamos los dos laterales",
        iguales
          ? "Los dos laterales valen " + izq.toDisplay() + ", así que el límite en el punto existe y vale " + izq.toDisplay() + "."
          : "El límite por la izquierda es " + izq.toDisplay() + " y por la derecha " + der.toDisplay() +
            ": al no coincidir, el límite en el punto no existe.",
        AST.num(izq))
    ];

    return buildProblem(this, rand, {
      statement: {
        expr: piezas.ast1,
        target: targetPoint(at, null),
        kind: "continuity",
        pieces: [
          { expr: piezas.ast1, cond: "x ≤ " + a, condType: "le" },
          { expr: piezas.ast2, cond: "x > " + a, condType: "gt" }
        ],
        question: "Calcula el límite de f en x = " + a + " (estudia antes los dos laterales)."
      },
      answer: ans,
      quiz: quizMC("metodo", "¿Cómo se calcula el límite en el punto de unión de los trozos?",
        "Calculando el límite de cada trozo por separado y comparando los dos resultados",
        ["Sustituyendo x = " + a + " en la fórmula del primer trozo",
          "Sumando las dos fórmulas de f",
          "Buscando las raíces del numerador del segundo trozo"],
        rand,
        "Cada trozo vale en un entorno del punto, así que el límite por la izquierda sale del primer trozo y el de la derecha del segundo. Si coinciden, el límite existe."),
      steps: pasos,
      keyStep: 2,
      distractors: dist3(ans, [
        ansRational(der),
        ansRational(izq),
        ansRational(izq.add(Q.ONE))
      ]),
      internal: { left: izq, right: der, at: at }
    });
  }
};

/* ---------- 22. función a trozos: continuidad ---------- */
const OPCIONES_CONT = [
  "sí, es continua",
  "no, es discontinua",
  "no existe el límite",
  "no está definida en el punto"
];

GENERATORS["trozos-continua"] = {
  id: "trozos-continua",
  title: "¿Es continua la función a trozos?",
  topic: "continuidad",
  method: "continuidad",
  difficulty: 4,
  make: function (rand) {
    const a = rand.int(-3, 3);
    /* Se reparten los tres casos para que salgan todos:
       continua, discontinuidad removible (valor aparte en el punto) y salto. */
    const tipo = rand.int(0, 2);              // 0 continua · 1 removable · 2 salto
    const tercera = tipo === 1;
    const piezas = makePieces(rand, a, tipo !== 2);
    const izq = piezas.izquierda, der = piezas.derecha;
    let p3 = Poly.constant(Q(BigInt(rand.int(-3, 3))));
    /* queremos un valor en el punto DISTINTO del límite: si coinciden,
       lo corremos una unidad (si no, la función sería continua) */
    if (tercera && p3.eval(Q(a)).eq(izq)) p3 = Poly.constant(p3.eval(Q(a)).add(Q.ONE));
    const f_a = tercera ? p3.eval(Q(a)) : izq;
    let correcta;
    if (tercera) {
      /* Con tercer trozo: salto (no existe el límite) vs removible */
      if (!izq.eq(der)) correcta = 2;
      else if (!izq.eq(f_a)) correcta = 1;
      else correcta = 0;
    } else {
      correcta = izq.eq(der) ? 0 : 2;
    }
    const ans = ansChoice(OPCIONES_CONT, correcta);

    const pasos = [
      mkStep("Primera condición: ¿está definida en x = " + a + "?",
        tercera
          ? "El segundo trozo es solo para x = " + a + ", así que f(" + a + ") = " + f_a.toDisplay() + ". La función sí está definida."
          : "El primer trozo incluye x = " + a + ", así que f(" + a + ") = " + izq.toDisplay() + ". La función está definida.",
        tercera ? p3.toAST() : piezas.ast1, true),
      mkStep("Segunda condición: ¿existe el límite?",
        "Límite por la izquierda: " + izq.toDisplay() + " (primer trozo). Límite por la derecha: " + der.toDisplay() +
        " (segundo trozo). " + (izq.eq(der) ? "Coinciden, así que el límite existe y vale " + izq.toDisplay() + "." : "No coinciden, así que el límite no existe."),
        piezas.ast2),
      mkStep("Tercera condición: ¿el límite vale f(" + a + ")?",
        "f(" + a + ") = " + f_a.toDisplay() + " y el límite " + (izq.eq(der) ? "vale " + izq.toDisplay() : "no existe") + ". " +
        (correcta === 0 ? "Las tres condiciones se cumplen: f es continua."
          : correcta === 1 ? "El límite existe pero no coincide con f(" + a + "): hay una discontinuidad removible."
            : correcta === 2 ? "Como los laterales no coinciden, hay una discontinuidad de salto y el límite no existe."
              : "La función no está definida en el punto, así que no puede ser continua allí."),
        AST.num(f_a))
    ];

    const distractors = [];
    for (let i = 0; i < OPCIONES_CONT.length; i++) {
      if (i !== correcta) distractors.push(ansChoice(OPCIONES_CONT, i));
    }

    return buildProblem(this, rand, {
      statement: {
        expr: piezas.ast1,
        target: targetPoint(Q(a), null),
        kind: "continuity",
        pieces: tercera ? [
          { expr: piezas.ast1, cond: "x < " + a, condType: "lt" },
          { expr: piezas.ast2, cond: "x > " + a, condType: "gt" },
          { expr: p3.toAST(), cond: "x = " + a, condType: "eq" }
        ] : [
          { expr: piezas.ast1, cond: "x ≤ " + a, condType: "le" },
          { expr: piezas.ast2, cond: "x > " + a, condType: "gt" }
        ],
        question: "¿Es f continua en x = " + a + "?"
      },
      answer: ans,
      quiz: quizMC("metodo", "¿Qué hay que comprobar para saber si f es continua?",
        "Que f esté definida en el punto, que el límite exista y que el límite valga f(a)",
        ["Que el límite exista, sin mirar el valor de f(a)",
          "Que f esté definida en el punto, sin mirar el límite",
          "Que las dos fórmulas de los trozos coincidan en todo su tramo"],
        rand,
        "Una función es continua en un punto si se cumplen las tres condiciones: estar definida, que el límite exista y que ese límite sea igual a f(" + a + ")."),
      steps: pasos,
      keyStep: 2,
      distractors: distractors
    });
  }
};

/* ---------- 23. parámetro para que sea continua ---------- */
GENERATORS["trozos-parametro"] = {
  id: "trozos-parametro",
  title: "Hallar el parámetro de continuidad",
  topic: "continuidad",
  method: "continuidad",
  difficulty: 5,
  make: function (rand) {
    const sinSolucion = rand.bool(0.25);
    const a = sinSolucion ? 0 : rand.nonzero(3);
    const pv = rand.coef(4, true);
    const b = rand.int(-4, 4);
    const p1 = Poly.lin(pv, b);
    let m = rand.coef(3, true);
    while (m === pv) m = (m + 1 <= 3 ? m + 1 : m - 1);   /* el 2º trozo no puede ser igual al 1º */
    let ast2, texto2, der;
    if (rand.bool(0.5)) {
      /* segundo trozo lineal: m·x + n, con n elegido para el límite L */
      const L = sinSolucion ? b + rand.nonzero(3) : pv * a + b;
      const p2 = Poly.lin(m, L - m * a);
      ast2 = p2.toAST();
      texto2 = polyText(p2);
      der = Q(BigInt(L));
    } else {
      /* segundo trozo cociente (u·x + v)/(x + w), con el numerador elegido
         para que el cociente valga L en x = a */
      let u = rand.coef(3, true);
      while (u === pv) u = (u + 1 <= 3 ? u + 1 : u - 1);
      let w = rand.int(-2, 2);
      let intentos = 0;
      while (w === -a && intentos++ < 8) w = rand.int(-2, 2);
      if (w === -a) w = -a + 1;
      const L = sinSolucion ? b + rand.nonzero(3) : pv * a + b;
      const num = Poly.lin(u, L * (u * a + w) - u * a * a);
      const den = Poly.lin(1, w);
      ast2 = AST.div(num.toAST(), den.toAST());
      texto2 = "(" + polyText(num) + ")/(" + polyText(den) + ")";
      der = num.eval(Q(a)).div(den.eval(Q(a)));
    }

    const piezas = [
      { expr: p1.toAST(), cond: "x ≤ " + a, condType: "le" },
      { expr: ast2, cond: "x > " + a, condType: "gt" }
    ];

    const pasos = [
      mkStep("Condición de continuidad en el punto de unión",
        "Para que f sea continua en x = " + a + " tiene que cumplirse que el valor del primer trozo, f(" + a +
        "), sea igual al límite del segundo trozo por la derecha.",
        p1.toAST(), true),
      mkStep("El primer trozo da f(" + a + ")",
        "Como " + a + " pertenece al primer trozo, f(" + a + ") = " + pv + "·" + a + " " + fmtTerm(b).trim() +
        " = " + Q(BigInt(pv * a + b)).toDisplay() + ".",
        p1.toAST()),
      mkStep("El segundo trozo da el límite por la derecha",
        "El segundo trozo es " + texto2 + ". Su límite por la derecha en x = " + a + " es " + der.toDisplay() +
        ", y el denominador no se anula en ese punto, así que basta con sustituir.",
        ast2)
    ];

    let ans, cands, detalleFinal;
    if (sinSolucion) {
      ans = ansText("no existe ningún valor de p");
      cands = [ansRational(Q.ZERO), ansRational(Q.ONE), ansRational(Q.minusOne)];
      pasos.push(mkStep("Conclusión",
        "f(" + a + ") = " + b + " no depende de p, pero el límite por la derecha es " + der.toDisplay() +
        ". Son distintos, así que ningún valor de p arregla la discontinuidad: es una discontinuidad de salto.",
        AST.num(Q(BigInt(b)))));
      detalleFinal = "Ningún valor de p hace la función continua: f(0) = " + b + " y el límite por la derecha es " + der.toDisplay() + ".";
    } else {
      const pBuscado = der.sub(Q(BigInt(b))).div(Q(BigInt(a)));   // p = (L − b)/a
      ans = ansRational(pBuscado);
      cands = [ansRational(pBuscado.neg()), ansRational(Q(BigInt(b))), ansRational(Q.ZERO)];
      pasos.push(mkStep("Igualamos y despejamos",
        pv + "·" + a + " " + fmtTerm(b).trim() + " = " + der.toDisplay() + " → " + pv + "·" + a + " = " +
        der.sub(Q(BigInt(b))).toDisplay() + " → p = " + pBuscado.toDisplay() + ".",
        AST.num(pBuscado)));
      detalleFinal = "El único valor que funciona es p = " + pBuscado.toDisplay() + ".";
    }
    return buildProblem(this, rand, {
      statement: {
        expr: p1.toAST(),
        target: targetPoint(Q(a), null),
        kind: "continuity",
        pieces: piezas,
        pieceParams: { p: "p" },
        question: sinSolucion
          ? "¿Existe algún valor de p para que f sea continua en x = " + a + "? Si no existe, di cuál es la discontinuidad."
          : "Calcula el valor de p para que f sea continua en x = " + a + "."
      },
      answer: ans,
      quiz: quizMC("metodo", "¿Qué condición hay que imponer?",
        "Igualar el valor del primer trozo en el punto con el límite del segundo",
        ["Igualar los coeficientes de las dos fórmulas",
          "Hacer que las dos fórmulas coincidan en todo su tramo",
          "Basta con que el denominador del segundo trozo no se anule"],
        rand,
        "La continuidad solo exige que f(" + a + ") (primer trozo) coincida con el límite por la derecha (segundo trozo). " + detalleFinal),
      steps: pasos,
      keyStep: 0,
      distractors: dist3(ans, cands),
      internal: { f_a: Q(BigInt(pv * a + b)), limiteDer: der, at: Q(a), p: Q(BigInt(pv)) }
    });
  }
};/* =====================================================================
 * §8  TÓPICOS, MÉTODOS Y NIVELES
 * ===================================================================== */

Lim.TOPICS = [
  { id: "sustitucion", name: "Sustitución y laterales", color: "--c-sustitucion" },
  { id: "infinito", name: "Límites en el infinito", color: "--c-infinito" },
  { id: "indeterminacion", name: "Indeterminaciones", color: "--c-indet" },
  { id: "continuidad", name: "Continuidad", color: "--c-continuidad" }
];

Lim.METHODS = {
  sustitucion: { name: "Sustitución directa", desc: "Se sustituye y ya está." },
  denominador: { name: "Denominador anulado", desc: "Se anula el denominador: hay que mirar el signo y los lados." },
  lateral: { name: "Límites laterales", desc: "Se estudia por izquierda y por derecha por separado." },
  dominantePolinomio: { name: "Término dominante (polinomio)", desc: "En un polinomio manda el término de mayor grado." },
  jerarquia: { name: "Jerarquía de crecimiento", desc: "Exponencial > Polinómica > Logarítmica > Constante." },
  grados: { name: "Comparar grados", desc: "Se divide numerador y denominador entre x elevado al grado mayor." },
  factorizar: { name: "Factorizar y simplificar", desc: "Indeterminación 0/0: se factoriza y se cancela el factor común." },
  racionalizar: { name: "Racionalizar", desc: "Se multiplica por el conjugado para quitar la raíz del denominador." },
  restar: { name: "Desarrollar la resta", desc: "Indeterminación ∞−∞ en cocientes: común denominador y término dominante." },
  transformar: { name: "Transformar a otra forma", desc: "0·∞ se pasa a 0/0 o a ∞/∞." },
  numeroE: { name: "Fórmula del número e", desc: "1^∞ se resuelve con la fórmula de la e." },
  notable: { name: "Límite notable", desc: "Se usa un límite conocido, como sen x / x = 1." },
  continuidad: { name: "Las tres condiciones", desc: "f definida, límite existente y límite = f(a)." }
};

Lim.LEVELS = [
  { id: "sustituir", n: 1, name: "Sustituir", generators: ["subst-directa"], required: 8, total: 10 },
  { id: "elementos", n: 2, name: "Elementos", generators: ["subst-directa", "subst-elemental"], required: 8, total: 10 },
  { id: "laterales", n: 3, name: "Laterales", generators: ["lateral-signo", "den-anulado", "lateral-dne"], required: 8, total: 10 },
  { id: "asintotas", n: 4, name: "Asíntotas", generators: ["asintote-vertical", "inf-horizontal"], required: 8, total: 10 },
  { id: "polinomios", n: 5, name: "Polinomios en el infinito", generators: ["inf-polinomio", "inf-jerarquia"], required: 8, total: 10 },
  { id: "grados", n: 6, name: "Comparar grados", generators: ["inf-grados", "inf-cero", "inf-mismo-grado"], required: 8, total: 10 },
  { id: "restas", n: 7, name: "Restas de infinitos", generators: ["inf-menos-inf-factor", "inf-menos-inf-conjugado"], required: 8, total: 10 },
  { id: "factores", n: 8, name: "Factorizar", generators: ["cero-cero-notables", "cero-cero-ruffini", "cero-cero-comun"], required: 8, total: 10 },
  { id: "transformar", n: 9, name: "Transformar", generators: ["cero-por-infinito", "uno-elevado-infinito", "sen-x-partido-x"], required: 8, total: 10 },
  { id: "continuidad", n: 10, name: "Continuidad", generators: ["trozos-limites", "trozos-continua", "trozos-parametro"], required: 8, total: 10 }
];

/* =====================================================================
 * §9  API DE ALTO NIVEL
 * ===================================================================== */

Lim.Q = Q;
Lim.Poly = Poly;
Lim.ast = AST;
Lim.limit = limit;
Lim.rng = makeRng;
Lim.GENERATORS = GENERATORS;
Lim.generatorList = function () { return Object.keys(GENERATORS); };
Lim.targetLabel = targetLabel;

/* --- Parser de respuestas del alumno (sin eval ni new Function) --- */

const NUM_RE = /^[-+]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][-+]?\d+)?$/;
const FUNC_NAMES = {
  ln: Math.log, log: Math.log, log10: function (x) { return Math.log(x) / Math.LN10; },
  exp: Math.exp, raiz: Math.sqrt, sqrt: Math.sqrt, raiz2: Math.sqrt,
  cos: Math.cos, coseno: Math.cos, sen: Math.sin, seno: Math.sin, sin: Math.sin,
  tan: Math.tan, tangente: Math.tan, logaritmo: Math.log,
  abs: Math.abs, valorabsoluto: Math.abs
};
const CONST_NAMES = { pi: Math.PI, π: Math.PI, e: Math.E };

/** Normaliza símbolos tipográficos para el análisis de la respuesta. */
function normalizeRaw(s) {
  return String(s)
    .replace(/−/g, "-")     // menos tipográfico
    .replace(/[·⋅×✕]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, "")
    .replace(/\*/g, "*");
}

/** Tokenizador diminuto (números, identificadores, operadores). */
function tokenize(s) {
  const t = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(s[i + 1] || ""))) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      if (s[j] === "e" && /[0-9+\-]/.test(s[j + 1] || "")) {
        j++;
        if (/[+\-]/.test(s[j])) j++;
        while (j < s.length && /[0-9]/.test(s[j])) j++;
      }
      t.push({ t: "num", v: parseFloat(s.slice(i, j).replace(",", ".")) });
      i = j;
      continue;
    }
    if (ch === "√") { t.push({ t: "sqrt" }); i++; continue; }
    if (/[a-zA-Zα-ωπ]/.test(ch)) {
      let j = i;
      while (j < s.length && /[a-zA-Zα-ωπ]/.test(s[j])) j++;
      t.push({ t: "id", v: s.slice(i, j).toLowerCase() });
      i = j;
      continue;
    }
    if ("+-*/^()|,".indexOf(ch) >= 0) { t.push({ t: ch }); i++; continue; }
    return null;
  }
  return t;
}

/** Evalúa una expresión matemática simple. Devuelve NaN si no se puede. */
function evalExpr(src) {
  const toks = tokenize(src);
  if (!toks || !toks.length) return NaN;
  let pos = 0;
  const peek = function () { return toks[pos]; };
  const eat = function (t) { if (toks[pos] && toks[pos].t === t) { pos++; return true; } return false; };

  function parseExpr() {
    let v = parseTerm();
    if (isNaN(v)) return NaN;
    for (;;) {
      if (eat("+")) { const d = parseTerm(); if (isNaN(d)) return NaN; v = v + d; }
      else if (eat("-")) { const d = parseTerm(); if (isNaN(d)) return NaN; v = v - d; }
      else return v;
    }
  }
  function startsFactor() {
    const k = peek();
    return !!k && (k.t === "num" || k.t === "id" || k.t === "(" || k.t === "sqrt");
  }
  function parseTerm() {
    let v = parseFactor();
    if (isNaN(v)) return NaN;
    for (;;) {
      const k = peek();
      if (k && k.t === "*") { pos++; const d = parseFactor(); if (isNaN(d)) return NaN; v = v * d; }
      else if (k && k.t === "/") { pos++; const d = parseFactor(); if (isNaN(d)) return NaN; v = v / d; }
      else if (startsFactor()) { const d = parseFactor(); if (isNaN(d)) return NaN; v = v * d; }
      else return v;
    }
  }
  function parseFactor() {
    const base = parseUnary();
    if (isNaN(base)) return NaN;
    if (peek() && peek().t === "^") {
      pos++;
      const e = parseFactor();               // asociativo por la derecha
      if (isNaN(e)) return NaN;
      return Math.pow(base, e);
    }
    return base;
  }
  function parseUnary() {
    if (eat("-")) { const v = parseUnary(); return isNaN(v) ? NaN : -v; }
    if (eat("+")) return parseUnary();
    return parseAtom();
  }
  function parseAtom() {
    const k = peek();
    if (!k) return NaN;
    if (k.t === "num") { pos++; return k.v; }
    if (k.t === "(") {
      pos++;
      const v = parseExpr();
      if (!eat(")")) return NaN;
      return v;
    }
    if (k.t === "|") {
      pos++;
      const v = parseExpr();
      if (!eat("|")) return NaN;
      return Math.abs(v);
    }
    if (k.t === "sqrt") {
      pos++;
      const v = parseFactor();
      if (isNaN(v)) return NaN;
      return Math.sqrt(v);
    }
    if (k.t === "id") {
      pos++;
      const name = k.v;
      if (FUNC_NAMES[name] && peek() && peek().t === "(") {
        pos++;
        const v = parseExpr();
        if (!eat(")")) return NaN;
        return FUNC_NAMES[name](v);
      }
      if (FUNC_NAMES[name] && peek() && peek().t !== "(" && name !== "e" && name !== "pi") {
        /* sin paréntesis no se admite: "ln2" no es un formato válido */
        return NaN;
      }
      if (name in CONST_NAMES) return CONST_NAMES[name];
      if (name === "e") return Math.E;
      if (FUNC_NAMES[name]) return FUNC_NAMES[name];
      return NaN;
    }
    return NaN;
  }
  const val = parseExpr();
  if (pos !== toks.length) return NaN;
  return val;
}

const DNE_ALIASES = ["noexiste", "dne", "no", "nolimiteexiste", "noexisteellimite", "indefinido"];

/** ¿El texto del alumno significa "no existe"? */
function isDneText(s) {
  const n = normAnswerText(s);
  if (DNE_ALIASES.indexOf(n) >= 0) return true;
  return /^noexiste/.test(n);
}

/** ¿El texto del alumno significa infinito? Devuelve 1, -1 o 0. */
function infiniteSign(s) {
  const n = normAnswerText(s).replace(/infinity|infinito|inf/g, "inf");
  if (/^\+?inf$/.test(n) || n === "+∞" || n === "∞") return 1;
  if (/^-inf$/.test(n) || n === "-∞") return -1;
  return 0;
}

/**
 * Interpreta lo que ha escrito el alumno.
 * → { type: "rational"|"number"|"infinite"|"dne"|"text"|"unknown", ... }
 */
Lim.parseAnswer = function (raw) {
  const s = String(raw === undefined || raw === null ? "" : raw).trim();
  if (!s) return { type: "unknown", raw: s, normalized: "" };

  /* Texto del tipo "x = 3" */
  const eq = /^([a-zA-Z])\s*=\s*(.+)$/.exec(s);
  if (eq) {
    return {
      type: "text",
      value: normAnswerText(eq[1] + "=" + eq[2].trim()),
      raw: s,
      normalized: normAnswerText(eq[1] + "=" + eq[2].trim())
    };
  }

  const sg = infiniteSign(s);
  if (sg !== 0) return { type: "infinite", sign: sg, raw: s, normalized: (sg > 0 ? "+inf" : "-inf") };
  if (isDneText(s)) return { type: "dne", raw: s, normalized: "no existe" };

  const flat = normalizeRaw(s);
  if (!flat) return { type: "unknown", raw: s, normalized: s };

  /* Número simple (entero, decimal o fracción): exacto con Q */
  const fr = /^([-+]?[0-9.,]+)\/([-+]?[0-9.,]+)$/.exec(flat);
  if (fr) {
    const a = parseFloat(fr[1].replace(",", "."));
    const b = parseFloat(fr[2].replace(",", "."));
    if (isFinite(a) && isFinite(b) && b !== 0 && NUM_RE.test(fr[1]) && NUM_RE.test(fr[2])) {
      const q = Q.fromNumber(a).div(Q.fromNumber(b));
      return { type: "rational", q: q, raw: s, normalized: q.toString() };
    }
    return { type: "unknown", raw: s, normalized: s };
  }
  if (NUM_RE.test(flat)) {
    const v = parseFloat(flat.replace(",", "."));
    if (isFinite(v)) {
      const q = Q.fromNumber(v);
      return { type: "rational", q: q, raw: s, normalized: q.toString() };
    }
  }

  const val = evalExpr(flat);
  if (isFinite(val)) return { type: "number", value: val, raw: s, normalized: fmtPlainNumber(val) };
  return { type: "unknown", raw: s, normalized: s };
};

/** Formato numérico corto para mostrar al alumno. */
function fmtPlainNumber(v) {
  if (Number.isInteger(v)) return String(v);
  const r = Number(v.toFixed(6));
  return String(r);
}

/* --- Comprobación de respuestas --- */

const PISTAS = {
  factorizar: "Antes de sustituir hay que factorizar y cancelar el factor (x − a): cancelar un factor que vale 0 en el punto no cambia el límite.",
  grados: "En el infinito manda el término de mayor grado: divide numerador y denominador entre la mayor potencia de x y compara.",
  jerarquia: "Recuerda la jerarquía: exponencial > polinomio > logaritmo > constante.",
  lateral: "Estudia el límite por la izquierda y por la derecha por separado antes de decidir.",
  denominador: "Si el denominador se anula y el numerador no, el resultado no es un número: mira el signo en el lado pedido.",
  racionalizar: "Multiplicar por el conjugado convierte la resta de dos infinitos en un cociente.",
  restar: "Pon en común denominador y quédate con el término de mayor grado.",
  transformar: "Pasa el producto a cociente y compara el crecimiento de exponencial y polinomio.",
  numeroE: "Usa 1^∞ = e^L, con L = lim (exponente) · (base − 1).",
  notable: "Aquí toca un límite notable, no una sustitución.",
  continuidad: "Para la continuidad hay que mirar los dos trozos: el valor en el punto y el límite por cada lado.",
  dominantePolinomio: "En un polinomio sin cociente, manda el término de mayor grado."
};

function pistaFor(problem) {
  return PISTAS[problem && problem.method] ||
    "Repasa el enunciado y comprueba paso a paso si hay que factorizar, comparar grados o estudiar los dos lados.";
}

/** Convierte una Answer en el texto que escribiría el alumno. */
Lim.answerToString = function (answer) {
  if (!answer) return "";
  switch (answer.kind) {
    case "rational": return answer.value.toString();
    case "infinite": return answer.sign > 0 ? "+inf" : "-inf";
    case "dne": return "no existe";
    case "numeric": return fmtPlainNumber(answer.value);
    case "text": return String(answer.value);
    case "choice": return String(answer.options[answer.correct]);
    default: return "";
  }
};

/** Normaliza una etiqueta de opción múltiple para compararla. */
function normLabel(s) {
  let n = normText(s).replace(/\s+/g, "");
  if (/^noexiste/.test(n.replace(/\s+/g, ""))) return "noexiste";
  if (n === "si" || n === "si,escontinua") return "si";
  if (n === "no,esdiscontinua") return "no-discontinua";
  if (n === "noestadefinidaenelpunto" || n === "no,estadefinidaenelpunto") return "nodef";
  return n;
}

Lim.checkQuiz = function (problem, index) {
  if (!problem || !problem.quiz) return false;
  const i = Number(index);
  if (!Number.isInteger(i)) return false;
  return i === problem.quiz.correct;
};

const NO_ENTIENDO = "No entiendo esa respuesta. Escribe un número (3/4, -2, 2,5), +inf, -inf o no existe.";

Lim.checkAnswer = function (problem, raw) {
  const ans = problem && problem.answer;
  if (!ans) return { correct: false, normalized: "", reason: NO_ENTIENDO };
  const s = String(raw === undefined || raw === null ? "" : raw).trim();
  const pista = pistaFor(problem);

  /* --- Opción múltiple: primero se comparan las etiquetas --- */
  if (ans.kind === "choice") {
    const norm = normLabel(s);
    const buscar = function (test) {
      for (let i = 0; i < ans.options.length; i++) {
        if (test(normLabel(ans.options[i]), norm)) return i;
      }
      return -1;
    };
    let hit = buscar(function (a, b) { return a === b; });
    if (hit < 0 && (norm === "si" || norm === "no" || norm === "noexiste")) {
      hit = buscar(function (a, b) { return a.indexOf(norm) === 0 || b.indexOf(a) === 0; });
    }
    if (hit >= 0) {
      const ok = hit === ans.correct;
      return {
        correct: ok,
        normalized: ans.options[hit],
        reason: ok ? undefined : "La respuesta correcta es «" + ans.options[ans.correct] + "». " + pista
      };
    }
    const parsed = Lim.parseAnswer(s);
    if (parsed.type === "unknown") {
      return { correct: false, normalized: s, reason: NO_ENTIENDO };
    }
    return {
      correct: false,
      normalized: parsed.normalized,
      reason: "Marca una de las cuatro opciones. " + pista
    };
  }

  /* --- Respuesta de texto ("x = 3", "y = 0", "no existe ningún p") --- */
  if (ans.kind === "text") {
    const bien = normAnswerText(ans.value);
    const mio = normAnswerText(s);
    if (mio === bien) return { correct: true, normalized: ans.value };
    /* Se admite escribir solo el número: "3" en lugar de "x = 3". */
    if (/^[a-z]+=/.test(bien) && mio === bien.split("=").slice(1).join("=")) {
      return { correct: true, normalized: ans.value };
    }
    if (isDneText(s) && isDneText(ans.value)) {
      return { correct: true, normalized: ans.value };
    }
    return {
      correct: false,
      normalized: mio,
      reason: "Se esperaba «" + ans.value + "». " + pista
    };
  }

  const parsed = Lim.parseAnswer(s);

  if (parsed.type === "unknown") {
    return { correct: false, normalized: s, reason: NO_ENTIENDO };
  }

  /* --- Respuesta racional: comparación exacta (Q.eq) --- */
  if (ans.kind === "rational") {
    const ok = ans.value.toNumber();
    if (parsed.type === "rational") {
      if (parsed.q.eq(ans.value)) return { correct: true, normalized: parsed.q.toString() };
    } else if (parsed.type === "number") {
      if (cerca(parsed.value, ok)) return { correct: true, normalized: fmtPlainNumber(parsed.value) };
    }
    /* Fallback documentado (EXTENSIÓN AL CONTRATO): si el alumno ha escrito
       una aproximación decimal del racional correcto, se acepta. La
       comparación exacta Q.eq sigue siendo la vía principal. */
    if (parsed.type === "rational" || parsed.type === "number") {
      const v = parsed.type === "rational" ? parsed.q.toNumber() : parsed.value;
      if (cerca(v, ok)) {
        return { correct: true, normalized: parsed.q ? parsed.q.toString() : fmtPlainNumber(v) };
      }
    }
    if (parsed.type === "infinite") {
      return {
        correct: false,
        normalized: parsed.normalized,
        reason: "Este límite vale " + ans.value.toDisplay() + ", no infinito. " + pista
      };
    } else if (parsed.type === "dne") {
      return {
        correct: false,
        normalized: parsed.normalized,
        reason: "El límite sí existe y vale " + ans.value.toDisplay() + ". " + pista
      };
    }
    const escrito = parsed.type === "number" ? fmtPlainNumber(parsed.value) : parsed.normalized;
    return {
      correct: false,
      normalized: escrito,
      reason: "Casi: el límite vale " + ans.value.toDisplay() + " y tú has escrito " + escrito + ". " + pista
    };
  }

  /* --- Respuesta numérica (ln, e, coseno…) con tolerancia 1e-6 --- */
  if (ans.kind === "numeric") {
    if (parsed.type === "number" || parsed.type === "rational") {
      const v = parsed.type === "number" ? parsed.value : parsed.q.toNumber();
      if (cerca(v, ans.value)) {
        return { correct: true, normalized: fmtPlainNumber(v) };
      }
      return {
        correct: false,
        normalized: fmtPlainNumber(v),
        reason: "El límite vale " + fmtPlainNumber(ans.value) + " y tú has escrito " + fmtPlainNumber(v) + ". " + pista
      };
    }
    if (parsed.type === "infinite" || parsed.type === "dne") {
      return {
        correct: false,
        normalized: parsed.normalized,
        reason: "Este límite es un número (" + fmtPlainNumber(ans.value) + "), no infinito ni inexistente. " + pista
      };
    }
  }

  /* --- Respuesta infinita --- */
  if (ans.kind === "infinite") {
    if (parsed.type === "infinite") {
      if (parsed.sign === ans.sign) return { correct: true, normalized: parsed.normalized };
      const lado = problem.statement && problem.statement.target && problem.statement.target.side === "-"
        ? " por la izquierda el denominador cambia de signo" : "";
      return {
        correct: false,
        normalized: parsed.normalized,
        reason: "El signo es el contrario: el límite es " + (ans.sign > 0 ? "+infinito" : "−infinito") +
          ", no " + (parsed.sign > 0 ? "+infinito" : "−infinito") + "." + lado + ". " + pista
      };
    }
    if (parsed.type === "dne") {
      return {
        correct: false,
        normalized: parsed.normalized,
        reason: "El límite sí existe y vale " + (ans.sign > 0 ? "+infinito" : "−infinito") + ". " + pista
      };
    }
    return {
      correct: false,
      normalized: parsed.normalized,
      reason: "Aquí el límite no es un número: " + (ans.sign > 0 ? "+infinito" : "−infinito") + ". " + pista
    };
  }

  /* --- Respuesta "no existe" --- */
  if (ans.kind === "dne") {
    if (parsed.type === "dne") return { correct: true, normalized: "no existe" };
    if (parsed.type === "infinite") {
      return {
        correct: false,
        normalized: parsed.normalized,
        reason: "Los dos laterales van a infinitos de distinto signo, por eso el límite no existe. " + pista
      };
    }
    return {
      correct: false,
      normalized: parsed.normalized,
      reason: "Ese es el valor de uno de los laterales; como son distintos, el límite no existe. " + pista
    };
  }

  return { correct: false, normalized: s, reason: NO_ENTIENDO };
};

/** Comparación numérica con tolerancia mixta (relativa 1e-6, absoluta 1e-6). */
function cerca(a, b) {
  if (!isFinite(a) || !isFinite(b)) return false;
  return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
}

/* --- Generar un problema nuevo --- */
let seedCounter = 0;
function nextSeed() {
  seedCounter++;
  return ((Date.now() + seedCounter * 7919) % 2147483647) | 0;
}

Lim.generate = function (opts) {
  opts = opts || {};
  let ids = Lim.generatorList();
  if (opts.generatorIds && opts.generatorIds.length) {
    ids = ids.filter((id) => opts.generatorIds.indexOf(id) >= 0);
  }
  if (opts.topic) ids = ids.filter((id) => GENERATORS[id].topic === opts.topic);
  if (opts.difficultyMin !== undefined && opts.difficultyMin !== null) {
    ids = ids.filter((id) => GENERATORS[id].difficulty >= opts.difficultyMin);
  }
  if (opts.difficultyMax !== undefined && opts.difficultyMax !== null) {
    ids = ids.filter((id) => GENERATORS[id].difficulty <= opts.difficultyMax);
  }
  if (!ids.length) throw new Error("No hay ningún generador con esos filtros.");
  const seed = (opts.seed === undefined || opts.seed === null) ? nextSeed() : (Number(opts.seed) | 0);
  const rand = makeRng(seed);
  const gen = GENERATORS[rand.pick(ids)];
  const problem = gen.make(rand);
  problem.title = gen.title;
  return problem;
};

/* --- Solución en HTML seguro --- */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Lim.solutionHtml = function (problem) {
  if (!problem) return "";
  const steps = problem.steps || [];
  const keyStep = typeof problem.keyStep === "number" ? problem.keyStep : -1;
  let h = '<div class="panel-solution-inner">';
  h += '<div class="sol-head">Solución paso a paso</div>';

  /* Enunciado */
  if (problem.statement) {
    h += '<div class="sol-statement">';
    if (problem.statement.expr) {
      h += '<div class="step-math" aria-label="' + escapeHtml(Lim.targetLabel(problem.statement.target) + " " +
        AST.toPlain(problem.statement.expr)) + '">' +
        AST.toMathMLString(problem.statement.expr) + "</div>";
      h += '<div class="sol-target">' + escapeHtml(Lim.targetLabel(problem.statement.target)) + "</div>";
    }
    if (problem.statement.question) {
      h += '<div class="sol-question">' + escapeHtml(problem.statement.question) + "</div>";
    }
    /* Función a trozos: se listan todos los tramos con su condición */
    if (Array.isArray(problem.statement.pieces)) {
      h += '<div class="sol-pieces"><table class="pieces"><tbody>';
      for (const piece of problem.statement.pieces) {
        h += '<tr><td class="piece-cond">' + escapeHtml(piece.cond) + '</td><td class="piece-expr">' +
          '<span class="step-math" aria-label="' + escapeHtml(AST.toPlain(piece.expr)) + '">' +
          AST.toMathMLString(piece.expr) + "</span></td></tr>";
      }
      h += "</tbody></table></div>";
    }
    h += "</div>";
  }

  /* Pasos */
  h += '<ol class="steps">';
  steps.forEach((step, i) => {
    const isKey = (i === keyStep || step.key === true);
    h += '<li class="step' + (isKey ? " key" : "") + '">';
    h += '<div class="step-n">' + (i + 1) + "</div>";
    h += '<div class="step-body">';
    h += '<div class="step-title">' + escapeHtml(step.title) + "</div>";
    if (step.detail) h += '<div class="step-detail">' + escapeHtml(step.detail) + "</div>";
    if (step.math) {
      h += '<div class="step-math" aria-label="' + escapeHtml(AST.toPlain(step.math)) + '">' +
        AST.toMathMLString(step.math) + "</div>";
    }
    h += "</div></li>";
  });
  h += "</ol>";

  /* Resultado */
  h += '<div class="sol-final">Respuesta: <strong>' +
    escapeHtml(Lim.answerToString(problem.answer)) + "</strong></div>";

  /* Interrogatorio de método */
  if (problem.quiz) {
    h += '<div class="sol-quiz"><div class="sol-quiz-q">' + escapeHtml(problem.quiz.question) + "</div>";
    h += '<div class="sol-quiz-ok">' + escapeHtml(problem.quiz.options[problem.quiz.correct]) + "</div>";
    if (problem.quiz.explain) {
      h += '<div class="sol-quiz-explain">' + escapeHtml(problem.quiz.explain) + "</div>";
    }
    h += "</div>";
  }
  h += "</div>";
  return h;
};

/* =====================================================================
 * EXTENSIÓN AL CONTRATO
 *
 * Todo lo que se lee aquí es ADICIONAL a CONTRACT.md y no cambia ninguna
 * firma ya publicada: `app.js` puede seguir usando el contrato tal cual.
 * ---------------------------------------------------------------------------
 * 1) Answer con kind "numeric"   → { kind:"numeric", value:Number }
 *    Hace falta porque `subst-elemental` y `uno-elevado-infinito` producen
 *    resultados que NO son racionales (ln(2)/2, e^(-2)…). Se comprueba con
 *    tolerancia mixta: |a−b| ≤ 1e-6 · max(1, |b|) (relativa 1e-6 y
 *    absoluta 1e-6 para valores menores que 1). `answerToString` devuelve el
 *    número con 6 decimales, y `checkAnswer` acepta además la forma exacta
 *    ("e", "e^-2", "ln(2)/2"…).
 *
 * 2) `step.key` (boolean) en cada paso, además de `problem.keyStep`.
 *    El paso clave se marca con `class="step key"` en `solutionHtml`.
 *
 * 3) `problem.title` (string) = título legible del generador.
 *
 * 4) `problem.internal` (objeto) con los datos exactos con los que se ha
 *    construido el problema ({num, den, at, side} o {num, den, infSign},
 *    o {left, right, at} / {f_a, limiteDer, p} en continuidad).
 *    Sirve para depurar, para el cuaderno de errores y para comprobar que
 *    la respuesta coincide con el motor de límites. La interfaz no lo usa.
 *
 * 5) `Lim.parseAnswer(raw)` → descriptor de lo que ha escrito el alumno:
 *    { type:"rational", q } | { type:"number", value }
 *    { type:"infinite", sign } | { type:"dne" } | { type:"text", value }
 *    | { type:"unknown" }. Todas incluyen `raw` y `normalized`.
 *    El parser es propio (NO usa eval ni new Function) y entiende
 *    + - * / ^ ^(), números con coma decimal, fracciones "3/4", x,
 *    e, pi, ln(), log(), exp(), sqrt() (también "√"), cos(), sen()/sin(),
 *    tan(), valor absoluto |…|, multiplicación implícita (2x, 3(4), 2e)
 *    y los nombres en español (seno, coseno, logaritmo, tangente…).
 *
 * 6) `Lim.targetLabel(target)` → texto del punto o dirección del límite:
 *    "x → 3", "x → 3⁺", "x → −infinito". Lo usa la interfaz para pintar el
 *    enunciado sin tener que reconstruirlo.
 *
 * 7) `Lim.ast.toMathMLString(node)` → el mismo MathML que `toMathML` pero
 *    como cadena XML (para tests y para `innerHTML` con contenido generado
 *    por nosotros, nunca por el alumno).
 *
 * 8) `Lim.ast.validate(node)` → true si el árbol está bien formado.
 *
 * 9) `ast.x()`, `ast.powN(base, n)`, `ast.lin(m, b)` y `Poly.lin/quad/cubic`
 *    son azúcar sintáctico para los generadores. Los constructores del
 *    contrato (`num`, `var`, `pow`, `add`, `sub`, `mul`, `div`…) aceptan
 *    tanto nodos como `Q`/números y los convierten.
 *
 * 10) `Lim.limit.key(result)`, `Lim.limit.equals(r1, r2)` y
 *     `Lim.limit.describe(result)` (texto en español: "el límite es
 *     +infinito", "el límite no existe") para comparar y pintar resultados.
 *
 * 11) `Lim.limit.rational({num, den, at, side})` es el nombre del contrato;
 *     `Lim.limit.atPoint` es exactamente el mismo método (alias). Con
 *     `side: null` devuelve el límite de los dos lados (dne si difieren),
 *     que es lo que espera la tabla del contrato.
 *     Se añaden además `Lim.limit.key/equals/describe/FINITE/INF/DNE`.
 *
 * 12) `Poly.prototype.isOne`, `Poly.lin/quad/cubic/constant`, `_divLinear`
 *     (división por x−r sin lanzar si el resto no es 0) y
 *     `Poly.prototype.coef(k)` (coeficiente de grado k, 0 si no existe).
 *
 * 13) Tolerancia extra al comparar una respuesta racional: si el alumno
 *     escribe la aproximación decimal del racional correcto (p. ej. 4.333333
 *     para 13/3), se acepta. La vía principal sigue siendo la comparación
 *     EXACTA con Q.eq, tal y como pide el contrato.
 *
 * 14) Clases de `solutionHtml` (además de `.panel-solution` y `.step`):
 *     `.sol-head`, `.sol-statement`, `.sol-target`, `.sol-question`,
 *     `.sol-pieces`, `.pieces`, `.piece-cond`, `.piece-expr`,
 *     `.steps`, `.step-n`, `.step-body`, `.step-title`, `.step-detail`,
 *     `.step-math`, `.sol-final`, `.sol-quiz`, `.sol-quiz-q`,
 *     `.sol-quiz-ok`, `.sol-quiz-explain`. Todas son opcionales para la
 *     interfaz: puede pintar solo el array `steps`.
 *
 * 15) Los quizzes de indeterminación ofreciendo 4 de las 6 etiquetas
 *     ("0/0", "∞/∞", "∞−∞", "0·∞", "1^∞", "no hay indeterminación"):
 *     siempre 4 opciones, como exige el contrato, e incluyendo la correcta.
 *
 * 16) `trozos-continua` responde con las 4 opciones
 *     ["sí, es continua", "no, es discontinua", "no existe el límite",
 *     "no está definida en el punto"]; `checkAnswer` acepta también
 *     "sí"/"no" a secas y "no existe" para la opción del salto.
 * ===================================================================== */

/* =====================================================================
 * EXPORTACIÓN GLOBAL
 * ===================================================================== */
if (typeof window !== "undefined" && window) window.Lim = Lim;
if (typeof module !== "undefined" && module.exports) module.exports = Lim;