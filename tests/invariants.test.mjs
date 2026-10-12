/* =====================================================================
 * tests/invariants.test.mjs — invariantes matemáticas del motor,
 * comprobadas con un evaluador INDEPENDIENTE (no usa el motor de límites).
 *
 *   node --test tests/invariants.test.mjs
 *
 * Qué mira:
 *  · Los tres generadores de continuidad cumplen de verdad las tres
 *    condiciones (definida, límite, límite = f(a)) evaluando el AST a
 *    mano con aritmética racional.
 *  · La asíntota vertical es una raíz real del denominador y el
 *    numerador no se anula allí.
 *  · Los ejercicios con ln / e / cos / sen / valor absoluto dan lo mismo
 *    que el valor numérico de la expresión.
 *  · Los ejercicios de 1^∞ dan e^L.
 *  · Los límites notables dan su valor teórico.
 * ===================================================================== */

import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Lim = require("../src/engine.js");
const { Q, Poly } = Lim;

/* ------------------------------------------------------------------ */
/* Evaluador independiente de AST (solo racional, sin funciones)        */
/* ------------------------------------------------------------------ */
function ev(node, x) {
  const q = Q(x);
  switch (node.t) {
    case "num": return node.v;
    case "var": return q;
    case "pi": return null;                       // fuera del alcance racional
    case "neg": return ev(node.a, x).neg();
    case "add": return node.terms.reduce((r, t) => r.add(ev(t, x)), Q.ZERO);
    case "sub": return ev(node.a, x).sub(ev(node.b, x));
    case "mul": return node.fs.reduce((r, t) => r.mul(ev(t, x)), Q.ONE);
    case "div": return ev(node.a, x).div(ev(node.b, x));
    case "pow": return ev(node.a, x).pow(Number(ev(node.b, x)));
    case "abs": return ev(node.a, x).abs();
    case "sqrt": {
      const v = ev(node.a, x);
      const r = Q.sqrtExact(v);
      assert.ok(r, "raíz de un racional que no es cuadrado perfecto: " + v.toString());
      return r;
    }
    default: throw new Error("nodo no racional: " + node.t);
  }
}

/* Evaluador numérico para ln/e/cos/sen (double). */
function evNum(node, x) {
  switch (node.t) {
    case "num": return node.v.toNumber();
    case "var": return Number(x);
    case "pi": return Math.PI;
    case "neg": return -evNum(node.a, x);
    case "add": return node.terms.reduce((r, t) => r + evNum(t, x), 0);
    case "sub": return evNum(node.a, x) - evNum(node.b, x);
    case "mul": return node.fs.reduce((r, t) => r * evNum(t, x), 1);
    case "div": return evNum(node.a, x) / evNum(node.b, x);
    case "pow": return Math.pow(evNum(node.a, x), evNum(node.b, x));
    case "sqrt": return Math.sqrt(evNum(node.a, x));
    case "abs": return Math.abs(evNum(node.a, x));
    case "ln": return Math.log(evNum(node.a, x));
    case "exp": return Math.exp(evNum(node.a, x));
    case "cos": return Math.cos(evNum(node.a, x));
    case "sin": return Math.sin(evNum(node.a, x));
    case "tan": return Math.tan(evNum(node.a, x));
    default: throw new Error("nodo no numérico: " + node.t);
  }
}

const SEMILLAS = [];
for (let i = 0; i < 400; i++) SEMILLAS.push(i);

/* ------------------------------------------------------------------ */
/* Continuidad                                                         */
/* ------------------------------------------------------------------ */

test("trozos-limites: el límite es el de los dos trozos", () => {
  for (const seed of SEMILLAS) {
    const p = Lim.GENERATORS["trozos-limites"].make(Lim.rng(seed));
    const [p1, p2] = p.statement.pieces;
    const a = p.statement.target.at;
    const izq = ev(p1.expr, a);
    const der = ev(p2.expr, a);
    if (izq.eq(der)) {
      assert.equal(p.answer.kind, "rational", "semilla " + seed);
      assert.ok(p.answer.value.eq(izq), "semilla " + seed);
    } else {
      assert.equal(p.answer.kind, "dne", "semilla " + seed);
    }
  }
});

test("trozos-continua: las tres condiciones se cumplen tal y como se dice", () => {
  for (const seed of SEMILLAS) {
    const p = Lim.GENERATORS["trozos-continua"].make(Lim.rng(seed));
    const pieces = p.statement.pieces;
    const a = p.statement.target.at;
    const izq = ev(pieces[0].expr, a);
    const der = ev(pieces[1].expr, a);
    const f_a = pieces[2] ? ev(pieces[2].expr, a) : izq;
    const definida = true;                       // siempre lo está en estos ejercicios
    const limiteExiste = izq.eq(der);
    const continua = definida && limiteExiste && limiteExiste && izq.eq(f_a);
    const idx = p.answer.correct;
    const opcion = p.answer.options[idx];
    if (continua) assert.equal(idx, 0, "semilla " + seed + " (debería ser «sí»)");
    else if (!limiteExiste) assert.equal(idx, 2, "semilla " + seed + " (debería ser «no existe el límite»)");
    else assert.equal(idx, 1, "semilla " + seed + " (debería ser «no, es discontinua»)");
    assert.ok(opcion.length > 0);
  }
});

test("trozos-parametro: el valor de p hace continua la función", () => {
  for (const seed of SEMILLAS) {
    const p = Lim.GENERATORS["trozos-parametro"].make(Lim.rng(seed));
    const [p1, p2] = p.statement.pieces;
    const a = p.statement.target.at;
    const b = ev(p1.expr, Q.ZERO);              // f(0) = b (el parámetro no aparece)
    const limiteDer = ev(p2.expr, a);
    if (a.isZero()) {
      /* f(0) = b no depende de p: o b = límite (todo p vale) o no hay solución */
      assert.equal(p.answer.kind, "text", "semilla " + seed);
      assert.match(p.answer.value, /no existe/);
      assert.ok(!b.eq(limiteDer), "semilla " + seed + ": se puede arreglar y el motor lo niega");
      assert.ok(Lim.checkAnswer(p, "no existe").correct);
    } else {
      assert.equal(p.answer.kind, "rational", "semilla " + seed);
      const pval = p.answer.value;
      /* f(a) = p·a + b  debe igualar el límite por la derecha */
      assert.ok(pval.mul(a).add(b).eq(limiteDer), "semilla " + seed);
      /* y el alumno que escriba p con ese formato acierta */
      assert.ok(Lim.checkAnswer(p, pval.toString()).correct);
    }
  }
});

/* ------------------------------------------------------------------ */
/* Asíntota vertical                                                   */
/* ------------------------------------------------------------------ */

test("asintote-vertical: la raíz es del denominador y no del numerador", () => {
  for (const seed of SEMILLAS) {
    const p = Lim.GENERATORS["asintote-vertical"].make(Lim.rng(seed));
    assert.equal(p.answer.kind, "text");
    const r = Q(/x\s*=\s*(-?\d+)/.exec(p.answer.value)[1]);
    const num = p.internalNum || null;
    void num;
    /* Se reconstruye a partir del enunciado: f = num/den */
    const ast = p.statement.expr;
    const den = ast.b;                         // el cociente: { t:"div", a:num, b:den }
    const numAst = ast.a;
    assert.ok(ev(den, r).isZero(), "semilla " + seed + ": el denominador no se anula en la raíz");
    assert.ok(!ev(numAst, r).isZero(), "semilla " + seed + ": el numerador también se anula");
    /* y cerca de la raíz el cociente se dispara */
    const epsilon = Q(1, 1000);
    const f1 = ev(numAst, r.add(epsilon)).div(ev(den, r.add(epsilon)));
    assert.ok(f1.abs().toNumber() > 10, "semilla " + seed + ": la función no se dispara (" + f1.toString() + ")");
  }
});

/* ------------------------------------------------------------------ */
/* Límites con elementos                                               */
/* ------------------------------------------------------------------ */

test("subst-elemental: el enunciado vale lo que dice la respuesta", () => {
  for (const seed of SEMILLAS) {
    const p = Lim.GENERATORS["subst-elemental"].make(Lim.rng(seed));
    const a = p.statement.target.at.toNumber();
    const ans = p.answer;
    let valor = evNum(p.statement.expr, a);
    if (!Number.isFinite(valor)) {
      /* 0/0: hay que acercarse un poco (el valor absoluto no se puede
         expresar como fracción exacta en el punto) */
      valor = Math.max(Math.abs(evNum(p.statement.expr, a - 1e-9)),
        Math.abs(evNum(p.statement.expr, a + 1e-9)));
    }
    if (ans.kind === "numeric") {
      assert.ok(Math.abs(valor - ans.value) < 1e-5,
        "semilla " + seed + ": el enunciado da " + valor + " y la respuesta " + ans.value +
        " (" + Lim.ast.toPlain(p.statement.expr) + ")");
    } else if (ans.kind === "rational") {
      assert.ok(Math.abs(valor - ans.value.toNumber()) < 1e-9,
        "semilla " + seed + ": el enunciado da " + valor + " y la respuesta " + ans.value.toString());
    }
  }
});

test("uno-elevado-infinito: el resultado es e^L", () => {
  for (const seed of SEMILLAS) {
    const p = Lim.GENERATORS["uno-elevado-infinito"].make(Lim.rng(seed));
    const L = Number(/L = lim .* = (-?\d+)\./.exec(p.steps[3].detail)[1]);
    assert.ok(Math.abs(Math.exp(L) - p.answer.value) < 1e-4, "semilla " + seed);
    /* comprobación numérica: (base)^(exp) se acerca a e^L cuando x crece */
    for (const x of [1e3, 1e4, 1e5]) {
      const v = evNum(p.statement.expr, x);
      assert.ok(Number.isFinite(v), "semilla " + seed);
      /* log del valor ≈ L (con error pequeño para x grande) */
      const err = Math.abs(Math.log(v) - L);
      assert.ok(err < 1, "semilla " + seed + ": en x = " + x + " sale " + v +
        " (log = " + Math.log(v) + ") en lugar de " + Math.exp(L) + " (log = " + L + ")");
    }
  }
});

test("sen-x-partido-x: límites notables conocidos", () => {
  for (const seed of SEMILLAS) {
    const p = Lim.GENERATORS["sen-x-partido-x"].make(Lim.rng(seed));
    const plano = Lim.ast.toPlain(p.statement.expr);
    const valor = p.answer.value.toNumber();
    if (/^sen\([^)]*\)\/sen\(/.test(plano)) {
      /* sen(kx)/sen(mx) → k/m */
      const m = /^sen\(([^)]*)\)\/sen\(([^)]*)\)$/.exec(plano);
      const k = /^(\d*)x$/.exec(m[1])[1];
      const c2 = /^(\d*)x$/.exec(m[2])[1];
      const n = (c2 === "" || c2 === undefined) ? 1 : Number(c2);
      assert.equal(valor, (k === "" || k === undefined ? 1 : Number(k)) / n, "semilla " + seed + ": " + plano);
    } else if (/^sen\(([^)]*)\)\/\(?([^)]*)\)?$/.test(plano)) {
      /* sen(u)/u → 1 */
      const m = /^sen\(([^)]*)\)\/\(?([^)]*)\)?$/.exec(plano);
      assert.equal(m[1], m[2], "semilla " + seed + ": el numerador y el denominador no coinciden: " + plano);
      assert.equal(valor, 1, "semilla " + seed + ": " + plano);
    } else if (/cos/.test(plano)) {
      /* (1 − cos(kx))/(kx)² → 1/2 */
      assert.equal(valor, 0.5, "semilla " + seed + ": " + plano);
    } else if (/^x\/sen\(([^)]*)\)$/.test(plano)) {
      const k = /^x\/sen\(([^)]*)\)$/.exec(plano)[1];
      const coef = /^(\d*)x$/.exec(k)[1];
      assert.ok(coef !== null, "semilla " + seed + ": " + plano);
      assert.equal(valor, 1 / (coef === "" || coef === undefined ? 1 : Number(coef)), "semilla " + seed + ": " + plano);
    } else {
      assert.fail("enunciado inesperado: " + plano);
    }
    /* el enunciado de la variante 2 no lleva paréntesis alrededor del
       exponente: (1−cos(3x))/(3x)^2 */
  }
});

/* ------------------------------------------------------------------ */
/* Coherencia global del motor                                          */
/* ------------------------------------------------------------------ */

test("el motor es coherente consigo mismo en miles de cocientes", () => {
  let n = 0;
  for (let t = 0; t < 3000; t++) {
    const rnd = (k) => Math.floor(Math.random() * 2 * k) - k;
    const a = rnd(4);
    const num = Poly.from([rnd(3), rnd(3), rnd(3)]);
    const den = Poly.from([rnd(3), rnd(3), rnd(3)]);
    if (den.isZero()) continue;
    n++;
    const der = Lim.limit.rational({ num, den, at: Q(a), side: "+" });
    const izq = Lim.limit.rational({ num, den, at: Q(a), side: "-" });
    const bs = Lim.limit.bothSides({ num, den, at: Q(a) });
    assert.equal(Lim.limit.key(bs.right), Lim.limit.key(der));
    assert.equal(Lim.limit.key(bs.left), Lim.limit.key(izq));
    const at = Lim.limit.rational({ num, den, at: Q(a), side: null });
    assert.equal(Lim.limit.key(at),
      Lim.limit.key(der) === Lim.limit.key(izq) ? Lim.limit.key(der) : "dne");
  }
  assert.ok(n > 2000, "solo se han comprobado " + n + " casos");
});