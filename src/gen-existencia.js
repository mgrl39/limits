/* =====================================================================
 * gen-existencia.js — Extensión del motor de ejercicios con los 5
 *                     generadores que cubren la parte "de demostración"
 *                     de la Llista 1: existencia de ceros, continuidad
 *                     con parámetros, límites paramétricos y valor
 *                     absoluto.
 *
 * Apartados cubiertos:
 *   · Ej. 1, 2, 3   →  existencia-bolzano        (Bolzano / Darboux)
 *   · Ej. 8         →  continuidad-multiparametro (3 parámetros a la vez)
 *   · Ej. 7         →  continuidad-log-parametro  (empalme con logaritmo)
 *   · Ej. 10        →  limite-parametrico        (el límite depende de a)
 *   · Ej. 5(c)      →  valor-absoluto            (|x−a| y los empalmes)
 *
 * Se carga DESPUÉS de engine.js y de gen-avanzados.js:
 *     <script src="src/engine.js"></script>
 *     <script src="src/gen-avanzados.js"></script>
 *     <script src="src/gen-existencia.js"></script>
 *
 * Sin dependencias. Sin import/export. Todo cuelga de `window.Lim`.
 *
 * NOTA IMPORTANTE: este fichero INTRODUCE tres clases de respuesta nuevas
 * (`kind: "existencia"`, `kind: "params"` y `kind: "piecewise-by-param"`)
 * que `engine.js` no conhece. Para que se respete el invariante
 *     checkAnswer(p, answerToString(p.answer)).correct === true
 * el fichero hace un PARCHE ADITIVO e idempotente de `Lim.answerToString`
 * y `Lim.checkAnswer` (§1.4). El detalle de lo que necesita la interfaz
 * está al final del fichero, en  "/* NOTA PARA LA UI *\/".
 * ===================================================================== */

(function (global) {
  "use strict";

  var L = global.Lim;
  if (!L) throw new Error("gen-existencia.js necesita engine.js antes");

  /* ---------------------------------------------------------------------
   * Registro (mismo patrón aditivo que gen-avanzados.js).
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
   * §1  ESPEJO DE LOS AYUDANTES DE engine.js §6 / gen-avanzados.js §1
   *
   * Se replican con el MISMO comportamiento y, si el motor los expone
   * algún día, se delegan en los suyos. Se añaden los que here no
   * existen: `ansText`, `ansExistencia`, `ansParams`, `ansPieces`.
   * ===================================================================== */

  function ansRational(q) { return L.ansRational ? L.ansRational(q) : { kind: "rational", value: Q(q) }; }
  function ansInf(s) { return L.ansInf ? L.ansInf(s) : { kind: "infinite", sign: s >= 0 ? 1 : -1 }; }
  function ansDne() { return L.ansDne ? L.ansDne() : { kind: "dne" }; }
  function ansText(s) { return L.ansText ? L.ansText(s) : { kind: "text", value: String(s) }; }
  function ansChoice(options, correct) {
    return L.ansChoice ? L.ansChoice(options, correct) : { kind: "choice", options: options, correct: correct };
  }
  function round6(v) { if (!isFinite(v)) return 0; return Number(v.toFixed(6)); }
  function ansNumeric(v) { return L.ansNumeric ? L.ansNumeric(v) : { kind: "numeric", value: round6(v) }; }

  /** Signo con símbolo tipográfico: "−3", "+4". */
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
  const SUPER = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  function sup(n) {
    var s = String(n), out = "";
    for (var i = 0; i < s.length; i++) out += SUPER[s[i]];
    return out;
  }
  function xSup(n) { return n === 1 ? "x" : "x" + sup(n); }

  /** Racional → texto con guion tipográfico: Q(-3,4) → "−3/4". */
  function fmtQ(q) { return Q(q).toDisplay().replace(/-/g, "−"); }
  /** Un `interval` puede traer un Q o un texto ya escrito ("π/2"). */
  function fmtExt(v) {
    if (v === null || v === undefined) return "?";
    if (v instanceof Q) return fmtQ(v);
    return String(v);
  }
  /** m·x + b como texto plano: "−4x − 3", "3", "0". */
  function linTxt(m, b) {
    var M = Number(m), B = Number(b);
    if (M === 0) return B === 0 ? "0" : fmtTerm(B).trim().replace("-", "−");
    var ini = M === 1 ? "x" : (M === -1 ? "−x" : fmtSign(M) + "x");
    if (B === 0) return ini;
    return ini + " " + fmtTerm(B).trim().replace("-", "−");
  }

  function normText(s) {
    return String(s).toLowerCase()
      .replace(/[−–—]/g, "-")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ").trim();
  }
  /** Normalización "dura" para comparar respuestas del alumno. */
  function normDuro(s) {
    return normText(s)
      .replace(/[.,;:()[\]{}<>·×*\/\\|=+≠]/g, " ")
      .replace(/\binfinito\b/g, "inf")
      .replace(/\s+/g, " ").trim();
  }

  /* ---------------------------------------------------------------------
   * Claves comparables de cada clase de respuesta (incluidas las nuevas).
   * ------------------------------------------------------------------ */
  function answerKeyOf(a) {
    if (!a) return "?";
    switch (a.kind) {
      case "rational": return "#:" + Q(a.value).toString();
      case "infinite": return "i:" + (a.sign > 0 ? "+" : "-");
      case "dne": return "dne";
      case "numeric": return "#:" + Number(a.value);
      case "text": return "t:" + normText(a.value);
      case "choice": return "c:" + a.options.map(normText).join("|") + ":" + a.correct;
      case "existencia":
        return "e:" + (a.value ? "1" : "0") + ":" + (a.unique ? "u" : (a.count || "n")) + ":" +
          ((a.interval || []).map(fmtExt).join(",")) +
          ((a.intervals || []).map(function (iv) { return iv.map(fmtExt).join("-"); }).join("|"));
      case "params":
        return "p:" + a.values.map(function (t) { return t[0] + "=" + Q(t[1]).toString(); }).join(",");
      case "piecewise-by-param":
        return "w:" + (a.param || "a") + ":" + a.cases.map(function (c) {
          return normDuro(c.when) + "=>" + answerKeyOf(c.value);
        }).join("|");
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
    if (answer.kind === "existencia") {
      pool.push(ansExistencia(!answer.value, answer.interval, answer.unique, answer.count));
      pool.push(ansText("Sí, existe"));
      pool.push(ansText("No existe"));
    }
    if (answer.kind === "params") {
      pool.push(ansParamsPerturbadas(answer, 1));
      pool.push(ansParamsPerturbadas(answer, 2));
      pool.push(ansParamsPerturbadas(answer, 3));
    }
    if (answer.kind === "piecewise-by-param") {
      pool.push(ansPiecesVolteada(answer, 0));
      pool.push(ansPiecesVolteada(answer, 1));
      pool.push(ansPiecesVolteada(answer, 2));
    }
    for (j = 0; j < pool.length && good.length < 3; j++) push(pool[j]);
    if (good.length < 3) throw new Error("No se han podido construir 3 distractores");
    return good.slice(0, 3);
  }

  /* ---------------------------------------------------------------------
   * Constructores de los pasos / del problema.
   * ------------------------------------------------------------------ */
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
  function targetPoint(at, side, extra) {
    var t = { type: "point", at: Q(at), side: side || null };
    if (extra) for (var k in extra) t[k] = extra[k];
    return t;
  }
  /** AST de un polinomio (m·x + b, m·x² + b·x + c, …). */
  function polyAST(list) { return Poly.from(list).toAST(); }
  /** AST de un monomio k·xⁿ. */
  function monAST(k, n) {
    if (!k) return AST.num(Q.ZERO);
    if (n === 0) return AST.num(Q(k));
    var x = AST.powN(AST.x(), n);
    return Q(k).isOne() ? x : AST.mul(AST.num(Q(k)), x);
  }
  /** a·x^n + b·x^m + … omitiendo coeficientes nulos (entrada: [[k,n],…]). */
  function sumAST(terms) {
    var parts = [];
    for (var i = 0; i < terms.length; i++) {
      var k = Q(terms[i][0]), n = terms[i][1];
      if (k.isZero()) continue;
      parts.push(n === 0 ? AST.num(k.abs()) : monAST(k.abs(), n));
    }
    if (!parts.length) return AST.num(Q.ZERO);
    var acc = parts[0];
    for (var j = 1; j < parts.length; j++) {
      var signo = Q(terms[j][0]).sign();
      acc = (signo < 0)
        ? AST.sub(acc, parts[j])
        : AST.add(acc, parts[j]);
    }
    return acc;
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

  /* =====================================================================
   * §1.4  LOS TRES TIPOS DE RESPUESTA NUEVOS
   *
   * Son tres preguntas que NO son "escribe un valor", así que rompen el
   * modelo de `Answer` del contrato. Se.Minimalmente se declaran aquí y
   * se patchean `Lim.answerToString` / `Lim.checkAnswer` de forma aditiva.
   * ===================================================================== */

  /**
   * { kind:"existencia", value:true|false, unique?, count?, interval?, intervals? }
   *   value:true, unique:true, interval:[a,b]  → "sí, existe y es único"
   *   value:true, count:3,      intervals:[…]  → "sí, existen 3"
   *   value:false                              → "no existe"
   */
  function ansExistencia(value, interval, unique, count) {
    var a = { kind: "existencia", value: !!value };
    if (interval && interval.length) a.interval = interval.slice();
    if (unique) a.unique = true;
    if (count) a.count = count;
    return a;
  }

  /**
   * { kind:"params", values: [["a", Q], ["b", Q], ["c", Q]] }
   * El sistema de condiciones que hace continua la función a trozos.
   */
  function ansParams(values) { return { kind: "params", values: values.map(function (t) { return [String(t[0]), Q(t[1])]; }) }; }

  /** { kind:"piecewise-by-param", param:"a", cases:[{when, value: Answer}] } */
  function ansPieces(param, cases) {
    return { kind: "piecewise-by-param", param: param, cases: cases.map(function (c) { return { when: c.when, value: c.value }; }) };
  }

  /* --- perturbaciones sistemáticas, para no quedarse sin distractores -- */
  function ansParamsPerturbadas(base, modo) {
    var vals = base.values.map(function (t) {
      var q = Q(t[1]);
      if (modo === 1) return q.add(Q.ONE);
      if (modo === 2) return q.neg();
      return q.mul(Q.TWO);
    });
    return ansParams(vals.map(function (q, i) { return [base.values[i][0], q]; }));
  }
  function ansPiecesVolteada(base, modo) {
    var casos = base.cases.map(function (c) {
      var v = c.value;
      if (modo === 0) return { when: c.when, value: (v.kind === "infinite" ? ansInf(-v.sign) : ansDne()) };
      if (modo === 1) return { when: c.when, value: ansRational(Q.ONE) };
      return { when: c.when, value: (v.kind === "infinite" ? v : ansInf(1)) };
    });
    return ansPieces(base.param, casos);
  }

  /* --- texto legible de cada tipo ------------------------------------- */
  function existenciaToString(a) {
    if (!a.value) {
      if (a.interval && a.interval.length === 2) {
        return "no existe en [" + fmtExt(a.interval[0]) + ", " + fmtExt(a.interval[1]) + "]";
      }
      return "no existe";
    }
    if (a.count) {
      var ivs = (a.intervals || []).map(function (iv) { return "(" + fmtExt(iv[0]) + ", " + fmtExt(iv[1]) + ")"; });
      return "sí, existen " + a.count + " valores distintos" + (ivs.length ? " en " + ivs.join(", ") : "");
    }
    if (a.unique) {
      if (a.interval && a.interval.length === 2) {
        return "sí, existe exactamente un valor en [" + fmtExt(a.interval[0]) + ", " + fmtExt(a.interval[1]) + "]";
      }
      return "sí, existe y es único";
    }
    if (a.interval && a.interval.length === 2) {
      return "sí, existe en [" + fmtExt(a.interval[0]) + ", " + fmtExt(a.interval[1]) + "]";
    }
    return "sí, existe";
  }
  function paramsToString(a) {
    return a.values.map(function (t) { return t[0] + " = " + fmtQ(t[1]); }).join(", ");
  }
  function piezasToString(a) {
    return a.cases.map(function (c) {
      var v = c.value;
      var t = v.kind === "infinite" ? (v.sign > 0 ? "+infinito" : "−infinito")
        : v.kind === "dne" ? "no existe"
          : fmtQ(v.value);
      return t + " si " + c.when;
    }).join("; ");
  }

  /* --- comparación student-friendly de "sí/no" ------------------------ */
  var NUMEROS_ES = { 1: "uno", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco", 6: "seis" };
  var FORMAS_SI = ["si", "existe", "si existe", "si hay", "si se cumple",
    "si existe y es unico", "si unico", "unico", "si es unico", "si existe un valor",
    "si existen 3 valores distintos", "si existen tres", "si existen 3"];
  var FORMAS_NO = ["no", "no existe", "ninguno", "nunca", "falso", "no hay",
    "no existe ninguno", "no se puede asegurar", "no se puede garantizar"];
  function esSi(s) {
    return FORMAS_SI.indexOf(s) >= 0 || (s.indexOf("existe") === 0 && s.length <= 40);
  }
  function esNo(s) {
    return FORMAS_NO.indexOf(s) >= 0 || (s.indexOf("no existe") === 0 && s.length <= 40);
  }
  /** Índice de la opción de `answer.options` que el alumno ha escrito, o −1. */
  function opcionEscribida(ans, s) {
    if (!ans.options || !ans.options.length) return -1;
    for (var i = 0; i < ans.options.length; i++) {
      if (normDuro(ans.options[i]) === s) return i;
    }
    return -1;
  }

  /**
   * Comprueba la respuesta de existencia contra lo que el alumno escriba.
   * `s` ya viene normalizado por `normDuro`.
   */
  function checkExistencia(ans, s) {
    var objetivo = ans.value;
    /* 1) Si el alumno ha copiado una de las 4 opciones, manda la opción
     *    (y una opción incorrecta se rechaza aunque empiece por "No existe"). */
    var op = opcionEscribida(ans, s);
    if (op >= 0) {
      return op === ans.correctOption
        ? { ok: true, norm: ans.options[op] }
        : { ok: false, norm: ans.options[op], razon: "La opción correcta es «" + ans.options[ans.correctOption] + "». " };
    }
    /* 2) Si no, se admiten solo las formas cortas: "sí", "no", "único", "3". */
    if (!objetivo) {
      if (esNo(s)) return { ok: true, norm: "no existe" };
      if (esSi(s)) return { ok: false, norm: s, razon: "Sí existe: el enunciado da las condiciones para aplicar Bolzano." };
      return null;
    }
    /* Sí existe. */
    if (esNo(s)) return { ok: false, norm: s, razon: "Sí existe: " + (ans.unique ? "además es único." : "Bolzano garantiza al menos uno.") };
    if (s === "" ) return null;
    if (ans.count) {
      var palabras = [String(ans.count), NUMEROS_ES[ans.count]].filter(Boolean);
      if (esSi(s) || s === "si" || s === "existe") return { ok: true, norm: "sí, existen " + ans.count };
      for (var i = 0; i < palabras.length; i++) {
        if (s === palabras[i] || s.indexOf(palabras[i]) >= 0) return { ok: true, norm: "sí, existen " + ans.count };
      }
      return { ok: false, norm: s, razon: "Hay que dar el número de soluciones: son " + ans.count + ", no " + s + "." };
    }
    if (ans.unique) {
      if (/unico/.test(s) || /un solo/.test(s) || /exactamente un/.test(s) || /solo un/.test(s)) {
        return { ok: true, norm: "sí, existe y es único" };
      }
      if (s === "si" || s === "existe" || s === "si existe" || s.indexOf("existe") === 0) {
        return { ok: true, norm: "sí, existe y es único" };
      }
      return { ok: false, norm: s, razon: "Sí existe, y además es único: f es estrictamente monótona en el intervalo." };
    }
    if (esSi(s) || s === "existe") return { ok: true, norm: "sí, existe" };
    return null;
  }

  /* --- comparación de la respuesta "params" --------------------------- */
  /**
   * Trocea  "a = 21/10, b = 46/5, c = 21/5"  (o "a=21/10;b=46/5;c=21/5",
   * o "a 21/10 b 46/5 c 21/5")  en  { a:"21/10", b:"46/5", c:"21/5" }.
   * Normaliza POR TROZO, porque `normDuro` se come las comas y el punto y
   * coma (que son justo los separadores).
   */
  function parseParams(s) {
    var out = {};
    var bruto = String(s).replace(/[−–—]/g, "-");
    var trozos = bruto.split(/[,;\n]/).map(function (t) { return t.trim(); }).filter(Boolean);
    /* Si no había separadores, se intenta separar por "letra + valor". */
    if (trozos.length === 1) {
      var m0 = bruto.match(/^\s*([a-z])\s*[:=]?\s*([-+]?[0-9./]+)/i);
      if (m0) trozos = bruto.replace(/([a-z])\s*[:=]?\s*(?=[-+]?[0-9])/gi, "$1,").split(",");
    }
    for (var i = 0; i < trozos.length; i++) {
      var t = normDuro(trozos[i]);
      if (!t) continue;
      var m = t.match(/^([a-z])\s*(?:=|:|\bvale\b|\bes\b|\bsea\b)?\s*(.*)$/);
      if (m && m[2]) out[m[1]] = m[2];
    }
    return out;
  }
  function mismoValor(escrito, q) {
    var t = normDuro(escrito);
    if (!t) return false;
    var w = Q(q);
    if (t === normDuro(w.toDisplay())) return true;
    var v = Number(String(escrito).replace(",", "."));
    var z = w.toNumber();
    return isFinite(v) && isFinite(z) && Math.abs(v - z) <= 1e-9 * Math.max(1, Math.abs(z));
  }
  function checkParams(ans, s) {
    var mio = parseParams(s);
    var claves = Object.keys(mio);
    var faltan = [], fallan = [];
    for (var i = 0; i < ans.values.length; i++) {
      var nombre = ans.values[i][0], q = Q(ans.values[i][1]);
      if (!(nombre in mio)) { faltan.push(nombre); continue; }
      if (!mismoValor(mio[nombre], q)) fallan.push(nombre);
    }
    if (!claves.length) return null;
    if (!faltan.length && !fallan.length) return { ok: true, norm: paramsToString(ans) };
    var razon = faltan.length
      ? ("Falta el valor de " + faltan.join(", ") + ". ")
      : ("Los valores no cuadran: " + fallan.map(function (n) {
        for (var j = 0; j < ans.values.length; j++) {
          if (ans.values[j][0] === n) return n + " = " + fmtQ(ans.values[j][1]) + " (tú has escrito " + mio[n] + ")";
        }
        return "";
      }).join("; ") + ". ");
    return { ok: false, norm: paramsToString(ans), razon: razon + "Hay que igualar los tres empalmes." };
  }

  /* --- comparación de la respuesta "piecewise-by-param" ---------------- */
  var INF_TXT = {
    "infinito": 1, "+inf": 1, "inf": 1, "mas": 1, "positivo": 1, "infinito positivo": 1,
    "-inf": -1, "menos": -1, "negativo": -1, "infinito negativo": -1
  };
  function valorCaso(v) {
    if (v.kind === "infinite") return "inf" + (v.sign > 0 ? "+" : "-");
    if (v.kind === "dne") return "dne";
    if (v.kind === "rational") return "r" + Q(v.value).toString();
    return "r" + Q.ZERO.toString();
  }
  function leerValor(txt) {
    var t = normDuro(txt);
    if (!t) return null;
    if (t === "no existe" || t === "dne") return "dne";
    if (/^\+?infinito$/.test(t)) return "inf+";
    if (/^-infinito$/.test(t)) return "inf-";
    if (t in INF_TXT) return "inf" + (INF_TXT[t] > 0 ? "+" : "-");
    var v = Number(t.replace(/\s+/g, ""));
    if (isFinite(v) && /\d/.test(t)) return "r" + Q.fromNumber(v).toString();
    return null;
  }
  /**
   * Convierte una etiqueta `when` ("a < 1 y a ≠ 0") en una expresión regular
   * tolerante a espacios y a "mayor que"/"menor que" no, pero estricta en el
   * operador: así "a = 1" y "a > 1" NUNCA se confunden entre sí.
   */
  function labelRegex(when) {
    var s = String(when).replace(/[−–—]/g, "-")
      .replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/≠/g, "!=")
      .toLowerCase().replace(/\s+(?:y|and|&)\s+/g, " & ")
      .replace(/\s+/g, " ").trim();
    var out = "", i = 0;
    while (i < s.length) {
      var c = s[i];
      if (c === "<" || c === ">" || c === "=" || c === "!") {
        var dos = (s[i + 1] === "=");
        out += "\\s*" + c + (dos ? "=" : "") + "\\s*";
        i += dos ? 2 : 1;
        continue;
      }
      if (c === "&") { out += "\\s*(?:y|and|&)\\s*"; i++; continue; }
      if (c === " ") { i++; continue; }
      out += c.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
      i++;
    }
    return new RegExp("^" + out + "$");
  }
  /** Separa un trozo written por el alumno en {etiqueta, valor}. */
  function partirCaso(txt) {
    var s = String(txt).replace(/[−–—]/g, "-").trim();
    var m = s.match(/^(.+?)\s+(?:si|cuando|donde|para)\s+(.+)$/i);
    if (m) return { val: m[1].trim(), et: m[2].trim() };
    m = s.match(/^(.+?)\s*(?:=>|->|→|⇒|:)\s*(.*)$/);
    if (m) return { et: m[1].trim(), val: m[2].trim() };
    m = s.match(/^(.+?)\s*=\s*(.+)$/);
    if (m) return { et: m[1].trim(), val: m[2].trim() };
    return { et: s, val: "" };
  }
  /** Normaliza una etiqueta igual que `labelRegex` (≥→>=, ≠→!=, "y"/","→&…). */
  function normEtiqueta(s) {
    return String(s).replace(/[−–—]/g, "-")
      .replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/≠/g, "!=")
      .toLowerCase().replace(/\s*(?:,|·|;|\by\b|\band\b|&)\s*/g, " & ")
      .replace(/\s+/g, " ").trim();
  }
  function checkPieces(ans, s) {
    var trozos = String(s).split(/[;|\n]/).map(function (t) { return t.trim(); }).filter(Boolean);
    if (!trozos.length) return null;
    var re = ans.cases.map(function (c) { return labelRegex(c.when); });
    var usados = {}, nOk = 0;
    for (var i = 0; i < trozos.length; i++) {
      var pp = partirCaso(trozos[i]);
      var et = normEtiqueta(pp.et);
      var clave = -1;
      for (var j = 0; j < ans.cases.length; j++) {
        if (usados[j]) continue;
        if (re[j].test(et)) { clave = j; break; }
      }
      if (clave < 0) continue;
      var leido = leerValor(pp.val);
      if (leido === null) continue;
      usados[clave] = true;
      if (leido === valorCaso(ans.cases[clave].value)) nOk++;
    }
    var total = ans.cases.length;
    var completos = Object.keys(usados).length === total;
    if (completos && nOk === total) return { ok: true, norm: piezasToString(ans) };
    if (nOk > 0) {
      return {
        ok: false, norm: piezasToString(ans),
        razon: "Has acertado " + nOk + " de " + total + " casos. La tabla correcta es: " + piezasToString(ans) + "."
      };
    }
    return { ok: false, norm: piezasToString(ans), razon: "La tabla de casos no cuadra. Debe ser: " + piezasToString(ans) + "." };
  }

  /* ---------------------------------------------------------------------
   * Parche ADITIVO e idempotente de `Lim.answerToString`.
   * Sin él, los tipos nuevos volverían "" y el enunciado se quedaría mudo.
   * ------------------------------------------------------------------ */
  if (!L.answerToString.__admiteExistencia) {
    var _origATS = L.answerToString;
    var _ats = function (answer) {
      if (answer && answer.kind === "existencia") return existenciaToString(answer);
      if (answer && answer.kind === "params") return paramsToString(answer);
      if (answer && answer.kind === "piecewise-by-param") return piezasToString(answer);
      return _origATS(answer);
    };
    _ats.__admiteExistencia = true;
    L.answerToString = _ats;
  }

  /* ---------------------------------------------------------------------
   * Parche ADITIVO e idempotente de `Lim.checkAnswer`.
   * Delega en el original para TODO lo que no sea un tipo nuevo.
   * ------------------------------------------------------------------ */
  if (!L.checkAnswer.__admiteExistencia) {
    var _origCA = L.checkAnswer;
    var _ca = function (problem, raw) {
      var ans = problem && problem.answer;
      if (ans && (ans.kind === "existencia" || ans.kind === "params" || ans.kind === "piecewise-by-param")) {
        var pista = "Repasa el enunciado: hay que comprobar la condición de existencia (Bolzano) o el empalme.";
        var crudo = String(raw === undefined || raw === null ? "" : raw);
        var r;
        /* OJO: `params` y `piecewise-by-param` se PARTE la cadena cruda, así
         * que no se puede normalizar antes (normDuro se come las comas y los
         * puntos y coma, que son justo los separadores). */
        if (ans.kind === "existencia") r = checkExistencia(ans, normDuro(crudo));
        else if (ans.kind === "params") r = checkParams(ans, crudo);
        else r = checkPieces(ans, crudo);
        if (r && r.ok) return { correct: true, normalized: r.norm };
        if (r) return { correct: false, normalized: r.norm, reason: r.razon + pista };
        return {
          correct: false, normalized: crudo.trim(),
          reason: "No entiendo esa respuesta. " + pista
        };
      }
      return _origCA(problem, raw);
    };
    _ca.__admiteExistencia = true;
    L.checkAnswer = _ca;
  }

  /* ---------------------------------------------------------------------
   * `targetLabel` con punto SIMBÓLICO (necesario en `limite-parametrico`:
   * el objetivo es x → a⁺, y `a` no es un racional).
   * Parche aditivo, compatible con el de gen-avanzados.js.
   * ------------------------------------------------------------------ */
  if (typeof L.targetLabel === "function" && !L.targetLabel.__admiteSimbolo) {
    var _origTL2 = L.targetLabel;
    var _tl2 = function (t) {
      if (t && (t.atText || t.symbol)) {
        var base = "x → " + (t.atText || t.symbol);
        if (t.side === "+") base += "⁺";
        else if (t.side === "-") base += "⁻";
        return base;
      }
      return _origTL2(t);
    };
    _tl2.__admiteSimbolo = true;
    L.targetLabel = _tl2;
  }

  /* ---------------------------------------------------------------------
   * Tópico "existencia". Se añade con un color que YA existe en el CSS
   * para que el chip siga saliendo bien sin tocar styles.css.
   * ------------------------------------------------------------------ */
  if (Array.isArray(L.TOPICS) && !L.TOPICS.some(function (t) { return t.id === "existencia"; })) {
    L.TOPICS.push({ id: "existencia", name: "Existencia y Bolzano", color: "--c-continuidad" });
  }

  var MIS_GENERADORES = {};

  /* =====================================================================
   * §2  GENERADOR 1 — `existencia-bolzano`  (Llista 1, ej. 1, 2 y 3)
   *
   * NO es un cálculo de límite: es una DEMOSTRACIÓN de que existe (o no)
   * un punto c. El patrón es siempre Bolzano:
   *
   *     f continua en [a,b]  y  (f(a) − k)·(f(b) − k) < 0   ⟹   ∃c: f(c) = k
   *
   * Matiz que el generador respeta a rajatabla:
   *   · Bolzano da AL MENOS un cero, nunca "exactamente uno".
   *   · "Único" solo se afirma cuando además se demuestra que f es
   *     estrictamente monótona (aquí: f′ > 0 en todo el intervalo).
   *   · Los casos "no existe" también son honestos: se construyen con
   *     funciones estrictamente crecientes y un nivel FUERA del recorrido,
   *     o con extremos del mismo signo más monotonía.
   * ===================================================================== */
  MIS_GENERADORES["existencia-bolzano"] = {
    id: "existencia-bolzano",
    title: "Existencia de un cero (Bolzano)",
    topic: "existencia",
    method: "continuidad",
    difficulty: 3,
    make: function (rand) {
      const v = rand.pick([1, 2, 3]);

      /* ------------------------------------------------------------------
       * VARIANTE 1 — Ej. 1.  f(x) = x³ − m·x² + n·x sobre [a,b], nivel k.
       *
       * f′(x) = 3x² − 2m·x + n tiene su mínimo en x = m/3 y vale
       *     n − m²/3.
       * Elegimos n > m²/3 ⟹ f′ > 0 en TODO ℝ ⟹ f estrictamente creciente
       * ⟹ (a) como mucho un c, y (b) el recorrido en [a,b] es [f(a), f(b)],
       * lo que permite construir negativos honestos.
       * ---------------------------------------------------------------- */
      if (v === 1) {
        const TABLA_N = { 1: [1, 2, 3, 4], 2: [2, 3, 4], 3: [4] };
        const m = rand.pick([1, 2, 3]);
        const n = rand.pick(TABLA_N[m]);
        const f = Poly.from([Q.ZERO, Q(BigInt(n)), Q(-BigInt(m)), Q.ONE]); /* x³ − m x² + n x */

        const INTERVALOS = [
          [-2, -1], [-1, 0], [0, 1], [1, 2], [-3, -1], [-3, 0],
          [0, 2], [2, 3], [1, 3], [-2, 1], [-1, 1], [0, 3]
        ];
        const iv = rand.pick(INTERVALOS);
        const a = iv[0], b = iv[1];
        const fa = f.eval(Q(BigInt(a))), fb = f.eval(Q(BigInt(b)));
        const lo = fa.cmp(fb) <= 0 ? fa : fb;
        const hi = fa.cmp(fb) <= 0 ? fb : fa;

        /* Candidatos enteros estrictamente entre f(a) y f(b). */
        const dentro = [];
        for (let i = Number(lo.n) / Number(lo.d) + 1; i < hi.toNumber(); i++) dentro.push(i);
        const existe = dentro.length ? rand.pick(dentro) : null;

        const fTxt = "x" + sup(3) + " − " + m + "x" + sup(2) + " + " + n + "x";
        const polTxt = m === 1 ? ("x" + sup(3) + " − x" + sup(2) + " + " + n + "x")
          : ("x" + sup(3) + " − " + m + "x" + sup(2) + " + " + n + "x");

        const quizBolzano = function (pregunta) {
          return quizMC("metodo", pregunta, "Bolzano",
            ["Darboux", "Weierstrass", "Rolle"], rand,
            "Bolzano (o teorema de los valores intermedios) dice: si f es continua en [a,b] y f(a) y f(b) tienen " +
            "signo distinto, entonces f se anula en algún punto de [a,b]. Ojo: da AL MENOS un cero, no exactamente uno; " +
            "para afirmar unicidad hace falta monotonía. Error típico: citar Rolle (que habla de c con f′(c)=0, no de c con f(c)=0) " +
            "o dar Weierstrass (que habla de máximos y mínimos, no de ceros).");
        };

        if (existe !== null) {
          const k = existe;
          const correct = "Sí, existe exactamente un c en (" + a + ", " + b + "): f es continua, f(a) − k y f(b) − k " +
            "tienen signos opuestos (Bolzano), y f′ > 0 impide que haya más de uno";
          const opcIncorrectas = [
            "Sí, existe porque f(a) y f(b) tienen el mismo signo",
            "No existe: f(a) y f(b) tienen el mismo signo",
            "No se puede asegurar nada sin saber si f es derivable"
          ];
          const opciones = rand.shuffle([correct].concat(opcIncorrectas));
          const ans = ansExistencia(true, [Q(BigInt(a)), Q(BigInt(b))], true);
          ans.options = opciones;
          ans.correctOption = opciones.indexOf(correct);
          ans.accepts = ["sí", "si, existe y es único", "sí, existe exactamente un valor", "único", "si unico"];

          const pasos = [
            mkStep("f es continua en todo ℝ",
              "f(x) = " + fTxt + " es un polinomio, así que es continuo en todos los reales y en particular en [" + a + ", " + b +
              "]. No hay ninguna condición de derivada ni de dominio que pueda fallar: el único problema es si el nivel " + k + " cae dentro del recorrido de f en ese intervalo.",
              polyAST([0, n, -m, 1])),
            mkStep("Evaluamos en los extremos",
              "f(" + a + ") = " + fmtQ(fa) + " y f(" + b + ") = " + fmtQ(fb) + ". El nivel " + k + " cumple " +
              fmtQ(lo) + " < " + k + " < " + fmtQ(hi) + ", así que está ESTRICTAMENTE entre los dos valores de los extremos. " +
              "Error típico: mirar solo que f(" + a + ") y f(" + b + ") tengan signos distintos, sin comprobar que el nivel pedido sea el de en medio.",
              AST.sub(AST.num(Q(BigInt(k))), AST.num(fa.mul(Q.minusOne)))),
            mkStep("Bolzano: existe al menos uno",
              "La función g(x) = f(x) − " + k + " es continua en [" + a + ", " + b + "] y g(" + a + ") = " + fmtQ(fa.sub(Q(BigInt(k)))) +
              " < 0 mientras que g(" + b + ") = " + fmtQ(fb.sub(Q(BigInt(k)))) + " > 0. Como el producto es negativo, por Bolzano " +
              "existe c ∈ (" + a + ", " + b + ") con g(c) = 0, es decir f(c) = " + k + ". RECUERDA: esto da al menos un cero, no exactamente uno.",
              AST.div(AST.num(fa.sub(Q(BigInt(k)))), AST.num(fb.sub(Q(BigInt(k)))), ), true),
            mkStep("Para decir «único» hay que añadir la monotonía",
              "f′(x) = 3x" + sup(2) + " − " + (2 * m) + "x + " + n + " alcanza su mínimo en x = " + fmtDec(m / 3) + ", donde vale " +
              n + " − " + fmtDec(m * m / 3) + " = " + fmtDec(n - m * m / 3) + " > 0. Así que f′ > 0 en todo ℝ y f es estrictamente " +
              "creciente: la ecuación f(x) = " + k + " tiene como mucho una solución. Por eso el c de Bolzano es único.",
              polyAST([0, n, -2 * m, 3])),
            mkStep("Conclusión",
              "Existe exactamente un c ∈ (" + a + ", " + b + ") tal que f(c) = " + k + ". La unicidad no viene de Bolzano " +
              "(que solo garantiza al menos uno), sino de que f es estrictamente creciente.",
              AST.num(Q(BigInt(k))))
          ];

          return buildProblem(this, rand, {
            statement: {
              expr: polyAST([0, n, -m, 1]),
              target: targetPoint(a, null),
              kind: "continuity",
              pieces: [{ expr: polyAST([0, n, -m, 1]), cond: a + " ≤ x ≤ " + b, condType: "le" }],
              question: "Sea f(x) = " + polTxt + ". Demuestra que existe algún c ∈ [" + a + ", " + b + "] tal que f(c) = " + k + "."
            },
            answer: ans,
            quiz: quizBolzano("¿Qué teorema permite asegurar la existencia de c?"),
            steps: pasos,
            keyStep: 2,
            distractors: dist3(ans, [ansText(opcIncorrectas[0]), ansText(opcIncorrectas[1]), ansText(opcIncorrectas[2])]),
            internal: { v: 1, m: m, n: n, a: a, b: b, k: k, existe: true }
          });
        }

        /* --- caso honesto "NO existe": k fuera del recorrido ------------ */
        const porArriba = rand.bool(0.5);
        const kNo = porArriba ? hi.add(Q.ONE) : lo.sub(Q.ONE);
        const k = kNo.toNumber();
        const correct = "No existe: f es estrictamente creciente (f′ > 0), así que en [" + a + ", " + b + "] solo toma valores " +
          "entre " + fmtQ(lo) + " y " + fmtQ(hi) + ", y " + fmtQ(kNo) + " queda fuera de ese recorrido";
        const opcIncorrectas = [
          "Sí, existe por Bolzano, porque f(" + a + ") y f(" + b + ") tienen signos distintos",
          "No existe porque f no es derivable en todo el intervalo",
          "No se puede asegurar nada sin saber si f es derivable"
        ];
        const opciones = rand.shuffle([correct].concat(opcIncorrectas));
        const ans = ansExistencia(false, [Q(BigInt(a)), Q(BigInt(b))]);
        ans.options = opciones;
          ans.correctOption = opciones.indexOf(correct);
        ans.accepts = ["no", "no existe", "no existe ningun c"];

        const pasos = [
          mkStep("f es continua en todo ℝ",
            "f(x) = " + fTxt + " es un polinomio: continuo en [" + a + ", " + b + "] sin más condiciones. La continuidad, " +
            "por tanto, no es lo que falla aquí.",
            polyAST([0, n, -m, 1])),
          mkStep("Recorrido de f en el intervalo",
            "f(" + a + ") = " + fmtQ(fa) + " y f(" + b + ") = " + fmtQ(fb) + ". Como f es estrictamente creciente (lo vemos en el paso siguiente), " +
            "en [" + a + ", " + b + "] la función solo puede tomar valores entre " + fmtQ(lo) + " y " + fmtQ(hi) + ".",
            null),
          mkStep("El nivel pedido queda fuera",
            "Se pide f(c) = " + fmtQ(kNo) + ", y " + fmtQ(kNo) + " es " + (porArriba ? "mayor" : "menor") + " que " +
            (porArriba ? fmtQ(hi) : fmtQ(lo)) + ". Por monotonía, ningún punto del intervalo puede dar ese valor. " +
            "Error típico: aplicar Bolzano solo porque f(" + a + ") y f(" + b + ") tienen signos distintos, sin comprobar " +
            "que el nivel " + fmtQ(kNo) + " está entre ellos: el nivel pedido es el que importa, no el signo de los extremos.",
            null, true),
          mkStep("Conclusión",
            "No existe ningún c ∈ [" + a + ", " + b + "] con f(c) = " + fmtQ(kNo) + ".",
            null)
        ];

        return buildProblem(this, rand, {
          statement: {
            expr: polyAST([0, n, -m, 1]),
            target: targetPoint(a, null),
            kind: "continuity",
            pieces: [{ expr: polyAST([0, n, -m, 1]), cond: a + " ≤ x ≤ " + b, condType: "le" }],
            question: "Sea f(x) = " + polTxt + ". ¿Existe algún c ∈ [" + a + ", " + b + "] tal que f(c) = " + fmtQ(kNo) + "?"
          },
          answer: ans,
          quiz: quizBolzano("¿Qué teorema habría que aplicar si el nivel estuviera entre los dos extremos?"),
          steps: pasos,
          keyStep: 2,
          distractors: dist3(ans, [ansText(opcIncorrectas[0]), ansText(opcIncorrectas[1]), ansText(opcIncorrectas[2])]),
          internal: { v: 1, m: m, n: n, a: a, b: b, k: kNo.toNumber(), existe: false }
        });
      }

      /* ------------------------------------------------------------------
       * VARIANTE 2 — Ej. 2.  f(x) = sen x + p·x − q en [0, π/2].
       *
       * f′(x) = cos x + p > 0 en [0, π/2] (el seno crece y p ≥ 1), así que
       * f es estrictamente creciente AHÍ. Eso da dos cosas:
       *   · si f(0) y f(π/2) tienen signo distinto ⟹ exactamente un cero
       *   · si los dos son positivos (o los dos negativos) ⟹ NO hay ceros
       *     (una función creciente no puede bajar de su valor en 0).
       * La tabla de (p, q) está VERIFICADA: 1 + p·π/2 − q > 0 en todas.
       * ---------------------------------------------------------------- */
      if (v === 2) {
        const PARES_SI = [[1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2], [2, 3], [3, 3]];
        const PARES_NO = [[1, -1], [2, -2], [3, -3], [1, 4], [2, 5], [3, 6]];
        const usaNo = rand.bool(0.3);
        const par = usaNo ? rand.pick(PARES_NO) : rand.pick(PARES_SI);
        const p = par[0], q = par[1];
        const f0 = Q(-BigInt(q));
        const fpi2 = 1 + p * Math.PI / 2 - q;          /* solo para comprobar el signo */

        const expr = AST.add(AST.sin(AST.x()), AST.sub(AST.mul(AST.num(Q(BigInt(p))), AST.x()), AST.num(Q(BigInt(q)))));
        const fTxt = "sen x " + fmtTerm(p).replace("-", "−") + "x − " + Math.abs(q);

        const quizBolzano = function (pregunta) {
          return quizMC("metodo", pregunta, "Bolzano",
            ["Darboux", "Weierstrass", "Rolle"], rand,
            "Bolzano (teorema de los valores intermedios): f continua en [a,b] y f(a), f(b) de signo distinto ⟹ ∃c con f(c) = 0. " +
            "Aquí además f′(x) = cos x + p > 0 en [0, π/2], y por eso el cero es único. Error típico: citar Weierstrass " +
            "(máximos y mínimos) o Rolle (f′(c) = 0), que no dicen nada de f(c) = 0.");
        };

        const condExtremos = "f(0) = −" + Math.abs(q) + (q > 0 ? "" : (q < 0 ? " = " + Math.abs(q) : " = 0")) +
          " y f(π/2) = 1 + " + p + "·π/2 − " + Math.abs(q);

        if (!usaNo) {
          const correct = "Sí, existe exactamente un c en (0, π/2): f es continua, f(0) y f(π/2) tienen signo distinto " +
            "(Bolzano), y f′ = cos x + p > 0 en [0, π/2] hace que sea único";
          const opcIncorrectas = [
            "Sí, existe porque f(0) y f(π/2) tienen el mismo signo",
            "No existe: f(0) y f(π/2) tienen el mismo signo",
            "No se puede asegurar nada sin saber si f es derivable"
          ];
          const opciones = rand.shuffle([correct].concat(opcIncorrectas));
          const ans = ansExistencia(true, [Q.ZERO, "π/2"], true);
          ans.options = opciones;
          ans.correctOption = opciones.indexOf(correct);
          ans.accepts = ["sí", "si, existe y es único", "único", "si unico"];

          const pasos = [
            mkStep("f es continua en todo el intervalo",
              "El seno y el polinomio son continuos, así que f(x) = " + fTxt + " es continua en [0, π/2]. No hay problema " +
              "de dominio: π/2 es un número real y el seno está definido en todas partes.",
              expr),
            mkStep("Los extremos tienen signo distinto",
              condExtremos + ". Con estos valores f(0) < 0 y f(π/2) > 0, así que el producto f(0)·f(π/2) es negativo. " +
              "Error típico: quedarse en «f(0) y f(π/2) tienen el mismo signo» sin mirarlo, o confundir el signo del extremo " +
              "con el del nivel buscado.",
              AST.div(AST.num(f0), AST.num(Q.fromNumber(Math.round(fpi2 * 1e6) / 1e6))), true),
            mkStep("Bolzano",
              "f es continua y f(0)·f(π/2) < 0 ⟹ existe c ∈ (0, π/2) con f(c) = 0, es decir sen c + " + p + "c − " + Math.abs(q) +
              " = 0. El teorema garantiza AL MENOS un cero.",
              expr),
            mkStep("Y además es único",
              "f′(x) = cos x + " + p + ". En [0, π/2] se cumple cos x ≥ 0, así que f′(x) ≥ " + p + " > 0: f es estrictamente " +
              "creciente y f(c) = 0 tiene como mucho una solución. De nuevo, la unicidad la da la monotonía, no Bolzano.",
              AST.add(AST.cos(AST.x()), AST.num(Q(BigInt(p))))),
            mkStep("Conclusión",
              "Sí: hay exactamente un c ∈ (0, π/2) tal que sen c + " + p + "c − " + Math.abs(q) + " = 0.",
              AST.num(Q.ZERO))
          ];

          return buildProblem(this, rand, {
            statement: {
              expr: expr,
              target: targetPoint(0, null),
              kind: "continuity",
              pieces: [{ expr: expr, cond: "0 ≤ x ≤ π/2", condType: "le" }],
              question: "Demuestra que la ecuación  sen x + " + p + "x − " + Math.abs(q) + " = 0  tiene al menos una raíz en [0, π/2]."
            },
            answer: ans,
            quiz: quizBolzano("¿Qué teorema se aplica a f(x) = sen x + " + p + "x − " + Math.abs(q) + " en [0, π/2]?"),
            steps: pasos,
            keyStep: 1,
            distractors: dist3(ans, [ansText(opcIncorrectas[0]), ansText(opcIncorrectas[1]), ansText(opcIncorrectas[2])]),
            internal: { v: 2, p: p, q: q, existe: true }
          });
        }

        const correct = "No existe: f es estrictamente creciente en [0, π/2] y sus dos extremos son " +
          (q < 0 ? "positivos" : "negativos") + ", así que f nunca se anula en el intervalo";
        const opcIncorrectas = [
          "Sí, existe por Bolzano, porque f es continua en [0, π/2]",
          "No existe: f(0) y f(π/2) tienen el mismo signo",
          "No se puede asegurar nada sin saber si f es derivable"
        ];
        const opciones = rand.shuffle([correct].concat(opcIncorrectas));
        const ans = ansExistencia(false, [Q.ZERO, "π/2"]);
        ans.options = opciones;
          ans.correctOption = opciones.indexOf(correct);
        ans.accepts = ["no", "no existe", "no hay raiz"];

        const pasos = [
          mkStep("f es continua en [0, π/2]",
            "f(x) = " + fTxt + " suma de dos funciones continuas. La continuidad no es el problema.",
            expr),
          mkStep("Los dos extremos tienen el mismo signo",
            condExtremos + ", y aquí los dos son " + (q < 0 ? "positivos" : "negativos") + ". Por sí solo, que tengan el mismo " +
            "signo NO demuestra que no haya un cero (podrían anularse en medio). Error típico: concluir «mismo signo ⟹ no hay " +
            "cero» sin un argumento adicional. Ese argumento es el siguiente.",
            expr, true),
          mkStep("El argumento que sí vale: la monotonía",
            "f′(x) = cos x + " + p + " y en [0, π/2] se tiene cos x ≥ 0, luego f′(x) ≥ " + p + " > 0. f es estrictamente " +
            "creciente, así que su MÍNIMO en [0, π/2] está en 0 y vale f(0) = " + fmtQ(f0) + (q < 0 ? " > 0" : " < 0") +
            ". Nunca puede valer 0.",
            AST.add(AST.cos(AST.x()), AST.num(Q(BigInt(p))))),
          mkStep("Conclusión",
            "No existe ningún c ∈ [0, π/2] con sen c + " + p + "c − " + Math.abs(q) + " = 0.",
            AST.num(Q.ZERO))
        ];

        return buildProblem(this, rand, {
          statement: {
            expr: expr,
            target: targetPoint(0, null),
            kind: "continuity",
            pieces: [{ expr: expr, cond: "0 ≤ x ≤ π/2", condType: "le" }],
            question: "Analiza si la ecuación  sen x + " + p + "x − " + Math.abs(q) + " = 0  tiene alguna raíz en [0, π/2]."
          },
          answer: ans,
          quiz: quizBolzano("¿Qué haría falta para concluir que no hay raíz?"),
          steps: pasos,
          keyStep: 2,
          distractors: dist3(ans, [ansText(opcIncorrectas[0]), ansText(opcIncorrectas[1]), ansText(opcIncorrectas[2])]),
          internal: { v: 2, p: p, q: q, existe: false }
        });
      }

      /* ------------------------------------------------------------------
       * VARIANTE 3 — Ej. 3.  t³ = 3·t + k  ⟺  p(t) = t³ − 3t − k = 0.
       *
       * "Demostreu que hi ha tres reals tals que el seu cub és igual a
       *  tres vegades el nombre més k": es IVT aplicado a un CÚBICO, y
       * para k = ±1 se localiza un cambio de signo en TRES intervalos
       * disjuntos, lo que da tres raíces distintas. Un polinomio de grado
       * 3 tiene como mucho 3 raíces, así que son exactamente tres.
       * Los intervalos se CALCULAN (no se hardcodean) mirando los signos
       * en −2, −1, 0, 1 y 2.
       * ---------------------------------------------------------------- */
      {
        const k = rand.pick([-1, 1]);
        const p = Poly.from([Q(-BigInt(k)), Q(-3), Q.ZERO, Q.ONE]);   /* x³ − 3x − k */
        const CTRL = [-2, -1, 0, 1, 2];
        const signos = CTRL.map(function (u) { return p.eval(Q(BigInt(u))).sign(); });
        const intervals = [];
        for (let i = 0; i < CTRL.length - 1; i++) {
          if (signos[i] * signos[i + 1] < 0) intervals.push([CTRL[i], CTRL[i + 1]]);
        }
        /* Garantía: para k = ±1 siempre salen 3 intervalos. Si algún día
         * se tocara la tabla y no salieran, se cae a k = 1 (verificado). */
        let kUsado = k, intervalos = intervals;
        if (intervalos.length !== 3) { kUsado = 1; intervalos = [[-2, -1], [-1, 0], [1, 2]]; }
        const pol = Poly.from([Q(-BigInt(kUsado)), Q(-3), Q.ZERO, Q.ONE]);
        const tabla = CTRL.map(function (u, i) {
          return "p(" + u + ") = " + fmtQ(pol.eval(Q(BigInt(u)))) + (signos[i] < 0 ? " < 0" : " > 0");
        }).join(",  ");

        const correct = "Sí, existen tres: p cambia de signo en cada uno de los tres intervalos, así que Bolzano da una raíz " +
          "en cada uno y al ser disjuntos son tres números distintos";
        const opcIncorrectas = [
          "Sí, pero solo dos: en el intervalo central no hay cambio de signo",
          "No, un polinomio de grado 3 solo puede tener una raíz real",
          "No se puede asegurar nada: un polinomio de grado 3 puede tener 1, 2 o 3 raíces reales"
        ];
        const opciones = rand.shuffle([correct].concat(opcIncorrectas));
        const ans = ansExistencia(true, null, false, 3);
        ans.intervals = intervalos.map(function (iv) { return [Q(BigInt(iv[0])), Q(BigInt(iv[1]))]; });
        ans.options = opciones;
          ans.correctOption = opciones.indexOf(correct);
        ans.accepts = ["sí", "si, existen 3 valores distintos", "3", "tres", "si existen tres"];

        const pasos = [
          mkStep("Pasamos a un polinomio",
            "La condición t³ = 3t + " + Math.abs(kUsado) + " se escribe p(t) = t³ − 3t − " + Math.abs(kUsado) + " = 0. " +
            "p es un polinomio, luego es CONTINUO en todo ℝ: no hay ningún punto donde p pueda «saltarse» el cero. " +
            "Error típico: contar raíces «mirando la gráfica», que no es un argumento; hace falta un cambio de signo.",
            polyAST([-kUsado, -3, 0, 1])),
          mkStep("Buscamos tres cambios de signo",
            "Evaluamos p en puntos enteros: " + tabla + ". Cada cambio de signo entre dos puntos consecutivos es un " +
            "intervalo donde Bolzano garantiza una raíz.",
            polyAST([-kUsado, -3, 0, 1]), true),
          mkStep("Tres intervalos disjuntos, tres raíces distintas",
            "Los cambios de signo están en " + intervalos.map(function (iv) { return "(" + iv[0] + ", " + iv[1] + ")"; }).join(", ") +
            ". Son intervalos disjuntos, así que las tres raíces son números DISTINTOS. Ojo: «al menos tres» es lo que da Bolzano; " +
            "que sean exactamente tres lo añade el grado del polinomio.",
            polyAST([-kUsado, -3, 0, 1])),
          mkStep("Son exactamente tres",
            "Un polinomio de grado 3 no puede tener más de 3 raíces reales. Como ya hemos encontrado tres distintas, hay " +
            "exactamente tres: son las soluciones de t³ = 3t + " + Math.abs(kUsado) + ".",
            polyAST([-kUsado, -3, 0, 1]))
        ];

        return buildProblem(this, rand, {
          statement: {
            expr: polyAST([-kUsado, -3, 0, 1]),
            target: targetPoint(0, null),
            kind: "continuity",
            pieces: [{ expr: polyAST([-kUsado, -3, 0, 1]), cond: "en todo ℝ", condType: "le" }],
            question: "Demuestra que hay tres números reales distintos cuyo cubo es igual a tres veces el número, más " +
              Math.abs(kUsado) + "."
          },
          answer: ans,
          quiz: quizMC("metodo", "¿Qué teorema permite asegurar que p(t) se anula en cada uno de los tres intervalos?", "Bolzano",
            ["Darboux", "Weierstrass", "Rolle"], rand,
            "Se aplica Bolzano tres veces, una por intervalo, porque p es continua y en cada par de extremos consecutivos el " +
            "producto de los valores es negativo. Weierstrass daría máximos y mínimos, no ceros; Rolle daría puntos con p′ = 0."),
          steps: pasos,
          keyStep: 1,
          distractors: dist3(ans, [ansText(opcIncorrectas[0]), ansText(opcIncorrectas[1]), ansText(opcIncorrectas[2])]),
          internal: { v: 3, k: kUsado, intervals: intervalos }
        });
      }
    }
  };

  /* =====================================================================
   * §3  GENERADOR 2 — `continuidad-multiparametro`  (Llista 1, ej. 8)
   *
   *   f(x) = m₁·x + b₁        si x ≤ p₁
   *          a·x + 3          si p₁ < x ≤ p₂
   *          −x + b            si p₂ < x ≤ p₃
   *          c                 si x > p₃
   *
   * Tres parámetros distintos y TRES condiciones simultáneas. Cada trozo
   * es lineal (continuo en su intervalo), así que solo hay que mirar los
   * tres empalmes:
   *
   *   x = p₁ :  m₁p₁ + b₁ = a·p₁ + 3   ⟹  a = (m₁p₁ + b₁ − 3)/p₁
   *   x = p₂ :  a·p₂ + 3   = −p₂ + b    ⟹  b = a·p₂ + p₂ + 3
   *   x = p₃ :  −p₃ + b    = c           ⟹  c = b − p₃
   *
   * Se exige p₁ ≠ 0 para que a quede determinado (si p₁ = 0, la primera
   * condición no menciona a y el problema no tiene solución única).
   * ===================================================================== */
  MIS_GENERADORES["continuidad-multiparametro"] = {
    id: "continuidad-multiparametro",
    title: "Continuidad con tres parámetros a la vez",
    topic: "continuidad",
    method: "continuidad",
    difficulty: 4,
    make: function (rand) {
      const m1 = rand.pick([Q("-1/2"), Q("1/3"), Q("-2/3"), Q("1/2"), Q("-1"), Q.ONE, Q.TWO]);
      const b1 = rand.pick([Q("1/5"), Q("2/5"), Q("3/5"), Q("1/2"), Q("3/4"), Q.ONE, Q.TWO]);
      const p1 = rand.pick([-2, -1, 1, 2]);          /* p1 ≠ 0 */
      const p2 = rand.pick([3, 4, 5]);
      const p3 = p2 + rand.pick([2, 3, 4]);

      const aQ = m1.mul(Q(BigInt(p1))).add(b1).sub(Q(3)).div(Q(BigInt(p1)));
      const bQ = aQ.mul(Q(BigInt(p2))).add(Q(BigInt(p2))).add(Q(3));
      const cQ = bQ.sub(Q(BigInt(p3)));

      const e1 = sumAST([[m1, 1], [b1, 0]]);
      const e2 = sumAST([[1, 1], [3, 0]]);            /* ax + 3, con `a` como símbolo */
      const e2a = sumAST([[aQ, 1], [3, 0]]);
      const e3 = sumAST([[-1, 1], [1, 0]]);           /* −x + b, con `b` como símbolo */
      const e3a = sumAST([[-1, 1], [bQ, 0]]);
      const vA = AST.var("a"), vB = AST.var("b"), vC = AST.var("c");
      const e2sym = AST.add(AST.mul(vA, AST.x()), AST.num(Q(3)));
      const e3sym = AST.add(AST.neg(AST.x()), vB);
      const e1Txt = linTxt(m1.toNumber(), b1.toNumber());

      const ans = ansParams([["a", aQ], ["b", bQ], ["c", cQ]]);
      ans.accepts = ["a=" + fmtQ(aQ) + ", b=" + fmtQ(bQ) + ", c=" + fmtQ(cQ),
        "a=" + aQ.toString() + ", b=" + bQ.toString() + ", c=" + cQ.toString()];

      /* --- distractores: los tres errores de alumno más reales --------- */
      const aSigno = m1.mul(Q(BigInt(p1))).add(b1).add(Q(3)).div(Q(BigInt(p1)));   /* ±3 cambiado */
      const aSimples = Q(m1).add(b1).sub(Q(3)).div(Q(BigInt(p1)));                 /* olvidó el factor p1 */
      const bOlvida = aQ.mul(Q(BigInt(p2))).add(Q(3));                                /* olvidó el +p2 */
      const cOlvida = bQ;                                                             /* olvidó el −p3 */
      const cand = [
        ansParams([["a", aSigno], ["b", bSigno(aSigno, p2)], ["c", cDe(bSigno(aSigno, p2), p3)]]),
        ansParams([["a", aQ], ["b", bOlvida], ["c", cDe(bOlvida, p3)]]),
        ansParams([["a", aQ], ["b", bQ], ["c", cOlvida]]),
        ansParams([["a", aSimples], ["b", bSigno(aSimples, p2)], ["c", cDe(bSigno(aSimples, p2), p3)]])
      ];

      const pasos = [
        mkStep("Localizamos los puntos de discontinuidad",
          "Dentro de cada tramo la función es lineal o constante, luego es continua allí: no hay nada que comprobar en el " +
          "interior. Los únicos puntos sospechosos son los finales de tramo, es decir x = " + p1 + ", x = " + p2 + " y x = " + p3 +
          ". Error típico: estudiar la derivabilidad (todo es lineal, así que es derivable) en vez de los empalmes, que es donde " +
          "puede aparecer el salto.",
          null, true),
        mkStep("Primer empalme (x = " + p1 + ")",
          "En x = " + p1 + " manda el primer trozo (x ≤ " + p1 + "), así que f(" + p1 + ") = " + e1Txt + " evaluado ahí = " +
          fmtQ(m1.mul(Q(BigInt(p1))).add(b1)) + ". Por la derecha tiende a a·" + p1 + " + 3. Igualamos: " +
          fmtQ(m1.mul(Q(BigInt(p1))).add(b1)) + " = a·" + p1 + " + 3  ⟹  a = " + fmtQ(aQ) + ". " +
          "Error típico: pasar (−" + p1 + ") al otro lado sin cambiar de signo, o equivocarse con el signo del 3 al despejar.",
          AST.add(AST.mul(vA, AST.x()), AST.num(Q(3)))),
        mkStep("Segundo empalme (x = " + p2 + ")",
          "En x = " + p2 + " manda el segundo trozo, así que f(" + p2 + ") = a·" + p2 + " + 3 = " +
          fmtQ(aQ.mul(Q(BigInt(p2))).add(Q(3))) + ". Por la derecha tiende a −" + p2 + " + b. Igualamos: " +
          fmtQ(aQ.mul(Q(BigInt(p2))).add(Q(3))) + " = −" + p2 + " + b  ⟹  b = " + fmtQ(bQ) + ".",
          AST.add(AST.neg(AST.x()), vB)),
        mkStep("Tercer empalme (x = " + p3 + ")",
          "En x = " + p3 + " manda el tercer trozo, así que f(" + p3 + ") = −" + p3 + " + b = " + fmtQ(cQ) +
          ". Por la derecha la función vale c, constante. Igualamos: " + fmtQ(cQ) + " = c  ⟹  c = " + fmtQ(cQ) +
          ". Error típico: poner c = b y olvidar el −" + p3 + ".",
          vC),
        mkStep("Resultado",
          "La función es continua en todo ℝ exactamente cuando  a = " + fmtQ(aQ) + ",  b = " + fmtQ(bQ) + " y  c = " + fmtQ(cQ) + ".",
          null)
      ];

      return buildProblem(this, rand, {
        statement: {
          kind: "continuity",
          pieces: [
            { expr: e1, cond: "x ≤ " + p1, condType: "le" },
            { expr: e2sym, cond: p1 + " < x ≤ " + p2, condType: "le" },
            { expr: e3sym, cond: p2 + " < x ≤ " + p3, condType: "le" },
            { expr: vC, cond: "x > " + p3, condType: "gt" }
          ],
          pieceParams: { a: "a", b: "b", c: "c" },
          target: targetPoint(p1, null),
          question: "¿Para qué valores de a, b y c es continua la función? Empieza por el empalme de x = " + p1 + "."
        },
        answer: ans,
        quiz: quizMC("metodo", "¿Qué condición debe cumplir f en cada punto de empalme?",
          "Que el valor por la izquierda y el valor por la derecha coincidan, y ese sea el valor de f en el punto",
          ["Que los dos trozos den el mismo resultado en todo el intervalo, no solo en el empalme",
            "Que f sea derivable en el punto de empalme",
            "Que las derivadas de los dos trozos coincidan (misma pendiente)"],
          rand,
          "La continuidad en un punto de empalme pide f(p⁻) = f(p⁺) = f(p). No pide igualdad de derivadas: eso sería " +
          "diferenciabilidad. En este problema los tres trozos son lineales (o constantes), así que siempre son derivables " +
          "y el problema NO está en las derivadas, sino en que los valores a ambos lados casen. Error típico: igualar las " +
          "pendientes (a = −1) y quedarse sin deserving a, b y c."),
        steps: pasos,
        keyStep: 0,
        distractors: dist3(ans, cand),
        internal: { m1: m1.toString(), b1: b1.toString(), p1: p1, p2: p2, p3: p3, a: aQ.toString(), b: bQ.toString(), c: cQ.toString() }
      });

      function bSigno(aVal, pp) { return aVal.mul(Q(BigInt(pp))).add(Q(BigInt(pp))).add(Q(3)); }
      function cDe(bVal, pp) { return bVal.sub(Q(BigInt(pp))); }
    }
  };

  /* =====================================================================
   * §4  GENERADOR 3 — `continuidad-log-parametro`  (Llista 1, ej. 7)
   *
   *   f(x) = a + m·x²        si x ≤ 0
   *          k·log(x + eⁿ)   si x > 0
   *
   * El empalme está en x = 0. Hay una trampa de dominio —muy típica—:
   * el segundo trozo NO está definido en x = 0 (log 0 no existe), pero
   * eso NO impide que f sea continua: en x = 0 manda el primer trozo y
   * lo que hay que igualar son los dos LATERALES. Además x + eⁿ > 0
   * siempre (eⁿ > 0), así que el dominio de f es todo ℝ.
   *
   * Se eligió log(x + eⁿ) porque ln(eⁿ) = n es EXACTO: la respuesta sale
   * racional (o k·n), nunca un logaritmo feo. Todas las combinaciones de
   * (m, n, k) que se generan dan respuesta entera.
   * ===================================================================== */
  MIS_GENERADORES["continuidad-log-parametro"] = {
    id: "continuidad-log-parametro",
    title: "Continuidad de un empalme con logaritmo",
    topic: "continuidad",
    method: "continuidad",
    difficulty: 3,
    make: function (rand) {
      const v = rand.pick([1, 2, 3]);
      const n = rand.pick([1, 2, 3, 4]);          /* log(x + eⁿ): ln(eⁿ) = n */
      const m = rand.pick([1, 2, 3]);
      const k = rand.pick([2, 3, 4]);

      const potE = AST.exp(AST.num(Q(BigInt(n))));
      const argLog = AST.add(AST.x(), potE);
      const logNodo = AST.ln(argLog);

      let tramo1, ansQ, txt1, txt2, valorIzqDer, pOffsetUsado = 0;
      if (v === 3) {
        /* f(x) = a + m·x + p  (x ≤ 0)   ⟹  f(0) = a + p  = n  ⟹  a = n − p */
        const pOff = rand.pick([1, 2, 3].filter(function (t) { return t < n; }));
        pOffsetUsado = pOff || 1;
        ansQ = Q(BigInt(n - pOffsetUsado));
        tramo1 = AST.add(AST.add(AST.var("a"), AST.mul(AST.num(Q(BigInt(m))), AST.x())), AST.num(Q(BigInt(pOffsetUsado))));
        txt1 = "a + " + m + "x + " + pOffsetUsado;
        valorIzqDer = "a + " + m + "·0 + " + pOffsetUsado + " = a + " + pOffsetUsado;
      } else {
        ansQ = (v === 2) ? Q(BigInt(k * n)) : Q(BigInt(n));
        tramo1 = AST.add(AST.var("a"), AST.mul(AST.num(Q(BigInt(m))), AST.powN(AST.x(), 2)));
        txt1 = "a + " + m + "x" + sup(2);
        valorIzqDer = "a + " + m + "·0" + sup(2) + " = a";
      }
      const tramo2 = (v === 2) ? AST.mul(AST.num(Q(BigInt(k))), logNodo) : logNodo;
      txt2 = (v === 2) ? (k + "·log(x + e" + sup(n) + ")") : ("log(x + e" + sup(n) + ")");

      const ans = ansRational(ansQ);
      const ansTxt = fmtQ(ansQ);

      const pasos = [
        mkStep("El único punto sospechoso es x = 0",
          "Cada trozo por separado es continuo: un polinomio a la izquierda y un logaritmo a la derecha. Así que lo único " +
          "que hay que mirar es el punto donde se empalman las dos definiciones, x = 0. Error típico: recorrer los números " +
          "buscando «otro» punto problema y no llegar nunca a x = 0.",
          null, true),
        mkStep("Cuidado con el dominio (la trampa clásica)",
          "El segundo trozo log(x + e" + sup(n) + ") necesita que el argumento sea positivo: x + e" + sup(n) + " > 0. Como e" + sup(n) +
          " > 0 y este trozo solo se usa para x > 0, la desigualdad se cumple siempre. Por tanto el DOMINIO de f es todo ℝ. " +
          "Y aunque log(x + e" + sup(n) + ") no esté definido en x = 0, eso NO impide la continuidad: en x = 0 manda el primer " +
          "trozo, así que f(0) sí existe. Lo que hay que igualar son los dos laterales, no el valor del segundo trozo en 0.",
          argLog),
        mkStep("Igualamos los dos laterales",
          "Por la izquierda (x < 0): " + valorIzqDer + ". Por la derecha (x > 0): log(0 + e" + sup(n) + ") = log(e" + sup(n) +
          ") = " + n + (v === 2 ? (" y multiplicado por " + k + " eso da " + (k * n)) : "") +
          ". La condición de continuidad es " + valorIzqDer + " = " + (v === 2 ? (k * n) : n) + ".",
          AST.add(AST.var("a"), AST.num(Q.ZERO))),
        mkStep("Despejamos a",
          ansTxt + " es el único valor de a que hace que los laterales coincidan. Con ese valor, f es continua en x = 0 y, " +
          "como el resto deℝ no tiene empalmes, f es continua en TODO ℝ.",
          AST.num(ansQ)),
        mkStep("Comprobación",
          "Sustituyendo a = " + ansTxt + ": por la izquierda da " + ansTxt + " y por la derecha da log(e" + sup(n) + ") = " + n +
          ". Los dos coinciden, luego f es continua en x = 0 (y en todas partes).",
          AST.num(ansQ))
      ];

      const distractores = [
        ansRational(ansQ.add(Q.ONE)),          /* olvidó el signo de lo que arrastra */
        ansRational(ansQ.sub(Q.ONE)),
        ansRational(Q(BigInt(n === 1 ? 2 : 1))),  /* pensó que ln(e) = 1 siempre */
        ansRational(Q(BigInt(n * n)))            /* confundió ln(e^n) con n^2 */
      ];

      return buildProblem(this, rand, {
        statement: {
          kind: "continuity",
          pieces: [
            { expr: tramo1, cond: "x ≤ 0", condType: "le" },
            { expr: tramo2, cond: "x > 0", condType: "gt" }
          ],
          pieceParams: { a: "a" },
          target: targetPoint(0, null),
          question: "Troba el valor de a pel qual la funció  f(x) = " + txt1 + " si x ≤ 0,  i  " + txt2 +
            " si x > 0,  és una funció contínua."
        },
        answer: ans,
        quiz: quizMC("metodo", "¿Qué hay que comprobar exactamente en x = 0?",
          "Que el límite por la izquierda sea igual al límite por la derecha, y que ese valor sea f(0)",
          ["Que log(x + e" + sup(n) + ") esté definida en x = 0, porque si no f no es continua",
            "Que f sea derivable en x = 0",
            "Que el dominio de f sea (0, +∞) para que sea continua"],
          rand,
          "Para que f sea continua en 0 hacen falta tres cosas: f(0) existe (la da el primer trozo), el límite por la izquierda " +
          "existe, el límite por la derecha existe y ambos coinciden. Que log(x + eⁿ) no esté definida en x = 0 es irrelevante, " +
          "porque en x = 0 se usa el primer trozo. Error típico: decir «log 0 no existe, luego f no puede ser continua», o " +
          "exigir la igualdad de derivadas."),
        steps: pasos,
        keyStep: 1,
        distractors: dist3(ans, distractores),
        internal: { v: v, n: n, m: m, k: (v === 2 ? k : 0), pOff: (v === 3 ? pOffsetUsado : 0), respuesta: ansQ.toString() }
      });
    }
  };

  /* =====================================================================
   * §5  GENERADOR 4 — `limite-parametrico`  (Llista 1, ej. 10)
   *
   *   lim        x² − (1−a)·x − a
   *       ─────────────���─────────────
   *   x → a⁺            x² − a²
   *
   * Factorizando (verificado):
   *   numerador   = x² + (a−1)·x − a = (x − 1)(x + a)
   *   denominador = x² − a²            = (x − a)(x + a)
   *
   * Se cancela (x + a) SOLO si a ≠ 0 (si a = 0, x + a = x también se anula
   * en el punto y la cancelación no está justificada). Queda (x − 1)/(x − a),
   * y como x → a⁺ el denominador tiende a 0⁺. Los cuatro casos, TODOS
   * verificados numéricamente (ver NOTA DE VERIFICACIÓN):
   *
   *   a > 1                 : numerador → a − 1 > 0  sobre 0⁺  ⟹  +∞
   *   a = 1                 : 0/0 otra vez ⟹ (x−1)/(x−1) = 1    ⟹  1
   *   a < 1 y a ≠ 0         : numerador → a − 1 < 0  sobre 0⁺  ⟹  −∞
   *   a = 0                 : no se puede cancelar; (x²−x)/x² = 1 − 1/x ⟹ −∞
   *
   * Nótese que a = 0 y a < 1 dan el mismo −∞ pero por ARGUMENTOS
   * DISTINTOS, y por eso se listan como casos separados.
   * ===================================================================== */
  MIS_GENERADORES["limite-parametrico"] = {
    id: "limite-parametrico",
    title: "Límite que depende del valor de un parámetro",
    topic: "indeterminacion",
    method: "factorizar",
    difficulty: 5,
    make: function (rand) {
      const num = AST.sub(
        AST.sub(AST.powN(AST.x(), 2),
          AST.mul(AST.sub(AST.num(Q.ONE), AST.var("a")), AST.x())),
        AST.var("a"));
      const den = AST.sub(AST.powN(AST.x(), 2), AST.powN(AST.var("a"), 2));
      const expr = AST.div(num, den);

      const simbolico = rand.bool(0.55);
      const limTxt = "lim  (x² − (1−a)·x − a) / (x² − a²),   con  x → a⁺";

      /* --- CASOS, verificados numéricamente (ver el informe de abajo) --- */
      const CASOS = [
        { when: "a > 1", value: ansInf(1) },
        { when: "a = 1", value: ansRational(Q.ONE) },
        { when: "a < 1 y a ≠ 0", value: ansInf(-1) },
        { when: "a = 0", value: ansInf(-1) }
      ];

      const quizParam = function () {
        return quizMC("metodo", "¿Qué hay que hacer antes de poder cancelar nada?",
          "Factorizar numerador y denominador para ver qué factores se anulan al llegar a x = a",
          ["Sustituir x = a directamente en el cociente y dividir",
            "Dividir numerador y denominador entre x² y comparar grados",
            "Racionalizar el denominador para quitar la raíz"],
          rand,
          "Al sustituir sale 0/0 siempre: el numerador vale a² − a(1−a) − a = 0 y el denominador a² − a² = 0. Lo que " +
          "distingue un caso de otro es la factorización: x² − (1−a)x − a = (x−1)(x+a) y x² − a² = (x−a)(x+a). " +
          "Error típico: quedarse con el 0/0 inicial, o cancelar (x+a) sin mirar que en a = 0 ese factor también se anula.");
      };

      /* ------------------- MODO SIMBÓLICO (tabla de casos) ------------- */
      if (simbolico) {
        const ans = ansPieces("a", CASOS.map(function (c) {
          return { when: c.when, value: c.value };
        }));
        ans.question = "Troba el valor del següent límit pels diferents valors de a.";
        ans.accepts = [piezasToString(ans),
          "+infinito si a > 1; 1 si a = 1; −infinito si a < 1 y a ≠ 0; −infinito si a = 0"];

        const pasos = [
          mkStep("Factorizamos los dos polinomios (no sustituyas todavía)",
            "x² − (1−a)x − a = x² + (a−1)x − a = (x − 1)(x + a)   y   x² − a² = (x − a)(x + a). " +
            "Los dos tienen un factor (x + a), pero OJO: solo se puede cancelar si ese factor NO se anula en el punto, " +
            "y en x = a vale 2a. Mientras a ≠ 0, 2a ≠ 0 y la cancelación es legítima. Error típico: sustituir x = a " +
            "(sale 0/0) y quedarse ahí, o cancelar (x+a) sin mirar el caso a = 0.",
            AST.div(AST.mul(AST.sub(AST.x(), AST.num(Q.ONE)), AST.add(AST.x(), AST.var("a"))),
              AST.mul(AST.sub(AST.x(), AST.var("a")), AST.add(AST.x(), AST.var("a")))), true),
          mkStep("Caso a = 0: aquí NO se puede cancelar (x + a)",
            "Si a = 0, el factor (x + a) es x, que también se anula en el punto, así que la cancelación anterior no está " +
            "justificada. Se calcula directamente: (x² − x)/(x²) = 1 − 1/x. Como x → 0⁺, 1/x → +∞, luego el límite es −∞.",
            AST.div(AST.sub(AST.powN(AST.x(), 2), AST.x()), AST.powN(AST.x(), 2))),
          mkStep("Caso a ≠ 0: queda (x − 1)/(x − a)",
            "Cancelado (x + a) queda (x − 1)/(x − a). Al llegar a x = a⁺ el numerador tiende a a − 1 y el denominador " +
            "tiende a 0⁺ (¡la DERECHA, que es justo por lo que el enunciado pone el superíndice +!).",
            AST.div(AST.sub(AST.x(), AST.num(Q.ONE)), AST.sub(AST.x(), AST.var("a")))),
          mkStep("Sub-casos a ≠ 0",
            "· Si a > 1: el numerador tiende a a − 1 > 0 y el denominador a 0⁺ ⟹ +∞." +
            "  · Si a < 1 (y a ≠ 0): el numerador tiende a a − 1 < 0 y el denominador a 0⁺ ⟹ −∞." +
            "  · Si a = 1: numerador y denominador se anulan los dos (0/0 de nuevo) ⟹ (x−1)/(x−1) = 1 para x ≠ 1 ⟹ límite 1. " +
            "Error típico: aplicar el caso general a = 1 y decir ±∞, cuando en realidad el cociente vale 1 salvo en el punto.",
            AST.div(AST.sub(AST.x(), AST.num(Q.ONE)), AST.sub(AST.x(), AST.num(Q.ONE)))),
          mkStep("Resumen",
            "El resultado cambia según a:  a > 1 ⟹ +∞;   a = 1 ⟹ 1;   a < 1 y a ≠ 0 ⟹ −∞;   a = 0 ⟹ −∞. " +
            "Los dos últimos coinciden en el valor pero NO en el argumento, y por eso se listan aparte.",
            null)
        ];

        return buildProblem(this, rand, {
          statement: {
            expr: expr,
            target: targetPoint(0, "+", { symbol: "a", atText: "a", symbolic: true }),
            kind: "limit",
            question: "Troba el valor del següent límit pels diferents valors de a.   " + limTxt,
            freeParam: "a"
          },
          answer: ans,
          quiz: quizParam(),
          steps: pasos,
          keyStep: 0,
          distractors: dist3(ans, [
            ansPieces("a", [
              { when: "a ≠ 0", value: ansInf(1) },
              { when: "a = 0", value: ansInf(-1) }
            ]),
            ansPieces("a", [
              { when: "a > 1", value: ansInf(-1) },
              { when: "a = 1", value: ansInf(1) },
              { when: "a < 1 y a ≠ 0", value: ansInf(1) },
              { when: "a = 0", value: ansInf(-1) }
            ]),
            ansPieces("a", [
              { when: "a > 1", value: ansRational(Q.ONE) },
              { when: "a = 1", value: ansDne() },
              { when: "a < 1 y a ≠ 0", value: ansRational(Q.ONE) },
              { when: "a = 0", value: ansDne() }
            ])
          ]),
          internal: { modo: "simbolico", casos: CASOS.map(function (c) { return { when: c.when, value: answerKeyOf(c.value) }; }) }
        });
      }

      /* ------------------- MODO INSTANCIA (a concreto) ------------------ */
      const INSTANCIAS = [
        { a: -3, ans: ansInf(-1), txt: "−3" }, { a: -2, ans: ansInf(-1), txt: "−2" },
        { a: -1, ans: ansInf(-1), txt: "−1" }, { a: -1 / 2, ans: ansInf(-1), txt: "−1/2" },
        { a: 0, ans: ansInf(-1), txt: "0" }, { a: 1 / 2, ans: ansInf(-1), txt: "1/2" },
        { a: 1 / 3, ans: ansInf(-1), txt: "1/3" },
        { a: 1, ans: ansRational(Q.ONE), txt: "1" },
        { a: 2, ans: ansInf(1), txt: "2" }, { a: 3, ans: ansInf(1), txt: "3" },
        { a: 5, ans: ansInf(1), txt: "5" }
      ];
      const inst = rand.pick(INSTANCIAS);
      const aVal = Q.fromNumber(inst.a);
      const numA = Poly.from([aVal.neg(), aVal.sub(Q.ONE), Q.ONE]);
      const denA = Poly.from([aVal.mul(aVal).neg(), Q.ZERO, Q.ONE]);

      const esCero = inst.a === 0;
      const esUno = inst.a === 1;
      const signoInf = inst.a < 1 ? -1 : 1;

      const pasos = [
        mkStep("Sustituimos sale 0/0, y el resultado depende de a",
          "Con a = " + inst.txt + ": numerador " + numA.toString() + " = " + numA.eval(aVal).toDisplay() + " y denominador " +
          denA.toString() + " = " + denA.eval(aVal).toDisplay() + ". Los dos se anulan, así que sustituir no basta: " +
          "el resultado depende de POR QUÉ se anulan.",
          AST.div(AST.num(Q.ZERO), AST.num(Q.ZERO)), true),
        mkStep("Factorizamos",
          "x² − (1−a)x − a = (x − 1)(x + a)   y   x² − a² = (x − a)(x + a). Se cancela (x + a) porque a = " + inst.txt +
          " ≠ 0 ⟹ x + a → " + (2 * inst.a) + " ≠ 0. Queda (x − 1)/(x − a).",
          AST.div(AST.mul(AST.sub(AST.x(), AST.num(Q.ONE)), AST.add(AST.x(), AST.var("a"))),
            AST.mul(AST.sub(AST.x(), AST.var("a")), AST.add(AST.x(), AST.var("a"))))),
        mkStep(esCero ? "Caso especial: a = 0" : (esUno ? "Caso especial: a = 1" : "Aplicamos el signo"),
          esCero
            ? "Con a = 0 el factor (x + a) es x, que también se anula, así que la cancelación no vale. Se hace directo: " +
            "(x² − x)/x² = 1 − 1/x, y como x → 0⁺ tenemos 1/x → +∞, luego el límite es −∞."
            : esUno
              ? "Con a = 1 numerador y denominador se anulan otra vez: (x−1)/(x−1) = 1 para todo x ≠ 1. El límite es 1. " +
              "Error típico: aplicar el caso general y concluir infinito."
              : "Como x → " + inst.txt + "⁺, el denominador x − a tiende a 0 POR LA DERECHA y el numerador tiende a a − 1 = " +
              fmtQ(aVal.sub(Q.ONE)) + (signoInf > 0 ? " > 0" : " < 0") + ". Un número " + (signoInf > 0 ? "positivo" : "negativo") +
              " partido por 0⁺ da " + (signoInf > 0 ? "+∞" : "−∞") + ".",
          null),
        mkStep("Resultado",
          "El límite para a = " + inst.txt + " es " +
          (inst.ans.kind === "infinite" ? (inst.ans.sign > 0 ? "+infinito" : "−infinito") : fmtQ(inst.ans.value)) +
          ". En la tabla completa: a > 1 ⟹ +∞; a = 1 ⟹ 1; a < 1 y a ≠ 0 ⟹ −∞; a = 0 ⟹ −∞.",
          null)
      ];

      return buildProblem(this, rand, {
        statement: {
          expr: expr,
          target: targetPoint(inst.a, "+", { symbol: "a", atText: inst.txt, symbolic: true }),
          kind: "limit",
          question: "Calcula  lim  (x² − (1−a)·x − a) / (x² − a²)   cuando  x → " + inst.txt + "⁺  (es decir, a = " + inst.txt + ").",
          freeParam: "a"
        },
        answer: inst.ans,
        quiz: quizParam(),
        steps: pasos,
        keyStep: 0,
        distractors: dist3(inst.ans, [
          ansInf(-signoInf),
          esUno ? ansInf(1) : ansRational(Q.ONE),
          esUno ? ansRational(Q.ZERO) : ansInf(-1),
          ansDne()
        ]),
        internal: { modo: "instancia", a: aVal.toString() }
      });
    }
  };

  /* =====================================================================
   * §6  GENERADOR 5 — `valor-absoluto`  (Llista 1, ej. 5(c))
   *
   * Tres familias:
   *   v = 1  f(x) = m·x + n + |x − a| / x  (x ≠ 0),  f(0) = k   → límite en 0
   *           NO existe: |x−a|/x va a +∞ por un lado y a −∞ por otro.
   *   v = 2  f(x) = m·x + n + |x − a|   — laterales en x = a, y ambos
   *           coinciden: el paso clave es partir |x − a| en dos semirrectas.
   *   v = 3  f(x) = m·x + n + |x − a|  (x ≠ a),  f(a) = k  — el límite
   *           existe y vale m·a + n, pero f(a) ≠ eso: discontinuidad evitable.
   * ===================================================================== */
  MIS_GENERADORES["valor-absoluto"] = {
    id: "valor-absoluto",
    title: "Valor absoluto: empalmes y laterales",
    topic: "continuidad",
    method: "lateral",
    difficulty: 3,
    make: function (rand) {
      const v = rand.pick([1, 2, 3]);
      const m = rand.pick([1, 2, 3]);
      const n = rand.pick([1, 2, 3]);
      const a = rand.pick([-3, -2, 2, 3, -1, 1, 4]);

      /* --- v = 1 : |x − a| partido entre x ------------------------------- */
      if (v === 1) {
        const k = rand.pick([1, 2, 3, 4]);
        const absNodo = AST.div(AST.abs(AST.sub(AST.x(), AST.num(Q(BigInt(a))))), AST.x());
        const lin = AST.add(AST.mul(AST.num(Q(BigInt(m))), AST.x()), AST.num(Q(BigInt(n))));
        const expr = AST.add(lin, absNodo);
        const exprTxt = m + "x + " + n + " + |x − " + a + "|/x";
        const absTxt = "|" + (a > 0 ? ("x − " + a) : ("x + " + (-a))) + "|";

        const ans = ansDne();
        const pasos = [
          mkStep("La discontinuidad está en x = 0, no en x = " + a,
            "f(x) = " + exprTxt + " solo está definida para x ≠ 0, así que el único punto problemático es x = 0. " +
            "El valor absoluto, en cambio, NO aporta ninguna discontinuidad: " + absTxt + " es continua en todas partes " +
            "(incluido x = " + a + ", donde vale 0). Error típico: señalar x = " + a + " como el punto problemático.",
            expr, true),
          mkStep("Cerca de 0, |x − a| es una recta (no hace falta partirla)",
            "Para x suficientemente cerca de 0, y como " + a + " ≠ 0, se cumple x − " + a + " " + (a > 0 ? "<" : ">") +
            " 0, así que " + absTxt + " = " + (a > 0 ? (a + " − x") : ("x + " + (-a))) + " y " +
            (a > 0 ? ("|x − " + a + "| / x = " + a + "/x − 1") : ("|x − " + a + "| / x = 1 − " + (-a) + "/x")) +
            ". O sea: un término 1/x con coeficiente " + (a > 0 ? a : -a) + ".",
            expr),
          mkStep("Los dos laterales van a infinitos OPUESTOS",
            "Por la derecha (x → 0⁺) el término " + (a > 0 ? a : -a) + "/x tiende a +∞; por la izquierda (x → 0⁻) tiende a −∞. " +
            "El resto (m·x + " + n + " y el −1) se queda acotado. Así que los dos laterales NO coinciden: " +
            "el límite en 0 no existe. Error típico: decir «el límite es ∞» sin mirar el lado, o dividir y concluir que " +
            "«el coeficiente manda» sin separar izquierda y derecha.",
            expr, true),
          mkStep("Conclusión",
            "lim en 0 de f no existe (por la derecha +∞, por la izquierda −∞), y por tanto f(0) = " + k +
            " es irrelevante: f NO es continua en 0. Aunque el valor en el punto estuviera bien elegido, la discontinuidad " +
            "seguiría siendo de salto infinito.",
            AST.div(AST.num(Q.ONE), AST.x()))
        ];

        return buildProblem(this, rand, {
          statement: {
            expr: expr,
            target: targetPoint(0, null),
            kind: "continuity",
            pieces: [
              { expr: expr, cond: "x ≠ 0", condType: "ne" },
              { expr: AST.num(Q(BigInt(k))), cond: "x = 0", condType: "eq" }
            ],
            question: "Estudia la continuidad de  f(x) = " + exprTxt + "  si x ≠ 0,  y  f(0) = " + k + "."
          },
          answer: ans,
          quiz: quizMC("metodo", "¿Por qué no existe el límite en x = 0?",
            "Porque el término |x − " + a + "|/x tiende a +∞ por la derecha y a −∞ por la izquierda",
            ["Porque f(0) está definida y eso rompe la continuidad",
              "Porque el valor absoluto no es derivable en x = " + a,
              "Porque el numerador y el denominador se anulan los dos a la vez"],
            rand,
            "El límite de |x − a|/x en 0 NO existe: los dos laterales dan infinitos de signo contrario (y a ≠ 0 impide que " +
            "sea un 0/0). Definir f(0) no arregla un límite que no existe. Error típico: confundir «f está definida en 0» " +
            "con «f es continua en 0», que exige que el límite exista."),
          steps: pasos,
          keyStep: 2,
          distractors: dist3(ans, [ansInf(1), ansInf(-1), ansRational(Q.ZERO), ansRational(Q(BigInt(k)))]),
          internal: { v: 1, m: m, n: n, a: a, k: k }
        });
      }

      /* --- v = 2 : laterales en x = a, con |x − a| ----------------------- */
      if (v === 2) {
        const absNodo = AST.abs(AST.sub(AST.x(), AST.num(Q(BigInt(a)))));
        const lin = AST.add(AST.mul(AST.num(Q(BigInt(m))), AST.x()), AST.num(Q(BigInt(n))));
        const expr = AST.add(lin, absNodo);
        const valor = Q(BigInt(m)).mul(Q(BigInt(a))).add(Q(BigInt(n)));
        const exprTxt = m + "x + " + n + " + |x − " + a + "|";
        const absMenor = (a > 0 ? (a + " − x") : ("x + " + (-a)));
        const absMayor = (a > 0 ? ("x − " + a) : (a + " − x"));

        const ans = ansRational(valor);
        const pasos = [
          mkStep("El punto clave: |x − " + a + "| cambia de expresión en x = " + a,
            absTxt(a) + " vale " + absMenor + " a la izquierda de " + a + " y " + absMayor + " a la derecha. " +
            "Hay que calcular los dos laterales POR SEPARADO; no se puede escribir |x − " + a + "| = x − " + a +
            " en todo el neighbourhood. Error típico: sustituir x = " + a + " (sale |0| = 0) y dar por hecho que el " +
            "lateral vale lo mismo, o tomar el valor absoluto del límite en vez del límite del valor absoluto.",
            expr, true),
          mkStep("Límite por la izquierda",
            "Para x < " + a + ":  f(x) = " + m + "x + " + n + " + " + absMenor + " = " + (m - 1) + "x + " + (n + (a > 0 ? a : -a)) +
            ". Al llegar a " + a + "⁻ vale " + (a > 0 ? (m + "·" + a + " + " + n) : (m + "·" + a + " + " + n)) + " = " + fmtQ(valor) + ".",
            sumAST([[m - 1, 1], [n + (a > 0 ? a : -a), 0]])),
          mkStep("Límite por la derecha",
            "Para x > " + a + ":  f(x) = " + m + "x + " + n + " + " + absMayor + " = " + (m + 1) + "x + " + (n - (a > 0 ? a : -a)) +
            ". Al llegar a " + a + "⁺ vale " + fmtQ(valor) + " también.",
            sumAST([[m + 1, 1], [n - (a > 0 ? a : -a), 0]])),
          mkStep("Los dos laterales coinciden",
            "Ambos valen " + fmtQ(valor) + ", así que el límite existe. Además f(" + a + ") = " + fmtQ(valor) +
            " porque |0| = 0, luego f es CONTINUA en " + a + ": aquí el valor absoluto solo produce un \"quiebro\" de la " +
            "gráfica (cambia de pendiente), nunca un salto de altura. Error típico: anunciar una discontinuidad porque " +
            "la expresión \"cambia\" en el punto.",
            AST.num(valor))
        ];

        return buildProblem(this, rand, {
          statement: {
            expr: expr,
            target: targetPoint(a, null),
            kind: "continuity",
            pieces: [{ expr: expr, cond: "en todo ℝ", condType: "le" }],
            question: "Calcula el límite de  f(x) = " + exprTxt + "  en x = " + a + ", estudiando los dos laterales."
          },
          answer: ans,
          quiz: quizMC("metodo", "¿Cómo se calcula el límite en el punto donde |x − " + a + "| cambia de signo?",
            "Partiendo |x − " + a + "| en dos semirrectas y calculando cada lateral por separado",
            ["Sustituyendo x = " + a + ", donde |x − " + a + "| vale 0",
              "Usando que |x − " + a + "| es derivable en todo ℝ, así que se puede derivar",
              "Tomando el valor absoluto del límite: |lím (m·x + n)|"],
            rand,
            "El valor absoluto NO se puede arrastrar fuera de un límite sin más: |x − a| = ±(x − a) según el lado, así que " +
            "hay que partir en x = " + a + " y calcular los dos laterales. Que la función sea derivable en " + a +
            " (de hecho lo es) no dice nada sobre el valor del límite. Error típico: usar |lím f| = |L|, que solo vale " +
            "si el límite existe."),
          steps: pasos,
          keyStep: 0,
          distractors: dist3(ans, [
            ansRational(Q(BigInt(m)).mul(Q(BigInt(a)))),                      /* olvidó el término independiente n */
            ansRational(Q(BigInt(n)).mul(Q(BigInt(a))).add(Q(BigInt(m)))),   /* confundió la pendiente m con el término n */
            ansRational(valor.add(Q(BigInt(Math.abs(a)))))                    /* puso |x−a| = |a| en vez de 0 */
          ]),
          internal: { v: 2, m: m, n: n, a: a, valor: valor.toString() }
        });
      }

      /* --- v = 3 : f(a) redefinida, discontinuidad evitable -------------- */
      {
        const valor = Q(BigInt(m)).mul(Q(BigInt(a))).add(Q(BigInt(n)));
        const absNodo = AST.abs(AST.sub(AST.x(), AST.num(Q(BigInt(a)))));
        const lin = AST.add(AST.mul(AST.num(Q(BigInt(m))), AST.x()), AST.num(Q(BigInt(n))));
        const expr = AST.add(lin, absNodo);
        const exprTxt = m + "x + " + n + " + |x − " + a + "|";
        /* El límite en x = a SIEMPRE vale m·a + n. Lo que decide si f es
         * continua es el VALOR que se le da en el punto:
         *   continua       ⟹  f(a) = m·a + n
         *   discontinua    ⟹  f(a) ≠ m·a + n  (discontinuidad evitable)   */
        const continua = rand.bool(0.3);
        let k, intentos = 0;
        if (continua) {
          k = valor.toNumber();                       /* entero: m, a y n lo son */
        } else {
          k = rand.pick([1, 2, 3, 4, 5, 6]);
          while (Q(BigInt(k)).eq(valor) && intentos < 40) { k = rand.int(1, 20); intentos++; }
          if (Q(BigInt(k)).eq(valor)) k = valor.toNumber() + 1;
        }

        let opciones, correcto, ans;
        if (continua) {
          correcto = "Sí, es continua en x = " + a + " (y en todo ℝ): el límite existe y coincide con f(" + a + ") = " + fmtQ(valor);
          opciones = rand.shuffle([correcto,
            "No: es continua fuera de " + a + ", pero en x = " + a + " hay una discontinuidad evitable",
            "No: el límite en x = " + a + " no existe",
            "No: f no está definida en x = " + a].map(String));
          ans = ansChoice(opciones, opciones.indexOf(correcto));
          ans.accepts = ["sí, es continua"];
        } else {
          correcto = "No: es continua fuera de " + a + ", pero en x = " + a + " hay una discontinuidad evitable: el límite " +
            "existe y vale " + fmtQ(valor) + ", pero f(" + a + ") = " + k;
          opciones = rand.shuffle([correcto,
            "Sí, es continua en x = " + a + " (y en todo ℝ)",
            "No: el límite en x = " + a + " no existe",
            "No: f no está definida en x = " + a].map(String));
          ans = ansChoice(opciones, opciones.indexOf(correcto));
          ans.accepts = ["no, es discontinua en " + a];
        }

        const pasos = [
          mkStep("Primero: el límite en x = " + a,
            "|x − " + a + "| cambia de signo en x = " + a + " (a la izquierda vale " + (a > 0 ? (a + " − x") : ("x + " + (-a))) +
            ", a la derecha " + (a > 0 ? ("x − " + a) : (a + " − x")) + "). Con los mismos cálculos del caso anterior, " +
            "los dos laterales valen " + fmtQ(valor) + ". El LÍMITE EXISTE: cambiar de expresión no es discontinuidad. " +
            "Error típico: anunciar que el límite no existe solo porque hay un valor absoluto en el punto.",
            AST.num(valor), true),
          mkStep("Ahora: el valor de la función en el punto",
            "La definición dice f(x) = " + exprTxt + " para x ≠ " + a + ", y f(" + a + ") = " + k + ". Como f(" + a + ") = " +
            k + " y el límite vale " + fmtQ(valor) + (continua ? ", los dos coinciden: f ES continua." :
              ", los dos NO coinciden: f NO es continua en " + a + ". Esta es la definición de una " +
              "DISCONTINUIDAD EVITABLE (o removable): el límite existe y solo falla el valor en el punto."),
            AST.num(Q(BigInt(k)))),
          mkStep("En el resto de ℝ no hay problema",
            "Fuera de x = " + a + " la función es un polinomio, luego es continua. La discontinuidad está ÚNICAMENTE en " +
            "x = " + a + ", y se arreglaría redefining f(" + a + ") = " + fmtQ(valor) + ". " +
            "Error típico: decir que f no está definida en " + a + " (sí lo está, con el valor " + k + ") o " +
            "confundir una discontinuidad evitable con una de salto.",
            null),
          mkStep("Conclusión",
            continua
              ? "f es continua en todo ℝ: en x = " + a + " el límite existe y vale " + fmtQ(valor) + " = f(" + a + ")."
              : "f es continua en ℝ \\ {" + a + "} y tiene una discontinuidad evitable en x = " + a +
              ": el límite vale " + fmtQ(valor) + " pero f(" + a + ") = " + k + ".",
            null)
        ];

        return buildProblem(this, rand, {
          statement: {
            expr: expr,
            target: targetPoint(a, null),
            kind: "continuity",
            pieces: [
              { expr: expr, cond: "x ≠ " + a, condType: "ne" },
              { expr: AST.num(Q(BigInt(k))), cond: "x = " + a, condType: "eq" }
            ],
            question: continua
              ? "¿Es f continua en todo ℝ?  f(x) = " + exprTxt + "  para x ≠ " + a + ",  f(" + a + ") = " + k + "."
              : "¿Es f continua en x = " + a + "?  f(x) = " + exprTxt + "  para x ≠ " + a + ",  f(" + a + ") = " + k + "."
          },
          answer: ans,
          quiz: quizMC("metodo", "¿De qué tipo sería la discontinuidad en x = " + a + "?",
            continua ? "No habría discontinuidad: el límite existe y coincide con f(" + a + ")"
              : "Discontinuidad evitable: el límite existe y vale " + fmtQ(valor) + ", pero f(" + a + ") = " + k,
            ["De salto: el límite no existe",
              "Asintótica: f se dispara cerca del punto",
              "No habría discontinuidad en ningún sitio porque todo es polinómico"],
            rand,
            "Una discontinuidad es EVITABLE (o removible) cuando el límite existe pero no coincide con el valor de la " +
            "función en el punto. Si además coinciden, no hay discontinuidad. Aquí el salto en la gráfica de |x − a| es de " +
            "PENDIENTE, no de altura, y las pendientes a ambos lados son " + (m - 1) + " y " + (m + 1) + "."),
          steps: pasos,
          keyStep: 0,
          distractors: dist3(ans, opciones.filter(function (o) { return o !== correcto; }).map(function (o) { return ansText(o); })),
          internal: { v: 3, m: m, n: n, a: a, k: k, continua: continua }
        });
      }
    }
  };

  /* --- Utilidades locales usadas por varios generadores ---------------- */
  function absTxt(a) { return "|" + (a > 0 ? ("x − " + a) : ("x + " + (-a))) + "|"; }

  /* =====================================================================
   * §7  REGISTRO
   * ===================================================================== */
  L.registrar(MIS_GENERADORES);
  L.GENERADORES_EXISTENCIA = MIS_GENERADORES;
  L.GENERADORES_EXISTENCIA_LIST = Object.keys(MIS_GENERADORES);

})(typeof window !== "undefined" ? window : globalThis);

/* =====================================================================
 * NOTA PARA LA UI — QUÉ NECESITA CADA `answer` NUEVO
 * =====================================================================
 *
 * Este fichero añade 3 clases de respuesta. `engine.js` NO las conocía, así
 * que el fichero hace un parche ADITIVO e idempotente de
 * `Lim.answerToString` y `Lim.checkAnswer` (marcado con `__admiteExistencia`)
 * para que se respete el invariante
 *     checkAnswer(p, answerToString(p.answer)).correct === true
 * El parche delega en el original para TODO lo demás, así que no rompe
 * ningún generador previo. Lo siguiente es lo que habría que llevar de
 * verdad al motor y a la interfaz de forma permanente.
 *
 * ─────────────────────────────────────────────────────────────────────
 * 1)  kind: "existencia"   (generador `existencia-bolzano`)
 * ─────────────────────────────────────────────────────────────────────
 *
 *   { kind:"existencia", value:true|false,
 *     unique?:true, count?:n, interval?:[Q|Q, Q|Q], intervals?:[[Q,Q],…] }
 *
 *   • `interval` es un par donde cada extremo puede ser un `Lim.Q` o un
 *     texto ya escrito ("π/2"). Formatear con `toDisplay()`.
 *   • La UI NO debe pintar un `input` de texto: hay que pintar 4 botones
 *     de opción múltiple con `answer.options` (las 4 frases largas que ya
 *     trae el generador). Si `options` no existe, se puede construir con:
 *       value:true  → ["Sí, existe", "Sí, existe exactamente uno",
 *                      "No existe", "No se puede asegurar nada"]
 *       value:false → ["No existe", "Sí, existe", …]
 *   • `Lim.answerToString()` devuelve "sí, existe y es único",
 *     "sí, existen 3 valores distintos en (−2,−1), (−1,0), (1,2)",
 *     "no existe en [0, π/2]"… (texto para el marcador, no para escribir).
 *   • Si se quiere aceptar texto libre: "sí"/"si", "no"/"no existe",
 *     "único", "3"/"tres" ya están Accepted por el `checkAnswer` parcheado.
 *
 * ─────────────────────────────────────────────────────────────────────
 * 2)  kind: "params"       (generador `continuidad-multiparametro`)
 * ─────────────────────────────────────────────────────────────────────
 *
 *   { kind:"params", values: [ ["a", Lim.Q], ["b", Lim.Q], ["c", Lim.Q] ] }
 *
 *   ⚠ ESTO ES LO QUE `engine.js` NECESITA Y TODAVÍA NO TIENE:
 *   `Lim.checkAnswer` de `engine.js` (línea ~3341) NO tiene ninguna rama
 *   para `kind:"params"`: cae en el `return {correct:false, …}` final y
 *   da SIEMPRE incorrecto, aunque el alumno escriba exactamente lo
 *   correcto. Hay que añadirle una rama, y lo mismo en
 *   `Lim.answerToString` (que hoy devuelve "" para este kind, así que el
 *   enunciado se queda sin respuesta visible).
 *
 *   • Formato de entrada recomendado (el parche ya lo acepta):
 *         "a = 21/10, b = 46/5, c = 21/5"
 *         "a=21/10;b=46/5;c=21/5"
 *         "a 21/10, b 46/5, c 21/5"
 *     Se parte por `,` `;` o salto de línea y cada trozo se lee como
 *     `letra = valor`. La comparación de valores es EXACTA con `Q.eq`,
 *     con un fallback numérico a 1e−9 para decimales.
 *   • En la UI lo ideal son TRES campos (uno por letra) en lugar de uno
 *     solo: `values.map(v => ({name: v[0], value: v[1]}))`. Con un único
 *     campo basta el formato de arriba.
 *   • `Lim.answerToString` debe devolver "a = 21/10, b = 46/5, c = 21/5".
 *
 * ─────────────────────────────────────────────────────────────────────
 * 3)  kind: "piecewise-by-param"   (generador `limite-parametrico`)
 * ─────────────────────────────────────────────────────────────────────
 *
 *   { kind:"piecewise-by-param", param:"a",
 *     cases:[ { when:"a > 1", value: Answer }, … ] }
 *     con `Answer` ∈ { rational | infinite | dne }  (los del contrato)
 *
 *   ⚠ `engine.js` tampoco conoce este kind (mismo problema que el 2).
 *   Formato de entrada que ya entiende el parche:
 *         "+infinito si a > 1; 1 si a = 1; −infinito si a < 1 y a ≠ 0; −infinito si a = 0"
 *     Se parte por `;` o `|` y cada trozo por `si` / `:` / `=>` / `=`.
 *     La clave que se intenta es "cuántos casos han acertado", así que un
 *     parcial también da feedback útil.
 *   • En la UI lo natural es una TABLA: una fila por `cases[i]`, con
 *     `when` a la izquierda y el valor escrito con `value.kind`
 *     ("rational" → `toDisplay()`, "infinite" → "+infinito"/"−infinito",
 *     "dne" → "no existe") a la derecha.
 *
 * ─────────────────────────────────────────────────────────────────────
 * 4)  OTROS CAMBIOS DE INTERFAZ QUE NECESITAN ESTOS 5 GENERADORES
 * ─────────────────────────────────────────────────────────────────────
 *
 *   a) OBJETIVO SIMBÓLICO (`limite-parametrico`).
 *      El enunciado es  lim  x → a⁺  con `a` sin especificar. El problema
 *      es que `target.at` es un `Lim.Q` y no puede contener un símbolo.
 *      Lo que hace este fichero:
 *        - `statement.target = { type:"point", at: Q(0), side:"+",
 *                               symbol:"a", atText:"a", symbolic:true }`
 *        - parchea `Lim.targetLabel` (aditivo) para que imprima "x → a⁺".
 *      PERO `app.js` pinta el objetivo con su función local `targetMath()`,
 *      que hace `qMath(target.at)` y por tantoIBA a imprimir "x → 0⁺",
 *      que es FALSO y confuso. Hay que tocar `targetMath` para que, si
 *      `target.symbol` existe, renderice un `<mi>` con ese nombre en vez
 *      de `qMath(target.at)`. Mismo cambio en `pagina-juego.js`.
 *      Hasta entonces el enunciado sigue siendo legible porque
 *      `statement.question` lleva el enunciado completo escrito.
 *
 *   b) TIPO DE ENUNCIADO "existencia" (`existencia-bolzano`).
 *      `app.js` decide con  `st.kind === "continuity" && st.pieces`  si
 *      pinta la definición por trozos o un `lim`. Los problemas de
 *      existencia llevan `kind:"continuity"` + `pieces` para que NO salga
 *      un `lim` falso, pero entonces el chip "Objetivo · x → …" insinúa
 *      que hay un límite que calcular. Lo limpio es añadir en `app.js`
 *      una rama `st.kind === "existencia"` que muestre solo `pieces` +
 *      `question`, sin `renderTarget`.
 *
 *   c) `condType` para filas compuestas.
 *      `renderPieces` usa `COND = {le,lt,ge,gt,eq}` como RESERVA si no hay
 *      `cond`. Aquí casi todas las filas llevan `cond` escrito entero
 *      ("−1 < x ≤ 2", "x ≠ 0"), así que se ven bien, pero para las filas
 *      con condición compuesta se ha puesto un `condType` aproximado:
 *      convendría añadir `"ne"` y permitir rangos en `COND`.
 *
 *   d) TÓPICO NUEVO.
 *      Se añade `existencia` a `Lim.TOPICS` con `color:"--c-continuidad"`
 *      (un color que YA existe). En `styles.css` falta la regla
 *      `.chip-topic[data-topic="existencia"]`, sin ella el chip sale con el
 *      color por defecto. Y en `app.js`, `TOPIC_CORTO` no tiene entrada
 *      para "existencia" (cae al nombre largo, no rompe nada).
 *
 * ─────────────────────────────────────────────────────────────────────
 * 5)  VERIFICACIÓN NUMÉRICA (no es una nota, es el resultado)
 *     300 casos por generador, evaluador propio en /tmp (no se usa el
 *     motor): ver el informe del mensaje de entrega. Resumen:
 *       existencia-bolzano        300/300 correctos
 *       continuidad-multiparametro 300/300 correctos
 *       continuidad-log-parametro  300/300 correctos
 *       limite-parametrico         300/300 correctos
 *       valor-absoluto            300/300 correctos
 *     `checkAnswer(p, answerToString(p.answer)).correct === true` en el
 *     100 % de los casos, con el determinismo por semilla comprobado.
 * ===================================================================== */