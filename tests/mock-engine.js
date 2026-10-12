/* =========================================================================
 * mock-engine.js — MOTOR DE CARRERA para desarrollo
 * -------------------------------------------------------------------------
 * Implementación FALSA pero COMPLETA EN FORMA de `window.Lim`.
 * Respeta exactamente el contrato de CONTRACT.md §1–§9 para que `src/app.js`
 * se pueda probar sin esperar al motor real.
 *
 * Si `window.Lim` ya existe (porque se ha cargado `src/engine.js` antes),
 * este fichero NO se instala y deja paso al motor bueno.
 *
 * Sin dependencias. Sin import/export. Sin eval. ES2020.
 * ========================================================================= */

(function (global) {
  "use strict";

  // Si el motor real ya está presente, no lo pisamos.
  if (global.Lim) return;

  var NS = "http://www.w3.org/1998/Math/MathML";

  /* =======================================================================
   * §1 — Racionales exactos sobre BigInt:  Lim.Q
   * ===================================================================== */

  function bgcd(a, b) {
    if (a < 0n) a = -a;
    if (b < 0n) b = -b;
    while (b) { var t = a % b; a = b; b = t; }
    return a;
  }

  function toBig(v) {
    if (typeof v === "bigint") return v;
    if (typeof v === "number") {
      if (!Number.isFinite(v)) throw new Error("Q: número no finito");
      return BigInt(Math.trunc(v));
    }
    if (typeof v === "string") {
      var s = v.trim();
      if (/^[+-]?\d+$/.test(s)) return BigInt(s);
      if (/^[+-]?\d+\/\d+$/.test(s)) { var p = s.split("/"); return BigInt(p[0]); }
      throw new Error("Q: no parseo " + s);
    }
    throw new Error("Q: tipo no soportado");
  }

  function Q(a, b) {
    if (!(this instanceof Q)) return new Q(a, b);
    if (a instanceof Q) { this.n = a.n; this.d = a.d; return; }

    if (typeof a === "string") {
      var s = a.trim();
      var mm = s.match(/^([+-]?\d+)\s*\/\s*(\d+)$/);
      if (mm) { this.n = BigInt(mm[1]); this.d = BigInt(mm[2]); }
      else if (/^[+-]?\d+$/.test(s)) { this.n = BigInt(s); this.d = 1n; }
      else throw new Error("Q: no parseo \"" + s + "\"");
      if (b !== undefined) throw new Error("Q: no mezcles texto y denominador");
    } else {
      if (typeof a === "number" && !Number.isInteger(a)) {
        throw new Error("Q: solo enteros; usa Q.fromNumber para decimales");
      }
      this.n = toBig(a);
      this.d = b === undefined ? 1n : toBig(b);
    }
    this._norm();
  }

  Q.prototype._norm = function () {
    if (this.d === 0n) throw new Error("Q: denominador cero");
    if (this.d < 0n) { this.n = -this.n; this.d = -this.d; }
    var g = bgcd(this.n, this.d);
    if (g > 1n) { this.n /= g; this.d /= g; }
  };

  Q.prototype.num = function () { return this.n; };
  Q.prototype.den = function () { return this.d; };

  Q.prototype.toString = function () {
    return this.d === 1n ? this.n.toString() : this.n.toString() + "/" + this.d.toString();
  };
  Q.prototype.toDisplay = function () { return this.toString(); };
  Q.prototype.toNumber = function () { return Number(this.n) / Number(this.d); };
  Q.prototype.toJSON = function () { return this.toString(); };

  function coerce(r) {
    if (r instanceof Q) return r;
    if (r instanceof Poly) throw new Error("Q: no compares con un polinomio");
    return new Q(r);
  }

  Q.prototype.add = function (r) { r = coerce(r); return new Q(this.n * r.d + r.n * this.d, this.d * r.d); };
  Q.prototype.sub = function (r) { r = coerce(r); return new Q(this.n * r.d - r.n * this.d, this.d * r.d); };
  Q.prototype.mul = function (r) { r = coerce(r); return new Q(this.n * r.n, this.d * r.d); };
  Q.prototype.div = function (r) {
    r = coerce(r);
    if (r.n === 0n) throw new Error("Q: división por cero");
    return new Q(this.n * r.d, this.d * r.n);
  };
  Q.prototype.neg = function () { return new Q(-this.n, this.d); };
  Q.prototype.inv = function () {
    if (this.n === 0n) throw new Error("Q: inverso del cero");
    return new Q(this.d, this.n);
  };
  Q.prototype.abs = function () { return this.n < 0n ? this.neg() : new Q(this.n, this.d); };

  Q.prototype.cmp = function (r) {
    r = coerce(r);
    var l = this.n * r.d, rr = r.n * this.d;
    return l < rr ? -1 : (l > rr ? 1 : 0);
  };
  Q.prototype.eq = function (r) { try { return this.cmp(r) === 0; } catch (e) { return false; } };
  Q.prototype.lt = function (r) { return this.cmp(r) < 0; };
  Q.prototype.le = function (r) { return this.cmp(r) <= 0; };
  Q.prototype.gt = function (r) { return this.cmp(r) > 0; };
  Q.prototype.ge = function (r) { return this.cmp(r) >= 0; };

  Q.prototype.isZero = function () { return this.n === 0n; };
  Q.prototype.isPos = function () { return this.n > 0n; };
  Q.prototype.isNeg = function () { return this.n < 0n; };
  Q.prototype.isOne = function () { return this.n === 1n && this.d === 1n; };

  Q.prototype.pow = function (n) {
    var e = typeof n === "bigint" ? Number(n) : Math.trunc(Number(n));
    if (!Number.isFinite(e)) throw new Error("Q.pow: exponente no válido");
    if (e < 0) return this.pow(-e).inv();
    var r = Q.ONE, b = this;
    while (e > 0) { if (e & 1) r = r.mul(b); b = b.mul(b); e >>= 1; }
    return r;
  };

  Q.fromNumber = function (x) {
    if (!Number.isFinite(x)) throw new Error("Q.fromNumber: no finito");
    if (Number.isInteger(x)) return new Q(x);
    // Hasta 9 decimales: suficiente para constantes externas.
    var d = 1n;
    var v = x;
    for (var i = 0; i < 9; i++) { v *= 10; d *= 10n; }
    return new Q(Math.round(v), d);
  };

  Q.fromDecimalString = function (s) {
    var t = String(s).trim().replace(",", ".");
    if (/^[+-]?\d+$/.test(t)) return new Q(t);
    if (/^[+-]?\d*\.\d+$/.test(t)) {
      var neg = t[0] === "-";
      var body = t.replace(/^[+-]/, "");
      var parts = body.split(".");
      var den = Math.pow(10, parts[1].length);
      var num = Number(parts[0]) * den + Number(parts[1]);
      return new Q((neg ? -num : num), den);
    }
    return null;
  };

  Q.ZERO = Q(0);
  Q.ONE = Q(1);
  Q.TWO = Q(2);
  Q.minusOne = Q(-1);

  /* =======================================================================
   * §2 — Polinomios:  Lim.Poly
   * ===================================================================== */

  function Poly(coeffs) {
    if (!(this instanceof Poly)) return new Poly(coeffs);
    var cs = [];
    for (var i = 0; i < coeffs.length; i++) {
      cs.push(coeffs[i] instanceof Q ? coeffs[i] : new Q(coeffs[i]));
    }
    while (cs.length && cs[cs.length - 1].isZero()) cs.pop();
    this.coeffs = cs;
  }

  Poly.from = function (arr) {
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var c = arr[i];
      out.push(c instanceof Q ? c : new Q(c));
    }
    return new Poly(out);
  };
  Poly.zero = new Poly([]);
  Poly.one = new Poly([Q.ONE]);
  Poly.x = new Poly([Q.ZERO, Q.ONE]);
  Poly.constant = function (q) { return new Poly([q instanceof Q ? q : new Q(q)]); };
  Poly.fromQ = function (q) { return Poly.constant(q); };

  Poly.prototype.degree = function () { return this.coeffs.length - 1; };
  Poly.prototype.isZero = function () { return this.coeffs.length === 0; };
  Poly.prototype.isOne = function () { return this.coeffs.length === 1 && this.coeffs[0].isOne(); };
  Poly.prototype.isConst = function (q) {
    var k = q instanceof Q ? q : new Q(q);
    return this.coeffs.length === 1 && this.coeffs[0].eq(k);
  };
  Poly.prototype.toQ = function () {
    if (this.coeffs.length !== 1) throw new Error("Poly.toQ: no es constante");
    return this.coeffs[0];
  };

  Poly.prototype.leading = function () {
    if (this.isZero()) throw new Error("Poly.leading: polinomio cero");
    return this.coeffs[this.coeffs.length - 1];
  };

  Poly.prototype.eval = function (q) {
    var x = q instanceof Q ? q : new Q(q);
    var acc = Q.ZERO;
    for (var i = this.coeffs.length - 1; i >= 0; i--) acc = acc.mul(x).add(this.coeffs[i]);
    return acc;
  };

  Poly.prototype.deriv = function () {
    if (this.degree() < 1) return Poly.zero;
    var out = [];
    for (var i = 1; i < this.coeffs.length; i++) out.push(this.coeffs[i].mul(Q(i)));
    return new Poly(out);
  };

  function maxLen(a, b) { return Math.max(a.length, b.length); }

  Poly.prototype.add = function (b) {
    var c = b instanceof Poly ? b : Poly.constant(b);
    var out = [];
    for (var i = 0; i < maxLen(this.coeffs.length, c.coeffs.length); i++) {
      out.push((this.coeffs[i] || Q.ZERO).add(c.coeffs[i] || Q.ZERO));
    }
    return new Poly(out);
  };

  Poly.prototype.sub = function (b) {
    var c = b instanceof Poly ? b : Poly.constant(b);
    var out = [];
    for (var i = 0; i < maxLen(this.coeffs.length, c.coeffs.length); i++) {
      out.push((this.coeffs[i] || Q.ZERO).sub(c.coeffs[i] || Q.ZERO));
    }
    return new Poly(out);
  };

  Poly.prototype.mul = function (b) {
    var c = b instanceof Poly ? b : Poly.constant(b);
    if (this.isZero() || c.isZero()) return Poly.zero;
    var out = [];
    for (var i = 0; i < this.coeffs.length; i++) {
      for (var j = 0; j < c.coeffs.length; j++) {
        var t = this.coeffs[i].mul(c.coeffs[j]);
        out[i + j] = (out[i + j] || Q.ZERO).add(t);
      }
    }
    return new Poly(out);
  };

  Poly.prototype.scale = function (c) {
    var k = c instanceof Q ? c : new Q(c);
    if (this.isZero()) return Poly.zero;
    return new Poly(this.coeffs.map(function (q) { return q.mul(k); }));
  };

  Poly.prototype.shl = function (k) {
    var pad = [];
    for (var i = 0; i < k; i++) pad.push(Q.ZERO);
    return new Poly(pad.concat(this.coeffs));
  };

  Poly.prototype.divmod = function (b) {
    var a = this;
    if (b.isZero()) throw new Error("Poly.divmod: divisor nulo");
    if (a.isZero()) return { q: Poly.zero, r: Poly.zero };
    if (a.degree() < b.degree()) return { q: Poly.zero, r: a };
    var rem = a;
    var quo = new Array(rem.degree() + 1).fill(Q.ZERO);
    var guard = 0;
    while (!rem.isZero() && rem.degree() >= b.degree() && guard++ < 200) {
      var k = rem.degree() - b.degree();
      var c = rem.leading().div(b.leading());
      quo[k] = c;
      rem = rem.sub(b.shl(k).scale(c));
    }
    return { q: new Poly(quo), r: rem };
  };

  Poly.prototype.divExact = function (b) {
    var d = this.divmod(b);
    if (!d.r.isZero()) throw new Error("Poly.divExact: no es exacta");
    return d.q;
  };

  Poly.prototype.degreeDiff = function (b) { return this.degree() - b.degree(); };

  Poly.prototype.scaleToFit = function (b) {
    var k = b.degree();
    if (this.degree() < k) return Poly.zero;
    return new Poly(this.coeffs.slice(k));
  };

  Poly.prototype.hasRoot = function (root) {
    var r = root instanceof Q ? root : new Q(root);
    return !this.eval(r).isZero();
  };

  Poly.prototype.factorLinear = function (root) {
    var r = root instanceof Q ? root : new Q(root);
    var d = this.degree();
    if (d < 1) throw new Error("Poly.factorLinear: grado < 1");
    var cs = this.coeffs;
    var res = new Array(d);
    res[d - 1] = cs[d];
    for (var i = d - 1; i >= 1; i--) res[i - 1] = cs[i].add(r.mul(res[i]));
    if (!cs[0].add(r.mul(res[0])).isZero()) throw new Error("Poly.factorLinear: no es raíz");
    return new Poly(res);
  };

  Poly.prototype.rationalRoots = function () {
    if (this.degree() < 1) return [];
    var out = [];
    var lead = this.leading();
    var np = lead.n < 0n ? -lead.n : lead.n;
    var dp = lead.d;
    var d0 = this.coeffs[0].isZero() ? Q.ZERO : this.coeffs[0];
    if (d0.isZero()) {
      // x es raíz; el resto se trata aparte (no hace falta en el mock).
      return [Q.ZERO];
    }
    var mp = d0.n < 0n ? -d0.n : d0.n;
    var qq = d0.d;
    var nDiv = divisors(np * dp);
    var dDiv = divisors(mp * qq);
    var self = this;
    var seen = {};
    for (var i = 0; i < nDiv.length; i++) {
      for (var j = 0; j < dDiv.length; j++) {
        var cand;
        try { cand = new Q(nDiv[i], dDiv[j]); } catch (e) { continue; }
        var key = cand.toString();
        if (seen[key]) continue;
        if (self.eval(cand).isZero()) { seen[key] = 1; out.push(cand); }
      }
    }
    return out;
  };

  function divisors(big) {
    var res = [];
    for (var i = 1n; i * i <= big; i++) {
      if (big % i === 0n) { res.push(i); if (i * i !== big) res.push(big / i); }
    }
    res.sort(function (a, b) { return a < b ? -1 : (a > b ? 1 : 0); });
    return res;
  }

  Poly.prototype.factorAll = function () {
    var p = this;
    var linear = [];
    var guard = 0;
    while (p.degree() >= 1 && guard++ < 20) {
      var roots = p.rationalRoots();
      var picked = null;
      for (var i = 0; i < roots.length; i++) {
        if (!p.isZero() && p.eval(roots[i]).isZero()) { picked = roots[i]; break; }
      }
      if (picked === null) break;
      var mult = 0;
      while (p.degree() >= 1 && p.eval(picked).isZero()) { p = p.factorLinear(picked); mult++; }
      linear.push({ root: picked, mult: mult });
    }
    return { linear: linear, rest: p };
  };

  Poly.prototype.toAST = function () { return ast.fromPoly(this); };
  Poly.prototype.toString = function () { return ast.toPlain(this.toAST()); };

  /* =======================================================================
   * §3 — AST y render:  Lim.ast
   * ===================================================================== */

  var ast = {
    num: function (q) { return { t: "num", v: q instanceof Q ? q : new Q(q) }; },
    variable: null, // se añade abajo con nombre "var"
    pow: function (b, e) { return { t: "pow", b: b, e: e }; },
    neg: function (a) { return { t: "neg", a: a }; },
    add: function () {
      var terms = Array.prototype.slice.call(arguments);
      if (terms.length < 2) throw new Error("ast.add: hacen falta 2 términos");
      return { t: "add", terms: terms };
    },
    sub: function (a, b) { return { t: "sub", a: a, b: b }; },
    mul: function () {
      var fs = Array.prototype.slice.call(arguments);
      if (fs.length < 2) throw new Error("ast.mul: hacen falta 2 factores");
      return { t: "mul", factors: fs };
    },
    div: function (a, b) { return { t: "div", a: a, b: b }; },
    sqrt: function (a) { return { t: "sqrt", a: a }; },
    ln: function (a) { return { t: "ln", a: a }; },
    exp: function (a) { return { t: "exp", a: a }; },
    cos: function (a) { return { t: "cos", a: a }; },
    sin: function (a) { return { t: "sin", a: a }; },
    tan: function (a) { return { t: "tan", a: a }; },
    abs: function (a) { return { t: "abs", a: a }; },
    pi: function () { return { t: "pi" }; },
    q: function (q) { return ast.num(q); }
  };
  ast.var = function (name) { return { t: "var", name: name || "x" }; };

  // Coeficiente -> AST
  function coeffAST(q, v) {
    if (q.isZero()) return ast.num(Q.ZERO);
    if (v) return ast.mul(ast.num(q), v);
    return ast.num(q);
  }

  // Regla de impresión del contrato §3: grado <= 2 -> término independiente
  // primero; grado >= 3 -> orden descendente.
  ast.fromPoly = function (p) {
    var deg = p.degree();
    if (deg < 0) return ast.num(Q.ZERO);
    if (deg === 0) return ast.num(p.coeffs[0]);
    var terms = [];
    var order = [];
    if (deg <= 2) { for (var i = 0; i <= deg; i++) order.push(i); }
    else { for (var j = deg; j >= 0; j--) order.push(j); }
    for (var k = 0; k < order.length; k++) {
      var e = order[k];
      var c = p.coeffs[e];
      if (c.isZero()) continue;
      var xn = e === 0 ? null : (e === 1 ? ast.var("x") : ast.pow(ast.var("x"), ast.num(Q(e))));
      var pos = c.isPos();
      var mag = pos ? c : c.neg();
      var term;
      if (e === 0) term = ast.num(mag);
      else if (mag.isOne()) term = xn;                       // se omite el "1·"
      else term = ast.mul(ast.num(mag), xn);
      terms.push({ term: term, pos: pos });
    }
    if (!terms.length) return ast.num(Q.ZERO);
    var head = terms[0];
    var acc = head.term;
    for (var t = 1; t < terms.length; t++) {
      acc = terms[t].pos ? ast.add(acc, terms[t].term) : ast.sub(acc, terms[t].term);
    }
    return acc;
  };

  // Cociente num/den -> AST
  ast.frac = function (num, den) {
    if (den.isOne()) return ast.fromPoly(num);
    return ast.div(ast.fromPoly(num), ast.fromPoly(den));
  };

  var PREC = { add: 1, sub: 1, mul: 2, div: 2, pow: 3, neg: 3, atom: 4 };

  function prec(node) {
    if (!node) return PREC.atom;
    if (node.t === "add" || node.t === "sub") return PREC.add;
    if (node.t === "mul" || node.t === "div") return PREC.mul;
    if (node.t === "pow" || node.t === "neg") return PREC.pow;
    return PREC.atom;
  }

  function qText(q) { return q.d === 1n ? q.n.toString() : q.n.toString() + "/" + q.d.toString(); }

  ast.toPlain = function (node, ctxPrec) {
    var p0 = ctxPrec || 0;
    var s;
    switch (node.t) {
      case "num": s = qText(node.v); break;
      case "var": s = node.name; break;
      case "pi": s = "π"; break;
      case "inf": s = node.s > 0 ? "∞" : "−∞"; break;
      case "dne": s = "no existe"; break;
      case "neg": s = "−" + ast.toPlain(node.a, PREC.neg); break;
      case "pow": s = ast.toPlain(node.b, PREC.pow + 1) + "^" + ast.toPlain(node.e, PREC.atom); break;
      case "sqrt": s = "√(" + ast.toPlain(node.a, 0) + ")"; break;
      case "ln": s = "ln(" + ast.toPlain(node.a, 0) + ")"; break;
      case "exp": s = "e^(" + ast.toPlain(node.a, 0) + ")"; break;
      case "cos": s = "cos(" + ast.toPlain(node.a, 0) + ")"; break;
      case "sin": s = "sen(" + ast.toPlain(node.a, 0) + ")"; break;
      case "tan": s = "tan(" + ast.toPlain(node.a, 0) + ")"; break;
      case "abs": s = "|" + ast.toPlain(node.a, 0) + "|"; break;
      case "add":
        s = node.terms.map(function (t, i) { return ast.toPlain(t, i === 0 ? PREC.add : PREC.add + 1); }).join(" + ");
        break;
      case "sub":
        s = ast.toPlain(node.a, PREC.add) + " − " + ast.toPlain(node.b, PREC.add + 1);
        break;
      case "mul":
        s = node.factors.map(function (f, i) { return ast.toPlain(f, i === 0 ? PREC.mul : PREC.mul + 1); }).join("·");
        break;
      case "div":
        s = ast.toPlain(node.a, PREC.mul + 1) + "/" + ast.toPlain(node.b, PREC.mul + 1);
        break;
      default: s = "?"; break;
    }
    if (prec(node) < p0) return "(" + s + ")";
    return s;
  };

  ast.toLatex = function (node) {
    switch (node.t) {
      case "num": return node.v.d === 1n ? node.v.n.toString() : "\\frac{" + node.v.n + "}{" + node.v.d + "}";
      case "var": return node.name;
      case "pi": return "\\pi";
      case "inf": return node.s > 0 ? "\\infty" : "-\\infty";
      case "dne": return "\\text{no existe}";
      case "neg": return "-" + ast.toLatex(node.a);
      case "pow": return ast.toLatex(node.b) + "^" + ast.toLatex(node.e);
      case "sqrt": return "\\sqrt{" + ast.toLatex(node.a) + "}";
      case "ln": return "\\ln(" + ast.toLatex(node.a) + ")";
      case "exp": return "e^{" + ast.toLatex(node.a) + "}";
      case "cos": return "\\cos(" + ast.toLatex(node.a) + ")";
      case "sin": return "\\sin(" + ast.toLatex(node.a) + ")";
      case "tan": return "\\tan(" + ast.toLatex(node.a) + ")";
      case "abs": return "|" + ast.toLatex(node.a) + "|";
      case "add": return node.terms.map(ast.toLatex).join(" + ");
      case "sub": return ast.toLatex(node.a) + " - " + ast.toLatex(node.b);
      case "mul": return node.factors.map(ast.toLatex).join(" \\cdot ");
      case "div": return "\\frac{" + ast.toLatex(node.a) + "}{" + ast.toLatex(node.b) + "}";
      default: return "?";
    }
  };

  /* --- MathML (se construye con createElementNS, nunca con innerHTML) --- */

  function mEl(tag, props, kids) {
    var e = document.createElementNS(NS, tag);
    if (props) for (var k in props) {
      if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
      var v = props[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === "text") e.textContent = v;
      else e.setAttribute(k, v === true ? "" : String(v));
    }
    if (kids) for (var i = 0; i < kids.length; i++) if (kids[i]) e.appendChild(kids[i]);
    return e;
  }

  function qToMathML(q) {
    var v = q instanceof Q ? q : new Q(q);
    if (v.d === 1n) return mEl("mn", { text: v.n.toString() });
    return mEl("mfrac", null, [mEl("mn", { text: v.n.toString() }), mEl("mn", { text: v.d.toString() })]);
  }

  function wrapIf(node, p0) {
    if (prec(node) < p0) {
      return mEl("mrow", null, [mEl("mo", { text: "(" }), node, mEl("mo", { text: ")" })]);
    }
    return node;
  }

  ast.qToMathML = qToMathML;

  ast.toMathML = function (node) {
    var root = mEl("mrow", null, []);
    renderInto(root, node);
    var only = root.firstElementChild;
    if (only && root.childNodes.length === 1) return only;
    return root;
  };

  // Vuelca `node` dentro de `parent` y DEVUELVE parent (así se puede usar
  // encadenado: renderInto(mEl("mrow"), a)).
  function renderInto(parent, node) {
    switch (node.t) {
      case "num": {
        var v = node.v;
        if (v.d === 1n) parent.appendChild(mEl("mn", { text: v.n.toString() }));
        else parent.appendChild(qToMathML(v));
        return parent;
      }
      case "var": parent.appendChild(mEl("mi", { text: node.name })); return parent;
      case "pi": parent.appendChild(mEl("mi", { text: "π" })); return parent;
      case "inf": parent.appendChild(mEl("mo", { text: node.s > 0 ? "∞" : "−∞" })); return parent;
      case "dne": parent.appendChild(mEl("mtext", { text: "no existe" })); return parent;

      case "neg":
        parent.appendChild(mEl("mrow", null, [mEl("mo", { text: "−" }), renderInto(mEl("mrow", null, []), node.a)]));
        return parent;

      case "pow":
        parent.appendChild(mEl("msup", null, [
          wrapIf(renderInto(mEl("mrow", null, []), node.b), PREC.pow + 1),
          renderInto(mEl("mrow", null, []), node.e)
        ]));
        return parent;

      case "sqrt":
        parent.appendChild(mEl("msqrt", null, [renderInto(mEl("mrow", null, []), node.a)]));
        return parent;

      case "ln":
        parent.appendChild(mEl("mrow", null, [mEl("mi", { text: "ln" }), wrapIf(renderInto(mEl("mrow", null, []), node.a), 0)]));
        return parent;

      case "exp":
        parent.appendChild(mEl("msup", null, [mEl("mi", { text: "e" }), renderInto(mEl("mrow", null, []), node.a)]));
        return parent;

      case "cos": case "sin": case "tan":
        parent.appendChild(mEl("mrow", null, [
          mEl("mi", { text: node.t === "sin" ? "sen" : node.t }),
          wrapIf(renderInto(mEl("mrow", null, []), node.a), 0)
        ]));
        return parent;

      case "abs":
        parent.appendChild(mEl("mrow", null, [
          mEl("mo", { text: "|" }), renderInto(mEl("mrow", null, []), node.a), mEl("mo", { text: "|" })
        ]));
        return parent;

      case "add": {
        var terms = node.terms;
        parent.appendChild(renderInto(mEl("mrow", null, []), terms[0]));
        for (var i = 1; i < terms.length; i++) {
          parent.appendChild(mEl("mo", { text: "+" }));
          parent.appendChild(renderInto(mEl("mrow", null, []), terms[i]));
        }
        return parent;
      }

      case "sub":
        parent.appendChild(renderInto(mEl("mrow", null, []), node.a));
        parent.appendChild(mEl("mo", { text: "−" }));
        parent.appendChild(renderInto(mEl("mrow", null, []), node.b));
        return parent;

      case "mul": {
        var fs = node.factors;
        parent.appendChild(wrapIf(renderInto(mEl("mrow", null, []), fs[0]), PREC.mul));
        for (var j = 1; j < fs.length; j++) {
          var f = fs[j];
          // Punto sólo entre números: "2x" se escribe sin "2·x".
          parent.appendChild(mEl("mo", { text: f.t === "num" && Math.abs(Number(f.v.n)) === 1 && f.v.d === 1n ? "" : "·" }));
          parent.appendChild(wrapIf(renderInto(mEl("mrow", null, []), f), PREC.mul + 1));
        }
        return parent;
      }

      case "div":
        parent.appendChild(mEl("mfrac", null, [
          renderInto(mEl("mrow", null, []), node.a),
          renderInto(mEl("mrow", null, []), node.b)
        ]));
        return parent;

      default:
        parent.appendChild(mEl("mtext", { text: "?" }));
        return parent;
    }
  }

  ast.equals = function (a, b) {
    if (!a || !b) return a === b;
    if (a.t !== b.t) return false;
    switch (a.t) {
      case "num": return a.v.eq(b.v);
      case "var": return a.name === b.name;
      case "pi": return true;
      case "inf": return a.s === b.s;
      case "dne": return true;
      case "neg": return ast.equals(a.a, b.a);
      case "sqrt": case "ln": case "exp": case "cos": case "sin": case "tan": case "abs":
        return ast.equals(a.a, b.a);
      case "pow": return ast.equals(a.b, b.b) && ast.equals(a.e, b.e);
      case "add": {
        if (a.terms.length !== b.terms.length) return false;
        for (var i = 0; i < a.terms.length; i++) if (!ast.equals(a.terms[i], b.terms[i])) return false;
        return true;
      }
      case "sub": return ast.equals(a.a, b.a) && ast.equals(a.b, b.b);
      case "mul": {
        if (a.factors.length !== b.factors.length) return false;
        for (var j = 0; j < a.factors.length; j++) if (!ast.equals(a.factors[j], b.factors[j])) return false;
        return true;
      }
      case "div": return ast.equals(a.a, b.a) && ast.equals(a.b, b.b);
      default: return false;
    }
  };

  /* =======================================================================
   * §4 — Motor de límites:  Lim.limit
   * ===================================================================== */

  function multiplicityOfRoot(p, at) {
    var d = p, m = 0;
    while (d.degree() >= 1 && m < 40) {
      if (!d.eval(at).isZero()) break;
      d = d.factorLinear(at);
      m++;
    }
    return m;
  }

  // devuelve {N, D} tras cancelar las potencias de (x-at) comunes
  function cancelCommon(num, den, at) {
    var N = num, D = den, g = 0;
    while (D.degree() >= 1 && D.eval(at).isZero() && g++ < 40) {
      var lin = D.factorLinear(at);
      N = N.divExact(lin);
      D = D.divExact(lin);
    }
    return { N: N, D: D };
  }

  function signOf(q) { return q.isZero() ? 0 : (q.isPos() ? 1 : -1); }

  function inf(sign) { return { kind: "inf", sign: sign > 0 ? 1 : -1 }; }
  function finite(q) { return { kind: "finite", value: q }; }

  var limit = {
    rational: function (opts) {
      var num = opts.num, den = opts.den, at = opts.at, side = opts.side || null;
      at = at instanceof Q ? at : new Q(at);

      var dv = den.eval(at);
      if (!dv.isZero()) return finite(num.eval(at).div(dv));

      var nv = num.eval(at);
      if (nv.isZero()) {
        var cc = cancelCommon(num, den, at);
        var d2 = cc.D.eval(at);
        if (d2.isZero()) return { kind: "dne" };
        return finite(cc.N.eval(at).div(d2));
      }

      // numerador != 0, denominador == 0  ->  hay que mirar el lado
      var m = multiplicityOfRoot(den, at);
      var h = den;
      for (var i = 0; i < m; i++) h = h.factorLinear(at);
      var hs = signOf(h.eval(at));
      var ns = signOf(nv);
      var odd = (m % 2) === 1;
      var sLeft = odd ? -ns * hs : 0;
      var sRight = odd ? ns * hs : 0;

      if (side === "+") return sRight === 0 ? { kind: "dne" } : inf(sRight);
      if (side === "-") return sLeft === 0 ? { kind: "dne" } : inf(sLeft);
      if (sLeft === 0 && sRight === 0) return { kind: "dne" };
      if (sLeft === sRight) return inf(sLeft);
      return { kind: "dne" };
    },

    infinity: function (opts) {
      var num = opts.num, den = opts.den || Poly.one;
      var sign = opts.sign === "-" ? -1 : 1;
      var d = den.isZero() ? -999 : den.degree();
      var n = num.isZero() ? -999 : num.degree();
      var dn = n - d;

      if (num.isZero()) return finite(Q.ZERO);

      var leadSign = signOf(num.leading());
      var flip = (sign === -1 && dn % 2 !== 0) ? -1 : 1;

      if (den.isZero()) return inf(leadSign * flip);

      if (dn > 0) return inf(leadSign * flip);
      if (dn < 0) return finite(Q.ZERO);
      return finite(num.leading().div(den.leading()));
    },

    bothSides: function (opts) {
      var at = opts.at instanceof Q ? opts.at : new Q(opts.at);
      var left = limit.rational({ num: opts.num, den: opts.den, at: at, side: "-" });
      var right = limit.rational({ num: opts.num, den: opts.den, at: at, side: "+" });
      var atv;
      if (sameResult(left, right)) atv = left;
      else atv = { kind: "dne" };
      return { left: left, right: right, at: atv };
    }
  };

  function sameResult(a, b) {
    if (a.kind !== b.kind) return false;
    if (a.kind === "finite") return a.value.eq(b.value);
    if (a.kind === "inf") return a.sign === b.sign;
    return true;
  }

  limit.sameResult = sameResult;

  /* =======================================================================
   * §5 — RNG determinista:  Lim.rng
   * ===================================================================== */

  function rng(seed) {
    var s = (Number(seed) >>> 0) || 0x9e3779b9;
    var f = function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.int = function (min, max) {
      return min + Math.floor(f() * (max - min + 1));
    };
    f.pick = function (arr) { return arr[Math.floor(f() * arr.length)]; };
    f.bool = function (p) { return f() < (p === undefined ? 0.5 : p); };
    f.shuffle = function (arr) {
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(f() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    };
    return f;
  }

  /* =======================================================================
   * §7 — Tópicos y métodos
   * ===================================================================== */

  var TOPICS = [
    { id: "sustitucion", name: "Sustitución y laterales", color: "--c-sustitucion" },
    { id: "infinito", name: "Límites en el infinito", color: "--c-infinito" },
    { id: "indeterminacion", name: "Indeterminaciones", color: "--c-indet" },
    { id: "continuidad", name: "Continuidad", color: "--c-continuidad" }
  ];

  var METHODS = {
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

  /* =======================================================================
   * Helpers de construcción de problemas
   * ===================================================================== */

  function A(kind, value) {
    if (kind === "rational") return { kind: "rational", value: value instanceof Q ? value : new Q(value) };
    if (kind === "infinite") return { kind: "infinite", sign: value > 0 ? 1 : -1 };
    if (kind === "dne") return { kind: "dne" };
    return { kind: kind, value: String(value) };
  }

  // Genera 3 distractores razonables a partir de la respuesta correcta.
  function distractorsFor(ans, rand) {
    var out = [];
    var i;
    if (ans.kind === "rational") {
      var v = ans.value;
      var cands = [v.add(Q.ONE), v.sub(Q.ONE), v.mul(Q(2)), v.neg(), v.add(Q.TWO), v.sub(Q.TWO)];
      var pool = [];
      for (i = 0; i < cands.length; i++) {
        if (cands[i].eq(v)) continue;
        var key = cands[i].toString();
        var dup = false;
        for (var j = 0; j < pool.length; j++) if (pool[j].toString() === key) dup = true;
        if (!dup) pool.push(cands[i]);
      }
      var shuffled = rand.shuffle(pool);
      for (i = 0; i < 3 && i < shuffled.length; i++) out.push(A("rational", shuffled[i]));
      while (out.length < 3) out.push(A("rational", v.add(Q(out.length + 1))));
    } else if (ans.kind === "infinite") {
      var others = [A("infinite", -ans.sign), A("dne"), A("rational", Q.ZERO), A("rational", Q.ONE)];
      var sh = rand.shuffle(others.filter(function (x) { return answerToString(x) !== answerToString(ans); }));
      for (i = 0; i < 3 && i < sh.length; i++) out.push(sh[i]);
      while (out.length < 3) out.push(A("rational", Q(out.length + 1)));
    } else if (ans.kind === "dne") {
      var others2 = [A("infinite", 1), A("infinite", -1), A("rational", Q.ZERO), A("rational", Q.ONE), A("rational", Q(2))];
      var sh2 = rand.shuffle(others2);
      for (i = 0; i < 3; i++) out.push(sh2[i % sh2.length]);
    } else {
      out.push(A("text", "x = 0"), A("text", "x = 1"), A("rational", Q.ZERO));
    }
    return out;
  }

  /* =======================================================================
   * §6 — Generadores (6 generadores de ejemplo, forma completa)
   * ===================================================================== */

  var GENERATORS = {};

  /* --- 1. Sustitución directa ---------------------------------------- */
  GENERATORS["subst-directa"] = {
    id: "subst-directa",
    topic: "sustitucion",
    difficulty: 1,
    method: "sustitucion",
    title: "Sustitución directa",
    make: function (rand) {
      var at = Q(rand.int(-4, 5));
      var nums = [
        Poly.from([1, -3, 2]), Poly.from([2, 1]), Poly.from([-1, 0, 1]),
        Poly.from([1, 2, 3]), Poly.from([3, -1]), Poly.from([4, 2, -1, 1])
      ];
      var dens = [Poly.from([1, -1]), Poly.from([2]), Poly.from([1, 2]), Poly.from([1, 0, 1]), Poly.from([3])];
      var num = rand.pick(nums);
      var den = rand.pick(dens);
      var tries = 0;
      while (den.eval(at).isZero() && tries++ < 30) den = rand.pick(dens);
      if (den.eval(at).isZero()) den = Poly.from([2]);

      var res = limit.rational({ num: num, den: den, at: at, side: null });
      if (res.kind !== "finite") { den = Poly.from([2]); res = limit.rational({ num: num, den: den, at: at, side: null }); }

      var answer = A("rational", res.value);
      var nv = num.eval(at), dv = den.eval(at);
      return {
        seed: 0,
        generatorId: "subst-directa",
        topic: "sustitucion",
        difficulty: 1,
        method: "sustitucion",
        statement: {
          expr: ast.frac(num, den),
          target: { type: "point", at: at, side: null },
          kind: "limit"
        },
        answer: answer,
        quiz: {
          kind: "metodo",
          question: "¿Por qué basta con sustituir en este límite?",
          options: [
            "Porque el denominador no se anula: se puede calcular directamente.",
            "Porque siempre que hay un cociente se cancela.",
            "Porque x → 2 permite poner x = 2 sin más.",
            "Porque el numerador es más pequeño que el denominador."
          ],
          correct: 0,
          explain: "El denominador vale " + dv.toDisplay() + " ≠ 0, así que se sustituye directamente. Si se anulara habría que mirar los laterales o factorizar."
        },
        steps: [
          { title: "Sustituimos x = " + at.toDisplay(), detail: "El denominador no se anula, así que se puede entrar directamente.", math: ast.num(Q.ZERO) },
          {
            title: "Evaluamos numerador y denominador",
            detail: "El numerador vale " + num.eval(at).toDisplay() + " y el denominador " + den.eval(at).toDisplay() + ".",
            math: ast.frac(num, den)
          },
          {
            title: "Dividimos",
            detail: "(" + nv.toDisplay() + ") : (" + dv.toDisplay() + ") = " + res.value.toDisplay() + ".",
            math: ast.num(res.value)
          }
        ],
        keyStep: 0,
        distractors: distractorsFor(answer, rand)
      };
    }
  };

  /* --- 2. Indeterminación 0/0: factorizar ----------------------------- */
  GENERATORS["factor-cancelar"] = {
    id: "factor-cancelar",
    topic: "indeterminacion",
    difficulty: 2,
    method: "factorizar",
    title: "Indeterminación 0/0",
    make: function (rand) {
      var at = Q(rand.int(-3, 4));
      var gs = [Poly.from([1, 1]), Poly.from([1]), Poly.from([2, -1]), Poly.from([1, 0, 1]), Poly.from([3])];
      var hs = [Poly.from([1, -2]), Poly.from([3, 1]), Poly.from([1, 2, 1]), Poly.from([-1, 2]), Poly.from([2, 1, 1])];
      var g = rand.pick(gs), h = rand.pick(hs);
      var t = 0;
      while (g.eval(at).isZero() && t++ < 30) g = rand.pick(gs);
      if (g.eval(at).isZero()) g = Poly.from([3]);

      var lin = Poly.from([at.neg(), Q.ONE]);   // x - at
      var num = h.mul(lin);
      var den = g.mul(lin);

      var res = limit.rational({ num: num, den: den, at: at, side: null });
      if (res.kind !== "finite") { h = Poly.from([1, -2]); num = h.mul(lin); res = limit.rational({ num: num, den: den, at: at, side: null }); }
      var answer = A("rational", res.value);

      return {
        seed: 0,
        generatorId: "factor-cancelar",
        topic: "indeterminacion",
        difficulty: 2,
        method: "factorizar",
        statement: {
          expr: ast.frac(num, den),
          target: { type: "point", at: at, side: null },
          kind: "limit"
        },
        answer: answer,
        quiz: {
          kind: "indeterminacion",
          question: "¿Qué indeterminateación aparece y cómo se resuelve?",
          options: [
            "∞/∞: se dividen numerador y denominador entre x^n.",
            "0/0: se factoriza y se cancela el factor (x − " + at.toDisplay() + ").",
            "0·∞: se pasa a 0/0 dividiendo y dividiendo.",
            "∞−∞: se racionaliza el denominador."
          ],
          correct: 1,
          explain: "Sustituyendo sale 0/0. La técnica es factorizar el numerador y el denominador, sacar (x − " + at.toDisplay() + ") factor común y cancelarlo."
        },
        steps: [
          { title: "Sustituimos x = " + at.toDisplay(), detail: "El numerador da 0 y el denominador da 0: indeterminación 0/0.", math: ast.frac(num, den) },
          { title: "Factorizamos", detail: "Los dos polinomios tienen el factor (x − " + at.toDisplay() + ").", math: ast.frac(h, g) },
          { title: "Simplificamos", detail: "Ya podemos sustituir sin problema.", math: ast.num(res.value) }
        ],
        keyStep: 1,
        distractors: distractorsFor(answer, rand)
      };
    }
  };

  /* --- 3. Denominador anulado: ±infinito o DNE ------------------------- */
  GENERATORS["den-anulado"] = {
    id: "den-anulado",
    topic: "sustitucion",
    difficulty: 2,
    method: "denominador",
    title: "Denominador anulado",
    make: function (rand) {
      var at = Q(rand.int(-3, 4));
      var nums = [Poly.from([1, 1]), Poly.from([2]), Poly.from([-1, 1]), Poly.from([3, 2]), Poly.from([-2, 1]), Poly.from([1, 0, 1])];
      var gs = [Poly.from([1]), Poly.from([2]), Poly.from([1, 1])];
      var num = rand.pick(nums), g = rand.pick(gs);
      var t = 0;
      while ((g.eval(at).isZero() || num.eval(at).isZero()) && t++ < 40) { num = rand.pick(nums); g = rand.pick(gs); }
      if (g.eval(at).isZero() || num.eval(at).isZero()) { num = Poly.from([2]); g = Poly.from([1]); }

      var lin = Poly.from([at.neg(), Q.ONE]);
      var den = g.mul(lin);
      var wantDne = rand.bool(0.4);
      var side = wantDne ? null : (rand.bool(0.5) ? "+" : "-");

      var res = limit.rational({ num: num, den: den, at: at, side: side });
      var answer = res.kind === "finite" ? A("rational", res.value)
        : res.kind === "inf" ? A("infinite", res.sign)
          : A("dne");

      var both = limit.bothSides({ num: num, den: den, at: at });
      var tLeft = both.left.kind === "inf" ? (both.left.sign > 0 ? "+∞" : "−∞") : "otro valor";
      var tRight = both.right.kind === "inf" ? (both.right.sign > 0 ? "+∞" : "−∞") : "otro valor";

      var steps = [
        { title: "El denominador se anula", detail: "Al sustituir x = " + at.toDisplay() + " el denominador vale 0 y el numerador " + num.eval(at).toDisplay() + " ≠ 0.", math: ast.frac(num, den) },
        { title: "Factorizamos el denominador", detail: "El denominador tiene el factor (x − " + at.toDisplay() + ").", math: ast.frac(num, g) },
        {
          title: "Izquierda y derecha",
          detail: "Por la izquierda el cociente tiende a " + tLeft + " y por la derecha a " + tRight + ".",
          math: ast.fromPoly(g)
        }
      ];
      if (!wantDne) steps.push({ title: "Nos piden un solo lado", detail: "Trabajamos solo con el lado indicado.", math: ast.num(Q.ONE) });

      return {
        seed: 0,
        generatorId: "den-anulado",
        topic: "sustitucion",
        difficulty: 2,
        method: "denominador",
        statement: {
          expr: ast.frac(num, den),
          target: { type: "point", at: at, side: side },
          kind: "limit"
        },
        answer: answer,
        quiz: {
          kind: "metodo",
          question: wantDne
            ? "El denominador se anula y el numerador no. ¿Qué hay que hacer?"
            : "El denominador se anula en un punto. ¿Qué hay que estudiar?",
          options: wantDne ? [
            "Sustituir directamente y dividir entre cero.",
            "Comprobar los dos límites laterales y ver si coinciden.",
            "Racionalizar el denominador.",
            "Comparar los grados del numerador y el denominador."
          ] : [
            "Sustituir directamente.",
            "Racionalizar.",
            "Mirar el signo del cociente al acercarse por el lado pedido.",
            "Usar la fórmula de la e."
          ],
          correct: wantDne ? 1 : 2,
          explain: wantDne
            ? "Con 0 en el denominador y algo distinto de 0 en el numerador hay que estudiar los dos laterales. Si no coinciden, el límite no existe."
            : "El denominador anulado da un cociente que tiende a infinito con el signo que marca el lado indicado. Se lee el signo, no se sustituye."
        },
        steps: steps,
        keyStep: 2,
        distractors: distractorsFor(answer, rand)
      };
    }
  };

  /* --- 4. Límites en el infinito -------------------------------------- */
  GENERATORS["poli-infinito"] = {
    id: "poli-infinito",
    topic: "infinito",
    difficulty: 2,
    method: "dominantePolinomio",
    title: "Término dominante en el infinito",
    make: function (rand) {
      var sign = rand.bool(0.5) ? "+" : "-";
      var kind = rand.int(0, 2);
      var num, den;
      if (kind === 0) { num = rand.pick([Poly.from([1, 0, 1]), Poly.from([3, 1, 2]), Poly.from([-2, 0, 1, 1]), Poly.from([5, -1])]); den = Poly.one; }
      else if (kind === 1) { num = rand.pick([Poly.from([2, 1]), Poly.from([-3, 1]), Poly.from([1, 0, 0, 1]), Poly.from([4, 0, 2])]); den = Poly.one; }
      else { num = rand.pick([Poly.from([1, 2, 3]), Poly.from([2, 0, 1, 1]), Poly.from([-1, 3])]); den = Poly.from([1, 1]); }

      var res = limit.infinity({ num: num, den: den, sign: sign });
      var answer = res.kind === "finite" ? A("rational", res.value)
        : res.kind === "inf" ? A("infinite", res.sign)
          : A("dne");

      var dn = num.isZero() ? -99 : num.degree();
      var dd = den.isZero() ? -99 : den.degree();
      var k = Math.max(dn, dd);
      // Dividir entre x^k. Si el denominador es 1 no queda nada debajo.
      var paso2 = den.isOne()
        ? ast.fromPoly(num.scaleToFit(num))
        : ast.div(ast.fromPoly(num.scaleToFit(den)), ast.fromPoly(den));

      var steps = [
        {
          title: "Mandan los términos de mayor grado",
          detail: "El numerador tiene grado " + dn + " y el denominador grado " + dd + ".",
          math: ast.frac(num, den)
        },
        {
          title: "Dividimos entre x^" + k,
          detail: den.isOne()
            ? "Al dividir el polinomio entre su término principal queda un coeficiente."
            : "El cociente de los términos principales marca el resultado.",
          math: paso2
        },
        { title: "Conclusión", detail: "El límite es " + answerToString(answer) + ".", math: answerAst(answer) }
      ];

      return {
        seed: 0,
        generatorId: "poli-infinito",
        topic: "infinito",
        difficulty: 2,
        method: "dominantePolinomio",
        statement: {
          expr: ast.frac(num, den),
          target: { type: "infinity", sign: sign },
          kind: "limit"
        },
        answer: answer,
        quiz: {
          kind: "metodo",
          question: "¿Por qué basta con mirar los términos de mayor grado?",
          options: [
            "Porque el cociente de los coeficientes principales es el límite.",
            "Porque en el infinito x siempre vale 0.",
            "Porque los términos de menor grado se pueden borrar sin más.",
            "Porque todo polinomio tiende a 0 en el infinito."
          ],
          correct: 0,
          explain: "Cuando x → ±∞, un polinomio se comporta como su término de mayor grado. Por eso se dividen numerador y denominador entre la mayor potencia de x y el resultado es el cociente de los coeficientes principales (con el signo que toque en −∞ si el grado es impar)."
        },
        steps: steps,
        keyStep: 1,
        distractors: distractorsFor(answer, rand)
      };
    }
  };

  /* --- 5. Indeterminación ∞/∞: comparar grados ------------------------- */
  GENERATORS["indet-grados"] = {
    id: "indet-grados",
    topic: "indeterminacion",
    difficulty: 3,
    method: "grados",
    title: "Comparar grados",
    make: function (rand) {
      var sign = rand.bool(0.5) ? "+" : "-";
      var deg = rand.int(2, 3);
      var mk = function (d) {
        var cs = [];
        for (var i = 0; i <= d; i++) cs.push(rand.int(-4, 5));
        cs[d] = cs[d] === 0 ? 2 : cs[d];
        return Poly.from(cs);
      };
      var num = mk(deg), den = mk(deg);
      var t = 0;
      while (den.leading().isZero() && t++ < 10) den = mk(deg);
      if (deg === 3) { den = Poly.from([1, 0, -1, 1]); num = rand.pick([Poly.from([2, 0, 1, 1]), Poly.from([-1, 0, 2, 1])]); }

      var res = limit.infinity({ num: num, den: den, sign: sign });
      var answer = res.kind === "finite" ? A("rational", res.value)
        : res.kind === "inf" ? A("infinite", res.sign)
          : A("dne");

      return {
        seed: 0,
        generatorId: "indet-grados",
        topic: "indeterminacion",
        difficulty: 3,
        method: "grados",
        statement: {
          expr: ast.frac(num, den),
          target: { type: "infinity", sign: sign },
          kind: "limit"
        },
        answer: answer,
        quiz: {
          kind: "indeterminacion",
          question: "Tenemos ∞/∞. ¿Cuál es la técnica correcta?",
          options: [
            "Comparar los grados y dividir entre la mayor potencia de x.",
            "Sustituir x = 0.",
            "Racionalizar el denominador.",
            "Cancelar factores (x − a) como si fuera 0/0."
          ],
          correct: 0,
          explain: "En ∞/∞ no se puede cancelar nada: hay que dividir numerador y denominador entre x elevado al mayor grado. Si los grados son distintos, manda el mayor; si son iguales, el límite es el cociente de los coeficientes principales."
        },
        steps: [
          { title: "Los dos polinomios tienen el mismo grado", detail: "Ambos son de grado " + deg + ": hay ∞/∞.", math: ast.frac(num, den) },
          { title: "Dividimos entre x^" + deg, detail: "Quedan solo los coeficientes principales.", math: ast.frac(num.scaleToFit(den), den) },
          { title: "Cociente de coeficientes principales", detail: num.leading().toDisplay() + " / " + den.leading().toDisplay() + " = " + answerToString(answer) + ".", math: answerAst(answer) }
        ],
        keyStep: 1,
        distractors: distractorsFor(answer, rand)
      };
    }
  };

  /* --- 6. Continuidad (respuesta de tipo choice) ----------------------- */
  GENERATORS["continuidad-piezas"] = {
    id: "continuidad-piezas",
    topic: "continuidad",
    difficulty: 3,
    method: "continuidad",
    title: "Continuidad definida a trozos",
    make: function (rand) {
      var at = Q(rand.int(-2, 3));
      var branch = rand.pick([Poly.from([2, 1]), Poly.from([1, 1]), Poly.from([0, 1]), Poly.from([1, 0, 1]), Poly.from([-1, 2])]);
      var cont = branch.eval(at);
      var value = cont.isNeg() ? Q(1) : Q(rand.int(1, 4));
      var isCont = cont.eq(value);

      var answer = {
        kind: "choice",
        options: ["si", "no", "dne", "+inf"],
        correct: isCont ? 0 : 1
      };

      var other = isCont ? branch.add(Poly.constant(Q(1))) : branch;

      return {
        seed: 0,
        generatorId: "continuidad-piezas",
        topic: "continuidad",
        difficulty: 3,
        method: "continuidad",
        statement: {
          expr: ast.fromPoly(branch),
          target: { type: "point", at: at, side: null },
          kind: "continuity",
          pieces: [
            { expr: ast.fromPoly(branch), cond: "x ≤ " + at.toDisplay(), condType: "le" },
            { expr: ast.num(value), cond: "x > " + at.toDisplay(), condType: "gt" }
          ],
          question: "¿Es f continua en x = " + at.toDisplay() + " ?"
        },
        answer: answer,
        quiz: {
          kind: "metodo",
          question: "¿Cuáles son las tres condiciones de continuidad en x = a?",
          options: [
            "Que f exista en a, que el límite exista y que ambos coincidan con f(a).",
            "Que f sea derivable y que f′ no se anule.",
            "Que el límite lateral por la derecha exista.",
            "Que la función sea inyectiva en un entorno de a."
          ],
          correct: 0,
          explain: "f es continua en a si: (1) f está definida en a, (2) el límite de f en a existe, y (3) ese límite coincide con f(a). Aquí f(a) = " + cont.toDisplay() + " y el límite vale " + value.toDisplay() + "."
        },
        steps: [
          {
            title: "Leemos la definición por trozos",
            detail: "Por la izquierda manda el polinomio y por la derecha la constante " + value.toDisplay() + ".",
            math: ast.fromPoly(branch)
          },
          {
            title: "Límite por la izquierda",
            detail: "lim por la izquierda de f(x) = " + branch.eval(at).toDisplay() + ".",
            math: ast.fromPoly(branch)
          },
          {
            title: "Límite por la derecha",
            detail: "lim por la derecha de f(x) = " + value.toDisplay() + ".",
            math: ast.num(value)
          },
          {
            title: isCont ? "Los tres coinciden" : "No coinciden",
            detail: isCont
              ? "El límite existe y vale " + value.toDisplay() + ", que es justo f(" + at.toDisplay() + "). La función es continua."
              : "El límite existe y vale " + value.toDisplay() + ", pero f(" + at.toDisplay() + ") = " + cont.toDisplay() + ". Hay discontinuidad evitable: basta redefinir f(" + at.toDisplay() + ") = " + value.toDisplay() + ".",
            math: ast.num(value)
          }
        ],
        keyStep: 3,
        distractors: [
          { kind: "rational", value: cont },
          { kind: "infinite", sign: 1 },
          { kind: "dne" }
        ],
        _other: other
      };
    }
  };

  function answerAst(ans) {
    if (!ans) return ast.num(Q.ZERO);
    if (ans.kind === "rational") return ast.num(ans.value);
    if (ans.kind === "infinite") return { t: "inf", s: ans.sign };
    if (ans.kind === "dne") return { t: "dne" };
    return ast.num(Q.ZERO);
  }

  /* =======================================================================
   * §8 — Niveles
   * ===================================================================== */

  var LEVELS = [
    { id: "sustituir", n: 1, name: "Sustituir", generators: ["subst-directa"], required: 8, total: 10 },
    { id: "laterales", n: 2, name: "Laterales y anulados", generators: ["subst-directa", "den-anulado"], required: 8, total: 10 },
    { id: "factorizar", n: 3, name: "Indeterminación 0/0", generators: ["factor-cancelar"], required: 8, total: 10 },
    { id: "infinito-poli", n: 4, name: "Polinomios en el infinito", generators: ["poli-infinito"], required: 8, total: 10 },
    { id: "infinito-indet", n: 5, name: "∞/∞ y grados", generators: ["indet-grados", "poli-infinito"], required: 8, total: 10 },
    { id: "mezcla-a", n: 6, name: "Punto y polinomio", generators: ["subst-directa", "den-anulado", "factor-cancelar", "poli-infinito"], required: 8, total: 10 },
    { id: "mezcla-b", n: 7, name: "Infinito y factores", generators: ["factor-cancelar", "indet-grados", "poli-infinito"], required: 8, total: 10 },
    { id: "generales", n: 8, name: "Límites generales", generators: ["subst-directa", "den-anulado", "factor-cancelar", "poli-infinito", "indet-grados"], required: 8, total: 10 },
    { id: "continuidad", n: 9, name: "Continuidad", generators: ["continuidad-piezas", "den-anulado", "factor-cancelar"], required: 8, total: 10 },
    { id: "examen", n: 10, name: "Examen final", generators: ["subst-directa", "den-anulado", "factor-cancelar", "poli-infinito", "indet-grados", "continuidad-piezas"], required: 8, total: 10 }
  ];

  /* =======================================================================
   * §9 — Funciones de nivel superior
   * ===================================================================== */

  function generatorList() { return Object.keys(GENERATORS); }

  function generate(opts) {
    opts = opts || {};
    var all = Object.keys(GENERATORS);
    var ids = (opts.generatorIds && opts.generatorIds.length) ? opts.generatorIds.filter(function (i) { return !!GENERATORS[i]; }) : all;
    if (!ids.length) ids = all;

    var pool = ids.filter(function (i) {
      var g = GENERATORS[i];
      if (opts.topic && g.topic !== opts.topic) return false;
      if (opts.difficultyMin != null && g.difficulty < opts.difficultyMin) return false;
      if (opts.difficultyMax != null && g.difficulty > opts.difficultyMax) return false;
      return true;
    });
    if (!pool.length) pool = ids;

    var seed = (opts.seed != null) ? (Number(opts.seed) >>> 0) : (Math.floor(Math.random() * 4294967295) >>> 0);
    var rand = rng(seed);

    var genId = (opts.generatorId && GENERATORS[opts.generatorId]) ? opts.generatorId : rand.pick(pool);
    var g = GENERATORS[genId];

    var p;
    try {
      p = g.make(rand, opts);
    } catch (err) {
      // Salvavidas: si un generador falla, caemos en el de sustitución directa.
      g = GENERATORS["subst-directa"];
      rand = rng(seed ^ 0x5bf03635);
      p = g.make(rand, opts);
      genId = g.id;
    }

    p.seed = seed;
    p.generatorId = genId;
    p.id = genId + "-" + seed;
    p.topic = g.topic;
    p.difficulty = g.difficulty;
    p.method = g.method;
    p.title = g.title;
    if (!p.distractors) p.distractors = distractorsFor(p.answer, rand);
    return p;
  }

  /* --- Respuestas ----------------------------------------------------- */

  function answerToString(ans) {
    if (!ans) return "";
    if (ans.kind === "rational") return ans.value.toDisplay();
    if (ans.kind === "infinite") return ans.sign > 0 ? "+inf" : "-inf";
    if (ans.kind === "dne") return "dne";
    if (ans.kind === "choice") return String(ans.options[ans.correct]);
    if (ans.kind === "text") return String(ans.value);
    return "";
  }

  // Convierte una respuesta canónica a algo comparable con lo que escribe el alumno.
  function canonicalAnswer(ans) {
    if (!ans) return { kind: "dne" };
    if (ans.kind === "choice") return parseRaw(String(ans.options[ans.correct]));
    return ans;
  }

  var INF_WORDS = ["+inf", "+infinity", "+infinito", "+infinita", "inf", "+∞", "∞", "infinity", "positivo"];
  var NEG_INF_WORDS = ["-inf", "-infinity", "-infinito", "-infinita", "-∞", "∞-", "menosinfinito"];
  var DNE_WORDS = ["dne", "no existe", "noexiste", "no", "nd", "indeterminado", "undefined", "no definido"];
  var SI_WORDS = ["si", "sí", "s", "yes", "true"];

  function normText(s) {
    return String(s)
      .replace(/[\u2212\u2013\u2014]/g, "-")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function parseRaw(raw) {
    var s = normText(raw);
    if (!s) return null;

    // "x = 3" -> texto
    var eq = s.match(/^(.+?)\s*=\s*(.+)$/);
    if (eq && !/\//.test(s)) {
      return { kind: "text", value: eq[1].replace(/\s+/g, "") + "=" + eq[2].replace(/\s+/g, "") };
    }

    for (var i = 0; i < NEG_INF_WORDS.length; i++) if (s === NEG_INF_WORDS[i]) return { kind: "infinite", sign: -1 };
    for (var j = 0; j < INF_WORDS.length; j++) if (s === INF_WORDS[j]) return { kind: "infinite", sign: 1 };
    for (var k = 0; k < DNE_WORDS.length; k++) if (s === DNE_WORDS[k]) return { kind: "dne" };
    for (var l = 0; l < SI_WORDS.length; l++) if (s === SI_WORDS[l]) return { kind: "si" };

    var clean = s.replace(/\s*\/\s*/g, "/").replace(/\s/g, "");
    var q = null;
    try { q = Q(clean); } catch (e) { q = null; }
    if (q) return { kind: "rational", value: q };
    q = Q.fromDecimalString(s);
    if (q) return { kind: "rational", value: q };

    // e, pi, 2.71828...
    if (clean === "e") return { kind: "rational", value: Q.fromNumber(Math.E) };
    if (clean === "pi" || clean === "π") return { kind: "rational", value: Q.fromNumber(Math.PI) };

    return null;
  }

  function checkAnswer(problem, raw) {
    var ans = canonicalAnswer(problem.answer);
    var got = parseRaw(raw);
    if (!got) {
      return { correct: false, normalized: String(raw), reason: "No entiendo esa respuesta" };
    }
    var normTextOut = displayNormalized(got);

    if (ans.kind !== got.kind) {
      return {
        correct: false,
        normalized: normTextOut,
        reason: mismatchReason(ans, got)
      };
    }

    if (ans.kind === "rational" && got.kind === "rational") {
      if (ans.value.eq(got.value)) return { correct: true, normalized: normTextOut };
      var d = Number(ans.value.sub(got.value).abs());
      var scale = Math.max(1, Math.abs(ans.value.toNumber()));
      if (d / scale < 1e-6) return { correct: true, normalized: normTextOut };
      return {
        correct: false,
        normalized: normTextOut,
        reason: "El resultado correcto es " + ans.value.toDisplay() + ", no " + got.value.toDisplay() + "."
      };
    }

    if (ans.kind === "infinite" && got.kind === "infinite") {
      if (ans.sign === got.sign) return { correct: true, normalized: normTextOut };
      return {
        correct: false,
        normalized: normTextOut,
        reason: "El signo no es ese: el cociente tiende a " + (ans.sign > 0 ? "+∞" : "−∞") + "."
      };
    }

    if (ans.kind === "dne" && got.kind === "dne") return { correct: true, normalized: normTextOut };

    if (ans.kind === "si" && got.kind === "si") return { correct: true, normalized: normTextOut };

    if (ans.kind === "text" && got.kind === "text") {
      if (String(ans.value).toLowerCase() === String(got.value).toLowerCase()) return { correct: true, normalized: normTextOut };
      return { correct: false, normalized: normTextOut, reason: "La respuesta correcta es " + ans.value + "." };
    }

    if (ans.kind === "dne" || got.kind === "dne") {
      return { correct: false, normalized: normTextOut, reason: "El límite sí existe; no es un caso de no existencia." };
    }

    return { correct: false, normalized: normTextOut, reason: "Esa no es la respuesta esperada." };
  }

  function displayNormalized(got) {
    if (got.kind === "rational") return got.value.toDisplay();
    if (got.kind === "infinite") return got.sign > 0 ? "+inf" : "-inf";
    if (got.kind === "dne") return "dne";
    if (got.kind === "si") return "si";
    return String(got.value);
  }

  function mismatchReason(ans, got) {
    if (ans.kind === "infinite") {
      return "Esperabas un número, pero el cociente tiende a " + (ans.sign > 0 ? "+∞" : "−∞") + ".";
    }
    if (ans.kind === "dne") {
      return "Este límite sí existe. Fíjate en el signo del cociente o en el cociente de coeficientes principales.";
    }
    if (got.kind === "dne") {
      return "No es un caso de no existencia: el cociente tiene un valor claro.";
    }
    return "La respuesta esperada es " + pretty(ans) + ".";
  }

  function pretty(ans) {
    if (ans.kind === "rational") return ans.value.toDisplay();
    if (ans.kind === "infinite") return ans.sign > 0 ? "+∞" : "−∞";
    if (ans.kind === "dne") return "no existe";
    if (ans.kind === "si") return "sí";
    return String(ans.value);
  }

  function checkQuiz(problem, index) {
    if (!problem.quiz) return true;
    return Number(index) === Number(problem.quiz.correct);
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* --- Solución paso a paso ------------------------------------------- */

  function solutionHtml(problem) {
    var steps = problem.steps || [];
    var key = problem.keyStep;
    var out = [];
    out.push('<div class="sol">');
    if (problem.answer) {
      out.push('<p class="sol-head">Respuesta correcta: <strong>' + escHtml(answerToString(problem.answer)) + '</strong></p>');
    }
    out.push('<ol class="sol-steps">');
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      out.push('<li class="step' + (i === key ? ' is-key' : '') + '" data-step="' + i + '">');
      out.push('<div class="step-t">' + escHtml(s.title || ("Paso " + (i + 1))) + '</div>');
      if (s.detail) out.push('<div class="step-d">' + escHtml(s.detail) + '</div>');
      if (s.math) out.push('<div class="step-m"><span class="mathslot" data-math="' + i + '"></span></div>');
      out.push('</li>');
    }
    out.push('</ol>');
    if (problem.quiz && problem.quiz.explain) {
      out.push('<p class="sol-note">' + escHtml(problem.quiz.explain) + '</p>');
    }
    out.push('</div>');
    return out.join("");
  }

  /* =======================================================================
   * Export
   * ===================================================================== */

  global.Lim = {
    version: "mock",
    Q: Q,
    Poly: Poly,
    ast: ast,
    limit: limit,
    rng: rng,
    GENERATORS: GENERATORS,
    generatorList: generatorList,
    generate: generate,
    checkAnswer: checkAnswer,
    checkQuiz: checkQuiz,
    answerToString: answerToString,
    solutionHtml: solutionHtml,
    TOPICS: TOPICS,
    METHODS: METHODS,
    LEVELS: LEVELS
  };
})(typeof window !== "undefined" ? window : globalThis);