/* =====================================================================
 * tests/engine.test.mjs — pruebas del motor con node:test
 *
 *   node --test tests/engine.test.mjs
 *
 * El motor es un fichero sin import/export (CommonJS en Node), así que
 * se puede require() directamente.
 * ===================================================================== */

import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Lim = require("../src/engine.js");

const { Q, Poly, ast, limit, rng } = Lim;

/* ------------------------------------------------------------------ */
/* §1  Racionales exactos                                              */
/* ------------------------------------------------------------------ */

test("Q: construcción y normalización", () => {
  assert.equal(Q(3).toString(), "3");
  assert.equal(Q(1n, 2n).toString(), "1/2");
  assert.equal(Q("-3/4").toString(), "-3/4");
  assert.equal(Q(2, -4).toString(), "-1/2");     // el denominador se hace positivo
  assert.equal(Q(6, 8).toString(), "3/4");       // se reduce por el gcd
  assert.equal(Q(-6, -8).toString(), "3/4");
  assert.equal(Q(0, 5).toString(), "0");
  assert.equal(Q(5).n, 5n);
  assert.equal(Q(5).d, 1n);
  assert.equal(Q(1, 2).num(), 1n);
  assert.equal(Q(1, 2).den(), 2n);
});

test("Q: fromNumber es exacto", () => {
  assert.equal(Q.fromNumber(2.5).toString(), "5/2");
  assert.equal(Q.fromNumber(-0.25).toString(), "-1/4");
  assert.equal(Q.fromNumber(3).toString(), "3");
  assert.equal(Q.fromNumber(0.1).toString(), "1/10");
});

test("Q: aritmética exacta", () => {
  const a = Q(3, 4), b = Q(5, 6);
  assert.equal(a.add(b).toString(), "19/12");
  assert.equal(a.sub(b).toString(), "-1/12");
  assert.equal(a.mul(b).toString(), "5/8");
  assert.equal(a.div(b).toString(), "9/10");
  assert.equal(a.neg().toString(), "-3/4");
  assert.equal(a.inv().toString(), "4/3");
  assert.equal(Q(-3, 4).abs().toString(), "3/4");
  assert.equal(a.pow(2).toString(), "9/16");
  assert.equal(a.pow(-1).toString(), "4/3");
  assert.equal(a.toNumber(), 0.75);
  assert.equal(a.toDisplay(), "3/4");
  assert.equal(Q.ZERO.toDisplay(), "0");
});

test("Q: comparaciones y predicados", () => {
  assert.equal(Q(1, 2).cmp(Q(2, 3)), -1);
  assert.equal(Q(2, 3).cmp(Q(1, 2)), 1);
  assert.equal(Q(1, 2).cmp(Q(2, 4)), 0);
  assert.ok(Q(1).lt(Q(2)));
  assert.ok(Q(1).le(Q(1)));
  assert.ok(Q(2).gt(Q(1)));
  assert.ok(Q(2).ge(Q(2)));
  assert.ok(Q(0).isZero());
  assert.ok(Q(3).isPos());
  assert.ok(Q(-3).isNeg());
  assert.ok(Q.ONE.isOne());
  assert.ok(!Q.minusOne.isOne());
});

test("Q: estáticos y división por cero", () => {
  assert.equal(Q.ZERO.toString(), "0");
  assert.equal(Q.ONE.toString(), "1");
  assert.equal(Q.TWO.toString(), "2");
  assert.equal(Q.minusOne.toString(), "-1");
  assert.throws(() => Q.ONE.div(Q.ZERO), /cero/i);
});

/* ------------------------------------------------------------------ */
/* §2  Polinomios                                                       */
/* ------------------------------------------------------------------ */

test("Poly: construcción, grado y coeficientes", () => {
  const p = Poly.from([1, -3, 2]);              // 2x² − 3x + 1
  assert.equal(p.degree(), 2);
  assert.equal(p.coeffs.length, 3);
  assert.ok(p.coeffs[0] instanceof Q);
  assert.equal(p.eval(Q(2)).toString(), "3");
  assert.equal(Poly.from(["1/2", 3]).toString(), "3x+1/2");
  assert.equal(Poly.zero.degree(), -1);
  assert.ok(Poly.zero.isZero());
  assert.equal(Poly.one.toString(), "1");
  assert.equal(Poly.x.toString(), "x");
  assert.equal(Poly.constant(Q(5)).toString(), "5");
  assert.equal(Poly.zero.eval(Q(7)).toString(), "0");
});

test("Poly: deriv, add, sub, mul, scale", () => {
  const p = Poly.quad(1, -3, 2);                 // x² − 3x + 2
  assert.equal(p.deriv().toString(), "2x-3");
  assert.equal(p.deriv().deriv().toString(), "2");
  assert.equal(p.add(Poly.one).toString(), "x^2-3x+3");
  assert.equal(p.add(Poly.x).toString(), "x^2-2x+2");
  assert.equal(p.sub(Poly.x).toString(), "x^2-4x+2");
  assert.equal(p.mul(Poly.x).toString(), "x^3-3x^2+2x");
  assert.equal(p.scale(Q(2)).toString(), "2x^2-6x+4");
  assert.equal(Poly.lin(3, 4).add(Poly.lin(-3, -4)).toString(), "0");
});

test("Poly: divmod y divExact", () => {
  const num = Poly.from([-6, 11, -6, 1]);       // x³ − 6x² + 11x − 6
  const den = Poly.lin(1, -2);                   // x − 2
  const { q, r } = num.divmod(den);
  assert.equal(q.toString(), "x^2-4x+3");
  assert.ok(r.isZero());
  assert.equal(num.divExact(den).toString(), "x^2-4x+3");
  const { q: q2, r: r2 } = num.divmod(Poly.lin(1, -4));   // resto ≠ 0
  assert.ok(!r2.isZero());
  assert.throws(() => num.divExact(Poly.lin(1, -4)), /exacta/i);
});

test("Poly: grados y scaleToFit", () => {
  const a = Poly.from([1, 0, 0, 1]);             // x³ + 1
  const b = Poly.quad(1, 0, 1);                  // x² + 1
  assert.equal(a.degreeDiff(b), 1);
  /* scaleToFit devuelve la parte polinómica de p/x^grado(q2) */
  assert.equal(a.scaleToFit(b).toString(), "x");
  assert.equal(b.scaleToFit(b).toString(), "1");
  assert.equal(a.leading().toString(), "1");
});

test("Poly: factorLinear", () => {
  const p = Poly.from([1, -3, 2]);              // 2x² − 3x + 1 = (2x−1)(x−1)
  assert.equal(p.factorLinear(Q(1)).toString(), "2x-1");
  assert.equal(p.factorLinear(Q(1, 2)).toString(), "2x-2");   // = 2(x−1)
  const q = Poly.from([2, -3, 1]);              // x² − 3x + 2 = (x−1)(x−2)
  assert.equal(q.factorLinear(Q(1)).toString(), "x-2");
  assert.equal(q.factorLinear(Q(2)).toString(), "x-1");
  assert.equal(Poly.from([-6, 11, -6, 1]).factorLinear(Q(2)).toString(), "x^2-4x+3");
  assert.throws(() => p.factorLinear(Q(5)), /no divide/);
});

test("Poly: rationalRoots devuelve raíces simples", () => {
  const p = Poly.from([2, -3, 1]);              // x² − 3x + 2 = (x−1)(x−2)
  assert.deepEqual(p.rationalRoots().map((r) => r.toString()), ["1", "2"]);
  /* (x−2)² tiene una sola raíz racional: 2 */
  assert.deepEqual(Poly.from([4, -4, 1]).rationalRoots().map((r) => r.toString()), ["2"]);
  /* coeficiente principal no mónico: aparece la raíz 1/2 */
  assert.deepEqual(Poly.from([1, -3, 2]).rationalRoots().map((r) => r.toString()), ["1/2", "1"]);
  /* coeficientes racionales: (1/2)x − 1 tiene la raíz 2 */
  assert.deepEqual(Poly.from(["-1", "1/2"]).rationalRoots().map((r) => r.toString()), ["2"]);
  /* polinomio con denominadores y varias raíces: x² − 1/4 */
  assert.deepEqual(Poly.from(["-1/4", 0, 1]).rationalRoots().map((r) => r.toString()), ["-1/2", "1/2"]);
});

test("Poly: factorAll calcula las multiplicidades", () => {
  const p = Poly.from([4, -4, 1]);              // (x−2)²
  const fa = p.factorAll();
  assert.equal(fa.linear.length, 1);
  assert.equal(fa.linear[0].root.toString(), "2");
  assert.equal(fa.linear[0].mult, 2);
  assert.ok(fa.rest.isConstant() && fa.rest.toString() === "1");

  const c = Poly.from([-6, 11, -6, 1]);         // (x−1)(x−2)(x−3)
  const fc = c.factorAll();
  assert.deepEqual(fc.linear.map((l) => l.root.toString() + "^" + l.mult), ["1^1", "2^1", "3^1"]);
  assert.ok(fc.rest.isOne());

  /* raíz doble y otra simple: x³ − 6x² + 9x − 4 = (x−1)²(x−4) */
  const m = Poly.from([-4, 9, -6, 1]);
  const fm = m.factorAll();
  assert.deepEqual(fm.linear.map((l) => l.root.toString() + "^" + l.mult), ["1^2", "4^1"]);
  assert.equal(Poly.lin(1, -1).mul(Poly.lin(1, -1)).mul(Poly.lin(1, -4)).toString(), m.toString());
});

/* ------------------------------------------------------------------ */
/* §3  AST y render                                                     */
/* ------------------------------------------------------------------ */

test("ast: toPlain produce cadenas parseables", () => {
  assert.equal(ast.toPlain(Poly.from([2, -3, 1]).toAST()), "x^2-3x+2");
  assert.equal(ast.toPlain(Poly.from([1, -3, 2]).toAST()), "2x^2-3x+1");
  assert.equal(ast.toPlain(Poly.from([5, 0, 0, 2]).toAST()), "2x^3+5");
  assert.equal(ast.toPlain(ast.div(ast.num(Q(3)), ast.num(Q(4)))), "3/4");
  assert.equal(ast.toPlain(ast.sqrt(ast.var("x"))), "sqrt(x)");
  assert.equal(ast.toPlain(ast.ln(ast.num(Q(2)))), "ln(2)");
  assert.equal(ast.toPlain(ast.exp(ast.num(Q(1)))), "e^(1)");
  assert.equal(ast.toPlain(ast.num(Q(-1, 2))), "-1/2");
  assert.equal(ast.toPlain(ast.mul(ast.num(Q(3)), ast.var("x"))), "3x");
  assert.equal(ast.toPlain(ast.neg(ast.var("x"))), "-x");
  assert.equal(ast.toPlain(ast.pow(ast.div(ast.num(Q(1)), ast.num(Q(4))), ast.var("x"))), "(1/4)^x");
  assert.equal(ast.toPlain(ast.abs(ast.sub(ast.var("x"), ast.num(Q(2))))), "abs(x-2)");
});

test("ast: toLatex y toMathML", () => {
  const f = ast.div(Poly.from([1, -3, 2]).toAST(), Poly.lin(1, -2).toAST());
  assert.equal(ast.toLatex(f), "\\frac{2\\,x^{2} - 3\\,x + 1}{x - 2}");
  const xml = ast.toMathMLString(f);
  assert.ok(xml.startsWith("<math"));
  assert.ok(xml.includes("<mfrac"));
  assert.ok(xml.includes("<msup"));
  assert.ok(xml.includes("<mi>x</mi>"));
  assert.ok(xml.includes("−"));
});

test("ast: toMathML devuelve un elemento con aria-label", () => {
  const f = ast.div(Poly.from([1, -3, 2]).toAST(), Poly.lin(1, -2).toAST());
  const el = ast.toMathML(f);
  assert.equal(el.nodeName, "math");
  assert.equal(el.attributes["aria-label"], ast.toPlain(f));
});

test("ast: equals (estructural, conmutativa)", () => {
  const a = ast.add(ast.mul(ast.num(Q(2)), ast.var("x")), ast.num(Q(1)));
  const b = ast.add(ast.num(Q(1)), ast.mul(ast.num(Q(2)), ast.var("x")));
  assert.ok(ast.equals(a, b));
  assert.ok(ast.equals(ast.mul(ast.num(Q(2)), ast.var("x")), ast.mul(ast.var("x"), ast.num(Q(2)))));
  assert.ok(!ast.equals(a, ast.var("x")));
});

/* ------------------------------------------------------------------ */
/* §4  Motor de límites (tabla del contrato)                            */
/* ------------------------------------------------------------------ */

/* --- atPoint --- */

test("límite: Q(a) ≠ 0 → finito", () => {
  const r = limit.atPoint({ num: Poly.from([1]), den: Poly.from([-2, 1]), at: Q(3), side: null });
  assert.equal(r.kind, "finite");
  assert.equal(r.value.toString(), "1");
});

test("límite: numerador 0 y denominador ≠ 0 → 0", () => {
  const r = limit.atPoint({ num: Poly.zero, den: Poly.lin(1, -1), at: Q(1), side: null });
  /* también cuando el denominador se anula en el punto: 0/(x−1) ≡ 0 */
  assert.equal(r.kind, "finite");
  assert.ok(r.value.isZero());
});

test("límite: 0/0 se resuelve cancelando (x − a)", () => {
  const r = limit.atPoint({
    num: Poly.from([-4, 0, 1]),                  // x² − 4
    den: Poly.lin(1, -2),                       // x − 2
    at: Q(2), side: null
  });
  assert.equal(r.kind, "finite");
  assert.equal(r.value.toString(), "4");
});

test("límite: 0/0 con raíces múltiples en ambos", () => {
  /* (x−2)³ / (x−2)² → 0 */
  const r = limit.atPoint({
    num: Poly.from([-8, 12, -6, 1]),
    den: Poly.from([4, -4, 1]),
    at: Q(2), side: null
  });
  assert.equal(r.kind, "finite");
  assert.ok(r.value.isZero());
  /* (x−2)² / (x−2)³ = 1/(x−2): +∞ por la derecha y −∞ por la izquierda */
  const r2 = limit.atPoint({
    num: Poly.from([4, -4, 1]),
    den: Poly.from([-8, 12, -6, 1]),
    at: Q(2), side: "+"
  });
  assert.equal(r2.kind, "inf");
  assert.equal(r2.sign, 1);
  const r3 = limit.atPoint({
    num: Poly.from([4, -4, 1]),
    den: Poly.from([-8, 12, -6, 1]),
    at: Q(2), side: "-"
  });
  assert.equal(r3.sign, -1);
  /* pero (x−2)² / (x−2) = x−2 → 0 */
  const r4 = limit.atPoint({
    num: Poly.from([4, -4, 1]),
    den: Poly.lin(1, -2),
    at: Q(2), side: null
  });
  assert.equal(r4.kind, "finite");
  assert.ok(r4.value.isZero());
});

test("límite: numerador ≠ 0 y denominador 0 → infinito con el signo del lado", () => {
  const num = Poly.from([2, 1]);                // x + 2
  const den = Poly.from([-1, 1]);               // x − 1
  assert.equal(limit.atPoint({ num, den, at: Q(1), side: "+" }).sign, 1);
  assert.equal(limit.atPoint({ num, den, at: Q(1), side: "-" }).sign, -1);
  /* den = (x−1)² no cambia de signo: +infinito por los dos lados */
  const den2 = Poly.from([1, -2, 1]);
  assert.equal(limit.atPoint({ num, den: den2, at: Q(1), side: "+" }).sign, 1);
  assert.equal(limit.atPoint({ num, den: den2, at: Q(1), side: "-" }).sign, 1);
  /* numerador negativo: −infinito */
  assert.equal(limit.atPoint({ num: Poly.from([-2, -1]), den: den2, at: Q(1), side: "-" }).sign, -1);
});

test("límite: los lados opuestos → no existe", () => {
  const r = limit.bothSides({ num: Poly.from([2, 1]), den: Poly.from([-1, 1]), at: Q(1) });
  assert.equal(r.left.kind, "inf");
  assert.equal(r.left.sign, -1);          // por la izquierda (x−1) < 0
  assert.equal(r.right.kind, "inf");
  assert.equal(r.right.sign, 1);           // por la derecha (x−1) > 0
  assert.equal(r.at.kind, "dne");
  assert.equal(limit.atPoint({ num: Poly.from([2, 1]), den: Poly.from([-1, 1]), at: Q(1), side: null }).kind, "dne");
  /* x → 0⁺ de 1/x es +∞ y x → 0⁻ es −∞ */
  assert.equal(limit.atPoint({ num: Poly.one, den: Poly.x, at: Q.ZERO, side: "+" }).sign, 1);
  assert.equal(limit.atPoint({ num: Poly.one, den: Poly.x, at: Q.ZERO, side: "-" }).sign, -1);
  assert.equal(limit.atPoint({ num: Poly.one, den: Poly.x, at: Q.ZERO, side: null }).kind, "dne");
  /* 1/x²: mismo signo por los dos lados */
  assert.equal(limit.atPoint({ num: Poly.one, den: Poly.from([0, 0, 1]), at: Q.ZERO, side: "-" }).sign, 1);
  assert.equal(limit.atPoint({ num: Poly.one, den: Poly.from([0, 0, 1]), at: Q.ZERO, side: null }).kind, "inf");
});

test("límite: los lados iguales → el mismo valor", () => {
  const r = limit.bothSides({ num: Poly.from([2, 1]), den: Poly.from([1, -2, 1]), at: Q(1) });
  assert.equal(r.at.kind, "inf");
  assert.equal(limit.key(r.left), limit.key(r.right));
});

/* --- infinity --- */

test("límite en el infinito: grado num > grado den → infinito", () => {
  const num = Poly.from([1, 0, 0, 1]);          // x³ + 1
  const den = Poly.from([-1, 0, 1]);            // x² − 1
  const r = limit.infinity({ num, den, sign: "+" });
  assert.equal(r.kind, "inf");
  assert.equal(r.sign, 1);
  /* coeficiente principal negativo → −infinito */
  const r2 = limit.infinity({ num: Poly.from([1, 0, 0, -1]), den, sign: "+" });
  assert.equal(r2.sign, -1);
});

test("límite en el infinito: grado num < grado den → 0", () => {
  const r = limit.infinity({ num: Poly.from([1, 1]), den: Poly.from([1, 0, 0, 1]), sign: "+" });
  assert.equal(r.kind, "finite");
  assert.ok(r.value.isZero());
});

test("límite en el infinito: grados iguales → cociente de principales", () => {
  const r = limit.infinity({ num: Poly.from([-1, 0, 2]), den: Poly.from([1, 0, 1]), sign: "+" });
  assert.equal(r.kind, "finite");
  assert.equal(r.value.toString(), "2");
});

test("límite en −∞ con grado IMPAR: el signo se invierte", () => {
  const num = Poly.from([1, 0, 0, 1]);          // x³ + 1
  /* divided entre 1: el cociente es un polinomio de grado 3 → en −∞ el signo se invierte */
  assert.equal(limit.infinity({ num, den: Poly.from([1]), sign: "+" }).sign, 1);
  assert.equal(limit.infinity({ num, den: Poly.from([1]), sign: "-" }).sign, -1);
  /* (x³+1)/(x+1) ~ x²: el grado efectivo es 2 (par) → el signo se mantiene */
  const den2 = Poly.from([1, 1]);               // x + 1
  assert.equal(limit.infinity({ num, den: den2, sign: "-" }).sign, 1);
  /* (x³+1)/(x) ~ x² → par, se mantiene */
  assert.equal(limit.infinity({ num, den: Poly.x, sign: "-" }).sign, 1);
  /* (x³+1)/(x²) ~ x → impar, se invierte */
  assert.equal(limit.infinity({ num, den: Poly.from([0, 0, 1]), sign: "-" }).sign, -1);
});

test("límite en −∞ con grado PAR: el signo se mantiene", () => {
  const num = Poly.from([1, 0, 1]);             // x² + 1 (grado par)
  const den = Poly.from([1]);
  assert.equal(limit.infinity({ num, den, sign: "+" }).sign, 1);
  assert.equal(limit.infinity({ num, den, sign: "-" }).sign, 1);   // grado 2, par
  /* coeficiente principal negativo */
  const num2 = Poly.from([-1, 0, -1]);
  assert.equal(limit.infinity({ num: num2, den, sign: "+" }).sign, -1);
  assert.equal(limit.infinity({ num: num2, den, sign: "-" }).sign, -1);
});

test("límite en el infinito: numerador constante y denominador no → 0", () => {
  const r = limit.infinity({ num: Poly.constant(Q(7)), den: Poly.from([0, 0, 0, 1]), sign: "+" });
  assert.equal(r.kind, "finite");
  assert.ok(r.value.isZero());
});

/* ------------------------------------------------------------------ */
/* §5  RNG determinista                                                 */
/* ------------------------------------------------------------------ */

test("rng: es determinista con la misma semilla", () => {
  const a = rng(1234), b = rng(1234);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
  assert.equal(rng(1).int(1, 6), rng(1).int(1, 6));
});

test("rng: int es inclusivo, pick y shuffle", () => {
  const r = rng(99);
  const vistos = new Set();
  for (let i = 0; i < 400; i++) {
    const v = r.int(2, 4);
    assert.ok(v >= 2 && v <= 4 && Number.isInteger(v));
    vistos.add(v);
  }
  assert.deepEqual([...vistos].sort(), [2, 3, 4]);
  const arr = [1, 2, 3, 4, 5];
  const bar = r.shuffle(arr);
  assert.deepEqual(arr, [1, 2, 3, 4, 5]);       // devuelve una copia
  assert.deepEqual([...bar].sort((a, b) => a - b), arr);
  assert.ok([1, 2, 3].includes(r.pick([1, 2, 3])));
  assert.equal(typeof r.bool(), "boolean");
  assert.equal(typeof r.bool(1), "boolean");
});

/* ------------------------------------------------------------------ */
/* §6 §7 §8  Generadores                                                */
/* ------------------------------------------------------------------ */

const ESPERADOS = [
  "subst-directa", "subst-elemental", "lateral-signo", "lateral-dne",
  "den-anulado", "asintote-vertical", "inf-polinomio", "inf-grados",
  "inf-cero", "inf-mismo-grado", "inf-jerarquia", "inf-horizontal",
  "inf-menos-inf-factor", "inf-menos-inf-conjugado", "cero-cero-notables",
  "cero-cero-ruffini", "cero-cero-comun", "cero-por-infinito",
  "uno-elevado-infinito", "sen-x-partido-x", "trozos-limites",
  "trozos-continua", "trozos-parametro"
];

test("hay exactamente 23 generadores con los ids del contrato", () => {
  assert.equal(Lim.generatorList().length, 23);
  assert.deepEqual([...Lim.generatorList()].sort(), [...ESPERADOS].sort());
});

test("cada generador cumple el contrato", () => {
  const topics = Lim.TOPICS.map((t) => t.id);
  for (const id of Lim.generatorList()) {
    const g = Lim.GENERATORS[id];
    assert.equal(g.id, id);
    assert.ok(topics.includes(g.topic), id + " topic");
    assert.ok(Lim.METHODS[g.method], id + " method");
    assert.ok(g.difficulty >= 1 && g.difficulty <= 5, id + " dificultad");
    assert.equal(typeof g.title, "string");
    assert.equal(typeof g.make, "function");
  }
});

test("los 23 generan un problema bien formado (varias semillas)", () => {
  for (const id of Lim.generatorList()) {
    for (const seed of [1, 2, 3, 17, 99, 1234]) {
      const p = Lim.GENERATORS[id].make(rng(seed));
      assert.equal(p.generatorId, id, id);
      assert.equal(p.seed, seed, id);
      assert.equal(p.id, id + "-" + seed, id);
      assert.ok(ast.validate(p.statement.expr), id + " expr válida " + seed);
      assert.ok(p.statement.target, id);
      assert.ok(["limit", "continuity", "asyptote"].includes(p.statement.kind), id + " kind");
      assert.ok(p.answer && p.answer.kind, id + " answer");
      assert.ok(p.quiz, id + " quiz");
      assert.equal(p.quiz.options.length, 4, id + " 4 opciones");
      assert.ok(p.quiz.correct >= 0 && p.quiz.correct < 4, id + " correct");
      assert.equal(new Set(p.quiz.options).size, 4, id + " opciones distintas");
      assert.ok(p.quiz.explain.length > 10, id + " explain");
      assert.ok(Array.isArray(p.steps) && p.steps.length >= 2 && p.steps.length <= 5, id + " pasos " + p.steps.length);
      assert.ok(p.steps.every((s) => s.title && s.detail), id + " pasos con texto");
      assert.ok(p.keyStep >= 0 && p.keyStep < p.steps.length, id + " keyStep");
      assert.ok(p.steps.some((s) => s.key === true) || p.keyStep >= 0, id + " paso clave");
      assert.equal(p.distractors.length, 3, id + " distractores");
      const key = (a) => JSON.stringify(a);
      assert.equal(new Set(p.distractors.map(key)).size, 3, id + " distractores distintos");
      assert.ok(!p.distractors.some((d) => Lim.checkAnswer(p, Lim.answerToString(d)).correct),
        id + " ningún distractor debe ser correcto");
    }
  }
});

test("los generadores son deterministas", () => {
  for (const id of Lim.generatorList()) {
    const a = Lim.GENERATORS[id].make(rng(555));
    const b = Lim.GENERATORS[id].make(rng(555));
    assert.equal(JSON.stringify(a), JSON.stringify(b), id);
    const c = Lim.GENERATORS[id].make(rng(556));
    assert.ok(typeof JSON.stringify(c) === "string");
  }
});

test("la respuesta canónica siempre se acepta", () => {
  for (const id of Lim.generatorList()) {
    for (const seed of [7, 42, 1000]) {
      const p = Lim.GENERATORS[id].make(rng(seed));
      const r = Lim.checkAnswer(p, Lim.answerToString(p.answer));
      assert.ok(r.correct, id + " semilla " + seed + ": " + r.reason);
    }
  }
});

test("las respuestas coinciden con el motor de límites", () => {
  for (const id of Lim.generatorList()) {
    for (const seed of [5, 11, 77, 123, 999]) {
      const p = Lim.GENERATORS[id].make(rng(seed));
      const it = p.internal;
      if (!it || !it.num) continue;
      let res;
      if (it.infSign) res = limit.infinity({ num: it.num, den: it.den, sign: it.infSign });
      else res = limit.atPoint({ num: it.num, den: it.den, at: it.at, side: it.side || null });
      const a = p.answer;
      if (a.kind === "rational" && res.kind === "finite") {
        assert.ok(a.value.eq(res.value), id + ": motor " + res.value.toString() + " vs respuesta " + a.value.toString());
      } else if (a.kind === "infinite" && res.kind === "inf") {
        assert.equal(a.sign, res.sign, id);
      } else if (a.kind === "dne") {
        assert.equal(res.kind, "dne", id);
      }
    }
  }
});

test("generate: filtra por id, topic y dificultad y usa la semilla", () => {
  const p = Lim.generate({ seed: 4242, generatorIds: ["inf-cero"] });
  assert.equal(p.generatorId, "inf-cero");
  assert.equal(p.seed, 4242);
  assert.equal(JSON.stringify(p), JSON.stringify(Lim.generate({ seed: 4242, generatorIds: ["inf-cero"] })));

  assert.equal(Lim.generate({ seed: 1, topic: "continuidad" }).topic, "continuidad");
  assert.equal(Lim.generate({ seed: 1, difficultyMin: 5 }).difficulty, 5);
  const p3 = Lim.generate({ seed: 2, difficultyMin: 1, difficultyMax: 2 });
  assert.ok(p3.difficulty >= 1 && p3.difficulty <= 2);
  assert.throws(() => Lim.generate({ topic: "no-existe" }));
});

test("niveles: 10 niveles con generadores válidos", () => {
  assert.equal(Lim.LEVELS.length, 10);
  const ids = Lim.generatorList();
  for (const lv of Lim.LEVELS) {
    assert.ok(lv.generators.length > 0);
    for (const g of lv.generators) assert.ok(ids.includes(g), g);
  }
});

/* ------------------------------------------------------------------ */
/* §9  API de alto nivel                                                */
/* ------------------------------------------------------------------ */

test("checkAnswer: formas de respuesta del contrato", () => {
  const rat = { answer: { kind: "rational", value: Q(3, 4) } };
  for (const raw of ["3/4", "3 / 4", "3 /4", "0,75", "0.75"]) {
    assert.ok(Lim.checkAnswer(rat, raw).correct, raw);
  }
  assert.ok(!Lim.checkAnswer(rat, "4/3").correct);
  assert.ok(!Lim.checkAnswer(rat, "2").correct);

  const neg = { answer: { kind: "rational", value: Q(-2) } };
  assert.ok(Lim.checkAnswer(neg, "-2").correct);
  assert.ok(Lim.checkAnswer(neg, " - 2 ").correct);

  const inf = { answer: { kind: "infinite", sign: 1 } };
  for (const raw of ["+infinity", "infinity", "inf", "+inf", "+∞", "∞", "infinito", "+infinito"]) {
    assert.ok(Lim.checkAnswer(inf, raw).correct, raw);
  }
  assert.ok(!Lim.checkAnswer(inf, "-inf").correct);
  assert.ok(!Lim.checkAnswer(inf, "3/4").correct);
  assert.ok(Lim.checkAnswer(inf, "-inf").reason.length > 20);

  const ninf = { answer: { kind: "infinite", sign: -1 } };
  for (const raw of ["-infinity", "-inf", "-∞", "−inf", "-infinito"]) {
    assert.ok(Lim.checkAnswer(ninf, raw).correct, raw);
  }

  const dne = { answer: { kind: "dne" } };
  for (const raw of ["no existe", "noexiste", "dne", "no", "NO EXISTE"]) {
    assert.ok(Lim.checkAnswer(dne, raw).correct, raw);
  }
  assert.ok(!Lim.checkAnswer(dne, "3").correct);
  assert.ok(!Lim.checkAnswer(dne, "+inf").correct);

  const num = { answer: { kind: "numeric", value: Math.E } };
  assert.ok(Lim.checkAnswer(num, "2.71828").correct);
  assert.ok(Lim.checkAnswer(num, "e").correct);
  assert.ok(Lim.checkAnswer(num, "2,71828").correct);
  assert.ok(Lim.checkAnswer(num, "Math.E").correct === false);

  const txt = { answer: { kind: "text", value: "x = 3" } };
  assert.ok(Lim.checkAnswer(txt, "x = 3").correct);
  assert.ok(Lim.checkAnswer(txt, "x=3").correct);
  assert.ok(Lim.checkAnswer(txt, "3").correct);
  assert.ok(!Lim.checkAnswer(txt, "x = 4").correct);

  const ch = {
    answer: { kind: "choice", options: ["sí, es continua", "no, es discontinua", "no existe el límite", "no está definida en el punto"], correct: 2 }
  };
  assert.ok(Lim.checkAnswer(ch, "no existe el límite").correct);
  assert.ok(Lim.checkAnswer(ch, "no existe").correct);
  assert.ok(Lim.checkAnswer(ch, "noexisteellimite").correct);
  assert.ok(Lim.checkAnswer(ch, "sí, es continua").correct === false);
});

test("checkAnswer: mensaje de error para lo que no se entiende", () => {
  const p = { answer: { kind: "rational", value: Q(2) }, method: "factorizar" };
  const r = Lim.checkAnswer(p, "no tengo idea");
  assert.equal(r.correct, false);
  assert.ok(/No entiendo/.test(r.reason));
});

test("checkAnswer: los fallos explican el porqué (tono didáctico)", () => {
  const p = {
    method: "factorizar",
    answer: { kind: "rational", value: Q(4) },
    statement: { target: { type: "point", at: Q(2), side: null } }
  };
  const r = Lim.checkAnswer(p, "3");
  assert.equal(r.correct, false);
  assert.ok(/factorizar/i.test(r.reason), r.reason);
  assert.ok(/4/.test(r.reason));
});

test("answerToString", () => {
  assert.equal(Lim.answerToString({ kind: "rational", value: Q(3, 4) }), "3/4");
  assert.equal(Lim.answerToString({ kind: "rational", value: Q(-2) }), "-2");
  assert.equal(Lim.answerToString({ kind: "rational", value: Q.ZERO }), "0");
  assert.equal(Lim.answerToString({ kind: "infinite", sign: 1 }), "+inf");
  assert.equal(Lim.answerToString({ kind: "infinite", sign: -1 }), "-inf");
  assert.equal(Lim.answerToString({ kind: "dne" }), "no existe");
  assert.equal(Lim.answerToString({ kind: "text", value: "x = 3" }), "x = 3");
  assert.equal(Lim.answerToString({ kind: "numeric", value: 2.5 }), "2.5");
});

test("checkQuiz", () => {
  const p = Lim.GENERATORS["cero-cero-notables"].make(rng(3));
  assert.equal(Lim.checkQuiz(p, p.quiz.correct), true);
  assert.equal(Lim.checkQuiz(p, (p.quiz.correct + 1) % 4), false);
  assert.equal(Lim.checkQuiz(p, "quince"), false);
});

test("solutionHtml: escapa el texto y marca el paso clave", () => {
  const p = Lim.GENERATORS["cero-cero-ruffini"].make(rng(8));
  const html = Lim.solutionHtml(p);
  assert.ok(html.includes('class="step key"'), "marca el paso clave");
  assert.ok(html.includes("<ol class=\"steps\">"));
  assert.ok((html.match(/class="step[ "]/g) || []).length === p.steps.length);
  assert.ok(html.includes("Respuesta:"));

  /* Escapa HTML: un enunciado con <script> no puede inyectar etiquetas */
  const p2 = Lim.GENERATORS["inf-cero"].make(rng(2));
  p2.steps[0].detail = "<script>alert('x')</script>";
  const html2 = Lim.solutionHtml(p2);
  assert.ok(!html2.includes("<script>"));
  assert.ok(html2.includes("&lt;script&gt;"));
});

test("statement: las funciones a trozos traen sus piezas", () => {
  for (const id of ["trozos-limites", "trozos-continua", "trozos-parametro"]) {
    const p = Lim.GENERATORS[id].make(rng(21));
    assert.ok(Array.isArray(p.statement.pieces), id);
    assert.ok(p.statement.pieces.length >= 2, id);
    for (const piece of p.statement.pieces) {
      assert.ok(ast.validate(piece.expr), id);
      assert.ok(["le", "lt", "ge", "gt", "eq"].includes(piece.condType), id + " condType");
      assert.equal(typeof piece.cond, "string");
    }
    assert.ok(p.statement.question.length > 5, id);
  }
  const pp = Lim.GENERATORS["trozos-parametro"].make(rng(5));
  assert.ok(pp.statement.pieceParams && pp.statement.pieceParams.p === "p");
});

test("los quizzes de indeterminación usan las etiquetas del temario", () => {
  const porGenerador = {
    "subst-directa": "no hay indeterminación",
    "subst-elemental": "no hay indeterminación",
    "inf-grados": "∞/∞",
    "inf-cero": "∞/∞",
    "inf-mismo-grado": "∞/∞",
    "inf-menos-inf-factor": "∞−∞",
    "inf-menos-inf-conjugado": "∞−∞",
    "cero-por-infinito": "0·∞",
    "uno-elevado-infinito": "1^∞"
  };
  for (const id of Lim.generatorList()) {
    for (const seed of [1, 2, 3, 4, 5]) {
      const p = Lim.GENERATORS[id].make(rng(seed));
      if (!porGenerador[id]) continue;
      const ok = p.quiz.options[p.quiz.correct];
      assert.equal(ok, porGenerador[id], id + " semilla " + seed + " -> " + ok);
      if (id.startsWith("cero-cero-")) {
        assert.equal(ok, "0/0", id + " semilla " + seed);
      }
    }
  }
});

test("lateral-dne: el interrogatorio es «¿por qué no existe?»", () => {
  const p = Lim.GENERATORS["lateral-dne"].make(rng(6));
  assert.equal(p.quiz.kind, "porque");
  assert.ok(p.quiz.options.some((o) => /izquierda y por derecha son distintos/.test(o)));
  assert.equal(p.answer.kind, "dne");
});

test("asíntota vertical: respuesta de texto con la recta", () => {
  const p = Lim.GENERATORS["asintote-vertical"].make(rng(11));
  assert.equal(p.answer.kind, "text");
  assert.match(p.answer.value, /^x = -?\d+$/);
  assert.ok(Lim.checkAnswer(p, p.answer.value).correct);
});