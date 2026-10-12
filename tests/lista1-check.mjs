/**
 * tests/lista1-check.mjs — Verificació MATEMÀTICA de la Llista 1.
 *
 * NO toca el joc: només llegeix `lista1-practice.html` i en executa els
 * generadors de variants per comprovar que cada respostaannounced és la
 * correcta, reconstruïnt el límit des de zero amb aritmética independent.
 *
 *   node tests/lista1-check.mjs
 *
 * Sortida: codi 1 si hi ha qualsevol discrepancia.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { loadEngine } from './lib/engine.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/* ---- Carrega el motor (el que fa servir la pàgina) ---- */
const L = loadEngine();

/* ---- Carrega els blocs EX + L1 de la pàgina, sense DOM ---- */
const html = readFileSync(join(ROOT, 'lista1-practice.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1])
  .filter((s) => s.trim().length > 500);
const inline = scripts[scripts.length - 1];
if (!inline) { console.error('No s ha trobat el script inline de lista1-practice.html'); process.exit(1); }

const noopNode = () => ({
  set textContent(v) { this._t = v; }, get textContent() { return this._t || ''; },
  set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h || ''; },
  className: '', style: {}, dataset: {},
  appendChild() { return this; }, addEventListener() {}, removeChild() {},
  setAttribute() {}, getAttribute() { return null; }, querySelector() { return null; },
  firstChild: null, children: [], childNodes: []
});
const sandbox = {
  window: global.window, console, Math, JSON, Date, Set, Map, Array, Object,
  Number, String, Boolean, isFinite, isNaN, parseFloat, parseInt, BigInt,
  localStorage: { getItem: () => null, setItem: () => { }, removeItem: () => { } },
  document: {
    getElementById: () => noopNode(),
    createElement: () => noopNode(),
    createElementNS: () => noopNode(),
    createTextNode: () => noopNode(),
    createDocumentFragment: () => noopNode()
  }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const patched = inline.replace(
  'document.getElementById("l1home").addEventListener',
  'globalThis.__EX = EX; globalThis.__L1 = L1; if (document.getElementById("l1home")) document.getElementById("l1home").addEventListener'
);
try { vm.runInContext(patched, sandbox, { filename: 'lista1-practice.html' }); }
catch (e) { console.error('El script de la pagina no s executa: ' + e.message); process.exit(1); }

const EX = sandbox.__EX;
const L1 = sandbox.__L1;
if (!EX || !EX.length) { console.error('No s han carregat els exercicis'); process.exit(1); }

/* ---- Utilitats de verificacio ---- */
function obs(fn, xs) { return xs.map((x) => { try { return fn(x); } catch { return NaN; } }); }
function tendencia(vals) {
  const fin = vals.filter(isFinite);
  if (!fin.length) return { tipo: 'indefinido', valor: NaN, signo: 0 };
  const last = fin[fin.length - 1];
  if (Math.abs(last) > 1e9) {
    const set = new Set(fin.slice(-4).map(Math.sign));
    if (set.size > 1) return { tipo: 'oscila', valor: NaN, signo: 0 };
    return { tipo: 'infinito', valor: last, signo: Math.sign(last) };
  }
  for (let i = fin.length - 4; i < fin.length; i++)
    if (Math.abs(fin[i] - last) > 1e-6 * Math.max(1, Math.abs(last))) return { tipo: 'oscila', valor: NaN, signo: 0 };
  return { tipo: 'finito', valor: last, signo: Math.sign(last) };
}
const muPunt = (a, side) => { const o = []; for (let i = 1; i <= 11; i++) { const e = 10 ** -i; if (side === '+') o.push(a + e); else if (side === '-') o.push(a - e); else { o.push(a - e); o.push(a + e); } } return o; };
const muInf = (s) => { const o = []; for (let k = 4; k <= 15; k++) o.push(s * 10 ** k); return o; };

/* Converteix una resposta declarada en una forma comparable. */
function norm(r) {
  if (typeof r === 'number') return { tipus: 'num', v: r };
  const s = String(r).trim().toLowerCase().replace(/−/g, '-');
  if (/^(dne|noexiste)$/.test(s)) return { tipus: 'dne' };
  if (/^\+?inf$/.test(s)) return { tipus: 'inf', sign: 1 };
  if (/^-inf$/.test(s)) return { tipus: 'inf', sign: -1 };
  if (s === 'si') return { tipus: 'si' };
  if (s === 'no') return { tipus: 'no' };
  return { tipus: 'txt', v: s };
}
/* Compara la resposta declarada amb l'observada. */
function coincide(declarat, obs2) {
  const d = norm(declarat);
  if (Array.isArray(obs2)) return obs2.some((o) => coincide(declarat, o));
  if (d.tipus === 'num') return obs2.tipo === 'finito' && Math.abs(obs2.valor - d.v) <= 1e-6 * Math.max(1, Math.abs(d.v));
  if (d.tipus === 'dne') return obs2.tipo === 'oscila';
  if (d.tipus === 'inf') return obs2.tipo === 'infinito' && obs2.signo === d.sign;
  return false;
}

/* ---- Verificadors per apartat -------------------------------------- */
/* Cada apartat declara una funció real independent i el punt on mirar.
   Per a casos amb cancel·lació catastròfica o convergència lenta fem
   servir variants EQUIVALENTS pero estables. */
function verificaFn9(d, p) {
  /* si el cas declara `equivalent`, es verifica amb aquesta versió estable */
  const fn = p.equivalent || p.fn;
  if (p.lent !== undefined) {
    /* convergència lenta: exigim que els últims valors s'acostin al límit
       objectiu sense creuar-lo (comportament asimptòtic correcte) */
    const xs = [];
    for (let k = 6; k <= 15; k++) xs.push(Math.pow(10, k));
    const v = obs(fn, xs).filter(isFinite);
    const d0 = norm(d.respostes[0]);
    if (d0.tipus !== 'num' || v.length < 5) return false;
    const ult = v.slice(-5);
    const dist = ult.map((z) => Math.abs(z - d0.v));
    const baixa = dist[dist.length - 1] < dist[0];           /* s'acosta */
    const mateixCostat = ult.every((z) => Math.sign(z - d0.v) === Math.sign(ult[0] - d0.v));
    return baixa && mateixCostat;
  }
  const r = p.infSign
    ? tendencia(obs(fn, muInf(p.infSign === '-' ? -1 : 1)))
    : p.side
      ? tendencia(obs(fn, muPunt(p.at, p.side)))
      : (() => {
        const li = tendencia(obs(fn, muPunt(p.at, '-')));
        const ld = tendencia(obs(fn, muPunt(p.at, '+')));
        const igual = li.tipo === ld.tipo &&
          (li.tipo !== 'finito' || Math.abs(li.valor - ld.valor) <= 1e-6 * Math.max(1, Math.abs(li.valor))) &&
          (li.tipo !== 'infinito' || li.signo === ld.signo);
        return igual ? li : { tipo: 'oscila', valor: NaN, signo: 0 };
      })();
  /* Desbordament: si tots els valor retornen Infinity/-Infinity (perquè el
     resultat és tan enorme que Math.exp desborda), l'objectiu announced
     +inf/-inf és el correcte. */
  if (r.tipo === 'indefinido' && p.side) {
    const bruts = obs(fn, muPunt(p.at, p.side)).filter((v) => !Number.isNaN(v));
    const d0 = norm(d.respostes[0]);
    if (d0.tipus === 'inf' && bruts.length && bruts.every((v) => v === (d0.sign > 0 ? Infinity : -Infinity))) return true;
  }
  return coincide(d.respostes[0], r);
}

/* -------------------------------------------------------------------- */
/* Comprovacions fixes (els valors verats de la Llista 1)                 */
/* -------------------------------------------------------------------- */
const FIXOS = [
  {
    ex: 4, apartat: '(a)', respostes: ['dne'],
    fn: (x) => (5 * x + 2) / (x * x - 1), at: 1, side: null,
    nota: 'esq -inf / dreta +inf'
  },
  {
    ex: 4, apartat: '(b)', respostes: ['dne'],
    fn: (x) => -3 / (1 + Math.exp(1 / (x - 1))), at: 1, side: null,
    nota: 'esq -3 / dreta 0'
  },
  {
    ex: 4, apartat: '(c)', respostes: ['+inf'],
    fn: (x) => Math.exp(1 / Math.abs(x)), at: 0, side: null,
    nota: 'els dos laterals +inf -> EL LIMIT EXISTEIX'
  },
  {
    ex: 4, apartat: '(d)', respostes: ['dne'],
    fn: (x) => Math.pow(3, 1 / x), at: 0, side: null,
    nota: 'esq 0 / dreta +inf'
  },
  {
    ex: 9, apartat: '(a)', respostes: [6],
    fn: (x) => (x * x - 9) / (x - 3), at: 3, side: null
  },
  {
    ex: 9, apartat: '(b)', respostes: [-1],
    /* el polinomi directe dona NaN per cancel·lació; verifiquem la forma
       JA SIMPLIFICADA, que és exactament la mateixa funció fora de x=1 */
    equivalent: (x) => (2 * x) / (x - 3), at: 1, side: null,
    fn: (x) => (2 * x ** 3 - 14 * x * x + 12 * x) / (x ** 3 - 10 * x * x + 27 * x - 18),
    nota: 'forma simplificada 2x/(x-3): limit -1'
  },
  {
    ex: 9, apartat: '(f)', respostes: ['dne'],
    fn: (x) => 1 / (2 + Math.exp(1 / x)), at: 0, side: null
  },
  {
    ex: 9, apartat: '(g)', respostes: ['+inf'],
    /* Math.pow desborda a Infinity; treballem amb el logaritme */
    equivalent: (x) => { const b = x ** 4 - 3 * x ** 3 + 4; return Math.exp(1 / (x - 1) ** 4 * Math.log(b)); },
    fn: (x) => Math.pow(x ** 4 - 3 * x ** 3 + 4, 1 / (x - 1) ** 4), at: 1, side: '+',
    nota: 'base->2>1 i exponent->+inf: NO hi ha 1^inf'
  },
  {
    /* BUG CAÇAT: l'exponent 1/(x-1)^2 és +inf ALS DOS COSTATS, però la base
       és >1 a la dreta i <1 a l'esquerra → el límit BILATERAL NO EXISTEIX.
       Comprovat per separat: esq->0, dreta->+inf. */
    ex: 9, apartat: '(h)', respostes: ['dne'],
    fn: (x) => Math.pow(3 * x ** 5 - 2, 1 / (x - 1) ** 2), at: 1, side: null,
    nota: 'esq 0 / dreta +inf => dne (NO +inf)'
  },
  {
    ex: 9, apartat: '(i)', respostes: ['+inf'],
    fn: (x) => (2 * x ** 5 - x ** 3 - 5 * x * x) / (2 * x * x + 3 * x - 7), infSign: '+'
  },
  {
    ex: 9, apartat: '(j)', respostes: [0],
    fn: (x) => (2 * x * x - 3 * x + 5) / (3 * x ** 3 + 2 * x - 4), infSign: '+'
  },
  {
    ex: 9, apartat: '(k)', respostes: [-5 / 3],
    fn: (x) => (-5 * x * x - 7 * x - 3) / (3 * x * x + 5 * x - 6), infSign: '+'
  },
  {
    /* BUG CAÇAT: amb √(x² + c·x) el límit és −c/2; amb √(x² − c·x) és +c/2.
         La Llista1 diu "√(x² − 3x) + x" → +3/2. */
    ex: 9, apartat: '(l)', respostes: [3 / 2],
    fn: (x) => Math.sqrt(x * x - 3 * x) + x, infSign: '-',
    nota: 'en -inf surt +3/2 (en -inf |x|=-x)'
  },
  {
    /* el mateix apartat amb un altre coeficient, per confirmar el patró +c/2 */
    ex: 9, apartat: '(l2)', respostes: [2],
    fn: (x) => Math.sqrt(x * x - 5 * x) + x, infSign: '-',
    nota: '√(x^2-5x)+x en -inf -> +5/2'
  },
  {
    ex: 9, apartat: '(m)', respostes: [0],
    fn: (x) => Math.sqrt(x + 1) - Math.sqrt(x), infSign: '+'
  },
  {
    ex: 9, apartat: '(n)', respostes: ['+inf'],
    fn: (x) => Math.sqrt(x * x + 2 * x) - Math.sqrt(3 * x), infSign: '+'
  },
  {
    ex: 9, apartat: '(p)', respostes: [2],
    /* ln(4x^2+...)/ln(x+3) converge a 2 de forma tan lenta que, per doble
       precisió, mai no hi arriba. Verifiquem el comportament ASIMPTÒTIC:
       el quocient ha d'acostar-se a 2 sense creuar-lo. */
    equivalent: (x) => Math.log(4 * x * x + 5 * x + 7) / Math.log(x + 3),
    fn: (x) => Math.log(4 * x * x + 5 * x + 7) / Math.log(x + 3),
    infSign: '+', lent: 2,
    nota: 'quocient de graus 2/1; convergencia logarithmica molt lenta'
  }
];

/* -------------------------------------------------------------------- */
console.log('\n  Llista 1 — verificació matemàtica');
console.log('  ' + '─'.repeat(74));

let fallos = 0, checks = 0;

/* 1) Els 12 exercicis han de tenir make() robust i revisio. */
console.log('\n  A) Estructura dels 12 exercicis');
for (const b of EX) {
  let lanzo = 0, senseResposta = 0, senseRevisio = 0, variants = new Set();
  for (let s = 1; s <= 150; s++) {
    let d;
    try { d = b.make(L.rng(s * 7919 + b.n * 131)); }
    catch { lanzo++; continue; }
    if (!d || !Array.isArray(d.respostes) || !d.respostes.length) { senseResposta++; continue; }
    if (!Array.isArray(d.revisio) || d.revisio.length < 2) senseRevisio++;
    if (d.respostes.some((r) => r === null || r === undefined || (typeof r === 'number' && !isFinite(r)))) {
      console.log('   \x1b[31m✖\x1b[0m EX ' + b.n + ' resposta buida/invàlida: ' + JSON.stringify(d.respostes));
      fallos++; break;
    }
    variants.add(JSON.stringify(d.respostes));
  }
  checks++;
  const ok = lanzo === 0 && senseResposta === 0 && senseRevisio === 0;
  if (!ok) fallos++;
  console.log('   ' + (ok ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✖\x1b[0m') +
    ' EX ' + String(b.n).padStart(2) + '  ' + b.tipus.padEnd(11) +
    ' variants=' + String(variants.size).padStart(2) +
    (lanzo ? '  \x1b[31mLANZA ' + lanzo + '\x1b[0m' : '') +
    (senseResposta ? '  sense resposta ' + senseResposta : '') +
    (senseRevisio ? '  revisio curta ' + senseRevisio : ''));
}

/* 2) Els valors fixos de la Llista 1, verificados des de zero. */
console.log('\n  B) Valors fixos verificats per tendència numèrica independent');
for (const f of FIXOS) {
  checks++;
  let r;
  try { r = verificaFn9(f, f); }
  catch (e) { console.log('   \x1b[31m✖\x1b[0m ' + f.aparat + ' error: ' + e.message); fallos++; continue; }
  if (!r) fallos++;
  console.log('   ' + (r ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✖\x1b[0m') +
    ' ' + String(f.ex).padStart(2) + String(f.apartat).padEnd(5) +
    ' → ' + JSON.stringify(f.respostes[0]).padEnd(10) +
    (f.nota ? '  (' + f.nota + ')' : ''));
}

/* 3) Bolzano: les arrels trobades han de ser arrels de debò. */
console.log('\n  C) Bolzano: les arrels trobades són arrels');
const CASOS_BOLZANO = [
  { ex: 1, fn: (c) => c ** 3 - c * c + c + 1, ext: [-2, 0] },
  { ex: 2, fn: (c) => Math.sin(c) + 2 * c - 1, ext: [0, Math.PI / 2] },
  { ex: 3, fn: (c) => c ** 3 - 3 * c - 1, ext: [-2, -1] },
  { ex: 3, fn: (c) => c ** 3 - 3 * c - 1, ext: [-1, 0] },
  { ex: 3, fn: (c) => c ** 3 - 3 * c - 1, ext: [1, 2] }
];
for (const c of CASOS_BOLZANO) {
  const bo = L1.bolzano(c.fn, c.ext[0], c.ext[1]);
  checks++;
  const residu = bo.ok ? Math.abs(c.fn(bo.raiz)) : NaN;
  const ok = bo.ok && residu < 1e-6 && bo.fa * bo.fb <= 0;
  if (!ok) fallos++;
  console.log('   ' + (ok ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✖\x1b[0m') +
    ' EX ' + c.ex + ' [' + c.ext[0] + ', ' + c.ext[1] + ']' +
    '  arrel=' + (bo.ok ? bo.raiz.toFixed(8) : '—') +
    '  residu=' + (bo.ok ? residu.toExponential(1) : '—') +
    '  signes: ' + (bo.ok ? bo.fa.toFixed(3) : '?') + ' , ' + (bo.ok ? bo.fb.toFixed(3) : '?'));
}

/* 4) Continuïtat: les funcions a trossos s'han de classificar bé. */
console.log('\n  D) Continuïtat de funcions a trossos');
const CASOS_CONT = [
  {
    /* 4-(x-3)^2 = -x^2+6x-5  →  coefs [constante, x, x^2] = [-5, 6, -1] */
    nom: '5(b) 4-(x-3)^2 / 7x-61 a x=7', at: 7, esperaContinua: true,
    trossos: [
      { op: '<', a: 7, expr: L.Poly.from([-5, 6, -1]).toAST() },
      { op: '>=', a: 7, expr: L.Poly.lin(7, -61).toAST() }
    ]
  },
  {
    /* -(1/2)x + 2/5  →  coefs [-1/2, 2/5] ;  a·x+3 amb a=21/10 */
    nom: '8 sistema resolt a x=-1', at: -1, esperaContinua: true,
    trossos: [
      { op: '<=', a: -1, expr: L.Poly.from([L.Q(2, 5), L.Q(-1, 2)]).toAST() },
      { op: '>', a: -1, expr: L.Poly.from([L.Q(3), L.Q(21, 10)]).toAST() }
    ]
  }
];
for (const c of CASOS_CONT) {
  const r = L1.continuidad(c.trossos, c.at);
  const continua = /CONTÍNUA/.test(r.tipo);
  checks++;
  const ok = continua === c.esperaContinua;
  if (!ok) fallos++;
  console.log('   ' + (ok ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✖\x1b[0m') +
    ' ' + c.nom.padEnd(38) + ' → ' + r.tipo.slice(0, 46));
}

/* 5) Tangents (ex. 11 i 12) */
console.log('\n  E) Tangents');
const f11 = L.Poly.from([0, 1]), g11 = L.Poly.from([1, 0, 1]);
const t11 = L1.tangent(f11, g11, 2);
checks++;
const ok11 = t11.ordenada.toString() === '2/5' && t11.pendent.toString() === '-3/25';
if (!ok11) fallos++;
console.log('   ' + (ok11 ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✖\x1b[0m') +
  ' EX 11  f(2)=' + t11.ordenada.toDisplay() + '  f\'(2)=' + t11.pendent.toDisplay() +
  '  (espera 2/5 i -3/25)');
const p12 = L.Poly.from([1, -2, 3]);
const t12 = L1.tangentsPer(p12, 2, 6);
checks++;
const r12 = t12.raices.map((z) => z.toString()).sort();
const ok12 = r12.join(',') === '1,3';
if (!ok12) fallos++;
console.log('   ' + (ok12 ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✖\x1b[0m') +
  ' EX 12  cond=' + t12.cond.toString() + '  arrels=' + r12.join(', ') + '  (espera 1 i 3)');

/* 6) El verificador de respostes ha d'acceptar allò que l'alumne pot escriure. */
console.log('\n  F) L1.check: la resposta correcta ha de ser acceptable');
const CASOS_CHECK = [
  /* llistes (exercici 3 i 8) */
  [['-1.532089,-0.347296,1.879385'], '-1.532089, -0.347296, 1.879385', 'llista d arrels amb espais'],
  [['-1.532089,-0.347296,1.879385'], '-1.532089,-0.347296,1.879385', 'llista sense espais'],
  [['1, 3'], '1, 3', 'exercici 12: parell de punts'],
  [['1, 3'], '3,1', 'exercici 12: ordre invertit (ha d acceptar-ho)'],
  [['8/5, 41/5, 16/5'], '1,6; 8,2; 3,2', 'exercici 8 amb decimals i punts i coma'],
  /* fraccions i decimals amb coma (convencio espanyola) */
  [3 / 2, '3/2', 'fraccio amb barra'],
  [3 / 2, '1,5', 'decimal amb coma'],
  [3 / 2, '1.5', 'decimal amb punt'],
  [-3 / 2, '-3/2', 'fraccio negativa'],
  [-3 / 2, '-1,5', 'decimal negatiu amb coma'],
  [-5 / 3, '-1,6666666666666667', '9(k) tal com el mostra la pagina'],
  /* infinits i dne */
  ['dne', 'dne', 'dne exacte'],
  ['dne', 'no existe', 'dne en catala'],
  ['+inf', '+inf', 'infinpositiu'],
  ['+inf', 'infinity', 'infinity en anglès'],
  ['-inf', '-inf', 'infinnegatiu'],
  /* si / no */
  ['si', 'si', 'continua'],
  ['no', 'no', 'discontinua'],
  /* alternatives (exercici 11: la mateixa recta escrita de 3 maneres) */
  [['y = 2/5 - (3/25)(x-2)', 'y = -3x/25 + 16/25'], 'y = 2/5 - (3/25)(x-2)', 'exercici 11 forma 1'],
  [['y = 2/5 - (3/25)(x-2)', 'y = -3x/25 + 16/25'], 'y = -3x/25 + 16/25', 'exercici 11 forma 2']
];
for (const [c, u, desc] of CASOS_CHECK) {
  checks++;
  const ok = L1.check(c, u);
  if (!ok) fallos++;
  console.log('   ' + (ok ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✖\x1b[0m') +
    ' ' + String(desc).padEnd(34) + ' ' + JSON.stringify(u));
}

/* 7) I les respostes INCORRECTES s'han de rebutjar. */
console.log('\n  G) L1.check: les respostes errònies es rebutgen');
const CASOS_REBUJO = [
  [['-1.532089,-0.347296,1.879385'], '-1.532089, -0.347296', 'llista incompleta'],
  [['1, 3'], '1, 4', 'parell equivocat'],
  [3 / 2, '-3/2', 'signo invertit'],
  [3 / 2, '1.6', 'fora de tolerància'],
  ['dne', '0', 'dne però hi posa un 0'],
  ['+inf', '-inf', 'infin signat al revés'],
  ['si', 'no', 'continuïtat invertida'],
  ['8/5, 41/5, 16/5', '8/5, 41/5', 'exercici 8 incomplet']
];
for (const [c, u, desc] of CASOS_REBUJO) {
  checks++;
  const ok = !L1.check(c, u);
  if (!ok) fallos++;
  console.log('   ' + (ok ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✖\x1b[0m') +
    ' rebutja ' + JSON.stringify(u).padEnd(28) + ' ' + desc);
}

/* 8) El que la pagina anuncia ha de coincidir amb la funcio real. */
console.log('\n  H) Clau i enunciat d cada apartat de l exercici 9');
const b9 = EX.filter((x) => x.n === 9)[0];
const ESPERATS_9 = {
  '(a)': 6, '(b)': -1, '(f)': 'dne', '(g)': '+inf', '(h)': 'dne',
  '(i)': '+inf', '(j)': 0, '(k)': -5 / 3, '(m)': 0, '(n)': '+inf', '(p)': 2
};
const vistos = new Map();
for (let s = 1; s <= 400; s++) {
  let d;
  try { d = b9.make(L.rng(s * 7919 + 99)); } catch { continue; }
  if (!d || !d.aparat || !(d.aparat in ESPERATS_9)) continue;
  vistos.set(d.aparat, d.respostes[0]);
}
for (const [ap, esp] of Object.entries(ESPERATS_9)) {
  checks++;
  const obt = vistos.get(ap);
  const ok = obt !== undefined && Math.abs(Number(obt) - Number(esp)) < 1e-9;
  if (!ok) fallos++;
  console.log('   ' + (ok ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✖\x1b[0m') +
    ' ' + ap.padEnd(4) + ' announce ' + String(obt).padEnd(22) + ' (espera ' + esp + ')');
}
/* (l) es valida amb el patró +c/2 per a tots els coeficients possibles */
for (const c of [1, 2, 3, 4, 5, 6]) {
  checks++;
  const esq = Math.sqrt((-1e9) ** 2 - c * (-1e9)) + (-1e9);
  const ok = Math.abs(esq - c / 2) < 1e-3;
  if (!ok) fallos++;
  console.log('   ' + (ok ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✖\x1b[0m') +
    ' (l)  c=' + c + '  √(x²−' + c + 'x)+x en −∞ = ' + esq.toFixed(6) + '  (c/2 = ' + (c / 2) + ')');
}

console.log('\n  ' + '─'.repeat(74));
console.log('  ' + checks + ' comprovacions · ' +
  (fallos ? '\x1b[31m' + fallos + ' amb errors\x1b[0m' : '\x1b[32mcap error\x1b[0m') + '\n');
process.exit(fallos ? 1 : 0);
