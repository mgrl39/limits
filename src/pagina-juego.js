/* =====================================================================
 * src/pagina-juego.js — pantalla del juego (una partida de 10 problemas).
 * ---------------------------------------------------------------------
 * Depende SOLO de `window.UI` (src/ui-core.js), `window.Lim` (src/engine.js)
 * y del DOM. Sin módulos ES, sin bundler, sin dependencias.
 *
 * Matriz modo × política, respetada al pie de la letra:
 *
 *   modo \ política | visible                 | botón                      | examen
 *   ----------------+-------------------------+----------------------------+-----------------------------------
 *   escribir        | solo texto, 0 opciones  | texto + botón «Ver opciones»| solo texto (solución exige intento)
 *   opciones        | 4 opciones al cargar    | botón → aparecen           | texto obligatorio; tras fallar 🔒 para siempre
 *   mixto           | la política se aplica al tipo (escribir|opciones) que toque en ese problema
 *
 * Cierre de problema (spec):
 *   acierto = +15 XP, racha +1   ·  fallo de método = +10 XP, racha 0
 *   fallo = 0  ·  saltado = 0  ·  visto solución = 0  ·  ayudado = 0, racha 0
 *
 * Todo lo que no sea «acierto» entra en el cuaderno de errores; el acierto
 * tacha la entrada. El interrogatorio de método es obligatorio: sin acertarlo
 * no se pasa al siguiente problema.
 * ===================================================================== */
(function (global) {
  "use strict";

  var UI = global.UI;
  var NS_MATH = "http://www.w3.org/1998/Math/MathML";

  /* --- Alias de UI.el para no repetir `UI.` ----------------------- */
  function el(tag, props, hijos) { return UI.el(tag, props, hijos); }

  /* =====================================================================
   * 0. Constantes
   * ===================================================================== */

  var XP_NUMERO = 10;
  var XP_METODO = 5;
  var REINJECT_CADA = 5;              // un repaso del cuaderno cada 5 problemas

  var HOW = ["fallo", "fallo de método", "saltado", "visto solución", "ayudado", "acierto"];
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
  var ETIQUETA_MODO = { escribir: "escribiendo", opciones: "eligiendo", mixto: "mixto" };

  var PRETTY = {
    "+inf": "+∞", "infinity": "+∞", "inf": "+∞", "+∞": "+∞",
    "-inf": "−∞", "-infinity": "−∞", "−∞": "−∞",
    "dne": "no existe", "noexiste": "no existe", "no existe": "no existe",
    "si": "Sí", "sí": "Sí", "no": "No"
  };

  var COND = { le: "≤", lt: "<", ge: "≥", gt: ">", eq: "=" };

  /* =====================================================================
   * 1. Utilidades
   * ===================================================================== */

  function motor() { return global.Lim; }

  function generadores() {
    var L = motor();
    return L && L.GENERATORS ? L.GENERATORS : {};
  }
  function generador(id) { return generadores()[id] || null; }

  function niveles() {
    var L = motor();
    return L && Array.isArray(L.LEVELS) ? L.LEVELS : [];
  }
  function nivelPorId(id) {
    var lista = niveles();
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i];
    return null;
  }

  function topicos() {
    var L = motor();
    return L && Array.isArray(L.TOPICS) ? L.TOPICS : [];
  }
  function topicoPorId(id) {
    var lista = topicos();
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i];
    return null;
  }

  function metodoInfo(id) {
    var L = motor();
    if (L && L.METHODS && L.METHODS[id]) return L.METHODS[id];
    return { name: id || "Método", desc: "" };
  }

  function num(v, def) {
    var n = Number(v);
    return isFinite(n) && n >= 0 ? Math.floor(n) : def;
  }

  function pct(a, b) {
    b = num(b, 1) || 1;
    var v = Math.round((a / b) * 100);
    return v < 0 ? 0 : (v > 100 ? 100 : v);
  }

  /** Escape para ATRIBUTOS. El texto visible siempre entra por textContent. */
  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function txt(s) { return String(s === null || s === undefined ? "" : s); }

  function pretty(s) {
    if (s === null || s === undefined) return "";
    var k = String(s).trim().toLowerCase();
    return PRETTY[k] !== undefined ? PRETTY[k] : String(s);
  }

  function respuestaLegible(ans) {
    var L = motor();
    if (!L || typeof L.answerToString !== "function") return "";
    try { return L.answerToString(ans); } catch (e) { return ""; }
  }

  /* =====================================================================
   * 2. Acceso al estado persistente (vive en UI.cargar)
   * ===================================================================== */

  function estado() { return UI.cargar(); }
  function ajustes() { return UI.cargar().settings; }

  function cuaderno() { return UI.cargar().notebook; }

  /* Cuaderno --------------------------------------------------------- */

  function cuadernoIndice(seed, genId) {
    var nb = cuaderno();
    for (var i = 0; i < nb.length; i++) {
      if (Number(nb[i].seed) === Number(seed) &&
          String(nb[i].generatorId) === String(genId)) return i;
    }
    return -1;
  }

  /** Anota (o refresca) una entrada del cuaderno con su etiqueta de cierre. */
  function cuadernoAnota(problema, how) {
    if (!problema || !problema.generatorId) return;
    var nb = cuaderno();
    var etiqueta = HOW.indexOf(how) >= 0 ? how : "fallo";
    var i = cuadernoIndice(problema.seed, problema.generatorId);
    if (i >= 0) {
      nb[i].attempts = Math.max(1, Math.min(999, num(nb[i].attempts, 1) + 1));
      nb[i].lastTs = Date.now();
      nb[i].resolved = false;
      nb[i].howClosed = etiqueta;
    } else {
      nb.push({
        seed: Number(problema.seed) || 0,
        generatorId: String(problema.generatorId),
        attempts: 1,
        lastTs: Date.now(),
        resolved: false,
        howClosed: etiqueta
      });
    }
    if (nb.length > 400) nb.splice(0, nb.length - 400);
  }

  /** Un acierto tacha la entrada del cuaderno. */
  function cuadernoResuelve(problema) {
    if (!problema) return;
    var i = cuadernoIndice(problema.seed, problema.generatorId);
    if (i >= 0) cuaderno().splice(i, 1);
  }

  /* =====================================================================
   * 3. Persistencia de la partida
   *
   * El problema EN SÍ no se serializa (contiene BigInt y nodos MathML):
   * se guarda su semilla y su generador, que son deterministas. Al volver
   * a la página se reconstruye exactamente el mismo enunciado.
   * ===================================================================== */

  var raiz = null;                  // <main class="screen screen-juego">
  var run = null;                   // partida en curso (o null en la bienvenida)
  var c = null;                     // contexto del problema actual
  var nivelElegido = null;          // nivel marcado en la pantalla de bienvenida
  var ajustesAbiertos = false;
  var renderizando = false;

  function guardar() {
    var st = estado();
    if (!run) { st.run = null; UI.guardar(); return; }
    st.run = {
      levelId: run.levelId,
      free: run.free,
      title: run.title,
      total: run.total,
      required: run.required,
      index: run.index,
      numOk: run.numOk,
      metOk: run.metOk,
      xp: run.xp,
      seeds: run.seeds,
      generators: run.generators,
      reinjectIn: run.reinjectIn,
      finished: run.finished,
      notebookMode: run.notebookMode,
      lastHow: run.lastHow,
      tema: run.tema
    };
    UI.guardar();
  }

  function leerRunGuardado() {
    var r = estado().run;
    if (!r || typeof r !== "object") return null;
    var total = num(r.total, 10) || 10;
    return {
      levelId: r.levelId && nivelPorId(r.levelId) ? r.levelId : null,
      free: !!r.free,
      title: txt(r.title) || "Partida",
      total: total,
      required: num(r.required, 8),
      index: Math.max(0, Math.min(total - 1, num(r.index, 0))),
      numOk: num(r.numOk, 0),
      metOk: num(r.metOk, 0),
      xp: num(r.xp, 0),
      seeds: Array.isArray(r.seeds) ? r.seeds.slice() : [],
      generators: Array.isArray(r.generators) ? r.generators.slice() : null,
      reinjectIn: num(r.reinjectIn, REINJECT_CADA - 1),
      finished: !!r.finished,
      notebookMode: !!r.notebookMode,
      lastHow: HOW.indexOf(r.lastHow) >= 0 ? r.lastHow : null,
      tema: (r.tema && typeof r.tema === "object") ? r.tema : {}
    };
  }

  /* =====================================================================
   * 4. Generación de problemas (a prueba de fallos)
   * ===================================================================== */

  function problemaValido(p) {
    return !!(p && p.statement && p.answer && p.quiz &&
      Array.isArray(p.quiz.options) && p.quiz.options.length === 4 &&
      p.quiz.correct !== undefined);
  }

  /** Generadores que existen de verdad; si no, los del mismo tópico. */
  function generadoresRespaldo(lista) {
    var L = motor();
    var todos = L && typeof L.generatorList === "function" ? L.generatorList() : [];
    if (!lista || !lista.length) return todos;
    var vivos = lista.filter(function (id) { return !!generador(id); });
    if (vivos.length) return vivos;
    var vistos = {}, salida = [];
    for (var i = 0; i < lista.length; i++) {
      var g = generador(lista[i]);
      if (!g || vistos[g.topic]) continue;
      vistos[g.topic] = true;
      for (var k = 0; k < todos.length; k++) {
        var og = generador(todos[k]);
        if (og && og.topic === g.topic) salida.push(todos[k]);
      }
    }
    return salida.length ? salida : todos;
  }

  /**
   * Llama a Lim.generate sin dejar que una excepción rompa la partida.
   * Si el generador pedido ya no existe, cae a otro del mismo tópico y,
   * en último término, a cualquier generador disponible.
   */
  function generarSeguro(opts) {
    var L = motor();
    if (!L || typeof L.generate !== "function") return null;
    opts = opts || {};

    var pedido = opts.generatorIds && opts.generatorIds.length ? opts.generatorIds : null;
    var respaldo = generadoresRespaldo(pedido);

    var intentos = [];
    if (opts.seed !== undefined && opts.seed !== null) {
      intentos.push({ seed: opts.seed, generatorIds: pedido });
      intentos.push({ seed: opts.seed, generatorIds: respaldo });
    }
    intentos.push({ generatorIds: pedido });
    intentos.push({ generatorIds: respaldo });
    intentos.push({});

    for (var i = 0; i < intentos.length; i++) {
      if (!intentos[i]) continue;
      try {
        var p = L.generate(intentos[i]);
        if (problemaValido(p)) return p;
      } catch (e) { /* siguiente intento */ }
    }
    return null;
  }

  /** Las 4 opciones: la correcta + 3 distractores, barajadas de forma estable. */
  function listaOpciones(problema) {
    var correcta = pretty(respuestaLegible(problema.answer));
    var pool = [];
    if (Array.isArray(problema.options) && problema.options.length === 4) {
      pool = problema.options.map(pretty);
    } else {
      pool.push(correcta);
      var dis = Array.isArray(problema.distractors) ? problema.distractors : [];
      for (var i = 0; i < dis.length; i++) pool.push(pretty(respuestaLegible(dis[i])));
      pool.push(correcta, "0", "1", "−1", "+∞", "−∞", "no existe");
    }

    var seen = {}, uniq = [];
    for (var j = 0; j < pool.length && uniq.length < 4; j++) {
      var v = String(pool[j]);
      if (!v || seen[v]) continue;
      seen[v] = 1; uniq.push(v);
    }
    var relleno = ["+∞", "−∞", "no existe", "0"];
    for (var k = 0; uniq.length < 4 && k < relleno.length; k++) {
      if (!seen[relleno[k]]) { seen[relleno[k]] = 1; uniq.push(relleno[k]); }
    }
    while (uniq.length > 4) uniq.pop();

    var order = [0, 1, 2, 3];
    var L = motor();
    if (L && typeof L.rng === "function") {
      try { order = L.rng((Number(problema.seed) >>> 0) ^ 0x5f3a).shuffle(order); }
      catch (e) { /* orden natural */ }
    }
    var out = [];
    for (var n = 0; n < order.length; n++) out.push(uniq[order[n]]);
    return out;
  }

  /* =====================================================================
   * 5. Arranque y ciclo de partida
   * ===================================================================== */

  function nuevaPartida(opts) {
    opts = opts || {};
    var lvl = opts.levelId ? nivelPorId(opts.levelId) : null;
    return {
      levelId: lvl ? lvl.id : null,
      free: (opts.free === true) || !lvl,
      title: lvl ? ("Nivel " + lvl.n + " · " + lvl.name) : "Práctica libre",
      total: num(lvl && lvl.total, 10) || 10,
      required: num(lvl && lvl.required, 8),
      index: 0,
      numOk: 0,
      metOk: 0,
      xp: 0,
      seeds: [],
      generators: lvl ? (lvl.generators || []).slice() : (opts.generatorIds || null),
      reinjectIn: REINJECT_CADA - 1,
      finished: false,
      notebookMode: !!opts.notebookMode,
      lastHow: null,
      tema: {}
    };
  }

  function arrancarPartida(opts) {
    run = nuevaPartida(opts);
    c = null;
    ajustesAbiertos = false;
    generarSiguiente();
  }

  function arrancarLibre() { arrancarPartida({ levelId: null, free: true }); }

  function arrancarCuaderno(uno) {
    var pool = cuaderno().slice().sort(function (a, b) { return b.lastTs - a.lastTs; });
    if (!pool.length) return;
    var seeds = pool.map(function (e) { return { seed: e.seed, generatorId: e.generatorId }; });
    if (uno) seeds = [seeds[Math.floor(Math.random() * seeds.length)]];
    var vistos = {}, gens = [];
    for (var i = 0; i < seeds.length; i++) {
      if (!vistos[seeds[i].generatorId]) { vistos[seeds[i].generatorId] = true; gens.push(seeds[i].generatorId); }
    }
    run = {
      levelId: null,
      free: true,
      title: uno ? "Un fallo al azar" : "Cuaderno de errores",
      total: seeds.length,
      required: 0,
      index: 0,
      numOk: 0,
      metOk: 0,
      xp: 0,
      seeds: seeds,
      generators: gens,
      reinjectIn: REINJECT_CADA - 1,
      finished: false,
      notebookMode: true,
      lastHow: null,
      tema: {}
    };
    c = null;
    ajustesAbiertos = false;
    generarSiguiente();
  }

  function generarSiguiente() {
    if (!run) return null;
    var problema = null;
    var esRepaso = false;

    // 1) Cola explícita (modo cuaderno).
    var enCola = run.seeds && run.seeds.length ? run.seeds.shift() : null;
    if (enCola) {
      problema = generarSeguro({ seed: enCola.seed, generatorIds: [enCola.generatorId] });
      esRepaso = !!problema;
    }

    // 2) Reinyección: uno de cada cinco sale del cuaderno.
    if (!problema && !run.notebookMode && cuaderno().length > 0 && run.reinjectIn <= 0) {
      var nb = cuaderno();
      var entrada = nb[Math.floor(Math.random() * nb.length)];
      if (entrada) {
        problema = generarSeguro({ seed: entrada.seed, generatorIds: [entrada.generatorId] });
        esRepaso = !!problema;
      }
      run.reinjectIn = REINJECT_CADA - 1;
    }

    // 3) Problema nuevo del nivel.
    if (!problema) {
      var lista = run.generators && run.generators.length ? run.generators : null;
      problema = generarSeguro({ generatorIds: lista });
      if (run.reinjectIn > 0) run.reinjectIn--;
    }

    if (!problema) {
      // Ni con el nivel entero: la partida se cierra con el resumen.
      run.finished = true;
      c = null;
      guardar();
      render();
      return null;
    }

    c = nuevoContexto(problema, esRepaso);
    ajustesAbiertos = false;
    guardar();
    render();
    return problema;
  }

  function nuevoContexto(problema, esRepaso) {
    var modo = ajustes().modo;
    var kind = (modo === "mixto") ? tipoAleatorio(problema) : modo;
    if (kind !== "opciones") kind = "escribir";
    var pol = ajustes().politica;
    var ctx = {
      problem: problema,
      kind: kind,
      policy: pol,
      options: listaOpciones(problema),
      optionsShown: false,
      optionsLocked: false,
      input: "",
      picked: null,
      pickedOk: false,
      attempted: false,
      usedOptions: false,
      feedback: null,
      phase: "answer",
      quizPick: null,
      quizAnswered: false,
      quizFailed: false,
      quizRetried: false,
      solutionOpen: false,
      counted: false,
      closed: false,
      isReview: !!esRepaso
    };
    // Matriz: con `visible` y tipo «opciones», las cuatro se pintan al cargar.
    if (ctx.policy === "visible" && ctx.kind === "opciones") ctx.optionsShown = true;
    return ctx;
  }

  // `mixto` alterna al azar, pero de forma estable para una misma semilla.
  function tipoAleatorio(problema) {
    var L = motor();
    var r = 0.5;
    if (L && typeof L.rng === "function") {
      try { r = L.rng((Number(problema.seed) >>> 0) ^ 0x2f19)(); } catch (e) { r = 0.5; }
    } else {
      r = Math.random();
    }
    return r < 0.5 ? "escribir" : "opciones";
  }

  function avanzar() {
    if (!run) return;
    run.index++;
    c = null;
    if (run.index >= run.total) {
      run.finished = true;
      if (run.levelId && !run.free) recordLevelResult(run.levelId, run.numOk, run.metOk, run.total);
      guardar();
      render();
      return;
    }
    generarSiguiente();
  }

  /* =====================================================================
   * 6. Cierre de problema: cuaderno, racha, XP y campaña
   * ===================================================================== */

  function cerrarProblema(how) {
    if (!c) return;
    if (HOW.indexOf(how) < 0) how = "fallo";
    if (c.counted) { guardar(); return; }    // sólo se contabiliza una vez

    c.closed = true;
    c.counted = true;

    var st = estado().stats;
    var p = c.problem;
    var topic = p.topic || "sustitucion";
    if (!st.byTopic[topic]) st.byTopic[topic] = { ok: 0, total: 0 };

    var numeroBien = (how === "acierto" || how === "ayudado" || how === "fallo de método");
    var metodoBien = (how === "acierto");
    var xp = 0;

    st.solved++;
    st.byTopic[topic].total++;

    if (how === "acierto") {
      st.correct++;
      st.streak++;
      if (st.streak > st.bestStreak) st.bestStreak = st.streak;
      xp = XP_NUMERO + XP_METODO;              // 15
      cuadernoResuelve(p);                     // el acierto tacha la entrada
    } else if (how === "ayudado") {
      st.streak = 0;                           // pero se sirvió del espejo
      xp = 0;
      cuadernoAnota(p, "ayudado");             // sigue en el cuaderno
    } else {
      st.streak = 0;
      // El número estaba bien, así que conserva los XP de comprobarlo.
      xp = (how === "fallo de método") ? XP_NUMERO : 0;
      cuadernoAnota(p, how);
    }

    // El acierto de número cuenta aunque el método se falle después.
    if (numeroBien) st.byTopic[topic].ok++;
    st.xp += xp;

    if (run) {
      if (numeroBien) run.numOk++;
      if (metodoBien) run.metOk++;
      run.xp += xp;
      run.lastHow = how;
      if (!run.tema[topic]) run.tema[topic] = { ok: 0, total: 0 };
      run.tema[topic].total++;
      if (numeroBien) run.tema[topic].ok++;
    }

    guardar();
  }

  /** Superar = ≥(total−2) en número Y ≥(total−2) en método. 2★ con 9, 3★ con 10. */
  function starsFor(numOk, metOk, total) {
    var req = Math.max(1, total - 2);
    if (numOk < req || metOk < req) return 0;
    if (numOk >= total && metOk >= total) return 3;
    if (numOk >= total - 1 && metOk >= total - 1) return 2;
    return 1;
  }

  function recordLevelResult(levelId, numOk, metOk, total) {
    if (!nivelPorId(levelId)) return null;
    var st = estado();
    var prev = st.campaign[levelId] || { best: { num: 0, met: 0 }, stars: 0, passed: false };
    var best = {
      num: Math.max(num(prev.best.num, 0), numOk),
      met: Math.max(num(prev.best.met, 0), metOk)
    };
    var req = Math.max(1, total - 2);
    var pasa = best.num >= req && best.met >= req;
    var rec = {
      best: best,
      stars: Math.max(num(prev.stars, 0), starsFor(best.num, best.met, total)),
      passed: !!prev.passed || pasa
    };
    st.campaign[levelId] = rec;
    guardar();
    return { rec: rec, nuevo: pasa && !prev.passed };
  }

  function campanaCompleta() {
    var lista = niveles();
    if (!lista.length) return false;
    var camp = estado().campaign;
    for (var i = 0; i < lista.length; i++) {
      var r = camp[lista[i].id];
      if (!r || !r.passed) return false;
    }
    return true;
  }

  function siguienteNivelId(id) {
    var lista = niveles();
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === id && i + 1 < lista.length) return lista[i + 1].id;
    }
    return null;
  }

  /* =====================================================================
   * 7. Responder: número, opciones y herramientas
   * ===================================================================== */

  /** ¿Se pinta el campo de texto en este problema? (matriz) */
  function quiereCampo(cur) {
    if (cur.kind === "escribir") return true;
    if (cur.kind === "opciones") return cur.policy === "examen";   // examen obliga a escribir
    return true;
  }

  /** ¿Existe el botón «Ver opciones» en este problema? (matriz) */
  function existeBotonOpciones(cur) {
    if (cur.kind === "opciones") return true;
    return cur.policy === "boton";        // en escribir sólo con política «botón»
  }

  function onCheck() {
    if (!c || c.phase !== "answer") return;
    var bruto = String(c.input || "").trim();
    if (!bruto) return;
    var L = motor();
    if (!L || typeof L.checkAnswer !== "function") return;

    var res;
    try { res = L.checkAnswer(c.problem, bruto); }
    catch (e) { res = { correct: false, normalized: bruto, reason: "No entiendo esa respuesta" }; }

    c.attempted = true;

    if (res && res.correct) {
      // Los XP del número se conceden al cerrar el problema; aquí se acusa.
      c.feedback = { ok: true, title: "¡Correcto!", detail: "Has acertado el valor del límite." };
      c.phase = "quiz";
      render();
      return;
    }

    estado().stats.streak = 0;
    cuadernoAnota(c.problem, "fallo");
    c.feedback = {
      ok: false,
      title: "No es correcto",
      detail: (res && res.reason)
        ? res.reason
        : ("Entendí «" + bruto + "» como respuesta. Inténtalo otra vez o mira la solución."),
      echo: bruto
    };
    // Matriz: en examen, fallar bloquea las opciones para siempre.
    if (c.policy === "examen") { c.optionsLocked = true; c.optionsShown = false; }
    guardar();
    render();
  }

  function onPickOption(idx) {
    if (!c || c.phase !== "answer" || !c.optionsShown || c.optionsLocked) return;
    var elegido = (c.options || [])[idx];
    if (elegido === undefined) return;
    var L = motor();
    if (!L || typeof L.checkAnswer !== "function") return;

    var res;
    try { res = L.checkAnswer(c.problem, elegido); }
    catch (e) { res = { correct: false }; }

    c.input = String(elegido);
    c.picked = idx;
    c.pickedOk = !!(res && res.correct);
    c.attempted = true;
    c.usedOptions = true;                 // necesario para cerrar como «ayudado»

    if (c.pickedOk) {
      c.feedback = { ok: true, title: "¡Correcto!", detail: "Has acertado el valor del límite." };
      c.phase = "quiz";
      render();
      return;
    }

    estado().stats.streak = 0;
    cuadernoAnota(c.problem, "fallo");
    c.feedback = {
      ok: false,
      title: "Esa opción no es",
      detail: (res && res.reason) ? res.reason : "Vuelve a intentarlo o mira la solución."
    };
    if (c.policy === "examen") { c.optionsLocked = true; c.optionsShown = false; }
    guardar();
    render();
  }

  function onRevealOptions() {
    if (!c || c.optionsShown || c.optionsLocked) return;
    if (c.policy === "examen" && !c.attempted) return;   // examen exige intento previo
    c.optionsShown = true;
    guardar();
    render();
  }

  function onShowSolution() {
    if (!c) return;
    if (c.policy === "examen" && !c.attempted) return;   // examen exige intento previo
    if (c.phase === "answer") cerrarProblema("visto solución");
    c.solutionOpen = true;
    guardar();
    render();
  }

  function onSkip() {
    if (!c) return;
    cerrarProblema("saltado");
    avanzar();
  }

  /* =====================================================================
   * 8. Interrogatorio de método (obligatorio antes de pasar)
   * ===================================================================== */

  function onAnswerQuiz(idx) {
    if (!c || c.quizAnswered) return;
    var L = motor();
    var ok = false;
    try { ok = !!(L && L.checkQuiz && L.checkQuiz(c.problem, idx)); }
    catch (e) { ok = false; }

    c.quizPick = idx;
    c.quizAnswered = true;

    if (ok) {
      // Si hubo que reintentar, el método se anota como fallado (sin +5 XP),
      // pero el intento ya está superado: se puede pasar al siguiente.
      c.quizFailed = false;
      if (!c.quizRetried) {
        c.feedback = {
          ok: true,
          title: "¡Método correcto!",
          detail: (c.problem.quiz && c.problem.quiz.explain) ||
                  "Has identificado la técnica adecuada."
        };
      }
      // Con política «botón», haberse servido de las opciones reveladas
      // impide el «acierto» limpio. En examen es imposible por definición.
      cerrarProblema(c.usedOptions && c.policy === "boton" ? "ayudado" : "acierto");
      render();
      return;
    }

    c.quizFailed = true;
    c.feedback = {
      ok: false,
      soft: true,
      title: "Fallo de método",
      detail: (c.problem.quiz && c.problem.quiz.explain) ||
              "Ese no es el procedimiento que toca aquí."
    };
    // Número bien, método mal ⇒ racha a 0, +10 XP y entrada en el cuaderno.
    cerrarProblema("fallo de método");
    render();
  }

  function onRetryQuiz() {
    if (!c) return;
    c.quizAnswered = false;
    c.quizPick = null;
    c.quizRetried = true;
    guardar();
    render();
  }

  function onNext() { avanzar(); }

  /* =====================================================================
   * 9. MathML
   * ===================================================================== */

  function mathML(tag, attrs, hijos) {
    var n = document.createElementNS(NS_MATH, tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        n.setAttribute(k, v === true ? "" : String(v));
      }
    }
    if (hijos) UI.append(n, hijos);
    return n;
  }

  function textoPlano(ast) {
    var L = motor();
    if (L && L.ast && typeof L.ast.toPlain === "function") {
      try { return String(L.ast.toPlain(ast)); } catch (e) { return "?"; }
    }
    return "?";
  }

  /**
   * Nodo del motor envuelto por UI.math. OBLIGATORIO: el motor devuelve
   * nodos sueltos y sin la raíz <math> el navegador no los pinta.
   */
  function exprMath(ast) {
    var L = motor();
    var nodo = null;
    if (L && L.ast && typeof L.ast.toMathML === "function") {
      try { nodo = L.ast.toMathML(ast); } catch (e) { nodo = null; }
    }
    if (nodo && nodo.nodeType) return UI.math(nodo);
    return el("span", { class: "math", text: textoPlano(ast) });
  }

  function qMath(q) {
    if (!q || q.n === undefined || q.d === undefined) return mathML("mtext", { text: "?" });
    var n = String(q.n), d = String(q.d);
    if (d === "1") return mathML("mn", { text: n });
    return mathML("mfrac", null, [mathML("mn", { text: n }), mathML("mn", { text: d })]);
  }

  /** mrow con  x → a · x → a⁻ · x → a⁺ · x → +∞ · x → −∞ */
  function objetivoMathML(target) {
    if (!target) return mathML("mrow");
    var kids = [mathML("mi", { text: "x" }), mathML("mo", { text: "→" })];
    if (target.type === "infinity") {
      kids.push(mathML("mo", { text: target.sign === "-" ? "−∞" : "+∞" }));
    } else {
      var base = qMath(target.at);
      kids.push(target.side === "-" ? mathML("msup", null, [base, mathML("mo", { text: "−" })])
        : target.side === "+" ? mathML("msup", null, [base, mathML("mo", { text: "+" })])
          : base);
    }
    return mathML("mrow", null, kids);
  }

  /** El límite entero: "lim" con el objetivo debajo + la expresión. */
  function limiteMath(st) {
    var envuelto = exprMath(st.expr);               // siempre pasa por UI.math
    var hijos = [
      mathML("munder", null, [mathML("mo", { text: "lim" }), objetivoMathML(st.target)]),
      mathML("mspace", { width: "0.6em" })
    ];
    if (envuelto && envuelto.nodeType) {
      var nombre = String(envuelto.localName || envuelto.nodeName || "").toLowerCase();
      if (nombre === "math") {
        // Hay que DESENGACHAR el hijo: push no lo saca de su padre.
        while (envuelto.firstChild) {
          var hijo = envuelto.firstChild;
          envuelto.removeChild(hijo);
          hijos.push(hijo);
        }
      } else {
        hijos.push(envuelto);
      }
    }
    return UI.math(mathML("math", { display: "block" }, [mathML("mrow", null, hijos)]));
  }

  /** Definición por trozos (continuidad). */
  function renderPieces(st) {
    var wrap = el("div", { class: "piecewise" });
    var lista = st.pieces || [];
    var inner = el("div", { class: "grow" });
    for (var i = 0; i < lista.length; i++) {
      (function (p) {
        var cond = p.cond || ("x " + (COND[p.condType] || "") + " ?");
        inner.appendChild(el("div", { class: "piece" }, [
          exprMath(p.expr),
          el("span", { class: "cond", text: ",  " + cond })
        ]));
      })(lista[i]);
    }
    wrap.appendChild(el("span", { class: "brace", text: "{" }));
    wrap.appendChild(inner);
    return wrap;
  }

  /** El objetivo como texto plano, tal y como lo pide la spec. */
  function objetivoTexto(target) {
    if (!target) return "";
    var etiqueta = "";
    var L = motor();
    if (L && typeof L.targetLabel === "function") {
      try { etiqueta = String(L.targetLabel(target) || ""); } catch (e) { etiqueta = ""; }
    }
    if (!etiqueta) {
      if (target.type === "infinity") etiqueta = "x → " + (target.sign === "-" ? "−infinito" : "+infinito");
      else {
        var a = "?";
        try { a = target.at && target.at.toDisplay ? target.at.toDisplay() : txt(target.at); }
        catch (e) { a = "?"; }
        etiqueta = "x → " + a + (target.side === "+" ? "⁺" : target.side === "-" ? "⁻" : "");
      }
    }
    // "x → +infinito" se lee mejor como "x → +∞".
    return etiqueta
      .replace(/\+infinito/g, "+∞")
      .replace(/−infinito/g, "−∞")
      .replace(/-infinito/g, "−∞")
      .replace(/ -(?=[0-9])/g, " −");   // signo tipográfico del punto
  }

  /* =====================================================================
   * 10. Chips
   * ===================================================================== */

  function chipTopic(topicId) {
    var t = topicoPorId(topicId);
    return el("span", {
      class: "chip chip-topic",
      dataset: { topic: topicId || "" },
      text: t ? t.name : txt(topicId)
    });
  }

  function chipDiff(d) {
    var n = Math.max(1, Math.min(5, num(d, 1)));
    var label = n <= 1 ? "sustitución" : n === 2 ? "fácil" : n === 3 ? "media"
      : n === 4 ? "difícil" : "muy difícil";
    var variant = n <= 2 ? "facil" : n === 3 ? "media" : "dificil";
    var dots = el("span", { class: "diff-dots", "aria-hidden": "true" });
    for (var i = 1; i <= 5; i++) {
      dots.appendChild(el("span", { class: i <= n ? "" : "off", text: "●" }));
    }
    return el("span", { class: "chip chip-" + variant, title: "Dificultad " + n + " de 5" }, [
      dots, el("span", { text: label })
    ]);
  }

  function chipModo(cur) {
    return el("span", { class: "chip chip-modo" }, [
      el("span", { "aria-hidden": "true", text: cur.kind === "opciones" ? "🔘" : "⌨" }),
      el("span", { text: ETIQUETA_MODO[cur.kind] || cur.kind })
    ]);
  }

  /* =====================================================================
   * 11. Tarjetas del problema
   * ===================================================================== */

  function headerPartida() {
    var total = run.total;
    var req = num(run.required, 8);
    var box = el("div", { class: "card card-tight" });
    box.appendChild(el("div", { class: "row row-wrap" }, [
      el("span", { style: "font-weight:700;font-size:.95rem", text: run.title || "Práctica libre" }),
      el("span", { class: "spacer" }),
      el("span", { class: "small muted mono", text: run.index + " / " + total })
    ]));
    box.appendChild(el("div", { class: "bar" }, el("i", { style: "width:" + pct(run.index, total) + "%" })));
    box.appendChild(el("div", {
      class: "small muted", style: "margin-top:6px",
      text: run.numOk + "/" + req + " nº · " + run.metOk + "/" + req + " método"
    }));
    return box;
  }

  function cardProblema() {
    var p = c.problem;
    var st = p.statement || {};
    var card = el("div", { class: "card" });

    var chips = el("div", { class: "card-head" });
    var lvl = run.levelId ? nivelPorId(run.levelId) : null;
    chips.appendChild(lvl
      ? el("span", { class: "chip chip-lvl", text: "Nivel " + lvl.n + " · " + lvl.name })
      : el("span", { class: "chip chip-lvl", text: run.notebookMode ? "Cuaderno" : "Libre" }));
    chips.appendChild(chipTopic(p.topic));
    chips.appendChild(chipDiff(p.difficulty));
    chips.appendChild(chipModo(c));
    card.appendChild(chips);

    var body = el("div", { class: "stmt" });
    body.appendChild(el("div", { class: "stmt-lead", text: txt(st.question) || "Calcula el siguiente límite:" }));

    if (st.kind === "continuity" && st.pieces && st.pieces.length) {
      body.appendChild(renderPieces(st));
      body.appendChild(el("div", { class: "piece-ask", text: txt(st.question) || "¿Es f continua en ese punto?" }));
    } else {
      var box = el("div", { class: "stmt-eqbox" });
      box.appendChild(el("div", { class: "math stmt-math" }, [limiteMath(st)]));
      box.appendChild(el("span", { class: "eq-tail", text: "= ?" }));
      body.appendChild(box);
    }

    body.appendChild(el("div", { class: "target" }, [
      el("span", { class: "target-label", text: "Objetivo" }),
      el("span", { class: "mono", text: objetivoTexto(st.target) })
    ]));

    card.appendChild(body);
    return card;
  }

  function cardAnswer() {
    var card = el("div", { class: "card" });
    var respondida = (c.phase !== "answer");
    var showField = quiereCampo(c);

    if (c.kind === "opciones" && c.policy === "examen" && !c.optionsShown && !respondida) {
      card.appendChild(el("div", { class: "notice notice-info" }, [
        el("span", { class: "notice-ico", text: "✍" }),
        el("span", { text: "Modo examen: escribe primero el valor del límite. Si aciertas, las opciones no hacen falta." })
      ]));
    }

    var input = el("input", {
      class: "field",
      type: "text",
      id: "answer-field",
      value: c.input || "",
      placeholder: c.kind === "opciones"
        ? "Escribe el valor y comprueba"
        : "Escribe el valor (3/4, +inf, dne…)",
      autocomplete: "off", autocapitalize: "off", autocorrect: "off",
      spellcheck: "false", inputmode: "text",
      disabled: respondida,
      "aria-label": "Tu respuesta"
    });
    input.addEventListener("input", function () {
      c.input = input.value;
      actualizarBotonComprobar();
    });
    input.addEventListener("keydown", function (ev) {
      // Enter NO debe recargar la página.
      if (ev.key === "Enter") { ev.preventDefault(); onCheck(); }
    });
    // Autocompletado al enfocar: deja escrito el último campo útil.
    input.addEventListener("focus", function () {
      if (c.input || !c) return;
      var valor = autocompletar(c.problem);
      if (!valor) return;
      input.value = valor;
      c.input = valor;
      var pos = (valor === "/") ? 0 : valor.length;
      try { input.setSelectionRange(pos, pos); } catch (e) { /* navegador sin selección */ }
      actualizarBotonComprobar();
    });

    var checkBtn = el("button", {
      class: "btn btn-primary", id: "check-btn",
      onclick: function () { onCheck(); }
    }, "Comprobar");

    var fila = el("div", { class: "answer-row" }, [
      el("div", { class: "field-wrap" }, input),
      checkBtn
    ]);
    if (!showField) fila.setAttribute("style", "display:none");
    card.appendChild(fila);

    function actualizarBoton() {
      checkBtn.disabled = respondida || !String(c.input || "").trim();
    }
    actualizarBoton();

    if (!respondida && c.kind === "escribir" && c.policy !== "examen") {
      card.appendChild(el("div", { class: "field-hint" }, [
        "Se acepta ",
        el("code", { text: "3/4" }), " · ", el("code", { text: "-2" }), " · ",
        el("code", { text: "+inf" }), " · ", el("code", { text: "dne" }), " · ",
        el("code", { text: "no existe" })
      ]));
    }

    // Las opciones SÓLO se pintan si están reveladas (política + botón).
    if (c.optionsShown) card.appendChild(bloqueOpciones());

    card.appendChild(barraHerramientas());
    return card;
  }

  function actualizarBotonComprobar() {
    var b = document.getElementById("check-btn");
    if (!b || !c) return;
    b.disabled = (c.phase !== "answer") || !String(c.input || "").trim();
  }

  function bloqueOpciones() {
    var box = el("div", { class: "opts", role: "group", "aria-label": "Opciones de respuesta" });
    var opts = c.options || [];
    for (var i = 0; i < opts.length; i++) {
      (function (idx, texto) {
        var btn = el("button", {
          class: "opt", type: "button",
          disabled: (c.phase !== "answer") || c.optionsLocked,
          dataset: { opt: String(idx) },
          onclick: function () { onPickOption(idx); }
        }, [
          el("span", { class: "opt-key", text: String(idx + 1) }),
          el("span", { class: "opt-text", text: texto }),
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

  function barraHerramientas() {
    var row = el("div", { class: "tools" });
    var respondida = (c.phase !== "answer");
    var needAttempt = (c.policy === "examen");

    // «Ver opciones» existe sólo si la política lo permite.
    if (existeBotonOpciones(c)) {
      var optBtn;
      if (c.optionsShown) {
        optBtn = el("button", { class: "btn btn-sm btn-ghost", disabled: true }, "Opciones visibles");
      } else if (c.optionsLocked) {
        optBtn = el("button", { class: "btn btn-sm btn-ghost", disabled: true }, [
          el("span", { text: "🔒" }), el("span", { text: "Opciones bloqueadas: ya fallaste" })
        ]);
      } else {
        var canReveal = !respondida && !(needAttempt && !c.attempted);
        optBtn = el("button", {
          class: "btn btn-sm",
          disabled: !canReveal,
          title: needAttempt
            ? "Primero escribe y comprueba una respuesta"
            : "Revelar las cuatro opciones",
          onclick: function () { onRevealOptions(); }
        }, [el("span", { text: "🔢 Ver opciones" })]);
      }
      row.appendChild(optBtn);
    }

    // En examen, «Ver solución» también exige un intento previo.
    var solDisabled = respondida || (needAttempt && !c.attempted);
    row.appendChild(el("button", {
      class: "btn btn-sm",
      disabled: solDisabled,
      title: needAttempt
        ? "En modo examen necesitas comprobar una respuesta primero"
        : "Ver la solución paso a paso",
      onclick: function () { onShowSolution(); }
    }, [el("span", { text: "👁 Ver solución" }), el("span", { class: "kbd", text: "S" })]));

    // «Saltar» siempre es libre.
    row.appendChild(el("button", {
      class: "btn btn-sm btn-ghost",
      onclick: function () { onSkip(); }
    }, [el("span", { text: "⏭ Saltar" }), el("span", { class: "kbd", text: "N" })]));

    row.appendChild(el("button", {
      class: "btn btn-sm btn-ghost icon-btn tools-right",
      title: "Ajustes de modo y política",
      "aria-label": "Ajustes",
      onclick: function () { ajustesAbiertos = !ajustesAbiertos; render(); }
    }, "⚙"));

    return row;
  }

  function cardFeedback() {
    var f = c.feedback;
    if (!f) return null;
    var cls = f.ok ? "feedback gone" : (f.soft ? "feedback faded" : "feedback miss");
    return el("div", {
      class: cls, role: "status", "aria-live": "polite",
      // Lo que escribió el alumno viaja como atributo: aquí sí se escapa.
      title: f.echo ? ("Has escrito: " + esc(f.echo)) : null
    }, [
      el("div", { class: "feedback-ico", text: f.ok ? "✓" : (f.soft ? "👁" : "✕") }),
      el("div", { class: "feedback-body" }, [
        el("div", { class: "feedback-title", text: txt(f.title) }),
        f.detail ? el("div", { class: "feedback-reason", text: txt(f.detail) }) : null
      ])
    ]);
  }

  function cardQuiz() {
    var p = c.problem;
    var quiz = p.quiz;
    if (!quiz) return null;
    var card = el("div", { class: "card quiz" });

    card.appendChild(el("div", { class: "quiz-head" }, [
      UI.chip("Interrogatorio", "accent2"),
      c.quizFailed ? UI.chip("has fallado una vez", "err") : null
    ]));

    card.appendChild(el("div", { class: "quiz-q" }, [
      el("span", { text: txt(quiz.question) || "¿Qué técnica hay que aplicar?" }),
      p.method ? el("div", { class: "small" }, [
        el("span", { class: "method-name", text: "Método: " + metodoInfo(p.method).name })
      ]) : null
    ]));

    var opciones = Array.isArray(quiz.options) ? quiz.options : [];
    var opts = el("div", { class: "quiz-opts", role: "group", "aria-label": "Opciones de método" });
    for (var i = 0; i < opciones.length; i++) {
      (function (idx, texto) {
        var btn = el("button", {
          class: "qopt", type: "button",
          disabled: c.quizAnswered,
          onclick: function () { onAnswerQuiz(idx); }
        }, [
          el("span", { class: "opt-key", text: String.fromCharCode(65 + idx) }),
          el("span", { class: "opt-text", text: txt(texto) })
        ]);
        if (c.quizAnswered) {
          if (idx === Number(quiz.correct)) btn.classList.add("correct");
          else if (idx === c.quizPick) btn.classList.add("wrong");
          else btn.classList.add("dimmed");
        }
        opts.appendChild(btn);
      })(i, opciones[i]);
    }
    card.appendChild(opts);

    if (c.quizAnswered) {
      if (c.quizFailed) {
        card.appendChild(el("div", { class: "explain" }, [
          el("b", { text: "Por qué: " }),
          el("span", { text: txt(quiz.explain) || "Revisa la solución paso a paso." })
        ]));
      } else if (c.quizRetried) {
        card.appendChild(el("div", { class: "explain" }, [
          el("b", { text: "Has acertado, pero a la segunda. " }),
          el("span", { text: "El método se anota como fallado: queda en el cuaderno." })
        ]));
      }
      var row = el("div", { class: "btn-row" });
      // Fallando el método NO se pasa al siguiente problema: hay que
      // intentarlo otra vez. «Saltar» (siempre libre, arriba) es la salida.
      if (c.quizFailed) {
        row.appendChild(el("button", {
          class: "btn", onclick: function () { onRetryQuiz(); }
        }, "Reintentar método"));
        row.appendChild(el("button", {
          class: "btn btn-ghost",
          onclick: function () { c.solutionOpen = true; guardar(); render(); }
        }, "Ver solución"));
      } else {
        row.appendChild(el("button", {
          class: "btn btn-primary", onclick: function () { onNext(); }
        }, "Siguiente problema →"));
      }
      card.appendChild(row);
    }
    return card;
  }

  /* --- Solución paso a paso ------------------------------------------ */

  function cardSolution() {
    var L = motor();
    var p = c.problem;
    var card = el("div", { class: "card panel-solution" });
    card.appendChild(el("div", { class: "row row-wrap" }, [
      el("div", { class: "grow" }, [
        el("div", { style: "font-weight:700", text: "Solución paso a paso" }),
        el("div", { class: "small muted", text: "Léela antes de volver a intentarlo." })
      ]),
      el("button", {
        class: "btn btn-sm btn-ghost",
        onclick: function () { c.solutionOpen = false; render(); }
      }, "Ocultar")
    ]));

    var host = el("div");
    var html = "";
    try { if (L && typeof L.solutionHtml === "function") html = L.solutionHtml(p); }
    catch (e) { html = ""; }

    if (html) {
      // El motor devuelve HTML de confianza: se parsea en un <template>
      // inerte y se importa; nunca se asigna a un nodo vivo.
      var tpl = document.createElement("template");
      tpl.innerHTML = html;
      var slots = tpl.content.querySelectorAll(".mathslot[data-math]");
      for (var i = 0; i < slots.length; i++) {
        var idx = Number(slots[i].getAttribute("data-math"));
        var step = (p.steps || [])[idx];
        var real = step && step.math ? exprMath(step.math) : el("span", { class: "muted", text: "—" });
        if (slots[i].parentNode) slots[i].parentNode.replaceChild(real, slots[i]);
      }
      quitarTituloDuplicado(tpl.content);
      host.appendChild(document.importNode(tpl.content, true));
    } else {
      host.appendChild(solucionRespaldo(p));
    }

    resaltarClave(host, p);

    // El motor escribe la respuesta en su formato crudo: la prettificamos.
    var fuerte = host.querySelector(".sol-head strong, .sol-final strong");
    if (fuerte) fuerte.textContent = pretty(respuestaLegible(p.answer));

    card.appendChild(host);
    return card;
  }

  function resaltarClave(host, p) {
    var key = num(p.keyStep, -1);
    var steps = host.querySelectorAll(".step");
    var numerado = false;
    for (var j = 0; j < steps.length; j++) {
      var raw = steps[j].getAttribute("data-step");
      var pos = (raw === null || raw === undefined) ? j : Number(raw);
      var isKey = (key >= 0) ? (pos === key) : steps[j].classList.contains("key");
      steps[j].classList.toggle("is-key", isKey);
      if (isKey && !steps[j].querySelector(".step-badge")) {
        var t = steps[j].querySelector(".step-t") || steps[j].querySelector(".step-title");
        if (t) t.appendChild(el("span", { class: "step-badge", text: "clave" }));
      }
      if (steps[j].querySelector(".step-n")) numerado = true;
    }
    if (numerado) {
      var lista = host.querySelector(".sol-steps") || host.querySelector(".steps") || host;
      lista.classList.add("engine-numbered");
    }
  }

  function quitarTituloDuplicado(frag) {
    var heads = frag.querySelectorAll ? frag.querySelectorAll(".sol-head") : [];
    for (var i = 0; i < heads.length; i++) {
      var t = (heads[i].textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!heads[i].querySelector("strong") &&
          (t.indexOf("solución") >= 0 || t.indexOf("solucion") >= 0)) {
        if (heads[i].parentNode) heads[i].parentNode.removeChild(heads[i]);
      }
    }
  }

  function solucionRespaldo(p) {
    var box = el("div");
    box.appendChild(el("p", { class: "sol-head" }, [
      el("span", { text: "Respuesta correcta: " }),
      el("strong", { text: pretty(respuestaLegible(p.answer)) })
    ]));
    var list = el("ol", { class: "sol-steps" });
    var steps = p.steps || [];
    for (var i = 0; i < steps.length; i++) {
      (function (s, pos) {
        var li = el("li", {
          class: "step" + (pos === p.keyStep ? " is-key" : ""),
          dataset: { step: String(pos) }
        }, [
          el("div", { class: "step-t", text: txt(s.title) || ("Paso " + (pos + 1)) }),
          s.detail ? el("div", { class: "step-d", text: txt(s.detail) }) : null,
          s.math ? el("div", { class: "step-m" }, exprMath(s.math)) : null
        ]);
        if (pos === p.keyStep) {
          var t = li.querySelector(".step-t");
          if (t) t.appendChild(el("span", { class: "step-badge", text: "clave" }));
        }
        list.appendChild(li);
      })(steps[i], i);
    }
    box.appendChild(list);
    return box;
  }

  /** Autocompletado: el último campo útil según el tipo de respuesta. */
  function autocompletar(problema) {
    var ans = problema && problema.answer;
    if (!ans) return "";
    if (ans.kind === "infinite") return ans.sign < 0 ? "-" : "+";
    if (ans.kind === "dne") return "";
    if (ans.kind === "rational") {
      var v = ans.value;
      if (v && v.d !== undefined && String(v.d) !== "1") return "/";
      return "";
    }
    return "";
  }

  /* =====================================================================
   * 12. Pantallas
   * ===================================================================== */

  function statCell(valor, etiqueta) {
    return el("div", { class: "stat-cell" }, [
      el("b", { text: String(valor) }), el("span", { text: etiqueta })
    ]);
  }

  function estrellasMini(n) {
    var box = el("span", { class: "stars", "aria-hidden": "true" });
    for (var i = 1; i <= 3; i++) {
      box.appendChild(el("span", { class: n >= i ? "on" : "off", text: "★" }));
    }
    return box;
  }

  /* --- Bienvenida ---------------------------------------------------- */

  function pantallaBienvenida() {
    var wrap = el("div");
    wrap.appendChild(el("div", { class: "screen-head" }, [
      el("h1", { class: "screen-title", text: "Juego" }),
      el("p", { class: "screen-sub", text: "Elige nivel y practica 10 problemas. Cada acierto incluye un interrogatorio de método; lo que no te salga entra en el cuaderno." })
    ]));

    var grid = el("div", { class: "levels" });
    var lista = niveles();
    for (var i = 0; i < lista.length; i++) grid.appendChild(tarjetaNivel(lista[i]));
    if (!lista.length) {
      wrap.appendChild(el("div", { class: "notice notice-warn" }, [
        el("span", { class: "notice-ico", text: "!" }),
        el("span", { text: "El motor no ha cargado: no hay niveles disponibles." })
      ]));
    }
    wrap.appendChild(grid);

    var acciones = el("div", { class: "btn-row", style: "margin-top:16px" });
    acciones.appendChild(el("button", {
      class: "btn btn-primary", onclick: function () { arrancarNivelElegido(); }
    }, "Empezar"));
    if (cuaderno().length > 0) {
      acciones.appendChild(el("button", {
        class: "btn", onclick: function () { arrancarCuaderno(false); }
      }, "Practicar el cuaderno (" + cuaderno().length + ")"));
    }
    acciones.appendChild(el("a", { class: "btn btn-ghost", href: "campana.html" }, "Campaña"));
    acciones.appendChild(el("a", { class: "btn btn-ghost", href: "index.html" }, "Inicio"));
    wrap.appendChild(acciones);

    var s = estado().stats;
    wrap.appendChild(el("div", { class: "stat-strip" }, [
      statCell(s.solved, "resueltos"),
      statCell(s.correct, "perfectos"),
      statCell(s.streak, "racha"),
      statCell(s.xp, "XP")
    ]));

    wrap.appendChild(UI.ajustes(function () { render(); }));
    return wrap;
  }

  function tarjetaNivel(nivel) {
    var rec = estado().campaign[nivel.id] || null;
    var total = num(nivel.total, 10);
    var card = el("button", {
      class: "level" + (rec && rec.passed ? " passed" : ""),
      type: "button",
      "aria-pressed": nivelElegido === nivel.id ? "true" : "false",
      title: "Nivel " + nivel.n + ": " + nivel.name
    }, [
      el("div", { class: "level-top" }, [
        el("span", { class: "level-n", text: String(nivel.n) }),
        el("span", { class: "level-name", text: txt(nivel.name) })
      ]),
      el("div", { class: "level-meta" }, [
        el("span", { text: rec ? rec.best.num + "/" + total + " núm." : total + " problemas" }),
        estrellasMini(rec ? rec.stars : 0)
      ])
    ]);
    card.addEventListener("click", function () {
      nivelElegido = nivel.id;
      render();
    });
    return card;
  }

  function arrancarNivelElegido() {
    var lista = niveles();
    var id = (nivelElegido && nivelPorId(nivelElegido)) ? nivelElegido
      : (lista.length ? lista[0].id : null);
    if (!id) { arrancarLibre(); return; }
    arrancarPartida({ levelId: id, free: false });
  }

  /* --- Resumen ------------------------------------------------------- */

  function pantallaResumen() {
    var total = run.total;
    var req = num(run.required, 8);
    var wrap = el("div");

    var passed = run.required > 0 && run.numOk >= req && run.metOk >= req;
    var stars = starsFor(run.numOk, run.metOk, total);

    var card = el("div", { class: "card finish" });
    var starRow = el("div", { class: "finish-stars", "aria-label": stars + " de 3 estrellas" });
    var starBox = el("span", { class: "stars" });
    for (var i = 1; i <= 3; i++) {
      starBox.appendChild(el("span", { class: stars >= i ? "on" : "off", text: "★" }));
    }
    starRow.appendChild(starBox);
    card.appendChild(starRow);

    card.appendChild(el("div", {
      class: "finish-title",
      text: passed ? "¡Nivel superado!" : "Partida terminada"
    }));
    card.appendChild(el("div", {
      class: "screen-sub",
      text: passed
        ? "Has superado el nivel. Se ha desbloqueado el siguiente."
        : (run.required > 0
          ? "Te faltan " + req + " aciertos de número y " + req + " de método."
          : "Repasa el cuaderno y vuelve a intentarlo: ahora sabes dónde fallaste.")
    }));

    card.appendChild(el("div", { class: "finish-score" }, [
      el("div", {}, [el("b", { text: run.numOk + "/" + total }), el("span", { text: "número" })]),
      el("div", {}, [el("b", { text: run.metOk + "/" + total }), el("span", { text: "método" })]),
      el("div", {}, [el("b", { text: "+" + run.xp }), el("span", { text: "XP ganados" })]),
      el("div", {}, [el("b", { text: "🔥" + estado().stats.streak }), el("span", { text: "racha" })])
    ]));

    // Porcentaje por tópico de ESTA partida.
    var temas = run.tema || {};
    var claves = Object.keys(temas);
    if (claves.length) {
      claves.sort(function (a, b) { return temas[b].total - temas[a].total; });
      var tabla = el("div", { class: "table-wrap", style: "margin-top:14px" });
      var t = el("table", { class: "table" });
      t.appendChild(el("thead", {}, el("tr", {}, [
        el("th", { text: "Tópico" }), el("th", { text: "Número" }), el("th", { text: "%" })
      ])));
      var tb = el("tbody");
      for (var k = 0; k < claves.length; k++) {
        var info = temas[claves[k]];
        tb.appendChild(el("tr", {}, [
          el("td", {}, chipTopic(claves[k])),
          el("td", { class: "mono", text: info.ok + "/" + info.total }),
          el("td", { class: "mono", text: pct(info.ok, info.total) + "%" })
        ]));
      }
      t.appendChild(tb);
      tabla.appendChild(t);
      card.appendChild(tabla);
    }

    var rec = run.levelId ? estado().campaign[run.levelId] : null;
    if (rec) {
      card.appendChild(el("div", {
        class: "small muted", style: "margin-top:12px",
        text: "Mejor marca del nivel: " + rec.best.num + "/" + total + " en número y " +
              rec.best.met + "/" + total + " en método (" + rec.stars + "★)."
      }));
    }
    if (run.lastHow) {
      card.appendChild(el("div", { style: "margin-top:10px" }, [
        el("span", {
          class: "chip " + (CLASE_HOW[run.lastHow] || ""),
          text: "Último problema: " + (ETIQUETA_HOW[run.lastHow] || run.lastHow)
        })
      ]));
    }

    var nextId = siguienteNivelId(run.levelId);
    var puedeSiguiente = !!(nextId && !run.free && passed);
    var acciones = el("div", { class: "btn-row", style: "margin-top:18px" });
    if (puedeSiguiente) {
      acciones.appendChild(el("button", {
        class: "btn btn-primary",
        onclick: function () { arrancarPartida({ levelId: nextId, free: false }); }
      }, "Siguiente nivel →"));
    }
    acciones.appendChild(el("button", {
      class: "btn" + (puedeSiguiente ? "" : " btn-primary"),
      onclick: function () {
        if (run.levelId) arrancarPartida({ levelId: run.levelId, free: run.free });
        else arrancarLibre();
      }
    }, "Otra vez"));
    if (cuaderno().length) {
      acciones.appendChild(el("button", {
        class: "btn", onclick: function () { arrancarCuaderno(false); }
      }, "Practicar el cuaderno"));
    }
    acciones.appendChild(el("a", { class: "btn btn-ghost", href: "cuaderno.html" }, "Cuaderno"));
    acciones.appendChild(el("a", { class: "btn btn-ghost", href: "index.html" }, "Inicio"));
    card.appendChild(acciones);
    wrap.appendChild(card);

    if (run.levelId && campanaCompleta()) {
      wrap.appendChild(el("div", { class: "notice notice-accent", style: "margin-top:14px" }, [
        el("span", { class: "notice-ico", text: "🏆" }),
        el("span", { text: "¡Campaña completada! Has superado los diez niveles. Ahora a por la matrícula de honor." })
      ]));
    }
    return wrap;
  }

  /* --- Problema ------------------------------------------------------ */

  function pantallaProblema() {
    var wrap = el("div");
    wrap.appendChild(headerPartida());

    if (c && c.isReview) {
      wrap.appendChild(el("div", { class: "notice notice-warn review-banner" }, [
        el("span", { class: "notice-ico", text: "↻" }),
        UI.chip("Repaso de un fallo tuyo", "warn"),
        el("span", { class: "small", text: "Si lo fallas otra vez, se rompe la racha." })
      ]));
    }

    if (!c) {
      wrap.appendChild(el("div", { class: "card" }, [
        el("div", { class: "empty" }, [
          el("div", { class: "empty-mark", text: "∫" }),
          el("div", { class: "empty-title", text: "No hay ningún problema activo" }),
          el("div", { class: "small", text: "Empieza una partida nueva." }),
          el("div", { style: "margin-top:14px" }, [
            el("button", {
              class: "btn btn-primary",
              onclick: function () { run = null; nivelElegido = niveles().length ? niveles()[0].id : null; guardar(); render(); }
            }, "Volver al inicio")
          ])
        ])
      ]));
    } else {
      wrap.appendChild(cardProblema());
      wrap.appendChild(cardAnswer());
      var fb = cardFeedback();
      if (fb) wrap.appendChild(fb);
      if (c.phase === "quiz" || c.quizAnswered) {
        var q = cardQuiz();
        if (q) wrap.appendChild(q);
      }
      if (c.solutionOpen) wrap.appendChild(cardSolution());
    }

    if (ajustesAbiertos) wrap.appendChild(UI.ajustes(function () { render(); }));
    return wrap;
  }

  /* =====================================================================
   * 13. Render
   * ===================================================================== */

  /**
   * La cabecera la pinta UI.pagina una sola vez, pero la racha y los XP
   * cambian al responder: la refrescamos para que no se queden viejos.
   */
  function refrescarCabecera() {
    var vieja = document.querySelector(".topbar");
    if (!vieja || !vieja.parentNode) return;
    var nueva = UI.cabecera("juego");
    if (nueva) vieja.parentNode.replaceChild(nueva, vieja);
  }

  function render() {
    if (!raiz || renderizando) return;   // guarda contra la recursión de UI.ajustes
    renderizando = true;
    try {
      refrescarCabecera();
      raiz.textContent = "";
      var contenido = !run ? pantallaBienvenida()
        : run.finished ? pantallaResumen()
          : pantallaProblema();
      UI.append(raiz, contenido);
      if (run && !run.finished && c) enfocarCampo();
    } finally {
      renderizando = false;
    }
  }

  function enfocarCampo() {
    setTimeout(function () {
      var f = document.getElementById("answer-field");
      if (f && !f.disabled && f.offsetParent !== null) {
        try { f.focus({ preventScroll: true }); }
        catch (e) { try { f.focus(); } catch (e2) { /* sin foco */ } }
      }
    }, 40);
  }

  /* =====================================================================
   * 14. Teclado
   * ===================================================================== */

  var teclasLigadas = false;

  function onKey(ev) {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    var tag = (ev.target && ev.target.tagName) || "";
    // Dentro de un campo de texto cada tecla es del alumno.
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
      if (ev.key === "Escape" && ev.target.blur) ev.target.blur();
      return;
    }
    if (!run || run.finished || !c) return;

    if (ev.key === "Enter") {
      if (c.phase === "answer") { ev.preventDefault(); onCheck(); }
      else if (c.phase === "quiz" && c.quizAnswered && !c.quizFailed) { ev.preventDefault(); onNext(); }
      return;
    }
    if (ev.key === "s" || ev.key === "S") { ev.preventDefault(); onShowSolution(); return; }
    if (ev.key === "n" || ev.key === "N") { ev.preventDefault(); onSkip(); return; }
    if (/^[1-4]$/.test(ev.key)) {
      var i = Number(ev.key) - 1;
      // 1–4 sólo con las opciones visibles.
      if (c.phase === "answer" && c.optionsShown && !c.optionsLocked && i < (c.options || []).length) {
        ev.preventDefault(); onPickOption(i); return;
      }
      // En el interrogatorio de método, 1–4 eligen la técnica.
      if (c.phase === "quiz" && !c.quizAnswered && c.problem.quiz &&
          i < c.problem.quiz.options.length) {
        ev.preventDefault(); onAnswerQuiz(i); return;
      }
    }
  }

  function ligarTeclado() {
    if (teclasLigadas) return;
    teclasLigadas = true;
    document.addEventListener("keydown", onKey, false);
  }

  /* =====================================================================
   * 15. Arranque de la página
   * ===================================================================== */

  /**
   * Puente con las otras páginas: se acepta
   *   juego.html?nivel=sustituir[&libre=1]   arranca ese nivel
   *   juego.html?cuaderno=1[&uno=1]          arranca una sesión de cuaderno
   */
  function leerPedido() {
    try {
      var q = (global.location && global.location.search) || "";
      var salida = {};
      q.replace(/^\?/, "").split("&").forEach(function (par) {
        if (!par) return;
        var kv = par.split("=");
        salida[decodeURIComponent(kv[0] || "")] = decodeURIComponent((kv[1] || "").replace(/\+/g, " "));
      });
      if (salida.cuaderno === "1" || salida.cuaderno === "true") {
        return { cuaderno: true, uno: salida.uno === "1" || salida.uno === "true" };
      }
      if (salida.nivel) {
        return { nivel: salida.nivel, libre: salida.libre === "1" || salida.libre === "true" };
      }
    } catch (e) { /* sin location */ }
    return null;
  }

  function limpiarUrl() {
    try {
      if (global.history && global.history.replaceState && global.location) {
        global.history.replaceState(null, "", global.location.pathname);
      }
    } catch (e) { /* file:// no lo permite */ }
  }

  function construirJuego(elMain) {
    raiz = elMain;
    ligarTeclado();

    run = leerRunGuardado();
    // Una partida terminada no se arrastra: se ofrece la bienvenida.
    if (run && run.finished) { run = null; estado().run = null; UI.guardar(); }
    if (!run) nivelElegido = niveles().length ? niveles()[0].id : null;

    var pedido = leerPedido();
    if (pedido && pedido.cuaderno && cuaderno().length) {
      arrancarCuaderno(pedido.uno);
      limpiarUrl();
      return;
    }
    if (pedido && pedido.nivel && nivelPorId(pedido.nivel)) {
      nivelElegido = pedido.nivel;
      arrancarPartida({ levelId: pedido.nivel, free: pedido.libre });
      limpiarUrl();
      return;
    }

    // Partida reanudada: el motor es determinista, así que la semilla guardada
    // reconstruye exactamente el mismo enunciado.
    if (run) generarSiguiente();
    else render();
  }

  /* =====================================================================
   * 16. API pública
   * ===================================================================== */

  global.construirJuego = construirJuego;
  global.Juego = {
    arrancarPartida: arrancarPartida,
    arrancarLibre: arrancarLibre,
    arrancarCuaderno: arrancarCuaderno,
    render: render,
    estado: function () { return { run: run, c: c }; }
  };

  /* =====================================================================
   * 17. Desviaciones respecto al contrato y al comportamiento de app.js
   * ---------------------------------------------------------------------
   * 1) `Problem.options` no existe en CONTRACT.md. Las 4 opciones las
   *    construye la página con `Lim.answerToString(problem.answer)` +
   *    los distractores, barajadas con `Lim.rng(seed ^ 0x5f3a)` para que
   *    sean estables. Si el motor aporta `problem.options` con 4 entradas,
   *    se usan tal cual.
   *
   * 2) `Lim.solutionHtml()` se parsea en un `<template>` inerte y nunca se
   *    asigna a un nodo vivo. Se rellenan los huecos `.mathslot[data-math]`
   *    con MathML real. El motor actual serializa su propio MathML dentro
   *    del HTML, así que el parser HTML lo crea en el namespace correcto.
   *    Si `solutionHtml` falla, se reconstruye con `problem.steps`.
   *
   * 3) `Lim.targetLabel()` devuelve "x → +infinito"; aquí se prettifica a
   *    "x → +∞" y el signo del punto se pasa a "−" tipográfico.
   *
   * 4) XP (spec): se conceden al CERRAR el problema, no al comprobar, para
   *    que la tabla se cumpla exactamente: acierto 15 · fallo de método 10 ·
   *    aided 0 · fallo/saltado/visto solución 0. app.js daba 10 al
   *    comprobar y dejaba 10 en «ayudado»; aquí no.
   *
   * 5) `run.numOk` y `stats.byTopic[topic].ok` cuentan también el
   *    «fallo de método»: el número estaba bien (la spec le da +10 XP) y
   *    §9 mide número y método por separado. app.js no lo contaba.
   *
   * 6) `Lim.ast.toMathML()` devuelve la raíz <math> con display="inline".
   *    Para el enunciado completo ("lim" con el objetivo debajo + expresión)
   *    se deshace esa raíz y se mete el contenido en un <math> propio, todo
   *    pasado por `UI.math`. Un nodo suelto sin raíz no lo pinta el
   *    navegador.
   *
   * 7) Puente con las demás páginas: `juego.html?nivel=ID[&libre=1]` y
   *    `juego.html?cuaderno=1[&uno=1]`. El parámetro se limpia de la URL.
   *
   * 8) `estado.run` guarda la partida para poder reanudarla. El problema NO
   *    se serializa (contiene BigInt y nodos MathML): se guardan su semilla
   *    y su generador, que son deterministas, y se reconstruye al volver.
   *    Una partida terminada no se arrastra: se ofrece la bienvenida.
   * ===================================================================== */

})(window);