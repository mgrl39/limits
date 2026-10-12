# Límites — juego de cálculo para 2.º de Bachillerato

Un juego web para practicar **límites y continuidad** al nivel del temario LOMLOE de
2.º de Bachillerato. Cada vez que entras te da un problema distinto, te obliga a
elegir **qué técnica** vas a usar antes de calcular, comprueba la respuesta y te
enseña la solución paso a paso. Además lleva una **hoja de teoría** completa y un
**cuaderno de errores** que solo guarda lo que te sale mal, porque ahí está justo
lo que hay que repasar.

No es un curso. Es un simulador de exámenes: preguntas cortas, muchas, y respuesta
inmediata.

---

## Cómo usarlo

1. Abre **`index.html`** con doble clic.
2. Ya está. No hace falta servidor, ni internet, ni instalar nada.

Eso es todo de verdad. El fichero es autónomo: si te lo pasas por correo o lo metes
en un pendrive, funciona igual.

**Dónde se guarda lo que haces.** El progreso (ajustes, estadísticas, campaña y
cuaderno de errores) vive en el `localStorage` del navegador, bajo la clave
`limites:v1`. No hay servidor, no hay cuentas y no sale nada de tu ordenador. Eso
significa también que:

- el progreso es **por navegador y por dispositivo** (no se sincroniza);
- si borras los datos del navegador, o entras en modo incógnito, o abres el juego
  en otro navegador, empiezas de cero;
- para empezar de cero a propósito, usa el botón de borrar progreso.

---

## Cómo está hecho

- **Un único fichero HTML.** `index.html` contiene el CSS, el motor matemático y la
  interfaz, todo junto. Cero peticiones de red, cero CDN, cero fuentes externas.
  Abre con doble clic y funciona sin conexión.
- **Cero dependencias.** Ni npm, ni bundler, ni framework. Ni una línea de `import`.
- **Motor matemático propio** (`window.Lim`). Hace las cuentas con **aritmética
  exacta sobre `BigInt`**: los racionales se guardan como `numerador/denominador`
  enteros y se comparan por igualdad exacta, nunca con coma flotante. Así
  `checkAnswer` puede comprobar si tu respuesta es *exactamente* `3/4` sin
  depender de si has escrito `0.75`. La coma flotante solo se usa al pintar.
- **Renderizado MathML nativo.** Las fórmulas se construyen con
  `document.createElementNS` sobre el espacio de nombres de MathML. No hay librería
  de LaTeX, no hay fuentes que cargar: el navegador dibuja las raíces, las fracciones
  y los superíndices con su propio motor.
- **Desarrollo en `src/` y ensamblado con `build.mjs`.** No se edita `index.html`
  nunca. Se editan los ficheros de `src/` y se ejecuta:

  ```bash
  node build.mjs
  ```

  que los mete dentro de `index.html`. Para probar cambios sin reconstruir, abre
  `dev.html`, que carga los `src/` sueltos con `<script src>`.

Estructura de este repositorio en detalle: [más abajo](#estructura-de-ficheros).

---

## Los dos ajustes

Aparecen en la pantalla de inicio y se guardan con el resto del progreso. Se pueden
cambiar también desde la consola, que es lo que hace la comprobación automática:

```js
App.setSettings({ modo: "opciones", politica: "examen" })
```

### 1. `modo`: **cómo respondes**

| `modo` | Qué ves |
|---|---|
| `texto` | Un campo donde escribes la respuesta tal cual: `3/4`, `-2`, `+inf`, `no existe`. |
| `opciones` | Cuatro botones con la respuesta y tres distractores. Sin escribir nada. |

El motor acepta muchas formas de escribir lo mismo. En `checkAnswer` valen, entre
otras: `3/4`, `3 / 4`, `0.75`, `-2`, `−2`, `2,5`, `+inf`, `+infinity`, `inf`, `+∞`,
`-inf`, `-∞`, `no existe`, `noexiste`, `dne`, `no`, `e`, `pi`, `x = 3`, `x=3`. Si no
entiende lo que has escrito, te lo dice en vez de marcarlo como incorrecto.

### 2. `politica`: **cuándo puedes mirar las opciones**

Solo tiene efecto en `modo: opciones`, y decide cuánto te cuesta mirar la respuesta.

| `politica` | Qué hace |
|---|---|
| `visible` | Las cuatro opciones están a la vista desde el principio. Modo exploración: sirven para practicar sin presión. |
| `boton` | Las opciones **no existen** hasta que pulsas «Ver opciones». Puedes pensarlo un rato antes de decidir. |
| `examen` | El botón «Ver opciones» **arranca deshabilitado**. Hay que escribir una respuesta y comprobar antes de poder mirar. Y si fallas, las opciones quedan bloqueadas para siempre en ese problema. |

La matriz completa de `modo` × `politica`:

|  | `modo: texto` | `modo: opciones` |
|---|---|---|
| **`visible`** | Escribes y compruebas. Sin espejo. | Las 4 opciones se pintan nada más entrar. |
| **`boton`** | Escribes y compruebas. Sin espejo. | Botón «Ver opciones»; las opciones no están en el DOM hasta que pulsas. |
| **`examen`** | Escribes y compruebas. Sin espejo. | Botón deshabilitado al entrar; hay que responder primero. Tras fallar, el botón sigue deshabilitado y no se ven las opciones. |

Si te bloqueas con `examen` + `opciones`, recuerda que el cuaderno de errores te
guarda la semilla del problema: volver a intentarlo es inmediato.

---

## Los 23 generadores

Un **generador** es una función que fabrica un problema aleatorio y su solución
paso a paso. Hay 23, repartidos en los cuatro bloques del temario. Cada uno declara
su `topic`, su `difficulty` (1 a 5), su `method` (la técnica que hay que aplicar) y
una solución con al menos dos pasos.

Para ver la lista viva desde la consola del navegador:

```js
Lim.generatorList()
```

### Bloque 1 — Sustitución y laterales (`topic: sustitucion`, dificultad 1–2)

| id | Qué pide | Técnica |
|---|---|---|
| `subst-directa` | Límite de un cociente cuyo denominador no se anula. | `sustitucion` |
| `den-anulado` | Denominador anulado y numerador no: decidir el signo de cada lado. | `denominador` |
| `laterales-piezas` | Límites laterales de una función definida a trozos. | `lateral` |
| `laterales-tabla` | Leer el límite lateral en una tabla de valores. | `lateral` |
| `signo-infinito` | Determinar si un cociente tiende a +∞ o a −∞ por cada lado. | `denominador` |
| `dominio-ln` | Asíntota vertical de un logaritmo: `ln(...)` en el punto donde se anula. | `denominador` |

### Bloque 2 — Límites en el infinito (`topic: infinito`, dificultad 2–3)

| id | Qué pide | Técnica |
|---|---|---|
| `poli-infinito` | Límite de un polinomio: manda el término de mayor grado. | `dominantePolinomio` |
| `indet-grados` | `∞/∞`: dividir entre `x` elevado al mayor grado y comparar. | `grados` |
| `frac-poli-denom` | Cociente de polinomios en el infinito: los grados deciden. | `dominantePolinomio` |
| `jerarquia-tipos` | Decidir quién crece más: exponencial, polinómica, logarítmica o constante. | `jerarquia` |
| `limite-notable-infinito` | Límites notables en el infinito, como `sen x / x → 0`. | `notable` |

### Bloque 3 — Indeterminaciones (`topic: indeterminacion`, dificultad 2–4)

| id | Qué pide | Técnica |
|---|---|---|
| `factor-cancelar` | `0/0`: factorizar y cancelar el factor común. | `factorizar` |
| `ruffini-cuadratica` | `0/0` con polinomio de grado 2: regla de Ruffini. | `factorizar` |
| `identidad-notable` | `0/0` con identidades notables, como `x² − 9`. | `factorizar` |
| `infinito-menos-infinito` | `∞ − ∞` en cocientes: común denominador y término dominante. | `restar` |
| `racionalizar-conjugado` | `∞ − ∞` en raíces: multiplicar por la expresión conjugada. | `racionalizar` |
| `cero-por-infinito` | `0 · ∞`: pasarlo a `0/0` o a `∞/∞`. | `transformar` |
| `indet-pow-numero-e` | `1^∞` con la fórmula `lim [f]^g = e^(lim g·(f − 1))`. | `numeroE` |

### Bloque 4 — Continuidad y asíntotas (`topic: continuidad`, dificultad 2–4)

| id | Qué pide | Técnica |
|---|---|---|
| `continuidad-piezas` | ¿Es continua una función definida a trozos? | `continuidad` |
| `continuidad-condiciones` | Comprobar una por una las tres condiciones de continuidad. | `continuidad` |
| `discontinuidad-tipo` | Clasificar el tipo de discontinuidad (evitable, salto, 2.ª especie). | `continuidad` |
| `asintota-vertical` | Localizar las asíntotas verticales de una función racional. | `denominador` |
| `asintota-horizontal` | Localizar la asíntota horizontal en el infinito. | `dominantePolinomio` |

---

## Cómo añadir un generador nuevo

No hay que tocar nada fuera de `src/engine.js`: ni la interfaz, ni los niveles, ni el
CSS. El motor recorre `GENERATORS` por sí solo y `generatorList()` devuelve las
claves, así que un generador nuevo aparece en el juego libre en cuanto lo registras.

El contrato está en [`CONTRACT.md`](CONTRACT.md). La forma exacta de un generador,
resumida:

1. Se añade una entrada a `GENERATORS` en `src/engine.js` con `id`, `topic`,
   `difficulty`, `method`, `title` y `make(rand, opts)`.
2. `make` devuelve un objeto `Problem` con `statement`, `answer`, `quiz` (exactamente
   4 opciones y el índice de la buena), `steps` (al menos 2), `keyStep` y `distractors`
   (exactamente 3).
3. Se usa `Lim.Q` para los números exactos y `Lim.ast` para la fórmula, para que se
   pinte en MathML. **Nunca escribas `0.75`**: escribe `Lim.Q(3, 4)`.
4. Se añade el id a la lista `generators` del nivel correspondiente en `Lim.LEVELS`
   para que aparezca en la campaña.

Ejemplo real y completo. Este generador produce el límite
`lim (x → 0) (sen 3x) / x` (o con 2, 4 o 5), cuya solución exige reconocer el límite
notable:

```js
/* --- Límite notable: (sen k·x) / x cuando x → 0 ---------------------- */
GENERATORS["lim-notable-senx"] = {
  id: "lim-notable-senx",
  topic: "indeterminacion",
  difficulty: 2,
  method: "notable",
  title: "Límite notable del seno",

  make: function (rand) {
    var k = Q(rand.int(2, 5));                       // 2, 3, 4 o 5
    var num = ast.mul(ast.num(k), ast.sin(ast.var("x")));
    var value = Q(k);                                // el resultado es exactamente k

    return {
      statement: {
        expr: ast.div(num, ast.var("x")),
        target: { type: "point", at: Q.ZERO, side: null },
        kind: "limit"
      },
      answer: { kind: "rational", value: value },
      quiz: {
        kind: "metodo",
        question: "Sustituyendo sale 0/0. ¿Qué técnica hay que aplicar?",
        options: [
          "Factorizar el numerador: no se puede, no es un polinomio.",
          "Comparar los grados del numerador y del denominador.",
          "Usar el límite notable sen(x)/x = 1, sacando antes el factor " + value.toDisplay() + ".",
          "Racionalizar el denominador con la expresión conjugada."
        ],
        correct: 2,
        explain: "El numerador es un seno, no un polinomio, así que Ruffini no sirve. Se escribe " +
                 "sen(k·x) = k·(sen(k·x)/(k·x)) y se aplica el límite notable."
      },
      steps: [
        { title: "Sustituimos x = 0", detail: "sen 0 / 0 sale 0/0: indeterminación.", math: ast.div(num, ast.var("x")) },
        { title: "Factorizamos la k", detail: "Extraemos k del numerador.", math: ast.mul(ast.num(k), ast.div(ast.sin(ast.var("x")), ast.var("x"))) },
        { title: "Aplicamos el límite notable", detail: "sen x / x tiende a 1, luego el resultado es " + value.toDisplay() + ".", math: ast.num(value) }
      ],
      keyStep: 2,
      distractors: [
        { kind: "rational", value: Q.ONE },          // la trampa de pensar que es 1
        { kind: "rational", value: Q.ZERO },
        { kind: "dne" }
      ]
    };
  }
};
```

Y para que salga en la campaña, una entrada más en `Lim.LEVELS` (también dentro de
`src/engine.js`). Si ya existe un nivel con ese número de orden, cambia el `n`:

```js
{ id: "notables", n: 8, name: "Límites notables",
  generators: ["lim-notable-senx", "limite-notable-infinito"], required: 8, total: 10 }
```

Tres reglas que te ahorran disgustos:

- **Si el generador lanza, `generate()` cae automáticamente** en `subst-directa`.
  Eso salva la partida, pero te oculta el fallo: pruébalo con `Lim.generate({ seed: 1, generatorIds: ["lo-que-sea"] })` en la consola antes de darlo por bueno.
- **`quiz.options` tiene que tener exactamente 4** y `quiz.correct` un índice de 0 a 3. Si no, la comprobación automática de `tests/e2e.html` falla.
- **`distractors` tiene que tener exactamente 3**, y ninguno puede coincidir con la respuesta correcta: si alguno coincide, el alumno tiene dos botones idénticos y el problema queda injusto.

Para probarlo sin reconstruir nada:

```bash
node build.mjs
```

…y recarga. O abre `dev.html`, que carga los `src/` sueltos.

---

## Cómo ejecutar los tests

```bash
# Tests unitarios del motor (aritmética exacta, polinomios, límites, generadores).
node --test tests/engine.test.mjs

# Comprobación rápida por consola: genera problemas y verifica respuestas canónicas.
node tests/smoke.mjs

# Reensambla index.html a partir de src/.
node build.mjs
```

Y el end-to-end, que necesita navegador: abre **`tests/e2e.html`** con doble clic
(igual que el juego) y mira el recuento al final de la página.

`tests/e2e.html` carga el `index.html` de verdad dentro de un iframe oculto y
comprueba, entre otras cosas, que los 23 generadores aguantan 300 semillas cada uno
sin excepciones, que la respuesta canónica siempre se acepta, que el interrogatorio
tiene 4 opciones válidas, que la política `examen` bloquea las opciones tras fallar,
que la persistencia sobrevive a un `localStorage` corrupto y que el HTML final no
contiene ninguna URL de red.

En modo desarrollo, `tests/mock-engine.js` es un motor **falso pero completo en
forma**: implementa toda la API de `CONTRACT.md` con seis generadores de ejemplo,
para poder probar la interfaz sin esperar al motor real. Si `window.Lim` ya existe,
no se instala.

---

## Estructura de ficheros

| Fichero | Qué es |
|---|---|
| `index.html` | El juego entero en un solo fichero. **Generado**: no lo edites a mano. |
| `src/engine.js` | El motor matemático: racionales exactos, polinomios, AST, motor de límites, RNG determinista y los 23 generadores. Publica `window.Lim`. |
| `src/app.js` | La interfaz: pantallas, enunciado, opciones, panel de solución, ajustes y cuaderno de errores. Publica `window.App`. |
| `src/styles.css` | Estilos. Expone las variables CSS (`--bg`, `--accent`, `--c-indet`…) que usa `app.js`; ninguna regla de color está escrita en el JS. |
| `src/theory-data.js` | La hoja de teoría del juego, en datos puros. Publica `window.THEORY`. Sin lógica, sin DOM. |
| `build.mjs` | Ensamblador. Lee `src/` y escribe `index.html` autocontenido. |
| `dev.html` | Carga los `src/` sueltos. Para desarrollar sin pasar por `build.mjs`. |
| `CONTRACT.md` | El contrato de API entre motor e interfaz. Si algo no está aquí, se inventa de forma compatible y se documenta al final del fichero. |
| `docs/CONCEPTOS.md` | Explicación de los conceptos para el alumno, sin jerga. Es lo primero que deberías leer si estás empezando. |
| `tests/engine.test.mjs` | Tests unitarios del motor (`node --test`). |
| `tests/smoke.mjs` | Comprobación rápida en consola: genera muchos problemas y verifica las respuestas. |
| `tests/mock-engine.js` | Motor de mentira con la forma completa del contrato, para poder tocar la interfaz sin motor. |
| `tests/e2e.html` | Verificación end-to-end en el navegador, sobre el `index.html` real. |
| `refs/` | Apuntes y hojas de ejercicios en PDF usados como fuente del contenido. |

---

## La hoja de teoría

`src/theory-data.js` publica `window.THEORY` con tres cosas:

```js
// Forma de los datos (esquema, no se ejecuta tal cual):
window.THEORY = {
  sections:   [ { id, title, icon, summary, blocks: [ /* ... */ ] } ],  // 12 secciones
  tables:     [ { id, title, caption, columns, rows } ],               // 21 tablas
  cheatsheet: [ { label, math, note } ]                               // 23 apuntes rápidos
};
```

Son datos y solo datos: no hay funciones, ni DOM, ni framework. La interfaz la lee y
la pinta. Los bloques admitidos son `p` (párrafo, con `**negrita**` y `` `código` ``),
`math`, `formula`, `ul`, `ol`, `note` (tonos `warn`, `tip` y `key`) y `table`, que
referencia una de las tablas de `THEORY.tables` por su `id`.

---

## Licencia y créditos

El contenido matemático —la hoja de teoría, la documentación de conceptos y la
temática de los generadores— se basa en los apuntes del **Capítulo 7: Límites y
continuidad** de *Matemáticas II, 2.º de Bachillerato* de
**apuntesmareaverde.org.es**, de **Leticia González Pascual** (revisión de **Álvaro
Valdés Menéndez** y **Luis Carlos Vidal**), bajo licencia Creative Commons. En
`refs/` tienes el PDF original y dos hojas de ejercicios de apoyo.

El código de este repositorio es original y se publica bajo **MIT**.

Los iconos son símbolos matemáticos Unicode, no tipografías. Las fórmulas se dibujan
con el motor MathML nativo del navegador, sin ninguna librería externa.