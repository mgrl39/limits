/**
 * lib/coherence-one.mjs — Coherencia interna de UN problema (ronda 2).
 *
 * Comprueba que el problema se sostiene: que sea determinista, que su
 * respuesta canónica sea aceptada por `checkAnswer`, que el interrogatorio
 * tenga sentido, que la solución se pueda pintar y que los distractores
 * no dupliquen la respuesta correcta.
 */
import { evalStatement } from './eval-ast.mjs';

const norm = (s) => String(s == null ? '' : s)
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ').trim();

/** Comprobaciones de un problema. Devuelve { seed, fallos:[], avisos:[] }. */
export function coherenceOne(L, gid, seed) {
  const fallos = [];
  const avisos = [];
  const fail = (code, msg) => fallos.push(code + ': ' + msg);
  const warn = (code, msg) => avisos.push(code + ': ' + msg);

  /* 1. Determinismo: dos generaciones con la misma semilla dan lo mismo. */
  let p, q;
  try {
    p = L.generate({ seed, generatorIds: [gid] });
    q = L.generate({ seed, generatorIds: [gid] });
  } catch (e) {
    return { seed, fallos: ['LANZÓ: ' + ((e && e.message) || String(e))], avisos: [], expr: '' };
  }

  const exprP = L.ast.toPlain(p.statement.expr);
  const exprQ = L.ast.toPlain(q.statement.expr);
  if (exprP !== exprQ) fail('DETERMINISTA-EXPR', 'dos generaciones dan expresiones distintas: "' + exprP + '" vs "' + exprQ + '"');
  if (L.answerToString(p.answer) !== L.answerToString(q.answer)) {
    fail('DETERMINISTA-RESPUESTA',
      'dos generaciones dan respuestas distintas: "' + L.answerToString(p.answer) + '" vs "' + L.answerToString(q.answer) + '"');
  }
  if (p.id !== q.id) fail('DETERMINISTA-ID', 'el id cambia entre generaciones');

  /* 2. Forma mínima del problema. */
  if (!p.statement || !p.statement.expr) fail('FORMA', 'falta statement.expr');
  if (!p.statement.target) fail('FORMA', 'falta statement.target');
  if (!p.answer || !p.answer.kind) fail('FORMA', 'falta answer.kind');

  /* 3. answerToString: no debe lanzar ni devolver undefined/vacío. */
  let canon;
  try {
    canon = L.answerToString(p.answer);
  } catch (e) {
    return { seed, fallos: ['answerToString LANZÓ: ' + ((e && e.message) || String(e))], avisos: [], expr: exprP };
  }
  if (canon === undefined || canon === null) fail('TEXTO-RESPUESTA', 'answerToString devuelve undefined');
  else if (typeof canon !== 'string') fail('TEXTO-RESPUESTA', 'answerToString no devuelve string: ' + typeof canon);
  else if (canon.trim() === '') fail('TEXTO-RESPUESTA', 'answerToString devuelve cadena vacía');
  // Idempotencia: el texto canónico debe seguir siendo el mismo.
  if (typeof canon === 'string' && L.answerToString(q.answer) !== canon) {
    fail('TEXTO-RESPUESTA', 'answerToString no es idempotente');
  }

  /* 4. La respuesta canónica la acepta checkAnswer (SIEMPRE). */
  let chk = null;
  try {
    chk = L.checkAnswer(p, canon);
  } catch (e) {
    fail('CHECKANSWER-LANZÓ', (e && e.message) || String(e));
  }
  if (chk && chk.correct !== true) {
    fail('RESPUESTA-CANONICA',
      'checkAnswer rechaza la respuesta canónica "' + canon + '" (motivo: ' + (chk.reason || '—') + ')');
  }
  if (chk && typeof chk.normalized !== 'string') fail('CHECKANSWER', 'checkAnswer no devuelve `normalized` string');

  /* 5. Distractores. */
  const dists = p.distractors || [];
  if (dists.length !== 3) fail('DISTRACTORES', 'hay ' + dists.length + ' distractores (deben ser 3)');
  const strs = [];
  for (const d of dists) {
    try {
      const s = L.answerToString(d);
      if (s === undefined || s === null || String(s).trim() === '') {
        fail('DISTRACTOR-VACIO', 'un distractor se convierte en texto vacío');
      }
      strs.push(String(s));
    } catch (e) {
      fail('DISTRACTOR-LANZÓ', (e && e.message) || String(e));
    }
  }
  for (let i = 0; i < strs.length; i++) {
    for (let j = i + 1; j < strs.length; j++) {
      if (norm(strs[i]) === norm(strs[j])) {
        fail('DISTRACTOR-DUPLICADO', 'los distractores ' + i + ' y ' + j + ' son iguales: "' + strs[i] + '"');
      }
    }
    if (canon != null && norm(strs[i]) === norm(canon)) {
      fail('DISTRACTOR-EQUAL-RESPUESTA', 'el distractor ' + i + ' coincide con la respuesta correcta: "' + strs[i] + '"');
    }
  }
  // Plausibilidad: al menos un distractor de otro "tipo" de respuesta.
  const kinds = new Set(strs.map((s) => tipoRespuesta(L, p.answer, s)));
  if (p.answer.kind === 'dne') {
    const tieneInf = strs.some((s) => /^[+-]?(inf|infinito|∞)$/i.test(norm(s)) || norm(s) === '+inf' || norm(s) === '-inf');
    if (!tieneInf) warn('DISTRACTOR-PLAUSIBLE', 'para un DNE ningún distractor es ±infinito: ' + strs.join(' | '));
  }
  if (p.answer.kind === 'infinite') {
    const signos = new Set(strs.filter((s) => /inf/.test(norm(s))).map((s) => (norm(s).startsWith('-') ? '-' : '+')));
    const signoCorrecto = p.answer.sign > 0 ? '+' : '-';
    if (!signos.has(signoCorrecto === '+' ? '-' : '+')) {
      warn('DISTRACTOR-PLAUSIBLE', 'para un límite infinito no aparece el signo contrario: ' + strs.join(' | '));
    }
  }
  if (p.answer.kind === 'rational' && kinds.size < 2) {
    warn('DISTRACTOR-PLAUSIBLE', 'los 3 distractores son del mismo tipo numérico: ' + strs.join(' | '));
  }

  /* 6. Interrogatorio de método. */
  const quiz = p.quiz;
  if (!quiz) fail('QUIZ', 'no hay interrogatorio');
  else {
    if (!Array.isArray(quiz.options) || quiz.options.length !== 4) {
      fail('QUIZ-OPCIONES', 'el interrogatorio tiene ' + (quiz.options ? quiz.options.length : '?') + ' opciones (deben ser 4)');
    } else {
      if (!Number.isInteger(quiz.correct) || quiz.correct < 0 || quiz.correct > 3) {
        fail('QUIZ-INDEX', 'quiz.correct = ' + quiz.correct + ' fuera de rango');
      }
      const n = quiz.options.map(norm);
      for (let i = 0; i < n.length; i++) {
        for (let j = i + 1; j < n.length; j++) {
          if (n[i] === n[j]) {
            fail('QUIZ-DUPLICADA', 'las opciones ' + i + ' y ' + j + ' dicen lo mismo: "' + quiz.options[i] + '"');
          }
        }
      }
      if (quiz.correct >= 0 && quiz.correct < 4) {
        let ok = false;
        try { ok = L.checkQuiz(p, quiz.correct) === true; } catch (e) { fail('QUIZ-LANZÓ', e.message); }
        if (!ok) fail('QUIZ-CORRECTA', 'checkQuiz(p, quiz.correct) no devuelve true');
        if (!quiz.explain || String(quiz.explain).trim() === '') {
          warn('QUIZ-EXPLAIN', 'el interrogatorio no explica por qué');
        }
      }
    }
  }

  /* 7. Solución paso a paso. */
  const steps = p.steps || [];
  if (steps.length < 2) fail('PASOS', 'solo hay ' + steps.length + ' paso(s) (mínimo 2)');
  for (let i = 0; i < steps.length; i++) {
    if (!steps[i].title || String(steps[i].title).trim() === '') fail('PASOS', 'el paso ' + i + ' no tiene título');
    if (!steps[i].detail && !steps[i].math) fail('PASOS', 'el paso ' + i + ' no tiene detalle ni fórmula');
  }
  if (!Number.isInteger(p.keyStep) || p.keyStep < 0 || p.keyStep >= steps.length) {
    fail('PASO-CLAVE', 'keyStep = ' + p.keyStep + ' fuera de rango (0..' + (steps.length - 1) + ')');
  }
  let html = null;
  try {
    html = L.solutionHtml(p);
  } catch (e) {
    fail('SOLUCION-LANZÓ', (e && e.message) || String(e));
  }
  if (typeof html === 'string') {
    if (html.indexOf('<ol class="steps">') < 0) fail('SOLUCION-HTML', 'solutionHtml no pinta la lista de pasos');
    const nLis = (html.match(/<li class="step/g) || []).length;
    if (nLis !== steps.length) fail('SOLUCION-HTML', 'solutionHtml pinta ' + nLis + ' pasos y el problema tiene ' + steps.length);
    if (html.indexOf('<html') === 0) fail('SOLUCION-HTML', 'solutionHtml devuelve un documento HTML entero');
    if (canon && typeof canon === 'string' && html.indexOf(escHtml(canon)) < 0) {
      warn('SOLUCION-HTML', 'la respuesta final no aparece en el HTML de la solución');
    }
  }

  /* 8. Límite en el punto sin lado: si dice DNE, los laterales deben diferir. */
  if (p.topic !== 'continuidad' && p.statement.target
      && p.statement.target.type === 'point' && !p.statement.target.side
      && p.answer.kind === 'dne') {
    const int = p.internal;
    if (int && int.num && int.den && int.at) {
      try {
        const bs = L.limit.bothSides({ num: int.num, den: int.den, at: int.at });
        const key = (r) => (r.kind === 'finite' ? 'f:' + r.value.toString()
          : (r.kind === 'inf' ? 'i:' + (r.sign > 0 ? '+' : '-') : 'dne'));
        if (key(bs.left) === key(bs.right)) {
          fail('SIGNOS-DNE', 'bothSides dice que los laterales SÍ coinciden (' + key(bs.left) + ') pero la respuesta es DNE');
        }
      } catch (e) {
        fail('BOTH-SIDES-LANZÓ', (e && e.message) || String(e));
      }
    }
    // Contraprueba numérica con mi propio evaluador.
    const a = p.statement.target.at.toNumber();
    const L1 = [], R1 = [];
    for (let k = 1; k <= 7; k++) {
      const e = Math.pow(10, -k);
      L1.push(evalStatement(p.statement, a - e));
      R1.push(evalStatement(p.statement, a + e));
    }
    const signo = (arr) => {
      const t = arr.slice(-4).filter(Number.isFinite);
      if (t.length < 3) return 'ind';
      if (t.every((z) => z > 0) && Math.abs(t[3]) > 1e6 * Math.max(1, Math.abs(t[0]))) return '+inf';
      if (t.every((z) => z < 0) && Math.abs(t[3]) > 1e6 * Math.max(1, Math.abs(t[0]))) return '-inf';
      if (t.every((z) => Number.isFinite(z))) return 'fin:' + t[3];
      return 'ind';
    };
    const s1 = signo(L1), s2 = signo(R1);
    const difieren = (s1.startsWith('fin:') && s2.startsWith('fin:'))
      ? Math.abs(Number(s1.slice(4)) - Number(s2.slice(4))) > 1e-9
      : (s1 !== s2 && s1 !== 'ind' && s2 !== 'ind');
    if (!difieren) fail('SIGNOS-DNE', 'numéricamente los dos laterales NO difieren (' + s1 + ' / ' + s2 + ')');
  }

  /* 9. Extras: coherencia entre enunciado y respuesta. */
  if (p.answer.kind === 'infinite' && p.statement.target.type === 'infinity'
      && p.statement.target.sign === '-' && p.method === 'grados') {
    // ya verificado numéricamente en la ronda 1
  }
  if (p.statement.kind === 'continuity' && !Array.isArray(p.statement.pieces)) {
    fail('TROZOS', 'kind = continuity pero no hay statement.pieces');
  }

  return { seed, fallos, avisos, expr: exprP, canon, kind: p.answer.kind };
}

/** Tipo aproximado de una respuesta (para juzgar la plausibilidad). */
function tipoRespuesta(L, correct, s) {
  const pa = L.parseAnswer(s);
  if (!pa) return '?';
  switch (pa.type) {
    case 'rational': return 'racional';
    case 'number': return 'numero';
    case 'infinite': return 'infinito';
    case 'dne': return 'dne';
    case 'text': return 'texto:' + (/^x=/.test(pa.normalized) ? 'av' : 'ah');
    default: return 'desconocido';
  }
  void correct;
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
