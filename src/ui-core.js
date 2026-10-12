/* =====================================================================
 * src/ui-core.js — núcleo compartido por TODAS las páginas.
 *
 * No es una copia de app.js: es la capa mínima que necesitan por igual
 * portada, campaña, juego, cuaderno y teoría. Cada página tiene su propio
 * fichero (src/pagina-*.js) y esta base se la da por igual.
 *
 * Expone:  window.UI
 * Depende de: window.Lim (motor) — cargarlo antes que las páginas.
 *
 * ---------------------------------------------------------------------
 * ⚠ ORDEN DE CARGA — LEE ESTO ANTES DE TOCAR NINGÚN .html NI build.mjs
 * ---------------------------------------------------------------------
 *   engine.js → i18n.js → ui-core.js → pagina-*.js
 *
 * i18n.js tiene que cargarse **ANTES** que este fichero, porque ui-core
 * pinta textos en cuanto arranca (cabecera, pie, ajustes). Si se carga
 * después, la primera pasada lo haría en español y, al no reavisar, la
 * página se quedaría a medias.
 *
 * Hasta que los .html actuales incluyan i18n.js, este fichero no se rompe:
 * usa el respaldo mínimo en español (RESPALDO_ES) de más abajo. En cuanto
 * i18n.js esté en la lista, manda I18N y el respaldo queda sin uso.
 * ===================================================================== */
(function (global) {
  "use strict";

  /* ---------- i18n: acceso tolerante ---------------------------------- */
  /*
   * RESPALDO_ES: sólo las claves que usa ui-core.js, para que las páginas
   * actuales (que todavía no cargan i18n.js) sigan mostrando exactamente
   * lo mismo. Es un puente, no el diccionario: cuando i18n.js esté en el
   * orden de carga, este bloque es muerto y se puede borrar.
   */
  var RESPALDO_ES = {
    "nav.inicio": "Inicio",
    "nav.campana": "Campaña",
    "nav.juego": "Juego",
    "nav.cuaderno": "Cuaderno",
    "nav.teoria": "Teoría",
    "nav.secciones": "Secciones",
    "app.marca": "Límites",
    "app.pie": "Límites y continuidad · 2º de Bachillerato",
    "app.borrar": "Borrar progreso",
    "app.borrarConfirm": "¿Borrar todo el progreso (racha, campaña y cuaderno)?",
    "cab.racha": "Racha",
    "cab.xp": "Puntos de experiencia",
    "idioma.titulo": "Idioma",
    "idioma.es": "Español",
    "idioma.ca": "Català",
    "ajustes.titulo.modo": "Cómo respondo — modo",
    "ajustes.titulo.politica": "Cuándo veo las opciones — política",
    "ajustes.modo.escribir.nombre": "escribir",
    "ajustes.modo.escribir.sub": "Solo escribes la respuesta",
    "ajustes.modo.opciones.nombre": "opciones",
    "ajustes.modo.opciones.sub": "Solo eliges entre 4",
    "ajustes.modo.mixto.nombre": "mixto",
    "ajustes.modo.mixto.sub": "Alterna al azar",
    "ajustes.politica.visible.nombre": "visible",
    "ajustes.politica.visible.sub": "Siempre a la vista",
    "ajustes.politica.boton.nombre": "botón",
    "ajustes.politica.boton.sub": "A pedido",
    "ajustes.politica.examen.nombre": "examen",
    "ajustes.politica.examen.sub": "Tras un intento",
    "ajustes.aviso.mixto": "Cada problema elige al azar entre escribir y elegir. La política se aplica al tipo que toque en ese problema.",
    "ajustes.aviso.escribir.visible": "Escribes tú. Las opciones no se muestran en absoluto.",
    "ajustes.aviso.escribir.boton": "Escribes tú. Puedes pedir ver las opciones como pista.",
    "ajustes.aviso.escribir.examen": "Escribes tú, sin opciones. Es el modo examen.",
    "ajustes.aviso.opciones.visible": "Eliges entre 4 opciones, visibles desde el principio.",
    "ajustes.aviso.opciones.boton": "Las opciones están ocultas hasta que pidas verlas.",
    "ajustes.aviso.opciones.examen": "Primero escribes y compruebas. Si fallas, las opciones quedan bloqueadas para siempre.",
    "ui.ahora": "ahora mismo",
    "ui.hace": "hace {n} {u}",
    "ui.meses": "meses",
    "ui.un.min": "min",
    "ui.un.hora": "h",
    "ui.un.dia": "d",
    "ui.error": "No se ha podido pintar la página."
  };

  /** Sustituye {nombre} por su valor. Mismo comportamiento que I18N.t. */
  function sustituir(s, vars) {
    if (!vars) return s;
    return String(s).replace(/\{(\w+)\}/g, function (todo, nombre) {
      return vars[nombre] !== undefined && vars[nombre] !== null ? String(vars[nombre]) : todo;
    });
  }

  /** Traduce una clave. Sin i18n.js cae al respaldo en español. */
  function t(clave, vars) {
    var I = global.I18N;
    if (I && typeof I.t === "function") return I.t(clave, vars);
    var s = RESPALDO_ES[clave];
    if (s === undefined) s = clave;
    return sustituir(s, vars);
  }

  /** Idioma activo: "es" o "ca". */
  function idioma() {
    var I = global.I18N;
    return (I && typeof I.actual === "function") ? I.actual() : "es";
  }

  /** Los dos idiomas, si i18n.js está; si no, los dos de siempre. */
  function escenas() {
    var I = global.I18N;
    return (I && I.escenas && I.escenas.length) ? I.escenas : ["es", "ca"];
  }

  /** Cambia el idioma, lo guarda y vuelve a pintar la página (URL intacta). */
  function cambiarIdioma(lang) {
    var I = global.I18N;
    if (!I || typeof I.fijar !== "function") return idioma();
    I.fijar(lang);
    I.recargar();
    return idioma();
  }

  /* ---------- constantes --------------------------------------------- */

  var STORE_KEY = "limites:v1";
  var MODOS = ["escribir", "opciones", "mixto"];
  var POLITICAS = ["visible", "boton", "examen"];
  /* `label` conserva el texto en español (API antigua); `clave` es lo que
   * se pinta. Si algún día falta i18n.js, se usa `label`. */
  var PAGINAS = [
    { id: "portada",  href: "index.html",    label: "Inicio",   clave: "nav.inicio" },
    { id: "campana",  href: "campana.html",  label: "Campaña",  clave: "nav.campana" },
    { id: "juego",    href: "juego.html",    label: "Juego",    clave: "nav.juego" },
    { id: "cuaderno", href: "cuaderno.html", label: "Cuaderno", clave: "nav.cuaderno" },
    { id: "teoria",   href: "teoria.html",   label: "Teoría",   clave: "nav.teoria" }
  ];

  /* ---------- creación de DOM --------------------------------------- */

  function el(tag, props, hijos) {
    var n = document.createElement(tag);
    if (props) {
      for (var k in props) {
        var v = props[k];
        if (v == null || v === false) continue;
        if (k === "class") n.className = v;
        else if (k === "text") n.textContent = v;
        else if (k === "html") n.innerHTML = v;
        else if (k === "style") n.setAttribute("style", v);
        else if (k.slice(0, 2) === "on" && typeof v === "function") n.addEventListener(k.slice(2), v);
        else if (k === "dataset") { for (var d in v) n.dataset[d] = v[d]; }
        else n.setAttribute(k, v === true ? "" : v);
      }
    }
    append(n, hijos);
    return n;
  }

  function append(padre, hijos) {
    if (hijos == null) return padre;
    if (!Array.isArray(hijos)) hijos = [hijos];
    for (var i = 0; i < hijos.length; i++) {
      var h = hijos[i];
      if (h == null || h === false) continue;
      padre.appendChild(typeof h === "string" || typeof h === "number"
        ? document.createTextNode(String(h)) : h);
    }
    return padre;
  }

  /* ---------- MathML ------------------------------------------------- */

  var NS_MATH = "http://www.w3.org/1998/Math/MathML";

  /** Envuelve un nodo del motor en la raíz <math> que el navegador exige. */
  function math(node) {
    if (!node || !global.Lim) return el("span", { class: "math", text: "…" });
    var m = document.createElementNS(NS_MATH, "math");
    m.setAttribute("display", "inline");
    var nodo = node;
    // El motor puede devolver un nodo suelto o un <math> ya hecho.
    if (nodo.nodeName && String(nodo.nodeName).toLowerCase() === "math") return nodo;
    m.appendChild(nodo);
    return m;
  }

  /** Atajo: construye el <math> a partir de un nodo del motor. */
  function mathDe(nodo) { return math(nodo); }

  /* ---------- estado persistente ------------------------------------- */

  var estado = null;

  function porDefecto() {
    return {
      version: 1,
      settings: { modo: "mixto", politica: "boton" },
      stats: { solved: 0, correct: 0, streak: 0, bestStreak: 0, xp: 0, byTopic: {} },
      campaign: {},
      notebook: [],
      run: null
    };
  }

  function sanea(d) {
    var base = porDefecto();
    if (!d || typeof d !== "object") return base;
    if (d.settings) {
      if (MODOS.indexOf(d.settings.modo) >= 0) base.settings.modo = d.settings.modo;
      if (POLITICAS.indexOf(d.settings.politica) >= 0) base.settings.politica = d.settings.politica;
    }
    if (d.stats && typeof d.stats === "object") {
      for (var k in base.stats) {
        var v = d.stats[k];
        if (k === "byTopic") base.stats.byTopic = (v && typeof v === "object") ? v : {};
        else if (typeof v === "number" && isFinite(v)) base.stats[k] = Math.max(0, Math.round(v));
      }
    }
    if (d.campaign && typeof d.campaign === "object") base.campaign = d.campaign;
    if (Array.isArray(d.notebook)) {
      base.notebook = d.notebook.filter(function (e) {
        return e && typeof e === "object" && e.generatorId && !e.resolved;
      }).map(function (e) {
        return {
          seed: Number(e.seed) || 0,
          generatorId: String(e.generatorId),
          attempts: Math.max(1, Number(e.attempts) || 1),
          lastTs: Number(e.lastTs) || Date.now(),
          resolved: false,
          howClosed: String(e.howClosed || "fallo")
        };
      });
    }
    if (d.run && typeof d.run === "object") base.run = d.run;
    return base;
  }

  /** Lee el estado. Nunca lanza: si el JSON está corrupto, empieza limpio. */
  function cargar() {
    if (estado) return estado;
    try {
      var crudo = localStorage.getItem(STORE_KEY);
      estado = sanea(crudo ? JSON.parse(crudo) : null);
    } catch (e) {
      estado = porDefecto();
    }
    return estado;
  }

  function guardar() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(cargar())); return true; }
    catch (e) { return false; }   // modo privado, cuota llena…
  }

  function reiniciar() { estado = porDefecto(); guardar(); return estado; }

  /* ---------- cabecera y navegación ---------------------------------- */

  /** Interruptor de idioma: dos botones, `Español` / `Català`. */
  function interruptorIdioma() {
    var ahora = idioma();
    return el("div", {
      class: "seg lang-switch",
      role: "group",
      "aria-label": t("idioma.titulo"),
      title: t("idioma.titulo"),
      style: "flex:0 0 auto"
    }, escenas().map(function (code) {
      return el("button", {
        type: "button",
        class: "seg-btn",
        // `lang` propio para que el corrector y el lector de pantalla
        // traten «Català» como catalán aunque la página esté en español.
        lang: code,
        "aria-pressed": ahora === code ? "true" : "false",
        style: "font-size:.8rem;padding:4px 9px",
        onclick: function () { cambiarIdioma(code); }
      }, t("idioma." + code));
    }));
  }

  function cabecera(paginaActual) {
    var st = cargar();
    var marca = el("span", { class: "brand-mark", text: "∫" });
    var enEs = { streak: Math.max(0, st.stats.streak | 0), xp: Math.max(0, st.stats.xp | 0) };

    var nav = el("nav", { class: "nav", "aria-label": t("nav.secciones") },
      PAGINAS.map(function (p) {
        return el("a", {
          class: "nav-link" + (p.id === paginaActual ? " is-active" : ""),
          href: p.href,
          "aria-current": p.id === paginaActual ? "page" : null,
          text: p.clave ? t(p.clave) : p.label
        });
      }));

    return el("header", { class: "topbar" }, [
      el("div", { class: "topbar-inner" }, [
        el("a", { class: "brand", href: "index.html" }, [marca, el("span", { class: "brand-name", text: t("app.marca") })]),
        nav,
        interruptorIdioma(),
        el("div", { class: "topbar-stats", "aria-live": "polite" }, [
          el("span", { class: "stat stat-streak", title: t("cab.racha") }, ["🔥 ", el("b", { text: String(enEs.streak) })]),
          el("span", { class: "stat stat-xp", title: t("cab.xp") }, ["✨ ", el("b", { text: String(enEs.xp) }), " XP"])
        ])
      ])
    ]);
  }

  /** El título que pasan los .html ("Juego", "Teoría"…) en su idioma. */
  function tituloPantalla(titulo) {
    var I = global.I18N;
    if (I && typeof I.titulo === "function") {
      try { return I.titulo(titulo); } catch (e) { /* cae al título tal cual */ }
    }
    return titulo;
  }

  /** Monta el esqueleto de una página: cabecera + contenido + pie. */
  function pagina(paginaActual, titulo, contenido) {
    var root = document.getElementById("app") || document.body;
    /* La clase `app` es la que da el ancho máximo y el margen lateral.
     * Sin ella la página salía pegada a los bordes de la pantalla. */
    if (!/(^|\s)app(\s|$)/.test(root.className || "")) {
      root.className = ((root.className || "") + " app").trim();
    }
    /* Cada página puede ensanchar su propio contenedor desde el <body>. */
    if (!/(^|\s)pag-/.test(document.body.className || "")) {
      document.body.className = (document.body.className + " pag-" + paginaActual).trim();
    }
    root.textContent = "";
    root.appendChild(cabecera(paginaActual));
    var main = el("main", { class: "screen screen-" + paginaActual });
    append(main, contenido);
    root.appendChild(main);
    root.appendChild(el("footer", { class: "foot" }, [
      el("span", { text: t("app.pie") }),
      el("button", {
        class: "linkish", type: "button",
        onclick: function () {
          if (confirm(t("app.borrarConfirm"))) reiniciar();
        },
        text: t("app.borrar")
      })
    ]));
    document.title = tituloPantalla(titulo) + " — " + t("app.marca");
    return main;
  }

  /* ---------- ajustes ------------------------------------------------ */

  function ajustes(render) {
    var st = cargar();
    var aviso = el("p", { class: "note-note" });

    function refrescar() {
      var s = cargar().settings;
      aviso.textContent = s.modo === "mixto"
        ? t("ajustes.aviso.mixto")
        : t("ajustes.aviso." + s.modo + "." + s.politica);
      if (render) render();
    }

    var grupoModo = el("div", { class: "seg" }, MODOS.map(function (m) {
      return el("button", {
        type: "button", class: "seg-btn", dataset: { modo: m },
        "aria-pressed": st.settings.modo === m ? "true" : "false",
        onclick: function () { cargar().settings.modo = m; guardar(); refrescar(); }
      }, [el("b", { text: t("ajustes.modo." + m + ".nombre") }),
          el("span", { class: "seg-sub", text: subModo(m) })]);
    }));

    var grupoPol = el("div", { class: "seg" }, POLITICAS.map(function (p) {
      return el("button", {
        type: "button", class: "seg-btn", dataset: { pol: p },
        "aria-pressed": st.settings.politica === p ? "true" : "false",
        onclick: function () { cargar().settings.politica = p; guardar(); refrescar(); }
      }, [el("b", { text: t("ajustes.politica." + p + ".nombre") }),
          el("span", { class: "seg-sub", text: subPol(p) })]);
    }));

    refrescar();

    return el("section", { class: "card ajustes" }, [
      el("h2", { class: "ajustes-title", text: t("ajustes.titulo.modo") }),
      grupoModo,
      el("h2", { class: "ajustes-title", text: t("ajustes.titulo.politica") }),
      grupoPol,
      aviso
    ]);
  }

  /* El `dataset` sigue llevando el identificador crudo (escribir/boton…);
   * sólo cambia lo que se ve. */
  function subModo(m) { return t("ajustes.modo." + m + ".sub"); }
  function subPol(p) { return t("ajustes.politica." + p + ".sub"); }

  /* ---------- utilidades -------------------------------------------- */

  function plural(n, sing, plur) {
    var I = global.I18N;
    if (I && typeof I.fn === "function") return I.fn(n, sing, plur);
    return n === 1 ? sing : (plur || sing + "s");
  }

  /** «ahora mismo», «hace 5 min», «hace 3 h», «hace 2 d», «hace 4 meses». */
  function haceCuanto(ts) {
    var d = Date.now() - (Number(ts) || 0);
    var m = Math.floor(d / 60000);
    if (m < 1) return t("ui.ahora");
    if (m < 60) return t("ui.hace", { n: m, u: t("ui.un.min") });
    var h = Math.floor(m / 60);
    if (h < 24) return t("ui.hace", { n: h, u: t("ui.un.hora") });
    var dd = Math.floor(h / 24);
    if (dd < 30) return t("ui.hace", { n: dd, u: t("ui.un.dia") });
    return t("ui.hace", { n: Math.floor(dd / 30), u: t("ui.meses") });
  }

  function chip(texto, clase) { return el("span", { class: "chip " + (clase || ""), text: texto }); }

  /* ---------- lanchamiento de página ---------------------------------- */

  /* Se guarda el último `montar` para poder repintar al cambiar de idioma. */
  var ultimoMontaje = null;

  /**
   * Arranca una página. `construir` recibe (main, UI) y monta dentro.
   * Si algo falla, muestra el error en vez de dejar la página en blanco.
   */
  function montar(paginaActual, titulo, construir) {
    ultimoMontaje = { pagina: paginaActual, titulo: titulo, construir: construir };
    try {
      var main = pagina(paginaActual, titulo, el("div"));
      construir(main, global.UI);
      return main;
    } catch (e) {
      var m = document.getElementById("app") || document.body;
      m.textContent = "";
      m.appendChild(el("pre", {
        class: "error-box",
        text: t("ui.error") + "\n\n" + (e && e.message) + "\n" + ((e && e.stack) || "")
      }));
      return null;
    }
  }

  /** Vuelve a pintar la página actual sin recargar y sin tocar la URL.
   *  Es lo que llama I18N.recargar() al cambiar de idioma. */
  function remontar() {
    if (!ultimoMontaje) return false;
    var m = ultimoMontaje;
    return montar(m.pagina, m.titulo, m.construir) !== null;
  }

  global.UI = {
    el: el, append: append, math: math, mathDe: mathDe,
    cargar: cargar, guardar: guardar, reiniciar: reiniciar, sanea: sanea, porDefecto: porDefecto,
    cabecera: cabecera, pagina: pagina, ajustes: ajustes, montar: montar, remontar: remontar,
    plural: plural, haceCuanto: haceCuanto, chip: chip,
    idioma: idioma, cambiarIdioma: cambiarIdioma, interruptorIdioma: interruptorIdioma,
    PAGINAS: PAGINAS, MODOS: MODOS, POLITICAS: POLITICAS, STORE_KEY: STORE_KEY
  };

  /* =====================================================================
   * NOTA PARA build.mjs
   * ---------------------------------------------------------------------
   * i18n.js es un NUEVO miembro del ensamblado y tiene su propia entrada:
   *
   *     engine: join(SRC, "engine.js"),
   *     i18n:   join(SRC, "i18n.js"),      <-- nuevo
   *     ui:     join(SRC, "ui-core.js"),
   *
   * Y el ORDEN de los <script> de juego.html y teoria.html debe quedar:
   *
   *     <script src="src/engine.js"></script>
   *     <script src="src/i18n.js"></script>      <-- ANTES de ui-core.js
   *     <script src="src/ui-core.js"></script>
   *     <script src="src/pagina-*.js"></script>
   *
   * Motivo: ui-core.js pinta la cabecera, el pie y el panel de ajustes al
   * arrancar, así que necesita I18N.t disponible en ese momento. Cargar
   * i18n.js después deja la página en español.
   *
   * Si algún .html se queda sin i18n.js, ui-core.js NO se rompe: cae al
   * respaldo RESPALDO_ES y muestra los mismos textos en español.
   * ===================================================================== */
})(window);