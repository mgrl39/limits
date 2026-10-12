/**
 * tools/dump-cases.mjs — Saca N casos representativos de cada generador
 * para la revisión manual (ronda 3). Imprime enunciado, respuesta, pasos,
 * interrogatorio y distractores, con la semilla exacta.
 *
 *   node tests/tools/dump-cases.mjs [generador] [semillas...]
 */
import { loadEngine } from '../lib/engine.mjs';

const L = loadEngine();
const gid = process.argv[2];
const seeds = process.argv.slice(3).map(Number);
const ids = gid && gid !== '-' ? [gid] : L.generatorList();
const lista = seeds.length ? seeds : [1, 7, 13, 29, 41];

for (const id of ids) {
  for (const seed of lista) {
    let p;
    try { p = L.generate({ seed, generatorIds: [id] }); } catch (e) {
      console.log('### ' + id + ' semilla ' + seed + ' → ERROR ' + e.message); continue;
    }
    console.log('══════════════════════════════════════════════════════');
    console.log('GENERADOR ' + id + '   semilla ' + seed + '   (tópico ' + p.topic + ', método ' + p.method + ')');
    console.log('ENUNCIADO : ' + L.ast.toLatex(p.statement.expr));
    console.log('PLANO     : ' + L.ast.toPlain(p.statement.expr));
    console.log('OBJETIVO  : ' + L.targetLabel(p.statement.target));
    if (p.statement.question) console.log('PREGUNTA  : ' + p.statement.question);
    if (p.statement.pieces) {
      for (const pc of p.statement.pieces) {
        console.log('  TROZO[' + pc.condType + ' ' + pc.cond + '] = ' + L.ast.toPlain(pc.expr));
      }
    }
    console.log('RESPUESTA : ' + L.answerToString(p.answer) + '   (' + JSON.stringify(p.answer, (k, v) => typeof v === 'bigint' ? v.toString() : v) + ')');
    console.log('DISTRACT. : ' + (p.distractors || []).map((d) => L.answerToString(d)).join('  |  '));
    if (p.internal) {
      const i = p.internal;
      console.log('INTERNO   : ' + Object.keys(i).map((k) => {
        const v = i[k];
        if (v && typeof v.toString === 'function' && v.constructor && v.constructor.name === 'Poly') return k + '=' + v.toString();
        return k + '=' + (v && v.constructor && v.constructor.name === 'Q' ? v.toString() : String(v));
      }).join('  '));
    }
    console.log('INTERROG. : ' + p.quiz.question);
    p.quiz.options.forEach((o, i) => console.log('   [' + i + ']' + (i === p.quiz.correct ? ' (correcta)' : '          ') + ' ' + o));
    console.log('   explicación: ' + p.quiz.explain);
    console.log('PASOS:');
    p.steps.forEach((s, i) => {
      console.log('  ' + (i + 1) + '. ' + (i === p.keyStep ? '★ ' : '  ') + s.title);
      console.log('     ' + s.detail);
      if (s.math) console.log('     [math] ' + L.ast.toPlain(s.math));
    });
    console.log('');
  }
}
