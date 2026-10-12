#!/usr/bin/env node
/* =========================================================================
 * ui-spec.test.mjs — Auditoría EJECUTABLE de la interfaz (src/app.js)
 * -------------------------------------------------------------------------
 * Carga `src/engine.js` y `src/app.js` en un `vm` con un DOM mínimo
 * (sin navegador, sin jsdom, sin dependencias) y ejercita DE VERDAD la lógica
 * de cierre de problemas: etiquetas, racha, XP, bloqueo del modo examen,
 * reinyección, estrellas y persistencia.
 *
 *   node tests/ui-spec.test.mjs
 *
 * Códigos de salida: 0 = todo cuadra con lo esperado (incluidos los
 * DEFECTOS CONOCIDOS documentados en tests/ui-audit.md), 1 = alguien cambió
 * el comportamiento y hay que revisar la auditoría.
 *
 * Cada comprobación declara:
 *   spec  -> lo que pedía la especificación
 *   known -> lo que hace hoy el código (null = correcto)
 * Si `actual !== known` => FAIL (regresión o defecto nuevo).
 * Si `known !== null && actual === known` => XFAIL (defecto conocido).
 * ========================================================================= */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* =========================================================================
 * 1. Mini-DOM (suficiente para app.js: nada de layout, nada de CSS)
 * ========================================================================= */

const VOID_TAGS = new Set(["input", "br", "hr", "img", "meta", "link"]);

class MiniNode {
  constructor(type) {
    this.nodeType = type;              // 1 element, 3 text, 11 fragment
    this.childNodes = [];
    this.parentNode = null;
    this.listeners = Object.create(null);
  }
  get firstChild() { return this.childNodes[0] || null; }
  get children() { return this.childNodes.filter((n) => n.nodeType === 1); }
  appendChild(child) {
    if (child === null || child === undefined) return child;
    if (typeof child === "string" || typeof child === "number") {
      child = new MiniText(String(child));        // el DOM real convierte a nodo de texto
    }
    if (child.nodeType === 11) {                    // fragmento: se drena
      for (const k of child.childNodes.slice()) this.appendChild(k);
      child.childNodes.length = 0;
      return child;
    }
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    if (child.nodeType === 1 && child.id) registerId(child);
    return child;
  }
  removeChild(child) {
    const i = this.childNodes.indexOf(child);
    if (i >= 0) this.childNodes.splice(i, 1);
    if (child) child.parentNode = null;
    if (child && child.nodeType === 1 && child.id) unregisterId(child);
    return child;
  }
  replaceChild(next, old) {
    const i = this.childNodes.indexOf(old);
    if (i < 0) return old;
    if (next.parentNode) next.parentNode.removeChild(next);
    next.parentNode = this;
    this.childNodes[i] = next;
    old.parentNode = null;
    return old;
  }
  get textContent() {
    if (this.nodeType === 3) return this.data;
    return this.childNodes.map((c) => c.textContent).join("");
  }
  set textContent(v) {
    this.childNodes.length = 0;
    if (v !== "" && v !== null && v !== undefined) {
      const t = new MiniText(String(v));
      t.parentNode = this;
      this.childNodes.push(t);
    }
  }
  contains() { return false; }
  focus() { doc.activeElement = this; }
  blur() { if (doc.activeElement === this) doc.activeElement = doc.body; }
  scrollIntoView() { /* no-op */ }
  addEventListener(type, fn) {
    (this.listeners[type] || (this.listeners[type] = [])).push(fn);
  }
  removeEventListener(type, fn) {
    const l = this.listeners[type];
    if (l) this.listeners[type] = l.filter((f) => f !== fn);
  }
  dispatch(type, ev = {}) {
    ev.type = type;
    ev.target = ev.target || this;
    ev.preventDefault = ev.preventDefault || function () { ev.defaultPrevented = true; };
    ev.stopPropagation = ev.stopPropagation || function () {};
    let node = this;
    while (node) {
      const l = node.listeners && node.listeners[type];
      if (l) for (const fn of l.slice()) fn.call(node, ev);
      node = ev.bubbles === false ? null : node.parentNode;
    }
    return ev;
  }
  descendants(acc = []) {
    for (const c of this.childNodes) { if (c.nodeType === 1) { acc.push(c); c.descendants(acc); } }
    return acc;
  }
  querySelectorAll(sel) {
    return this.descendants().filter((n) => matchSelector(n, sel));
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

class MiniText extends MiniNode {
  constructor(data) { super(3); this.data = data; }
}

class MiniElement extends MiniNode {
  constructor(tagName, ns) {
    super(1);
    this.tagName = String(tagName).toUpperCase();
    this.localName = String(tagName).toLowerCase();
    this.ns = ns || null;
    this.attrs = Object.create(null);
    this.dataset = {};
    this.style = "";
    this.classList = makeClassList(this);
    this._text = null;
    this.offsetParent = null;         // se fija al conectar al árbol
    this.disabled = false;
    this.value = "";
    this.id = "";
  }
  get className() { return this.attrs.class || ""; }
  set className(v) { this.attrs.class = String(v); }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
    if (k === "id") { this.id = String(v); if (this.parentNode) registerId(this); }
    if (k === "value") this.value = String(v);
    if (k === "disabled") this.disabled = (v !== null && v !== undefined && v !== false && v !== "false");
  }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  get textContent() {
    if (this._text !== null && this.childNodes.length === 0) return this._text;
    return super.textContent;
  }
  set textContent(v) { this._text = v === null || v === undefined ? "" : String(v); super.textContent = v; }
  get outerHTML() { return serialize(this); }
}

function makeClassList(node) {
  const list = () => (node.attrs.class || "").split(/\s+/).filter(Boolean);
  return {
    add(...cs) { const s = new Set(list()); cs.forEach((c) => s.add(c)); node.attrs.class = [...s].join(" "); },
    remove(c) { node.attrs.class = list().filter((x) => x !== c).join(" "); },
    contains(c) { return list().includes(c); },
    toggle(c, force) {
      const has = list().includes(c);
      const want = force === undefined ? !has : !!force;
      if (want) this.add(c); else this.remove(c);
      return want;
    }
  };
}

/* --- selectores: tag, .clase, [attr], [attr="v"], descendencia simple ---- */

function parseSimple(tok) {
  const m = /^([a-zA-Z][\w-]*)?((?:\.[\w-]+)*)((?:\[[^\]]+\])*)$/.exec(tok);
  if (!m) return null;
  const tag = m[1] ? m[1].toLowerCase() : null;
  const classes = (m[2].match(/\.[\w-]+/g) || []).map((c) => c.slice(1));
  const attrs = [];
  for (const a of m[3].match(/\[[^\]]+\]/g) || []) {
    const eq = /^\[([\w-]+)(?:=["']?([^"']*)["']?)?\]$/.exec(a);
    if (eq) attrs.push([eq[1], eq[2]]);
  }
  return { tag, classes, attrs };
}

function matchSimple(n, s) {
  if (s === "*") return true;
  if (n.tagName.toLowerCase() === s) return true;
  const cls = (n.attrs.class || "").split(/\s+/);
  for (const c of s.split(".")) if (!cls.includes(c)) return false;
  return true;
}

function matchAttrs(n, attrs) {
  for (const [k, v] of attrs) {
    if (v === undefined) { if (!(k in n.attrs)) return false; }
    else if (n.attrs[k] !== v) return false;
  }
  return true;
}

function matchSelector(node, selector) {
  const parts = String(selector).trim().split(/\s+(?![^\[]*\])/).filter(Boolean);
  if (!parts.length) return false;
  const last = parseSimple(parts[parts.length - 1]);
  if (!last) return false;
  if (!matchSimple(node, last.tag || "*")) return false;
  if (last.tag && node.tagName.toLowerCase() !== last.tag) return false;
  for (const c of last.classes) if (!node.classList.contains(c)) return false;
  if (!matchAttrs(node, last.attrs)) return false;
  if (parts.length === 1) return true;
  // ascendencia por el resto de la cadena
  let anc = node.parentNode;
  for (let i = parts.length - 2; i >= 0 && anc; i--) {
    const p = parseSimple(parts[i]);
    if (!p) return false;
    if ((p.tag && anc.tagName && anc.tagName.toLowerCase() === p.tag)
      && p.classes.every((c) => anc.classList && anc.classList.contains(c))
      && matchAttrs(anc, p.attrs)) return true;
    anc = anc.parentNode;
  }
  return false;
}

/* --- serialización (para el test de XSS) -------------------------------- */

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function serialize(n) {
  if (n.nodeType === 3) return n.data.replace(/[&<>"']/g, (c) => ESC[c]);
  if (n.nodeType === 11) return n.childNodes.map(serialize).join("");
  const tag = n.localName;
  let a = "";
  for (const k of Object.keys(n.attrs)) {
    if (k === "value") continue;
    a += ` ${k}="${String(n.attrs[k]).replace(/[&<>"]/g, (c) => ESC[c])}"`;
  }
  const VOID = VOID_TAGS.has(tag);
  return `<${tag}${a}>${VOID ? "" : n.childNodes.map(serialize).join("")}</${tag}>`;
}

/* --- parser de HTML minúsculo (solo para <template>.innerHTML) ---------- */

function parseHTML(html, ns) {
  const root = new MiniElement("template", ns);
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[\w:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[0].startsWith("<!--")) continue;
    if (m[1]) { if (stack.length > 1) stack.pop(); continue; }
    if (m[2]) {
      const tag = m[2].toLowerCase();
      const el = new MiniElement(tag, ns);
      for (const a of (m[3] || "").matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
        const val = a[2] !== undefined ? a[2] : a[3] !== undefined ? a[3] : a[4] !== undefined ? a[4] : "";
        el.setAttribute(a[1], val);
      }
      top.appendChild(el);
      if (!VOID_TAGS.has(tag) && !m[4]) stack.push(el);
      continue;
    }
    if (m[5] !== undefined) {
      const t = new MiniText(m[5]);
      top.appendChild(t);
    }
  }
  return root;
}

/* --- documento ---------------------------------------------------------- */

const IDREG = new Map();
function registerId(n) { IDREG.set(n.id, n); }
function unregisterId(n) { if (IDREG.get(n.id) === n) IDREG.delete(n.id); }

const doc = new MiniNode(9);
doc.nodeType = 9;
doc.body = new MiniElement("body");
doc.appendChild(doc.body);
doc.activeElement = doc.body;
doc.createElement = (t) => new MiniElement(t);
doc.createElementNS = (ns, t) => new MiniElement(t, ns);
doc.createTextNode = (t) => new MiniText(String(t));
doc.createDocumentFragment = () => new MiniElement("#fragment", null);
doc.createDocumentFragment = () => { const f = new MiniNode(11); return f; };
doc.getElementById = (id) => IDREG.get(id) || null;
doc.addEventListener = MiniNode.prototype.addEventListener;
doc.removeEventListener = MiniNode.prototype.removeEventListener;
doc.dispatch = MiniNode.prototype.dispatch;
doc.querySelectorAll = (s) => doc.body.querySelectorAll(s);
doc.querySelector = (s) => doc.body.querySelector(s);
doc.importNode = (node) => parseHTML(serialize(node), node.ns);

const TEMPLATE_CONTENT = new MiniNode(11);
const _createElement = doc.createElement;
doc.createElement = (t) => {
  const el = _createElement(t);
  if (String(t).toLowerCase() === "template") {
    el.content = TEMPLATE_CONTENT;
    let html = "";
    Object.defineProperty(el, "innerHTML", {
      get: () => html,
      set: (v) => {
        html = String(v);
        TEMPLATE_CONTENT.childNodes.length = 0;
        const frag = parseHTML(html, null);
        for (const c of frag.childNodes.slice()) TEMPLATE_CONTENT.appendChild(c);
      }
    });
  }
  return el;
};

/* --- localStorage simulado --------------------------------------------- */

function makeStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear(),
    _dump: () => Object.fromEntries(map)
  };
}

/* =========================================================================
 * 2. Arranque de la app en un contexto vm
 * ========================================================================= */

function boot(storageInit) {
  IDREG.clear();
  doc.body.childNodes.length = 0;
  const sandbox = {
    document: doc,
    console,
    setTimeout: (fn) => { fn(); return 0; },      // síncrono y determinista
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    requestAnimationFrame: () => 0,
    localStorage: makeStorage(storageInit),
    Math, Date, JSON, Object, Array, String, Number, Boolean, Error,
    isFinite, isNaN, parseInt, parseFloat, BigInt, RegExp, Map, Set,
    encodeURIComponent, decodeURIComponent, Intl
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);

  vm.runInContext(readFileSync(join(ROOT, "src/engine.js"), "utf8"), ctx, { filename: "engine.js" });
  vm.runInContext(readFileSync(join(ROOT, "src/theory-data.js"), "utf8"), ctx, { filename: "theory-data.js" });
  vm.runInContext(readFileSync(join(ROOT, "src/app.js"), "utf8"), ctx, { filename: "app.js" });

  const root = doc.createElement("div");
  root.id = "app-root";
  doc.body.appendChild(root);
  sandbox.App.start(root);
  return sandbox;
}

/* =========================================================================
 * 3. Utilidades de manejo
 * ========================================================================= */

const S = (sb) => sb.App.state;

function $(sel) { return doc.querySelector(sel); }
function $$(sel) { return doc.querySelectorAll(sel); }

function byText(txt, sel = "button") {
  return $$(sel).find((n) => (n.textContent || "").replace(/\s+/g, " ").trim() === txt) || null;
}
function byTextIn(txt, sel = "button") {
  const scope = sel === "*" ? doc.body.descendants() : $$(sel);
  return scope.find((n) => (n.textContent || "").replace(/\s+/g, " ").trim().includes(txt)) || null;
}
function click(node) { if (!node) throw new Error("click(): nodo null"); node.dispatch("click", { bubbles: true }); return node; }
function key(node, k) { return node.dispatch("keydown", { key: k, bubbles: true }); }

/** Escribe en el campo de respuesta y lanza el evento input. */
function answer(text) {
  const f = doc.getElementById("answer-field");
  if (!f) throw new Error("no hay campo de respuesta en el DOM");
  f.value = text;
  f.dispatch("input", { bubbles: true });
  return f;
}
function check() { click(doc.getElementById("check-btn")); }

/** Respuesta correcta del problema actual, en texto plano. */
function right(sb) {
  const c = S(sb).current;
  return sb.Lim.answerToString(c.problem.answer);
}
function wrongAnswer(sb) {
  const c = S(sb).current;
  const right0 = String(sb.Lim.answerToString(c.problem.answer));
  for (const cand of ["__nada__", "987654321", "x = 99"]) {
    if (cand !== right0) {
      const chk = sb.Lim.checkAnswer(c.problem, cand);
      if (!chk.correct) return cand;
    }
  }
  return "__nada__";
}

function setSettings(sb, modo, politica) {
  S(sb).settings.modo = modo;
  S(sb).settings.politica = politica;
  sb.App.render();
}

function startLevel(sb, levelId, free = false) {
  sb.App.state.run = null;
  //Usamos la vía real: go('campana') y clic en la tarjeta del nivel
  sb.App.go("campana");
  const cards = $$(".level");
  const idx = sb.Lim.LEVELS.findIndex((l) => l.id === levelId);
  if (idx < 0) throw new Error("nivel inexistente " + levelId);
  click(cards[idx]);
}

/** Cierra el problema actual como 'acierto' total (número + método). */
function solveCorrect(sb) {
  answer(right(sb));
  check();
  const c = S(sb).current;
  if (!c || c.phase !== "quiz") throw new Error("no se pasó a la fase de interrogatorio");
  const correct = Number(c.problem.quiz.correct);
  const btns = $$(".qopt");
  click(btns[correct]);
}
function solveMethodWrong(sb) {
  answer(right(sb));
  check();
  const c = S(sb).current;
  const correct = Number(c.problem.quiz.correct);
  const wrongQ = [0, 1, 2, 3].find((i) => i !== correct);
  click($$(".qopt")[wrongQ]);
}

/** Salta hasta que aparezca un problema de repaso (reinicia la partida si acaba). */
function skipUntilReview(sb, max = 40) {
  for (let i = 0; i < max; i++) {
    const c = S(sb).current;
    if (c && c.isReview) return c;
    const btn = byTextIn("Saltar");
    if (!btn) { startLevel(sb, S(sb).run.levelId || "sustituir"); continue; }
    click(btn);
  }
  return null;
}

/* =========================================================================
 * 4. Framework de comprobaciones
 * ========================================================================= */

let pass = 0, fail = 0, xfail = 0;
const failures = [];
const defects = [];

const C = {
  ok: "\x1b[32m", bad: "\x1b[31m", warn: "\x1b[33m", dim: "\x1b[90m", off: "\x1b[0m", bold: "\x1b[1m"
};
function fmt(v) { return typeof v === "string" ? JSON.stringify(v) : String(v); }
function head(t) { console.log(`\n${C.bold}── ${t} ${"─".repeat(Math.max(2, 62 - t.length))}${C.off}`); }

/** PASS si el código cumple la especificación. */
function spec(name, actual, expected, note) {
  if (Object.is(actual, expected)) {
    pass++; console.log(`  ${C.ok}✔${C.off} ${name} → ${fmt(actual)}`);
    return true;
  }
  fail++; failures.push({ name, spec: note, expected, actual });
  console.log(`  ${C.bad}✖✖${C.off} ${name} → ${fmt(actual)}  ${C.dim}(la spec pide ${fmt(expected)})${C.off}`);
  console.log(`     ${C.dim}spec: ${note}${C.off}`);
  return false;
}

/** XFAIL: se documenta el comportamiento DEFECTUOSO actual; si cambia, salta un fallo. */
function defect(name, actual, knownBad, note) {
  if (Object.is(actual, knownBad)) {
    xfail++; defects.push({ name, spec: note, known: knownBad, actual });
    console.log(`  ${C.warn}✖${C.off} ${name} → ${fmt(actual)}  ${C.dim}DEFECTO CONFIRMADO${C.off}`);
    console.log(`     ${C.dim}spec: ${note}${C.off}`);
    return true;
  }
  fail++; failures.push({ name, spec: note, expected: knownBad, actual });
  console.log(`  ${C.bad}✖✖${C.off} ${name} → ${fmt(actual)}  ${C.dim}(el defecto se comportaba como ${fmt(knownBad)})${C.off}`);
  return false;
}

/** PASS si la condición es cierta. */
function ok_(name, cond, note) { return spec(name, !!cond, true, note); }
function no_(name, cond, note) { return spec(name, !!cond, false, note); }
const okVal = spec;
const chk = ok_;

/* =========================================================================
 * 5. LAS PRUEBAS
 * ========================================================================= */

console.log(`${C.bold}AUDITORÍA EJECUTABLE DE LA INTERFAZ (src/app.js)${C.off}`);
console.log(`${C.dim}harness: mini-DOM propio, motor real (src/engine.js)${C.off}`);

let sb = boot();

/* --------------------------------------------------------------------- */
head("0. Arranque y contrato con el motor");
/* --------------------------------------------------------------------- */
ok_("App.start monta la portada", !!$(".hero-title"));
ok_("se pintan los 4 botones de la portada", $$(".hero-actions .btn").length === 4, "portada con 4 acciones");
ok_("no se pinta ninguna opción en la portada", $$(".opt").length === 0, "las opciones son del juego, no de la portada");

const engineFns = ["generate", "checkAnswer", "checkQuiz", "answerToString", "solutionHtml", "rng"];
for (const f of engineFns) ok_("Lim." + f + "() existe", typeof sb.Lim[f] === "function", "CONTRACT §9");
ok_("Lim.LEVELS tiene 10 niveles", sb.Lim.LEVELS.length === 10, "CONTRACT §8: 10 niveles");
ok_("Lim.GENERATORS tiene 23", Object.keys(sb.Lim.GENERATORS).length === 23, "CONTRACT §6: 23 generadores");

/* --------------------------------------------------------------------- */
head("1. Matriz modo × política (qué se pinta en el DOM)");
/* --------------------------------------------------------------------- */
{
  // optsAtLoad  : nº de .opt presentes en el DOM al cargar el problema
  // revealBtn   : ¿existe el botón «Ver opciones»?
  // revealDis   : ¿ese botón arranca deshabilitado?
  const expect = {
    "escribir|visible":  { optsAtLoad: 0, revealBtn: false, revealDis: null, text: "solo texto" },
    "escribir|boton":    { optsAtLoad: 0, revealBtn: true,  revealDis: false, text: "texto + «Ver opciones» (pista)" },
    "escribir|examen":   { optsAtLoad: 0, revealBtn: false, revealDis: null, text: "solo texto" },
    "opciones|visible":  { optsAtLoad: 4, revealBtn: false, revealDis: null, text: "4 opciones al inicio" },
    "opciones|boton":    { optsAtLoad: 0, revealBtn: true,  revealDis: false, text: "botón → aparecen" },
    "opciones|examen":   { optsAtLoad: 0, revealBtn: true,  revealDis: true,  text: "texto obligatorio primero" }
  };
  for (const modo of ["escribir", "opciones"]) {
    for (const pol of ["visible", "boton", "examen"]) {
      const b = boot();
      setSettings(b, modo, pol);
      startLevel(b, "sustituir");
      const c = S(b).current;
      // el generador del nivel 1 es de sustitución directa: forzamos el tipo
      c.kind = modo === "escribir" ? "escribir" : "opciones";
      b.App.render();
      const n = $$(".opt").length;
      const btn = byTextIn("Ver opciones");
      const exp = expect[modo + "|" + pol];
      spec(`[${modo} + ${pol}] opciones en el DOM al cargar`, n, exp.optsAtLoad,
        "matriz: " + exp.text);
      spec(`[${modo} + ${pol}] botón «Ver opciones»`, !!btn, exp.revealBtn, "matriz: " + exp.text);
      if (exp.revealDis !== null) {
        spec(`[${modo} + ${pol}] el botón arranca deshabilitado`, btn && btn.disabled, exp.revealDis,
          "examen: «el botón arranca deshabilitado»");
      }
      // el campo de texto: la especificación pide SOLO 4 botones en modo «opciones» + visible
      const hayCampo = !!doc.getElementById("answer-field");
      if (modo === "opciones" && pol === "visible") {
        defect("[opciones + visible] el campo de texto sigue en el DOM", hayCampo, true,
          "modo «opciones» = «solo 4 botones»; con la política «visible» no hace falta escribir nada");
      }
    }
  }
}

/* --------------------------------------------------------------------- */
head("2. Etiquetas de cierre, racha y XP");
/* --------------------------------------------------------------------- */

/* --- 2.1 acierto -------------------------------------------------------- */
{
  const b = boot();
  setSettings(b, "escribir", "visible");
  startLevel(b, "sustituir");
  const p = S(b).current.problem;
  solveCorrect(b);
  const st = S(b).stats;
  okVal("acierto → run.lastHow", S(b).run.lastHow, "acierto", "tabla: número+método → «acierto»");
  okVal("acierto → racha", st.streak, 1, "tabla: acierto → +1");
  okVal("acierto → XP total", st.xp, 15, "XP número (10) + XP método (5)");
  okVal("acierto → bestStreak", st.bestStreak, 1, "bestStreak ≥ streak");
  okVal("acierto → no queda en el cuaderno", S(b).notebook.length, 0, "si se resuelve bien, se tacha");
  okVal("acierto → run.numOk", S(b).run.numOk, 1, "contador de número");
  okVal("acierto → run.metOk", S(b).run.metOk, 1, "contador de método");
}

/* --- 2.2 fallo de método ------------------------------------------------ */
{
  const b = boot();
  setSettings(b, "escribir", "visible");
  startLevel(b, "sustituir");
  solveMethodWrong(b);
  const st = S(b).stats, nb = S(b).notebook;
  okVal("fallo de método → run.lastHow", S(b).run.lastHow, "fallo de método", "tabla: número sí, método no");
  okVal("fallo de método → racha", st.streak, 0, "tabla: fallo de método → 0");
  okVal("fallo de método → NO se da XP de método (solo los 10 del número)", st.xp, 10,
    "«si se falla el método, no se concede la XP de método»");
  okVal("fallo de método → run.numOk", S(b).run.numOk, 0, "el interrogatorio es obligatorio antes de seguir");
  okVal("fallo de método → run.metOk", S(b).run.metOk, 0, "el interrogatorio es obligatorio antes de seguir");
  okVal("fallo de método → queda en el cuaderno", nb.length, 1, "el cuaderno guarda el fallo de método");
  okVal("fallo de método → etiqueta guardada", nb[0] && nb[0].howClosed, "fallo de método", "howClosed");
}

/* --- 2.3 fallo del número ---------------------------------------------- */
{
  const b = boot();
  setSettings(b, "escribir", "visible");
  startLevel(b, "sustituir");
  const seed = S(b).current.problem.seed, gen = S(b).current.problem.generatorId;
  answer(wrongAnswer(b));
  check();
  okVal("número fallado → racha a 0", S(b).stats.streak, 0, "tabla: fallo → 0");
  okVal("número fallado → entra en el cuaderno", S(b).notebook.length, 1, "el cuaderno guarda el fallo");
  okVal("número fallado → howClosed", S(b).notebook[0].howClosed, "fallo", "tabla: «fallo»");
  okVal("número fallado → NO se concede XP", S(b).stats.xp, 0, "XP solo si se acierta");
  // el problema sigue abierto: se puede reintentar
  okVal("número fallado → el problema sigue abierto", S(b).current.phase, "answer", "se puede reintentar");
  okVal("número fallado → run.numOk sigue a 0", S(b).run.numOk, 0, "contadores de campaña");
  ok_("número fallado → el cuaderno guarda la semilla original", S(b).notebook[0].seed === seed && S(b).notebook[0].generatorId === gen, "el cuaderno guarda seed+generatorId para poder reinyectar");
}

/* --- 2.4 saltado -------------------------------------------------------- */
{
  const b = boot();
  setSettings(b, "escribir", "visible");
  startLevel(b, "sustituir");
  click(byTextIn("Saltar"));
  const nb = S(b).notebook;
  okVal("saltado → run.lastHow", S(b).run.lastHow, "saltado", "tabla: saltar → «saltado»");
  okVal("saltado → racha", S(b).stats.streak, 0, "tabla: saltado → 0");
  okVal("saltado → cuaderno", nb.length === 1 && nb[0].howClosed, "saltado", "tabla: «saltado»");
  okVal("saltado → XP", S(b).stats.xp, 0, "saltar no da XP");
  okVal("saltado → avanza de problema", S(b).run.index, 1, "advance()");
}

/* --- 2.5 visto solución ------------------------------------------------- */
{
  const b = boot();
  setSettings(b, "escribir", "visible");
  startLevel(b, "sustituir");
  click(byTextIn("Ver solución"));
  const nb = S(b).notebook;
  okVal("visto solución → run.lastHow", S(b).run.lastHow, "visto solución", "tabla: ver la solución sin acertar");
  okVal("visto solución → racha", S(b).stats.streak, 0, "tabla: visto solución → 0");
  okVal("visto solución → cuaderno", nb.length === 1 && nb[0].howClosed, "visto solución", "tabla: «visto solución»");
  ok_("visto solución → se abre el panel", !!$(".panel-solution"), "el panel de solución se pinta");
  okVal("visto solución → XP", S(b).stats.xp, 0, "no se concede XP");
  ok_("visto solución → el problema NO avanza solo", S(b).run.index === 0, "se puede seguir con el mismo problema");
}

/* --- 2.6-yardado (solo en política «botón») ----------------------------- */
{
  const b = boot();
  setSettings(b, "opciones", "boton");
  startLevel(b, "sustituir");
  S(b).current.kind = "opciones";
  b.App.render();
  click(byTextIn("Ver opciones"));
  okVal("ayudado → las 4 opciones están en el DOM", $$(".opt").length, 4, "política botón: aparecen al pulsar");
  const idx = S(b).current.options.findIndex((o) => o === right(b) || o === String(right(b)).replace(/^\+/, "+"));
  const idxOk = idx >= 0 ? idx : S(b).current.options.findIndex((o) => String(o).trim() === String(right(b)).trim());
  click($$(".opt")[idxOk]);
  const c = S(b).current;
  click($$(".qopt")[Number(c.problem.quiz.correct)]);
  okVal("ayudado → run.lastHow", S(b).run.lastHow, "ayudado", "tabla: usó las opciones reveladas y acertó");
  okVal("ayudado → racha", S(b).stats.streak, 0, "tabla: ayudado → 0");
  okVal("ayudado → sigue en el cuaderno", S(b).notebook.length, 1, "el cuaderno guarda el «ayudado»");
  okVal("ayudado → etiqueta en el cuaderno", S(b).notebook[0].howClosed, "ayudado", "howClosed");
  okVal("ayudado → run.numOk (el número sí es correcto)", S(b).run.numOk, 1, "el número acertado cuenta");
  okVal("ayudado → run.metOk (el método no cuenta)", S(b).run.metOk, 0, "sin crédito completo de método");
  okVal("ayudado → XP", S(b).stats.xp, 15, "los 10 del número + 5 del método");
}

/* --- 2.7 con opciones «visible» NO debe salir «ayudado» ----------------- */
{
  const b = boot();
  setSettings(b, "opciones", "visible");
  startLevel(b, "sustituir");
  S(b).current.kind = "opciones";
  b.App.render();
  const correct = String(right(b)).trim();
  const i = S(b).current.options.findIndex((o) => String(o).trim() === correct);
  click($$(".opt")[i]);
  const c = S(b).current;
  click($$(".qopt")[Number(c.problem.quiz.correct)]);
  okVal("opciones+visible acertando → etiqueta", S(b).run.lastHow, "acierto",
    "«ayudado» es solo para las opciones REVELADAS de la política «botón»");
  okVal("opciones+visible acertando → racha", S(b).stats.streak, 1, "usar las opciones visibles es la vía normal");
}

/* --------------------------------------------------------------------- */
head("3. Modo examen: bloqueo estricto de las opciones");
/* --------------------------------------------------------------------- */
{
  const b = boot();
  setSettings(b, "opciones", "examen");
  startLevel(b, "sustituir");
  S(b).current.kind = "opciones";
  b.App.render();
  okVal("examen: 0 opciones en el DOM al cargar", $$(".opt").length, 0, "las opciones NO existen hasta poder");
  const btn0 = byTextIn("Ver opciones");
  ok_("examen: el botón «Ver opciones» aparece", !!btn0, "el botón existe pero arranca deshabilitado");
  okVal("examen: el botón arranca DESHABILITADO", btn0 && btn0.disabled, true, "«el botón arranca deshabilitado»");
  const sol0 = byTextIn("Ver solución");
  okVal("examen: el botón de solución también arranca deshabilitado (no pedido por la especificación)", sol0 && sol0.disabled, true,
    "la especificación solo exige bloquear el botón de OPCIONES en examen; el de solución es un endurecimiento extra");

  // forzar que el bloqueo aguante aunque se llame al handler a mano
  const st0 = S(b).stats;
  click(btn0);                                    // disabled => el stub no dispara
  okVal("examen: pulsar el botón deshabilitado no revela nada", $$(".opt").length, 0, "noop si está disabled");
  okVal("examen: sigue sin opciones", S(b).current.optionsShown, false, "optionsShown=false");

  // ahora un intento fallido por texto
  answer(wrongAnswer(b));
  check();
  okVal("examen: tras fallar se cambia de fase", S(b).current.phase, "answer", "el alumno puede seguir escribiendo");
  okVal("examen: optionsLocked a true", S(b).current.optionsLocked, true, "«las opciones quedan bloqueadas para siempre»");
  okVal("examen: optionsShown a false", S(b).current.optionsShown, false, "no se quedan pintadas");
  okVal("examen: 0 opciones en el DOM tras fallar", $$(".opt").length, 0, "siguen sin existir en el DOM");
  const btn1 = byTextIn("Ver opciones") || byTextIn("Opciones bloqueadas");
  okVal("examen: el botón queda deshabilitado para siempre", btn1 && btn1.disabled, true, "bloqueo permanente");
  ok_("examen: se avisa del bloqueo", !!byTextIn("Opciones bloqueadas"), "el alumno debe entender por qué");
  okVal("examen: racha a 0", S(b).stats.streak, 0, "tabla: fallo → 0");

  // no se puede forzar por teclado
  const ev = key(doc.body, "1");
  okVal("examen: la tecla 1 no hace nada sin opciones", $$(".opt").length, 0, "1-4 solo con opciones visibles");
  okVal("examen: no se_calls onPickOption", S(b).current.picked, null, "ninguna opción elegida");
}

/* --- 3.1 en examen, «ayudado» es imposible ------------------------------ */
{
  const b = boot();
  setSettings(b, "escribir", "examen");
  startLevel(b, "sustituir");
  // aunque se forzase optionsShown a mano, el cierre comprueba la política
  S(b).current.optionsShown = true;
  S(b).current.usedOptions = true;
  S(b).current.policy = "examen";
  const c = S(b).current;
  b.App.render();
  answer(right(b));
  check();
  const c2 = S(b).current;
  click($$(".qopt")[Number(c2.problem.quiz.correct)]);
  okVal("examen: la etiqueta NUNCA es «ayudado»", S(b).run.lastHow, "acierto",
    "«en examen la etiqueta ayudado no puede ocurrir»");
}

/* --- 3.2 examen + escribir: sin botón de opciones ------------------------ */
{
  const b = boot();
  setSettings(b, "escribir", "examen");
  startLevel(b, "sustituir");
  ok_("examen+escribir: no hay botón «Ver opciones»", !byTextIn("Ver opciones"), "matriz: escribir+examen = solo texto");
  answer(wrongAnswer(b));
  check();
  okVal("examen+escribir: 0 opciones tras fallar", $$(".opt").length, 0, "nunca hay opciones");
}

/* --------------------------------------------------------------------- */
head("4. Reinyección: 1 de cada 5 problemas sale del cuaderno");
/* --------------------------------------------------------------------- */
{
  const b = boot();
  setSettings(b, "escribir", "visible");
  startLevel(b, "sustituir");
  // Llenamos el cuaderno saltando el primer problema
  click(byTextIn("Saltar"));
  chk("precondición: el cuaderno tiene 1 entrada", S(b).notebook.length === 1, "necesario para la reinyección");
  const gen = S(b).notebook[0].generatorId;
  for (let i = 0; i < 5; i++) {
    S(b).notebook.push({ seed: 700000 + i, generatorId: gen, attempts: 1, lastTs: Date.now(), resolved: false, howClosed: "fallo" });
  }

  // Partida larga: 40 problemas seguidos sin reiniciar (para medir la cadencia)
  S(b).run.total = 40;
  const positions = [];
  for (let i = 0; i < 40; i++) {
    const c = S(b).current;
    if (c && c.isReview) positions.push(S(b).run.index + 1);   // nº de problema real
    click(byTextIn("Saltar"));
    if (!S(b).current) break;
  }
  const gaps = positions.slice(1).map((p, i) => p - positions[i]);
  const uniform = gaps.length > 0 && new Set(gaps).size === 1;

  defect("reinyección: nº de repasos en 40 problemas", positions.length, 6,
    "1 de cada 5 en 40 problemas serían 8 repasos");
  defect("reinyección: el intervalo entre repasos NO es de 5", uniform ? gaps[0] : gaps.join(","), 6,
    "«Cada 5 problemas, uno sale del cuaderno de errores en lugar de ser nuevo» ⇒ separación de 5");
  defect("reinyección: la PRIMERA aparición NO es en el problema nº 5", positions[0], 6,
    "«Cada 5 problemas» ⇒ el 1.º repaso cae dentro de los 5 primeros problemas, no en el 6.º");
  console.log(`     ${C.dim}repasos en los problemas nº: ${positions.join(", ")}${C.off}`);
}
{
  // En una partida de campaña (10 problemas) sólo cabe UN repaso, y cae en el 6.º
  const b = boot();
  setSettings(b, "escribir", "visible");
  startLevel(b, "sustituir");
  click(byTextIn("Saltar"));
  const pos = [];
  for (let i = 0; i < 10; i++) {
    if (S(b).current && S(b).current.isReview) pos.push(S(b).run.index + 1);
    click(byTextIn("Saltar"));
    if (!S(b).current) break;
  }
  defect("campaña de 10: el repaso cae en el problema nº 6, no en el 5", pos[0], 6,
    "«Cada 5 problemas, uno sale del cuaderno»");
  defect("campaña de 10: sólo hay 1 repaso de 10 problemas", pos.length, 1,
    "con REINJECT_CADA=5 y total=10 caben 2 repasos (problemas 5 y 10)");
}

/* --- 4.1 el repaso rompe la racha si se falla, y se tacha si se acierta --- */
{
  const b = boot();
  setSettings(b, "escribir", "visible");
  startLevel(b, "sustituir");
  // 4 aciertos seguidos para tener racha
  for (let i = 0; i < 4; i++) solveCorrect(b), click(byTextIn("Siguiente problema"));
  const rachaAntes = S(b).stats.streak;
  ok_("precondición: hay racha", rachaAntes === 4, "4 aciertos seguidos");
  // provocamos un fallo de número para meter en el cuaderno
  answer(wrongAnswer(b)); check();
  click(byTextIn("Saltar"));
  // esperamos al repaso (reiniciando la partida si se acaba)
  const rev = skipUntilReview(b, 40);
  ok_("precondición: aparece un ejercicio de repaso", !!(rev && rev.isReview), "isReview");
  ok_("el repaso avisa por pantalla", !!byTextIn("Ejercicio de repaso", "*"),
    "banner «Ejercicio de repaso de uno de tus fallos»");
  const nbAntes = S(b).notebook.length;
  answer(wrongAnswer(b)); check();
  click(byTextIn("Saltar"));
  okVal("repasar y fallar → racha a 0", S(b).stats.streak, 0, "«si lo fallas, rompe la racha»");
  ok_("repasar y fallar → sigue en el cuaderno", S(b).notebook.length >= nbAntes, "no se tacha si se falla");

  // ahora uno bien resuelto
  const rev2 = skipUntilReview(b, 40);
  ok_("precondición: segundo repaso", !!(rev2 && rev2.isReview), "isReview");
  const sem = rev2.problem.seed + ":" + rev2.problem.generatorId;
  solveCorrect(b);
  click(byTextIn("Siguiente problema"));
  okVal("repasar y acertar → se tacha del cuaderno",
    S(b).notebook.some((e) => (e.seed + ":" + e.generatorId) === sem), false,
    "«si lo resuelves bien, se tacha»");
}

/* --------------------------------------------------------------------- */
head("5. Campaña: superar, estrellas y desbloqueo");
/* --------------------------------------------------------------------- */
{
  const cases = [
    { n: 7, m: 10, stars: 0, passed: false, why: "7/10 en número no llega al 8 exigido" },
    { n: 8, m: 7, stars: 0, passed: false, why: "7/10 en método no llega al 8 exigido" },
    { n: 8, m: 8, stars: 1, passed: true, why: "1★ = superar" },
    { n: 9, m: 8, stars: 2, passed: true, why: "2★ = además 9/10 en ambos" },
    { n: 9, m: 9, stars: 2, passed: true, why: "9 y 9 ⇒ 2★" },
    { n: 10, m: 9, stars: 2, passed: true, why: "10 y 9 ⇒ 2★ (no 3)" },
    { n: 10, m: 10, stars: 3, passed: true, why: "3★ = 10/10 en ambos" }
  ];
  for (const cs of cases) {
    const b = boot();
    startLevel(b, "sustituir");
    const run = S(b).run;
    run.numOk = cs.n; run.metOk = cs.m;
    run.index = run.total;                       // cierra la partida
    // advance() marca finished y llama a recordLevelResult
    S(b).current.closed = true;
    click(byTextIn("Saltar"));                    // advance()
    const rec = S(b).campaign["sustituir"];
    okVal(`estrellas ${cs.n}/${cs.m}`, rec && rec.stars, cs.stars, cs.why);
    okVal(`superado ${cs.n}/${cs.m}`, rec && rec.passed, cs.passed, cs.why);
  }
}
{
  const b = boot();
  startLevel(b, "sustituir");
  S(b).campaign["sustituir"] = { best: { num: 8, met: 8 }, stars: 1, passed: true };
  b.App.go("campana");
  const cards = $$(".level");
  okVal("nivel 2 bloqueado hasta superar el 1", cards[1].disabled, true, "desbloquea el siguiente");
  okVal("nivel 1 nunca bloqueado", cards[0].disabled, false, "el primero siempre");
}
{
  const b = boot();
  b.App.go("campana");
  click(byTextIn("Elegir nivel"));                // modo libre
  const cards = $$(".level");
  ok_("modo libre: se puede elegir cualquier nivel", cards.length === 10, "el modo libre permite saltarse bloqueos");
  const locked = cards.filter((c) => c.disabled).length;
  okVal("modo libre: ningún nivel bloqueado", locked, 0, "«El modo libre permite saltarse bloqueos»");
  click(cards[9]);
  okVal("modo libre: arranca el nivel 10", S(b).run.levelId, "continuidad", "nivel elegido");
  okVal("modo libre: free=true", S(b).run.free, true, "modo libre");
  S(b).run.numOk = 10; S(b).run.metOk = 10; S(b).run.index = 10;
  click(byTextIn("Saltar"));
  okVal("modo libre: NO toca las estrellas del nivel", S(b).campaign["continuidad"], undefined,
    "«El modo libre permite saltarse bloqueos» / sin_stars");
}

/* --------------------------------------------------------------------- */
head("6. Persistencia y robustez");
/* --------------------------------------------------------------------- */
{
  const good = {
    "limites:v1": JSON.stringify({
      version: 1,
      settings: { modo: "opciones", politica: "examen" },
      stats: { solved: 12, correct: 9, streak: 4, bestStreak: 7, xp: 180, byTopic: { sustitucion: { ok: 5, total: 8 } } },
      campaign: { sustituir: { best: { num: 9, met: 9 }, stars: 2, passed: true } },
      notebook: [{ seed: 4242, generatorId: "subst-directa", attempts: 3, lastTs: 1700000000000, resolved: false, howClosed: "fallo" }]
    })
  };
  const b = boot(good);
  okVal("carga: ajustes", S(b).settings.modo + "/" + S(b).settings.politica, "opciones/examen", "persistencia de ajustes");
  okVal("carga: XP", S(b).stats.xp, 180, "stats.xp");
  okVal("carga: mejor racha", S(b).stats.bestStreak, 7, "stats.bestStreak");
  okVal("carga: campaña", S(b).campaign.sustituir.stars, 2, "campaign[id].stars");
  okVal("carga: cuaderno", S(b).notebook.length, 1, "notebook");
  okVal("carga: la pantalla arranca en la portada", S(b).screen, "portada", "no se restaura la partida a medias");
}
{
  const b = boot({ "limites:v1": "{{{ esto no es JSON ]]" });
  ok_("JSON corrupto: no rompe", !!$(".hero-title"), "debe sobrevivir a un JSON corrupto");
  okVal("JSON corrupto: ajustes por defecto", S(b).settings.modo, "mixto", "ajustes por defecto");
}
{
  const b = boot({ "limites:v1": JSON.stringify({ settings: 42, stats: "nope", campaign: [1, 2], notebook: { a: 1 }, version: "x" }) });
  ok_("tipos equivocados: no rompe", !!$(".hero-title"), "sanea cualquier forma");
  okVal("tipos equivocados: cuaderno vacío", S(b).notebook.length, 0, "sanea");
  okVal("tipos significados: campaign vacía", Object.keys(S(b).campaign).length, 0, "sanea");
}
{
  const b = boot({ "limites:v1": JSON.stringify({
    settings: { modo: " hacking ", politica: "JUEGO" },
    stats: { solved: -5, correct: 999, streak: "x", bestStreak: 2, xp: 1e9, byTopic: "no" },
    campaign: { nivelFalso: { best: { num: 10, met: 10 }, stars: 3, passed: true }, sustituir: { stars: 3, passed: false } },
    notebook: [{ seed: "abc" }, { seed: 5, generatorId: "" }, { seed: 5, generatorId: "subst-directa", attempts: 999, howClosed: "inventada" }]
  }) });
  okVal("ajustes inválidos → modo por defecto", S(b).settings.modo, "mixto", "lista blanca de MODOS");
  okVal("ajustes inválidos → política por defecto", S(b).settings.politica, "visible", "lista blanca de POLITICAS");
  okVal("números negativos → saneados", S(b).stats.solved, 0, "num() nunca devuelve negativo");
  okVal("byTopic no-objeto → vacío", Object.keys(S(b).stats.byTopic).length, 0, "sanea");
  okVal("nivel inexistente en campaign → eliminado", S(b).campaign.nivelFalso, undefined, "no se inventan niveles");
  okVal("estrellas sin passed → 0", S(b).campaign.sustituir.stars, 0, "coherencia estrellas/passed");
  okVal("notebook: semilla no numérica → descartada", S(b).notebook.length, 1, "solo queda la entrada válida");
  okVal("notebook: howClosed inventada → «fallo»", S(b).notebook[0].howClosed, "fallo", "lista blanca de HOW");
}
{
  // esquina: la racha se conserva y la partida en curso no se restaura
  const b = boot({ "limites:v1": JSON.stringify({ stats: { streak: 5, bestStreak: 3 } }) });
  okVal("bestStreak se corrige si es menor que streak", S(b).stats.bestStreak, 5, "invariante bestStreak ≥ streak");
  okVal("no se restaura una partida a medias", S(b).run, null, "run no se persiste");
}
{
  // escritura real en localStorage
  const b = boot();
  setSettings(b, "opciones", "boton");
  startLevel(b, "sustituir");
  solveCorrect(b);
  const dumped = b.localStorage._dump()["limites:v1"];
  ok_("save() escribe en la clave «limites:v1»", typeof dumped === "string" && dumped.length > 0, "STORE_KEY");
  const parsed = JSON.parse(dumped);
  ok_("save() guarda settings/stats/campaign/notebook",
    parsed.settings && parsed.stats && parsed.campaign && Array.isArray(parsed.notebook), "esquema de §6");
  okVal("save() no persiste «run» ni «current»", "run" in parsed || "current" in parsed, false,
    "el esquema de la especificación no incluye sesión");
}

/* --------------------------------------------------------------------- */
head("7. XSS: el texto del alumno nunca se inyecta");
/* --------------------------------------------------------------------- */
{
  const b = boot();
  setSettings(b, "escribir", "visible");
  startLevel(b, "sustituir");
  const PAYLOAD = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2<\/script>';
  answer(PAYLOAD);
  check();
  const html = doc.body.outerHTML;
  ok_("el payload no crea nodos <img>/<script>", !/<img[^>]*onerror/i.test(html) && !/<script>window\.__pwned/.test(html),
    "el texto del alumno se escapa antes de insertarse");
  ok_("no se ejecutó nada", sb.__pwned === undefined && b.__pwned === undefined, "sin ejecución de scripts");
  okVal("el campo conserva el texto tal cual", doc.getElementById("answer-field").value, PAYLOAD, "textContent/value no interpreta HTML");
}
{
  const b = boot();
  setSettings(b, "escribir", "visible");
  startLevel(b, "sustituir");
  answer("<b>x</b>");
  check();
  const reason = $$(".feedback-reason")[0];
  ok_("el motivo del fallo se pinta como texto", !!reason && reason.textContent.length > 0, "cardFeedback usa textContent");
  okVal("el texto no se escapa dos veces (no aparecen entidades &lt;)", /&lt;|&amp;|&quot;|&#39;/.test(reason ? reason.textContent : ""), false,
    "esc() se aplica y luego textContent vuelve a escapar: el alumno ve «&lt;b&gt;» en vez de «<b>»");
}
{
  // solutionHtml del motor: entra por <template> (inerto). Se comprueba que
  // no se asigna innerHTML a un nodo vivo.
  const b = boot();
  setSettings(b, "escribir", "visible");
  startLevel(b, "sustituir");
  click(byTextIn("Ver solución"));
  ok_("el panel de solución se pinta desde solutionHtml()", !!$(".panel-solution"), "cardSolution");
  const steps = $$(".panel-solution .step");
  ok_("la solución trae pasos", steps.length > 0, "problem.steps");
  defect("el paso clave se marca con la insignia «clave»", $$(".panel-solution .step-badge").length, 0,
    "app.js busca «.step-t» y «data-step», pero el motor emite «.step-title» y SIN data-step: el resaltado nunca ocurre");
}

/* --------------------------------------------------------------------- */
head("8. Teclado");
/* --------------------------------------------------------------------- */
{
  const b = boot();
  setSettings(b, "escribir", "visible");
  startLevel(b, "sustituir");
  key(doc.body, "1");
  okVal("tecla 1 sin opciones no hace nada", S(b).current.picked, null, "«1–4 solo con opciones visibles»");
  answer("basura"); check();                     // ahora hay feedback
  const ev = key(doc.body, "s");
  ok_("tecla S abre la solución", !!$(".panel-solution"), "S = ver solución");
  const idxAntes = S(b).run.index;
  key(doc.body, "n");
  okVal("tecla N salta", S(b).run.index, idxAntes + 1, "N = saltar");
}
{
  const b = boot();
  setSettings(b, "opciones", "visible");
  startLevel(b, "sustituir");
  S(b).current.kind = "opciones";
  b.App.render();
  key(doc.body, "2");
  okVal("tecla 2 con opciones visibles elige la opción 2", S(b).current.picked, 1, "1–4 eligen la opción visible");
  okVal("elegir por teclado cuenta como usar opciones", S(b).current.usedOptions, true, "mismo camino que el clic");
}
{
  const b = boot();
  setSettings(b, "escribir", "visible");
  startLevel(b, "sustituir");
  answer(right(b));
  key(doc.getElementById("answer-field"), "Enter");
  okVal("Enter en el campo comprueba", S(b).current.phase, "quiz", "Enter = comprobar");
  const c = S(b).current;
  click($$(".qopt")[Number(c.problem.quiz.correct)]);
  const idxAntes = S(b).run.index;
  key(doc.body, "Enter");
  okVal("Enter en el interrogatorio resuelto avanza", S(b).run.index, idxAntes + 1, "Enter = siguiente problema");
}

/* --------------------------------------------------------------------- */
head("9. Accesibilidad y foco");
/* --------------------------------------------------------------------- */
{
  const b = boot();
  setSettings(b, "escribir", "visible");
  startLevel(b, "sustituir");
  ok_("al cargar un problema el foco va al campo", doc.activeElement === doc.getElementById("answer-field"), "foco al cargar un problema");
  answer(right(b));
  check();
  ok_("el campo se deshabilita al responder", doc.getElementById("answer-field").disabled, true, "el campo se bloquea");
  defect("el foco NO pasa a las opciones del interrogatorio tras acertar el número",
    doc.activeElement === doc.getElementById("answer-field"), true,
    "al pasar a la fase de interrogatorio el foco se queda en un input deshabilitado: el teclado necesita tabular hasta el botón");
}
{
  const b = boot();
  setSettings(b, "escribir", "visible");
  startLevel(b, "sustituir");
  answer(wrongAnswer(b));
  check();
  ok_("el feedback tiene aria-live", $$(".feedback[aria-live='polite']").length >= 1, "aria-live en el feedback");
  ok_("el botón de comprobar se habilita al escribir", doc.getElementById("check-btn").disabled === false, "botón deshabilitado accesible");
  const sol = byTextIn("Ver solución");
  ok_("el motivo del deshabilitado va en «title»", !!(sol && sol.getAttribute("title")), "los botones deshabilitados no muestran title en muchos navegadores");
}
{
  const b = boot();
  b.App.go("teoria");
  ok_("la pantalla de teoría se pinta", $$(".theory-sec").length > 0, "teoría");
  okVal("se pintan 9 secciones escritas a mano en app.js", $$(".theory-sec").length, 9,
    "la especificación pide leer window.THEORY (12 secciones y 21 tablas de src/theory-data.js)");
  okVal("se pintan 3 tablas escritas a mano", $$(".theory .table").length, 3,
    "la especificación pide las 21 tablas de src/theory-data.js");
  okVal("la teoría publicada por theory-data.js se ignora", sb.THEORY && b.THEORY ? b.THEORY.sections.length : -1, 12,
    "src/theory-data.js publica 12 secciones y 21 tablas; app.js no lee window.THEORY en ningún punto");
}

/* --------------------------------------------------------------------- */
head("10. Estado: fugas, dobles y saltos de pantalla");
/* --------------------------------------------------------------------- */
{
  const b = boot();
  setSettings(b, "escribir", "visible");
  startLevel(b, "sustituir");
  const total0 = (() => { let n = 0; const cnt = (e) => { n++; e.listeners && Object.keys(e.listeners).forEach(k => { if (k !== "click") n++; }); }; doc.body.descendants().forEach(cnt); return n; })();
  for (let i = 0; i < 30; i++) b.App.render();
  const total1 = (() => { let n = 0; const cnt = (e) => { n++; e.listeners && Object.keys(e.listeners).forEach(k => { if (k !== "click") n++; }); }; doc.body.descendants().forEach(cnt); return n; })();
  defect("30 render() seguidos no acumulan listeners no-click (setTimeout/focus)", total1 <= total0 + 2, total0,
    "fugas de listeners en render()");
  ok_("render() vacía el contenedor", doc.body.querySelector("#app-root").children.length === 1, "render() reemplaza el árbol");
}
{
  const b = boot();
  setSettings(b, "escribir", "visible");
  startLevel(b, "sustituir");
  const xp0 = S(b).stats.xp;
  solveCorrect(b);
  for (let i = 0; i < 10; i++) b.App.render();
  okVal("render() repetido NO duplica la XP", S(b).stats.xp, xp0, "los contadores no se tocan al pintar");
}
{
  const b = boot();
  setSettings(b, "escribir", "visible");
  startLevel(b, "sustituir");
  const solved0 = S(b).stats.solved;
  solveMethodWrong(b);                     // close("fallo de método")
  okVal("precondición: el fallo de método ya se contabilizó", S(b).stats.solved, solved0 + 1, "contado una vez");
  click(byTextIn("Reintentar método"));
  const c = S(b).current;
  click($$(".qopt")[Number(c.problem.quiz.correct)]);
  defect("reintentar el método NO vuelve a contar el mismo problema", S(b).stats.solved, solved0 + 1,
    "closeProblem() tiene el guardia «if (c.counted) return», pero NUNCA pone c.counted = true: el mismo problema se contabiliza dos veces");
}
{
  const b = boot();
  setSettings(b, "escribir", "visible");
  startLevel(b, "sustituir");
  const run0 = S(b).run.numOk, met0 = S(b).run.metOk, solved0 = S(b).stats.solved;
  solveMethodWrong(b);
  click(byTextIn("Reintentar método"));
  const c = S(b).current;
  click($$(".qopt")[Number(c.problem.quiz.correct)]);
  defect("el doble conteo falsea también la nota de campaña", S(b).run.numOk, run0 + 1,
    "con el doble conteo, un solo problema puede sumar +1 número y +1 método a la vez, y hasta +2 al total");
  defect("el doble conteo rompe la racha.expected", S(b).run.metOk, met0 + 1, "metOk sube sin que el método haya sido fallado nunca");
}
{
  const b = boot();
  setSettings(b, "escribir", "visible");
  startLevel(b, "sustituir");
  const seed = S(b).current.problem.seed;
  solveCorrect(b);
  click(byTextIn("Siguiente problema"));
  const xpAntes = S(b).stats.xp, solvedAntes = S(b).stats.solved;
  b.App.go("campana");
  b.App.go("portada");
  okVal("ir y volver no reinicia contadores", S(b).stats.xp + "/" + S(b).stats.solved, xpAntes + "/" + solvedAntes,
    "«contadores que se reinician al cambiar de pantalla»");
  ok_("ir a la campaña NO borra el problema en curso", !!S(b).current, "el estado de sesión sobrevive");
}
{
  const b = boot();
  setSettings(b, "escribir", "visible");
  startLevel(b, "sustituir");
  // el botón "Comprobar" con el campo vacío no debe hacer nada
  const input = doc.getElementById("answer-field");
  okVal("Comprobar arranca deshabilitado si el campo está vacío", doc.getElementById("check-btn").disabled, true, "UX");
  input.value = "   ";
  input.dispatch("input", { bubbles: true });
  okVal("solo espacios no habilita Comprobar", doc.getElementById("check-btn").disabled, true, "trim() en updateCheckButton");
}

/* --------------------------------------------------------------------- */
head("11. Opciones: construcción y coherencia con el motor");
/* --------------------------------------------------------------------- */
{
  const b = boot();
  let bad = [];
  for (let i = 0; i < 300; i++) {
    const p = b.Lim.generate({ seed: 1000 + i * 13 });
    S(b).run = { levelId: null, free: true, title: "t", total: 10, required: 8, index: 0, numOk: 0, metOk: 0, xp: 0, seeds: [], generators: null, reinjectIn: 5, finished: false, lastHow: null };
    S(b).current = null;
    setSettings(b, "opciones", "visible");
    const q = b.App.generateNext(true);
    const c = S(b).current;
    if (!c) continue;
    const want = String(b.Lim.answerToString(p.answer)).trim();
    const norm = (s) => String(s).trim().replace(/^−/, "-").replace(/^\+/, "");
    const hits = c.options.filter((o) => norm(o) === norm(want)).length;
    if (c.options.length !== 4) bad.push(p.generatorId + ": " + c.options.length + " opciones");
    else if (new Set(c.options).size !== 4) bad.push(p.generatorId + ": opciones repetidas " + JSON.stringify(c.options));
    else if (hits !== 1) bad.push(p.generatorId + ": la respuesta correcta aparece " + hits + " veces en " + JSON.stringify(c.options) + " (correcta=" + want + ")");
  }
  okVal("300 problemas: 4 opciones distintas y exactamente 1 correcta", bad.length, 0,
    "optionList() rellena con una lista fija cuando los distractores no dan 4 valores distintos");
  if (bad.length) console.log("     " + C.dim + bad.slice(0, 8).join("\n     ") + (bad.length > 8 ? ` … y ${bad.length - 8} más` : "") + C.off);
}

/* --------------------------------------------------------------------- */
head("12. Construcción del bundle");
/* --------------------------------------------------------------------- */
{
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const extScript = html.match(/<script[^>]*\ssrc=/gi) || [];
  const extLink = html.match(/<link[^>]*\shref=/gi) || [];
  const links = extLink.filter((l) => !/href="data:/i.test(l));
  okVal("index.html no tiene <script src=…>", extScript.length, 0, "fichero autocontenido");
  okVal("index.html no tiene <link href=…> externos", links.length, 0, "fichero autocontenido");
  ok_("index.html incluye THEORY", /window\.THEORY/.test(html), "build.mjs");
  ok_("index.html incluye Lim", /window\.Lim|global\.Lim/.test(html), "build.mjs");
  ok_("index.html incluye App", /window\.App|global\.App/.test(html), "build.mjs");
  ok_("index.html cierra </script> dentro de los scripts embebidos", !/<\/script>/.test(html.slice(0, html.lastIndexOf("</script>") + 9).replace(/<\/(script)>/g, "") + "</script>"), "build.mjs: guard()");
  ok_("index.html declara lang=es", /<html lang="es"/.test(html), "accesibilidad");
  ok_("index.html tiene viewport móvil", /name="viewport"/.test(html), "móvil");
}

/* =========================================================================
 * 13. Informe
 * ========================================================================= */

console.log("\n" + "═".repeat(68));
console.log(`${C.bold}RESULTADO${C.off}`);
console.log(`  ${C.ok}correctas:  ${pass}${C.off}`);
console.log(`  ${C.warn}defectos conocidos (XFAIL): ${xfail}${C.off}`);
console.log(`  ${fail ? C.bad : C.ok}fallos inesperados: ${fail}${C.off}`);

if (defects.length) {
  console.log(`\n${C.warn}${C.bold}DEFECTOS CONFIRMADOS (documentados en tests/ui-audit.md)${C.off}`);
  defects.forEach((d, i) => {
    console.log(`  ${i + 1}. ${d.name}`);
    console.log(`     actual hoy: ${fmt(d.actual)}`);
    console.log(`     spec: ${d.spec}`);
  });
}

if (failures.length) {
  console.log(`\n${C.bad}${C.bold}FALLOS (regresión o defecto nuevo)${C.off}`);
  failures.forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.name}: actual ${fmt(f.actual)}, se esperaba ${fmt(f.known)}`);
    console.log(`     spec: ${f.spec}`);
  });
}

console.log("═".repeat(68));
process.exit(fail ? 1 : 0);
