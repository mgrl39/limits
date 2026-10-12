/* =========================================================================
 * app.js — Interfaz del juego de límites (2º de Bachillerato)
 * -------------------------------------------------------------------------
 * Depende EXCLUSIVAMENTE del contrato `window.Lim` (ver CONTRACT.md).
 * Sin dependencias, sin módulos, sin frameworks, sin eval.
 *
 * Exporta:  window.App = { start, state, render, generateNext, closeProblem }
 * ========================================================================= */

(function (global) {
  "use strict";

  /* =======================================================================
   * 0. Constantes y utilidades mínimas
   * ===================================================================== */

  var NS_MATH = "http://www.w3.org/1998/Math/MathML";
  var STORE_KEY = "limites:v1";
  var XP_NUMERO = 10;
  var XP_METODO = 5;
  var REINJECT_CADA = 5;          // un repaso del cuaderno cada 5 problemas
  var MODOS = ["escribir", "opciones", "mixto"];
  var POLITICAS = ["visible", "boton", "examen"];
  var HOW = ["fallo", "fallo de método", "saltado", "visto solución", "ayudado", "acierto"];

  var ETIQUETA_MODO = {
    escribir: "escribiendo",
    opciones: "eligiendo",
    mixto: "mixto"
  };

  var ETIQUETA_POLITICA = {
    visible: "Opciones siempre visibles",
    boton: "Opciones bajo demanda",
    examen: "Modo examen"
  };

  var ETIQUETA_HOW = {
    "fallo": "fallo",
    "fallo de método": "fallo de método",
    "saltado": "saltado",
    "visto solución": "visto solución",
    "ayudado": "ayudado",
    "acierto": "acierto"
  };

  var CLASE_HOW = {
    "fallo": "how-fallo",
    "fallo de método": "how-metodo",
    "saltado": "how-saltado",
    "visto solución": "how-solucion",
    "ayudado": "how-ayudado",
    "acierto": "how-acierto"
  };

  var TOPIC_FALLBACK = [
    { id: "sustitucion", name: "Sustitución y laterales", color: "--c-sustitucion" },
    { id: "infinito", name: "Límites en el infinito", color: "--c-infinito" },
    { id: "indeterminacion", name: "Indeterminaciones", color: "--c-indet" },
    { id: "continuidad", name: "Continuidad", color: "--c-continuidad" }
  ];

  /* --- InlineMath: matemática en línea dentro de la prosa ---------------- */
  /*
   * app.js NO importa ui-core.js (es autónomo), así que aquí vive su propia
   * copia mínima del mecanismo. Mismo criterio y mismo nombre de prop:
   *
   *   el("div", { class: "step-d", text: s.detail, math: true })
   *
   * `math: true` significa "este texto es prosa que puede llevar notación
   * LaTeX (x^3, a_n): conviértela a superíndices de verdad al pintarla".
   * Sin la prop, `text:` sigue siendo textContent, que es lo queexpects
   * media casa (y lo que comparan los tests con ===).
   *
   * `window.InlineMath` es opcional: tests/ui-spec.test.mjs carga sólo
   * engine+theory-data+app en un vm con mini-DOM, sin inline-math.js. Ahí
   * este volcado no hace nada y todo queda exactamente igual.
   */

  function hayInlineMath() {
    var IM = global.InlineMath;
    return !!(IM && typeof IM.nodes === "function" && typeof IM.has === "function");
  }

  /** Vuelca el texto del nodo en superíndices MathML. Idempotente y barato. */
  function ponerMaths(node) {
    if (!node || !hayInlineMath()) return node;
    // `text:` con un nodo ya construido: no hay texto plano que maths.
    if (node.childNodes && node.childNodes.length) return node;
    var s = node.textContent;
    if (!global.InlineMath.has(s)) return node;
    node.textContent = "";
    node.appendChild(global.InlineMath.nodes(s));
    return node;
  }

  /**
   * Texto con superíndices Unicode, para ATRIBUTOS (title, aria-label…).
   * En un atributo no cabe MathML, y lo que se persiste en localStorage o se
   * compara con === tiene que seguir siendo el texto crudo del motor.
   */
  function mathText(s) {
    if (!hayInlineMath()) return s;
    return global.InlineMath.text(s);
  }

  /**
   * Segunda pasada sobre prosa que YA está en el DOM (el HTML que devuelve
   * `Lim.solutionHtml` llega como cadena y se importa desde un <template>).
   * Recorre los nodos de texto de los `selectores` dados y maths los que
   * tienen algo convertible. Se salta cualquier subárbol <math>, que ya
   * viene en MathML del motor y no hay que tocar.
   */
  function mathsEn(raiz, selectores) {
    if (!raiz || !hayInlineMath() || !raiz.querySelectorAll) return raiz;
    for (var s = 0; s < selectores.length; s++) {
      var nodos;
      try { nodos = raiz.querySelectorAll(selectores[s]); } catch (e) { continue; }
      for (var i = 0; i < nodos.length; i++) mathsTextoHijo(nodos[i]);
    }
    return raiz;
  }

  /** Maths los nietos de texto de `n`, en profundidad, sin tocar <math>. */
  function mathsTextoHijo(n) {
    if (!n || !n.childNodes || !n.childNodes.length) return n;
    // Copia: mathsTextoHijo mete nodos nuevos entre los hijos que recorremos.
    var hijos = n.childNodes.slice();
    for (var i = 0; i < hijos.length; i++) {
      var h = hijos[i];
      if (h.nodeType !== 3) {                       // 3 = nodo de texto
        if (!esMath(h)) mathsTextoHijo(h);
        continue;
      }
      var s = h.data === undefined || h.data === null ? h.textContent : h.data;
      if (!global.InlineMath.has(s)) continue;
      var frag = global.InlineMath.nodes(s);
      if (!n.replaceChild) continue;
      n.replaceChild(frag, h);
    }
    return n;
  }

  /** ¿Es este nodo (o su contenedor) parte de un árbol MathML? */
  function esMath(n) {
    if (!n || !n.nodeName) return false;
    var nombre = String(n.nodeName).toLowerCase();
    if (nombre === "math") return true;
    if (n.namespaceURI === NS_MATH) return true;
    return false;
  }

  /* --- Creación de nodos ------------------------------------------------ */

  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    // Opt-in: se aplica al final del bucle, para que el orden de las props
    // no importe (ver la nota de arriba).
    var maths = false;
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === "class") node.className = v;
        else if (k === "math") maths = (v === true);
        else if (k === "text") {
          // Si por error se pasa un nodo, lo añadimos en vez de imprimirlo.
          if (v && typeof v === "object" && v.nodeType) node.appendChild(v);
          else node.textContent = v;
        }
        else if (k === "dataset") { for (var d in v) node.dataset[d] = v[d]; }
        else if (k.slice(0, 2) === "on" && typeof v === "function") {
          node.addEventListener(k.slice(2), v);
        } else if (v === true) node.setAttribute(k, "");
        else node.setAttribute(k, String(v));
      }
    }
    if (maths) ponerMaths(node);
    if (kids !== null && kids !== undefined) append(node, kids);
    return node;
  }

  // Añade hijos tolerate: acepta nodos, arrays, texto, o null/false (se ignoran).
  // El texto SIEMPRE entra como nodo de texto, nunca como HTML.
  function append(parent, kids) {
    if (Array.isArray(kids)) {
      for (var i = 0; i < kids.length; i++) {
        var c = kids[i];
        if (c === null || c === undefined || c === false) continue;
        if (Array.isArray(c)) append(parent, c);
        else addChild(parent, c);
      }
    } else if (kids !== null && kids !== undefined && kids !== false) {
      addChild(parent, kids);
    }
    return parent;
  }

  function addChild(parent, c) {
    if (typeof c === "string" || typeof c === "number" || typeof c === "bigint") {
      parent.appendChild(document.createTextNode(String(c)));
      return;
    }
    if (!c || typeof c.nodeType !== "number") return;   // basura: se ignora
    parent.appendChild(c);
  }

  /* --- MathML: SIEMPRE con createElementNS, nunca con innerHTML -------- */

  function m(tag, props, kids) {
    var node = document.createElementNS(NS_MATH, tag);
    if (props) {
      for (var k in props) {
        if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
        var v = props[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === "text") node.textContent = v;
        else node.setAttribute(k, v === true ? "" : String(v));
      }
    }
    if (kids) append(node, kids);
    return node;
  }

  function mrow() {
    var kids = Array.prototype.slice.call(arguments);
    return m("mrow", null, kids);
  }

  /* --- Texto ----------------------------------------------------------- */

  // Escape para contextos donde SÍ hace falta: atributos (title, aria-label…).
  // El texto visible nunca pasa por aquí: entra siempre con textContent, que
  // ya escapa por sí mismo (y no muestra entidades en pantalla).
  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function timeAgo(ts) {
    var ms = Date.now() - (Number(ts) || 0);
    if (!(ms >= 0)) return "ahora mismo";
    var min = Math.floor(ms / 60000);
    if (min < 1) return "ahora mismo";
    if (min < 60) return "hace " + min + " min";
    var h = Math.floor(min / 60);
    if (h < 24) return "hace " + h + (h === 1 ? " hora" : " horas");
    var d = Math.floor(h / 24);
    if (d === 1) return "ayer";
    if (d < 30) return "hace " + d + " días";
    var mo = Math.floor(d / 30);
    if (mo === 1) return "hace 1 mes";
    if (mo < 12) return "hace " + mo + " meses";
    var y = Math.floor(mo / 12);
    return "hace " + y + (y === 1 ? " año" : " años");
  }

  function plural(n, sing, pl) { return n + " " + (n === 1 ? sing : pl); }

  /* =======================================================================
   * 1. Acceso defensivo al motor
   * ===================================================================== */

  function Lim() { return global.Lim; }

  function topics() {
    var L = Lim();
    return (L && Array.isArray(L.TOPICS) && L.TOPICS.length) ? L.TOPICS : TOPIC_FALLBACK;
  }

  function topicById(id) {
    var list = topics();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function levels() {
    var L = Lim();
    if (!L || !Array.isArray(L.LEVELS)) return [];
    return L.LEVELS;
  }

  function levelById(id) {
    var list = levels();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function methodInfo(id) {
    var L = Lim();
    if (L && L.METHODS && L.METHODS[id]) return L.METHODS[id];
    return { name: id || "Método", desc: "" };
  }

  /* =======================================================================
   * 2. Estado + persistencia (localStorage "limites:v1")
   * ===================================================================== */

  function defaultState() {
    return {
      version: 1,
      screen: "portada",
      settings: { modo: "mixto", politica: "visible" },
      stats: {
        solved: 0, correct: 0, streak: 0, bestStreak: 0, xp: 0,
        byTopic: {}
      },
      campaign: {},
      notebook: [],
      /* Estado de sesión (no se persiste) */
      run: null,
      current: null,
      ui: { settingsOpen: false, theoryOpen: {} }
    };
  }

  var state = defaultState();

  function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  function num(v, def) {
    var n = Number(v);
    return isFinite(n) && n >= 0 ? Math.floor(n) : def;
  }

  // Sanea cualquier objeto venga de donde venga. Nunca lanza.
  function sanitizeSettings(s) {
    var out = { modo: "mixto", politica: "visible" };
    if (isPlainObject(s)) {
      if (MODOS.indexOf(s.modo) >= 0) out.modo = s.modo;
      if (POLITICAS.indexOf(s.politica) >= 0) out.politica = s.politica;
    }
    return out;
  }

  function sanitizeStats(s) {
    var out = {
      solved: 0, correct: 0, streak: 0, bestStreak: 0, xp: 0, byTopic: {}
    };
    if (!isPlainObject(s)) return out;
    out.solved = num(s.solved, 0);
    out.correct = num(s.correct, 0);
    out.streak = num(s.streak, 0);
    out.bestStreak = num(s.bestStreak, 0);
    out.xp = num(s.xp, 0);
    if (isPlainObject(s.byTopic)) {
      for (var k in s.byTopic) {
        if (!Object.prototype.hasOwnProperty.call(s.byTopic, k)) continue;
        var t = s.byTopic[k];
        if (!isPlainObject(t)) continue;
        out.byTopic[k] = { ok: num(t.ok, 0), total: num(t.total, 0) };
      }
    }
    if (out.bestStreak < out.streak) out.bestStreak = out.streak;
    if (out.correct > out.solved) out.solved = out.correct;
    return out;
  }

  function sanitizeCampaign(c) {
    var out = {};
    if (!isPlainObject(c)) return out;
    for (var id in c) {
      if (!Object.prototype.hasOwnProperty.call(c, id)) continue;
      var v = c[id];
      if (!isPlainObject(v)) continue;
      out[id] = {
        best: {
          num: num(v.best && v.best.num, 0),
          met: num(v.best && v.best.met, 0)
        },
        stars: clamp(num(v.stars, 0), 0, 3),
        passed: !!v.passed
      };
      if (out[id].passed && !levelReached(id)) out[id].passed = false;
      if (out[id].stars > 0 && !out[id].passed) out[id].stars = 0;
    }
    return out;
  }

  function sanitizeNotebook(nb) {
    var out = [];
    if (!Array.isArray(nb)) return out;
    var seen = {};
    for (var i = 0; i < nb.length && out.length < 400; i++) {
      var e = nb[i];
      if (!isPlainObject(e)) continue;
      var seed = Number(e.seed);
      if (!isFinite(seed)) continue;
      var gen = String(e.generatorId || "");
      if (!gen) continue;
      var key = gen + ":" + seed;
      if (seen[key]) continue;
      seen[key] = 1;
      out.push({
        seed: seed >>> 0,
        generatorId: gen,
        attempts: clamp(num(e.attempts, 1), 1, 999),
        lastTs: num(e.lastTs, Date.now()),
        resolved: false,
        howClosed: HOW.indexOf(e.howClosed) >= 0 ? e.howClosed : "fallo"
      });
    }
    return out;
  }

  function load() {
    var d = defaultState();

    var raw = null;
    try {
      raw = global.localStorage ? global.localStorage.getItem(STORE_KEY) : null;
    } catch (e) {
      raw = null;                       // modo privado / cookies bloqueadas
    }
    if (raw === null || raw === undefined) return;   // sin datos: defaults

    var data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      data = null;                      // JSON corrupto: empezamos limpio
    }
    if (!isPlainObject(data)) data = null;
    if (data === null) {
      state.settings = d.settings;
      state.stats = d.stats;
      state.campaign = d.campaign;
      state.notebook = d.notebook;
      return;
    }

    state.settings = sanitizeSettings(data.settings);
    state.stats = sanitizeStats(data.stats);
    state.campaign = sanitizeCampaign(data.campaign);
    state.notebook = sanitizeNotebook(data.notebook);
  }

  function save() {
    try {
      if (!global.localStorage) return;
      global.localStorage.setItem(STORE_KEY, JSON.stringify({
        version: 1,
        settings: state.settings,
        stats: state.stats,
        campaign: state.campaign,
        notebook: state.notebook
      }));
    } catch (e) { /* almacenamiento lleno o bloqueado: no es crítico */ }
  }

  function resetProgress() {
    var s = state.settings;
    var keep = { version: 1, settings: s, stats: defaultState().stats, campaign: {}, notebook: [] };
    state.stats = keep.stats;
    state.campaign = keep.campaign;
    state.notebook = keep.notebook;
    state.run = null;
    state.current = null;
    save();
  }

  /* =======================================================================
   * 3. Campaña: desbloqueo, estrellas, progreso
   * ===================================================================== */

  function levelReached(id) {
    var list = levels();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return true;
    return false;
  }

  function levelUnlocked(id) {
    var list = levels();
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) idx = i;
    if (idx <= 0) return true;           // el primero siempre
    var prev = state.campaign[list[idx - 1].id];
    return !!(prev && prev.passed);
  }

  function starsFor(numOk, metOk, total) {
    var req = total - 2;                  // 8 de 10 por defecto
    if (numOk < req || metOk < req) return 0;
    if (numOk >= total && metOk >= total) return 3;
    if (numOk >= total - 1 && metOk >= total - 1) return 2;
    return 1;
  }

  function recordLevelResult(levelId, numOk, metOk, total) {
    if (!levelById(levelId)) return null;
    var prev = state.campaign[levelId] || { best: { num: 0, met: 0 }, stars: 0, passed: false };
    var best = {
      num: Math.max(prev.best.num, numOk),
      met: Math.max(prev.best.met, metOk)
    };
    var stars = Math.max(prev.stars, starsFor(best.num, best.met, total));
    var rec = { best: best, stars: stars, passed: !!prev.passed || stars > 0 };
    state.campaign[levelId] = rec;
    return rec;
  }

  /* =======================================================================
   * 4. Cuaderno de errores
   * ===================================================================== */

  function notebookFind(seed, generatorId) {
    for (var i = 0; i < state.notebook.length; i++) {
      if (state.notebook[i].seed === seed && state.notebook[i].generatorId === generatorId) {
        return state.notebook[i];
      }
    }
    return null;
  }

  function notebookUpsert(problem, how) {
    if (!problem) return;
    var entry = notebookFind(problem.seed, problem.generatorId);
    if (entry) {
      entry.attempts = clamp(entry.attempts + 1, 1, 999);
      entry.lastTs = Date.now();
      entry.resolved = false;
      entry.howClosed = HOW.indexOf(how) >= 0 ? how : "fallo";
    } else {
      state.notebook.push({
        seed: problem.seed,
        generatorId: problem.generatorId,
        attempts: 1,
        lastTs: Date.now(),
        resolved: false,
        howClosed: HOW.indexOf(how) >= 0 ? how : "fallo"
      });
    }
    if (state.notebook.length > 400) state.notebook.splice(0, state.notebook.length - 400);
  }

  function notebookResolve(problem) {
    var idx = -1;
    for (var i = 0; i < state.notebook.length; i++) {
      if (state.notebook[i].seed === problem.seed && state.notebook[i].generatorId === problem.generatorId) {
        idx = i; break;
      }
    }
    if (idx >= 0) state.notebook.splice(idx, 1);
  }

  function notebookByTopic() {
    var groups = [];
    var index = {};
    for (var i = 0; i < state.notebook.length; i++) {
      var e = state.notebook[i];
      var gen = genMeta(e.generatorId);
      var tid = gen ? gen.topic : "sustitucion";
      if (!index[tid]) {
        index[tid] = { topic: topicById(tid) || { id: tid, name: tid, color: "--c-sustitucion" }, items: [] };
        groups.push(index[tid]);
      }
      index[tid].items.push({ entry: e, gen: gen });
    }
    groups.sort(function (a, b) { return b.items.length - a.items.length; });
    return groups;
  }

  function genMeta(id) {
    var L = Lim();
    if (L && L.GENERATORS && L.GENERATORS[id]) return L.GENERATORS[id];
    return null;
  }

  /* =======================================================================
   * 5. Formato de respuestas y opciones
   * ===================================================================== */

  var PRETTY = {
    "+inf": "+∞",
    "infinity": "+∞",
    "-inf": "−∞",
    "dne": "no existe",
    "no existe": "no existe",
    "si": "Sí",
    "sí": "Sí",
    "no": "No"
  };

  function answerText(ans) {
    var L = Lim();
    if (!L || !L.answerToString) return "";
    try { return L.answerToString(ans); }
    catch (e) { return ""; }
  }

  function prettyAnswer(s) {
    if (s === null || s === undefined) return "";
    var key = String(s).trim().toLowerCase();
    if (PRETTY[key]) return PRETTY[key];
    return String(s);
  }

  // Construye las 4 opciones: la correcta + 3 distractores, barajadas.
  function optionList(problem) {
    var L = Lim();
    var correct = prettyAnswer(answerText(problem.answer));
    var pool = [];
    if (Array.isArray(problem.options) && problem.options.length === 4) {
      pool = problem.options.map(prettyAnswer);
    } else {
      pool.push(correct);
      var dis = Array.isArray(problem.distractors) ? problem.distractors : [];
      for (var i = 0; i < dis.length; i++) pool.push(prettyAnswer(answerText(dis[i])));
      pool.push(correct, correct + " no", correct + " ±1", "dne", "+inf", "-inf", "0", "1", "2", "−1");
    }

    var seen = {};
    var uniq = [];
    for (var j = 0; j < pool.length && uniq.length < 4; j++) {
      var v = String(pool[j]);
      if (!v || seen[v]) continue;
      seen[v] = 1;
      uniq.push(v);
    }
    var fallback = ["+∞", "−∞", "no existe", "0"];
    for (var k = 0; uniq.length < 4; k++) {
      if (!seen[fallback[k]]) { seen[fallback[k]] = 1; uniq.push(fallback[k]); }
    }
    while (uniq.length > 4) uniq.pop();

    // Barajado determinista con la semilla del problema (mismas opciones siempre).
    var order = [0, 1, 2, 3];
    if (L && typeof L.rng === "function") {
      try {
        var r = L.rng((Number(problem.seed) >>> 0) ^ 0x5f3a);
        order = r.shuffle(order);
      } catch (e) { /* dejamos el orden natural */ }
    }
    var out = [];
    for (var n = 0; n < order.length; n++) out.push(uniq[order[n]]);
    return out;
  }

  /* =======================================================================
   * 6. Render de fórmulas MathML
   * ===================================================================== */

  // Lim.Q -> MathML (usa SOLO q.n / q.d, definidos en el contrato §1).
  function qMath(q) {
    if (!q || q.n === undefined || q.d === undefined) return m("mtext", { text: "?" });
    var n = String(q.n), d = String(q.d);
    if (d === "1") return m("mn", { text: n });
    return m("mfrac", null, [m("mn", { text: n }), m("mn", { text: d })]);
  }

  function qText(q) {
    try { return q.toDisplay ? q.toDisplay() : String(q.toString()); }
    catch (e) { return "?"; }
  }

  // El motor puede devolver un nodo MathML suelto (mrow, mfrac, …). En un
  // navegador eso NO se pinta: el MathML necesita su raíz <math>. Así que
  // siempre envolvemos, y si ya viene con raíz <math> la reutilizamos.
  function renderExpr(node) {
    var L = Lim();
    if (!L || !L.ast || typeof L.ast.toMathML !== "function") {
      return m("math", null, m("mtext", { text: "f(x)" }));
    }
    var elx;
    try {
      elx = L.ast.toMathML(node);
    } catch (e) {
      elx = null;
    }
    if (!elx || !elx.nodeType) return m("math", null, m("mtext", { text: "f(x)" }));
    if (String(elx.localName || elx.tagName || "").toLowerCase() === "math") return elx;
    return m("math", null, elx);
  }

  // "x → a", "x → a⁻", "x → a⁺", "x → +∞", "x → −∞"
  function targetMath(target) {
    if (!target) return mrow();
    var kids = [m("mi", { text: "x" }), m("mo", { text: "→" })];
    if (target.type === "infinity") {
      kids.push(m("mo", { text: target.sign === "-" ? "−∞" : "+∞" }));
    } else {
      var base = qMath(target.at);
      // El lado va como exponente:  3⁻  ·  3⁺
      kids.push(target.side === "-" ? msup(base, m("mo", { text: "−" }))
        : target.side === "+" ? msup(base, m("mo", { text: "+" }))
          : base);
    }
    return m("mrow", null, kids);
  }

  // "Objetivo · x → a = ?" que se pinta junto al enunciado.
  function renderTarget(target) {
    var box = el("div", { class: "target" });
    box.appendChild(el("span", { class: "target-label", text: "Objetivo" }));
    box.appendChild(m("math", null, [
      targetMath(target), m("mo", { text: "=" }), m("mtext", { text: "?" })
    ]));
    return box;
  }

  /* --- Definición por trozos (continuidad) ------------------------------ */

  var COND = { le: "≤", lt: "<", ge: "≥", gt: ">", eq: "=" };

  function renderPieces(statement) {
    var wrap = el("div", { class: "piecewise" });
    var list = statement.pieces || [];
    var inner = el("div", { class: "grow", style: "display:flex;flex-direction:column;gap:2px" });
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var cond = p.cond || ("x " + (COND[p.condType] || "") + " ?");
      var row = el("div", { class: "piece" }, [
        m("mrow", null, [renderExpr(p.expr)]),
        el("span", { class: "cond", text: ",  " + cond })
      ]);
      inner.appendChild(row);
    }
    wrap.appendChild(el("span", { class: "brace", text: "{" }));
    wrap.appendChild(inner);
    return wrap;
  }

  /* =======================================================================
   * 7. Chips reutilizables
   * ===================================================================== */

  function chip(text, variant, extra) {
    var cls = "chip" + (variant ? " chip-" + variant : "") + (extra ? " " + extra : "");
    return el("span", { class: cls, text: text });
  }

  function topicChip(topicId) {
    var t = topicById(topicId);
    return el("span", {
      class: "chip chip-topic",
      dataset: { topic: topicId || "" },
      text: t ? t.name : (topicId || "")
    });
  }

  function diffChip(d) {
    var n = clamp(num(d, 1), 1, 5);
    var label = n <= 1 ? "sustitución" : n === 2 ? "fácil" : n === 3 ? "media" : n === 4 ? "difícil" : "muy difícil";
    var variant = n <= 1 ? "facil" : n === 2 ? "facil" : n === 3 ? "media" : "dificil";
    var dots = el("span", { class: "diff-dots", "aria-hidden": "true" });
    for (var i = 1; i <= 5; i++) {
      dots.appendChild(el("span", { class: i <= n ? "" : "off", text: "●" }));
    }
    return el("span", { class: "chip chip-" + variant, title: "Dificultad " + n + " de 5" }, [
      dots,
      el("span", { text: label })
    ]);
  }

  function streakStat() {
    var s = state.stats;
    return el("span", {
      class: "stat stat-streak" + (s.streak > 0 ? "" : " cold"),
      title: "Racha actual · mejor: " + s.bestStreak
    }, [
      el("span", { class: "stat-ico", text: "🔥" }),
      el("span", { text: String(s.streak) })
    ]);
  }

  function xpStat() {
    return el("span", { class: "stat stat-xp", title: "Puntos de experiencia" }, [
      el("span", { class: "stat-ico", text: "✦" }),
      el("span", { text: String(state.stats.xp) + " XP" })
    ]);
  }

  /* =======================================================================
   * 8. Router y render
   * ===================================================================== */

  var host = null;
  var SCREENS = ["portada", "campana", "juego", "cuaderno", "teoria"];
  var lastRenderedScreen = null;

  function go(screen, opts) {
    if (SCREENS.indexOf(screen) < 0) screen = "portada";
    state.screen = screen;
    state.picker = null;
    if (screen !== "juego") { state.ui.settingsOpen = false; }
    if (opts && opts.settings !== undefined) state.ui.settingsOpen = !!opts.settings;
    render();
  }

  function render() {
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    if (!/(\s|^)app(\s|$)/.test(host.className || "")) {
      host.className = ((host.className || "") + " app").trim();
    }
    var frag = document.createDocumentFragment();
    append(frag, topbar());
    // La entrada animada sólo cuando CAMBIA de pantalla: si no, cada
    // comprobación o cada ajuste reharía parpadear toda la vista.
    var entering = state.screen !== lastRenderedScreen;
    lastRenderedScreen = state.screen;
    var scr = el("section", {
      class: "screen screen-" + state.screen + (entering ? " screen-enter" : ""),
      id: "screen"
    });
    if (state.screen === "portada") append(scr, viewPortada());
    else if (state.screen === "campana") append(scr, viewCampana());
    else if (state.screen === "juego") append(scr, viewJuego());
    else if (state.screen === "cuaderno") append(scr, viewCuaderno());
    else append(scr, viewTeoria());
    frag.appendChild(scr);
    host.appendChild(frag);
  }

  /* --- Cabecera --------------------------------------------------------- */

  function topbar() {
    var bar = el("header", { class: "topbar" });
    if (state.screen === "juego") {
      bar.appendChild(el("button", {
        class: "btn btn-ghost icon-btn", title: "Volver", "aria-label": "Volver",
        onclick: function () { go("campana"); }
      }, "←"));
    } else if (state.screen !== "portada") {
      bar.appendChild(el("button", {
        class: "btn btn-ghost icon-btn", title: "Portada", "aria-label": "Portada",
        onclick: function () { go("portada"); }
      }, "←"));
    }
    bar.appendChild(el("div", { class: "brand" }, [
      el("span", { class: "brand-mark", text: "∫" }),
      el("span", { text: "Límites" })
    ]));
    bar.appendChild(el("div", { class: "topbar-stats" }, [streakStat(), xpStat()]));
    return bar;
  }

  /* =======================================================================
   * 9. Pantalla: PORTADA
   * ===================================================================== */

  function viewPortada() {
    var s = state.stats;
    var wrap = el("div");

    var done = levels().filter(function (l) {
      var c = state.campaign[l.id];
      return c && c.passed;
    }).length;

    var buttons = [
      { label: "▶  Campaña", variant: "btn-primary", sub: "10 niveles", go: "campana" },
      { label: "🧪  Modo libre", variant: "", sub: "sin bloqueos", go: "libre" },
      { label: "📕  Cuaderno de errores", variant: "", sub: plural(state.notebook.length, "fallo", "fallos"), go: "cuaderno" },
      { label: "📖  Teoría", variant: "btn-ghost", sub: "hoja de referencia", go: "teoria" }
    ];

    var actions = el("div", { class: "hero-actions" });
    for (var i = 0; i < buttons.length; i++) {
      (function (b) {
        var btn = el("button", { class: "btn " + b.variant }, [
          el("span", { text: b.label }),
          el("span", { class: "tiny", style: "opacity:.65", text: b.sub })
        ]);
        btn.addEventListener("click", function () {
          if (b.go === "libre") openLevelPicker(true);
          else go(b.go);
        });
        actions.appendChild(btn);
      })(buttons[i]);
    }

    wrap.appendChild(el("div", { class: "hero" }, [
      el("div", { class: "hero-mark", text: "∫" }),
      el("h1", { class: "hero-title", text: "Límites y continuidad" }),
      el("p", { class: "hero-sub", text: "Practica los límites finitos, en el infinito, las indeterminaciones y la continuidad. Diez niveles, interrogatorio de método en cada acierto y cuaderno de errores para repasar lo que fallas." }),
      actions,
      el("div", { class: "hero-foot" }, [
        chip(state.settings.modo === "mixto" ? "Modo mixto" : "Escribiendo", "accent2"),
        chip(ETIQUETA_POLITICA[state.settings.politica], "mute"),
        done < levels().length ? chip(done + " de " + levels().length + " niveles", "mute") : chip("Campaña completa", "ok")
      ])
    ]));

    wrap.appendChild(el("div", { class: "stat-strip" }, [
      statCell(String(s.solved), "resueltos"),
      statCell(String(s.correct), "perfectos"),
      statCell(String(s.xp), "XP"),
      statCell(String(state.notebook.length), "en cuaderno")
    ]));

    if (state.notebook.length > 0) {
      wrap.appendChild(el("div", { class: "card" }, [
        el("div", { class: "row row-top" }, [
          el("div", { class: "grow" }, [
            el("div", { style: "font-weight:700", text: "Tienes " + plural(state.notebook.length, "fallo guardado", "fallos guardados") }),
            el("div", { class: "small muted", text: "Cada 5 problemas se cuela uno de ellos para que no se te olviden." })
          ]),
          el("button", { class: "btn btn-sm", onclick: function () { go("cuaderno"); } }, "Abrir cuaderno")
        ])
      ]));
    }

    wrap.appendChild(settingsCard());
    return wrap;
  }

  function statCell(v, label) {
    return el("div", { class: "stat-cell" }, [
      el("b", { text: String(v) }),
      el("span", { text: label })
    ]);
  }

  /* =======================================================================
   * 10. Pantalla: CAMPAÑA
   * ===================================================================== */

  function viewCampana() {
    var wrap = el("div");
    var list = levels();

    wrap.appendChild(el("div", { class: "screen-head" }, [
      el("h1", { class: "screen-title", text: "Campaña" }),
      el("p", { class: "screen-sub", text: "Un nivel se supera con 8 aciertos de número y 8 de método sobre 10. Dos estrellas con 9, tres con 10." })
    ]));

    var grid = el("div", { class: "levels" });
    for (var i = 0; i < list.length; i++) {
      grid.appendChild(levelCard(list[i], i === 0));
    }
    wrap.appendChild(grid);

    wrap.appendChild(el("div", { class: "card", style: "margin-top:14px" }, [
      el("div", { class: "row row-wrap" }, [
        el("div", { class: "grow" }, [
          el("div", { style: "font-weight:700", text: "Modo libre" }),
          el("div", { class: "small muted", text: "Practica cualquier nivel sin bloqueos y sin que afecte a las estrellas." })
        ]),
        el("button", { class: "btn btn-sm btn-primary", onclick: function () { openLevelPicker(true); } }, "Elegir nivel")
      ])
    ]));

    wrap.appendChild(el("div", { class: "center", style: "margin-top:18px" }, [
      el("button", {
        class: "btn btn-sm btn-ghost btn-danger",
        title: "Borra el progreso, las estrellas y el cuaderno",
        onclick: function () {
          resetProgress();
          render();
        }
      }, "Reiniciar progreso")
    ]));

    return wrap;
  }

  function levelCard(level, isFirst) {
    var rec = state.campaign[level.id] || null;
    var unlocked = isFirst || levelUnlocked(level.id);
    var total = num(level.total, 10);
    var pct = rec ? clamp(Math.round(((rec.best.num + rec.best.met) / (total * 2)) * 100), 0, 100) : 0;

    var stars = el("span", { class: "stars", "aria-label": plural(rec ? rec.stars : 0, "estrella", "estrellas") });
    for (var s = 1; s <= 3; s++) {
      stars.appendChild(el("span", { class: rec && rec.stars >= s ? "on" : "off", text: "★" }));
    }

    var card = el("button", {
      class: "level" + (rec && rec.passed ? " passed" : ""),
      disabled: !unlocked,
      title: unlocked ? ("Nivel " + level.n + ": " + level.name) : "Bloqueado: supera antes el nivel " + (level.n - 1)
    }, [
      el("div", { class: "level-top" }, [
        el("span", { class: "level-n", text: String(level.n) }),
        el("span", { class: "level-name", text: level.name })
      ]),
      el("div", { class: "level-meta" }, [
        unlocked ? null : el("span", { class: "level-lock", text: "🔒", title: "Bloqueado" }),
        el("span", { text: rec ? rec.best.num + "/" + total + " núm." : total + " problemas" }),
        stars
      ]),
      pct > 0 ? el("div", { class: "level-bar" }, el("i", { style: "width:" + pct + "%" })) : null
    ]);

    card.addEventListener("click", function () {
      if (!unlocked) return;
      startRun({ levelId: level.id, free: false });
    });
    return card;
  }

  function openLevelPicker(free) {
    var wrap = el("div");
    var list = levels();
    wrap.appendChild(el("div", { class: "screen-head" }, [
      el("h1", { class: "screen-title", text: free ? "Modo libre" : "Elige nivel" }),
      el("p", { class: "screen-sub", text: free ? "Sin bloqueos y sin_stars: las estrellas solo cuentan en campaña." : "" })
    ]));
    var grid = el("div", { class: "levels" });
    for (var i = 0; i < list.length; i++) {
      var level = list[i];
      var card = el("button", { class: "level" }, [
        el("div", { class: "level-top" }, [
          el("span", { class: "level-n", text: String(level.n) }),
          el("span", { class: "level-name", text: level.name })
        ]),
        el("div", { class: "level-meta" }, [
          el("span", { text: (level.generators || []).length + " tipos" })
        ])
      ]);
      (function (lv) {
        card.addEventListener("click", function () { startRun({ levelId: lv.id, free: !!free }); });
      })(level);
      grid.appendChild(card);
    }
    wrap.appendChild(grid);
    state.picker = wrap;
    state.screen = "juego";
    render();
  }

  /* =======================================================================
   * 11. Pantalla: JUEGO
   * ===================================================================== */

  function viewJuego() {
    var wrap = el("div");
    if (state.picker) { append(wrap, state.picker); return wrap; }
    var run = state.run;
    if (!run) {
      wrap.appendChild(emptyState());
      return wrap;
    }
    if (run.finished) { append(wrap, viewFinish()); return wrap; }
    if (!state.current) generateNext(true);

    append(wrap, runHeader());
    var c = state.current;
    if (!c) { wrap.appendChild(emptyState()); return wrap; }
    if (c.isReview) {
      wrap.appendChild(el("div", { class: "notice notice-warn review-banner" }, [
        el("span", { class: "notice-ico", text: "↻" }),
        el("span", { text: "Ejercicio de repaso de uno de tus fallos. Si lo fallas otra vez, se rompe la racha." })
      ]));
    }
    append(wrap, cardProblem(c));
    append(wrap, cardAnswer(c));
    if (c.feedback) wrap.appendChild(cardFeedback(c));
    if (c.phase === "quiz" || c.quizAnswered) append(wrap, cardQuiz(c));
    if (c.solutionOpen) append(wrap, cardSolution(c));
    if (state.ui.settingsOpen) wrap.appendChild(settingsCard());
    return wrap;
  }

  function emptyState() {
    return el("div", { class: "card" }, [
      el("div", { class: "empty" }, [
        el("div", { class: "empty-mark", text: "∫" }),
        el("div", { class: "empty-title", text: "No hay ningún problema activo" }),
        el("div", { class: "small", text: "Empieza una partida desde la campaña o el modo libre." }),
        el("div", { style: "margin-top:14px" }, [
          el("button", { class: "btn btn-primary", onclick: function () { go("campana"); } }, "Ir a la campaña")
        ])
      ])
    ]);
  }

  function runHeader() {
    var run = state.run;
    var lvl = run.levelId ? levelById(run.levelId) : null;
    var total = run.total;
    var box = el("div", { class: "card card-tight", style: "margin-bottom:12px" });
    var head = el("div", { class: "row row-wrap", style: "margin-bottom:8px" }, [
      el("span", { style: "font-weight:700;font-size:.95rem", text: run.title || "Práctica libre" }),
      el("span", { class: "spacer" }),
      el("span", { class: "small muted mono", text: run.index + " / " + total })
    ]);
    box.appendChild(head);
    box.appendChild(el("div", { class: "bar" }, el("i", { style: "width:" + pct(run.index, total) + "%" })));
    var rec = run.numOk + "/" + num(lvl && lvl.required, 8) + " nº · " + run.metOk + "/" + num(lvl && lvl.required, 8) + " método";
    box.appendChild(el("div", { class: "small muted", style: "margin-top:6px", text: rec }));
    return box;
  }

  function pct(a, b) {
    b = num(b, 1) || 1;
    return clamp(Math.round((a / b) * 100), 0, 100);
  }

  function cardProblem(c) {
    var p = c.problem;
    var st = p.statement || {};
    var card = el("div", { class: "card" });

    var chips = el("div", { class: "card-head" });
    if (c.runTitle) chips.appendChild(chip(c.runTitle, "accent"));
    chips.appendChild(topicChip(p.topic));
    chips.appendChild(diffChip(p.difficulty));
    chips.appendChild(el("span", { class: "chip chip-modo" }, [
      el("span", { "aria-hidden": "true", text: c.kind === "opciones" ? "🔘" : "⌨" }),
      el("span", { text: ETIQUETA_MODO[c.kind] || c.kind })
    ]));
    if (p.method) {
      var mi = methodInfo(p.method);
      chips.appendChild(el("span", { class: "chip chip-mute", title: mi.desc || "" }, [
        el("span", { text: "🧭" }),
        el("span", { text: mi.name })
      ]));
    }
    card.appendChild(chips);

    var body = el("div", { class: "stmt" });
    body.appendChild(el("div", { class: "stmt-lead", text: st.question || "Calcula el siguiente límite:" }));

    if (st.kind === "continuity" && st.pieces && st.pieces.length) {
      body.appendChild(renderPieces(st));
      body.appendChild(el("div", { class: "piece-ask", text: st.question || "¿Es f continua en ese punto?" }));
      body.appendChild(renderTarget(st.target));
    } else {
      var box = el("div", { class: "stmt-eqbox" });
      box.appendChild(el("div", { class: "math stmt-math" }, [
        m("math", null, [
          m("munder", null, [m("mo", { text: "lim" }), targetMath(st.target)]),
          m("mspace", { width: "0.6em" }),
          renderExpr(st.expr)
        ])
      ]));
      box.appendChild(el("span", { class: "eq-tail", text: "= ?" }));
      body.appendChild(box);
    }
    card.appendChild(body);
    return card;
  }

  function cardAnswer(c) {
    var card = el("div", { class: "card" });
    var answered = c.phase !== "answer";

    if (c.kind === "opciones" && c.policy === "examen" && !c.optionsShown && !answered) {
      card.appendChild(el("div", { class: "notice notice-info", style: "margin-bottom:10px" }, [
        el("span", { class: "notice-ico", text: "✍" }),
        el("span", { text: "Modo examen: escribe primero el valor del límite. Si aciertas, las opciones no hacen falta." })
      ]));
    }

    /* El campo de texto solo existe si el modo lo pide: al elegir entre
       opciones no se escribe nada, salvo en el modo examen, donde hay que
       responder ANTES de poder verlas. */
    var showField = c.kind === "escribir" || (c.kind === "opciones" && c.policy === "examen");

    var input = el("input", {
      class: "field",
      type: "text",
      id: "answer-field",
      style: showField ? "" : "display:none",
      value: c.input || "",
      placeholder: c.answerPlaceholder || "Escribe el valor (3/4, +inf, dne…)",
      autocomplete: "off",
      autocapitalize: "off",
      autocorrect: "off",
      spellcheck: "false",
      inputmode: "text",
      disabled: answered,
      "aria-label": "Tu respuesta"
    });
    input.addEventListener("input", function () {
      c.input = input.value;
      updateCheckButton();
    });
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") { ev.preventDefault(); onCheck(); }
    });

    var checkBtn = el("button", { class: "btn btn-primary", onclick: function () { onCheck(); } }, "Comprobar");
    checkBtn.id = "check-btn";

    var row = el("div", { class: "answer-row" }, [
      el("div", { class: "field-wrap" }, input),
      checkBtn
    ]);
    card.appendChild(row);

    function updateCheckButton() {
      var empty = !c.input || !String(c.input).trim();
      checkBtn.disabled = answered || empty;
    }
    updateCheckButton();

    if (!answered && c.kind === "escribir") {
      card.appendChild(el("div", { class: "field-hint" }, [
        "Se acepta ",
        el("code", { text: "3/4" }), " · ", el("code", { text: "-2" }), " · ",
        el("code", { text: "+inf" }), " · ", el("code", { text: "dne" }), " · ",
        el("code", { text: "no existe" })
      ]));
    }

    // Las opciones solo existen en el DOM si están reveladas (política) y si
    // este problema toca el modo "opciones".
    if (c.optionsShown) card.appendChild(optionsBlock(c));

    card.appendChild(toolsRow(c));
    return card;
  }

  function optionsBlock(c) {
    var box = el("div", { class: "opts", role: "group", "aria-label": "Opciones de respuesta" });
    var opts = c.options || [];
    for (var i = 0; i < opts.length; i++) {
      (function (idx, text) {
        var btn = el("button", {
          class: "opt",
          type: "button",
          disabled: c.phase !== "answer",
          dataset: { opt: String(idx) },
          onclick: function () { onPickOption(idx); }
        }, [
          el("span", { class: "opt-key", text: String(idx + 1) }),
          el("span", { class: "opt-text", text: text }),
          el("span", { class: "opt-mark", text: "" })
        ]);
        if (c.picked === idx && c.phase !== "answer") {
          btn.classList.add(c.pickedOk ? "correct" : "wrong");
          btn.querySelector(".opt-mark").textContent = c.pickedOk ? "✓" : "✕";
        }
        box.appendChild(btn);
      })(i, opts[i]);
    }
    return box;
  }

  function toolsRow(c) {
    var row = el("div", { class: "tools" });
    var answered = c.phase !== "answer";

    var needAttempt = c.policy === "examen";
    var solDisabled = answered || (needAttempt && !c.attempted);
    var solBtn = el("button", {
      class: "btn btn-sm",
      disabled: solDisabled,
      title: needAttempt ? "En modo examen necesitas comprobar una respuesta primero" : "Ver la solución paso a paso",
      onclick: function () { onShowSolution(); }
    }, [el("span", { text: "👁 Ver solución" }), el("span", { class: "kbd", text: "S" })]);

    var optBtn = null;
    if (c.kind === "opciones" || (c.kind === "escribir" && c.policy === "boton")) {
      if (c.optionsShown) {
        optBtn = el("button", { class: "btn btn-sm btn-ghost", disabled: true }, "Opciones visibles");
      } else if (c.optionsLocked) {
        optBtn = el("button", { class: "btn btn-sm btn-ghost", disabled: true }, [
          el("span", { text: "🔒" }),
          el("span", { text: "Opciones bloqueadas: ya fallaste" })
        ]);
      } else {
        var canReveal = !answered && !(needAttempt && !c.attempted);
        optBtn = el("button", {
          class: "btn btn-sm",
          disabled: !canReveal,
          title: needAttempt ? "Primero escribe y comprueba una respuesta" : "Revelar las cuatro opciones",
          onclick: function () { onRevealOptions(); }
        }, [el("span", { text: "🔢 Ver opciones" })]);
      }
      row.appendChild(optBtn);
    }

    row.appendChild(solBtn);
    row.appendChild(el("button", {
      class: "btn btn-sm btn-ghost",
      onclick: function () { onSkip(); }
    }, [el("span", { text: "⏭ Saltar" }), el("span", { class: "kbd", text: "N" })]));

    row.appendChild(el("button", {
      class: "btn btn-sm btn-ghost icon-btn tools-right",
      title: "Ajustes de modo y política",
      "aria-label": "Ajustes",
      "aria-expanded": state.ui.settingsOpen ? "true" : "false",
      onclick: function () { state.ui.settingsOpen = !state.ui.settingsOpen; render(); }
    }, "⚙"));

    return row;
  }

  function cardFeedback(c) {
    var f = c.feedback;
    var cls = f.ok ? "feedback gone" : (f.soft ? "feedback faded" : "feedback miss");
    var box = el("div", {
      class: cls,
      role: "status",
      "aria-live": "polite",
      // Lo que escribió el alumno viaja como atributo: aquí sí hay que
      // escaparlo a mano (el texto visible va por textContent).
      title: f.echo ? ("Has escrito: " + f.echo) : null
    }, [
      el("div", { class: "feedback-ico", text: f.ok ? "✓" : (f.soft ? "👁" : "✕") }),
      el("div", { class: "feedback-body" }, [
        el("div", { class: "feedback-title", text: f.title }),
        f.detail ? el("div", { class: "feedback-reason", text: f.detail }) : null,
        f.xp ? el("div", { class: "fb-xp" }, [el("span", { text: "+" + f.xp + " XP" })]) : null
      ])
    ]);
    return box;
  }

  /* --- Interrogatorio de método ---------------------------------------- */

  function cardQuiz(c) {
    var p = c.problem;
    var quiz = p.quiz;
    if (!quiz) return el("div");
    var card = el("div", { class: "card quiz" });

    card.appendChild(el("div", { class: "quiz-head" }, [
      chip("Interrogatorio", "accent2"),
      c.quizFailed ? chip("has fallado una vez", "err") : null
    ]));

    card.appendChild(el("div", { class: "quiz-q" }, [
      el("span", { text: quiz.question || "¿Qué técnica hay que aplicar?" }),
      p.method ? el("div", { class: "small", style: "margin-top:4px" }, [
        el("span", { class: "method-name", text: "Método: " + methodInfo(p.method).name })
      ]) : null
    ]));

    var opts = el("div", { class: "quiz-opts", role: "group", "aria-label": "Opciones de método" });
    var answers = quiz.options || [];
    for (var i = 0; i < answers.length; i++) {
      (function (idx, text) {
        var btn = el("button", {
          class: "qopt", type: "button",
          disabled: c.quizAnswered,
          onclick: function () { onAnswerQuiz(idx); }
        }, [
          el("span", { class: "opt-key", text: String.fromCharCode(65 + idx) }),
          el("span", { class: "opt-text", text: text })
        ]);
        if (c.quizAnswered) {
          if (idx === Number(quiz.correct)) btn.classList.add("correct");
          else if (idx === c.quizPick) btn.classList.add("wrong");
          else btn.classList.add("dimmed");
        }
        opts.appendChild(btn);
      })(i, textSafe(answers[i]));
    }
    card.appendChild(opts);

    if (c.quizAnswered) {
      if (c.quizFailed) {
        card.appendChild(el("div", { class: "explain" }, [
          el("b", { text: "Por qué: " }),
          el("span", { text: quiz.explain || "Revisa la solución paso a paso." })
        ]));
      } else if (c.quizRetried) {
        card.appendChild(el("div", { class: "explain" }, [
          el("b", { text: "Has acertado, pero a la segunda. " }),
          el("span", { text: "El método se anota como fallado: queda en el cuaderno." })
        ]));
      }
      var row = el("div", { class: "btn-row", style: "margin-top:14px" });
      // Nunca dejamos al alumno atascado: siempre hay salida.
      if (c.quizFailed) {
        row.appendChild(el("button", { class: "btn", onclick: function () { onRetryQuiz(); } }, "Reintentar método"));
        row.appendChild(el("button", {
          class: "btn btn-ghost",
          onclick: function () { c.solutionOpen = true; render(); }
        }, "Ver solución"));
      }
      row.appendChild(el("button", { class: "btn btn-ok", onclick: function () { onNext(); } }, "Siguiente problema →"));
      card.appendChild(row);
    }
    return card;
  }

  function textSafe(s) {
    var t = document.createElement("span");
    t.textContent = String(s === null || s === undefined ? "" : s);
    return t.textContent;
  }

  /* --- Solución --------------------------------------------------------- */

  function cardSolution(c) {
    var L = Lim();
    var p = c.problem;
    var card = el("div", { class: "card panel-solution" });
    card.appendChild(el("div", { class: "row row-wrap", style: "margin-bottom:6px" }, [
      el("div", { class: "grow" }, [
        el("div", { style: "font-weight:700", text: "Solución paso a paso" }),
        el("div", { class: "small muted", text: "Léela antes de volver a intentarlo." })
      ]),
      el("button", {
        class: "btn btn-sm btn-ghost",
        onclick: function () { c.solutionOpen = false; render(); }
      }, "Ocultar")
    ]));

    var host2 = el("div");
    var html = "";
    try {
      if (L && typeof L.solutionHtml === "function") html = L.solutionHtml(p);
    } catch (e) { html = ""; }

    if (html) {
      // El motor devuelve HTML de confianza; se parsea en un <template>
      // inerte (sin scripts) y NUNCA se asigna a un nodo vivo.
      var tpl = document.createElement("template");
      tpl.innerHTML = html;

      // Los huecos .mathslot[data-math] se rellenan con MathML de verdad.
      var slots = tpl.content.querySelectorAll(".mathslot[data-math]");
      for (var i = 0; i < slots.length; i++) {
        var idx = Number(slots[i].getAttribute("data-math"));
        var step = (p.steps || [])[idx];
        var real = step && step.math ? renderExpr(step.math) : el("span", { class: "muted", text: "—" });
        slots[i].parentNode.replaceChild(real, slots[i]);
      }

      // Si el motor ya pone su propio título, no lo repetimos arriba.
      dropDuplicateTitle(tpl.content);

      host2.appendChild(document.importNode(tpl.content, true));
    } else {
      host2.appendChild(solutionFallback(p));
    }

    // Garantizamos el resaltado del paso clave aunque el motor no lo haga.
    var key = num(p.keyStep, -1);
    var steps = host2.querySelectorAll(".step");
    var engineNumbers = false;
    for (var j = 0; j < steps.length; j++) {
      var raw = steps[j].getAttribute("data-step");
      var pos = raw === null || raw === undefined ? j : Number(raw);
      var isKey = (key >= 0) ? (pos === key) : steps[j].classList.contains("key");
      steps[j].classList.toggle("is-key", isKey);
      if (isKey && !steps[j].querySelector(".step-badge")) {
        var title = steps[j].querySelector(".step-t") || steps[j].querySelector(".step-title");
        if (title) title.appendChild(el("span", { class: "step-badge", text: "clave" }));
      }
      if (steps[j].querySelector(".step-n")) engineNumbers = true;
    }

    // Si el motor numera los pasos por su cuenta, quitamos nuestro contador
    // para no ver "1  1".
    if (engineNumbers) {
      var list = host2.querySelector(".sol-steps") || host2.querySelector(".steps") || host2;
      list.classList.add("engine-numbered");
    }

    card.appendChild(host2);

    // El motor escribe la respuesta en su formato crudo ("+inf", "dne"…):
    // la prettificamos para que se lea como el alumno la ve.
    var head = host2.querySelector(".sol-head strong");
    if (head) head.textContent = prettyAnswer(answerText(p.answer));

    return card;
  }

  // El HTML del motor puede traer su propio encabezado "Solución paso a paso".
  // Como el panel ya lo pone, lo quitamos (pero sólo si no lleva la respuesta).
  function dropDuplicateTitle(fragment) {
    var heads = fragment.querySelectorAll ? fragment.querySelectorAll(".sol-head") : [];
    for (var i = 0; i < heads.length; i++) {
      var t = (heads[i].textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!heads[i].querySelector("strong") && (t.indexOf("solución") >= 0 || t.indexOf("solucion") >= 0)) {
        if (heads[i].parentNode) heads[i].parentNode.removeChild(heads[i]);
      }
    }
  }

  // Red de seguridad si el motor no trae solutionHtml.
  function solutionFallback(p) {
    var box = el("div");
    var good = prettyAnswer(answerText(p.answer));
    box.appendChild(el("p", { class: "sol-head" }, [
      el("span", { text: "Respuesta correcta: " }),
      el("strong", { text: good })
    ]));
    var list = el("ol", { class: "sol-steps" });
    var steps = p.steps || [];
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      var li = el("li", {
        class: "step" + (i === p.keyStep ? " is-key" : ""),
        dataset: { step: String(i) }
      }, [
        el("div", { class: "step-t", text: s.title || ("Paso " + (i + 1)) }),
        s.detail ? el("div", { class: "step-d", text: s.detail }) : null,
        s.math ? el("div", { class: "step-m" }, renderExpr(s.math)) : null
      ]);
      if (i === p.keyStep) {
        var t = li.querySelector(".step-t");
        if (t) t.appendChild(el("span", { class: "step-badge", text: "clave" }));
      }
      list.appendChild(li);
    }
    box.appendChild(list);
    return box;
  }

  /* --- Fin de partida --------------------------------------------------- */

  function viewFinish() {
    var run = state.run;
    var card = el("div", { class: "card finish" });
    var passed = run.numOk >= num(run.required, 8) && run.metOk >= num(run.required, 8);
    var stars = starsFor(run.numOk, run.metOk, run.total);

    var starRow = el("div", { class: "finish-stars", "aria-label": plural(stars, "estrella", "estrellas") });
    for (var i = 0; i < 3; i++) {
      starRow.appendChild(el("span", {
        style: stars > i
          ? "color:var(--warn);text-shadow:0 0 14px rgba(255,180,84,.45)"
          : "filter:grayscale(1);opacity:.3",
        text: "★"
      }));
    }
    card.appendChild(starRow);

    card.appendChild(el("div", { class: "finish-title", text: passed ? "¡Nivel superado!" : "Partida terminada" }));
    card.appendChild(el("div", { class: "screen-sub", text: passed
      ? "Has superado el nivel. Se ha desbloqueado el siguiente."
      : "Te faltan " + num(run.required, 8) + " aciertos de número y " + num(run.required, 8) + " de método." }));

    card.appendChild(el("div", { class: "finish-score" }, [
      el("div", {}, [el("b", { text: run.numOk + "/" + run.total }), el("span", { text: "número" })]),
      el("div", {}, [el("b", { text: run.metOk + "/" + run.total }), el("span", { text: "método" })]),
      el("div", {}, [el("b", { text: "+" + run.xp }), el("span", { text: "XP ganados" })]),
      el("div", {}, [el("b", { text: "🔥" + state.stats.streak }), el("span", { text: "racha" })])
    ]));

    var rec = run.levelId ? state.campaign[run.levelId] : null;
    if (rec) {
      card.appendChild(el("div", { class: "small muted", style: "margin-bottom:4px", text: "Mejor marca del nivel: " + rec.best.num + "/10 en número y " + rec.best.met + "/10 en método." }));
    }

    var nextLevel = run.levelId ? nextLevelId(run.levelId) : null;
    var actions = el("div", { class: "hero-actions", style: "margin-top:18px" });
    if (nextLevel && !run.free && passed) {
      actions.appendChild(el("button", {
        class: "btn btn-primary",
        onclick: function () { state.picker = null; startRun({ levelId: nextLevel, free: false }); }
      }, "Siguiente nivel →"));
    }
    actions.appendChild(el("button", {
      class: "btn",
      onclick: function () { state.picker = null; startRun({ levelId: run.levelId, free: run.free }); }
    }, "Repetir"));
    if (state.notebook.length) {
      actions.appendChild(el("button", {
        class: "btn btn-ghost",
        onclick: function () { state.picker = null; startNotebookRun(); }
      }, "Practicar el cuaderno"));
    }
    actions.appendChild(el("button", {
      class: "btn btn-ghost",
      onclick: function () { state.picker = null; go(run.levelId ? "campana" : "portada"); }
    }, "Salir"));
    card.appendChild(actions);
    return card;
  }

  function nextLevelId(id) {
    var list = levels();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id && i + 1 < list.length) return list[i + 1].id;
    }
    return null;
  }

  /* =======================================================================
   * 12. Pantalla: CUADERNO
   * ===================================================================== */

  function viewCuaderno() {
    var wrap = el("div");
    var nb = state.notebook;

    wrap.appendChild(el("div", { class: "screen-head" }, [
      el("h1", { class: "screen-title", text: "Cuaderno de errores" }),
      el("p", { class: "screen-sub", text: "Todo lo que has fallado, saltado o resuelto con ayuda. Cada 5 problemas vuelve a salir uno de aquí." })
    ]));

    var metodo = nb.filter(function (e) { return e.howClosed === "fallo de método"; }).length;
    wrap.appendChild(el("div", { class: "nb-summary" }, [
      statCell(nb.length, "en cuaderno"),
      statCell(metodo, "de método"),
      statCell(state.stats.correct, "aciertos"),
      statCell(state.stats.xp, "XP")
    ]));

    if (!nb.length) {
      wrap.appendChild(el("div", { class: "card" }, [
        el("div", { class: "empty" }, [
          el("div", { class: "empty-mark", text: "✓" }),
          el("div", { class: "empty-title", text: "Cuaderno limpio" }),
          el("div", { class: "small", text: "Aquí aparecerán los ejercicios que falles, los que saltes y los que resuelvas con ayuda." }),
          el("div", { style: "margin-top:14px" }, [
            el("button", { class: "btn btn-primary", onclick: function () { go("campana"); } }, "Ir a practicar")
          ])
        ])
      ]));
      return wrap;
    }

    wrap.appendChild(el("div", { class: "btn-row", style: "margin-bottom:14px" }, [
      el("button", { class: "btn btn-primary", onclick: function () { startNotebookRun(); } },
        "Practicar solo estos (" + nb.length + ")"),
      el("button", { class: "btn", onclick: function () { startRandomNotebook(); } }, "Resolver uno al azar")
    ]));

    var groups = notebookByTopic();
    for (var g = 0; g < groups.length; g++) {
      var group = groups[g];
      var sec = el("div", { class: "nb-group" });
      sec.appendChild(el("div", { class: "nb-group-head" }, [
        el("span", {
          class: "chip chip-topic", dataset: { topic: group.topic.id }, text: group.topic.name
        }),
        el("span", { class: "small faint", text: plural(group.items.length, "caso", "casos") })
      ]));
      var list = el("div", { class: "nb-list" });
      for (var i = 0; i < group.items.length; i++) list.appendChild(nbItem(group.items[i]));
      sec.appendChild(list);
      wrap.appendChild(sec);
    }
    return wrap;
  }

  function nbItem(item) {
    var e = item.entry;
    var g = item.gen;
    var title = g ? (g.title || g.id) : e.generatorId;
    var tid = g ? g.topic : "sustitucion";
    return el("div", { class: "nb-item" }, [
      el("div", { class: "nb-top" }, [
        el("span", { class: "chip chip-topic", dataset: { topic: tid }, text: shortTopic(tid) }),
        el("span", {
          class: "chip " + (CLASE_HOW[e.howClosed] || "how-fallo"),
          text: ETIQUETA_HOW[e.howClosed] || "fallo"
        })
      ]),
      el("div", { class: "nb-info" }, [
        el("div", { class: "nb-title", text: title }),
        el("div", { class: "nb-meta" }, [
          el("span", { text: plural(e.attempts, "intento", "intentos") }),
          el("span", { text: timeAgo(e.lastTs) }),
          el("span", { class: "mono faint", text: "semilla " + e.seed })
        ])
      ])
    ]);
  }

  var TOPIC_CORTO = {
    sustitucion: "Sustitución",
    infinito: "Infinito",
    indeterminacion: "Indeterminación",
    continuidad: "Continuidad"
  };

  function shortTopic(topicId) {
    if (TOPIC_CORTO[topicId]) return TOPIC_CORTO[topicId];
    var t = topicById(topicId);
    return t ? t.name : (topicId || "—");
  }

  /* =======================================================================
   * 13. Pantalla: TEORÍA
   * ===================================================================== */

  function viewTeoria() {
    var wrap = el("div");
    wrap.appendChild(el("div", { class: "screen-head" }, [
      el("h1", { class: "screen-title", text: "Teoría" }),
      el("p", { class: "screen-sub", text: "Chuleta de 2º de Bachillerato: todo lo que hace falta para los niveles de este juego." })
    ]));

    var layout = el("div", { class: "theory" });
    var toc = el("nav", { class: "toc", "aria-label": "Índice de la teoría" });
    toc.appendChild(el("div", { class: "toc-title", text: "Índice" }));
    var tocList = el("div", { class: "toc-list" });
    var body = el("div", { class: "theory-body" });

    var secs = TEORIA;
    for (var i = 0; i < secs.length; i++) {
      var id = "th-" + i;
      (function (sid, label) {
        var a = el("a", { href: "#" + sid, text: label, onclick: function (ev) {
          ev.preventDefault();
          var t = document.getElementById(sid);
          if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
        } });
        tocList.appendChild(el("div", {}, a));
      })(id, secs[i].title);

      var sec = el("section", { class: "theory-sec", id: id });
      sec.appendChild(el("h2", {}, [
        el("span", { class: "mono", style: "color:var(--accent)", text: String(i + 1).padStart(2, "0") }),
        el("span", { text: secs[i].title })
      ]));
      append(sec, secs[i].build());
      body.appendChild(sec);
    }

    toc.appendChild(tocList);
    layout.appendChild(toc);
    layout.appendChild(body);
    wrap.appendChild(layout);
    return wrap;
  }

  /* --- Contenido de teoría (MathML construido a mano) ------------------- */

  function P(txt) { return el("p", { text: txt }); }
  function Pb(a, b) {
    var p = el("p");
    p.appendChild(el("b", { text: a }));
    p.appendChild(document.createTextNode(b));
    return p;
  }
  function UL(items) {
    var ul = el("ul");
    for (var i = 0; i < items.length; i++) {
      ul.appendChild(el("li", { text: items[i] }));
    }
    return ul;
  }
  function OL(items) {
    var ol = el("ol");
    for (var i = 0; i < items.length; i++) ol.appendChild(el("li", { text: items[i] }));
    return ol;
  }
  function H3(txt) { return el("h3", { text: txt }); }
  function CALLOUT(txt, variant) { return el("div", { class: "callout" + (variant ? " callout-" + variant : ""), text: txt }); }

  // Una fórmula MathML SIEMPRE necesita su raíz <math> para que el navegador
  // la pinte. Todo lo que compone la teoría pasa por aquí.
  function F(children) {
    var box = el("div", { class: "formula" });
    box.appendChild(m("math", null, children));
    return box;
  }

  function mn(v) { return m("mn", { text: String(v) }); }
  function mi(v) { return m("mi", { text: String(v) }); }
  function mo(v) { return m("mo", { text: String(v) }); }
  function par(children) { return m("mrow", null, [mo("(")].concat(children).concat([mo(")")])); }
  function msup(base, sup) { return m("msup", null, [base, sup]); }
  function mfrac(a, b) { return m("mfrac", null, [a, b]); }
  function limTo(target, body) {
    var kids = [m("munder", null, [mo("lim"), target]), m("mspace", { width: "0.5em" })];
    if (body) kids.push(body);
    return m("mrow", null, kids);
  }

  var TEORIA = [
    {
      title: "Qué es un límite",
      build: function () {
        return [
          Pb("La idea intuitiva: ", "la función se va acercando a un número sin llegar nunca a valerlo. Decimos que f tiene límite L en x = a cuando, cuanto más nos acercamos a a, más se parece f(x) a L."),
          F([limTo(m("mrow", null, [mi("x"), mo("→"), mn(2)]), mi("f")), mo("="), mi("L")]),
          UL([
            "L puede ser un número real cualquiera: 0, 3, −7, 1/2.",
            "L puede ser +∞ o −∞: entonces el límite es infinito y no hay un número al que acercarse.",
            "Si los dos lados no coinciden, el límite no existe (DNE)."
          ]),
          CALLOUT("Ojo: x → 2 NO significa x = 2. Es «acercarse a 2». Cuando dentro de una fracción hay una raíz cuadrada o un logaritmo, ese es justamente el motivo por el que aparecerán las indeterminaciones.", "warn")
        ];
      }
    },
    {
      title: "Límites laterales",
      build: function () {
        return [
          P("Cuando no se puede resolver de un golpe, se mira por los dos lados: por la izquierda y por la derecha. Solo existe el límite si los dos coinciden."),
          F([
            limTo(m("mrow", null, [mi("x"), mo("→"), msup(mn(2), mo("−"))]), mi("f")),
            mo("="),
            limTo(m("mrow", null, [mi("x"), mo("→"), msup(mn(2), mo("+"))]), mi("f"))
          ]),
          Pb("Si la izquierda da un valor y la derecha otro, ", "el límite no existe. Si dan el mismo, ese es el límite."),
          el("div", { class: "callout callout-warn" }, [
            el("b", { text: "El paso clave: " }),
            el("span", { text: "el resultado de un límite lateral no es un «valor más pequeño»: es el valor al que se acerca la función por ese lado concreto. Por eso el signo importa." })
          ])
        ];
      }
    },
    {
      title: "Álgebra del infinito",
      build: function () {
        var rows = [
          [[mi("a"), mo("+"), mi("b"), mo("="), mi("a"), mo("+"), mi("b")], "Con números normales y los mismos signos"],
          [[mo("+∞"), mo("+"), mo("+∞"), mo("="), mo("+∞")], "Se suman infinitos del mismo signo"],
          [[mo("−∞"), mo("+"), mo("−∞"), mo("="), mo("−∞")], "Igual si los dos son negativos"],
          [[mo("+∞"), mo("+"), mo("−∞"), mo("="), mtext("indeterminado")], "∞ + (−∞) NO se puede decidir"],
          [[mo("+∞"), mo("·"), mi("b"), mo("="), mo("+∞")], "Si b > 0"],
          [[mo("−∞"), mo("·"), mi("b"), mo("="), mo("−∞")], "Si b < 0 el signo se invierte"],
          [[mo("+∞"), mo("·"), mi("b"), mo("="), mtext("indeterminado")], "Si b = 0 sale la forma 0·∞"],
          [[mi("a"), mo("/"), mi("b"), mo("="), mn(0)], "Si a es finito y b → ∞"],
          [[mi("a"), mo("/"), mi("b"), mo("="), mtext("indeterminado")], "Si los dos son infinitos"]
        ];
        var table = simpleTable(
          ["Operación", "Resultado"],
          rows.map(function (r) { return [F(r[0]), r[1]]; })
        );
        return [
          P("Con valores infinitos se puede operar como con números, pero hay cuatro casos en los que la operación no tiene sentido. Son las indeterminaciones."),
          table,
          CALLOUT("∞ no es un número: es una flecha. «∞ − ∞» no vale cero, como algunas veces parece: depende de qué Crece más deprisa.")
        ];
      }
    },
    {
      title: "Jerarquía de crecimiento",
      build: function () {
        return [
          P("Cuando en un cociente o en una resta hay varias potencias, hay que saber cuál de ellas manda. Para eso está esta jerarquía, de más rápida a más lenta:"),
          el("div", { class: "formula formula-text" }, [
            el("span", { text: "exponencial" }), mo(">"),
            el("span", { text: "polinómica" }), mo(">"),
            el("span", { text: "logarítmica" }), mo(">"),
            el("span", { text: "constante" })
          ]),
          H3("Traducción al cálculo de límites"),
          F([limTo(m("mrow", null, [mi("x"), mo("→"), mo("+∞")]), msup(mi("e"), mi("x"))), mo("="), mo("+∞")]),
          F([limTo(m("mrow", null, [mi("x"), mo("→"), mo("+∞")]), msup(mi("x"), mn(3))), mo("="), mo("+∞")]),
          F([limTo(m("mrow", null, [mi("x"), mo("→"), mo("+∞")]), mi("ln"), par([mi("x")])), mo("="), mo("+∞")]),
          F([limTo(m("mrow", null, [mi("x"), mo("→"), mo("+∞")]), mn(7)), mo("="), mn(7)]),
          UL([
            "Dos exponenciales: gana la de base mayor (y si las bases son iguales, la de exponente mayor).",
            "Exponencial contra polinomio: gana siempre la exponencial.",
            "Contra un polinomio: gana el término de mayor grado.",
            "En una resta, gana el término que más crece (se restan y el que domina decide el signo)."
          ]),
          CALLOUT("La regla práctica para 2º: si hay e^x, x^n o ln x, no dividas por la mayor potencia de x a ciegas. Mira primero la jerarquía.", "ok")
        ];
      }
    },
    {
      title: "Las 7 indeterminaciones",
      build: function () {
        var rows = [
          [[mo("∞"), mo("/"), mo("∞")], "Comparar grados", "Se divide numerador y denominador entre x elevado al mayor grado. Si los grados difieren, manda el mayor; si son iguales, es el cociente de los coeficientes principales."],
          [[mn(0), mo("/"), mn(0)], "Factorizar y cancelar", "Se factorizan numerador y denominador, se saca el factor (x − a) común y se simplifica antes de sustituir."],
          [[mo("∞"), mo("−"), mo("∞")], "Común denominador y término dominante", "No se restan los infinitos: se escribe todo con un mismo denominador y se comparan los grados de los dos polinomios."],
          [[mn(0), mo("·"), mo("∞")], "Transformar", "Se pasa a cociente dividiendo y dividiendo: 0·∞ = 0/(1/∞). El resultado es un 0/0 o un ∞/∞."],
          [[mo("∞"), msup(mn(0), mtext("b"))], "Cambio de base", "Se escribe la potencia como e elevado al logaritmo: a^b = e^(b·ln a). Se acaba en 0·∞ o en ∞/∞."],
          [[mn(0), msup(mn(0), mtext("b"))], "Límites notables", "Se usa la fórmula de la e, porque todo 0^0 es en realidad una forma 1^∞."],
          [[mn(1), msup(mo("∞"), mtext("b"))], "Fórmula del número e", "Se aplica lim f(x)^g(x) = e^(lim g(x)·(f(x) − 1)) cuando f → 1 y g → ∞."]
        ];
        var table = el("div", { class: "table-wrap" });
        var t = el("table", { class: "table" });
        t.appendChild(el("thead", {}, el("tr", {}, [
          el("th", { text: "Indeterminación" }),
          el("th", { text: "Técnica" }),
          el("th", { text: "En qué consiste" })
        ])));
        var tb = el("tbody");
        for (var i = 0; i < rows.length; i++) {
          (function (r) {
            var td = el("td", { class: "t-math" });
            td.appendChild(F(r[0]));
            tb.appendChild(el("tr", {}, [td, el("td", {}, el("b", { text: r[1] })), el("td", { text: r[2] })]));
          })(rows[i]);
        }
        t.appendChild(tb);
        table.appendChild(t);

        return [
          P("Son las siete situaciones en las que los símbolos ∞ y 0 no se pueden operar como si fueran números. Cada una tiene su técnica."),
          table,
          H3("La fórmula del número e (para 1^∞)"),
          Pb("Si f(x) → 1 y g(x) → ∞, entonces ", "el límite de f(x)^g(x) se resuelve así:"),
          F([
            limTo(m("mrow", null, [mi("x")]),
              msup(par([mi("f"), par([mi("x")])]),
                par([mi("g"), par([mi("x")])]))),
            mo("="),
            msup(mi("e"),
              limTo(m("mrow", null, [mi("x")]),
                par([mi("g"), par([mi("x")]), mo("·"), par([mi("f"), par([mi("x")]), mo("−"), mn(1)])])) )
          ]),
          Pb("Ejemplo típico: ", "lim (1 + 1/x)^x = e. En efecto, lim x·(1 + 1/x − 1) = lim 1 = 1, así que el resultado es e^1 = e."),
          CALLOUT("Truco para recordar cuál es cuál: 1^∞, ∞^0 y 0^0 son las tres que necesitan cambio de base o la fórmula de la e. Las otras cuatro (∞/∞, 0/0, ∞−∞, 0·∞) se resuelven algebraizando.", "ok")
        ];
      }
    },
    {
      title: "Continuidad",
      build: function () {
        return [
          Pb("Una función f es continua en un punto a ", "si se cumplen LAS TRES condiciones:"),
          OL([
            "f está definida en a (existe f(a)).",
            "El límite de f en a existe (los dos laterales coinciden).",
            "Ese límite vale lo mismo que f(a)."
          ]),
          F([mo("f"), mo("("), mi("a"), mo(")"), mo("="), limTo(m("mrow", null, [mi("x"), mo("→"), mi("a")]), mi("f"))]),
          H3("Continuidad lateral y en intervalo"),
          UL([
            "Continuidad por la izquierda: el límite por la izquierda existe y coincide con f(a).",
            "Continuidad por la derecha: igual, pero por la derecha.",
            "En un intervalo [a, b]: f es continua si lo es en todos los puntos de (a, b) y los límites en los extremos coinciden con f(a) y f(b)."
          ]),
          CALLOUT("Las funciones racionales (cociente de polinomios) son continuas en todos los puntos salvo en las raíces del denominador. Ahí es donde puede aparecer la discontinuidad.")
        ];
      }
    },
    {
      title: "Tipos de discontinuidad",
      build: function () {
        var rows = [
          ["Evitable", "Quitable", "El límite existe pero no coincide con f(a).", "f(a) se define con un valor distinto del límite.", "Se arregla redefiniendo f(a) con el valor del límite."],
          ["1ª especie", "Salto finito", "Los dos laterales existen pero son distintos.", "f(1⁻) = 2 y f(1⁺) = 5, así que el límite no existe.", "Se ve un salto en la gráfica. No se puede arreglar con una redefinición."],
          ["1ª especie", "Salto infinito", "Un lateral se va a +∞ y el otro a −∞.", "La función tiene asíntota vertical en ese punto.", "La gráfica se dispara hacia arriba por un lado y hacia abajo por el otro."],
          ["2ª especie", "Discontinuidad esencial", "Al menos uno de los laterales no existe.", "Ejemplo: f(x) = sen(1/x) en x = 0.", "La gráfica oscila sin patrón. No se puede arreglar."]
        ];
        var table = el("div", { class: "table-wrap" });
        var t = el("table", { class: "table" });
        t.appendChild(el("thead", {}, el("tr", {}, [
          el("th", { text: "Tipo" }), el("th", { text: "Nombre" }),
          el("th", { text: "Qué pasa" }), el("th", { text: "Ejemplo típico" }), el("th", { text: "Se arregla" })
        ])));
        var tb = el("tbody");
        for (var i = 0; i < rows.length; i++) {
          (function (r) {
            tb.appendChild(el("tr", {}, [
              el("td", {}, el("span", { class: "chip chip-accent2", text: r[0] })),
              el("td", {}, el("b", { text: r[1] })),
              el("td", { text: r[2] }),
              el("td", { class: "mono small", text: r[3] }),
              el("td", { text: r[4] })
            ]));
          })(rows[i]);
        }
        t.appendChild(tb);
        table.appendChild(t);
        return [
          P("Cuando f no es continua en a, la discontinuidad se clasifica en cuatro tipos. El que más se pregunta es la evitable."),
          table,
          Pb("Truco para identificarla: ", "mira primero si el límite existe. Si existe y solo falla el valor de f(a), es evitable. Si el límite no existe, mira si los laterales coinciden entre sí (salto) o si alguno se va a infinito (salto infinito u oscilación).")
        ];
      }
    },
    {
      title: "Límites notables",
      build: function () {
        return [
          Pb("Son tres resultados que se saben de memoria y que se ", "usan tal cual para resolver otras cosas."),
          H3("1 · El seno cardinal"),
          F([limTo(m("mrow", null, [mi("x"), mo("→"), mn(0)]), mfrac(par([mo("sen"), mi("x")]), mi("x"))), mo("="), mn(1)]),
          Pb("Sirve, por ejemplo, para ", "lim (1 − cos x)/x² = 1/2, porque 1 − cos x = 2·sen²(x/2)."),
          H3("2 · El número e"),
          F([limTo(m("mrow", null, [mi("n"), mo("→"), mo("+∞")]), msup(par([mn(1), mo("+"), mfrac(mn(1), mi("n"))]), mi("n"))), mo("="), mi("e")]),
          Pb("Se usa también con ", "x real: lim (1 + 1/x)^x = e cuando x → +∞ o x → −∞."),
          H3("3 · El logaritmo"),
          F([limTo(m("mrow", null, [mi("x"), mo("→"), mn(0)]), mfrac(par([mo("ln"), par([mn(1), mo("+"), mi("x")])]), mi("x"))), mo("="), mn(1)]),
          CALLOUT("Todos salen de la fórmula de la e. Si te la sabes de memoria, los tres se derivan en dos líneas.", "ok")
        ];
      }
    },
    {
      title: "Asíntotas",
      build: function () {
        var rows = [
          ["Vertical", "x = a", "Donde f(a) no está definida o donde el cociente se va a infinito.", "lim en los laterales = +∞ o −∞", "No se puede escribir f(x) para x = a. Ej.: 1/(x − 3) → asíntota x = 3."],
          ["Horizontal", "y = k", "En el infinito, si el límite es un número finito k.", "lim en +∞ o en −∞ = k", "La función se «pega» a la recta y = k. Ej.: (x²+1)/x en +∞ → y = ∞ (no hay asíntota horizontal)."],
          ["Oblíqua", "y = mx + k", "Cuando en el infinito el cociente crece como una recta.", "lim (f − mx) = k", "Rare en 2º de Bachillerato, pero sirve para los grados 3 y 4."]
        ];
        var table = el("div", { class: "table-wrap" });
        var t = el("table", { class: "table" });
        t.appendChild(el("thead", {}, el("tr", {}, [
          el("th", { text: "Tipo" }), el("th", { text: "Ecuación" }), el("th", { text: "Cómo se detecta" }),
          el("th", { text: "Cómo se calcula" }), el("th", { text: "Ejemplo" })
        ])));
        var tb = el("tbody");
        for (var i = 0; i < rows.length; i++) {
          (function (r) {
            tb.appendChild(el("tr", {}, [
              el("td", {}, el("b", { text: r[0] })),
              el("td", { class: "t-math", text: r[1] }),
              el("td", { text: r[2] }), el("td", { class: "mono small", text: r[3] }),
              el("td", { class: "small", text: r[4] })
            ]));
          })(rows[i]);
        }
        t.appendChild(tb);
        table.appendChild(t);
        return [
          P("Una asíntota es una recta a la que la gráfica se acerca pero a la que nunca llega."),
          table,
          Pb("Atajo para el infinito: ", "si el cociente tiene el mismo grado en numerador y denominador, la asíntota horizontal es y = cociente de los coeficientes principales. Si el grado del numerador es una unidad mayor, la asíntota es oblicua. Si es menor, no hay asíntota (el límite es 0).")
        ];
      }
    }
  ];

  function mtext(v) { return m("mtext", { text: String(v) }); }
  function simpleTable(headers, rows) {
    var wrap = el("div", { class: "table-wrap" });
    var t = el("table", { class: "table" });
    t.appendChild(el("thead", {}, el("tr", {}, headers.map(function (h) { return el("th", { text: h }); }))));
    var tb = el("tbody");
    for (var i = 0; i < rows.length; i++) {
      tb.appendChild(el("tr", {}, [el("td", {}, rows[i][0]), el("td", { text: rows[i][1] })]));
    }
    t.appendChild(tb);
    wrap.appendChild(t);
    return wrap;
  }

  /* =======================================================================
   * 14. Ajustes (modo + política)
   * ===================================================================== */

  var DESCR_MODO = {
    escribir: "Solo escribes la respuesta",
    opciones: "Solo eliges entre 4",
    mixto: "Alterna al azar"
  };

  var DESCR_POLITICA = {
    visible: "Siempre a la vista",
    boton: "A pedido",
    examen: "Tras un intento"
  };

  function settingsCard() {
    var card = el("div", { class: "card settings", style: "margin-top:12px" });
    card.appendChild(el("h3", { text: "Cómo respondo — modo" }));
    card.appendChild(seg(
      MODOS,
      state.settings.modo,
      DESCR_MODO,
      function (v) { state.settings.modo = v; save(); render(); }
    ));

    card.appendChild(el("h3", { text: "Cuándo veo las opciones — política", style: "margin-top:16px" }));
    card.appendChild(seg(
      POLITICAS,
      state.settings.politica,
      DESCR_POLITICA,
      function (v) { state.settings.politica = v; save(); render(); }
    ));

    card.appendChild(settingsNote());
    return card;
  }

  function settingsNote() {
    var modo = state.settings.modo, pol = state.settings.politica;
    var txt;
    if (modo === "escribir") {
      txt = pol === "visible"
        ? "Escribes siempre. Las opciones no se pintan en absoluto."
        : pol === "boton"
          ? "Escribes siempre, pero puedes pedir las cuatro opciones como pista. Si aciertas con ellas, el problema cuenta como «ayudado» y rompe la racha."
          : "Escribes siempre. El botón de opciones y el de solución están bloqueados hasta que compruebes un intento.";
    } else if (modo === "opciones") {
      txt = pol === "visible"
        ? "Siempre eliges entre las cuatro opciones."
        : pol === "boton"
          ? "Las cuatro opciones aparecen cuando pulses «Ver opciones», y se quedan."
          : "Primero escribes y compruebas. Si fallas, las opciones se bloquean para siempre en ese problema.";
    } else {
      txt = "Cada problema elige al azar entre escribir y elegir. La política se aplica al tipo que toque en ese problema.";
    }
    return el("div", { class: "settings-note", text: txt });
  }

  function seg(values, active, descriptions, onPick) {
    var box = el("div", { class: "seg", role: "group" });
    for (var i = 0; i < values.length; i++) {
      (function (v) {
        var on = v === active;
        var btn = el("button", {
          class: "seg-btn" + (on ? " on" : ""),
          type: "button",
          "aria-pressed": on ? "true" : "false",
          onclick: function () { onPick(v); }
        }, [
          el("span", { text: v }),
          descriptions[v] ? el("small", { text: descriptions[v] }) : null
        ]);
        box.appendChild(btn);
      })(values[i]);
    }
    return box;
  }

  /* =======================================================================
   * 15. Ciclo de juego
   * ===================================================================== */

  function startRun(opts) {
    opts = opts || {};
    var lvl = opts.levelId ? levelById(opts.levelId) : null;
    state.picker = null;
    state.current = null;
    state.run = {
      levelId: opts.levelId || null,
      free: !!opts.free,
      title: lvl ? ("Nivel " + lvl.n + " · " + lvl.name) : "Práctica libre",
      total: num(lvl && lvl.total, 10),
      required: num(lvl && lvl.required, 8),
      index: 0,
      numOk: 0,
      metOk: 0,
      xp: 0,
      seeds: [],
      generators: lvl && lvl.generators ? lvl.generators.slice() : null,
      reinjectIn: REINJECT_CADA,
      finished: false,
      lastHow: null
    };
    state.screen = "juego";
    save();
    generateNext();
  }

  function startNotebookRun(oneShot) {
    state.picker = null;
    state.current = null;
    var pool = state.notebook.slice().sort(function (a, b) { return b.lastTs - a.lastTs; });
    var seeds = pool.map(function (e) { return { seed: e.seed, generatorId: e.generatorId }; });
    if (oneShot) seeds = [seeds[Math.floor(Math.random() * seeds.length)]];
    var gens = {};
    for (var i = 0; i < seeds.length; i++) gens[seeds[i].generatorId] = true;
    state.run = {
      levelId: null,
      free: true,
      title: oneShot ? "Un fallo al azar" : "Cuaderno de errores",
      total: seeds.length,
      required: 0,
      index: 0,
      numOk: 0,
      metOk: 0,
      xp: 0,
      seeds: seeds,
      generators: Object.keys(gens),
      reinjectIn: REINJECT_CADA - 1,
      finished: false,
      notebookMode: true,
      lastHow: null
    };
    state.screen = "juego";
    generateNext();
  }

  function startRandomNotebook() {
    if (!state.notebook.length) return;
    startNotebookRun(true);
  }

  /* --- Generación del siguiente problema -------------------------------- */

  // Llama a Lim.generate sin dejar que una excepción rompa la partida.
  function safeGenerate(L, opts) {
    try {
      var p = L.generate(opts);
      return (p && p.statement && p.answer) ? p : null;
    } catch (e) {
      return null;
    }
  }

  // Un solo render() reconstruye la pantalla. Esta función pide el siguiente
  // problema: del cuaderno (si toca), o nuevo del nivel.
  function generateNext(silent) {
    var run = state.run;
    if (!run) return null;
    var L = Lim();
    if (!L || typeof L.generate !== "function") return null;

    var baseOpts = run.generators && run.generators.length ? { generatorIds: run.generators } : {};
    var problem = null;
    var isReview = false;

    // 1) Cola del cuaderno (botón "Practicar solo estos")
    var queued = run.seeds && run.seeds.length ? run.seeds.shift() : null;
    if (queued) {
      problem = safeGenerate(L, { seed: queued.seed, generatorIds: [queued.generatorId] })
        || safeGenerate(L, { seed: queued.seed });
      isReview = !!problem;
    }

    // 2) Reinyección automática: de cada 5 problemas, uno sale del cuaderno.
    //    El contador se reinicia al cambiar de nivel (lo hace startRun).
    if (!problem && state.notebook.length > 0 && run.reinjectIn <= 0 && !run.notebookMode) {
      var entry = state.notebook[Math.floor(Math.random() * state.notebook.length)];
      problem = safeGenerate(L, { seed: entry.seed, generatorIds: [entry.generatorId] })
        || safeGenerate(L, { seed: entry.seed });
      isReview = !!problem;
      run.reinjectIn = REINJECT_CADA - 1;
    }

    // 3) Problema nuevo del nivel
    if (!problem) {
      problem = safeGenerate(L, baseOpts);
      if (run.reinjectIn > 0) run.reinjectIn--;
    }

    if (!problem) {
      // Sin problema que mostrar: en modo cuaderno la partida se da por
      // terminada; en campaña seguimos con la pantalla de resumen.
      run.finished = true;
      state.current = null;
      if (!silent) render();
      return null;
    }

    state.current = {
      problem: problem,
      runTitle: run.levelId ? ("N" + num(levelById(run.levelId) && levelById(run.levelId).n, 1)) : "libre",
      kind: resolveKind(problem),
      policy: state.settings.politica,
      options: optionList(problem),
      optionsShown: false,
      optionsLocked: false,
      input: "",
      picked: null,
      pickedOk: false,
      attempted: false,
      feedback: null,
      phase: "answer",
      quizPick: null,
      quizAnswered: false,
      quizFailed: false,
      quizRetried: false,
      methodOk: false,
      solutionOpen: false,
      counted: false,
      closed: false,
      isReview: isReview
    };

    // Política "visible": las opciones se pintan al cargar el problema.
    // En modo "escribir" NO se pintan nunca de forma automática (matriz del
    // enunciado): solo si el alumno pulsa "Ver opciones".
    if (state.current.policy === "visible" && state.current.kind === "opciones") {
      state.current.optionsShown = true;
    }

    state.ui.settingsOpen = false;
    if (!silent) render();
    focusField();
    return problem;
  }

  // modo "mixto": alterna al azar, pero de forma estable para una misma semilla.
  function resolveKind(problem) {
    var modo = state.settings.modo;
    if (modo !== "mixto") return modo;
    var L = Lim();
    var r = 0.5;
    if (L && typeof L.rng === "function") {
      try {
        var f = L.rng((Number(problem.seed) >>> 0) ^ 0x2f19);
        r = f();
      } catch (e) { r = 0.5; }
    } else {
      r = Math.random();
    }
    return r < 0.5 ? "escribir" : "opciones";
  }

  function focusField() {
    if (state.screen !== "juego") return;
    setTimeout(function () {
      var f = document.getElementById("answer-field");
      if (f && !f.disabled && f.offsetParent !== null) {
        try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); }
      }
    }, 30);
  }

  /* --- Comprobar el número --------------------------------------------- */

  function onCheck() {
    var c = state.current;
    if (!c || c.phase !== "answer") return;
    var raw = (c.input || "").trim();
    if (!raw) return;

    var L = Lim();
    if (!L || typeof L.checkAnswer !== "function") return;
    var res;
    try { res = L.checkAnswer(c.problem, raw); }
    catch (e) { res = { correct: false, normalized: raw, reason: "No entiendo esa respuesta" }; }

    c.attempted = true;

    if (res && res.correct) {
      state.stats.xp += XP_NUMERO;
      state.run.xp += XP_NUMERO;
      c.feedback = {
        ok: true,
        title: "¡Correcto!",
        detail: "Has acertado el valor del límite.",
        xp: XP_NUMERO
      };
      c.phase = "quiz";
      save();
      render();
      focusField();
      return;
    }

    // Fallo: racha a 0 y anotación inmediata en el cuaderno.
    state.stats.streak = 0;
    notebookUpsert(c.problem, "fallo");
    save();
    c.feedback = {
      ok: false,
      title: "No es correcto",
      detail: (res && res.reason) ? res.reason
        : ("Entendí «" + String(res && res.normalized ? res.normalized : raw) + "» como respuesta. Inténtalo otra vez o mira la solución."),
      echo: esc(raw)
    };
    if (c.policy === "examen") {
      c.optionsLocked = true;
      c.optionsShown = false;
    }
    render();
    focusField();
  }

  function onPickOption(idx) {
    var c = state.current;
    if (!c || c.phase !== "answer" || !c.optionsShown || c.optionsLocked) return;
    var text = (c.options || [])[idx];
    if (text === undefined) return;

    var L = Lim();
    if (!L || typeof L.checkAnswer !== "function") return;
    var res;
    try { res = L.checkAnswer(c.problem, text); }
    catch (e) { res = { correct: false }; }

    c.input = String(text);
    c.picked = idx;
    c.pickedOk = !!(res && res.correct);
    c.attempted = true;
    c.usedOptions = true;          // usado para el cierre "ayudado"

    if (c.pickedOk) {
      state.stats.xp += XP_NUMERO;
      state.run.xp += XP_NUMERO;
      c.feedback = { ok: true, title: "¡Correcto!", detail: "Has acertado el valor del límite.", xp: XP_NUMERO };
      c.phase = "quiz";
      save();
      render();
      return;
    }

    state.stats.streak = 0;
    notebookUpsert(c.problem, "fallo");
    save();
    c.feedback = {
      ok: false,
      title: "Esa opción no es",
      detail: (res && res.reason) ? res.reason : "Vuelve a intentarlo o mira la solución."
    };
    render();
  }

  function onRevealOptions() {
    var c = state.current;
    if (!c || c.optionsShown || c.optionsLocked) return;
    if (c.policy === "examen" && !c.attempted) return;
    c.optionsShown = true;
    render();
  }

  function onShowSolution() {
    var c = state.current;
    if (!c) return;
    if (c.policy === "examen" && !c.attempted) return;
    if (c.phase === "answer") closeProblem("visto solución");
    c.solutionOpen = true;
    render();
  }

  function onSkip() {
    var c = state.current;
    if (!c) return;
    closeProblem("saltado");
    advance();
  }

  /* --- Interrogatorio de método ---------------------------------------- */

  function onAnswerQuiz(idx) {
    var c = state.current;
    if (!c || c.quizAnswered) return;
    var L = Lim();
    var ok = false;
    try { ok = !!L.checkQuiz(c.problem, idx); }
    catch (e) { ok = false; }

    c.quizPick = idx;
    c.quizAnswered = true;

    if (ok) {
      if (!c.quizRetried) {
        state.stats.xp += XP_METODO;
        state.run.xp += XP_METODO;
        c.feedback = {
          ok: true,
          title: "¡Método correcto!",
          detail: c.problem.quiz.explain || "Has identificado la técnica adecuada.",
          xp: XP_METODO
        };
      }
      closeProblem(c.usedOptions && c.policy === "boton" ? "ayudado" : "acierto");
      render();
      return;
    }

    c.quizFailed = true;
    c.feedback = {
      ok: false,
      soft: true,
      title: "Fallo de método",
      detail: c.problem.quiz.explain || "Ese no es el procedimiento que toca aquí."
    };
    closeProblem("fallo de método");
    render();
  }

  function onRetryQuiz() {
    var c = state.current;
    if (!c) return;
    c.quizAnswered = false;
    c.quizPick = null;
    c.quizRetried = true;
    render();
  }

  function onNext() {
    advance();
  }

  /* =======================================================================
   * 16. Cierre de problema (reglas del cuaderno)
   * ===================================================================== */

  function closeProblem(how) {
    var c = state.current;
    if (!c) return;
    if (HOW.indexOf(how) < 0) how = "fallo";
    c.closed = true;
    if (c.counted) { save(); return; }     // solo se contabiliza una vez

    var p = c.problem;
    var st = state.stats;
    var topic = p.topic || "sustitucion";
    if (!st.byTopic[topic]) st.byTopic[topic] = { ok: 0, total: 0 };

    var fullCredit = (how === "acierto" || how === "ayudado");

    st.solved++;
    st.byTopic[topic].total++;

    if (how === "acierto" || how === "ayudado") {
      // Los 10 XP del número ya se concedieron al comprobar.
      st.byTopic[topic].ok++;
      if (how === "acierto") {
        st.correct++;
        st.streak++;
        if (st.streak > st.bestStreak) st.bestStreak = st.streak;
        notebookResolve(p);
      } else {
        // "ayudado": acertó, pero se sirvió de las opciones reveladas.
        // Racha a 0 y sigue en el cuaderno. A propósito: obliga a hacerlo solo.
        st.streak = 0;
        notebookUpsert(p, "ayudado");
      }
    } else {
      st.streak = 0;
      if (how === "visto solución") notebookUpsert(p, "visto solución");
      else if (how === "fallo de método") notebookUpsert(p, "fallo de método");
      else if (how === "saltado") notebookUpsert(p, "saltado");
      else notebookUpsert(p, "fallo");
    }

    var run = state.run;
    if (run) {
      if (fullCredit) run.numOk++;
      if (how === "acierto") run.metOk++;
      run.lastHow = how;
    }

    save();
  }

  function advance() {
    var run = state.run;
    if (!run) return;
    run.index++;
    state.current = null;
    if (run.index >= run.total) {
      run.finished = true;
      if (run.levelId && !run.free) recordLevelResult(run.levelId, run.numOk, run.metOk, run.total);
      save();
      render();
      return;
    }
    generateNext();
  }

  /* =======================================================================
   * 17. Teclado
   * ===================================================================== */

  var keysBound = false;

  function onKey(ev) {
    var tag = (ev.target && ev.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") {
      if (ev.key === "Escape") ev.target.blur();
      return;
    }
    if (state.screen !== "juego") return;
    var c = state.current;
    if (!c || state.picker) return;

    if (ev.key === "Enter") {
      if (c.phase === "answer") { ev.preventDefault(); onCheck(); }
      else if (c.phase === "quiz" && c.quizAnswered) { ev.preventDefault(); onNext(); }
      return;
    }
    if (ev.key === "s" || ev.key === "S") { ev.preventDefault(); onShowSolution(); return; }
    if (ev.key === "n" || ev.key === "N") { ev.preventDefault(); onSkip(); return; }
    if (c.phase === "quiz" && c.quizAnswered && (ev.key === " " || ev.key === "Enter")) {
      ev.preventDefault(); onNext(); return;
    }
    if (c.phase === "quiz" && !c.quizAnswered && /^[1-4]$/.test(ev.key)) {
      ev.preventDefault(); onAnswerQuiz(Number(ev.key) - 1); return;
    }
    if (c.phase === "answer" && c.optionsShown && /^[1-4]$/.test(ev.key)) {
      ev.preventDefault();
      var i = Number(ev.key) - 1;
      if (i < (c.options || []).length) onPickOption(i);
    }
  }

  /* =======================================================================
   * 18. Arranque
   * ===================================================================== */

  function start(target) {
    host = (target && target.nodeType === 1) ? target : document.getElementById("app") || document.body;
    load();
    state.picker = null;
    state.run = null;
    state.current = null;
    state.screen = "portada";
    if (!keysBound) {
      keysBound = true;
      document.addEventListener("keydown", onKey, false);
    }
    render();
  }

  global.App = {
    start: start,
    state: state,
    render: render,
    generateNext: function () { return generateNext(); },
    closeProblem: closeProblem,
    go: go,
    version: "1.0"
  };

  /* =======================================================================
   * 19. Desviaciones respecto al contrato (documentadas)
   * -------------------------------------------------------------------------
   * 1) `Problem.options` / `Problem.optionOrder`: NO existen en CONTRACT.md.
   *    La UI los construye sola con `Lim.answerToString(problem.answer)` +
   *    `Lim.answerToString(problem.distractors[i])` y los baraja con
   *    `Lim.rng(seed)` para que sean estables. Si el motor real los aporta,
   *    se usan tal cual (se comprueban con `Array.isArray(p.options)`).
   *
   * 2) `Lim.solutionHtml()` debe poder emitir un hueco `<span class="mathslot"
   *    data-math="i">` por cada paso con `math`. La UI lo sustituye por un
   *    nodo MathML de verdad creado con `document.createElementNS`. Si el
   *    motor emite MathML ya serializado, el HTML del motor se parsea en un
   *    `<template>` inerte (nunca se asigna a un nodo vivo) y los nodos
   *    MathML resultantes son válidos. Si `solutionHtml` no existe o falla,
   *    se reconstruye la solución con `problem.steps`.
   *
   * 3) La clave del modo activo en la UI es "escribir"/"opciones" (el valor
   *    persistido `settings.modo` es "escribir"/"opciones"/"mixto"). El chip
   *    muestra el texto "escribiendo"/"eligiendo" pedido por el enunciado.
   *
   * 4) `Lim.Q` se usa únicamente como portador de `q.n`/`q.d` (contrato §1)
   *    para pintar el objetivo del límite; no se recalcula nada en la UI.
   *
   * 5) Reglas de XP no especificadas por el contrato: "ayudado" y los fallos
   *    de método a la segunda NO dan los 5 XP de método; "ayudado" sí deja los
   *    10 XP del número ya concedidos al comprobar. La racha se pone a 0 en
   *    cuanto se falla la comprobación, no al cerrar el problema.
   * ===================================================================== */
})(typeof window !== "undefined" ? window : globalThis);