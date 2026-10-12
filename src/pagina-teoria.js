/* =====================================================================
 * src/pagina-teoria.js — hoja de teoría de límites y continuidad
 * ---------------------------------------------------------------------
 * Página de estudio de 2º de Bachillerato (LOMLOE). Es contenido puro:
 * no toca el estado guardado ni llama al motor de problemas.
 *
 * Depende sólo de window.UI (elementos, tablas, chips) y del DOM.
 * El MathML se construye a mano con createElementNS: en HTML, meter
 * MathML por innerHTML no funciona, así que nada de plantillas de texto.
 * ===================================================================== */
(function (global) {
  "use strict";

  var UI = global.UI;
  if (!UI) return;

  var el = UI.el;
  var append = UI.append;
  var chip = UI.chip;
  var NS_MATH = "http://www.w3.org/1998/Math/MathML";

  /* =====================================================================
   * 1. Constructor de nodos MathML
   * ===================================================================== */

  /**
   * Devuelve una copia del nodo si ya estaba colocado en algún sitio.
   *
   * appendChild MUEVE un nodo, no lo duplica. Como aquí se reutilizan
   * operadores (=, →), atajos (x→a, los números) e incluso fórmulas
   * completas, sin esta copia la segunda fórmula que use un nodo se lo
   * quitaría a la primera y se quedaría coja.
   */
  function talvezCopia(n) {
    var reutilizado = n && typeof n.cloneNode === "function" && (n.__copia || n.parentNode);
    return reutilizado ? n.cloneNode(true) : n;
  }

  /** Marca un nodo MathML como reutilizable (siempre se copiará). */
  function comp(nodo) {
    nodo.__copia = true;
    return nodo;
  }

  /** Crea un elemento del namespace MathML y le cuelga los hijos dados. */
  function M(tag) {
    var n = document.createElementNS(NS_MATH, tag);
    var kids = flattenNodes(Array.prototype.slice.call(arguments, 1));
    for (var i = 0; i < kids.length; i++) {
      n.appendChild(talvezCopia(kids[i]));
    }
    return n;
  }

  /** Como M(), pero con atributos: MA("mtd", { stretchy: "true" }, [...]). */
  function MA(tag, attrs) {
    var n = M.apply(null, [tag].concat(Array.prototype.slice.call(arguments, 2)));
    for (var k in attrs) {
      if (attrs[k] != null) n.setAttribute(k, String(attrs[k]));
    }
    return n;
  }

  /* --- átomos ------------------------------------------------------- */

  function N(v) { return M("mn", v); }           // número
  function I(v) { return M("mi", v); }           // identificador
  function O(v) { return M("mo", v); }           // operador
  function Tx(v) { return M("mtext", v); }       // texto dentro de la fórmula
  /* Alias en mayúsculas, para que las fórmulas largas se lean de un vistazo:
     TX = texto, LT = menor que. */
  function TX(v) { return Tx(v); }
  var LT = comp(O("<"));

  function sp(w) {                               // espacio en línea
    var n = M("mspace");
    n.setAttribute("width", w || "0.4em");
    return n;
  }

  /* --- operadores compuestos ---------------------------------------- */

  function A() { return M("mrow", Array.prototype.slice.call(arguments)); }
  function Q(n, d) { return M("mfrac", n, d); }  // cociente
  function S(b, e) { return M("msup", b, e); }  // potencia
  function B(b, i) { return M("msub", b, i); }  // subíndice
  function Raiz(x, n) { return M("mroot", x, n); } // raíz de índice n

  /** Paréntesis con el contenido dentro. */
  function Par() { return M("mrow", O("("), Array.prototype.slice.call(arguments), O(")")); }

  /** Valor absoluto: | … | */
  function Abs() { return M("mrow", O("|"), Array.prototype.slice.call(arguments), O("|")); }

  /* --- atajos de uso frecuente -------------------------------------- */

  var EQ = comp(O("="));
  var TO = comp(O("→"));
  var NE = comp(O("≠"));
  var MAS = comp(O("+"));
  var MENOS = comp(O("−"));
  var INFP = comp(O("+∞"));
  var INFN = comp(O("−∞"));
  var INFC = comp(O("∞"));

  var n0 = comp(N(0)), n1 = comp(N(1)), n2 = comp(N(2));
  var n3 = comp(N(3)), n4 = comp(N(4)), n5 = comp(N(5));
  var n7 = comp(N(7)), n8 = comp(N(8));
  var n25 = comp(N(25)), n16 = comp(N(16));

  /** lim con el subíndice debajo y el cuerpo a la derecha. */
  function lim(bajo, cuerpo) {
    var k = [M("munder", I("lim"), bajo)];
    if (cuerpo != null) k.push(sp("0.45em"), cuerpo);
    return M("mrow", k);
  }

  var XA = comp(A(I("x"), TO, I("a")));
  var XAM = comp(A(I("x"), TO, S(I("a"), MENOS)));
  var XAP = comp(A(I("x"), TO, S(I("a"), MAS)));
  var XINF = comp(A(I("x"), TO, INFP));
  var XNINF = comp(A(I("x"), TO, INFN));
  var NINF = comp(A(I("n"), TO, INFC));
  var X0 = comp(A(I("x"), TO, n0));
  var X0P = comp(A(I("x"), TO, S(n0, MAS)));

  /* --- funciones -------------------------------------------------- */

  function Fn(a) { return A(I("f"), Par(a)); }
  function Gn(a) { return A(I("g"), Par(a)); }
  function sen(a) { return A(I("sen"), Par(a)); }
  function cos(a) { return A(I("cos"), Par(a)); }
  function tg(a) { return A(I("tg"), Par(a)); }
  function lnx(a) { return A(I("ln"), Par(a)); }
  function lgx(a, base) { return A(B(I("log"), base), Par(a)); }

  /** Raíz de índice n: ʳ√x */
  function rdx(x, n) { return Raiz(x, n); }

  /* --- atajos para la Llista 1 ---------------------------------------- */

  /** ln(1 + x): el límite notable del logaritmo. */
  function ln1px(x) { return lnx(A(n1, MAS, x)); }

  /** El número e como símbolo, para no repetirlo a mano. */
  function miE() { return I("e"); }

  /** a^(1/x): el caso lateral más tramposo de la lista. */
  function expM1sobreX(base) { return S(base || miE(), Q(n1, I("x"))); }

  /** |x| */
  function absx() { return Abs(I("x")); }

  /** Si el lado se indica como cadena ("<", ">", "=") se pinta en el texto. */
  function cond(texto) { return M("mtext", texto); }

  /**
   * Función definida a trozos.
   *   TROZOS([[expr, "si x ≤ 0"], [expr, "si x > 0"]])
   * Dibuja la llave con una mtable de dos columnas: expresión y condición.
   */
  function TROZOS(nombre, trozos) {
    var filas = trozos.map(function (t) {
      return MA("mtr", null, [
        MA("mtd", { columnalign: "left" }, t[0]),
        MA("mtd", { columnalign: "left" }, t[1] ? [cond(t[1])] : null)
      ]);
    });
    var llave = M("mrow", [
      MA("mo", { fence: "true", stretchy: "true", symmetric: "true" }, "{"),
      MA("mtable", { columnalign: "left left", rowspacing: "0.5em" }, filas)
    ]);
    var cab = [];
    if (nombre) cab = [I(nombre), Par(I("x")), EQ];
    return M("mrow", [M("mrow", cab), llave]);
  }

  /** Asterisco de E*(a, δ). */
  function sup0(base) { return S(base, O("∗")); }

  /** Raíz <math>, que es lo que el navegador necesita para pintar. */
  function raizMath() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift("math");
    var m = M.apply(null, args);
    m.setAttribute("xmlns", NS_MATH);
    m.setAttribute("display", "inline");
    return m;
  }

  /* =====================================================================
   * 2. Ayudas de maquetación
   * ===================================================================== */

  /**
   * Trozo de texto enriquecido. Dentro de P, LI y CALLOUT se admite:
   * cadena = texto plano, {b:"…"} = negrita, o un nodo ya hecho.
   */
  function anadir(destino, partes) {
    for (var i = 0; i < partes.length; i++) {
      var h = partes[i];
      if (h == null || h === false) continue;
      if (typeof h === "string" || typeof h === "number") {
        destino.appendChild(document.createTextNode(String(h)));
      } else if (h.b != null) {
        destino.appendChild(el("b", { text: h.b }));
      } else {
        destino.appendChild(talvezCopia(h));
      }
    }
    return destino;
  }

  function P() { return anadir(el("p"), Array.prototype.slice.call(arguments)); }
  function LI() { return anadir(el("li"), Array.prototype.slice.call(arguments)); }
  function H3(t) { return el("h3", { text: t }); }

  /** Lista con viñetas. Cada elemento puede ser una cadena o un array. */
  function UL() {
    var ul = el("ul");
    var items = flatten(Array.prototype.slice.call(arguments));
    for (var i = 0; i < items.length; i++) ul.appendChild(items[i]);
    return ul;
  }

  /** Lista numerada (el número lo pone el CSS con un contador). */
  function OL() {
    var ol = el("ol");
    var items = flatten(Array.prototype.slice.call(arguments));
    for (var i = 0; i < items.length; i++) ol.appendChild(items[i]);
    return ol;
  }

  /** Un <li> por argumento; cada argumento es un trozo o una lista de trozos. */
  function flatten(args) {
    var out = [];
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      out.push(Array.isArray(a) ? LI.apply(null, a) : LI(a));
    }
    return out;
  }

  /** Caja destacada. Variantes: "", "warn", "ok". */
  function CALLOUT() {
    var partes = Array.prototype.slice.call(arguments);
    var variante = "";
    if (partes.length && typeof partes[partes.length - 1] === "string" &&
        (partes[partes.length - 1] === "warn" || partes[partes.length - 1] === "ok")) {
      variante = partes.pop();
    }
    var c = el("div", { class: "callout" + (variante ? " callout-" + variante : "") });
    return anadir(c, partes);
  }

  /** Bloque plegable para lo secundario. */
  function DETALLES(titulo) {
    var d = el("details", { class: "card card-tight" });
    d.appendChild(el("summary", null, el("b", { text: titulo })));
    return d;
  }

  /** Caja de fórmula: siempre envuelve en <math> salvo que ya lo sea. */
  function F() {
    var box = el("div", { class: "formula" });
    var kids = flattenNodes(Array.prototype.slice.call(arguments));
    if (kids.length === 1 && String(kids[0].nodeName).toLowerCase() === "math") {
      box.appendChild(kids[0]);
    } else {
      box.appendChild(raizMath(kids));
    }
    return box;
  }

  /** Igual que F(), pero con menos aire: para fórmulas dentro de tablas. */
  function Fs() {
    var box = F.apply(null, arguments);
    box.className = "formula formula-sm";
    return box;
  }

  /**
   * Rejilla que parte el contenido en dos columnas en pantallas anchas.
   * Sirve para las secciones de consulta, donde sobran 400 px por la
   * derecha y una tabla de 26 filas deja muchísima línea en blanco.
   */
  function COLS() {
    var d = el("div", { class: "cols cols--2" });
    var kids = flattenNodes(Array.prototype.slice.call(arguments));
    for (var i = 0; i < kids.length; i++) d.appendChild(kids[i]);
    return d;
  }

  /**
   * Bloque de ejemplo resuelto, con su identificador (el número de
   * ejercicio de la Llista 1 cuando lo es). Llama a SEC_LINK para los
   * enlaces internos, así que se le pasan textos.
   */
  function EJEMPLO(id, titulo) {
    var d = el("div", { class: "example" });
    d.appendChild(el("div", { class: "example-title" }, [
      id ? el("span", { class: "ex-id", text: id }) : null,
      el("span", { text: titulo })
    ]));
    return d;
  }

  /** Enlace a otra sección de la misma hoja. */
  function SEC_LINK(id, texto) {
    return el("a", {
      class: "sec-link", href: "#" + id, text: texto || "→ " + id,
      onclick: function (ev) {
        var t = document.getElementById(id);
        if (!t) return;
        ev.preventDefault();
        t.scrollIntoView({ behavior: reducirMovimiento() ? "auto" : "smooth", block: "start" });
      }
    });
  }

  /** Añade el estilo de entradilla al primer párrafo de la sección. */
  function LEAD() {
    var p = P.apply(null, arguments);
    p.className = "sec-lead";
    return p;
  }

  function flattenNodes(args) {
    var out = [];
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (Array.isArray(a)) {
        out = out.concat(flattenNodes(a));
      } else if (a != null && a !== false) {
        out.push((typeof a === "string" || typeof a === "number")
          ? document.createTextNode(String(a))
          : a);
      }
    }
    return out;
  }

  /** Tabla de datos real, envuelta para que se pueda desplazar en móvil. */
  function TABLA(cabeceras, filas) {
    var thead = el("thead", null, el("tr", null, cabeceras.map(function (c) {
      return el("th", { scope: "col" }, celda(c));
    })));
    var tbody = el("tbody", null, (filas || []).map(function (f) {
      return el("tr", null, piezas(f).map(function (c) { return el("td", null, celda(c)); }));
    }));
    return el("div", { class: "table-wrap" }, el("table", { class: "table" }, [thead, tbody]));
  }

  /**
   * Normaliza el contenido de una celda o de una cabecera. Admite, igual
   * que P() y LI(): cadena, número, {b:"…"} para negrita, nodo ya hecho
   * y listas anidadas de cualquiera de los tres.
   */
  function piezas(c) {
    if (c == null || c === false) return [];
    if (typeof c === "string" || typeof c === "number") return [String(c)];
    if (c.b != null) return [el("b", { text: c.b })];
    if (Array.isArray(c)) {
      var out = [];
      for (var i = 0; i < c.length; i++) out = out.concat(piezas(c[i]));
      return out;
    }
    return [c];
  }

  function celda(c) { return piezas(c).map(talvezCopia); }

  /** Un paso del bloque .sol-steps (el número lo pone el CSS). */
  function PASO(titulo, detalle, formula, clave) {
    var s = el("div", { class: "step" + (clave ? " is-key" : "") });
    s.appendChild(el("div", { class: "step-t", text: titulo }));
    if (detalle) s.appendChild(el("div", { class: "step-d", text: detalle }));
    if (formula) s.appendChild(el("div", { class: "step-m" }, F(formula)));
    return s;
  }

  function PASOS() {
    var d = el("div", { class: "sol-steps" });
    var items = Array.prototype.slice.call(arguments);
    for (var i = 0; i < items.length; i++) d.appendChild(items[i]);
    return d;
  }

  /** La jerarquía de crecimiento es texto con separadores, no una fórmula. */
  function jerarquia() {
    return el("div", { class: "formula-text" }, [
      "Exponencial", el("mo", { text: ">" }), "Polinómica",
      el("mo", { text: ">" }), "Logarítmica",
      el("mo", { text: ">" }), "Constante"
    ]);
  }

  /* Señales de la chuleta */
  var OK = function (t) { return chip(t || "directo", "chip-ok"); };
  var AVISO = function (t) { return chip(t || "indeterminación", "chip-warn"); };
  var INFCH = function (t) { return chip(t || "infinito", "chip-accent2"); };
  var DNE = function (t) { return chip(t || "no existe", "chip-err"); };
  var PREG = function () { return el("b", { text: "¿?" }); };

  /* =====================================================================
   * 3. Contenido
   * ===================================================================== */

  var SECCIONES = [

    /* ---------------------------------------------------------------
     * 0. Chuleta de consulta rápida
     * ------------------------------------------------------------- */
    {
      id: "chuleta",
      titulo: "Chuleta rápida",
      build: function () {
        return [
          P("Ésta es la tabla que conviene mirar antes de un test. Una ",
            { b: "indeterminación no es un resultado" },
            ": es una señal de que sustituir directamente no vale y hay que transformar. La última columna dice si puedes responder ya o si toca trabajar."),

          TABLA(["Caso", "Lo que obtienes", "Señal"], [

            [F(lim(XA, Fn(A(I("a"))))), "f(a), si f es continua en a", OK()],

            [F(lim(XA, Q(Fn(A(I("a"))), N(3)))), "El cociente de f(a) entre 3", OK()],

            [F(lim(XA, Q(n1, A(I("x"), MENOS, S(I("x"), n0))))),
             "Denominador 0 y numerador ≠ 0: sale ±∞ o no existe", INFCH()],

            [F(lim(XA, Q(n0, n0))), "Factoriza el numerador y cancela", AVISO("0/0")],

            [F(lim(XINF, Q(S(I("x"), n2), I("x")))), "Compara los grados", AVISO("∞/∞")],

            [F(lim(XINF, Q(n1, S(I("x"), n2)))), "1/∞ = 0", OK()],

            [F(A(INFP, O("−"), INFP)), "Racionaliza o pon común denominador", AVISO("∞−∞")],

            [F(A(n0, O("·"), INFP)), "Pásalo a cociente", AVISO("0·∞")],

            [F(A(INFP, S(n0, Tx("+∞")))), "Con logaritmos; fuera de este tema", AVISO("∞⁰")],

            [F(A(S(n0, Tx("+∞")))), "Con logaritmos; fuera de este tema", AVISO("0⁰")],

            [F(A(S(A(n1, MAS, Q(n2, I("x"))), I("x")))), "Sale e elevado a un límite", AVISO("1^∞ → e")],

            [F(A(S(I("k"), INFP))), "k > 1 → +∞ · k = 1 → 1 · 0 < k < 1 → 0", OK("según k")],

            [F(A(INFP, S(I("k"), n1))), "k > 0 → +∞ · k < 0 → 0", OK("según k")],

            [F(A(S(INFP, INFP))), "+∞", OK()],

            [F(A(S(INFP, INFN))), "0", OK()],

            [F(A(S(n0, INFP))), "0", OK()],

            [F(A(Q(n0, INFP))), "0/∞ = 0", OK()],

            [F(lim(X0P, lnx(A(I("x"), MENOS, n2)))), "−∞, con asíntota vertical", INFCH()],

            [F(lim(A(I("x"), TO, S(Q(I("π"), n2), MAS)), tg(I("x")))),
             "Asíntota vertical de dos ramas", INFCH()],

            [F(lim(XINF, sen(I("x")))), "Oscila sin parar", DNE()],

            [F(lim(XINF, cos(I("x")))), "Oscila sin parar", DNE()],

            [F(lim(XINF, S(I("x"), I("n")))),
             "n > 0 → +∞; en −∞, par +∞ e impar −∞", OK("jerarquía")],

            [F(lim(X0, Q(sen(I("x")), I("x")))), "1", OK("notable")],

            [F(lim(X0, Q(lnx(A(n1, MAS, I("x"))), I("x")))), "1", OK("notable")],

            [F(lim(NINF, S(A(n1, MAS, Q(n1, I("n"))), I("n")))), "e ≈ 2,71828", OK("notable")]
          ]),

          CALLOUT("Regla de oro: si se anulan los dos términos del cociente, o si aparecen los dos infinitos, ",
            { b: "no puedes sustituir" },
            ". Primero identifica la forma y luego aplica la técnica de la sección 8.", "warn")
        ];
      }
    },

    /* ---------------------------------------------------------------
     * 1. Idea intuitiva de límite
     * ------------------------------------------------------------- */
    {
      id: "intuitiva",
      titulo: "Idea intuitiva",
      build: function () {
        return [
          P({ b: "Qué significa «x tiende a a». " },
            "Decimos que la función f tiene límite L en el punto a cuando, cuanto más cerca de a se sitúa x, más se parece f(x) a L. La función se va acercando a L sin llegar nunca a valer exactamente L."),

          F(lim(XA, Fn(I("x"))), EQ, I("L")),

          P("Tabla de valores de ", { b: "f(x) = x² − 2x" }, " acercándonos a 4 por la izquierda y por la derecha:"),

          TABLA(["x (por la izquierda)", "f(x)", "x (por la derecha)", "f(x)"], [
            [F(N("3.9")), F(N("7.41")), F(N("4.1")), F(N("8.61"))],
            [F(N("3.99")), F(N("7.9401")), F(N("4.01")), F(N("8.0601"))],
            [F(N("3.999")), F(N("7.994001")), F(N("4.001")), F(N("8.006001"))],
            [F(N("4")), F(N("8")), F(N("4")), F(N("8"))],
            [el("b", { text: "→ 4⁻" }), el("b", { text: "→ 8" }),
             el("b", { text: "→ 4⁺" }), el("b", { text: "→ 8" })]
          ]),

          P("Los dos lados se acercan a 8, luego el límite existe y vale 8. Da igual lo que valga f(4): el límite habla de lo que pasa ",
            { b: "alrededor" }, " de 4, no en 4."),

          H3("El contraejemplo: cuando los lados NO coinciden"),
          P("Consideremos ahora ", { b: "g(x) = x − E(x)" },
            ", donde E(x) es la parte entera de x (el suelo: el mayor entero menor o igual que x). En x = 1:"),

          TABLA(["x", "E(x)", "g(x) = x − E(x)", "Observación"], [
            [F(N("0.9")), F(n0), F(N("0.9")), "por la izquierda"],
            [F(N("0.99")), F(n0), F(N("0.99")), "por la izquierda"],
            [F(N("0.999")), F(n0), F(N("0.999")), "por la izquierda"],
            [el("b", { text: "→ 1⁻" }), "", el("b", { text: "→ 1" }), "el suelo sigue siendo 0"],
            [F(N("1.001")), F(n1), F(N("0.001")), "por la derecha"],
            [F(N("1.01")), F(n1), F(N("0.01")), "por la derecha"],
            [F(N("1.1")), F(n1), F(N("0.1")), "por la derecha"],
            [el("b", { text: "→ 1⁺" }), "", el("b", { text: "→ 0" }), "el suelo ya ha subido a 1"]
          ]),

          F(lim(XAM, Gn(I("x"))), EQ, n1, sp("1.4em"),
            lim(XAP, Gn(I("x"))), EQ, n0),

          P("El límite por la izquierda vale 1 y por la derecha vale 0. Como no coinciden, ",
            { b: "el límite no existe (DNE)" },
            ". La función da un salto justo en x = 1: es una discontinuidad de salto."),

          CALLOUT("x → a NO significa x = a, significa «acercarse a a». Por eso dentro de una raíz cuadrada o de un logaritmo pueden aparecer las indeterminaciones: lo que se anula es el valor de f(a), no el comportamiento de f cerca de a.", "warn")
        ];
      }
    },

    /* ---------------------------------------------------------------
     * 2. Definición formal
     * ------------------------------------------------------------- */
    {
      id: "definicion",
      titulo: "Definición formal",
      build: function () {
        var Ea = A(I("E"), Par(I("a"), I("δ")));
        var Ea2 = A(sup0(I("E")), Par(I("a"), I("δ")));
        var defE = A(O("{"), I("x"), O("∈"), I("ℝ"), O(":"), Abs(A(I("x"), O("−"), I("a"))), O("<"), I("δ"), O("}"));
        var defE2 = A(O("{"), I("x"), O("∈"), I("ℝ"), O(":"), n0, O("<"), Abs(A(I("x"), O("−"), I("a"))), O("<"), I("δ"), O("}"));

        return [
          P("Para poder ser preciso hace falta una definición. Se apoya en dos entornos y en dos números:"),

          UL(
            [{ b: "El entorno de a, E(a, δ), " },
             "es el conjunto de los números que distan de a menos que δ."],
            [{ b: "El entorno reducido, E*(a, δ), " },
             "es el mismo, pero quitando el propio punto a: además de la condición anterior se exige que la distancia sea mayor que 0."]
          ),

          F(Ea, EQ, defE),
          F(Ea2, EQ, defE2),

          H3("Definición ε − δ"),
          P("Sea f una función definida en un entorno de a (salvo quizá en el propio a). Entonces se cumple:"),

          F(lim(XA, Fn(I("x")), EQ, I("L")), O("⟺"),
            sp("0.4em"),
            I("∀"), I("ε"), O(">"), n0, sp("0.3em"),
            I("∃"), I("δ"), O(">"), n0, sp("0.3em"),
            I("∀"), I("x"), O("∈"), Ea2, sp("0.3em"),
            O(":"), Abs(A(Fn(I("x")), O("−"), I("L"))), O("<"), I("ε")),

          P("En palabras: ", { b: "para cualquier margen de error ε" },
            " existe un entorno de radio δ tan pequeño que, tomando x en ese entorno (distinto de a), el valor f(x) dista de L menos que ε."),

          CALLOUT("Esta definición dice ", { b: "cuánto" },
            " hay que acercarse (δ), no ", { b: "dónde" },
            ". Se usa poco en 2º de Bachillerato, pero es lo que da sentido riguroso a todo lo demás: si la definición se cumple, el límite existe."),

          (function () {
            var d = DETALLES("Por qué hace falta el entorno reducido");
            d.appendChild(P(
              "Si no quitásemos el punto a, la definición nunca podría cumplirse: cuando x se acerca a a, la distancia |f(x) − L| se haría tan pequeña como se quisiera, pero justo en x = a podría valer cualquier cosa. Quitar a de la ecuación es justamente lo que separa el límite del valor de la función."));
            return d;
          })()
        ];
      }
    },

    /* ---------------------------------------------------------------
     * 3. Límites laterales
     * ------------------------------------------------------------- */
    {
      id: "laterales",
      titulo: "Límites laterales",
      build: function () {
        var unoSobreXm2 = Q(n1, A(I("x"), O("−"), n2));
        return [
          P("Aproximarse a a puede hacerse por dos caminos. El límite por la izquierda se anota con el signo menos sobre a; el de la derecha, con el signo más."),

          F(lim(XAM, Fn(I("x"))), EQ, I("L"), sp("2em"),
            lim(XAP, Fn(I("x"))), EQ, I("L")),

          H3("Teorema clave"),
          P({ b: "El límite en un punto existe si y solo si los dos límites laterales existen y son iguales" },
            ", y en ese caso vale ese valor común."),

          F(lim(XA, Fn(I("x"))), EQ, I("L"), O("⟺"),
            lim(XAM, Fn(I("x"))), EQ, lim(XAP, Fn(I("x")))),

          P("Si los laterales son distintos, no hay nada que escribir: el límite ", { b: "no existe" },
            ". Si alguno de los dos no existe, tampoco."),

          CALLOUT("Ésta es la razón por la que el teorema clave se usa en casi todos los ejercicios con raíz cuadrada o logaritmo: basta calcular los dos laterales y compararlos.", "ok"),

          H3("Método de los signos para límites infinitos"),
          P("Cuando el denominador se anula, el límite puede ser infinito o puede no existir. Para decidirlo hay que mirar los signos en un entorno de a, sin calcular valores concretos: se cogen dos números, uno a cada lado, y se analiza el signo de cada factor. El signo de un cociente es el cociente de los signos."),

          P("Ejemplo: ", { b: "1/(x − 2)" }, " en x = 2. Los dos factores son constantes salvo donde se anula el denominador, así que el único cambio de signo lo provoca x − 2."),

          TABLA(["Lateral", "Signo de x − 2", "Signo del cociente", "Resultado"], [
            [F(lim(XAM, unoSobreXm2)), "negativo", "negativo", el("b", { text: "−∞" })],
            [F(lim(XAP, unoSobreXm2)), "positivo", "positivo", el("b", { text: "+∞" })]
          ]),

          P("Como un lateral es −∞ y el otro es +∞, el límite en x = 2 no existe: hay asíntota vertical."),

          H3("El mismo método con dos factores que cambian de signo"),
          P("En ", { b: "(x − 1)(x − 3) / (x − 2)²" }, " en x = 2 el numerador cambia de signo, pero el denominador no (es siempre positivo). Los dos laterales valen 0, luego el límite existe y vale 0. ",
            { b: "Un cambio de signo en el numerador sólo estropea el resultado si los dos laterales no casan" },
            "; si ambos dan lo mismo, el límite sigue existiendo."),

          (function () {
            var d = DETALLES("Resumen rápido del método de los signos");
            d.appendChild(OL(
              "Localiza los puntos donde se anula el denominador (o donde el logaritmo se define): ahí están las asíntotas verticales.",
              "Toma un valor a la izquierda y otro a la derecha de cada punto.",
              "Escribe el signo de cada factor en ambas columnas. El signo de un producto es el producto de los signos; el de un cociente, el cociente.",
              "Si en las dos columnas sale +∞ o −∞, el límite es ese valor. Si sale +∞ en una y −∞ en la otra, no existe.",
              "Si sale el mismo valor finito en las dos columnas, el límite existe: sólo entonces tiene sentido factorizar."
            ));
            return d;
          })()
        ];
      }
    },

    /* ---------------------------------------------------------------
     * 4. Operaciones con límites
     * ------------------------------------------------------------- */
    {
      id: "operaciones",
      titulo: "Operaciones y álgebra del infinito",
      build: function () {
        function op(sym) {
          return A(lim(XA, Fn(I("x"))), sym, lim(XA, Gn(I("x"))), EQ,
                   lim(XA, Fn(I("x"))), sym, lim(XA, Gn(I("x"))));
        }
        return [
          P("Si los límites de las funciones que intervienen existen y son finitos, se pueden operar como si fueran números. Eso es lo que permite calcular la mayoría de los límites sin usar ninguna técnica especial."),

          TABLA(["Operación", "Regla"], [
            [F(op(MAS)), "Suma y resta: se operan los límites"],
            [F(op(O("·"))), "Producto: se multiplican los límites"],
            [F(A(lim(XA, Q(Fn(I("x")), Gn(I("x")))), EQ,
                 Q(lim(XA, Fn(I("x"))), lim(XA, Gn(I("x")))))), "Cociente: sólo si el límite del denominador NO es 0"],
            [F(A(lim(XA, S(Fn(I("x")), I("n"))), EQ, S(lim(XA, Fn(I("x"))), I("n")))), "Potencia entera: se eleva el límite"],
            [F(A(lim(XA, rdx(Fn(I("x")), I("n"))), EQ, rdx(lim(XA, Fn(I("x"))), I("n")))), "Raíz de índice fijo: se saca el límite de la raíz"]
          ]),

          H3("Tabla del álgebra del infinito"),
          P("Cuando el resultado es infinito no se puede aplicar lo de arriba: habría que operar con números que no son números. Hay un puñado de resultados " ,
            { b: "determinados" }, " y otros que son ", { b: "indeterminados" },
            ". Indeterminado no significa que no se pueda: significa que hay que mirar el caso concreto."),

          TABLA(["Expresión", "Resultado", "Señal"], [
            [F(A(INFP, MAS, I("k"))), "+∞", OK()],
            [F(A(INFP, MENOS, I("k"))), "+∞", OK()],
            [F(A(INFN, MAS, I("k"))), "−∞", OK()],
            [F(A(INFP, MAS, INFP)), "+∞", OK()],
            [F(A(INFN, MAS, INFN)), "−∞", OK()],
            [F(A(INFN, MENOS, INFP)), "−∞", OK()],
            [F(A(INFP, MENOS, INFP)), PREG(), AVISO()],
            [F(A(INFN, MENOS, INFN)), PREG(), AVISO()],
            [F(A(I("k"), O("·"), INFP, Tx(",  k > 0"))), "+∞", OK()],
            [F(A(I("k"), O("·"), INFP, Tx(",  k < 0"))), "−∞", OK()],
            [F(A(I("k"), O("·"), INFN, Tx(",  k > 0"))), "−∞", OK()],
            [F(A(I("k"), O("·"), INFN, Tx(",  k < 0"))), "+∞", OK()],
            [F(A(INFP, O("·"), INFN)), "−∞", OK()],
            [F(A(Q(INFP, INFP))), PREG(), AVISO()],
            [F(A(Q(INFP, INFN))), PREG(), AVISO()],
            [F(A(Q(INFN, INFN))), PREG(), AVISO()],
            [F(A(Q(I("n"), INFP))), "0", OK()],
            [F(A(Q(I("n"), INFN))), "0", OK()],
            [F(Q(n0, INFP)), "0", OK()],
            [F(Q(n0, INFN)), "0", OK()],
            [F(A(S(I("k"), INFP), Tx(",  k > 1"))), "+∞", OK()],
            [F(A(S(I("k"), INFP), Tx(",  0 < k < 1"))), "0", OK()],
            [F(A(S(n1, INFP))), PREG(), AVISO("1^∞ → e")],
            [F(A(S(n0, INFP))), "0", OK()],
            [F(A(S(INFP, INFP))), "+∞", OK()],
            [F(A(S(INFP, INFN))), "0", OK()],
            [F(A(S(I("k"), INFN), Tx(",  k > 1"))), "0", OK()],
            [F(A(S(I("k"), INFN), Tx(",  0 < k < 1"))), "+∞", OK()],
            [F(A(INFP, S(I("k"), n1), Tx(",  k > 0"))), "+∞", OK()],
            [F(A(INFP, S(I("k"), n1), Tx(",  k < 0"))), "0", OK()],
            [F(A(INFP, S(n0, Tx("+∞")))), PREG(), AVISO("∞⁰")],
            [F(A(S(n0, Tx("+∞")))), PREG(), AVISO("0⁰")]
          ]),

          CALLOUT({ b: "El álgebra del infinito no es la de los números reales. " },
            "+∞ no es un número: no se puede escribir (+∞) − (+∞) = 0, porque antes habría que restar dos infinitos, y eso no está definido. Las filas de la tabla sólo dicen hacia dónde se va; cuando el resultado es indeterminado, el límite depende de cómo compiten los términos.", "warn"),

          (function () {
            var d = DETALLES("Por qué ∞ − ∞ y ∞/∞ dependen del caso");
            d.appendChild(P(
              "En x − (x − 1) el resultado es 1; en x − x es 0; en x − x/2 es +∞. Los tres tienen la forma ∞ − ∞. Lo que cambia es cuánto crece cada término, así que hay que transformar el límite para ver la diferencia. En los cocientes pasa igual: (2x² + 1)/(x² − 4) tiende a 2, mientras que (2x³ + 1)/(x² − 4) tiende a +∞, y los dos tienen la forma ∞/∞."));
            return d;
          })()
        ];
      }
    },

    /* ---------------------------------------------------------------
     * 5. Jerarquía de crecimiento
     * ------------------------------------------------------------- */
    {
      id: "crecimiento",
      titulo: "Jerarquía de crecimiento",
      build: function () {
        return [
          P("En el infinito hay una pregunta previa a cualquier cálculo: ", { b: "¿qué crece más rápido?" },
            " La jerarquía es esta y se cumple siempre, sin importar los coeficientes:"),

          jerarquia(),

          P("Es decir: cualquier exponencial crece más deprisa que cualquier polinomio, y cualquier polinomio crece más deprisa que cualquier logaritmo. Una constante es lo último."),

          CALLOUT("Un coeficiente grande no cambia la jerarquía: 1000x² sigue siendo polinómica y sigue perdiendo contra 2^x.", "ok"),

          H3("Las potencias en el infinito"),
          TABLA(["Expresión", "En +∞", "En −∞"], [
            [F(A(S(I("x"), I("n")), Tx(",  n > 0"))), "+∞",
             "par → +∞ · impar → −∞"],
            [F(A(S(I("x"), n0), Tx(",  n = 0"))), "1", "1"],
            [F(A(S(I("x"), A(MENOS, I("n"))), Tx(",  n < 0"))), "0", "0"]
          ]),

          H3("Exponenciales y logaritmos"),
          TABLA(["Expresión", "En +∞", "En 0⁺"], [
            [F(A(S(I("a"), I("x")), Tx(",  a > 1"))), "+∞", "0"],
            [F(A(S(I("a"), I("x")), Tx(",  0 < a < 1"))), "0", "+∞"],
            [F(A(lgx(I("x"), I("a")), Tx(",  a > 1"))), "+∞", "−∞"],
            [F(A(lgx(I("x"), I("a")), Tx(",  0 < a < 1"))), "+∞", "−∞"],
            [F(lnx(I("x"))), "+∞", "−∞"]
          ]),

          P("Fíjate en que la exponencial con base mayor que 1 y la menor que 1 hacen justo lo contrario: una crece y la otra se aplana. Por eso ",
            { b: "el mismo enunciado puede acabar en +∞ o en 0 según la base" }, "."),

          H3("Las trigonométricas no tienen límite en el infinito"),
          P("El seno y el coseno están ", { b: "acotados y son oscilantes" },
            ": van tomando valores entre −1 y 1 una y otra vez, sin acercarse a ningún número. Por eso"),

          F(lim(XINF, sen(I("x"))), NE, I("L"), sp("2em"),
            lim(XINF, cos(I("x"))), NE, I("L")),

          P("Si aparecen en un cociente de tipo ∞/∞ o 0/0, ésa es la clave para simplificar: si el numerador lleva una función trigonométrica está acotado, y si el denominador tiende a infinito, el cociente se anula."),

          (function () {
            var d = DETALLES("Por qué existe esa jerarquía (idea)");
            d.appendChild(P(
              "El crecimiento exponencial se apoya en que multiplicar por un número fijo mayor que 1 repetidas veces supera cualquier suma. Por eso aⁿ crece más que xᵏ para cualquier k fijo, y de ahí que 2ⁿ/x > x⁵ > ln x. En un límite ∞/∞ se decide comparando grados exactamente con este criterio."));
            return d;
          })()
        ];
      }
    },

    /* ---------------------------------------------------------------
     * 6. Límites infinitos y asíntotas
     * ------------------------------------------------------------- */
    {
      id: "asintotas",
      titulo: "Límites infinitos y asíntotas",
      build: function () {
        function tresSobreX2m4() {
          return Q(A(N("3"), S(I("x"), n2), MAS, n1), A(S(I("x"), n2), O("−"), N("4")));
        }
        function dosXmas5() {
          return Q(A(N("2"), I("x"), MAS, N("5")), A(I("x"), O("−"), n1));
        }
        function x2mas1() {
          return Q(A(S(I("x"), n2), MAS, n1), S(I("x"), n2));
        }
        var xCeroIzq = A(I("x"), TO, S(Q(I("π"), n2), MENOS));
        var xCeroDer = A(I("x"), TO, S(Q(I("π"), n2), MAS));

        return [
          P("Un límite infinito ", { b: "no es un resultado" },
            ": significa que la función se aleja sin límite, así que no hay ningún valor al que llegar. Sirve para describir la forma de la gráfica, y de ahí salen las asíntotas."),

          H3("Asíntota vertical"),
          P("La recta vertical x = x₀ es asíntota de f si el límite en x₀ —por la izquierda, por la derecha o en ambos lados— es infinito. Los tres casos típicos son:"),

          UL(
            [{ b: "Cociente con denominador anulado y numerador que no. " },
             "Ejemplo: en x = 2, la función 1/(x − 2) vale −∞ por la izquierda y +∞ por la derecha."],
            [{ b: "Logaritmo de algo que se anula. " },
             "Ejemplo: ln(x − 2) tiende a −∞ cuando x tiende a 2 por la derecha, porque su argumento se hace pequeño pero sigue siendo positivo."],
            [{ b: "Tangente donde se anula el coseno. " },
             "Ejemplo: tg x tiene asíntotas verticales en x = π/2 + kπ, con k entero."]
          ),

          F(lim(XAP, lnx(A(I("x"), O("−"), n2))), EQ, INFN),
          F(lim(xCeroDer, tg(I("x"))), EQ, INFN, sp("1.6em"),
            lim(xCeroIzq, tg(I("x"))), EQ, INFP),

          H3("Asíntota horizontal"),
          P("La recta horizontal y = L es asíntota de f si el límite en +∞ o en −∞ vale L, un número finito."),

          TABLA(["Función", "Dónde", "Asíntota"], [
            [F(tresSobreX2m4()), F(lim(XINF, Tx("la expresión"))), "y = 3"],
            [F(dosXmas5()), F(lim(XNINF, Tx("la expresión"))), "y = 2"],
            [F(x2mas1()), F(lim(XINF, Tx("la expresión"))), "y = 1"]
          ]),

          CALLOUT("Una misma función puede tener dos asíntotas horizontales distintas: y = 3 al irse a +∞ y y = −1 al irse a −∞. No hay contradicción: la horizontal marca la altura a la que se pega la rama, y cada rama se pega a la suya.", "warn"),

          (function () {
            var d = DETALLES("Asíntota oblicua (complemento)");
            d.appendChild(P(
              "Cuando el cociente de los términos de mayor grado tiene grado 1, la asíntota no es horizontal sino ",
              { b: "oblicua" },
              ": es la recta que sale de dividir los polinomios. Por ejemplo, (x² + 3x)/(x − 1) = x + 4 + 4/(x − 1), así que su asíntota es y = x + 4. En este tema normalmente basta con la vertical y la horizontal."));
            return d;
          })()
        ];
      }
    },

    /* ---------------------------------------------------------------
     * 7. Cálculo de límites
     * ------------------------------------------------------------- */
    {
      id: "calculo",
      titulo: "Cálculo de límites",
      build: function () {
        var polinomio = Q(A(N("4"), S(I("x"), n3), O("−"), S(I("x"), n2), MAS, N("7")),
                          A(N("2"), S(I("x"), n3), O("−"), I("x"), MAS, n1));
        var dividido = Q(A(N("4"), O("−"), Q(n1, S(I("x"), n1)), MAS, Q(N("7"), S(I("x"), n3))),
                         A(n2, O("−"), Q(n1, S(I("x"), n2)), MAS, Q(n1, S(I("x"), n3))));

        return [
          P("Éste es el método que se aplica siempre, en orden, antes de pensar en indeterminaciones:"),

          OL(
            [{ b: "Sustituye directamente. " },
             "Si al reemplazar x por a no aparece ninguna operación imposible (división por cero, raíz de un negativo, logaritmo de 0 o de un negativo), ya está: ése es el límite."],
            [{ b: "Mira qué se ha anulado. " },
             "Si el denominador se hace 0, cambia el paso: primero signos y laterales. Sólo si los laterales coinciden tiene sentido seguir."],
            [{ b: "Si los laterales difieren, el límite no existe. " },
             "Y no se sigue operando: da igual lo que valga f(a)."],
            [{ b: "Si estás en el infinito, manda el término de mayor grado. " },
             "Se divide numerador y denominador entre la mayor potencia de x que aparezca y se comparan los grados."]
          ),

          H3("Sustitución directa"),
          F(lim(A(I("x"), TO, n2), A(S(I("x"), n2), O("−"), N("3"), I("x"))), EQ, A(N("4"), O("−"), N("6")), EQ, N("-2")),

          H3("El caso del denominador anulado"),
          P("En ", { b: "(x² − 1)/(x − 1)" }, " en x = 1 el denominador se anula. Los signos dan: por la izquierda el numerador es negativo y el denominador también, luego el cociente es positivo y tiende a +∞; por la derecha ambos son positivos, luego también +∞. Los dos laterales coinciden, así que ",
            { b: "el límite sí existe" },
            ". Y entonces sí se puede factorizar el numerador, cancelar el factor común y calcular el valor."),

          H3("En el infinito: el término dominante"),
          P("En un cociente de polinomios, el término de mayor grado es el que manda. Se divide arriba y abajo por la mayor potencia de x que aparezca y se comparan los grados:"),

          F(lim(XINF, polinomio)),
          F(lim(XINF, dividido)),
          P("Quedan los coeficientes de los términos de mayor grado, así que el límite es 4/2 = 2."),

          TABLA(["Situación en el infinito", "Resultado"], [
            [F(Q(I("n"), INFC)), "0"],
            [F(A(Q(A(I("a"), S(I("x"), I("m"))), S(I("x"), I("n"))), Tx(",  m < n"))), "0"],
            [F(A(Q(A(I("a"), S(I("x"), I("m"))), S(I("x"), I("n"))), Tx(",  m = n"))), F(Q(I("a"), I("b")))],
            [F(A(Q(A(I("a"), S(I("x"), I("m"))), S(I("x"), I("n"))), Tx(",  m > n"))), "±∞ o DNE"]
          ]),

          (function () {
            var d = DETALLES("Errores típicos al calcular");
            d.appendChild(UL(
              "Sustituir y dar por bueno un 0/0 sin factorizar. El 0/0 no es un resultado: es una señal de que la sustitución no sirve.",
              "Confundir f(a) con el límite. Son cosas distintas salvo que f sea continua en a.",
              "Escribir ∞ − ∞ = 0. El álgebra del infinito no es la de los números reales.",
              "Cerrar el ejercicio dando una asíntota vertical sin comprobar que los dos laterales coinciden.",
              "En el infinito, quedarse con el término de mayor grado sin mirar el signo del coeficiente: si el grado del numerador es mayor, el signo de xⁿ al irse a −∞ depende de si n es par o impar."
            ));
            return d;
          })()
        ];
      }
    },

    /* ---------------------------------------------------------------
     * 8. Las siete indeterminaciones
     * ------------------------------------------------------------- */
    {
      id: "indeterminaciones",
      titulo: "Las 7 indeterminaciones",
      build: function () {
        var c3x2m1 = Q(A(N("3"), S(I("x"), n2), MAS, n1), A(S(I("x"), n4), O("−"), N("5")));
        var c3x2m1d = Q(A(N("3"), Q(n1, S(I("x"), n2)), MAS, Q(n1, S(I("x"), n4))),
                         A(n1, O("−"), Q(N("5"), S(I("x"), n4))));

        var cociente01 = Q(A(S(I("x"), n2), O("−"), N("4")), A(I("x"), O("−"), n2));
        var cociente02 = Q(A(A(I("x"), O("−"), n2), A(I("x"), O("+"), n2)), A(I("x"), O("−"), n2));

        var resta1 = A(Q(I("x"), A(I("x"), O("−"), n1)), O("−"), Q(I("x"), A(I("x"), MAS, n1)));
        var resta2 = A(Q(A(I("x"), A(I("x"), MAS, n1)), O("−"), A(I("x"), A(I("x"), O("−"), n1))),
                       A(A(I("x"), O("−"), n1), A(I("x"), MAS, n1)));
        var resta3 = Q(N("2"), I("x"));

        var raiz1 = Q(A(rdx(A(I("x"), MAS, N("9")), n2), O("−"), N("3")), I("x"));
        var raiz1c = Q(A(rdx(A(I("x"), MAS, N("9")), n2), MAS, N("3")),
                       A(rdx(A(I("x"), MAS, N("9")), n2), O("−"), N("3")));
        var raiz2 = Q(I("x"), A(rdx(A(I("x"), MAS, N("9")), n2), MAS, N("3")));

        var xtg = A(I("x"), O("·"), A(cos(I("x")), O("/"), sen(I("x"))));
        var xtg2 = Q(cos(I("x")), Q(sen(I("x")), I("x")));

        return [
          P("Una indeterminación es un símbolo que no significa nada por sí mismo. No son resultados: son avisos de que hace falta una transformación antes de poder calcular el límite."),

          TABLA(["Forma", "Qué es", "Qué técnica se usa"], [
            [F(Q(INFP, INFP)), AVISO("∞/∞"),
             "Dividir numerador y denominador entre la mayor potencia de x y comparar los grados."],

            [F(Q(n0, n0)), AVISO("0/0"),
             "Factorizar el numerador con identidades notables o con el método de Ruffini, y cancelar el factor común."],

            [F(A(INFP, O("−"), INFP)), AVISO("∞−∞"),
             "Si son cocientes: común denominador y luego término dominante. Si son raíces: racionalizar con el conjugado."],

            [F(A(n0, O("·"), INFP)), AVISO("0·∞"),
             "Pasar uno de los dos factores al denominador, para convertirlo en 0/0 o en ∞/∞, y resolver como los anteriores."],

            [F(A(INFP, S(n0, Tx("+∞")))), AVISO("∞⁰"),
             "Se resuelve tomando logaritmos, con herramientas posteriores a este tema."],

            [F(A(S(n0, Tx("+∞")))), AVISO("0⁰"),
             "También con logaritmos. El resultado típico es 1, pero hay que demostrarlo."],

            [F(A(S(A(n1, MAS, Q(I("c"), I("x"))), INFP))), AVISO("1^∞"),
             "La fórmula del número e: el resultado es e elevado al límite del exponente corregido (sección 9)."]
          ]),

          CALLOUT("7 indeterminaciones, 6 técnicas. Casi todo se reduce a ", { b: "comparar grados" },
            " (para ∞/∞), ", { b: "factorizar" }, " (para 0/0) y ", { b: "racionalizar" },
            " (para ∞−∞ con raíces). Las tres últimas se dejan para herramientas posteriores.", "ok"),

          H3("∞/∞ — comparar grados"),
          P("Se divide entre la mayor potencia de x que aparezca en el cociente y se comparan los grados resultantes."),

          F(lim(XINF, c3x2m1)),
          F(lim(XINF, c3x2m1d)),
          P("El grado del numerador (2) es menor que el del denominador (4), luego el límite es 0."),

          H3("0/0 — factorizar y cancelar"),
          P("Se busca un factor común entre numerador y denominador. El método de Ruffini permite encontrar la raíz que anula el numerador sin adivinar."),

          F(lim(A(I("x"), TO, n2), cociente01)),
          F(lim(A(I("x"), TO, n2), cociente02)),
          P("Tras cancelar el factor común queda x + 2, que vale 4. Si cancelas sin factorizar antes, estás suponiendo justo lo que quieres demostrar."),

          H3("∞ − ∞ — común denominador o conjugado"),
          P("Si los dos términos son cocientes, se llevan a común denominador y luego se aplica el caso ∞/∞:"),

          F(lim(XINF, resta1)),
          F(lim(XINF, resta1), EQ, lim(XINF, resta2)),
          F(lim(XINF, resta2), EQ, lim(XINF, resta3)),
          P("El resultado es 0, porque el grado del numerador es menor que el del denominador."),

          P("Si en cambio son raíces, se multiplica por el conjugado, que convierte la diferencia en una diferencia de cuadrados:"),

          F(lim(X0, raiz1)),
          F(lim(X0, raiz1), O("·"), F(lim(X0, raiz1c))),
          F(lim(X0, raiz2)),
          P("El límite es 1/6."),

          H3("0 · ∞ — pasarlo a cociente"),
          P("Se multiplica y se divide por lo mismo para convertir el producto en un cociente, y se resuelve como 0/0 o como ∞/∞."),

          F(lim(X0P, xtg)),
          F(lim(X0P, xtg), EQ, lim(X0P, xtg2)),
          F(lim(X0P, xtg2), EQ, Q(n1, n1), EQ, n1),
          P("Aquí tg x tiende a +∞ mientras que x tiende a 0: es un 0·∞. Al pasarlo a cociente aparece el límite notable sen x / x = 1 y el resultado es 1."),

          H3("∞⁰, 0⁰ y 1^∞"),
          P("Las tres se atacan tomando logaritmos o con la fórmula del número e, y su desarrollo formal queda fuera de este tema. En los niveles de este juego sólo aparece 1^∞, que es justo el contenido de la sección siguiente.")
        ];
      }
    },

    /* ---------------------------------------------------------------
     * 9. La fórmula del número e
     * ------------------------------------------------------------- */
    {
      id: "numero-e",
      titulo: "La fórmula del número e",
      build: function () {
        /* --- Expressions del ejemplo resueltas --- */
        var fxDef = Q(A(S(I("x"), n2), O("−"), n3), A(S(I("x"), n2), MAS, I("x")));
        var gxDef = A(N("2"), I("x"), MAS, n1);
        var fxM1 = Q(A(O("−"), I("x"), O("−"), n3), A(S(I("x"), n2), MAS, I("x")));
        var gPorFxM1 = Q(A(N("−2"), S(I("x"), n2), O("−"), N("7"), I("x"), O("−"), n3),
                         A(S(I("x"), n2), MAS, I("x")));
        var partida = A(S(fxDef, gxDef));

        /* --- la demostración de los cuatro pasos --- */
        var p1 = lim(NINF, S(A(n1, MAS, Q(n1, I("n"))), I("n")));
        var p2izq = lim(XINF, S(Gn(I("x")), Fn(I("x"))));
        var p2der = lim(XINF, S(Gn(I("x")), A(n1, MAS, A(Fn(I("x")), O("−"), n1))));
        var p3der = lim(XINF, S(A(n1, MAS, Q(n1, Gn(I("x")))),
                               A(Gn(I("x")), O("·"), A(Fn(I("x")), O("−"), n1))));
        var p4der = A(S(miE(), lim(XINF, A(Gn(I("x")), O("·"), A(Fn(I("x")), O("−"), n1)))));

        return [
          P("La forma 1^∞ tiene un resultado limpio, y ese número limpio es el número e. Todo el mecanismo cabe en cuatro pasos."),

          PASOS(
            PASO("El número e es un límite",
              "Ésta es la definición de e que se usa en este tema.",
              p1),

            PASO("Reescribimos la base cerca de 1",
              "Como f(x) → 1, también f(x) − 1 → 0. Reescribimos f como 1 + (f − 1) sin tocar el exponente.",
              [p2izq, EQ, p2der]),

            PASO("Extraemos el factor 1/g",
              "Metemos 1/g dentro del paréntesis y lo compensamos multiplicando el exponente por g. Como (1 + 1/g)^g tiende a e (es el paso anterior con n = g), el paréntesis ya no estorba.",
              [p2der, EQ, p3der]),

            PASO("El paréntesis es e",
              "Sustituimos ese paréntesis por e. Sólo queda calcular el límite del exponente corregido g·(f − 1), que es un producto corriente.",
              [p3der, EQ, p4der],
              true)
          ),

          CALLOUT({ b: "La fórmula, en corto: " },
            "si f(x) → 1 y g(x) → ∞, entonces el límite de f(x) elevado a g(x) es e elevado al límite de g(x)·(f(x) − 1). Si ese último límite es L, el resultado es e^L.", "ok"),

          H3("Ejemplo resuelto, paso a paso"),
          P("Calcular el límite en +∞ de ", { b: "((x² − 3)/(x² + x)) elevado a (2x + 1)" },
            ". Es de la forma 1^∞, porque el cociente tiende a 1 y el exponente tiende a ∞."),

          F(lim(XINF, partida)),

          PASOS(
            PASO("Identificar f y g",
              "Con f(x) = (x² − 3)/(x² + x) y g(x) = 2x + 1. Se comprueba que f → 1 y que g → +∞: las dos hipótesis de la fórmula se cumplen.",
              [Fn(A(Tx("la expresión de partida"))), EQ, fxDef,
               Gn(A(Tx("la expresión de partida"))), EQ, gxDef]),

            PASO("Calcular f(x) − 1",
              "Se resta 1 como cociente y se simplifica. En el numerador queda un factor x, y por eso ya se ve que la resta tiende a 0: es un 0/∞.",
              [Fn(A(Tx("la expresión de partida"))), O("−"), n1, EQ, fxM1]),

            PASO("Comprobar que f − 1 → 0",
              "Con el grado de arriba (1) menor que el de abajo (2), el límite es 0. La hipótesis se cumple.",
              lim(XINF, A(Fn(A(Tx("la expresión de partida"))), O("−"), n1))),

            PASO("Multiplicar por g(x)",
              "Se calculan g(x)·(f(x) − 1) y se ordenan los términos. El cociente es un ∞/∞, así que dividimos entre x² y manda el coeficiente de mayor grado.",
              A(Gn(A(Tx("la expresión de partida"))), O("·"), A(Fn(A(Tx("la expresión de partida"))), O("−"), n1), EQ, gPorFxM1)),

            PASO("El resultado",
              "El límite del producto corregido es −2, y aplicando la fórmula el límite buscado es e elevado a −2.",
              [lim(XINF, partida), EQ, S(miE(), N("-2"))],
              true)
          ),

          CALLOUT("Comprobación: con x = 100, ((10 000 − 3)/(10 000 + 100))^201 ≈ e^(−2) ≈ 0,135. Cuanto más crece x, más se acerca.", "ok")
        ];
      }
    },

    /* ---------------------------------------------------------------
     * 10. Límites notables
     * ------------------------------------------------------------- */
    {
      id: "notables",
      titulo: "Límites notables",
      build: function () {
        return [
          H3("El más importante: el límite del seno"),
          F(lim(X0, Q(sen(I("x")), I("x"))), EQ, n1),

          P("La tabla, con ", { b: "x en radianes" },
            ", justifica el resultado: el cociente se queda pegado a 1 por los dos lados."),

          TABLA(["x (radianes)", "sen x", "sen x / x"], [
            [F(N("0.1")), F(N("0.0998334")), F(N("0.998334"))],
            [F(N("0.01")), F(N("0.0099998")), F(N("0.999983"))],
            [F(N("0.001")), F(N("0.00099999")), F(N("0.9999998"))],
            [el("b", { text: "→ 0" }), el("b", { text: "→ 0" }), el("b", { text: "→ 1" })]
          ]),

          P("Si se escribe en grados, el resultado es π/180 y no 1: por eso el límite se enuncia siempre en radianes."),

          H3("El límite del número e"),
          F(lim(NINF, S(A(n1, MAS, Q(n1, I("n"))), I("n"))), EQ, miE(), sp("0.6em"),
            Tx("≈ 2,71828")),

          TABLA(["n", "(1 + 1/n)^n"], [
            [F(n1), F(N("2"))],
            [F(n2), F(N("2.25"))],
            [F(N("5")), F(N("2.48832"))],
            [F(N("10")), F(N("2.59374"))],
            [F(N("100")), F(N("2.70481"))],
            [F(N("1000")), F(N("2.71692"))],
            [el("b", { text: "→ ∞" }), el("b", { text: "→ 2,71828" })]
          ]),

          P("La sucesión crece siempre y se va acercando a e sin alcanzarlo nunca. Ésa es justamente la razón de ser de la base e en la fórmula de la sección anterior."),

          H3("El límite del logaritmo"),
          F(lim(X0, Q(lnx(A(n1, MAS, I("x"))), I("x"))), EQ, n1),

          CALLOUT("Los tres comparten estructura: son cocientes de la forma 0/0 que se resuelven con la misma técnica de la sección 8, y por eso se llaman ",
            { b: "notables" }, ": sus resultados se traducen directamente a 1.", "ok"),

          (function () {
            var d = DETALLES("Corolarios que salen directamente");
            d.appendChild(P(
              "Del límite del seno salen, sin más trabajo: tg x / x → 1, su inverso x / sen x → 1 y (1 − cos x)/x² → 1/2, que se demuestra sumando el seno a la vez porque 1 − cos x = 2 sen²(x/2). Del límite del logaritmo sale, por cambio de variable, ln x / (x − 1) → 1."));
            return d;
          })()
        ];
      }
    },

/* ---------------------------------------------------------------
     * 11. Dominio: dónde está definida la función
     * ------------------------------------------------------------- */
    {
      id: "dominio",
      titulo: "Dominio",
      build: function () {
        var racion = Q(A(I("x"), MAS, n1), A(I("x"), O("−"), n1, I("x"), MAS, n2));
        var raizMenos = Q(A(I("x"), MAS, n2), A(N("3"), O("−"), rdx(A(S(I("x"), n2), MAS, N("5")))));

        return [
          LEAD("Antes de estudiar la continuidad hay que saber ", { b: "dónde está definida la función" },
            ". El dominio es el conjunto de puntos donde la fórmula tiene sentido, y los que se quedan fuera son los únicos candidatos a asíntota vertical."),

          P("Una fórmula se queda sin sentido por ", { b: "tres motivos, y sólo por tres" },
            ": que el denominador se anule, que una raíz de índice par reciba un negativo, o que un logaritmo reciba algo que no es positivo."),

          COLS(
            TABLA(["Expresión", "Condición", "Dominio"], [
              [Fs(Q(A(I("x"), MAS, n1), A(I("x"), O("−"), n3))),
               "El denominador no se anula", F(A(I("ℝ"), O("∖"), n3))],
              [Fs(rdx(A(I("x"), MAS, n2))), "El radicando es 0 o mayor",
               F(A(S(I("ℝ"), n2), O("∖"), A(MENOS, INFP)))],
              [Fs(Q(n1, rdx(A(n1, O("−"), I("x"))))), "1 − x > 0",
               F(A(MENOS, INFP, n1, LT, n1))],
              [Fs(lnx(A(n2, O("−"), I("x")))), "2 − x > 0", F(A(MENOS, INFP, n2))],
              [Fs(racion), "x ≠ 1 y x ≠ −2", F(A(I("ℝ"), O("∖"), n1, O("∖"), N("-2")))],
              [Fs(A(rdx(S(I("x"), n2), O("−"), N("4")), O("/"), rdx(A(I("x"), O("−"), n1)))),
               "x ≥ 2 y x ≠ 1", F(A(S(I("ℝ"), n2), O("∖"), n1))]
            ]),

            el("div", null, [
              H3("Denominador anulado: dos casos distintos"),
              P("Hay una diferencia importantísima entre las dos primeras filas de la tabla:"),
              UL(
                [{ b: "Si el denominador se anula y el numerador también, " },
                 "puede que haya un límite finito: se factoriza y se cancela. Todavía no hay asíntota."],
                [{ b: "Si el numerador NO se anula, " },
                 "el cociente se dispara a infinito y el punto es una asíntota vertical sin discusión."],
                [{ b: "Con raíces y logaritmos no hay discusión posible: " },
                 "la función directamente no existe, así que el límite no puede ser más que infinito."]
              ),
              CALLOUT({ b: "Truco de examen: " },
                "antes de mirar nada, escribe el dominio. Los puntos que no salen son exactamente donde la función puede fallar. Estudiar la continuidad en el resto es automático: en polinomios y fracciones no hay dónde mirar.", "ok")
            ])
          ),

          H3("Ejemplo trabajado: el dominio dice dónde hay que mirar"),
          P("En ", { b: "f(x) = (x + 1) / (3 − √(x² + 5))" }, " el denominador se anula cuando:"),
          F(A(N("3"), O("="), rdx(A(S(I("x"), n2), MAS, N("5")))), O("⟺"),
            S(I("x"), n2), O("="), N("9"), O("⟺"), I("x"), EQ, S(n2, Tx("  o  ")), EQ, N("-2")),
          P("El numerador vale 3 en x = 2 y vale −1 en x = −2: no se anula en ninguno de los dos sitios. Los dos puntos son asíntotas verticales y el dominio es ℝ menos {−2, 2}. Fuera de ellos la función es continua sin más estudio."),

          P("Los cuatro laterales, que es lo que después hay que saber de memoria:"),
          TABLA(["Lateral", "Signo del denominador", "Signo del numerador", "Resultado"], [
            [F(lim(A(I("x"), TO, N("-2"), MAS), raizMenos)), "−", "+", el("b", { text: "+∞" })],
            [F(lim(A(I("x"), TO, N("-2"), MENOS), raizMenos)), "−", "−", el("b", { text: "−∞" })],
            [F(lim(A(I("x"), TO, n2, MENOS), raizMenos)), "+", "+", el("b", { text: "+∞" })],
            [F(lim(A(I("x"), TO, n2, MAS), raizMenos)), "−", "+", el("b", { text: "−∞" })]
          ]),

          CALLOUT("Fíjate en que la asíntota vertical no da el mismo resultado a los dos lados. En x = 2 la función se va a +∞ por la izquierda y a −∞ por la derecha: eso no es un error, es lo que pasa cuando el numerador es positivo y el denominador cambia de signo al pasar por cero.")
        ];
      }
    },

    /* ---------------------------------------------------------------
     * 12. Funciones definidas a trozos
     * ------------------------------------------------------------- */
    {
      id: "atropiezos",
      titulo: "Funciones a trozos",
      l1: true,
      build: function () {
        var troz5c = TROZOS("f", [
          [Q(A(I("x"), MAS, absx(), O("−"), n2), I("x")), "si x ≠ 0"],
          [n1, "si x = 0"]
        ]);
        var troz6 = TROZOS("f", [
          [A(I("a"), S(I("x"), n2), MAS, N("3"), I("x"), O("−"), N("5")), "si x < 1"],
          [A(MENOS, n2, I("x"), MAS, N("7")), "si x ≥ 1"]
        ]);
        var troz7 = TROZOS("f", [
          [A(I("a"), MAS, S(I("x"), n2)), "si x ≤ 0"],
          [lgx(A(I("x"), MAS, miE()), I("e")), "si x > 0"]
        ]);
        var troz8 = TROZOS("f", [
          [Q(n1, A(n2, I("x"), MAS, n2)), "si x ≤ −1"],
          [A(I("a"), I("x"), MAS, N("3")), "si −1 < x ≤ 2"],
          [A(MENOS, I("x"), MAS, I("b")), "si 2 < x ≤ 5"],
          [I("c"), "si x > 5"]
        ]);

        var e5c = EJEMPLO("L1 · 5(c)", "f(x) = (x + |x − 2|)/x para x ≠ 0, y f(0) = 1");
        e5c.appendChild(P("El valor absoluto esconde una función a trozos. Si x ≤ 2 entonces |x − 2| = 2 − x, así que el numerador vale x + 2 − x = 2 y f(x) = 2/x. Si x > 2 entonces |x − 2| = x − 2 y el numerador vale x + x − 2 = 2x − 2, luego f(x) = 2."));
        e5c.appendChild(F(troz5c));
        e5c.appendChild(TABLA(["Punto", "Lateral izquierdo", "Lateral derecho", "¿Continua?"], [
          [F(n0), "2/x → −∞", "2/x → +∞", el("b", { text: "No: 2.ª especie" })],
          [F(n2), "2/x → 1", "la rama constante → 2", el("b", { text: "No: salto de altura 1" })]
        ]));
        e5c.appendChild(P("En cualquier otro punto todo es racional, así que f es continua. Resumen: f es continua en ℝ salvo en 0 y en 2."));

        var e6 = EJEMPLO("L1 · 6", "Hallar a para que f sea continua en x = 1");
        e6.appendChild(F(troz6));
        e6.appendChild(P("Sólo hay que mirar x = 1, el único punto donde casan dos trozos. La función sí está definida, porque 1 ≥ 1, así que f(1) = −2·1 + 7 = 5. El límite por la derecha vale 5 y el de la izquierda vale a + 3 − 5 = a − 2."));
        e6.appendChild(F(A(lim(XAM, Fn(I("x"))), EQ, A(I("a"), O("−"), n2), sp("1.2em"),
                         lim(XAP, Fn(I("x"))), EQ, N("5"), sp("1.2em"),
                         Fn(n1), EQ, N("5"))));
        e6.appendChild(P("Para que los tres números coincidan hace falta a − 2 = 5, es decir ", { b: "a = 7" }, ". El orden importa: primero los dos laterales, después la comparación con f(a). Si se empieza por f(a) se puede llegar a un valor de a que sólo arregla el valor de la función y deja los laterales distintos."));

        var e7 = EJEMPLO("L1 · 7", "Hallar a para que f sea continua");
        e7.appendChild(F(troz7));
        e7.appendChild(P("El punto de empalme es x = 0. La función está definida con el primer trozo, así que f(0) = a + 0 = a. Por la izquierda también se tiende a a. Por la derecha, log(0 + e) = log e = 1."));
        e7.appendChild(F(A(lim(XAM, Fn(I("x"))), EQ, I("a"), sp("1.2em"),
                         lim(XAP, Fn(I("x"))), EQ, lnx(miE()), EQ, n1, sp("1.2em"),
                         Fn(n0), EQ, I("a"))));
        e7.appendChild(P("Los tres valores tienen que ser el mismo número, así que ", { b: "a = 1" }, "."));

        var e8 = EJEMPLO("L1 · 8", "Qué valores de a, b y c hacen f continua");
        e8.appendChild(F(troz8));
        e8.appendChild(P("Hay tres puntos de empalme: x = −1, x = 2 y x = 5. Se estudian por separado, de izquierda a derecha."));
        e8.appendChild(TABLA(["Punto", "Lateral izquierdo", "Lateral derecho y f(a)", "Condición"], [
          [F(N("-1")), "1/(2x+2) → −∞", "−a + 3", el("b", { text: "imposible" })],
          [F(n2), "2a + 3", "−2 + b y f(2) = 2a + 3", "b = 2a + 5"],
          [F(n5), "−5 + b y f(5) = −5 + b", "c", "c = b − 5"]
        ]));
        e8.appendChild(P("En x = −1 el primer trozo tiene el denominador anulado y el numerador vale 1, así que la rama se va a infinito por la izquierda. Ningún valor de a arregla eso: la función no puede ser continua en −1. En los otros dos puntos sí: con ", { b: "b = 2a + 5" }, " y ", { b: "c = b − 5 = 2a" }, " es continua en el resto de ℝ."));

        return [
          LEAD("Una función ", { b: "definida a trozos" }, " (o ", { b: "por partes" },
            ") usa una fórmula distinta en cada intervalo. En 2º de Bachillerato aparecen en casi todos los ejercicios de continuidad, porque son el enunciado más natural para preguntar «¿dónde falla?»."),

          H3("El método, que siempre es el mismo"),
          OL(
            [{ b: "Escribe la función con sus trozos. " },
             "Si hay un valor absoluto, abre y cierra el intervalo en el punto donde se anula lo que hay dentro."],
            [{ b: "Marca los puntos de empalme. " },
             "Son los puntos donde un trozo se acaba y empieza el siguiente. Sólo ahí puede fallar la continuidad."],
            [{ b: "Añade los puntos donde f no está definida. " },
             "Normalmente viene del denominador de algún trozo, como x = 0 en el 5(c). Es un punto de estudio más."],
            [{ b: "En cada punto, tres números. " },
             "Límite por la izquierda, límite por la derecha y valor f(a). Si los tres no coinciden, ahí no es continua. El resto de puntos son automáticos."],
            [{ b: "Acaba diciendo el tipo. " },
             "Laterales distintos y finitos: salto de 1.ª especie. Laterales distintos con alguno infinito: salto infinito. Laterales que no existen: 2.ª especie."]
          ),

          CALLOUT({ b: "El atajo que ahorra más tiempo: " },
            "sólo hay que mirar los puntos de empalme y los que se salen del dominio. No hace falta recorrer el eje entero. En el 5(c) son x = 0 y x = 2, y los demás puntos son automáticos."),

          COLS(
            el("div", null, [
              H3("La lista corta de puntos sospechosos"),
              P("Para no perderte, esta es la lista por familia de función:"),
              TABLA(["Trozo", "Puntos sospechoso"], [
                ["Polinomio", "ninguno"],
                ["Cociente p(x)/q(x)", "las raíces de q(x)"],
                ["√(g(x))", "donde g(x) = 0, por si además se anula el denominador"],
                ["ln(g(x))", "donde g(x) = 0, y fuera de donde g(x) ≤ 0"],
                ["|g(x)|", "donde g(x) = 0, por el empalme"],
                ["Trozo A y trozo B", "el punto donde casan"],
                ["e^(1/(x−a)) o a^(1/(x−a))", "x = a, siempre"]
              ]),
              CALLOUT("La lista es corta a propósito. En un examen, casi todo el trabajo de una función a trozos está en dos o tres puntos; el resto es mirar que no se te haya escapado ninguno.", "ok")
            ]),

            el("div", null, [
              H3("Truco: |x − a| se abre en dos trozos"),
              P("Siempre que aparezca un valor absoluto, se sustituye por dos trozos y el problema se convierte en una función a trozos normal:"),
              F(absx(), EQ, A(I("x"), Tx(",  si x ≥ 0"), MAS, A(MENOS, I("x"), Tx(",  si x < 0")))),
              P("Con eso, en el ejercicio 5(c), f(x) = (x + |x − 2|)/x se convierte en:"),
              F(A(Q(A(I("x"), O("+"), A(n2, O("−"), I("x")))), I("x")), Tx(",  si x ≤ 2"), sp("0.8em"),
                 O("∪"), sp("0.8em"),
                 Q(A(A(n2, I("x"), O("−"), n2)), I("x")), Tx(",  si x > 2")),
              P("Y de ahí sale todo lo que hace falta.")
            ])
          ),

          H3("Los ejercicios de la lista, resueltos"),
          e5c, e6, e7, e8,

          (function () {
            var d = DETALLES("Dos ejercicios más, del mismo tipo");
            var p1 = EJEMPLO("L1 · 5(b)", "f(x) = √(4 − (x − 3)²) en [0, 7] y f(x) = 7x − 61 en (7, 8]");
            p1.appendChild(P("Los puntos donde mirar son x = 7, que es el empalme, y las raíces de 4 − (x − 3)² = 0, que son x = 1 y x = 5, las dos dentro del primer trozo."));
            p1.appendChild(TABLA(["Punto", "Lateral izquierdo", "Lateral derecho", "¿Continua?"], [
              [F(n1), "√(4 − 4) → 0", "√(4 − 4) → 0", el("b", { text: "Sí: 0 = 0" })],
              [F(n5), "√(4 − 4) → 0", "√(4 − 4) → 0", el("b", { text: "Sí: 0 = 0" })],
              [F(n7), "√(4 − 16) → 0", "7·7 − 61 = −12", el("b", { text: "No: salto" })]
            ]));
            p1.appendChild(P("Los dos primeros puntos son la parte fina: el radicando llega a 0 justo ahí, pero la raíz sigue existiendo y vale 0 en ese punto, luego la función es continua. El 7 es el salto evidente, y como los dos laterales son finitos es un salto de primera especie."));
            d.appendChild(p1);

            var p2 = EJEMPLO("L1 · 5(d)", "f(x) = x·sen(1/x) si x ≠ 0, y f(0) = 0");
            p2.appendChild(P("El único punto sospechoso es x = 0. Ahí no se puede sustituir ni factorizar: la función se anula pero no hay nada que cancelar. La herramienta correcta es el teorema de la compresión, que es el apartado siguiente de la hoja."));
            p2.appendChild(P("La cota se saca del valor absoluto del seno, que nunca pasa de 1: −1 ≤ sen(1/x) ≤ 1. Multiplicando por x y quedándose con el valor absoluto sale |x·sen(1/x)| ≤ |x|, y como |x| → 0, el límite es 0 y f es continua en 0."));
            d.appendChild(p2);
            return d;
          })()
        ];
      }
    },

    /* ---------------------------------------------------------------
     * 13. Laterales tramposos: 1/x en el exponente y valor absoluto
     * ------------------------------------------------------------- */
    {
      id: "laterales-espe",
      titulo: "Laterales tramposos",
      l1: true,
      build: function () {
        var e1x = expM1sobreX(miE());
        var tres1x = expM1sobreX(n3);
        var unoDosMas = Q(n1, A(n2, MAS, e1x));
        var dosM1x = S(n2, S(MENOS, n1, I("x")));

        return [
          LEAD("Hay una familia de funciones en las que los dos laterales dan números ", { b: "completamente distintos" },
            " y por tanto el límite no existe aunque cada lateral exista bien. Son las que llevan ", { b: "1/x en el exponente" }, " o un valor absoluto. Es el error más caro de la lista, porque la respuesta correcta es «no existe» y la tentación es escribir +∞."),

          H3("La tabla que lo resuelve todo"),
          P("La regla es una sola: ", { b: "1/x se va a −∞ por la izquierda y a +∞ por la derecha" },
            ". Y una base mayor que 1 crece con el exponente, mientras que una base entre 0 y 1 hace justo lo contrario. De ahí sale la tabla:"),

          TABLA(["Expresión", "x → 0⁻", "x → 0⁺", "¿El límite existe?"], [
            [F(lim(X0P, I("n"))), "−∞", "+∞", el("b", { text: "no" })],
            [Fs(Q(n1, I("x"))), "−∞", "+∞", el("b", { text: "no" })],
            [Fs(Q(n1, absx())), "+∞", "+∞", el("b", { text: "sí: +∞" })],
            [Fs(e1x), "0", "+∞", el("b", { text: "no" })],
            [Fs(tres1x), "0", "+∞", el("b", { text: "no" })],
            [Fs(dosM1x), "+∞", "0", el("b", { text: "no" })],
            [Fs(Q(n1, A(n1, MAS, e1x))), "1", "0", el("b", { text: "no" })],
            [Fs(A(Q(n1, n2), MAS, e1x)), "1/2", "+∞", el("b", { text: "no" })]
          ]),

          CALLOUT({ b: "La fila del valor absoluto es la trampa hermana. " },
            "|x| nunca es negativo, así que 1/|x| se va a +∞ por los dos lados: el límite sí existe y vale +∞. Si el enunciado lleva un |x| dentro del denominador o del exponente, no apliques el caso de 1/x sin mirar.", "warn"),

          H3("Ejercicio 4(c): e^(1/|x|) en x = 0"),
          P("Como |x| > 0 siempre y |x| → 0 por los dos lados, 1/|x| → +∞, y por tanto el exponencial tiende a +∞ por los dos lados. El límite existe y vale ",
            { b: "+∞" }, ", con asíntota vertical en x = 0."),

          H3("Ejercicio 4(d): 3^(1/x) en x = 0"),
          P("Por la izquierda el exponente se va a −∞ y una base mayor que 1 elevada a −∞ tiende a 0. Por la derecha el exponente se va a +∞ y el resultado es +∞."),
          F(lim(XAM, tres1x), EQ, n0, sp("1.6em"),
            lim(XAP, tres1x), EQ, INFP),
          P("0 y +∞ no son el mismo número, así que ", { b: "el límite no existe" }, "."),

          H3("Ejercicio 9(f): 1 / (2 + e^(1/x)) en x = 0"),
          P("Aquí el 1/x va dentro del exponencial y no en el denominador, así que la técnica es la misma pero el resultado sale distinto en cada lado:"),
          F(lim(XAM, unoDosMas), EQ, Q(n1, n2), sp("1.6em"),
            lim(XAP, unoDosMas), EQ, Q(n1, INFP), EQ, n0),
          P("Por la izquierda e^(1/x) → 0, el denominador tiende a 2 y el cociente a 1/2. Por la derecha e^(1/x) → +∞, el denominador se va a +∞ y el cociente a 0. Como 1/2 ≠ 0, ", { b: "el límite no existe" }, "."),

          CALLOUT({ b: "El resumen en una frase: " },
            "todo lo que lleve 1/x en algún sitio se resuelve por lados, siempre. Si los dos lados dan lo mismo, el límite existe y se escribe ese valor; si no, se escribe «no existe» y se pasa al siguiente ejercicio. Nunca se escribe «±∞».", "ok")
        ];
      }
    },

    /* ---------------------------------------------------------------
     * 14. Límites y continuidad con parámetros
     * ------------------------------------------------------------- */
    {
      id: "parametros",
      titulo: "Parámetros",
      l1: true,
      build: function () {
        var ej10 = Q(A(S(I("x"), n2), O("−"), A(A(n1, O("−"), I("a")), I("x"), O("−"), I("a"))),
                     A(S(I("x"), n2), O("−"), S(I("a"), n2)));
        var num10 = A(S(I("x"), n2), O("−"), A(A(n1, O("−"), I("a")), I("x"), O("−"), I("a")));

        return [
          LEAD("Un límite ", { b: "con parámetro" }, " lleva una letra que no es la variable. No se elimina: se deja puesta, se opera, y al final se responde a la pregunta que haga el enunciado, normalmente «¿para qué valor de a…?»."),

          H3("El método en tres pasos"),
          OL(
            [{ b: "Escribe el límite entero, con la letra dentro. " },
             "No la trates como un número: es justo lo que vas a despejar al final."],
            [{ b: "Haz la cuenta hasta donde se pueda. " },
             "Normalmente se llega a un cociente o a una igualdad del tipo L = 2a + 5."],
            [{ b: "Mira qué pide el enunciado y despeja. " },
             "«Para que sea continua» → iguala a f(a). «Para que valga 0» → iguala a 0. «Para que no exista» → busca los valores que lo rompen."]
          ),

          CALLOUT({ b: "El paso 3 es donde se falla. " },
            "Antes de despejar, escribe en una línea qué condición tiene que cumplirse. Si te lo saltas, obtendrás un valor de a sin comprobar que era el que pedía el enunciado.", "warn"),

          H3("Ejercicio 10: el mismo límite para todos los valores de a"),
          P("Hay que calcular ", { b: "lim(x → a⁺) (x² − (1 − a)x − a) / (x² − a²)" },
            " según el valor de a. El truco está en ver el numerador como un producto:"),
          F(A(num10, EQ, A(I("x"), O("−"), n1), O("·"), A(I("x"), MAS, I("a")))),
          P("Se comprueba multiplicando: (x − 1)(x + a) = x² + ax − x − a = x² − (1 − a)x − a. Y el denominador es x² − a² = (x − a)(x + a). Se cancela el factor (x + a) y queda el cociente simple:"),
          F(ej10),
          P("El numerador se queda en a − 1 y el denominador se acerca a 0 siempre por la derecha, porque x − a > 0. Así que todo depende del signo de a − 1, con dos valores que hay que tratar aparte:"),
          TABLA(["Valor de a", "Qué pasa", "El límite"], [
            [F(A(I("a"), TX("> 1"))), "a − 1 > 0 y el denominador → 0⁺", el("b", { text: "+∞" })],
            [F(A(I("a"), TX("= 1"))), "el cociente vale 1 para todo x ≠ 1", el("b", { text: "1" })],
            [F(A(I("a"), TX("< 1,  a ≠ 0"))), "a − 1 < 0 y el denominador → 0⁺", el("b", { text: "−∞" })],
            [F(A(I("a"), TX("= 0"))), "la expresión es (x − 1)/x → 1", el("b", { text: "1" })]
          ]),
          P("Los dos casos sueltos (a = 1 y a = 0) son los que se pierden si se divide sin mirar. Cuando la letra aparece también en el punto al que se tiende —aquí x → a— cancelar un factor puede no ser válido justo en ese punto, y por eso hay que comprobarlos a mano."),

          H3("El otro tipo: la a de la continuidad"),
          P("Los ejercicios 6, 7 y 8 de la lista son del otro tipo: no hay ningún límite que calcular, hay una ", { b: "a que hace que la función sea continua" },
            ". La receta es la de siempre y la tienes en ", SEC_LINK("atropiezos", "funciones a trozos"),
            ": los tres números del punto de empalme tienen que coincidir, y dos de ellos ya están escritos, así que la incógnita sale sola."),
          F(A(I("a"), EQ, Tx("valor al que deben igualarse los tres números del punto de empalme"))),
          CALLOUT("En el 6 sale a = 7, en el 7 sale a = 1, y en el 8 no hay ningún valor de a que arregle x = −1, aunque sí b = 2a + 5 y c = b − 5. Los tres están resueltos paso a paso en la sección anterior.", "ok")
        ];
      }
    },

    /* ---------------------------------------------------------------
     * 11. Continuidad
     * ------------------------------------------------------------- */
    {
      id: "continuidad",
      titulo: "Continuidad",
      build: function () {
        return [
          P("Una función es ", { b: "continua" },
            " en un punto si no da ningún salto, ni sube de golpe de un valor a otro, ni se le va por infinito al llegar. Formalmente son ",
            { b: "tres condiciones" }, " que tienen que cumplirse a la vez."),

          TABLA(["Condición", "Qué exige"], [
            [el("b", { text: "1. Está definida" }), "Que f(a) exista: el punto a pertenece al dominio de f."],
            [el("b", { text: "2. El límite existe" }), "Que el límite en a exista, es decir, que los dos laterales coincidan."],
            [el("b", { text: "3. Coinciden" }), "Que el valor del límite sea igual al valor de la función: límite en a = f(a)."]
          ]),

          P("Si falla la primera o la tercera, la discontinuidad es ", { b: "evitable" },
            ": basta con redefinir f(a) con el valor del límite y la función queda continua. Si falla la segunda, no hay nada que redefinir: la discontinuidad es ",
            { b: "no evitable" }, "."),

          H3("Continuidad lateral"),
          P("Se puede ser continuo por un solo lado, sin serlo por el otro. Se dice que f es continua ",
            { b: "por la derecha en a" },
            " si sólo hacen falta la condición 1, la coincidencia del lateral derecho y la igualdad de ese lateral con f(a). Análogamente, por la izquierda."),

          P("Una función puede ser continua por la derecha y no por la izquierda, o al revés. Es exactamente lo que le pasa a la parte entera E(x) de la sección 1: E es continua por la derecha en cada entero y salta por la izquierda."),

          H3("Continuidad en un intervalo"),
          TABLA(["Intervalo", "Qué se exige"], [
            [el("b", { text: "Abierto (a, b)" }), "Que f sea continua en cada punto del intervalo."],
            [el("b", { text: "Cerrado [a, b]" }), "Continua en (a, b), además de continua por la derecha en a y por la izquierda en b."],
            [el("b", { text: "Semicerrado [a, b)" }), "Continua en (a, b) y continua por la derecha en a."],
            [el("b", { text: "Semicerrado (a, b]" }), "Continua en (a, b) y continua por la izquierda en b."]
          ]),

          CALLOUT("La idea: en un intervalo cerrado hay que poder acercarse a los extremos ", { b: "desde dentro" },
            ". En cada extremo sólo se pide un sentido, porque fuera del intervalo la función puede no estar definida.", "ok"),

          H3("Operaciones con funciones continuas"),
          P("Las propiedades de la continuidad hacen que casi todo siga siendo continuo:"),

          UL(
            "Si f y g son continuas en a, también lo son f + g, f − g y f · g.",
            ["Si f y g son continuas en a y g(a) ≠ 0, entonces f/g es continua en a. ",
             { b: "Ojo" },
             ": si g(a) = 0, el cociente puede dejar de estar definido y hay que estudiarlo aparte."],
            "Si f es continua en a y k es otra función continua, la composición k(f(x)) es continua en a.",
            "Si f es derivable en todo un intervalo, su derivada no puede dar saltos (Darboux, sección 13)."
          ),

          (function () {
            var d = DETALLES("Las funciones que usas y son continuas en todas partes");
            d.appendChild(P(
              "Los polinomios, las funciones racionales (salvo donde el denominador se anula), las exponenciales, los logaritmos en su dominio, las trigonométricas, las raíces y el valor absoluto. Todo lo que no sea racional, exponencial, logarítmica ni trigonométrica necesita un estudio aparte para poder afirmar que es continua."));
            return d;
          })()
        ];
      }
    },

    /* ---------------------------------------------------------------
     * 12. Tipos de discontinuidad
     * ------------------------------------------------------------- */
    {
      id: "discontinuidad",
      titulo: "Tipos de discontinuidad",
      build: function () {
        var fSalto = A(I("f"), Par(I("x")), EQ, I("x"));
        var fSaltoB = A(I("f"), Par(I("x")), EQ, A(I("x"), O("−"), n2));
        var fEvitable = A(I("f"), Par(I("x")), EQ, I("x"));

        return [
          P("Cuando f no es continua en a, la discontinuidad se clasifica según qué condiciones de las tres fallan."),

          TABLA(["Tipo", "Qué pasa", "Ejemplo en x = 0", "¿Se arregla?"], [
            [el("b", { text: "Evitable" }),
             "El límite existe, pero f no está definida en a o f(a) es distinto del límite.",
             [F(fEvitable), " con f(0) = 3: el límite es 0 y f(0) vale 3"],
             "Sí: se redefine f(0) = 0"],

            [el("b", { text: "No evitable, 1ª especie, salto finito" }),
             "Los dos laterales existen, son distintos y los dos son finitos.",
             [F(fSalto), " en [0, 1) y ", F(fSaltoB), " en [1, 3]. Laterales: 1 y −1."],
             "No"],

            [el("b", { text: "No evitable, 1ª especie, salto infinito" }),
             "Los dos laterales existen, son distintos y alguno (o los dos) es infinito.",
             [F(Q(n1, I("x"))), ": por la izquierda −∞, por la derecha +∞"],
             "No"],

            [el("b", { text: "No evitable, 2ª especie" }),
             "Alguno de los dos laterales no existe: la función oscila o no se puede acotar.",
             [F(sen(Q(n1, I("x")))), ": el lateral no existe"],
             "No"]
          ]),

          CALLOUT("El atajo para clasificar: mira primero si ", { b: "el límite existe" },
            ". Si existe, la discontinuidad es evitable. Si no existe, pregunta si los dos laterales existen; si existen, es de primera especie (salto), y si alguno falla, es de segunda especie.", "warn"),

          H3("Evitable, con detalle"),
          P("Hay dos variantes. Si f no está definida en a pero el límite existe, basta con extender la función: ",
            { b: "(x² − 1)/(x − 1)" },
            " en x = 1 tiene límite 2, y al definirla con f(1) = 2 se convierte en la función x + 1, ya continua. Si f sí está definida pero con otro valor, se redefine igualmente: f(x) = x con f(0) = 3 tiene límite 0, distinto de f(0), y al poner f(0) = 0 queda continua."),

          H3("Salto finito, con detalle"),
          P("La función que vale x en [0, 1) y x − 2 en [1, 3] se dibuja como dos rectas paralelas con un escalón de altura 2 en x = 1. El límite por la izquierda vale 1 y por la derecha vale −1: ambos son finitos, luego es un salto de primera especie. La altura del salto se mide como la diferencia entre los dos laterales, aquí 2."),

          H3("Salto infinito y segunda especie, con detalle"),
          P("En 1/x, al acercarse a 0 por la izquierda el valor se va a −∞ y por la derecha a +∞: los dos laterales existen (son infinitos) pero son distintos, luego es un salto infinito. En sen(1/x), en cambio, el lateral no existe en absoluto, porque la función no deja de oscilar entre −1 y 1: eso es una discontinuidad de segunda especie, la más grave, porque la gráfica no se puede ni dibujar de forma continua."),

          (function () {
            var d = DETALLES("Cómo se estudian en un examen");
            d.appendChild(OL(
              "¿Está definida f en el punto? Si no lo está, la discontinuidad es evitable siempre que el límite exista.",
              "Calcula los dos laterales por separado. No los calcules juntos: si aplicas operaciones a un lado, el otro puede dar algo distinto.",
              "Si los dos laterales coinciden, compara ese valor con f(a): si no coinciden, sigue siendo evitable.",
              "Si difieren, compara: finitos y distintos → salto finito; alguno infinito → salto infinito; alguno inexistente → segunda especie.",
              "Acaba siempre con la gráfica: el tipo de discontinuidad se ve en la forma de la curva junto al punto."
            ));
            return d;
          })()
        ];
      }
    },

/* ---------------------------------------------------------------
     * 16. Teorema del compresión
     * ------------------------------------------------------------- */
    {
      id: "compresion",
      titulo: "Teorema de la compresión",
      l1: true,
      build: function () {
        var xSen1x = A(I("x"), O("·"), A(sen(I("x")), O("/"), I("x")));
        var xSenM1x = A(I("x"), O("·"), sen(A(n1, O("/"), I("x"))));

        return [
          LEAD("Hay límites que no se pueden calcular: no hay factor que cancelar, ni grados que comparar, ni potencia que comparar. Se resuelven ", { b: "encerrando" },
            " la función entre otras dos que sí se sabe a dónde van. Para eso está el teorema de la compresión."),

          H3("La idea, sin símbolos"),
          P("Imagina que la función f está siempre entre dos curvas, la de abajo y la de arriba. Si las dos curvas se juntan en un mismo punto, f tiene que acabar ahí también: está ", { b: "atrapada" }, ". Por eso el único límite notable que hay que saber de memoria no es el del seno, sino la desigualdad que lo demuestra."),

          H3("El enunciado"),
          P("Si para el x que se está estudiar se cumple que g(x) ≤ f(x) ≤ h(x), y además los límites de g y de h en ese punto son los dos iguales a L, entonces el límite de f es L."),
          F(A(lim(XA, Gn(I("x"))), O("≤"), lim(XA, Fn(I("x"))), O("≤"), lim(XA, A(I("h"), Par(I("x")))), O("="), I("L")),
            sp("0.3em"),
            A(lim(XA, Gn(I("x"))), O("="), lim(XA, A(I("h"), Par(I("x")))), O("="), I("L"))),
          F(A(Gn(I("x")), O("≤"), Fn(I("x")), O("≤"), A(I("h"), Par(I("x")))), sp("1.2em"), EQ, I("L")),

          CALLOUT("El nombre también aparece como ", { b: "teorema del sandwich" }, ", ", { b: "teorema del aro" },
            " o ", { b: "teorema de las tijeras" }, ". Todos son el mismo teorema.", "ok"),

          H3("Las cotas que hay que saber de memoria"),
          P("La compresión funciona porque las funciones elementales son acotadas. Estas desigualdades son las que se usan siempre:"),
          TABLA(["Desigualdad", "Sale de", "Para qué sirve"], [
            [F(A(MENOS, n1), O("≤"), sen(I("x")), O("≤"), n1), "el seno oscila entre −1 y 1",
             "acotar cualquier cosa con seno dentro"],
            [F(A(MENOS, absx(), Tx(",   y con x > 0")), O("≤"), xSen1x, O("≤"), n1), "sen x < x < tg x",
             "la demostración del límite notable del seno"],
            [F(A(n0, O("≤"), A(n1, O("−"), cos(I("x"))), O("≤"), Q(S(I("x"), n2), n2))), "1 − cos x = 2·sen²(x/2)",
             "salto infinito en 1/x, y el límite notable de (1 − cos x)/x²"],
            [F(A(MENOS, Abs(I("g"), Par(I("x"))), O("≤"), Gn(I("x")), O("≤"), Abs(I("g")), Par(I("x")))),
             "cualquier cosa acotada", "atrapar productos del tipo x·tg(1/x)"]
          ]),

          H3("Ejercicio 5(d): f(x) = x·sen(1/x) para x ≠ 0, y f(0) = 0"),
          P("Es el ejemplo canónico. Por una parte no se puede sustituir (da 0·tg(1/0), que no existe) ni factorizar. Lacompression viene del valor absoluto del seno:"),
          F(A(MENOS, Abs(xSenM1x), O("≤"), absx(), O("="), n1,
            sp("0.3em"), Tx(",  y  "),
            Abs(xSenM1x), O("≤"), absx(), O("→"), n0)),
          P("La función está encerrada entre −|x| y |x|, y los dos lados van a 0. Luego el límite es 0, que coincide con f(0), y la función ", { b: "es continua en 0" }, ". En cualquier otro punto es producto de continuas, así que también es continua."),

          CALLOUT("Ésta es la respuesta corta al 5(d), y con ella seUnderstands cualquier ejercicio del estilo «demuestra que f es continua en x = 0» con seno o coseno dentro. La receta es siempre la misma: acotar, escribir la cadena de desigualdades y dejar que los dos extremos tiendan a 0."),

          H3("El mismo teorema demuestra el límite notable del seno"),
          P("De cos x ≤ sen x / x ≤ 1, tomando límites y usando que cos x → 1, se deduce que sen x / x → 1. Es la razón por la que el límite notable se puede demostrar sin saber nada más: el seno queda atrapado entre dos funciones que ya conocemos."),

          P("El mismo razonamiento da los demás cocientes notables sin trabajo extra:"),
          TABLA(["Cota", "Sale de", "Al tomar límites"], [
            [F(Q(sen(I("x")), I("x")), Tx(",   0 < x < π/2")), "sen x < x < tg x", "1 ≤ sen x/x ≤ 1/tg x → 1"],
            [F(Q(A(n1, O("−"), cos(I("x"))), S(I("x"), n2))), "0 ≤ 1 − cos x ≤ x²/2", "0 ≤ (1 − cos x)/x² ≤ 1/2"],
            [F(Q(tg(I("x")), I("x"))), "sen x/x y cos x → 1", "tg x/x = (sen x/x)/cos x → 1"],
            [F(Q(A(MENOS, Q(sen(I("x")), I("x"))), Tx(",   −π/2 < x < 0"))), "el mismo desarrollo por la izquierda",
             "también 1, porque el cociente es par"]
          ]),

          (function () {
            var d = DETALLES("Tres ejercicios del mismo tipo para entrenar la compresión");
            d.appendChild(UL(
              "lim(x → 0) x·cos(1/x²). La cota es |x·cos(1/x²)| ≤ |x| → 0. El resultado es 0 y la función se puede hacer continua con f(0) = 0.",
              "lim(x → ∞) sen(x)/x. Como |sen x| ≤ 1, se tiene −1/x ≤ sen x/x ≤ 1/x, y los dos lados van a 0. El resultado es 0, aunque la función dentro no tenga límite.",
              "lim(x → 0) tg(x)/sen(x). Aquí no hace falta compresión: basta dividir, tg x / sen x = 1/cos x → 1."
            ));
            return d;
          })()
        ];
      }
    },

    /* ---------------------------------------------------------------
     * 17. Bolzano y el teorema del valor intermedio
     * ------------------------------------------------------------- */
    {
      id: "bolzano",
      titulo: "Bolzano",
      l1: true,
      build: function () {
        /* --- Ejercicio 1: f(x) = x³ − x² + x, ∃c con f(c) = −1 --- */
        var g1 = A(S(I("x"), n3), O("−"), S(I("x"), n2), MAS, I("x"), MAS, n1);
        var e1 = EJEMPLO("L1 · 1", "Si f(x) = x³ − x² + x, demostrar que existe c tal que f(c) = −1");
        e1.appendChild(P("El enunciado no habla de un cero: habla de que la función valga −1. El truco es restar ese −1 y convertir el problema en un cero, que es lo único que Bolzano sabe resolver."));
        e1.appendChild(P({ b: "Paso 1. " }, "Se define la función auxiliar g(x) = f(x) + 1, de modo que g(c) = 0 y f(c) = −1 es lo mismo. Entonces g(x) = x³ − x² + x + 1."));
        e1.appendChild(F(g1));
        e1.appendChild(P({ b: "Paso 2. " }, "Se busca un intervalo cerrado donde g cambie de signo. El 0 y el −1 salen enseguida, porque los polinomios se evaluan sin operaciones difíciles:"));
        e1.appendChild(TABLA(["x", "g(x)", "Signo"], [
          [F(N("-1")), F(N("-2")), el("b", { text: "negativo" })],
          [F(n0), F(n1), el("b", { text: "positivo" })]
        ]));
        e1.appendChild(P({ b: "Paso 3. " }, "g es un polinomio, luego es continua en todo ℝ, y en particular en [−1, 0]. Además g(−1)·g(0) = −2 < 0. Se cumplen las tres hipótesis."));
        e1.appendChild(F(A(I("∃"), I("c"), TX("  ∈ (−1, 0)  con  g(c) = 0"),
          O(" ⟺ "), I("c"), TX("  con  f(c) = −1"), sp("0.8em"),
          O("⟹"), sp("0.5em"), I("c"), TX("  vale aproximadamente  "), N("-1.6"), Tx("…"))));
        e1.appendChild(CALLOUT("Fíjate en la redacción: el teorema no da el valor de c, sólo que existe dentro de (−1, 0). Si el ejercicio pidiera el valor exacto, con esto no bastaría y habría que recurrir a la bisección.", "warn"));

        /* --- Ejercicio 2: sen x + 2x − 1 = 0 en [0, π/2] --- */
        var g2 = A(sen(I("x")), MAS, n2, I("x"), O("−"), n1);
        var e2 = EJEMPLO("L1 · 2", "Demostrar que sen x + 2x − 1 = 0 tiene al menos una raíz en [0, π/2]");
        e2.appendChild(P("Aquí el enunciado ya habla de una raíz, así que no hay que inventar ninguna función auxiliar: se aplica Bolzano directamente a f(x) = sen x + 2x − 1."));
        e2.appendChild(F(g2));
        e2.appendChild(TABLA(["Extremo", "Cálculo", "Signo"], [
          [F(n0), "sen 0 + 0 − 1 = −1", el("b", { text: "negativo" })],
          [F(Q(I("π"), n2)), "sen(π/2) + π − 1 = 1 + π − 1 = π", el("b", { text: "positivo" })]
        ]));
        e2.appendChild(P("La función es continua en [0, π/2] porque es una suma de un seno y un polinomio. Y f(0)·f(π/2) = −π < 0. Las tres hipótesis se cumplen y queda demostrado que existe al menos una raíz. La palabra ", { b: "al menos" }, " del enunciado es la clave: Bolzano garantiza existencia, nunca unicidad.", "ok"));

        /* --- Ejercicio 3: tres raíces de x³ − 3x − 1 --- */
        var g3 = A(S(I("x"), n3), O("−"), N("3"), I("x"), O("−"), n1);
        var e3 = EJEMPLO("L1 · 3", "Demostrar que hay tres reales cuyo cubo es tres veces ese número más uno");
        e3.appendChild(P("«Su cubo es tres veces el número más uno» se escribe x³ = 3x + 1, y pasar todo al primer miembro:"));
        e3.appendChild(F(A(S(I("x"), n3), O("="), N("3"), I("x"), MAS, n1, sp("0.6em"), EQ, sp("0.6em"),
          g3, EQ, n0, sp("0.8em"), Tx("(el cero de la izquierda es el −1 que se pasa)"))));
        e3.appendChild(P("Para garantizar tres raíces distintas hay que aplicar Bolzano tres veces, en tres intervalos separados. Se busca que los signos se alternen:"));
        e3.appendChild(TABLA(["x", "g(x) = x³ − 3x − 1", "Signo"], [
          [F(N("-2")), F(N("-3")), el("b", { text: "negativo" })],
          [F(N("-1")), F(n1), el("b", { text: "positivo" })],
          [F(n0), F(N("-1")), el("b", { text: "negativo" })],
          [F(n2), F(n1), el("b", { text: "positivo" })]
        ]));
        e3.appendChild(P("Los signos se alternan en los tres tramos, así que hay una raíz en (−2, −1), otra en (−1, 0) y otra en (0, 2). Los tres intervalos son disjuntos, luego las tres raíces son distintas. Eso es todo lo que pedía el enunciado."));
        e3.appendChild(CALLOUT("Fíjate en el truco de la tabla: con un polinomio cúbico basta probar en valores redondos. Si el polinomio cambia de signo en cuatro puntos consecutivos, tiene tres raíces por la fuerza, sin dibujar nada."));

        var bisec = EJEMPLO("Extra", "Bisección: cómo se localiza la raíz cuando la piden aproximada");
        bisec.appendChild(P("Bolzano no dice dónde está la raíz, sólo que existe. Si el ejercicio pide un valor aproximado se usa la ", { b: "bisección" },
          ", que consiste en aplicar Bolzano con intervalos cada vez más pequeños."));
        bisec.appendChild(TABLA(["Paso", "Punto medio", "Signo de g", "Intervalo nuevo"], [
          [F(n1), F(N("1")), "−3", "[1, 2]"],
          [F(n2), F(N("1.5")), "−2,125", "[1.5, 2]"],
          [F(n3), F(N("1.75")), "−0,89", "[1.75, 2]"],
          [F(n4), F(N("1.875")), "−0,03", "[1.875, 2]"],
          [F(n4 + Q(1, n2)), F(N("1.9375")), "0,46", "[1.875, 1.9375]"]
        ]));
        bisec.appendChild(P("Cada paso parte el intervalo a la mitad y se queda con el lado donde sigue habiendo cambio de signo. La raíz real está entre 1.875 y 1.9375, y si se sigue diez pasos más se obtiene c ≈ 1.8794."));

        return [
          LEAD({ b: "Bolzano" },
            " es el teorema que permite ", { b: "demostrar que algo existe" },
            " sin llegar a calcularlo. Es el resultado que resuelve los tres primeros ejercicios de la lista, y el único de la hoja que se pregunta en su forma pura: no pide un límite, pide una prueba."),

          /* --- 1. La idea --- */
          H3("1. La idea, sin símbolos"),
          P("Imagina una gráfica que se dibuja sin levantar el bolígrafo. Si en un extremo está a −4 y en el otro está a +9, la curva no puede pasar de un valor al otro sin recorrer todos los intermedios: tiene que pasar por 0, por 1, por −2 y por todo lo demás. Eso es todo Bolzano: una función continua no tiene saltos, y por tanto no puede saltarse ningún número."),

          /* --- 2. Enunciado --- */
          H3("2. El enunciado, en dos versiones"),
          P({ b: "Versión con cambio de signo. " },
            "Si f es continua en el intervalo cerrado [a, b] y f(a)·f(b) < 0, entonces existe al menos un punto c del intervalo abierto (a, b) tal que f(c) = 0."),
          F(A(lim(XA, Fn(I("x"))), O("≠"), I("L"), sp("0.3em"), Tx("(esa es otra forma de decirlo)")),
            sp("1em"),
            A(I("f"), TX(" continua en [a, b]"), sp("0.3em"), O("∧"), sp("0.3em"),
              A(Fn(I("a")), O("·"), Fn(I("b")), O("<"), n0),
              sp("0.6em"), O("⟹"), sp("0.6em"),
              I("∃"), I("c"), O("∈"), A(O("("), I("a"), O(","), I("b"), O(")"))),
              sp("0.3em"), O(":"), sp("0.3em"), Fn(I("c")), EQ, n0),
          P({ b: "Versión general (teorema del valor intermedio). " },
            "Si f es continua en [a, b], para cualquier número k comprendido entre f(a) y f(b) existe un c ∈ (a, b) con f(c) = k. La versión anterior es el caso k = 0."),
          F(A(I("k"), TX(" entre "), Fn(I("a")), TX(" y "), Fn(I("b")),
            sp("0.6em"), O("⟹"), sp("0.6em"),
            I("∃"), I("c"), TX(" con  "), Fn(I("c")), EQ, I("k"))),

          /* --- 3. Las hipótesis --- */
          H3("3. Las tres hipótesis, una a una"),
          P("Bolzano tiene tres condiciones. Si falla ", { b: "una sola" }, ", el teorema ya no dice nada, y el resultado suele ser falso. Esto es lo que más se olvida:"),
          TABLA(["Hipótesis", "Qué exige", "Por qué importa"], [
            [{ b: "1. Intervalo cerrado [a, b]" },
             "que los dos extremos estén incluidos, para poder mirar f(a) y f(b)",
             "el teorema habla del valor de la función en los extremos del intervalo"],
            [{ b: "2. f continua en [a, b]" },
             "que se cumplan las tres condiciones de continuidad en todos y cada uno de los puntos de [a, b]",
             "una función con un salto puede saltarse valores de golpe"],
            [{ b: "3. f(a)·f(b) < 0" },
             "que los dos extremos estén a lados opuestos del cero",
             "si los dos tienen el mismo signo, el intervalo elegido no vale"]
          ]),
          P("La segunda hipótesis es la que más se ignora, y la que se cumple con más trabajo. Para comprobar que f es continua en un intervalo hay que verificar las tres condiciones de continuidad en ", { b: "cada punto" },
            " del intervalo; en la práctica, si f es una expresión hecha de polinomios, racionales, exponenciales, logaritmos y trigonométricas, basta con que no haya denominadores, radicandos ni logaritmos problemáticos dentro."),

          P({ b: "Un contraejemplo para verlo. " },
            "La función h(x) = x si x < 0, y h(x) = x + 1 si x ≥ 0, cumple h(−1) = −1 y h(1) = 3, luego h(−1)·h(1) = −3 < 0. Y sin embargo h nunca vale 0: por la izquierda es negativa y por la derecha es mayor o igual que 1. Bolzano no dice nada porque h ", { b: "no es continua en 0" }, ", tiene un salto de altura 1. El fallo es la hipótesis 2."),

          /* --- 4. Receta --- */
          H3("4. La receta para aplicar el teorema"),
          OL(
            [{ b: "Pasa todo a un lado. " },
             "Si el enunciado dice «existe c tal que f(c) = K», define g(x) = f(x) − K. A partir de aquí, g(c) = 0 y el problema es el de siempre."],
            [{ b: "Elige el intervalo. " },
             "Busca valores donde sepas evaluar sin esfuerzo: 0, ±1, 2, π/2, π, −2… La pista es que en estos ejercicios los números siempre salen enteros."],
            [{ b: "Calcula los dos extremos y mira los signos. " },
             "Si son distintos, ya está. Si son iguales, ese intervalo no vale: cambia de intervalo."],
            [{ b: "Escribe la conclusión con las tres hipótesis. " },
             "Un examen no puntúa el resultado si no se dice «f es continua en [a, b] porque…»."]
          ),

          CALLOUT({ b: "Lo que Bolzano NO demuestra. " },
            "No dice dónde está la raíz, ni dice cuántas hay, ni dice si es única. Sólo que existe al menos una dentro del intervalo. Para el valor aproximado está la bisección, y para contar raíces hacen falta las derivadas o el gráfico."),

          /* --- 5. Ejemplos --- */
          H3("5. Los tres ejercicios de la lista, resueltos"),
          e1, e2, e3,
          bisec,

          /* --- 6. Errores --- */
          H3("6. Los cinco errores que más se repiten"),
          (function () {
            var d = el("div", { class: "cols cols--2" });
            var ul1 = el("ul", null, [
              el("li", null, [el("b", { text: "Usar 1/(x − a) sin tener un denominador. " }),
                "Lo que vale es f(a)·f(b) < 0, y sólo garantiza un cero de f, no de 1/f."]),
              el("li", null, [el("b", { text: "Olvidar la continuidad. " }),
                "Es la hipótesis que más cuesta y la que más se salta. Si sólo compruebas el cambio de signos, el ejercicio está incomplete."]),
              el("li", null, [el("b", { text: "Confundir «existe» con «vale». " }),
                "Bolzano da existencia. Pedir el valor de c exige otro método (bisección) y con decimales, nunca exacto."])
            ]);
            var ul2 = el("ul", null, [
              el("li", null, [el("b", { text: "Elegir un intervalo abierto. " }),
                "Tiene que ser cerrado [a, b]. En un intervalo abierto no hay f(a) ni f(b) que comparar."]),
              el("li", null, [el("b", { text: "Redactar sin hipótesis. " }),
                "«Cambia de signo, luego existe la raíz» no es una demostración: hay que nombrar las tres condiciones."]),
              el("li", null, [el("b", { text: "Aplicarlo a un límite. " }),
                "Bolzano habla de valores de la función, no de límites. Son cosas distintas y mezclarlas cuesta puntos."])
            ]);
            d.appendChild(ul1); d.appendChild(ul2);
            return d;
          })(),

          /* --- 7. Práctica --- */
          (function () {
            var d = DETALLES("Cinco ejercicios para practicar, con la solución desplegable");
            d.appendChild(P("Mismo formato que los de la lista: «demostrad que existe c en el intervalo tal que…». Todos se resuelven con los tres pasos de la receta."));

            function ej(id, enunciado, x1, g1v, s1, x2, g2v, s2, extra) {
              var e = EJEMPLO(id, enunciado);
              var d2 = el("div");
              d2.appendChild(P("Solución: se define g(x) = f(x) − 0 = f(x), que es continua en todo ℝ. En "));
              d2.appendChild(TABLA(["Extremo", "Valor", "Signo"], [
                [F(x1), F(g1v), el("b", { text: s1 })],
                [F(x2), F(g2v), el("b", { text: s2 })]
              ]));
              d2.appendChild(P(extra));
              e.appendChild(d2);
              return e;
            }

            d.appendChild(ej("a", "Demostrad que x³ + x − 1 = 0 tiene alguna raíz en (0, 1)",
              n0, N("-1"), "negativo", n1, n1, "positivo",
              "El producto vale −1 < 0 y f es un polinomio, luego es continua. Existe c ∈ (0, 1) tal que f(c) = 0."));
            d.appendChild(ej("b", "Demostrad que existe c ∈ (1, 2) tal que ln c = 2 − c",
              n1, N("-1"), "negativo", n2, A(lnx(n2), O("−"), n2, O("+"), n2),
              "positivo",
              "La función es continua porque el logaritmo está definido en todo [1, 2]. Existe el c. La ecuación tiene además una solución exacta evidente: c = 1 + e ≈ 3,718, que está fuera del intervalo, así que en (1, 2) la raíz es la otra."));
            d.appendChild(ej("c", "Demostrad que e^x = x + 2 tiene alguna solución",
              n0, N("-1"), "negativo", n2, A(S(miE(), n2), O("−"), N("4")),
              "positivo",
              "El exponencial y el polinomio son continuas en todo ℝ. Existe c ∈ (0, 2)."));
            d.appendChild(ej("d", "Demostrad que tg x = x + 1 tiene alguna solución",
              n1, A(tg(n1), O("−"), n1, O("−"), n1), "negativo",
              A(Q(n3, n2), Tx("⁻")), INFP, "positivo",
              "Aquí hay que tener cuidado con la continuidad: tg x no es continua en todo [1, 3], sólo en (−π/2, π/2). Por eso el segundo extremo se toma justo antes de la asíntota, tg x → +∞, y el resultado sigue siendo positivo."));
            d.appendChild(ej("e", "Demostrad que x³ − x − 1 = 0 tiene una raíz en (1, 2)",
              n1, N("-1"), "negativo", n2, N("5"), "positivo",
              "Igual que el anterior. Si además se pide cuántas raíces tiene, con este teorema no se puede demostrar: hay que.draw el gráfico o usar las derivadas."));

            d.appendChild(CALLOUT("Si los cinco te salen, la parte de existencia de la lista está dominada. El último apunte es importante: ", { b: "existencia y número de raíces son dos preguntas distintas" },
              ", y el único teorema de la hoja que responde a la segunda es Darboux combinado con el estudio de la monotonía.", "ok"));
            return d;
          })()
        ];
      }
    },

    /* ---------------------------------------------------------------
     * 18. Recta tangente y derivada
     * ------------------------------------------------------------- */
    {
      id: "tangentes",
      titulo: "Recta tangente",
      l1: true,
      build: function () {
        var f11 = Q(I("x"), A(S(I("x"), n2), MAS, n1));
        var d11 = Q(A(A(S(I("x"), n2), MAS, n1), O("−"), A(n2, S(I("x"), n2))), S(A(S(I("x"), n2), MAS, n1), n2));
        var f12 = A(N("3"), S(I("x"), n2), O("−"), n2, I("x"), MAS, n1);
        var d12 = A(N("6"), I("x"), O("−"), n2);

        var e11 = EJEMPLO("L1 · 11", "f(x) = x/(x² + 1). Escribir la recta tangent en el punto de abscisa x = 2");
        e11.appendChild(F(f11));
        e11.appendChild(P({ b: "Paso 1: el punto de tangencia. " }, "La abscisa es 2, así que el punto es (2, f(2)) = (2, 2/5)."));
        e11.appendChild(P({ b: "Paso 2: la derivada, que es la pendiente. " }, "Se deriva con la regla del cociente, tratando x² + 1 como un bloque:"));
        e11.appendChild(F(d11));
        e11.appendChild(P({ b: "Paso 3: la pendiente en el punto. " }, "f′(2) = (4 + 1 − 2·4) / (4 + 1)² = (5 − 8)/25 = −3/25."));
        e11.appendChild(P({ b: "Paso 4: la ecuación de la recta. " }, "Se escribe y − f(2) = f′(2)·(x − 2) y se despeja la y:"));
        e11.appendChild(F(A(I("y"), O("−"), Q(n2, n5), EQ, S(MENOS, Q(n3, n25), Par(A(I("x"), O("−"), n2))),
          sp("1.2em"), EQ, A(Q(MENOS, n3, n5), I("x"), MAS, Q(N("16"), n25)), sp("1.2em"),
          EQ, Q(MENOS, N("3"), n25), I("x"), O("+"), Q(N("16"), n25))));
        e11.appendChild(CALLOUT("Comprueba siempre el resultado volviendo a meter x = 2: tiene que dar 2/5. Si no da, se ha equivocado el signo de la pendiente o el punto de tangencia.", "ok"));

        var e12 = EJEMPLO("L1 · 12", "Puntos de f(x) = 3x² − 2x + 1 cuya tangente pasa por (2, 6)");
        e12.appendChild(F(f12));
        e12.appendChild(P({ b: "Paso 1: fórmula general. " }, "La tangente en el punto de abscisa a es y = f(a) + f′(a)·(x − a). Si tiene que pasar por (2, 6), se mete x = 2 e y = 6 y se despeja a:"));
        e12.appendChild(P({ b: "Paso 2: las dos funciones. " }, "f(a) = 3a² − 2a + 1 y f′(a) = 6a − 2."));
        e12.appendChild(P({ b: "Paso 3: la condición. " }, "Que la tangente pase por (2, 6) significa f(a) + f′(a)·(2 − a) = 6. Se sustituye y se opera:"));
        e12.appendChild(F(A(N("6"), EQ,
          A(N("3"), S(I("a"), n2), O("−"), n2, I("a"), MAS, n1),
            O("+"),
          A(A(N("6"), I("a"), O("−"), n2), Par(A(n2, O("−"), I("a")))),
            sp("0.3em"), Tx("="), sp("0.3em"),
            A(O("−"), N("3"), S(I("a"), n2), MAS, N("12"), I("a"), O("−"), N("9"), O("="), n0))));
        e12.appendChild(P({ b: "Paso 4: la ecuación y sus dos soluciones. " }, "La última igualdad es −3a² + 12a − 9 = 0, es decir a² − 4a + 3 = 0, que se factoriza como (a − 1)(a − 3) = 0. Hay dos puntos, no uno:"));
        e12.appendChild(TABLA(["Abscisa", "Punto de la curva", "Recta tangente", "¿Pasa por (2, 6)?"], [
          [F(n1), F(A(n1, O(","), n2)), F(A(I("y"), EQ, A(N("4"), I("x"), O("−"), n2))), el("b", { text: "4·2 − 2 = 6 ✔" })],
          [F(n3), F(A(n3, O(","), N("22"))), F(A(I("y"), EQ, A(N("16"), I("x"), O("−"), N("26")))), el("b", { text: "16·2 − 26 = 6 ✔" })]
        ]));
        e12.appendChild(CALLOUT("El enunciado avisa de que (2, 6) es exterior a la curva, y por eso hay dos tangentes y no una. Desde un punto interior sólo habría una. Eso se ve en el discriminante: para una parábola, D > 0 da dos tangentes, D = 0 una y D < 0 ninguna."));

        return [
          LEAD("Los dos últimos ejercicios de la lista ", { b: "no son de límites" },
            ", sino de rectas tangentes. Pero la derivada ", { b: "es un límite" },
            ", así que no hace falta nada nuevo: se resuelve con las mismas herramientas y una tabla de derivadas."),

          H3("La derivada ES un límite"),
          P("La derivada de f en el punto a es el límite de la recta secante cuando el segundo punto se acerca al primero:"),
          F(A(B(I("f"), O("′")), Par(I("a")), EQ,
            lim(A(I("h"), TO, n0), Q(A(Fn(A(I("a"), MAS, I("h"))), O("−"), Fn(I("a"))), I("h"))),
            sp("0.8em"), Tx("o, equivalentemente"), sp("0.8em"),
            lim(A(I("x"), TO, I("a")), Q(A(Fn(I("x")), O("−"), Fn(I("a"))), A(I("x"), O("−"), I("a")))))),
          P("Es decir: la derivada es un límite Notable de tipo 0/0, que se resuelve cancelando el factor h — o el factor x − a — como en cualquier otro. Todo el tema que hay en esta hoja es el toolkit que hace falta para derivar."),

          H3("La tabla de derivadas que se usa en 2º de Bachillerato"),
          COLS(
            TABLA(["Función", "Derivada"], [
              [F(I("k")), F(n0)],
              [F(S(I("x"), I("n"))), F(A(I("n"), S(I("x"), A(S(I("n"), MAS, N("-1"))))))],
              [F(Q(n1, I("x"))), F(Q(MENOS, n1, S(I("x"), n2)))],
              [F(rdx(I("x"))), F(Q(n1, A(n2, rdx(I("x")))))],
              [F(S(miE(), I("x"))), F(S(miE(), I("x")))],
              [F(S(I("a"), I("x"))), F(A(lnx(I("a")), O("·"), S(I("a"), I("x"))))],
              [F(lnx(I("x"))), F(Q(n1, I("x")))]
            ]),
            TABLA(["Función", "Derivada"], [
              [F(sen(I("x"))), F(cos(I("x")))],
              [F(cos(I("x"))), F(A(MENOS, sen(I("x"))))],
              [F(tg(I("x"))), F(Q(n2, S(A(n1, MAS, S(tg(I("x")), n2)))))],
              [F(absx()), [F(A(MENOS, n1, Tx(", si x < 0"))), F(n1, Tx("  ·  ")), F(A(n1, Tx(", si x ≥ 0")))]],
              [F(S(I("x"), I("n"))), "—"],
              [F(A(I("f"), O("+"), I("g"))), F(A(I("f"), O("′"), O("+"), I("g"), O("′")))],
              [F(A(I("f"), O("·"), I("g"))), F(A(I("f"), O("′"), I("g"), O("+"), I("f"), I("g"), O("′")))]
            ])
          ),
          P({ b: "Las tres reglas que hay que saberse de memoria: " },
            "producto: (f·g)′ = f′·g + f·g′. Cociente: (f/g)′ = (f′·g − f·g′)/g². Cadena: si k = g(f(x)), entonces k′ = g′(f(x))·f′(x). Con la de la suma no hay misterio: (f ± g)′ = f′ ± g′."),

          H3("La ecuación de la recta tangente"),
          P("Es la única fórmula que hay que memorizar de este apartado:"),
          F(A(I("y"), O("−"), Fn(I("a")), EQ, B(I("f"), O("′")), Par(I("a")), O("·"), Par(A(I("x"), O("−"), I("a"))))),
          P("Se lee así: en el punto de abscisa a, la función vale f(a) y la pendiente es f′(a). Si el enunciado da un punto (x₀, y₀) en vez de una abscisa, entonces a = x₀ y f(a) = y₀."),

          H3("Los dos ejercicios, resueltos"),
          e11, e12,

          (function () {
            var d = DETALLES("Dos apuntes que salen de estos ejercicios");
            d.appendChild(UL(
              ["Una parábola y un punto exterior admiten exactamente dos tangentes, uno interior, y ninguna si el punto está en el «hueco». Para una parábola y = ax² + bx + c el discriminante de la ecuación que sale es lo que decide entre los tres casos."],
              ["De aquí sale, por cierto, un resultado de continuidad: si f es derivable en todo un intervalo, su derivada no puede dar saltos (teorema de Darboux). Por eso la derivada de una función derivable en todas partes es continua en todas partes, algo que no ocurre con la función original."]
            ));
            return d;
          })()
        ];
      }
    },

    /* ---------------------------------------------------------------
     * 13. Teoremas de las funciones continuas
     * ------------------------------------------------------------- */
    {
      id: "teoremas",
      titulo: "Teoremas de las funciones continuas",
      build: function () {
        return [
          P("La continuidad no es sólo una propiedad bonita: garantiza que ciertas cosas existen. Estos son los teoremas que se demuestran usándola."),

          UL(
            [{ b: "Conservación del signo. " },
             "Si f es continua en a y f(a) > 0, hay un entorno de a donde f(x) > 0. Al revés: una función continua no puede cambiar de signo sin pasar por 0."],
            [{ b: "Acotación. " },
             "Si f es continua en un intervalo cerrado y acotado [a, b], entonces está acotada: existen M y m tales que m ≤ f(x) ≤ M en todo el intervalo."],
            [{ b: "Bolzano (teorema del valor intermedio). " },
             "Si f es continua en [a, b] y f(a) · f(b) < 0, existe un punto c del intervalo abierto (a, b) con f(c) = 0. Más en general: entre f(a) y f(b) está garantizado cualquier valor intermedio."],
            [{ b: "Weierstrass (de extremos). " },
             "Si f es continua en un intervalo cerrado y acotado [a, b], alcanza un máximo y un mínimo: hay puntos concretos donde se dan."],
            [{ b: "Darboux (de la derivada). " },
             "Si f es derivable en un intervalo, su derivada f′ no puede dar saltos: toma todos los valores intermedios entre f′(a) y f′(b). Es la versión de Bolzano para las derivadas."]
          ),

          CALLOUT("Bolzano y Weierstrass comparten hipótesis: ", { b: "intervalo cerrado y acotado" },
            ". Si el intervalo fuera abierto, el resultado fallaría: f(x) = x en (0, 1) es continua en todo él, pero no está acotada arriba y no alcanza máximo.", "warn"),

          H3("Aplicación directa: la existencia de un cero"),
          P("Bolzano es la herramienta para ", { b: "resolver enunciados del tipo «demuestra que la ecuación tiene alguna solución»" },
            ". Se busca un intervalo [a, b] donde f cambie de signo y se aplica el teorema. Ejemplo clásico: el seno tiene un cero entre 0 y π porque sen 0 = 0 y sen π = 0, y tiene ceros estrictos entre π/2 y π (donde pasa de 1 a 0) y entre 3π/2 y 2π (donde pasa de −1 a 0)."),

          (function () {
            var d = DETALLES("Por qué estos teoremas son útiles en el tema de límites");
            d.appendChild(P(
              "Porque dan criterios de existencia sin calcular nada. Si te piden si un límite lateral existe, rara vez hace falta el teorema; pero si te piden si una función tiene un máximo en un intervalo, o si una ecuación tiene solución, la respuesta es que sí, por Weierstrass y por Bolzano, siempre que se comprueben las hipótesis de continuidad y de intervalo cerrado y acotado."));
            return d;
          })()
        ];
      }
    }
  ];

  /* =====================================================================
   * 4. Índice, scroll suave y modo móvil
   * ===================================================================== */

  function reducirMovimiento() {
    try {
      return !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) { return false; }
  }

  /** Dos dígitos, para que los títulos queden alineados en el índice. */
  function dosDigitos(n) { return n < 10 ? "0" + n : String(n); }

  function construirTeoria(main) {
    var wrap = el("div");

    wrap.appendChild(el("div", { class: "screen-head" }, [
      el("h1", { class: "screen-title", text: "Teoría" }),
      el("p", {
        class: "screen-sub",
        text: "Chuleta completa de límites y continuidad para 2º de Bachillerato. Las secciones marcadas con L1 son las que hacen falta para la lista de ejercicios."
      })
    ]));

    var layout = el("div", { class: "theory" });

    /* --- índice lateral --- */
    var toc = el("nav", { class: "toc", "aria-label": "Índice de la teoría" });
    var titulo = el("div", { class: "toc-title", text: "Índice" });
    var lista = el("div", { class: "toc-list" });
    toc.appendChild(titulo);

    /* --- selector, que sustituye al índice en móvil --- */
    var sel = el("select", { class: "field", "aria-label": "Ir a la sección" });
    sel.appendChild(el("option", { value: "", text: "Ir a la sección…" }));
    SECCIONES.forEach(function (s, i) {
      sel.appendChild(el("option", {
        value: s.id,
        text: dosDigitos(i + 1) + ". " + s.titulo + (s.l1 ? "  ·  L1" : "")
      }));
    });

    var enlaces = {};
    var nodos = [];

    function irA(id) {
      var t = document.getElementById(id);
      if (!t) return;
      t.scrollIntoView({ behavior: reducirMovimiento() ? "auto" : "smooth", block: "start" });
    }

    SECCIONES.forEach(function (s, i) {
      var a = el("a", { href: "#" + s.id, onclick: function (ev) { ev.preventDefault(); irA(s.id); } }, [
        el("span", { class: "toc-n", text: dosDigitos(i + 1) }),
        el("span", { class: "toc-t", text: s.titulo }),
        s.l1 ? el("span", { class: "toc-tag", text: "L1" }) : null
      ]);
      enlaces[s.id] = a;
      lista.appendChild(a);
    });

    sel.addEventListener("change", function () {
      if (sel.value) irA(sel.value);
    });

    /* --- cuerpo --- */
    var body = el("div", { class: "theory-body" });

    SECCIONES.forEach(function (s, i) {
      var sec = el("section", { class: "theory-sec", id: s.id });
      sec.appendChild(el("h2", null, [
        el("span", { class: "mono", style: "color:var(--accent)", text: dosDigitos(i + 1) }),
        el("span", { text: s.titulo }),
        s.l1 ? el("span", { class: "badge-l1", text: "Llista 1" }) : null
      ]));
      append(sec, s.build());
      body.appendChild(sec);
      nodos.push(sec);
    });

    body.appendChild(el("div", { class: "theory-end" }, [
      el("a", { class: "btn btn-ghost", href: "#" + SECCIONES[0].id, text: "↑ Volver a la chuleta" })
    ]));

    toc.appendChild(lista);
    toc.appendChild(sel);
    var pie = el("div", { class: "toc-foot" }, [
      el("span", { class: "toc-tag", text: "L1" }),
      " marca las secciones que hacen falta para los ejercicios de la lista."
    ]);
    toc.appendChild(pie);

    layout.appendChild(toc);
    layout.appendChild(body);
    wrap.appendChild(layout);
    main.appendChild(wrap);

    /* --- marcar la sección activa (scroll spy) --- */
    var activo = null;
    function marcar(id) {
      if (activo === id) return;
      if (activo && enlaces[activo]) enlaces[activo].classList.remove("on");
      activo = id;
      if (id && enlaces[id]) enlaces[id].classList.add("on");
      if (id && sel.value !== id) sel.value = id;
    }

    function espiar() {
      var actual = null;
      for (var i = 0; i < nodos.length; i++) {
        if (nodos[i].getBoundingClientRect().top - 96 <= 0) actual = nodos[i].id;
      }
      if (global.scrollY + global.innerHeight >= document.body.scrollHeight - 4) {
        actual = SECCIONES[SECCIONES.length - 1].id;
      }
      marcar(actual);
    }

    var pendiente = false;
    function alDesplazar() {
      if (pendiente) return;
      pendiente = true;
      global.requestAnimationFrame(function () { pendiente = false; espiar(); });
    }

    /* --- barra lateral en escritorio, selector en móvil --- */
    function modoLayout() {
      var ancho = !!(global.matchMedia && global.matchMedia("(min-width: 900px)").matches);
      lista.style.display = ancho ? "" : "none";
      sel.style.display = ancho ? "none" : "";
      pie.style.display = ancho ? "" : "none";
      titulo.textContent = ancho ? "Índice" : "Ir a…";
    }

    global.addEventListener("scroll", alDesplazar, { passive: true });
    global.addEventListener("resize", function () { modoLayout(); alDesplazar(); });
    global.addEventListener("load", espiar);

    modoLayout();
    espiar();

    return main;
  }

  /* La página la arranca el <script> en línea de teoria.html */
  global.construirTeoria = construirTeoria;

})(window);