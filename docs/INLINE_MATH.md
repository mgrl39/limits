# Contrato: matemática en línea dentro del texto (`^2` → ²)

> **Este documento es NORMATIVO.** Los tres subagentes trabajan en paralelo sobre
> ficheros distintos, así que la única forma de que no se pisen es que todos
> respeten esta especificación al pie de la letra. Cualquier desviación se
> rompe: no improvises API nuevas.

---

## 0. El problema

El motor y la hoja de teoría escriben la matemática en **texto plano** dentro de
las explicaciones, con notación tipo LaTeX:

```
"Al dividir entre x^3 queda (x^3 − 1)/(x^2 − 4) …"
"1^∞ y 0^0 necesitan cambio de base"
```

Esos `^` se pintan con `textContent`, así que el alumno lee literalmente
**`x^3`**, con el circunflejo. En un contexto donde ya hay MathML de verdad
(`step-math`), queda claro que es un descuido, no una convención.

Mientras tanto, el enunciado, la fórmula y la solución **sí** usan MathML nativo
(`AST.toMathML`, `<msup>`, `<mfrac>`). O sea: la misma potencia aparece de dos
formas según dónde la mires.

## 1. Por qué NO metemos KaTeX ni ninguna librería

Se ha preguntado explícitamente si hay una dependencia que lo arregle. **No la
metemos**, y estas son las razones, todas ya escritas en el `README.md`:

1. El proyecto es **cero dependencias por diseño**: ni npm, ni bundler, ni una
   línea de `import`. Está declarado como requisito, no como casualidad.
2. `index.html` es **un único fichero autocontenido**: cero peticiones de red,
   cero CDN, cero fuentes externas. KaTeX son ~270 KB más una fuente web.
3. Tiene que funcionar con **doble clic**, sin internet, desde un pendrive.
4. MathML **nativo** ya está en todos los navegadores de escritorio y en
   Safari/Firefox de móvil. No hace falta motor externo para pintar
   `<msup>`. Lo único que falta es el *parser* del trocito de notación.

Así que la solución es un parser propio de ~150 líneas, sin dependencias, que
reutiliza el MathML nativo que el proyecto ya construye a mano.

## 2. API pública (CONGELADA)

Un único fichero nuevo: **`src/inline-math.js`**, que publica
`window.InlineMath`. Sin `import`/`export`: es un IIFE que se pega en el
`<script>` y se apoya en el patrón `root` que ya usan `engine.js` y `app.js`
(`typeof window`, `typeof globalThis`, etc.).

```js
InlineMath.nodes(text, opts) -> DocumentFragment
InlineMath.text(text)        -> string
InlineMath.has(text)         -> boolean
InlineMath.TOKEN_RE          -> RegExp   // solo para tests; la gramática en un sitio
```

- **`nodes(text, opts)`** → `DocumentFragment` con una mezcla de nodos de texto
  y nodos MathML (`<msup>`, `<msub>`), **listo para `appendChild`** en un
  `<div>` de prosa normal. Es la función para **texto visible**.
  `opts = { display: false }` por defecto. Si `text` no tiene nada que
  convertir, devuelve un fragmento con **un solo nodo de texto** (comportamiento
  idéntico a hoy). Si `document` no existe (Node), devuelve un `DocumentFragment`
  vacío y `has()` sigue funcionando — los tests de Node no necesitan DOM.
- **`text(text)`** → `string` plano con **superíndices Unicode**: `x^2` → `x²`.
  Es la función para **atributos y contextos sin DOM**: `title`, `aria-label`,
  `localStorage`, portapapeles, exports. Si un exponente no tiene carácter
  Unicode equivalente (caso de `∞`, `1^∞`), **se deja tal cual** (`1^∞`): es
  preferible un `^` feo a inventarse un glyph.
- **`has(text)`** → `true` si el texto contiene algo convertible. Es un atajo
  barato (`indexOf("^") < 0 && indexOf("_") < 0`) para que los puntos de
  render que hoy usan `textContent` sigan siendo **idénticos** cuando no hay
  nada que maths, y no cambien ni una coma el DOM existente.

## 3. Gramática (deliberadamente diminuta y conservadora)

Se procesa **de izquierda a derecha** con un `while` y un índice. Nunca regex
recursivas, nunca `eval`, nunca `innerHTML`.

Un exponente se reconoce **solo** si se cumple **todo**:

- el carácter anterior (`base`) es `a-z A-Z 0-9 ) ]` — una letra, un dígito o
  el cierre de un grupo. **No** es un espacio ni un signo;
- va inmediatamente después, sin espacio;
- el exponente es: un **dígito suelto** (`^2`), **o** un **grupo entre
  paréntesis** cerrado en los siguientes 8 caracteres (`^(2n+1)`) cuyo interior
  no contenga otro `(`, **o** una **letra suelta minúscula** (`^x`, `^n`, `^a`,
  `^b`, `^k` — las variables de exponente del temario).

Todo lo demás (`^` suelto, `^∞`, `^)`, `^^`) **se deja como texto tal cual**.
Escribir un parser de LaTeX completo aquí sería una invitación a bugs; el
objetivo es que no quede ningún `^2` feo en pantalla, no interpretar todo.

Los subíndices `_` siguen la misma regla: `x_1`, `a_n`, `x_(n+1)` → `<msub>`.

### Caracteres que se pasan tal cual al texto

`−` (U+2212 menos), `·` (U+00B7), `∞`, `→`, `≤`, `≥`, `√`. El proyecto ya los
usa y se conservan intactos.

### Lo que el parser **NO** hace

- No construye `<mfrac>`: `a/b` se queda como barra en la prosa (en una columna
  estrecha una fracción apilada se lee peor; el enunciado ya usa `<mfrac>` de
  verdad).
- No inventa bases: si no hay carácter válido detrás, no toca nada.
- No toca lo que ya es un nodo MathML: los ficheros que reciben nodos del motor
  (`renderExpr`, `step-math`) **no pasan por aquí**.

## 4. Seguridad (invocable desde `tests/ui-spec.test.mjs`)

- **Nunca `innerHTML`** con nada que venga de una cadena. Todo el texto entra
  con `document.createTextNode`, que escapa solo.
- El MathML se construye **siempre** con `document.createElementNS(NS_MATH, …)`,
  nunca `createElement` (fuera del namespace MathML el navegador no lo pinta).
- `nodes()` **nunca lanza**. Con cualquier `text` raro (`null`, `undefined`,
  número, `{}`) devuelve un fragmento con el texto coaccionado a `String()`.
- `text()` **nunca lanza** y es una función pura de string a string.

## 5. Reparto de ficheros (sin solapes)

Cada agente es dueño exclusivo de sus ficheros. **Nadie toca los ficheros de
otro.**

| Agente | Ficheros que puede tocar |
|---|---|
| **1 — núcleo** | `src/inline-math.js` (nuevo), `tests/inline-math.test.mjs` (nuevo), `build.mjs` |
| **2 — cableado** | `src/app.js`, `src/ui-core.js`, `src/pagina-juego.js`, `src/pagina-teoria.js`, `src/styles.css`, `dev.html`, `teoria.html`, `juego.html` |
| **3 — contenido** | `src/engine.js`, `src/gen-avanzados.js`, `src/gen-existencia.js`, `src/i18n.js`, `src/theory-data.js`, `README.md`, `docs/CONCEPTOS.md`, `tests/theoria-smoke.mjs` |

`index.html` **no lo edita nadie**: es generado. Lo reensambla el agente 1 al
final con `node build.mjs`.

## 6. Línea base de tests (ANTES de tocar nada)

```
node --test tests/engine.test.mjs      -> 49 pass, 0 fail
node --test tests/invariants.test.mjs  ->  8 pass, 0 fail
node --test tests/ui-spec.test.mjs     -> 157 pass, 17 FAIL (preexistentes)
node tests/smoke.mjs                   -> OK
node tests/theoria-smoke.mjs           -> OK
```

Los **17 fallos de `ui-spec.test.mjs` ya existen antes de este trabajo**: son
 specs escritas contra una versión anterior de la interfaz (botones de portada,
 intervalo de reinyección de 5, foco, tablas de teoría…). **No es tarea de este
 trabajo arreglarlos** y **no se cuentan como regresión**. Lo que sí es
 Regression: que el número de fallos **suba** de 17.

## 7. Definición de «hecho» para los tres

- Cero apariciones de `^` en texto visible renderizado (las que follow en
  `grep` sobre literales de prosa se corrigen en el fichero de contenido).
- `node build.mjs` genera un `index.html` sin URLs de red y con el mismo peso
  ±5 %.
- Los tests de la línea base siguen igual: 49 / 8 / ≤17 fallos.
- Ningún cambio en la **matemática**: los generadores devuelven exactamente el
  mismo `answer`, el mismo `expr` y el mismo `keyStep` que antes. Solo cambian
  las cadenas de texto y los nodos de presentación.