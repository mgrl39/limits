/**
 * lib/verify-one.mjs — Verificación numérica de UN problema.
 *
 * Recibe el problema que da el motor y comprueba, evaluando la función
 * por su cuenta (`lib/eval-ast.mjs`), si la respuesta del motor es la
 * correcta. Aquí NO se usa ninguna lógica del motor para decidir el
 * límite: solo se usan `statement` (enunciado) y `answer` (respuesta).
 */
import { evalStatement, evalExprAt } from './eval-ast.mjs';
import {
  pointSamples, infinitySamples,
  checkFinite, checkInfinite, checkDne,
  checkVerticalAsymptote, checkHorizontalAsymptote
} from './trends.mjs';

/** Valor numérico esperado según el tipo de respuesta. */
function targetValue(answer) {
  if (answer.kind === 'rational') return answer.value.toNumber();
  if (answer.kind === 'numeric') return Number(answer.value);
  return null;
}

export function verifyOne(L, gid, seed, mode) {
  if (mode !== 'numeric') return { seed, verdict: 'error', detail: 'modo desconocido: ' + mode };
  const p = L.generate({ seed, generatorIds: [gid] });

  const base = {
    seed,
    gen: gid,
    expr: L.ast.toPlain(p.statement.expr),
    target: L.targetLabel(p.statement.target),
    answer: L.answerToString(p.answer),
    kind: p.answer.kind
  };

  // Los generadores de continuidad no piden el valor de un límite
  // (preguntan una decisión o un parámetro): se tratan en la ronda 3.
  if (p.topic === 'continuidad') return { ...base, verdict: 'exento' };

  const answer = p.answer;
  const st = p.statement;

  /* --- Respuestas textuales: asíntotas --- */
  if (answer.kind === 'text') {
    const s = String(answer.value).trim();
    const numTxt = '(-?\\d+(?:\\.\\d+)?(?:\\/-?\\d+(?:\\.\\d+)?)?)';
    let m = new RegExp('^x\\s*=\\s*' + numTxt + '$').exec(s);
    if (m) {
      const r = Number(m[1]);
      const chk = checkVerticalAsymptote((x) => evalStatement(st, x), r);
      return { ...base, verdict: chk.verdict, detail: chk.detail, samples: [] };
    }
    m = new RegExp('^y\\s*=\\s*' + numTxt + '$').exec(s);
    if (m) {
      const v = m[1].includes('/')
        ? Number(m[1].split('/')[0]) / Number(m[1].split('/')[1])
        : Number(m[1]);
      const xs = infinitySamples(st.target.sign);
      const vals = xs.map((x) => evalStatement(st, x));
      const chk = checkHorizontalAsymptote(vals, v);
      return { ...base, verdict: chk.verdict, detail: chk.detail, samples: vals.map(fmt) };
    }
    return { ...base, verdict: 'discrepancia', detail: 'respuesta textual no verificable: ' + s, samples: [] };
  }

  /* --- Límite en un punto --- */
  if (st.target.type === 'point') {
    const a = st.target.at.toNumber();
    if (answer.kind === 'dne') {
      const side = st.target.side;
      if (side) {
        return {
          ...base, verdict: 'discrepancia',
          detail: 'responde "no existe" pero el enunciado pide un solo lateral (' + side + ')',
          samples: []
        };
      }
      const xl = pointSamples(a, '-');
      const xr = pointSamples(a, '+');
      const lv = xl.map((x) => evalStatement(st, x));
      const rv = xr.map((x) => evalStatement(st, x));
      const chk = checkDne(lv, rv);
      return { ...base, verdict: chk.verdict, detail: chk.detail, samples: lv.map(fmt).concat(rv.map(fmt)) };
    }

    // Con lado nulo se evalúan los DOS costados por separado: el último
    // valor de una lista intercalada no significa nada.
    if (!st.target.side) {
      const lv = pointSamples(a, '-').map((x) => evalStatement(st, x));
      const rv = pointSamples(a, '+').map((x) => evalStatement(st, x));
      const runOne = (vals) => (answer.kind === 'infinite'
        ? checkInfinite([], vals, answer.sign)
        : checkFinite([], vals, targetValue(answer)));
      const cl = runOne(lv), cr = runOne(rv);
      const order = { discrepancia: 3, dudoso: 2, ok: 1 };
      const peor = order[cl.verdict] >= order[cr.verdict] ? cl : cr;
      const lado = peor === cl ? 'izquierda' : 'derecha';
      return {
        ...base, verdict: peor.verdict,
        detail: 'por la ' + lado + ': ' + peor.detail,
        samples: lv.map(fmt).concat(rv.map(fmt))
      };
    }

    const xs = pointSamples(a, st.target.side);
    const vals = xs.map((x) => evalStatement(st, x));
    if (answer.kind === 'infinite') {
      const chk = checkInfinite(xs, vals, answer.sign);
      return { ...base, verdict: chk.verdict, detail: chk.detail, samples: vals.map(fmt) };
    }
    const tv = targetValue(answer);
    const chk = checkFinite(xs, vals, tv);
    return { ...base, verdict: chk.verdict, detail: chk.detail, samples: vals.map(fmt) };
  }

  /* --- Límite en el infinito --- */
  if (st.target.type === 'infinity') {
    const xs = infinitySamples(st.target.sign);
    const vals = xs.map((x) => evalStatement(st, x));
    if (answer.kind === 'infinite') {
      const chk = checkInfinite(xs, vals, answer.sign);
      return { ...base, verdict: chk.verdict, detail: chk.detail, samples: vals.map(fmt) };
    }
    if (answer.kind === 'dne') {
      const chk = checkDne(vals, vals.map(() => NaN));
      return {
        ...base, verdict: 'dudoso',
        detail: 'en el infinito el motor dice DNE; observado ' + vals.slice(-3).map(fmt).join(', '),
        samples: vals.map(fmt)
      };
    }
    const tv = targetValue(answer);
    const chk = checkFinite(xs, vals, tv);
    return { ...base, verdict: chk.verdict, detail: chk.detail, samples: vals.map(fmt) };
  }

  return { ...base, verdict: 'discrepancia', detail: 'objetivo desconocido', samples: [] };
}

function fmt(v) {
  if (Number.isFinite(v)) return Number(v.toPrecision(6));
  if (Number.isNaN(v)) return 'NaN';
  return v > 0 ? '+inf' : '-inf';
}
