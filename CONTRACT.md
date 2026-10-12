# CONTRATO DE API — `window.Lim`

Contrato **obligatorio** entre el motor matemático (`src/engine.js`) y la interfaz
(`src/app.js`). Si algo no está aquí, invéntalo de forma compatible y documéntalo
en un comentario al final del fichero.

Todo se cuelga de un único global: `window.Lim`. **Sin módulos ES, sin imports,
sin bundler.** El fichero debe poder cargarse con un `<script src>` normal.

---

## 0. Reglas de estilo obligatorias

- JavaScript ES2020, **sin dependencias externas**, sin `import`, sin `export`.
- Nada de `alert`, `prompt`, `confirm`, `prompt()`, `window.prompt`.
- Nada de colores hardcodeados en JS: el CSS expone variables (ver §8).
- La interfaz está **en español de España**. Todo el texto visible, en español.
- Usa números exactos, **nunca coma flotante** para resultados matemáticos.
- Comentarios en español.
- No uses `document.write`. No uses `innerHTML` con datos que vengan de
  landscaping el usuario (el input del alumno SÍ se escapa siempre).

---

## 1. Racionales exactos — `Lim.Q`

Racional exacto sobre `BigInt`. Constructor:

```js
Lim.Q(3)            // → Q(3,1)
Lim.Q(1n, 2n)       // → Q(1,2)
Lim.Q("-3/4")       // → Q(-3,4)   (parsea string "a/b" o entero)
Lim.Q.fromNumber(2.5) // → Q(5,2)   SOLO para constantes externas, no para cálculo
```

Propiedades y métodos:

```js
q.n  // BigInt numerador (siempre con d>0)
q.d  // BigInt denominador (siempre >0, gcd(n,d)=1)
q.num() / q.den()          // BigInt
q.toString()               // "3/4" | "-2" | "0"
q.toNumber()               // float, SOLO para render/comparación tolerante
q.toDisplay()              // "3/4" | "-2" ; para 0 → "0"
q.add(r) q.sub(r) q.mul(r) q.div(r) q.neg() q.inv() q.abs()
q.cmp(r)                   // -1 | 0 | 1
q.eq(r) q.lt(r) q.le(r) q.gt(r) q.ge(r)
q.isZero() q.isPos() q.isNeg() q.isOne()
q.pow(n /*entero*/)
```

Estáticos: `Lim.Q.ZERO`, `Lim.Q.ONE`, `Lim.Q.TWO`, `Lim.Q.minusOne`.

**El cero y la división por cero**: `q.div(Lim.Q.ZERO)` debe lanzar `Error`.

---

## 2. Polinomios — `Lim.Poly`

Polinomio en `x` con coeficientes racionales. `coeffs[0]` es el término independiente.

```js
Lim.Poly.from([1, -3, 2])        // x² -3x +1  → coefs de grado 0,1,2
Lim.Poly.from(["1/2", 3])        // acepta Q, número entero o string
Lim.Poly.zero, Lim.Poly.one
Lim.Poly.x                       // el polinomio x
Lim.Poly.constant(q)             // polinomio constante
```

Métodos (todos devuelven **polinomios nuevos**, salvo los consultores):

```js
p.degree()            // grado; -1 para el polinomio cero
p.isZero()
p.coeffs              // Lim.Q[] de índice 0..degree (sin ceros finales)
p.eval(q)             // → Q     (Horner)
p.deriv()             // → Poly
p.add(q2) p.sub(q2) p.mul(q2)
p.scale(c /*Q*/)      // multiplica por constante
p.divmod(q2)          // → { q: Poly, r: Poly }  división exacta con resto
p.divExact(q2)        // → Poly  (lanza si r ≠ 0)
p.leading()           // → Q  coeficiente principal
p.degreeDiff(q2)      // → number  grado(p) - grado(q2)
p.scaleToFit(q2)      // → Poly   divide p por x^grado(q2)   (para ∞/∞)
p.factorLinear(root /*Q*/)  // → Poly   divide por (x - root), exacto
p.rationalRoots()     // → Q[]   raíces racionales (divisores del término independiente)
p.factorAll()         // → { linear: [{root: Q, mult: number}], rest: Poly }
p.toAST()             // → AST
p.toString()
```

---

## 3. AST de expresiones y render — `Lim.ast`

Nodos inmutables:

```js
Lim.ast.num(q /*Q|number*/)
Lim.ast.var("x")
Lim.ast.pow(base, exp /*AST numérica o entera*/)
Lim.ast.neg(a)
Lim.ast.add(...terms)      // ≥2
Lim.ast.sub(a, b)          // binario
Lim.ast.mul(...factors)    // ≥2
Lim.ast.div(a, b)
Lim.ast.sqrt(a)
Lim.ast.ln(a) Lim.ast.exp(a) Lim.ast.cos(a) Lim.ast.sin(a) Lim.ast.tan(a)
Lim.ast.abs(a)
Lim.ast.pi
```

Render:

```js
Lim.ast.toMathML(node)  // → Elemento del DOM MathML (usar para pintar)
Lim.ast.toLatex(node)   // → string LaTeX simple, para depurar/tests
Lim.ast.toPlain(node)   // → string unicode plano: "3/4", "x^2", "√x", "no aplica"
Lim.ast.equals(a, b)    // → boolean (comparación estructural simplificada)
```

**Regla de render importante**: los polinomios deben imprimirse **con el término
independiente primero** cuando el grado es ≤ 2 (`x²-3x+2`, no `2x²...` deshordened),
y en orden descendente para grado ≥ 3 (`x⁴+2x²-1`). Maneja los signos con
`−` tipográfico y **sin el `+` inicial espurio**.

---

## 4. Motor de límites — `Lim.limit`

Devuelve un objeto discriminante:

```js
{ kind: "finite", value: Q }
{ kind: "inf",    sign: +1 | -1 }
{ kind: "dne" }
```

API:

```js
Lim.limit.rational({ num: Poly, den: Poly, at: Q, side: "-" | "+" | null })  // → Result
Lim.limit.infinity({ num: Poly, den: Poly, sign: "+" | "-" })               // → Result
Lim.limit.bothSides({ num: Poly, den: Poly, at: Q })
  // → { left: Result, right: Result, at: Result }   at.dne si left≠right
```

Casos que **debe** resolver bien:

| Entrada | Resultado |
|---|---|
| `Q(a)` ≠ 0 | `finite` |
| numerador 0, denominador 0 | `finite` tras cancelar el factor común `(x-a)` |
| numerador ≠ 0, denominador 0 | `inf` con el signo correcto según el lado |
| num 0, den ≠ 0 | `finite 0` |
| lados opuestos | `dne` |
| grado num > grado den en `+∞` | `inf` con signo del coeficiente principal |
| grado num < grado den en `+∞` | `finite 0` |
| grados iguales en `+∞` | `finite` cociente de principales |
| en `−∞` y grado **impar** | `inf` con signo invertido |
| en `−∞` y grado par | mismo signo que en `+∞` |

---

## 5. Generador aleatorio determinista — `Lim.rng`

```js
const rand = Lim.rng(seed);   // seed: entero
rand();                       // float en [0,1)
rand.int(min, max);           // entero en [min, max] INCLUSIVE
rand.pick(array);
rand.bool(p /*probabilidad 0..1, por defecto 0.5*/);
rand.shuffle(array);          // devuelve copia barajada
```

Determinista: **el mismo `seed` debe producir exactamente el mismo problema**.
Es esencial (el cuaderno de errores guarda la semilla).

---

## 6. Generadores de problemas

```js
Lim.GENERATORS = {
  "subst-directa": {
    id: "subst-directa",
    topic: "sustitucion",       // ver §7
    difficulty: 1,              // 1..5
    method: "sustitucion",      // ver §7, método principal
    title: "Sustitución directa",
    make(rand, opts) { /* → Problem */ }
  },
  // ... 23 en total
}

Lim.generatorList()   // → array de ids
```

### Objeto `Problem`

```js
{
  id: "subst-directa-4821",
  seed: 4821,
  generatorId: "subst-directa",
  topic: "sustitucion",
  difficulty: 1,
  method: "sustitucion",

  statement: {
    expr: AST,                        // la expresión del límite
    target: { type: "point", at: Q, side: "-" | "+" | null }
           | { type: "infinity", sign: "+" | "-" },
    // Solo para continuidad:
    pieces: [ { expr: AST, cond: "x ≤ 1", condType: "le"|"lt"|"ge"|"gt"|"eq" } ],
    pieceParams: { p: "p", k: "k", a: "a" },   // parámetros a determinar
    question: "¿Es f continua en x = 2 ?",      // opcional, sustituye al enunciado estándar
    kind: "limit" | "continuity" | "asyptote"
  },

  answer: Ver §7 "Answer",

  quiz: {                              // INTERROGATORIO DE MÉTODO (obligatorio)
    kind: "metodo" | "indeterminacion" | "porque",
    question: "¿Qué técnica hay que aplicar?",
    options: ["...", "...", "...", "..."],   // exactamente 4 strings
    correct: 2,                            // índice de la correcta
    explain: "Al sustituir sale 0/0, así que hay que factorizar antes de cancelar."
  },

  steps: [                             // SOLUCIÓN PASO A PASO
    { title: "Sustituimos", detail: "x = 2 en ambos polinomios.", math: AST /*opcional*/ },
    { title: "Indeterminación 0/0", detail: "Ambos se anulan: 4-6+2 y 4-4.", math: AST },
    // ...
  ],
  keyStep: 1,                          // índice del paso clave (para destacar)

  distractors: [                        // 3 valores falsos para las 4 opciones múltiples
    Answer, Answer, Answer
  ]
}
```

### `Answer`

```js
{ kind: "rational", value: Q }
{ kind: "infinite", sign: +1 | -1 }
{ kind: "dne" }
{ kind: "choice",   options: [Q|"+inf"|"-inf"|"dne"|"si"|"no", ...], correct: 0..3 }
{ kind: "text",     value: string }     // p.ej. "x = 3" para asíntota vertical
```

---

## 7. Tópicos y métodos

```js
Lim.TOPICS = [
  { id:"sustitucion",     name:"Sustitución y laterales",  color:"--c-sustitucion" },
  { id:"infinito",        name:"Límites en el infinito",    color:"--c-infinito" },
  { id:"indeterminacion", name:"Indeterminaciones",        color:"--c-indet" },
  { id:"continuidad",     name:"Continuidad",              color:"--c-continuidad" }
];

Lim.METHODS = {
  sustitucion:        { name:"Sustitución directa",           desc:"Se sustituye y ya está." },
  denominador:        { name:"Denominador anulado",          desc:"Se anula el denominador: hay que mirar el signo y los lados." },
  lateral:            { name:"Límites laterales",            desc:"Se estudia por izquierda y por derecha por separado." },
  dominantePolinomio: { name:"Término dominante (polinomio)",desc:"En un polinomio manda el término de mayor grado." },
  jerarquia:          { name:"Jerarquía de crecimiento",     desc:"Exponencial > Polinómica > Logarítmica > Constante." },
  grados:             { name:"Comparar grados",             desc:"Se divide numerador y denominador entre x elevado al grado mayor." },
  factorizar:         { name:"Factorizar y simplificar",    desc:"Indeterminación 0/0: se factoriza y se cancela el factor común." },
  racionalizar:       { name:"Racionalizar",                desc:"Se multiplica por el conjugado para quitar la raíz del denominador." },
  restar:             { name:"Desarrollar la resta",        desc:"Indeterminación ∞−∞ en cocientes: común denominador y término dominante." },
  transformar:        { name:"Transformar a otra forma",    desc:"0·∞ se pasa a 0/0 o a ∞/∞." },
  numeroE:            { name:"Fórmula del número e",        desc:"1^∞ se resuelve con la fórmula de la e." },
  notable:            { name:"Límite notable",              desc:"Se usa un límite conocido, como sen x / x = 1." },
  continuidade:        { name:"Las tres condiciones",        desc:"f definida, límite existente y límite = f(a)." }
};
```

---

## 8. Niveles

```js
Lim.LEVELS = [
  {
    id: "sustituir", n: 1, name: "Sustituir",
    generators: ["subst-directa"],
    required: 8, total: 10
  },
  // ... 10 niveles
];
```

---

## 9. Funciones de nivel superior (las usa `app.js`)

```js
// Genera un problema nuevo.
Lim.generate({ seed?, generatorIds?, topic?, difficultyMin?, difficultyMax? }) → Problem

// Comprueba la respuesta del alumno contra la del problema.
Lim.checkAnswer(problem, raw /*string*/) → {
  correct: boolean,
  normalized: string,     // lo que entendió: "3/4", "+inf", "no existe", ...
  reason?: string         // por qué está mal, en español, para mostrar feedback
}

// Comprueba la respuesta al interrogatorio de método (índice 0..3).
Lim.checkQuiz(problem, index) → boolean

// Resumen legible de una respuesta (para pintar "Tu respuesta: 3/4").
Lim.answerToString(answer) → string

// Texto de la solución como HTML seguro ya listo para el panel de solución.
Lim.solutionHtml(problem) → string
```

`checkAnswer` **debe** aceptar todas estas formas en `raw`:

```
"3/4"   "3 / 4"   "-2"   "2,5"   "+infinity"   "-infinity"   "inf"   "-inf"
"+∞"    "-∞"       "no existe"   "noexiste"   "dne"   "no"
"ln(2)/2"   "e"   "2.71828"   "x = 3"   "x=3"
```

- Respuesta racional → comparación **exacta** por `Q.eq`.
- Respuesta no racional → numérica con tolerancia `1e-6` relativo.
- Si el alumno escribe algo que no se puede parsear, `correct:false` y
  `reason:"No entiendo esa respuesta"`.

---

## 10. Contrato CSS para `app.js`

`app.js` usa estas variables, todas definidas en `styles.css`:

```
--bg, --bg-elev, --bg-elev-2, --fg, --fg-dim, --fg-faint
--accent, --accent-2, --ok, --warn, --err
--border, --border-strong
--c-sustitucion, --c-infinito, --c-indet, --c-continuidad
--r-sm, --r-md, --r-lg, --r-full
--shadow-1, --shadow-2
--font, --font-math, --font-mono
```

Clases que `app.js` debe poder usar tal cual:

```
.screen            -- pantalla activa
.card              -- tarjeta elevada
.btn .btn-primary .btn-ghost .btn-danger
.chip .chip-ok .chip-err .chip-warn
.field             -- input de texto
.opt               -- botón de opción múltiple
.opt.correct .opt.wrong
.panel-solution    -- panel de solución paso a paso
.step              -- cada paso de la solución