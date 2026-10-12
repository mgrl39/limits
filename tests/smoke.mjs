/* =====================================================================
 * tests/smoke.mjs — comprobación de humo de los 23 generadores.
 *
 *   node tests/smoke.mjs [semillasPorGenerador]
 *
 * Recorre TODOS los generadores con N semillas (500 por defecto) y
 * comprueba, para cada problema:
 *   1. statement.expr es un AST válido
 *   2. problem.answer se serializa sin excepción
 *   3. checkAnswer(problem, answerToString(answer)).correct === true
 *      (el alumno que escribe la respuesta correcta siempre acierta)
 *   4. quiz.options.length === 4 y 0 <= correct < 4
 *   5. steps.length >= 2 (y <= 5)
 *   6. distractors.length === 3 y ninguno coincide con la respuesta
 *
 * Además: el enunciado se renderiza a MathML, la solución a HTML sin
 * inyectar etiquetas, y las respuestas coinciden con el motor de límites.
 * ===================================================================== */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Lim = require("../src/engine.js");

const SEMILLAS = Number(process.argv[2] || 500);
const errores = [];
const avisos = [];

function fallo(id, seed, msg) {
  errores.push(id + " [seed " + seed + "]: " + msg);
}

/** Comprueba un problema completo. */
function comprobar(problema, id, seed) {
  const p = problema;

  /* 1. AST válido */
  if (!Lim.ast.validate(p.statement.expr)) {
    fallo(id, seed, "statement.expr no es un AST válido");
    return;
  }
  try {
    const plano = Lim.ast.toPlain(p.statement.expr);
    if (typeof plano !== "string" || plano.length === 0 || plano.indexOf("?") >= 0) {
      fallo(id, seed, "toPlain del enunciado suspicious: " + plano);
    }
    /* el enunciado debe poder renderizarse a MathML real */
    const xml = Lim.ast.toMathMLString(p.statement.expr);
    if (!xml.startsWith("<math") || !xml.includes("xmlns=\"http://www.w3.org/1998/Math/MathML\"")) {
      fallo(id, seed, "MathML del enunciado mal formado");
    }
    if (xml.indexOf("<script") >= 0) fallo(id, seed, "MathML con script");
  } catch (e) {
    fallo(id, seed, "excepción al renderizar el enunciado: " + e.message);
  }

  /* 2. La respuesta se serializa sin excepción */
  let texto;
  try {
    texto = Lim.answerToString(p.answer);
    if (typeof texto !== "string" || texto.length === 0) {
      fallo(id, seed, "answerToString devuelve vacío");
      return;
    }
  } catch (e) {
    fallo(id, seed, "answerToString lanza: " + e.message);
    return;
  }

  /* 3. La respuesta canónica se acepta */
  const res = Lim.checkAnswer(p, texto);
  if (res.correct !== true) {
    fallo(id, seed, "checkAnswer rejects \"" + texto + "\" (" + (res.reason || "") + ")");
  }
  if (typeof res.normalized !== "string") {
    fallo(id, seed, "checkAnswer no devuelve normalized");
  }

  /* 4. Quiz de 4 opciones */
  if (!p.quiz || !Array.isArray(p.quiz.options)) {
    fallo(id, seed, "falta el quiz");
  } else {
    if (p.quiz.options.length !== 4) fallo(id, seed, "quiz.options.length = " + p.quiz.options.length);
    if (!(p.quiz.correct >= 0 && p.quiz.correct < 4)) fallo(id, seed, "quiz.correct fuera de rango");
    if (new Set(p.quiz.options).size !== 4) fallo(id, seed, "opciones de quiz repetidas");
    if (!Lim.checkQuiz(p, p.quiz.correct)) fallo(id, seed, "checkQuiz falla en la correcta");
    if (p.quiz.options.some((o) => typeof o !== "string" || !o.length)) {
      fallo(id, seed, "opciones de quiz vacías");
    }
    /* para quizzes de método/porqué, las otras 3 deben ser métodos reales */
    if (p.quiz.kind === "metodo" && p.quiz.options[p.quiz.correct].length < 10) {
      fallo(id, seed, "la opción correcta de método es demasiado corta");
    }
  }

  /* 5. Pasos */
  if (!Array.isArray(p.steps)) {
    fallo(id, seed, "falta steps");
  } else {
    if (p.steps.length < 2) fallo(id, seed, "solo " + p.steps.length + " pasos");
    if (p.steps.length > 5) fallo(id, seed, p.steps.length + " pasos (máximo 5)");
    if (!(p.keyStep >= 0 && p.keyStep < p.steps.length)) fallo(id, seed, "keyStep fuera de rango");
    if (!p.steps.some((s) => s.key === true)) fallo(id, seed, "ningún paso marcado como clave");
    for (const st of p.steps) {
      if (!st.title || typeof st.title !== "string") fallo(id, seed, "paso sin título");
      if (!st.detail || typeof st.detail !== "string") fallo(id, seed, "paso sin detalle");
      if (st.math && !Lim.ast.validate(st.math)) fallo(id, seed, "paso con AST inválido: " + st.title);
    }
    /* al menos un paso de resultado y al menos uno con math */
    if (!p.steps.some((st) => st.math)) fallo(id, seed, "ningún paso lleva la fórmula");
  }

  /* 6. Distractores */
  if (!Array.isArray(p.distractors)) {
    fallo(id, seed, "faltan los distractores");
  } else {
    if (p.distractors.length !== 3) fallo(id, seed, "distractors.length = " + p.distractors.length);
    const clave = (a) => JSON.stringify(a);
    if (new Set(p.distractors.map(clave)).size !== p.distractors.length) {
      fallo(id, seed, "distractores repetidos");
    }
    for (const d of p.distractors) {
      let t;
      try {
        t = Lim.answerToString(d);
      } catch (e) {
        fallo(id, seed, "distractor no serializable: " + e.message);
        continue;
      }
      if (!t) fallo(id, seed, "distractor vacío");
      if (Lim.checkAnswer(p, t).correct) {
        fallo(id, seed, "el distractor \"" + t + "\" sería correcto");
      }
    }
  }

  /* 7. Solución HTML: sin inyección y con el paso clave marcado */
  try {
    const html = Lim.solutionHtml(p);
    if (html.indexOf("<script") >= 0) fallo(id, seed, "solutionHtml inyecta <script>");
    if (html.indexOf('class="step key"') < 0) fallo(id, seed, "solutionHtml no marca el paso clave");
    if ((html.match(/<li class="step/g) || []).length !== p.steps.length) {
      fallo(id, seed, "solutionHtml no pinta todos los pasos");
    }
  } catch (e) {
    fallo(id, seed, "solutionHtml lanza: " + e.message);
  }

  /* 8. Coherencia con el motor de límites */
  const it = p.internal;
  if (it && it.num) {
    const r = it.infSign
      ? Lim.limit.infinity({ num: it.num, den: it.den, sign: it.infSign })
      : Lim.limit.atPoint({ num: it.num, den: it.den, at: it.at, side: it.side || null });
    const a = p.answer;
    if (a.kind === "rational" && r.kind === "finite" && !a.value.eq(r.value)) {
      fallo(id, seed, "el motor dice " + r.value.toString() + " y la respuesta es " + a.value.toString());
    }
    if (a.kind === "infinite" && r.kind === "inf" && a.sign !== r.sign) {
      fallo(id, seed, "signo de infinito distinto al del motor");
    }
    if (a.kind === "dne" && r.kind !== "dne") {
      fallo(id, seed, "la respuesta es «no existe» pero el motor da " + JSON.stringify(r));
    }
  }

  /* 9. Determinismo: la misma semilla da el mismo problema */
  if (seed % 97 === 0 && Lim.GENERATORS[id]) {
    const otro = Lim.GENERATORS[id].make(Lim.rng(seed));
    if (JSON.stringify(otro) !== JSON.stringify(p)) fallo(id, seed, "no es determinista");
  }
}

/* --- Barrido --- */
const t0 = Date.now();
const ids = Lim.generatorList();
let total = 0;

for (const id of ids) {
  const g = Lim.GENERATORS[id];
  const antes = errores.length;
  for (let seed = 0; seed < SEMILLAS; seed++) {
    let p;
    try {
      p = g.make(Lim.rng(seed));
    } catch (e) {
      fallo(id, seed, "make() lanza: " + e.message);
      continue;
    }
    comprobar(p, id, seed);
    total++;
  }
  const nuevos = errores.length - antes;
  console.log((nuevos ? "✖" : "✔") + " " + id.padEnd(28) +
    SEMILLAS + " semillas" + (nuevos ? " — " + nuevos + " PROBLEMAS" : " — ok"));
}

/* generate() también debe pasar la misma comprobación */
for (let seed = 0; seed < SEMILLAS; seed++) {
  let p;
  try {
    p = Lim.generate({ seed: seed });
  } catch (e) {
    fallo("generate", seed, "lanza: " + e.message);
    continue;
  }
  comprobar(p, "generate(" + p.generatorId + ")", seed);
  total++;
}

/* --- Informe --- */
console.log("");
if (errores.length) {
  console.log("FALLOS (" + errores.length + "):");
  for (const e of errores.slice(0, 40)) console.log("  · " + e);
  if (errores.length > 40) console.log("  … y " + (errores.length - 40) + " más");
  process.exit(1);
}
console.log("✔ " + total + " problemas comprobados (" + ids.length + " generadores × " + SEMILLAS + " semillas) sin fallos");
console.log("  tiempo: " + (Date.now() - t0) + " ms");
for (const a of avisos) console.log("  aviso: " + a);
process.exit(0);