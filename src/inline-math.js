/* =====================================================================
 * inline-math.js — Matemática en línea dentro del texto plano (x^2 → ²)
 * ---------------------------------------------------------------------
 * El motor y la hoja de teoría escriben la matemática como texto plano con
 * notación tipo LaTeX:
 *
 *     "Al dividir entre x^3 queda (x^3 − 1)/(x^2 − 4) …"
 *     "1^∞ y 0^0 necesitan cambio de base"
 *
 * Eso se pinta con textContent, así que el alumno lee el circunflejo. Aquí se
 * convierte esa notación diminuta en MathML NATIVO (<msup>, <msub>), que es
 * justo lo que app.js ya construye a mano para el enunciado y la solución.
 *
 * Ni KaTeX ni nada: cero dependencias, cero import/export. Es un IIFE que se
 * pega en un <script> y usa el MISMO patrón de raíz que app.js
 * (typeof window !== "undefined" ? window : globalThis) para poder cargarse
 * también desde Node.
 *
 * API (CONGELADA — ver docs/INLINE_MATH.md §2):
 *     InlineMath.nodes(text, opts) -> DocumentFragment
 *     InlineMath.text(text)        -> string
 *     InlineMath.has(text)         -> boolean
 *     InlineMath.TOKEN_RE          -> RegExp
 *
 * Garantías (contrato §4):
 *   · NUNCA innerHTML: todo el texto entra por document.createTextNode, que
 *     escapa solo. Un "<img onerror=…>" sale como texto, no como elemento.
 *   · El MathML sale SIEMPRE de document.createElementNS(NS_MATH, …), nunca
 *     de createElement: fuera del namespace MathML el navegador no lo pinta.
 *   · nodes() y text() NUNCA lanzan: con null, undefined, 42, {}, {} o un
 *     objeto con toString() envenenado devuelven el texto coaccionado a
 *     String(), nunca una excepción.
 * ===================================================================== */

(function (global) {
  "use strict";

  var NS_MATH = "http://www.w3.org/1998/Math/MathML";

  /* =====================================================================
   * §1  LA GRAMÁTICA, EN UN SOLO SITIO
   * ---------------------------------------------------------------------
   * TOKEN_RE es la especificación EJECUTABLE de lo que el contrato llama «un
   * exponente». Se reconoce un token sólo si se cumplen LAS TRES cosas:
   *
   *   · m[1] base   : una letra, un dígito o el cierre de un grupo ( ) ] — nunca
   *                   un espacio ni un signo (por eso no incluye el espacio).
   *   · m[2] op     : '^' o '_' PEGADO a la base, sin espacio en medio.
   *   · exponente   : m[3] interior de un grupo (…{1,8}…) sin otro '(' dentro,
   *                   o m[4] un dígito suelto o una letra minúscula suelta.
   *
   * Todo lo demás — '^' suelto, '^∞', '^)', '^^', 'a ^2' — no matchea y se
   * queda como texto tal cual. Escribir un LaTeX completo aquí sería una
   * invitación a bugs: el objetivo es que no quede ningún '^2' feo en pantalla,
   * no interpretar todo.
   *
   * Se exporta SIN banderas a propósito: con 'g' el lastIndex es compartido y
   * un test que llame a .exec()获 se rompería según el orden de ejecución. El
   * scanner de §4 usa una copia CON 'g' anclada en el índice actual, que es
   * exactamente el comportamiento de la bandera 'y' pero con este mismo regex.
   * ===================================================================== */
  var TOKEN_RE = /([A-Za-z0-9)\]])(\^|_)(?:([^()]{1,8})\)|([0-9a-z]))/;
  var SCAN_RE = new RegExp(TOKEN_RE.source, "g");

  /* =====================================================================
   * §2  SUPER/SUBÍNDICES UNICODE (para text(): atributos, aria-label, …)
   * ---------------------------------------------------------------------
   * Unicode NO tiene glifo de superíndice para 'q' (ni de subíndice para
   * 'b', 'd', 'f', 'g', 'q', 'y', 'z'…). Cuando falta uno se deja el token
   * ENTERO tal cual: es preferible un '^' feo a inventarse un glyph. Por eso
   * text("1^∞") === "1^∞" y no "1ⁱ".
   * ===================================================================== */
  var SUPER = {
    "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
    "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
    "a": "ᵃ", "b": "ᵇ", "c": "ᶜ", "d": "ᵈ", "e": "ᵉ",
    "f": "ᶠ", "g": "ᵍ", "h": "ʰ", "i": "ⁱ", "j": "ʲ",
    "k": "ᵏ", "l": "ˡ", "m": "ᵐ", "n": "ⁿ", "o": "ᵒ",
    "p": "ᵖ", "r": "ʳ", "s": "ˢ", "t": "ᵗ", "u": "ᵘ",
    "v": "ᵛ", "w": "ʷ", "x": "ˣ", "y": "ʸ", "z": "ᶻ"
    /* falta 'q': sin glifo */
  };

  var SUBINDICE = {
    "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
    "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
    "a": "ₐ", "e": "ₑ", "h": "ₕ", "i": "ᵢ", "j": "ⱼ",
    "k": "ₖ", "l": "ₗ", "m": "ₘ", "n": "ₙ", "o": "ₒ",
    "p": "ₚ", "r": "ᵣ", "s": "ₛ", "t": "ₜ", "u": "ᵤ",
    "v": "ᵥ", "x": "ₓ"
    /* faltan 'b','c','d','f','g','q','w','y','z': sin glifo */
  };

  /* =====================================================================
   * §3  UTILIDADES INTERNAS
   * ===================================================================== */

  /* Coacción a String(), pero blindada. El contrato pide literalmente el
   * texto coaccionado a String() (null -> "null", 42 -> "42"), así que NO se
   * mapea null/undefined a "": lo que se hace es que un String() que reviente
   * (objeto con toString() que lanza, o sin Symbol.toPrimitive) no tumbe al
   * llamador, que es la garantía real de la §4 ("nunca lanza"). */
  function cadena(t) {
    if (typeof t === "string") return t;
    try { return String(t); } catch (e) { return ""; }
  }

  /* El `document` se busca en CADA llamada, no al cargar el fichero: en Node
   * no existe hasta que el test monta su mini-DOM, y aun así text()/has()
   * tienen que funcionar. Si no hay DOM completo (o no hay DOM), se avisa con
   * null y el llamador degrada con elegancia. */
  function doc() {
    var d = (typeof document !== "undefined" && document) ? document
          : ((global && global.document) ? global.document : null);
    if (!d) return null;
    if (typeof d.createElementNS !== "function") return null;
    if (typeof d.createTextNode !== "function") return null;
    if (typeof d.createDocumentFragment !== "function") return null;
    return d;
  }

  /* Fragmento hueco para el caso "no hay document" (Node sin mini-DOM). Es un
   * objeto con la FORMA de un DocumentFragment — nodeType 11 y appendChild —
   * igual que el shim que hace engine.js con los nodos MathML, para que el
   * llamador pueda appendChild sin romperse y se quede con un texto plano. */
  function fragmentoVacio() {
    return {
      nodeType: 11,
      childNodes: [],
      appendChild: function (c) { this.childNodes.push(c); return c; }
    };
  }

  /* Devuelve el token que empieza EXACTAMENTE en i, o null. Anclar con
   * lastIndex (igual que la bandera 'y') es lo que impide que un token
   * empiece más adelante y se coma texto de en medio. Tras un match,
   * SCAN_RE.lastIndex es justo el índice del final del token. */
  function tokenEn(s, i) {
    if (i >= s.length) return null;
    SCAN_RE.lastIndex = i;
    var m = SCAN_RE.exec(s);
    if (!m || m.index !== i) return null;
    return m;
  }

  /* Un carácter suelto se pinta como <mn> si es dígito, <mi> si es letra y
   * <mo> si es un operador (los cierres de grupo ')' y ']'). */
  function atomo(d, ch) {
    var tag = /[0-9]/.test(ch) ? "mn" : /[A-Za-z]/.test(ch) ? "mi" : "mo";
    var n = d.createElementNS(NS_MATH, tag);
    n.textContent = ch;
    return n;
  }

  /* El interior de un grupo —"2n+1"— se trocea en sus átomos: las cifras
   * contiguas en un <mn>, cada letra en su <mi> (un identificador por letra,
   * no un <mi> "ab" que saldría en cursiva entera) y cada operador en su
   * <mo>. Se envuelve en un <mrow> porque <msup>/<msub> sólo aceptan dos
   * hijos: la base y el exponente. */
  function expresion(d, s) {
    var mrow = d.createElementNS(NS_MATH, "mrow");
    var cifras = "";

    function cerrarCifras() {
      if (!cifras) return;
      var n = d.createElementNS(NS_MATH, "mn");
      n.textContent = cifras;
      mrow.appendChild(n);
      cifras = "";
    }

    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (/[0-9]/.test(ch)) { cifras += ch; continue; }
      cerrarCifras();
      var tag = /[A-Za-z]/.test(ch) ? "mi" : "mo";
      var n = d.createElementNS(NS_MATH, tag);
      n.textContent = ch;
      mrow.appendChild(n);
    }
    cerrarCifras();
    return mrow;
  }

  /* El token entero → <msup>/<msub>. m[3] es el interior del grupo (o
   * undefined) y m[4] el exponente suelto (o undefined). */
  function guion(d, m, display) {
    var op = m[2];
    var n = d.createElementNS(NS_MATH, op === "^" ? "msup" : "msub");
    n.appendChild(atomo(d, m[1]));                                  // la base
    n.appendChild(m[3] !== undefined ? expresion(d, m[3]) : atomo(d, m[4]));
    if (!display) return n;

    /* opts.display === true (el contrato lo declara, aunque el valor por
     * defecto es false): el guion sale dentro de su raíz <math display="block">,
     * que es lo que el navegador exige para maquetar MathML de verdad. Con
     * display:false —el valor por defecto, el de la prosa— NO se envuelve y el
     * fragmento devuelve los <msup>/<msub> sueltos, tal y como dice §2. */
    var math = d.createElementNS(NS_MATH, "math");
    math.setAttribute("display", "block");
    math.appendChild(n);
    return math;
  }

  /* Exponente → su equivalente Unicode, o null si CUALQUIER carácter del
   * grupo se queda sin glifo (caso 1^∞). Devolver null es lo que obliga a
   * dejar el token tal cual en vez de medio-superindexarlo. */
  function guionUnicode(exp, mapa) {
    var out = "";
    for (var i = 0; i < exp.length; i++) {
      var ch = exp.charAt(i);
      if (!Object.prototype.hasOwnProperty.call(mapa, ch)) return null;
      out += mapa[ch];
    }
    return out;
  }

  /* =====================================================================
   * §4  API PÚBLICA (CONGELADA)
   * ===================================================================== */

  /** Atajo barato: ¿hay algo convertible? Los puntos de render que hoy usan
   *  textContent lo llaman antes de tocar nada, y así quedan idénticos —ni una
   *  coma del DOM cambia— cuando el texto no tiene matemáticas. */
  function has(t) {
    var s = cadena(t);
    return s.indexOf("^") >= 0 || s.indexOf("_") >= 0;
  }

  /** nodes(text, opts) -> DocumentFragment mezclando nodos de texto y nodos
   *  MathML, listo para appendChild en un <div> de prosa. Si no hay nada que
   *  convertir devuelve un fragmento con UN SOLO nodo de texto (lo que hace
   *  hoy textContent). Nunca lanza. */
  function nodes(t, opts) {
    var d = doc();
    if (!d) return fragmentoVacio();     // Node sin DOM: fragmento vacío (§2)

    var s = cadena(t);
    var display = !!(opts && opts.display);
    var frag = d.createDocumentFragment();
    var buf = "";                        // texto pendiente entre dos tokens

    function volcar() {
      if (buf === "") return;
      frag.appendChild(d.createTextNode(buf));
      buf = "";
    }

    var i = 0;
    while (i < s.length) {
      var m = tokenEn(s, i);
      if (!m) { buf += s.charAt(i); i++; continue; }
      volcar();
      frag.appendChild(guion(d, m, display));
      i = SCAN_RE.lastIndex;
    }
    volcar();

    return frag;
  }

  /** text(text) -> string plano con super/subíndices Unicode, para atributos
   *  y contextos sin DOM (title, aria-label, localStorage, portapapeles,
   *  exports). Es una función pura: no toca el DOM y nunca lanza. */
  function text(t) {
    var s = cadena(t);
    var out = "";
    var buf = "";
    var i = 0;

    while (i < s.length) {
      var m = tokenEn(s, i);
      if (!m) { buf += s.charAt(i); i++; continue; }

      var op = m[2];
      var exp = (m[3] !== undefined) ? m[3] : m[4];
      var uni = guionUnicode(exp, op === "^" ? SUPER : SUBINDICE);
      var fin = SCAN_RE.lastIndex;

      if (uni === null) buf += s.substring(i, fin);   // sin glifo: tal cual
      else { out += buf + m[1] + uni; buf = ""; }
      i = fin;
    }

    return out + buf;
  }

  var InlineMath = {
    nodes: nodes,
    text: text,
    has: has,
    TOKEN_RE: TOKEN_RE
  };

  /* Patrón de raíz idéntico al de app.js/ui-core.js: navegador y Node. */
  global.InlineMath = InlineMath;
  if (typeof module !== "undefined" && module.exports) module.exports = InlineMath;

  /* =====================================================================
   * NOTAS DE IMPLEMENTACIÓN (documentadas, como en engine.js)
   * ---------------------------------------------------------------------
   * 1) QUÉ ES LA BASE DE UN <msup>. La gramática (§3 del contrato) define la
   *    base como UN carácter, y eso incluye el cierre de grupo: en "(1+1/n)^n"
   *    la base es ")". El resultado visual es el correcto, porque la base de
   *    un <msup> se dibuja a tamaño y altura normales y sólo el exponente
   *    sube — lo único que se pierde es el espacio entre ")" y el superíndice.
   *    No se inventa una base hacia atrás (el contrato lo prohíbe: "no inventa
   *    bases").
   *
   * 2) QUÉ HACE display. Por defecto false, que es el caso del contrato: el
   *    fragmento devuelve los <msup>/<msub> sueltos. Con display:true cada
   *    guion se envuelve en su <math display="block">.
   *
   * 3) NOTA PARA QUIEN CABLEA ESTO (src/app.js, src/pagina-*.js): MathML
   *    necesita su raíz <math> para que el navegador lo maquete. Si al pintarlo
   *    se ve la potencia sin subir, envuelve el fragmento en
   *    document.createElementNS(NS_MATH, "math"), o llama a nodes(t,
   *    {display:true}). Y como recuerda el contrato: el contenido que YA es un
   *    nodo MathML del motor (renderExpr, step-math) NO pasa por aquí.
   *
   * 4) LO QUE NO HACE, por contrato: no construye <mfrac> (a/b se queda con su
   *    barra en la prosa), no interpreta "^∞", "^)" ni "^^", y no toca
   *    '−', '·', '∞', '→', '≤', '≥', '√': se pasan tal cual.
   * ===================================================================== */
})(typeof window !== "undefined" ? window : globalThis);