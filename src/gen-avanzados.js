/* =====================================================================
 * gen-avanzados.js — Extensión del motor de límites con los 7 generadores
 *                     que cubren los apartados de la Llista 1 de Cálculo
 *                     universitario que `engine.js` todavía no sabe hacer.
 *
 * Apartados cubiertos:
 *   · Ej. 4(b) 4(c) 4(d) 9(f)  →  lateral-exponencial
 *   · Ej. 5(d)                →  notable-x-sen-inv
 *   · Ej. 9(c) 9(e)           →  lim-h-diferencial
 *   · Ej. 9(d)                →  rad-doble-conjugado
 *   · Ej. 9(g) 9(h)           →  ind-uno-infinito-general
 *   · Ej. 9(l)                →  rad-obliqua
 *   · Ej. 9(n)                →  rad-crecimientos
 *
 * Se carga DESPUÉS de engine.js:
 *     <script src="src/engine.js"></script>
 *     <script src="src/gen-avanzados.js"></script>
 *
 * Sin dependencias. Sin import/export. Todo cuelga de `window.Lim`.
 * ===================================================================== */

(function (global) {
  "use strict";

  var L = global.Lim;
  if (!L) throw new Error("gen-avanzados.js necesita engine.js antes");

  /* ---------------------------------------------------------------------
   * Registro. `Lim.registrar` no existe en engine.js, así que se define
   * aquí de forma aditiva: si otro fichero lo crea antes, se respeta el
   * suyo. Lo que escribe es `Lim.GENERATORS`, que es lo que usan
   * `Lim.generatorList()` y `Lim.generate()`.
   * ------------------------------------------------------------------ */
  if (!L.registrar) {
    L.registrar = function (mapa) {
      for (var id in mapa) L.GENERATORS[id] = mapa[id];
      return mapa;
    };
  }
  if (!L.GENERATORS) L.GENERATORS = {};

  var Q = L.Q, Poly = L.Poly, AST = L.ast;

  /* =====================================================================
   * §1  ESPEJO DE LOS AYUDANTES DE engine.js §6
   *
   * engine.js no publica `ansInf`, `dist3`, `mkStep`, `buildProblem`… en el
   * global: son funciones internas de su fichero. Aquí se replican con el
   * MISMO comportamiento y, si algún día el motor las expone, se delegan
   * en las suyas (así el contrato no se duplica, solo se usa).
   * ===================================================================== */

  function ansRational(q) { return L.ansRational ? L.ansRational(q) : { kind: "rational", value: Q(q) }; }
  function ansInf(s) { return L.ansInf ? L.ansInf(s) : { kind: "infinite", sign: s >= 0 ? 1 : -1 }; }
  function ansDne() { return L.ansDne ? L.ansDne() : { kind: "dne" }; }
  function round6(v) { if (!isFinite(v)) return 0; return Number(v.toFixed(6)); }
  function ansNumeric(v) { return L.ansNumeric ? L.ansNumeric(v) : { kind: "numeric", value: round6(v) }; }

  /** Signo con símbolo tipográfico y sin espacio detrás: "−3", "+4". */
  function fmtSign(v) { return (v < 0 ? "−" : "+") + Math.abs(v); }
  /** Término con signo y espacio: "+ 3", "− 3". */
  function fmtTerm(v) { return (v < 0 ? "− " : "+ ") + Math.abs(v); }
  /** Decimal en formato español: 2.5 → "2,5". */
  function fmtDec(v, dec) {
    dec = dec === undefined ? 6 : dec;
    var s = Number(v).toFixed(dec);
    if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s.replace("-", "−").replace(".", ",");
  }

  function normText(s) {
    return String(s).toLowerCase()
      .replace(/[−–—]/g, "-")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ").trim();
  }

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

  /** Elige 3 distractores distintos entre sí y distintos de la respuesta. */
  function dist3(answer, candidates) {
    var good = [], seen = {}, i, j;
    seen[answerKeyOf(answer)] = true;
    function push(c) {
      if (!c) return;
      var k = answerKeyOf(c);
      if (seen[k]) return;
      seen[k] = true;
      good.push(c);
    }
    for (i = 0; i < (candidates || []).length; i++) push(candidates[i]);
    var pool = [
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
    for (j = 0; j < pool.length && good.length < 3; j++) push(pool[j]);
    if (good.length < 3) throw new Error("No se han podido construir 3 distractores");
    return good.slice(0, 3);
  }

  var INDET_OPCIONES = ["0/0", "∞/∞", "∞−∞", "0·∞", "1^∞", "no hay indeterminación"];

  function quizIndet(correctLabel, rand, explain) {
    var others = INDET_OPCIONES.filter(function (o) { return o !== correctLabel; });
    var picked = rand.shuffle(others).slice(0, 3);
    var options = rand.shuffle([correctLabel].concat(picked));
    return {
      kind: "indeterminacion",
      question: "¿Qué indeterminación aparece al sustituir?",
      options: options,
      correct: options.indexOf(correctLabel),
      explain: explain
    };
  }

  function quizMC(kind, question, correctText, distractors, rand, explain) {
    var options = rand.shuffle([correctText].concat(distractors.slice(0, 3)));
    return {
      kind: kind,
      question: question,
      options: options,
      correct: options.indexOf(correctText),
      explain: explain
    };
  }

  function mkStep(title, detail, math, key) {
    return { title: title, detail: detail, math: math || null, key: !!key };
  }

  function buildProblem(gen, rand, parts) {
    var p = {
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

  function targetPoint(at, side, varName) {
    var t = { type: "point", at: Q(at), side: side || null };
    if (varName) t.varName = varName;   /* límites cuya variable NO es x */
    return t;
  }
  function targetInf(sign) { return { type: "infinity", sign: sign === "-" ? "-" : "+" }; }

  function polyText(p) { return p.isZero() ? "0" : p.toString(); }
  function polyToAST(p) { return p.toAST(); }

  /** Texto de m·x + b con signos correctos: "−4x − 3", "3", "−3". */
  function linTxt(m, b) {
    var M = Number(m), B = Number(b);
    if (M === 0) return B === 0 ? "0" : fmtTerm(B).trim();
    var ini = M === 1 ? "x" : (M === -1 ? "−x" : fmtSign(M) + "x");
    if (B === 0) return ini;
    return ini + " " + fmtTerm(B).trim();
  }
  /** "√k" como texto plano. */
  function radTxt(k) { return "√" + k; }

  /* ---------------------------------------------------------------------
   * `Lim.targetLabel` escribe siempre "x → …" porque el motor solo conoce
   * la variable x.  Para `lim-h-diferencial` el objetivo va en h, así que
   * se envuelve la etiqueta respetando `target.varName` cuando existe.
   * El parche es ADITIVO e idempotente: sin `varName` el resultado es
   * idéntico al de engine.js.
   * ------------------------------------------------------------------ */
  if (typeof L.targetLabel === "function" && !L.targetLabel.__admiteVar) {
    var _origTL = L.targetLabel;
    var _tl = function (t) {
      var base = _origTL(t);
      if (t && t.varName && t.varName !== "x" && typeof base === "string") {
        return base.replace(/^x(\s*→)/, t.varName + "$1");
      }
      return base;
    };
    _tl.__admiteVar = true;
    L.targetLabel = _tl;
  }

  /* =====================================================================
   * §2  AYUDANTES DE CONSTRUCCIÓN DE AST (propios de estos generadores)
   * ===================================================================== */

  /** Variable del AST: `varNode("h")` → <mi>h</mi>. */
  function varNode(name) { return AST.var(name); }
  /** x − a, pero si a = 0 devuelve solo x (para que no salga "x−0"). */
  function deltaX(a) { return a === 0 ? AST.x() : AST.sub(AST.x(), AST.num(Q(BigInt(a)))); }
  /** Exponente m/(x − a) tal y como aparece en el temario: "1/(x−1)". */
  function expNodo(m, a) {
    var core = (m === 1 || m === -1) ? AST.num(Q.ONE) : AST.num(Q(BigInt(Math.abs(m))));
    var fr = AST.div(core, deltaX(a));
    return m < 0 ? AST.neg(fr) : fr;
  }
  /** m·x + p, omitiendo el término nulo (para que no salga "2x+0"). */
  function radLin(m, p) {
    var t = AST.mul(AST.num(Q(BigInt(m))), AST.x());
    if (!p) return t;
    return AST.add(t, AST.num(Q(BigInt(p))));
  }
  /** m·x^n + a·x^(n−1) + p como AST, con los coeficientes nulos omitidos. */
  function radPot(m, n, a, p) {
    var cf = [];
    for (var i = 0; i <= n; i++) cf.push(0);
    cf[n] = m; cf[n - 1] = a; cf[0] = p;
    return polyToAST(Poly.from(cf));
  }
  /** Suma de dos nodos, omitiendo el que valga 0. */
  function addN(a, b) {
    if (!a) return b;
    if (!b) return a;
    return AST.add(a, b);
  }
  /** "x²" / "x³" / "x" / "√x" como texto plano. */
  const SUPER = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  function sup(n) {
    var s = String(n), out = "";
    for (var i = 0; i < s.length; i++) out += SUPER[s[i]];
    return out;
  }
  function xSup(n) { return n === 1 ? "x" : "x" + sup(n); }
  /** x^(n/2) como texto: x^(1/2) = √x, x^(3/2) = x·√x, x^(2/2) = x… */
  function xMedio(n) {
    if (n === 1) return "√x";
    if (n % 2 === 0) return xSup(n / 2);
    return (n === 3 ? "x" : xSup((n - 1) / 2) + "·") + "√x";
  }
  /** m·x^(n/2) como texto (comportamiento asintótico de √(m·x^n)). */
  function asint(m, n) { return m + "·x^(" + (n / 2) + ")"; }

  /** "x − a" bien escrito también para a < 0: "x + 1", "x − 1", "x". */
  function deltaTxt(a) {
    return (a === 0) ? "x" : (a < 0 ? "x + " + (-a) : "x − " + a);
  }

  /** "A·a^n" omittingiendo los coeficientes 1: "2·3³", "x", "−1", "4". */
  function coefPot(A, a, n) {
    const mag = Math.abs(A * Math.pow(a, n));
    if (a === 0) return String(A);
    if (a === 1) return (A === 1 ? "1" : String(A));
    if (a === -1) return (A === 1 ? "−1" : (A === -1 ? "1" : "−" + Math.abs(A)));
    if (mag === 1) return "";
    return (A * a < 0 ? "−" : "") + mag + xSup(n);
  }

  /**
   * (x^n − a^n)/(x − a) = x^(n−1) + a·x^(n−2) + … + a^(n−1), como texto,
   * omitiendo los coeficientes 1:  n=4, a=1  ->  "(x³ + x² + x + 1)".
   */
  function difCuotasTxt(n, a) {
    const partes = [];
    for (let j = 0; j <= n - 1; j++) {
      const c = Math.pow(a, j), e = n - 1 - j, mag = Math.abs(c);
      const mon = (e === 0) ? "1"
        : (mag === 1 ? "x" + (e === 1 ? "" : sup(e)) : mag + "x" + (e === 1 ? "" : sup(e)));
      partes.push((c < 0 ? "−" : (partes.length ? "+ " : "")) + mon);
    }
    return "(" + partes.join(" ") + ")";
  }

  /** Respuesta m / (2·d·√k): racional si k es cuadrado perfecto, numérica si no. */
  function respSobreRaiz(m, d, k) {
    var r = Q.sqrtExact(Q(BigInt(k)));
    if (r) return ansRational(Q(BigInt(m)).div(Q(2).mul(Q(BigInt(d))).mul(r)));
    return ansNumeric(m / (2 * d * Math.sqrt(k)));
  }

  var MIS_GENERADORES = {};

  /* =====================================================================
   * §3  GENERADOR 1 — `rad-doble-conjugado`  (Llista 1, ej. 9(d))
   *
   *     lim ( √x − √4 ) / (x − 4)      con x → 4
   *
   * Racionalización de una diferencia de raíces en el NUMERADOR con
   * denominador polinómico.  El doble conjugado deja
   *
   *     (√(m·x + p) − √K) / (d·(x − a))  =  m / ( d·(√(m·x + p) + √K) )
   *
   * y al sustituir x = a la respuesta es m / (2·d·√K), que es IRRACIONAL
   * cuando K no es un cuadrado perfecto (lo habitual: se elige K así).
   *
   * La variante con dos raíces en el numerador suma los dos aportes:
   * m₁/(2√K₁) + m₂/(2√K₂).
   * ===================================================================== */
  MIS_GENERADORES["rad-doble-conjugado"] = {
    id: "rad-doble-conjugado",
    title: "Raíces en el numerador: doble conjugado",
    topic: "indeterminacion",
    method: "racionalizar",
    difficulty: 4,
    make: function (rand) {
      const v = rand.pick([1, 2]);
      const quiereCuadrado = rand.bool(0.25);
      const esCuadrado = function (k) { return Q.sqrtExact(Q(BigInt(k))) !== null; };

      /* m, a y p se eligen de modo que K = m·a + p > 0 y K sea (o no) un
       * cuadrado perfecto, manteniendo p pequeño para que la raíz quede
       * legible. */
      let m = 1, a = 1, p = 0, K = 1, intentos = 0;
      do {
        m = rand.pick([1, 2, 3]);
        a = rand.pick([1, 2, 3, 4]);
        p = rand.int(-4, 5);
        K = m * a + p;
        intentos++;
      } while (intentos < 60 && (K <= 0 || esCuadrado(K) !== quiereCuadrado));
      if (K <= 0) { m = 1; a = 2; p = 3; K = 5; }

      const rad = radLin(m, p);
      const raiz = AST.sqrt(rad);
      const den = deltaX(a);
      const numTxt = linTxt(m, p);
      const raizK = AST.sqrt(AST.num(Q(BigInt(K))));

      if (v === 1) {
        const d = rand.pick([1, 2, 3]);
        const expr = AST.div(AST.sub(raiz, raizK), AST.mul(AST.num(Q(BigInt(d))), den));
        const ans = respSobreRaiz(m, d, K);
        const ansTxt = (ans.kind === "rational") ? ans.value.toDisplay() : fmtDec(ans.value);
        const denFinal = AST.mul(AST.num(Q(BigInt(2 * d))), raizK);

        const pasos = [
          mkStep("Sustituimos y sale 0/0",
            "En x = " + a + " el numerador vale " + radTxt(K) + " − " + radTxt(K) + " = 0 y el denominador vale 0. " +
            "Aquí no se puede sustituir: 0/0 no es 0, es una indeterminación. Error típico: quedarse con 0 y seguir.",
            AST.div(AST.num(Q.ZERO), AST.num(Q.ZERO)), true),
          mkStep("Multiplicamos por el conjugado",
            "(√(" + numTxt + ") − " + radTxt(K) + ")·(√(" + numTxt + ") + " + radTxt(K) + ") = " + numTxt + " − " + K +
            " = " + m + "·(x − " + a + "). Se cancela el factor (x − " + a + ") con el del denominador: cancelar un " +
            "factor que solo vale 0 en el punto NO cambia el límite.",
            AST.div(AST.num(Q(BigInt(m))), AST.add(raiz, raizK))),
          mkStep("Sustituimos otra vez",
            "Queda " + m + " / (" + d + "·(√(" + numTxt + ") + " + radTxt(K) + ")), y en x = " + a + " el paréntesis " +
            "vale " + radTxt(K) + " + " + radTxt(K) + " = 2·" + radTxt(K) + ".",
            AST.div(AST.num(Q(BigInt(m))), denFinal)),
          mkStep("Resultado",
            "El límite es " + m + " / (" + (2 * d) + "·" + radTxt(K) + ") = " + ansTxt +
            (ans.kind === "numeric" ? " (un número irracional, porque " + radTxt(K) + " no es entero)." : "."),
            AST.num(ans.kind === "rational" ? ans.value : Q.fromNumber(ans.value)))
        ];

        return buildProblem(this, rand, {
          statement: { expr: expr, target: targetPoint(a, null), kind: "limit" },
          answer: ans,
          quiz: quizIndet("0/0", rand,
            "El numerador y el denominador se anulan a la vez en el punto: la indeterminación es 0/0 y se resuelve racionalizando el NUMERADOR con su conjugado (no el denominador). Error típico: quedarse con \"0/0 = 0\" y no seguir."),
          steps: pasos,
          keyStep: 0,
          distractors: dist3(ans, [
            ansNumeric(m / (d * Math.sqrt(K))),        /* olvidó una raíz de la suma */
            ansNumeric(-m / (2 * d * Math.sqrt(K))),    /* conjugado por el otro lado */
            ansRational(Q.ZERO),                        /* "0/0 = 0" */
            ansRational(Q.ONE)                          /* "0/0 = 1" */
          ]),
          internal: { kind: "doble-conjugado", v: 1, m: m, d: d, a: a, p: p, K: K }
        });
      }

      /* --- variante 2: dos raíces en el numerador ------------------- */
      let m2 = 1, K2 = 1, p2 = 0, intentos2 = 0;
      do {
        m2 = rand.pick([1, 2, 3]);
        p2 = rand.int(-4, 5);
        K2 = m2 * a + p2;
        intentos2++;
      } while (intentos2 < 60 && (K2 <= 0 || K2 === K));
      if (K2 <= 0 || K2 === K) { m2 = 1; p2 = 5 - a; K2 = a + p2; if (K2 <= 0 || K2 === K) { m2 = 2; p2 = 1; K2 = 2 * a + 1; } }

      const rad2 = radLin(m2, p2);
      const raiz2 = AST.sqrt(rad2);
      const raizK2 = AST.sqrt(AST.num(Q(BigInt(K2))));
      const num2 = AST.sub(AST.add(raiz, raiz2), AST.add(raizK, raizK2));
      const expr2 = AST.div(num2, den);
      const numTxt2 = linTxt(m2, p2);

      const r1 = Q.sqrtExact(Q(BigInt(K)));
      const r2 = Q.sqrtExact(Q(BigInt(K2)));
      let ans2, txt1, txt2;
      if (r1 === null && r2 === null) {
        ans2 = ansNumeric(m / (2 * Math.sqrt(K)) + m2 / (2 * Math.sqrt(K2)));
        txt1 = m + "/(2·" + radTxt(K) + ")";
        txt2 = m2 + "/(2·" + radTxt(K2) + ")";
      } else if (r1 === null) {
        ans2 = ansNumeric(m / (2 * Math.sqrt(K)) + m2 / (2 * r2.toNumber()));
        txt1 = m + "/(2·" + radTxt(K) + ")";
        txt2 = m2 + "/(2·" + r2.toDisplay() + ")";
      } else if (r2 === null) {
        ans2 = ansNumeric(m / (2 * r1.toNumber()) + m2 / (2 * Math.sqrt(K2)));
        txt1 = m + "/(2·" + r1.toDisplay() + ")";
        txt2 = m2 + "/(2·" + radTxt(K2) + ")";
      } else {
        ans2 = ansRational(Q(BigInt(m)).div(Q(2).mul(r1)).add(Q(BigInt(m2)).div(Q(2).mul(r2))));
        txt1 = m + "/(2·" + r1.toDisplay() + ")";
        txt2 = m2 + "/(2·" + r2.toDisplay() + ")";
      }
      const ans2Txt = (ans2.kind === "rational") ? ans2.value.toDisplay() : fmtDec(ans2.value);

      const pasos2 = [
        mkStep("Sustituimos y sale 0/0",
          "En x = " + a + ": " + radTxt(K) + " + " + radTxt(K2) + " − " + radTxt(K) + " − " + radTxt(K2) +
          " = 0 en el numerador, y 0 en el denominador. Indeterminación 0/0. Error típico: quedarse con " +
          "«0/0 = 0» y no seguir, o intentar racionalizar el denominador, que aquí es un polinomio y no tiene raíz.",
          AST.div(AST.num(Q.ZERO), AST.num(Q.ZERO)), true),
        mkStep("Repartimos en dos sumandos",
          "Como los dos trozos tienen el mismo denominador (x − " + a + "), se puede partir: " +
          "[√(" + numTxt + ") − " + radTxt(K) + "]/(x − " + a + ") + [√(" + numTxt2 + ") − " + radTxt(K2) + "]/(x − " + a + "). " +
          "Cada trozo es un 0/0 idéntico al del ejercicio anterior.",
          AST.div(num2, den)),
        mkStep("Racionalizamos cada trozo",
          "Con el conjugado: [√(" + numTxt + ") − " + radTxt(K) + "](√(" + numTxt + ") + " + radTxt(K) + ") = " +
          numTxt + " − " + K + " = " + m + "(x − " + a + "), y análogamente el segundo da " + m2 + "(x − " + a + "). " +
          "Cancelando (x − " + a + ") en los dos queda " + m + "/(√(" + numTxt + ") + " + radTxt(K) + ") + " +
          m2 + "/(√(" + numTxt2 + ") + " + radTxt(K2) + ").",
          AST.add(
            AST.div(AST.num(Q(BigInt(m))), AST.add(raiz, raizK)),
            AST.div(AST.num(Q(BigInt(m2))), AST.add(raiz2, raizK2)))),
        mkStep("Sustituimos y sumamos",
          "En x = " + a + " cada denominador vale 2·" + radTxt(K) + " y 2·" + radTxt(K2) + ", así que el límite es " +
          txt1 + " + " + txt2 + " = " + ans2Txt + ".",
          AST.num(ans2.kind === "rational" ? ans2.value : Q.fromNumber(ans2.value)))
      ];

      return buildProblem(this, rand, {
        statement: { expr: expr2, target: targetPoint(a, null), kind: "limit" },
        answer: ans2,
        quiz: quizMC("metodo", "¿Cómo se quita la raíz del numerador?",
          "Conjugando: (A − B)·(A + B) = A² − B², y A² − B² es un polinomio que se cancela",
          ["Sustituyendo directamente x = " + a + " en cada raíz",
            "Dividiendo numerador y denominador entre (x − " + a + ")²",
            "Racionalizando el denominador con 1/" + radTxt(K)],
          rand,
          "Cada raíz se va con su conjugado; lo que queda arriba es un polinomio que se anula en el punto y se cancela contra el denominador. Error típico: quedarse con 0/0 = 0 y no conjugar."),
        steps: pasos2,
        keyStep: 0,
        distractors: dist3(ans2, [
          ansNumeric(m / Math.sqrt(K) + m2 / Math.sqrt(K2)),
          ansNumeric(-(m / (2 * Math.sqrt(K)) + m2 / (2 * Math.sqrt(K2)))),
          ansRational(Q.ZERO),
          ansRational(Q.ONE)
        ]),
        internal: { kind: "doble-conjugado", v: 2, m: m, m2: m2, a: a, p: p, p2: p2, K: K, K2: K2 }
      });
    }
  };

  /* =====================================================================
   * §4  GENERADOR 2 — `rad-crecimientos`  (Llista 1, ej. 9(n))
   *
   *     lim √(x² + 2x) − √(3x)      con x → +infinito
   *
   * Los dos sumandos NO son comparables: √(x²+2x) ~ x (crece como x) y
   * √(3x) ~ √(3x) (crece como √x, muchísimo menos).  La diferencia se va a
   * +infinito: NO es una ∞−∞ resoluble por conjugado.  El paso clave es
   * COMPARAR EL CRECIMIENTO DE LOS RADICANDOS.
   *
   * Tres familias:
   *   A) grado(rad₁) > grado(rad₂)  →  +infinito
   *   B) grado(rad₁) < grado(rad₂)  →  −infinito
   *   C) grados iguales y mismo coeficiente principal → 0 (por conjugado)
   * ===================================================================== */
  MIS_GENERADORES["rad-crecimientos"] = {
    id: "rad-crecimientos",
    title: "Restas de raíces: manda el radicando de mayor grado",
    topic: "infinito",
    method: "jerarquia",
    difficulty: 4,
    make: function (rand) {
      const v = rand.pick([1, 2, 3]);

      /* --- C: mismos grados → el conjugado SÍ es obligatorio -------- */
      if (v === 3) {
        const d = rand.pick([1, 2]);
        const m = rand.pick([1, 2, 3, 4]);
        let p = rand.int(-3, 3), q = rand.int(-3, 3), intentos = 0;
        while (p === q && intentos < 25) { q = rand.int(-3, 3); intentos++; }
        if (p === q) q = p + 1;
        const r1 = Poly.from(d === 1 ? [p, m] : [p, 0, m]);
        const r2 = Poly.from(d === 1 ? [q, m] : [q, 0, m]);
        const A1 = r1.toAST(), A2 = r2.toAST();
        const expr = AST.sub(AST.sqrt(A1), AST.sqrt(A2));
        const ans = ansRational(Q.ZERO);
        const k = p - q;
        const kTxt = (k > 0 ? "" + k : "−" + Math.abs(k));
        const denTxt = xMedio(d);

        const pasos = [
          mkStep("Aquí sí hay ∞ − ∞ de verdad",
            "Los dos radicandos tienen el MISMO grado (" + xSup(d) + ") y el mismo coeficiente principal (" + m + "), así que " +
            "las dos raíces crecen exactamente igual. Ahora sí hace falta el conjugado. Error típico: dar el resultado " +
            "sin comprobar, porque ∞ − ∞ " + "parece que da 0.",
            expr, true),
          mkStep("Conjugamos y sale un número",
            "(√(" + polyText(r1) + ") − √(" + polyText(r2) + "))(√(" + polyText(r1) + ") + √(" + polyText(r2) + ")) = " +
            polyText(r1) + " − " + polyText(r2) + " = " + kTxt + ". La diferencia de los radicandos es una CONSTANTE " +
            "(porque los grados coinciden y solo difieren en el término independiente), no un polinomio que se vaya a infinito.",
            AST.div(AST.num(Q(BigInt(k))), AST.add(AST.sqrt(A1), AST.sqrt(A2)))),
          mkStep("El denominador se va a infinito",
            "√(" + polyText(r1) + ") + √(" + polyText(r2) + ") se comporta como 2·" + radTxt(m) + "·" + denTxt +
            ", que tiende a +infinito. Un número partido por algo que tiende a infinito es 0. Error típico: creer que " +
            "∞ − ∞ = 0 por las buenas; aquí vale porque el numerador es constante, no porque " + "restar infinitos dé 0.",
            AST.num(Q.ZERO)),
          mkStep("Resultado", "El límite es 0.", AST.num(Q.ZERO))
        ];

        return buildProblem(this, rand, {
          statement: { expr: expr, target: targetInf("+"), kind: "limit" },
          answer: ans,
          quiz: quizIndet("∞−∞", rand,
            "Se restan dos raíces que ambas se van a infinito: la indeterminación es ∞−∞ y aquí sí se resuelve con el conjugado, porque los radicandos tienen el mismo grado. Error típico: decir que ∞ − ∞ = 0 sin comprobar que el numerador conjugado sea una constante."),
          steps: pasos,
          keyStep: 0,
          distractors: dist3(ans, [ansInf(1), ansInf(-1), ansRational(Q.ONE), ansDne()]),
          internal: { kind: "crecimiento", v: 3, d: d, m: m, p: p, q: q }
        });
      }

      /* --- A y B: grados DISTINTOS, manda el mayor ------------------- */
      /* dP se toma SIEMPRE por debajo de dG: si los grados coincidieran
       * estaríamos en el caso ∞−∞ de verdad (variante 3) y el signo del
       * resultado depende de los coeficientes principales, no de los
       * grados. Forzar dP < dG es lo que hace correcto el +/−infinito. */
      const primeroManda = (v === 1);
      const dG = rand.pick(primeroManda ? [2, 3, 4] : [3, 4]);
      const dP = rand.int(1, dG - 1);
      const d1 = primeroManda ? dG : dP;
      const d2 = primeroManda ? dP : dG;

      const m1 = rand.pick([1, 2, 3]), m2 = rand.pick([1, 2, 3]);
      const a1 = rand.nonzero(4), p1 = rand.int(-4, 4), q2 = rand.int(-4, 4);
      const r1 = radPot(m1, d1, a1, p1);
      const r2 = radPot(m2, d2, 0, q2);
      const expr = AST.sub(AST.sqrt(r1), AST.sqrt(r2));
      const ans = primeroManda ? ansInf(1) : ansInf(-1);
      const signo = primeroManda ? 1 : -1;

      /* El radicando dominante y el coeficiente principal del numerador
       * que aparece al conjugar. */
      const domM = primeroManda ? m1 : m2;
      const domD = primeroManda ? d1 : d2;
      const lead = primeroManda ? m1 : -m2;
      const r1p = (function () {
        var cf = [];
        for (var i = 0; i <= d1; i++) cf.push(0);
        cf[d1] = m1; cf[d1 - 1] = a1; cf[0] = p1;
        return Poly.from(cf);
      })();
      const r2p = (function () {
        var cf = [];
        for (var i = 0; i <= d2; i++) cf.push(0);
        cf[d2] = m2; cf[0] = q2;
        return Poly.from(cf);
      })();
      const numDif = r1p.sub(r2p);

      const pasos = [
        mkStep("∞ − ∞ no siempre es una indeterminación",
          "Antes de conjugar hay que preguntar si los dos sumandos son COMPARABLES. Aquí √(" + polyText(r1p) +
          ") se comporta como " + asint(m1, d1) + " y √(" + polyText(r2p) + ") como " + asint(m2, d2) +
          ". Como " + dG + " > " + (primeroManda ? d2 : d1) + ", " +
          (primeroManda ? "el PRIMER término es infinitamente mayor que el segundo"
            : "el SEGUNDO término (que va en menos) es el que domina") + ". " +
          "Error típico: conjugar sin más y escribir [(" + polyText(r1p) + ") − (" + polyText(r2p) +
          ")]/(√… + √…) = 0; la diferencia de los radicandos NO es 0, es un polinomio de grado " + dG + ".",
          expr, true),
        mkStep("Comparamos el crecimiento de los radicandos",
          "El cociente de las dos raíces vale √(" + polyText(r1p) + ")/√(" + polyText(r2p) + ") ≈ " +
          fmtDec(Math.sqrt(m1 / m2)) + "·x^(" + ((d1 - d2) / 2) + "), que tiende a " +
          (primeroManda ? "+infinito" : "0") + ". O sea: " +
          (primeroManda ? "la primera raíz se lleva el resultado" : "la segunda raíz se lleva el resultado") + ".",
          AST.div(AST.sqrt(r1), AST.sqrt(r2))),
        mkStep("Lo comprobamos con el conjugado",
          "Con el conjugado sale lo mismo, y ahora está justificado: el numerador " + polyText(numDif) +
          " tiene grado " + dG + " y coeficiente principal " + (lead > 0 ? "" + lead : "−" + Math.abs(lead)) +
          "; el denominador se comporta como " + asint(domM, domD) + ". El cociente se comporta " +
          "como " + fmtDec(lead / (2 * Math.sqrt(domM))) + "·x^(" + (domD / 2) + "), que tiende a " +
          (signo > 0 ? "+infinito" : "−infinito") + ".",
          AST.div(numDif.toAST(), AST.add(AST.sqrt(r1), AST.sqrt(r2)))),
        mkStep("Resultado",
          "El límite es " + (signo > 0 ? "+infinito" : "−infinito") + ". No hay nada que indeterminate: " +
          "el término dominante se lleva el resultado.",
          AST.num(Q.ZERO))
      ];

      return buildProblem(this, rand, {
        statement: { expr: expr, target: targetInf("+"), kind: "limit" },
        answer: ans,
        quiz: quizIndet("∞−∞", rand,
          "Formalmente se restan dos raíces que se van a infinito (∞−∞), pero como los radicandos tienen distinto grado el resultado es un infinito con signo, no una indeterminación. Error típico: conjugar y afirmar que el numerador es 0 sin mirar sus grados."),
        steps: pasos,
        keyStep: 0,
        distractors: dist3(ans, [
          ansInf(-signo),          /* el signo del otro lado */
          ansDne(),                /* "∞−∞ no se puede restar" */
          ansRational(Q.ZERO),     /* "los dos se van a infinito, luego 0" */
          ansRational(Q.ONE)
        ]),
        internal: { kind: "crecimiento", v: v, d1: d1, d2: d2, m1: m1, m2: m2, a1: a1, p1: p1, q2: q2 }
      });
    }
  };

  /* =====================================================================
   * §5  GENERADOR 3 — `rad-obliqua`  (Llista 1, ej. 9(l))
   *
   *     lim ( √(x² − 3x) + x )     con x → −infinito
   *
   * Asíntota oblicua.  La racionalización EN EL INFINITO empieza siempre
   * por lo mismo:
   *
   *     √(p²x² + a·x + b) = √(x²·(p² + a/x + b/x²)) = |x|·√(p² + a/x + b/x²)
   *
   * y en −infinito |x| = −x.  Olvidar ese |x| (escribir √(x²) = x) lleva a
   * un infinito o a 0: ése es EL error clásico y los pasos lo avisan.
   *
   *   v1  x → −∞,  √(…) + p·x   →  −a/(2p)     (asíntota oblicua)
   *   v2  x → −∞,  √(…) − p·x   →  +infinito   (los términos NO se cancelan)
   *   v3  x → +∞,  √(…) − p·x   →  +a/(2p)     (cambia el signo del resultado)
   * ===================================================================== */
  MIS_GENERADORES["rad-obliqua"] = {
    id: "rad-obliqua",
    title: "Asíntota oblicua: racionalizar en el infinito",
    topic: "infinito",
    method: "racionalizar",
    difficulty: 5,
    make: function (rand) {
      const v = rand.pick([1, 2, 3]);
      const p = rand.pick([1, 2, 3]);
      const a = rand.pick([-6, -4, -2, 2, 4, 6]);
      const b = rand.int(-4, 4);

      const rad = Poly.from([b, a, p * p]);       /* p²x² + a·x + b */
      const R = rad.toAST();
      const raiz = AST.sqrt(R);
      const px = AST.mul(AST.num(Q(BigInt(p))), AST.x());
      const lado = (v === 3) ? "+" : "-";
      const expr = (v === 1) ? AST.add(raiz, px) : AST.sub(raiz, px);

      /* q/(2p) es el valor finito: q = −a si x → −∞, q = a si x → +∞. */
      const q = (v === 3) ? Q(BigInt(a)) : Q(BigInt(-a));
      const den2p = Q(BigInt(2 * p));
      const ans = (v === 2) ? ansInf(1) : ansRational(q.div(den2p));
      const valTxt = (v === 2) ? "+infinito" : q.div(den2p).toDisplay();
      const radPlano = polyText(rad);
      const linAB = linTxt(a, b);
      const masMenos = (v === 1 ? "+" : "−");
      const conjDen = (v === 1) ? AST.sub(raiz, px) : AST.add(raiz, px);

      const pasos = [
        mkStep("El paso clave: √(x²) es |x|, no x",
          "Al sacar la raíz de un cuadrado aparece un VALOR ABSOLUTO: √(" + p + "²x²) = " + p + "·|x|. " +
          (lado === "-"
            ? "Como x → −infinito, |x| = −x, así que √(" + radPlano + ") se comporta como −" + p + "x, no como " + p + "x."
            : "Como x → +infinito, |x| = x, así que √(" + radPlano + ") se comporta como " + p + "x.") +
          " Error típico: escribir √(x²) = x y cancelar de golpe, lo que da 0 (o un infinito con el signo cambiado) " +
          "en lugar de " + valTxt + ".",
          AST.mul(AST.num(Q(BigInt(p))), AST.abs(AST.x())), true),
        mkStep("Racionalizamos en el infinito",
          "Multiplicamos por el conjugado: (√(" + radPlano + ") " + masMenos + " " + p + "x)(√(" + radPlano +
          ") ∓ " + p + "x) = " + radPlano + " − " + p + "²x² = " + linAB + ". O sea, la expresión original vale " +
          "[" + linAB + "] / (√(" + radPlano + ") ∓ " + p + "x). Ya no hay raíces arriba: solo un polinomio lineal.",
          AST.div(Poly.lin(a, b).toAST(), conjDen)),
        mkStep("Dividimos entre |x| = " + (lado === "-" ? "−x" : "x"),
          (v === 2
            ? "El denominador de arriba es √(" + radPlano + ") + " + p + "x, que es justo la expresión de la " +
              "asíntota oblicua y tiende al número FINITO " + Q(BigInt(-a)).div(den2p).toDisplay() +
              ". El numerador " + linAB + " se va a infinito. Un infinito partido por un número no nulo " +
              "sigue siendo infinito: el signo sale de los dos y el resultado es +infinito."
            : "El numerador " + linAB + " dividido entre |x| tiende a " + (a < 0 ? "−" + Math.abs(a) : "" + a) +
              ". El denominador, al dividir entre |x|, queda √(" + radPlano + ")/|x| " + (v === 1 ? "− " : "+ ") +
              p + "·x/|x| → " + p + " " + (v === 1 ? "− " : "+ ") + p + "·(" + (lado === "-" ? "−1" : "1") +
              ") = " + p + " " + (v === 1 ? "+ " : "+ ") + p + " = " + (2 * p) + ". Ojo: √(" + radPlano +
              ")/|x| = √(" + p + "² " + fmtTerm(a) + "/x " + fmtTerm(b) + "/x²) → " + p +
              (lado === "-" ? ", NO −" + p : "") + ", porque |x| = " + (lado === "-" ? "−x" : "x") + "."),
          v === 2 ? AST.num(Q.ZERO) : AST.div(Poly.lin(a, b).toAST(),
            AST.add(AST.num(Q(BigInt(p))), AST.num(Q(BigInt(p)))))),
        mkStep("Resultado",
          (v === 2
            ? "El límite es +infinito: aquí los términos de grado 1 NO se cancelan, así que no hay asíntota oblicua. " +
              "Un error típico es hacer el mismo razonamiento que en el caso " + radTxt(p) + "·|x| y esperar " +
              Q(BigInt(-a)).div(den2p).toDisplay() + "."
            : "El límite es " + (v === 1 ? "−(" + a + ")" : (a < 0 ? "−" + Math.abs(a) : "" + a)) +
              "·x/(2·" + p + "·x) = " + valTxt + ", que es la pendiente de la asíntota oblicua."),
          v === 2 ? AST.num(Q.ZERO) : AST.num(ans.value))
      ];

      const distractores = (v === 2)
        ? [ansRational(Q.ZERO),                        /* ignorar |x| → 0 */
           ansRational(Q(BigInt(-a)).div(den2p)),      /* "se cancela" */
           ansInf(-1),
           ansRational(Q.ONE)]
        : [ansInf(lado === "-" ? -1 : 1),             /* ignorar |x| → infinito */
           ansRational(q.neg().div(den2p)),           /* signo cambiado */
           ansRational(Q.ZERO),
           ansInf(lado === "-" ? 1 : -1)];

      return buildProblem(this, rand, {
        statement: {
          expr: expr,
          target: targetInf(lado),
          kind: "limit",
          question: "Calcula el límite en el infinito. ¡Ojo con el valor absoluto que aparece al sacar la raíz!"
        },
        answer: ans,
        quiz: quizMC("metodo", "¿Cuál es el paso que decide este límite?",
          "Escribir √(" + p + "²x²) = " + p + "·|x| y usar |x| = −x en −infinito (o |x| = x en +infinito)",
          ["Conjugar y dejar 0/(√… + √…), que vale 0",
            "Dividir numerador y denominador entre x y decir que los dos valen 0",
            "Sustituir directamente x = " + (lado === "-" ? "−infinito" : "+infinito")],
          rand,
          "La raíz cuadrada de x² es |x|, no x. Error típico: escribir √(x²) = x y cancelar de golpe; ese signo cambia el resultado por completo y es el error que más se repite en este tipo de ejercicios."),
        steps: pasos,
        keyStep: 0,
        distractors: dist3(ans, distractores),
        internal: { kind: "obliqua", v: v, p: p, a: a, b: b, lado: lado }
      });
    }
  };

  /* =====================================================================
   * §6  GENERADOR 4 — `lim-h-diferencial`  (Llista 1, ej. 9(c) y 9(e))
   *
   *     lim ((x+h)² − x²)/h          con h → 0     →  2x
   *     lim (√(x+h) − √x)/h          con h → 0     →  1/(2√x)
   *
   * La variable del límite es h, NO x: es la definición de derivada.  Como
   * el motor asume `x` como variable:
   *   · el AST se construye con AST.var("h")   (`Lim.ast.var` lo admite)
   *   · `statement.target` lleva `varName: "h"` y se extiende `targetLabel`
   *   · x queda como el PUNTO donde se evalúa la derivada
   *   · `statement.question` lo dice en texto, porque el "lim" de la
   *     interfaz se pinta en MathML con la variable fija (limitación de la
   *     vista, no del dato).
   * ===================================================================== */
  MIS_GENERADORES["lim-h-diferencial"] = {
    id: "lim-h-diferencial",
    title: "Límite en h: la definición de derivada",
    topic: "indeterminacion",
    method: "notable",
    difficulty: 4,
    make: function (rand) {
      const v = rand.pick([1, 2, 3, 4]);
      const H = varNode("h");
      const fh = function (k) { return AST.add(H, AST.num(Q(BigInt(k)))); };  /* h + k */
      let a, k = 1, expr, ans, pasos, nombre, extra = {};

      if (v === 1 || v === 2) {
        /* --- polinómico: ((a+h)^n − a^n)/h --------------------------- */
        const n = (v === 1) ? 2 : 3;
        a = (n === 2) ? rand.pick([-3, -2, -1, 1, 2, 3]) : rand.pick([-2, -1, 1, 2]);
        const an = Math.pow(a, n);
        expr = AST.div(AST.sub(AST.powN(fh(a), n), AST.num(Q(BigInt(an)))), H);
        const exacto = Q(BigInt(n)).mul(Q(BigInt(a)).pow(n - 1));
        ans = ansRational(exacto);
        /* (a+h)^n − a^n DEVELOPPADO, para el detail */
        const desarrollo = (n === 2)
          ? linTxt(2 * a, 0) + " + h^2"
          : linTxt(3 * a * a, 0) + " + " + linTxt(3 * a, 0) + "h + h^3";
        const simplificado = (n === 2)
          ? linTxt(2 * a, 0) + " + h"
          : linTxt(3 * a * a, 0) + " + " + linTxt(3 * a, 0) + " + h^2";
        nombre = "la derivada de " + (n === 2 ? "x²" : "x³") + " en x = " + a;
        extra = { n: n };

        pasos = [
          mkStep("La variable del límite es h, no x",
            "El enunciado pide el límite cuando h → 0. La x es un NÚMERO FIJO (el punto donde se evalúa la derivada) " +
            "y la h es el incremento. Error típico: leer «x → 0», sustituir x = 0 y quedarse con h en el numerador, " +
            "o tratar h como constante y ponerla a 0 antes de tiempo.",
            expr, true),
          mkStep("Es la definición de derivada",
            "La derivada se define como lim, cuando h → 0, de (f(x+h) − f(x))/h. Con f(x) = " + (n === 2 ? "x²" : "x³") +
            " y x = " + a + ", este límite es exactamente f′(" + a + "), con h → 0.",
            expr),
          mkStep("Desarrollamos y simplificamos",
            "El binomio de Newton da (" + (a < 0 ? "−" + Math.abs(a) : String(a)) + " + h)^" + sup(n) + " − " +
            (an < 0 ? "−" + Math.abs(an) : String(an)) + " = " + desarrollo + ". Al dividir entre h se cancela una h " +
            "(se puede porque h ≠ 0 al acercarnos al límite, que es justo lo que pasa) y queda " + simplificado +
            " → " + exacto.toDisplay() + ".",
            AST.num(exacto)),
          mkStep("Resultado",
            "El límite es " + exacto.toDisplay() + ", que es el valor de " + nombre + ".",
            AST.num(exacto))
        ];
      } else {
        /* --- radical: (√(a + k·h) − √a)/h ---------------------------- */
        a = rand.pick([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        if (v === 4) k = rand.pick([2, 3, 4]);
        const radH = (k === 1) ? fh(a) : AST.add(AST.num(Q(BigInt(a))), AST.mul(AST.num(Q(BigInt(k))), H));
        const raizA = AST.sqrt(AST.num(Q(BigInt(a))));
        expr = AST.div(AST.sub(AST.sqrt(radH), raizA), H);
        const r = Q.sqrtExact(Q(BigInt(a)));
        const exacto = (r === null) ? null : Q(BigInt(k)).div(Q(2).mul(r));
        ans = (exacto === null) ? ansNumeric(k / (2 * Math.sqrt(a))) : ansRational(exacto);
        const denTxt = (k === 1) ? ("√" + a + " + √" + a) : ("√(" + a + " + " + k + "h) + √" + a);
        const radTxtH = (k === 1) ? (a + " + h") : (a + " + " + k + "h");
        nombre = "la derivada de √x en x = " + a;
        extra = { k: k };

        pasos = [
          mkStep("La variable del límite es h, no x",
            "El límite es cuando h → 0; x = " + a + " está fijado. Error típico: creer que el límite es en x, " +
            "sustituir x = 0 y quedarse con √0 − √0 partido por 0, que es el 0/0 equivocado.",
            expr, true),
          mkStep("Es la definición de derivada",
            "Volvemos a la definición de derivada: lim, con h → 0, de (f(x+h) − f(x))/h. Ahora f(x) = √x y " +
            "x = " + a + ", así que el límite es f′(" + a + ").",
            expr),
          mkStep("Racionalizamos el numerador",
            "(√(" + radTxtH + ") − √" + a + ")·(√(" + radTxtH + ") + √" + a + ") = (" + radTxtH + ") − " + a +
            " = " + (k === 1 ? "h" : k + "h") + ". Se cancela la h contra la del denominador y queda " +
            k + "/(" + denTxt + ").",
            AST.div(AST.num(Q(BigInt(k))), AST.add(AST.sqrt(radH), raizA))),
          mkStep("Sustituimos h = 0 y obtenemos el valor",
            "El denominador se queda en √" + a + " + √" + a + " = 2·√" + a + ", así que el límite es " + k +
            " / (2·√" + a + ") = " + (exacto ? exacto.toDisplay() : fmtDec(ans.value)) +
            (exacto === null ? " (un número irracional, porque √" + a + " no es entero)." : "."),
            AST.num(ans.kind === "rational" ? ans.value : Q.fromNumber(ans.value)))
        ];
      }

      const aTxt = String(a);
      return buildProblem(this, rand, {
        statement: {
          expr: expr,
          target: targetPoint(0, null, "h"),
          kind: "limit",
          question: "Calcula el límite cuando h → 0 (x es un número fijo: x = " + aTxt + "). Esto es " + nombre + "."
        },
        answer: ans,
        quiz: quizMC("metodo", "¿Qué representa este límite?",
          "Es la definición de derivada: con h → 0, (f(x+h) − f(x))/h tiende a f′(x)",
          ["Es un límite en x: se sustituye x = 0 y se divide entre 0",
            "Es un límite notable del seno, porque la h hace de ángulo",
            "Es una indeterminación 0·∞ que hay que pasar a cociente"],
          rand,
          "La h del numerador es un incremento que tiende a 0: ese cociente es exactamente la definición de derivada en el punto x = " + aTxt + ". Error típico: leer el enunciado como un límite en x y sustituir x = 0."),
        steps: pasos,
        keyStep: 0,
        distractors: dist3(ans, (ans.kind === "rational")
          ? [
            ansRational(ans.value.mul(Q.TWO)),   /* derivada equivocada */
            ansRational(Q.ZERO),                /* "pongo h = 0 antes de tiempo" */
            ansRational(ans.value.neg()),       /* signo cambiado */
            ansRational(Q.ONE)
          ]
          : [
            ansNumeric(1 / Math.sqrt(a)),       /* olvidó el factor k */
            ansNumeric(-ans.value),             /* conjugado por el otro lado */
            ansNumeric(ans.value * 2),          /* se olvidó del 2 */
            ansRational(Q.ZERO)
          ]),
        internal: Object.assign({ kind: "diferencial", v: v, x: a, varName: "h", at: 0 }, extra)
      });
    }
  };

  /* =====================================================================
   * §7  GENERADOR 5 — `ind-uno-infinito-general`  (Llista 1, ej. 9(g) y 9(h))
   *
   * Estudio GENERAL de lim f(x)^{g(x)} en un punto:
   *
   *   v1 — f → 1 y g → ±infinito.  SÍ es 1^∞:  lim f^g = e^{lim g·(f−1)}.
   *        (familia del ej. 9(h))
   *   v2 — f → c ≠ 1 y g → ±infinito.  NO hay indeterminación: +infinito o 0.
   *        (familia del ej. 9(g): la base tiende a 2, no a 1)
   *   v3 — f → 1 y g → ±infinito pero g·(f−1) → 0:  el límite es 1.
   *
   * El filtro de parámetros de v1 impide que e^L se redondee a 0 (si |L| > 9
   * el motor guardaría "0", que aceptaría cualquier respuesta pequeña).
   * ===================================================================== */
  MIS_GENERADORES["ind-uno-infinito-general"] = {
    id: "ind-uno-infinito-general",
    title: "Potencias en el punto: 1^∞ y potencias de base constante",
    topic: "indeterminacion",
    method: "numeroE",
    difficulty: 5,
    make: function (rand) {
      const v = rand.pick([1, 2, 3]);

      /* ---------------- v3: 1^∞ cuyo resultado es 1 ------------------ */
      if (v === 3) {
        const k = rand.pick([1, 2, 3]);
        const a = rand.pick([-1, 0, 1, 2]);
        const m = rand.pick([1, 2, -1, -2]);
        const base = Poly.quad(k, -2 * k * a, 1 + k * a * a);    /* 1 + k(x − a)² */
        const expr = AST.pow(base.toAST(), expNodo(m, a));
        const ans = ansRational(Q.ONE);

        const pasos = [
          mkStep("Base → 1 y exponente → " + (m > 0 ? "+infinito" : "−infinito") + ": 1^∞ de verdad",
            "En x = " + a + " la base vale 1 y el exponente " + m + "/(" + deltaTxt(a) + ") se dispara: aquí SÍ hay " +
            "indeterminación 1^∞. Error típico: decidir sin mirar que 1^∞ no siempre da lo mismo; depende de " +
            "cuánto vale lim g·(f − 1).",
            expr, true),
          mkStep("Identificamos la base como 1 + k·(x − a)²",
            "El polinomio " + polyText(base) + " se puede escribir como 1 + " + k + "·(" + deltaTxt(a) + ")². Entonces " +
            "f − 1 = " + k + "·(" + deltaTxt(a) + ")², que tiende a 0 MUCHO más deprisa que 1/(" + deltaTxt(a) + "), que tiende " +
            "a infinito. Ese es el detalle que lo cambia todo.",
            base.toAST()),
          mkStep("L = g·(f − 1) tiende a 0",
            "L = " + m + "/(" + deltaTxt(a) + ") · " + k + "·(" + deltaTxt(a) + ")² = " + (m * k) + "·(" +
            deltaTxt(a) + ") → 0. El " +
            "denominador es de grado 1 y el numerador de grado 2, así que el producto es lineal y se anula.",
            AST.num(Q.ZERO)),
          mkStep("Resultado",
            "El límite es e^0 = 1. Error típico: responder e (que sería el resultado si L valiera 1) o 0 " +
            "(creyendo que ∞·0 es 0 sin comparar los grados).",
            AST.num(Q.ONE))
        ];

        return buildProblem(this, rand, {
          statement: { expr: expr, target: targetPoint(a, null), kind: "limit" },
          answer: ans,
          quiz: quizIndet("1^∞", rand,
            "La base tiende a 1 y el exponente a infinito: es una 1^∞, y se resuelve calculando L = lim g·(f − 1). Error típico: decidir el resultado sin calcular L (por ejemplo, dar 1 o e por costumbre)."),
          steps: pasos,
          keyStep: 0,
          distractors: dist3(ans, [
            ansNumeric(Math.E),     /* "1^infinito = e" */
            ansRational(Q.ZERO),    /* "0·infinito = 0" */
            ansInf(1),
            ansInf(-1),
            ansDne()
          ]),
          internal: { kind: "potencia", v: 3, k: k, a: a, m: m, L: 0 }
        });
      }

      /* ---------------- v2: base constante ≠ 1 ----------------------- */
      if (v === 2) {
        const c = rand.pick([2, 3, 4, 5]);
        const A = rand.pick([1, 2, 3]);
        const n = rand.pick([2, 3, 4]);
        const a = rand.pick([0, 1, 2, 3]);
        const m = rand.pick([1, 2, -1, -2]);
        const B = c - A * Math.pow(a, n);
        const base = addN(AST.mul(AST.num(Q(BigInt(A))), AST.powN(AST.x(), n)),
          B === 0 ? null : AST.num(Q(BigInt(B))));
        const expr = AST.pow(base, expNodo(m, a));
        const ans = (m > 0) ? ansInf(1) : ansRational(Q.ZERO);
        const baseTxt = (A === 1 ? "" : String(A)) + xSup(n) + (B === 0 ? "" : " " + fmtTerm(B).trim());

        const pasos = [
          mkStep("La base NO tiende a 1: aquí no hay indeterminación",
            "Al sustituir x = " + a + ", la base " + baseTxt + " vale " +
            (coefPot(A, a, n) + (B === 0 ? "" : " " + fmtTerm(B).trim())) + " = " + c + ", no 1. El exponente " + m + "/(x − " + a +
            ") sí se va a " + (m > 0 ? "+infinito" : "−infinito") +
            ". Error típico: ver «base y exponente» y decir 1^∞ por costumbre; si la base tiende a 1 hay " +
            "indeterminación, pero aquí tiende a " + c + " y el resultado ya está decidido.",
            expr, true),
          mkStep("Tabla de potencias con base mayor que 1",
            "Si la base es mayor que 1, " + c + "^(+infinito) = +infinito y " + c + "^(−infinito) = 0. Con una base " +
            "entre 0 y 1 pasaría justo lo contrario (0^∞ = 0 y 0^(−∞) = ∞): por eso el valor " + c + " importa.",
            AST.pow(AST.num(Q(BigInt(c))), AST.num(Q(BigInt(m > 0 ? 40 : -40))))),
          mkStep("Aplicamos el signo del exponente",
            m > 0
              ? "El exponente se va a +infinito y la base " + c + " es mayor que 1, así que la potencia se va a +infinito."
              : "El exponente se va a −infinito y la base " + c + " es mayor que 1, así que la potencia se acerca a 0 " +
                "(equivale a dividir por una potencia que se dispara).",
            m > 0 ? AST.num(Q.ZERO) : AST.num(Q.ONE)),
          mkStep("Resultado",
            "El límite es " + (m > 0 ? "+infinito" : "0") + ". No aparece ninguna de las cuatro indeterminaciones " +
            "—tampoco la 1^∞— porque la base se aleja de 1. Si la base fuera negativa, además, la potencia ni " +
            "siquiera estaría definida en ℝ.",
            AST.num(Q.ZERO))
        ];

        return buildProblem(this, rand, {
          statement: {
            expr: expr, target: targetPoint(a, null), kind: "limit",
            question: "Ojo: la base de esta potencia es un polinomio. Calcula el límite en x = " + a + "."
          },
          answer: ans,
          quiz: quizIndet("no hay indeterminación", rand,
            "La base tiende a " + c + " (distinto de 1) y el exponente a infinito: no hay ninguna indeterminación, el resultado se decide con la tabla de potencias. Error típico: aplicar la fórmula de 1^∞ sin comprobar que la base tienda a 1."),
          steps: pasos,
          keyStep: 0,
          distractors: dist3(ans, [
            ansDne(),              /* "exponente infinito, no existe" */
            ansInf(-1),            /* signo del exponente cambiado */
            ansRational(Q.ONE),    /* "base^0 = 1" */
            ansRational(Q.ZERO)
          ]),
          internal: { kind: "potencia", v: 2, A: A, n: n, a: a, m: m, B: B, c: c }
        });
      }

      /* ---------------- v1: 1^∞ con resultado irracional ------------- */
      /* L = m·A·n·a^(n−1).  Se exige 1 ≤ |L| ≤ 9 para que e^L no se
       * redondee a 0 ni sea desmedidamente grande. */
      let A = 1, n = 2, a = 1, m = 1, L = 1, intentos = 0;
      do {
        A = rand.pick([1, 2, 3]);
        n = rand.pick([2, 3, 4]);
        a = rand.pick([-1, 1, 2]);
        m = rand.pick([1, 2, -1, -2]);
        L = m * A * n * Math.pow(a, n - 1);
        intentos++;
      } while (intentos < 120 && (L === 0 || Math.abs(L) > 9));
      if (L === 0 || Math.abs(L) > 9) { A = 1; n = 2; a = 1; m = 2; L = 2; }

      const c0 = 1 - A * Math.pow(a, n);
      const base = addN(AST.mul(AST.num(Q(BigInt(A))), AST.powN(AST.x(), n)),
        c0 === 0 ? null : AST.num(Q(BigInt(c0))));
      const expo = expNodo(m, a);
      const expr = AST.pow(base, expo);
      const valor = Math.exp(L);
      const ans = ansNumeric(valor);

      /* (x^n − a^n)/(x − a) = x^(n−1) + a·x^(n−2) + … + a^(n−1) */
      const factorTxt = difCuotasTxt(n, a);
      const factorNodo = (n === 2) ? AST.add(AST.x(), AST.num(Q(BigInt(a))))
        : (n === 3) ? Poly.quad(1, a, a * a).toAST()
          : Poly.cubic(1, a, a * a, a * a * a).toAST();
      const valorFactor = n * Math.pow(a, n - 1);

      const pasos = [
        mkStep("Base → 1 y exponente → " + (m > 0 ? "+infinito" : "−infinito") + ": 1^∞",
          "En x = " + a + " la base vale " + (c0 === 0 ? "1" :
            (coefPot(A, a, n) + " " + fmtTerm(c0).trim())) +
          ", y el exponente " + m + "/(" + deltaTxt(a) + ") se va a " + (m > 0 ? "+infinito" : "−infinito") +
          ". Indeterminación 1^∞: no se puede calcular por separado. Error típico: decir que 1^(infinito) es 1 o " +
          "es infinito; ninguna de las dos es correcta en general.",
          expr, true),
        mkStep("Usamos f^g = e^(g·(f − 1))",
          "Escribimos f = 1 + u con u = f − 1 → 0 y usamos (1 + u)^g → e^(g·u). Entonces el límite es e^L, con " +
          "L = lim " + m + "/(" + deltaTxt(a) + ") · (f(x) − 1).",
          AST.pow(AST.num(Q.ONE), expo)),
        mkStep("Calculamos f − 1 y simplificamos",
          "f − 1 = " + A + "·x^" + sup(n) +
          (c0 === 0 ? "" : " " + fmtTerm(c0).trim()) + " − 1 = " + A +
          "·(x^" + sup(n) + " − " + a + sup(n) + ") = " + A + "·(" + deltaTxt(a) + ")·" + factorTxt + ". El factor " +
          "(" + deltaTxt(a) + ") se cancela con el del exponente (solo vale 0 en el punto, y cancelar eso no cambia el " +
          "límite) y queda L = " + m + "·" + A + "·" + factorTxt + ".",
          AST.mul(AST.num(Q(BigInt(m * A))), factorNodo)),
        mkStep("Resultado",
          "En x = " + a + ", " + factorTxt + " vale " + valorFactor + ", así que L = " + m + "·" + A + "·" +
          valorFactor + " = " + L + " y el límite es e^" + L + " ≈ " + fmtDec(valor) + ".",
          AST.num(Q.fromNumber(round6(valor))))
      ];

      return buildProblem(this, rand, {
        statement: { expr: expr, target: targetPoint(a, null), kind: "limit" },
        answer: ans,
        quiz: quizIndet("1^∞", rand,
          "La base tiende a 1 y el exponente a infinito: la indeterminación es 1^∞ y se resuelve con la fórmula del número e; aquí L = lim g·(f − 1) = " + L + ". Error típico: creer que 1^(infinito) vale 1 o infinito, que no es cierto en general."),
        steps: pasos,
        keyStep: 0,
        distractors: dist3(ans, [
          ansNumeric(Math.exp(-L)),     /* el signo de L cambiado */
          ansRational(Q.ONE),           /* "1^infinito = 1" */
          ansInf(L > 0 ? 1 : -1),       /* "el exponente se va a infinito" */
          ansNumeric(L)                 /* confunde L con el resultado */
        ]),
        internal: { kind: "potencia", v: 1, A: A, n: n, a: a, m: m, L: L, valor: valor }
      });
    }
  };

  /* =====================================================================
   * §8  GENERADOR 6 — `lateral-exponencial`  (Llista 1, ej. 4(b) 4(c) 4(d) 9(f))
   *
   * Laterales en los que el exponente (o el denominador) hace 1/0 DENTRO de
   * una función continua.  La regla es una sola:
   *
   *     dentro de una función continua, sustituir el límite del argumento;
   *     e^(+infinito) = +infinito   y   e^(−infinito) = 0  (NUNCA 1)
   *
   * Variantes:
   *   v1  A/(B + e^(m/(x−a)))               dos lados   → no existe
   *   v2  e^(k/|x−a|)                       dos lados   → +infinito
   *   v3  c^(m/(x−a))                       dos lados   → no existe
   *   v4  A/(B + e^(m/(x−a)))               por UN lado → 0 o A/B
   *   v5  (e^(m/(x−a)) − 1)/(e^(m/(x−a)) + 1)  dos lados → no existe
   * ===================================================================== */
  MIS_GENERADORES["lateral-exponencial"] = {
    id: "lateral-exponencial",
    title: "Laterales con exponente que se va a infinito",
    topic: "sustitucion",
    method: "lateral",
    difficulty: 4,
    make: function (rand) {
      const v = rand.pick([1, 2, 3, 4, 5]);
      const a = rand.pick([-2, -1, 0, 1, 2, 3]);
      const m = rand.pick([1, 2, -1, -2]);
      const denX = deltaX(a);
      const denTxt = (a === 0) ? "x" : ("x − " + a);
      const mAbs = (m === 1 || m === -1) ? "1" : String(Math.abs(m));
      const mTxt = (m < 0 ? "−" : "") + mAbs;
      /* e^(m/(x−a)) */
      const eNodo = AST.exp(AST.div(
        (m === 1 || m === -1) ? AST.num(Q.ONE) : AST.num(Q(BigInt(Math.abs(m)))),
        m < 0 ? AST.neg(denX) : denX));

      /* --- v2: e^(k/|x−a|) → +infinito ------------------------------ */
      if (v === 2) {
        const k = rand.pick([1, 2, 3]);
        const expr = AST.exp(AST.div(AST.num(Q(BigInt(k))), AST.abs(denX)));
        const ans = ansInf(1);
        const pasos = [
          mkStep("Dentro de una función continua se sustituye el límite del argumento",
            "El valor absoluto NUNCA es negativo: |" + denTxt + "| > 0 para cualquier x ≠ " + a + ". Por los dos lados " +
            k + "/|" + denTxt + "| → +infinito, y como la exponencial es continua e^(+infinito) = +infinito. " +
            "Error típico: creer que por la izquierda el argumento vale −infinito (eso pasaría con 1/(" + denTxt +
            ") SIN valor absoluto) y obtener e^(−infinito) = 0.",
            expr, true),
          mkStep("Por la derecha",
            "x − " + a + " → 0 por la derecha, así que |x − " + a + "| → 0, el argumento → +infinito y el " +
            "exponente se dispara a +infinito.",
            expr),
          mkStep("Por la izquierda",
            "Exactamente lo mismo: |x − " + a + "| → 0, el argumento → +infinito y e^(+infinito) = +infinito. " +
            "El valor absoluto es lo que iguala los dos lados.",
            expr),
          mkStep("Resultado",
            "Los dos laterales coinciden en +infinito, así que el límite es +infinito (y no un «no existe»).",
            AST.num(Q.ZERO))
        ];
        return buildProblem(this, rand, {
          statement: { expr: expr, target: targetPoint(a, null), kind: "limit" },
          answer: ans,
          quiz: quizMC("metodo", "¿Por qué aquí no hay «no existe» aunque el argumento se vaya a infinito?",
            "Porque |" + denTxt + "| es positivo por los dos lados: el argumento va a +infinito en ambos",
            ["Porque la exponencial es continua y se puede sustituir el límite del argumento",
              "Porque e^x tiende a 0 cuando x → +infinito",
              "Porque el valor absoluto en el punto vale 0"],
            rand,
            "El error típico es pensar que por la izquierda el argumento es negativo. Con valor absoluto no lo es nunca: por eso los dos laterales coinciden y hay límite."),
          steps: pasos,
          keyStep: 0,
          distractors: dist3(ans, [ansInf(-1), ansDne(), ansRational(Q.ZERO), ansRational(Q.ONE)]),
          internal: { kind: "exp-lateral", v: 2, a: a, k: k }
        });
      }

      /* --- v3: c^(m/(x−a)) → no existe ------------------------------ */
      if (v === 3) {
        const c = rand.pick([2, 3, 4, 5]);
        const expr = AST.pow(AST.num(Q(BigInt(c))), expNodo(m, a));
        const ans = ansDne();
        const der = (m > 0) ? "+infinito" : "0";
        const izq = (m > 0) ? "0" : "+infinito";
        const pasos = [
          mkStep("Base constante, exponente que cambia de signo",
            "La base es " + c + " (fija, mayor que 1) y el exponente " + mTxt + "/(" + denTxt + ") se va a +infinito " +
            "por la derecha y a −infinito por la izquierda. Con base mayor que 1, " + c + "^(+infinito) = +infinito y " +
            c + "^(−infinito) = 0. Error típico: aplicar e^(−infinito) = 0 a una base cualquiera; eso solo vale " +
            "cuando la base es e, o cuando la base está entre 0 y 1.",
            expr, true),
          mkStep("Límite por la derecha",
            "x − " + a + " → 0 por la derecha, así que el exponente → +infinito y " + c + "^(+infinito) = " +
            (m > 0 ? "+infinito" : "0") + ".",
            AST.pow(AST.num(Q(BigInt(c))), AST.num(Q(BigInt(m > 0 ? 40 : -40))))),
          mkStep("Límite por la izquierda",
            "Por la izquierda el exponente → −infinito, así que el valor es " + (m > 0 ? "0" : "+infinito") + ".",
            AST.pow(AST.num(Q(BigInt(c))), AST.num(Q(BigInt(m > 0 ? -40 : 40))))),
          mkStep("Resultado",
            "Los dos laterales son distintos (" + der + " por la derecha, " + izq + " por la izquierda), así que " +
            "el límite no existe.",
            expr)
        ];
        return buildProblem(this, rand, {
          statement: { expr: expr, target: targetPoint(a, null), kind: "limit" },
          answer: ans,
          quiz: quizIndet("no hay indeterminación", rand,
            "La base es una constante mayor que 1 y el exponente se va a infinito por un lado y a −infinito por el otro: no hay indeterminación, solo dos laterales distintos. Error típico: aplicar e^(−∞) = 0 a una base cualquiera."),
          steps: pasos,
          keyStep: 0,
          distractors: dist3(ans, [ansInf(1), ansRational(Q.ZERO), ansRational(Q.ONE), ansInf(-1)]),
          internal: { kind: "exp-lateral", v: 3, a: a, m: m, c: c }
        });
      }

      /* --- v1 y v4: A/(B + e^(m/(x−a))) ----------------------------- */
      if (v === 1 || v === 4) {
        const A = rand.pick([-3, -2, -1, 1, 2, 3]);
        const B = rand.pick([1, 2, 3, 4]);
        const expr = AST.div(AST.num(Q(BigInt(A))), AST.add(AST.num(Q(BigInt(B))), eNodo));

        /* El exponente se va a +infinito por la derecha si m > 0.
         * Cuando se va a +infinito, e se va a +infinito y el cociente
         * tiende a 0; cuando se va a −infinito, e → 0 y vale A/B. */
        const expoInfAqui = function (derecha) { return (m > 0) === derecha; };
        const valorDe = function (derecha) {
          return expoInfAqui(derecha) ? ansRational(Q.ZERO) : ansRational(Q(BigInt(A)).div(Q(BigInt(B))));
        };
        const txtDe = function (derecha) {
          return expoInfAqui(derecha) ? "0" : (A + "/" + B);
        };
        const lado = (v === 4) ? rand.pick(["+", "-"]) : null;
        const der = valorDe(true), izq = valorDe(false);
        const ansFinal = (v === 4) ? valorDe(lado === "+") : ansDne();
        const nodoFinal = (function () {
          var x = ansFinal.kind === "rational" ? ansFinal.value : Q.ZERO;
          return AST.num(x);
        })();

        const pasos = (v === 4)
          ? [
            mkStep("Sustituir el límite del argumento (dentro de una función continua)",
              "Por " + (lado === "+" ? "la derecha" : "la izquierda") + ", " + denTxt + " → 0 con el signo del lado, " +
              "así que " + mTxt + "/(" + denTxt + ") → " + (expoInfAqui(lado === "+") ? "+infinito" : "−infinito") +
              ". Dentro de la exponencial, que es continua: e^(+infinito) = +infinito y e^(−infinito) = 0. " +
              "Error típico: recordar que e^(−infinito) = 1 (no existe tal cosa) o poner e⁰ = 1 pensando que el " +
              "argumento es 0.",
              expr, true),
            mkStep("Aplicamos la regla de la exponencial",
              "El argumento aporta " + (expoInfAqui(lado === "+") ? "un +infinito en el denominador" : "un 0 en el denominador") +
              ", así que " + A + "/(" + B + " + " + (expoInfAqui(lado === "+") ? "+infinito" : "0") + ") → " +
              txtDe(lado === "+") + ".",
              nodoFinal),
            mkStep("Resultado",
              "El límite por " + (lado === "+" ? "la derecha" : "la izquierda") + " es " + txtDe(lado === "+") +
              ". Por el otro lado valdría " + txtDe(lado !== "+") + ", que es distinto: por eso el límite a dos " +
              "lados no existiría, pero el lateral pedido sí.",
              nodoFinal)
          ]
          : [
            mkStep("Dentro de una función continua se sustituye el límite del argumento",
              "El cociente es continuo en la exponencial, así que basta con saber a dónde va " + mTxt + "/(" + denTxt +
              "). Error típico: poner e^(−infinito) = 1 (no existe) o creer que e^(+infinito) = 1 porque e⁰ = 1.",
              expr, true),
            mkStep("Por la derecha",
              "x − " + a + " → 0⁺, luego el exponente → " + (m > 0 ? "+infinito" : "−infinito") + " y la exponencial " +
              "vale " + (m > 0 ? "+infinito" : "0") + ". Entonces " + A + "/(" + B + " + " + (m > 0 ? "+infinito" : "0") +
              ") → " + txtDe(true) + ".",
              AST.num(der.kind === "rational" ? der.value : Q.ZERO)),
            mkStep("Por la izquierda",
              "x − " + a + " → 0⁻, luego el exponente → " + (m > 0 ? "−infinito" : "+infinito") + " y la exponencial " +
              "vale " + (m > 0 ? "0" : "+infinito") + ". Entonces " + A + "/(" + B + " + " + (m > 0 ? "0" : "+infinito") +
              ") → " + txtDe(false) + ".",
              AST.num(izq.kind === "rational" ? izq.value : Q.ZERO)),
            mkStep("Resultado",
              "Los laterales no coinciden (" + txtDe(true) + " y " + txtDe(false) + "), así que el límite no existe. " +
              "Aquí no hay ni 0/0 ni ∞/∞: la discontinuidad la produce e^u cuando u → ±infinito.",
              expr)
          ];

        return buildProblem(this, rand, {
          statement: {
            expr: expr,
            target: (v === 4) ? targetPoint(a, lado) : targetPoint(a, null),
            kind: "limit",
            question: (v === 4)
              ? "Calcula el límite por " + (lado === "+" ? "la derecha" : "la izquierda") + "."
              : "Calcula el límite en el punto."
          },
          answer: ansFinal,
          quiz: (v === 4)
            ? quizMC("metodo", "¿Cómo se evalúa este límite por un lado?",
              "Sustituyendo el límite del argumento en la exponencial: e^(+∞) = +∞ y e^(−∞) = 0",
              ["Sustituyendo directamente x = " + a + " en la exponencial",
                "Usando que el denominador se anula y sale 0/0",
                "Convirtiéndolo en un límite en x en lugar de en el exponente"],
              rand,
              "La exponencial es continua: si su argumento tiende a +infinito, ella tiende a +infinito; si tiende a −infinito, tiende a 0 (nunca a 1). Error típico: recordar que e^(−infinito) = 1, que no existe.")
            : quizMC("porque", "¿Por qué no existe este límite?",
              "Porque e^(" + mTxt + "/(" + denTxt + ")) vale +infinito por un lado y 0 por el otro, y los dos resultados difieren",
              ["Porque el denominador se anula en x = " + a + " (0/0)",
                "Porque la función no está definida en el punto",
                "Porque hay una indeterminación ∞ − ∞"],
              rand,
              "No hay 0/0 ni ∞/∞: la causa es que la exponencial se dispara cuando su argumento se va a infinito, y eso solo pasa por un lado. Error típico: buscar una indeterminación que aquí no existe."),
          steps: pasos,
          keyStep: 0,
          distractors: dist3(ansFinal, [
            ansRational(Q(BigInt(A)).div(Q(BigInt(B)))),  /* el valor del otro lado */
            ansRational(Q.ZERO),                          /* "e^(−∞) = 0" a cualquier cosa */
            ansInf(1),
            ansDne()
          ]),
          internal: { kind: "exp-lateral", v: v, A: A, B: B, a: a, m: m, side: lado }
        });
      }

      /* --- v5: (e^(m/(x−a)) − 1)/(e^(m/(x−a)) + 1) → no existe ------ */
      {
        const expr = AST.div(AST.sub(eNodo, AST.num(Q.ONE)), AST.add(eNodo, AST.num(Q.ONE)));
        const ans = ansDne();
        const der = (m > 0) ? "1" : "−1";
        const izq = (m > 0) ? "−1" : "1";
        const pasos = [
          mkStep("Sustituimos el límite del argumento",
            "La exponencial es continua: por la derecha el argumento " + mTxt + "/(" + denTxt + ") → " +
            (m > 0 ? "+infinito" : "−infinito") + ", así que la exponencial → " + (m > 0 ? "+infinito" : "0") +
            ". Sustituyendo en el cociente sale el valor de cada lateral. Error típico: ver ∞/∞ y aplicar L'Hôpital " +
            "sin advertir que numerador y denominador tienen la misma parte dominante.",
            expr, true),
          mkStep("Límite por la derecha",
            "Con la exponencial tendiendo a " + (m > 0 ? "+infinito" : "0") + ", el cociente vale " +
            (m > 0 ? "(+infinito − 1)/(+infinito + 1) → 1" : "(0 − 1)/(0 + 1) = −1") + ".",
            AST.num(Q(BigInt(m > 0 ? 1 : -1)))),
          mkStep("Límite por la izquierda",
            "Por la izquierda la exponencial tiende a " + (m > 0 ? "0" : "+infinito") + ", y el cociente vale " +
            (m > 0 ? "−1" : "1") + ".",
            AST.num(Q(BigInt(m > 0 ? -1 : 1)))),
          mkStep("Resultado",
            "Los dos laterales son " + der + " y " + izq + ": distintos, pero los dos FINITOS. Por eso el límite no " +
            "existe y no es tampoco un infinito (∞ − 1 e ∞ + 1 se comportan igual, así que el ∞/∞ se simplifica).",
            expr)
        ];
        return buildProblem(this, rand, {
          statement: { expr: expr, target: targetPoint(a, null), kind: "limit" },
          answer: ans,
          quiz: quizMC("porque", "¿Por qué no existe este límite?",
            "Porque la exponencial toma valores muy distintos en cada lado (0 por un lado, +infinito por el otro)",
            ["Porque el cociente es ∞/∞ y hay que aplicar L'Hôpital",
              "Porque el denominador se anula en el punto",
              "Porque la función no está definida en x = " + a],
            rand,
            "Los dos laterales existen y son finitos, pero distintos. Por eso es un «no existe» y no un infinito. Error típico: aplicar L'Hôpital a un ∞/∞ que se simplifica solo dividiendo entre la exponencial."),
          steps: pasos,
          keyStep: 0,
          distractors: dist3(ans, [ansRational(Q.ONE), ansRational(Q.minusOne), ansInf(1), ansRational(Q.ZERO), ansInf(-1)]),
          internal: { kind: "exp-lateral", v: 5, a: a, m: m }
        });
      }
    }
  };

  /* =====================================================================
   * §9  GENERADOR 7 — `notable-x-sen-inv`  (Llista 1, ej. 5(d))
   *
   *     f(x) = x · sen(1/x)  si x ≠ 0 ,   f(0) = 0
   *
   * El límite en 0 vale 0 y se demuestra con el SÁNDWICH: el seno está
   * acotado, |x · sen(k/x)| ≤ |x| → 0.  El giro con t = 1/x sigue siendo la
   * mejor puerta de entrada, pero OJO: t → ±infinito (no → 0), así que
   * sen(t)/t → 0 y NO → 1; el límite notable sen t/t = 1 es solo para t → 0.
   * Ese es justo el error que este generador quiere desterrar, y aparece
   * explícito en el paso clave.
   * ===================================================================== */
  MIS_GENERADORES["notable-x-sen-inv"] = {
    id: "notable-x-sen-inv",
    title: "Seno de 1/x: oscilación acotada",
    topic: "indeterminacion",
    method: "notable",
    difficulty: 4,
    make: function (rand) {
      const v = rand.pick([1, 2, 3, 4, 5]);
      const k = rand.pick([1, 2, 3, 4]);
      const expo = (v === 5) ? 2 : 1;      /* v5 = x²·sen(k/x²) */
      const coseno = (v === 3);            /* v3 = x·cos(k/x) */
      const soloSeno = (v === 4);          /* v4 = sen(k/x), sin factor → DNE */

      const arg = (expo === 1) ? AST.div(AST.num(Q(BigInt(k))), AST.x())
        : AST.div(AST.num(Q(BigInt(k))), AST.powN(AST.x(), 2));
      const argTxt = (expo === 1) ? (k + "/x") : (k + "/x²");
      const osci = coseno ? AST.cos(arg) : AST.sin(arg);
      const factorX = (expo === 1) ? AST.x() : AST.powN(AST.x(), expo);
      const expr = soloSeno ? osci : AST.mul(factorX, osci);
      const exprTxt = soloSeno ? ("sen(" + argTxt + ")")
        : (xSup(expo) + "·" + (coseno ? "cos" : "sen") + "(" + argTxt + ")");
      const modTxt = soloSeno ? "1" : xSup(expo);
      const ans = soloSeno ? ansDne() : ansRational(Q.ZERO);

      const pasos = soloSeno
        ? [
          mkStep("El seno oscila y no tiene límite en 0",
            "Cuando x → 0, " + argTxt + " recorre valores cada vez mayores y el seno va tomando valores distintos, " +
            "cercanos a 1 y a −1 infinitas veces. Error típico: decir que |sen| ≤ 1 luego el límite es 0; el " +
            "acotamiento solo sirve si hay un factor que separe.",
            expr, true),
          mkStep("Dos sucesiones con valores distintos",
            "Tomando x = " + k + "/(2πn + π/2) se cumple " + argTxt + " = 2πn + π/2 y el seno vale 1. Tomando " +
            "x = " + k + "/(2πn − π/2) el seno vale −1. Las dos sucesiones de x se acercan a 0.",
            expr),
          mkStep("Se concludes que no existe",
            "La primera da 1 y la segunda −1. Una función tiene límite solo si da SIEMPRE lo mismo. Ojo: en cuanto " +
            "multiplicamos por x (o por x²) el producto queda acotado por |x| y el límite pasa a ser 0.",
            expr)
        ]
        : [
          mkStep("El paso clave: el seno está acotado",
            "Para cualquier x, |sen(" + argTxt + ")| ≤ 1. Así que |" + exprTxt + "| ≤ 1·|" + modTxt + "| = |x" +
            (expo === 1 ? "" : sup(expo)) + "|, y como |x" + (expo === 1 ? "" : sup(expo)) + "| → 0, por el teorema " +
            "del sándwich el límite es 0. Error típico: hacer el cambio t = " + argTxt + ", escribir " + exprTxt +
            " = sen(t)/t y concluir que vale 1. Ese límite notable (sen t/t → 1) es SOLO para t → 0; aquí t → " +
            "±infinito, y sen(t)/t → 0.",
            expr, true),
          mkStep("El cambio de variable confirma, con el signo correcto",
            "Con t = 1/x (o t = " + k + "/x) la variable nueva se va a ±infinito y " + exprTxt + " = sen(t)/t. Como " +
            "|sen t| ≤ 1 y |t| → +infinito, sen(t)/t → 0. El límite notable sen t/t = 1 no se puede usar aquí " +
            "porque t no tiende a 0.",
            expr),
          mkStep("Por qué no vale sustituir",
            "El error más caro es sustituir x = 0 y poner «sen(∞)» = 1 (o = −1, o el valor que toque): el seno NO " +
            "tiene límite en el infinito, oscila entre −1 y 1. Por eso el resultado no puede salir de sustituir, " +
            "sino del acotamiento.",
            expr),
          mkStep("Resultado",
            "El límite es 0, así que la función f(x) = " + exprTxt + " (con f(0) = 0) es continua en 0.",
            AST.num(Q.ZERO))
        ];

      return buildProblem(this, rand, {
        statement: {
          expr: expr,
          target: targetPoint(0, null),
          kind: "limit",
          question: soloSeno
            ? "Calcula el límite en x = 0."
            : "Calcula el límite en x = 0 (la función se define con f(0) = 0)."
        },
        answer: ans,
        quiz: soloSeno
          ? quizMC("metodo", "¿Por qué no existe este límite?",
            "Porque el seno oscila: hay dos sucesiones de x → 0 en las que vale 1 y −1",
            ["Porque |sen(k/x)| ≤ 1 y por tanto el límite es 0",
              "Porque al multiplicar por x la oscilación desaparece",
              "Porque sen t/t → 1 y aquí la expresión es sen(t)/t"],
            rand,
            "Que una función esté acotada no significa que tenga límite: el seno de 1/x toma valores 1 y −1 infinitas veces. Error típico: aplicar el sándwich cuando no hay ningún factor que corte la oscilación.")
          : quizMC("metodo", "¿Por qué el límite de " + exprTxt + " es 0?",
            "Porque |sen(" + argTxt + ")| ≤ 1: el producto está acotado por |x|, que tiende a 0",
            ["Porque sen t/t → 1 al hacer el cambio t = 1/x",
              "Porque el seno tiene límite en el infinito",
              "Porque es un producto 0·(algo sin límite) y por eso vale 0"],
            rand,
            "El límite notable sen t/t = 1 vale para t → 0. Con t = 1/x, t → ±infinito y sen(t)/t → 0. Lo decisivo es el acotamiento: |x·sen(k/x)| ≤ |x|. Error típico: responder 1 por el límite notable, sin comprobar que t tienda a 0."),
        steps: pasos,
        keyStep: 0,
        distractors: dist3(ans, soloSeno
          ? [ansRational(Q.ZERO), ansRational(Q.ONE), ansInf(1), ansRational(Q.minusOne)]
          : [ansRational(Q.ONE), ansRational(Q.minusOne), ansDne(), ansInf(1)]),
        internal: { kind: "oscilante", v: v, k: k, expo: expo, coseno: coseno, soloSeno: soloSeno }
      });
    }
  };

  /* =====================================================================
   * §10  REGISTRO
   * ===================================================================== */
  L.registrar(MIS_GENERADORES);
  L.GENERADORES_AVANZADOS = MIS_GENERADORES;
  L.GENERADORES_AVANZADOS_LIST = Object.keys(MIS_GENERADORES);

})(typeof window !== "undefined" ? window : globalThis);