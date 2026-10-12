/* =========================================================================
 * theory-data.js — HOJA DE TEORÍA DEL JUEGO
 * -------------------------------------------------------------------------
 * Contenido PURO DE DATOS. Sin lógica, sin DOM, sin framework, sin
 * dependencias y sin `import`. Este fichero solo publica un único global:
 *
 *     window.THEORY
 *
 * Forma de los datos:
 *
 *   THEORY.sections   : [ { id, title, icon, summary, blocks: [...] } ]
 *   THEORY.tables     : [ { id, title, caption, columns: [...], rows: [...] } ]
 *   THEORY.cheatsheet : [ { label, math /* LaTeX *\/, note } ]
 *
 * Formas admitidas de `block`:
 *
 *   { type: "p",       text: "Texto con **negrita** y `código`." }
 *   { type: "math",    latex: "\\lim_{x \\to a} f(x) = L", display: true }
 *   { type: "ul",      items: ["...", "..."] }
 *   { type: "ol",      items: ["...", "..."] }
 *   { type: "note",    tone: "warn"|"tip"|"key", title: "Ojo", text: "..." }
 *   { type: "formula", latex: "...", caption: "bajo la fórmula" }
 *   { type: "table",   id: "tabla-indeterminaciones" }   // referencia a THEORY.tables
 *
 * Todos los `id` de sección y de tabla son únicos. La interfaz (src/app.js)
 * lee este objeto en la fase de integración; aquí no se pinta nada.
 *
 * El contenido está en español de España y sigue el temario de límites y
 * continuidad de 2º de Bachillerato (LOMLOE).
 * ========================================================================= */

window.THEORY = {

  /* =======================================================================
   * SECCIONES
   * ===================================================================== */
  sections: [

    /* --------------------------------------------------------------------
     * 1. Idea intuitiva de límite
     * ------------------------------------------------------------------ */
    {
      id: "idea-intuitiva",
      title: "La idea intuitiva de límite",
      icon: "→",
      summary: "Qué significa realmente «x tiende a a» y por qué hay que mirar los dos lados.",
      blocks: [
        {
          type: "p",
          text: "Escribir `x → 4` **no** significa que x valga 4. Significa que **nos acercamos** a 4 sin llegar a ello, tomando valores cada vez más próximos: 3,9999; 3,999; 3,99; 3,9… y también 4,0001; 4,001; 4,01… El punto 4 queda fuera: no hay forma de estar «un poco más cerca» de 4 que otro, siempre hay algo más cerca."
        },
        {
          type: "p",
          text: "Vamos a estudiar `f(x) = x² − 2x` cuando `x → 4`. Calculamos valores de x cercanos a 4 y vemos qué hace f con ellos."
        },
        {
          type: "p",
          text: "**Por la izquierda** (x menores que 4):"
        },
        { type: "table", id: "tabla-cerca-4-izquierda" },
        {
          type: "p",
          text: "Los valores de `f(x)` se acercan a 8. Decimos que cuando x tiende a 4 por la izquierda, `f(x)` tiende a 8."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to 4^-} f(x) = \\lim_{x \\to 4^-} (x^2 - 2x) = 8",
          caption: "Límite por la izquierda."
        },
        {
          type: "p",
          text: "**Por la derecha** (x mayores que 4):"
        },
        { type: "table", id: "tabla-cerca-4-derecha" },
        {
          type: "p",
          text: "También se acercan a 8. Los dos lados coinciden, así que el límite existe."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to 4^+} f(x) = \\lim_{x \\to 4^+} (x^2 - 2x) = 8 = \\lim_{x \\to 4} f(x)",
          caption: "Límite por la derecha y límite total."
        },
        {
          type: "note",
          tone: "key",
          title: "La idea que te llevas",
          text: "Un límite no pregunta «cuánto vale f en el punto», sino «a qué número se va acercando f cuando x se acerca al punto, sin llegar nunca a él». Por eso se puede hablar del límite de una función que **ni siquiera está definida** en ese punto."
        },
        {
          type: "p",
          text: "**El contraejemplo.** Ahora la función parte entera `E(x)`, que devuelve el mayor entero menor o igual que x. Con `g(x) = x − E(x)`:"
        },
        { type: "math", latex: "g(x) = x - E(x) = \\begin{cases} x & \\text{si } x \\in [0, 1) \\\\ x - 1 & \\text{si } x \\in [1, 2) \\end{cases}", display: true },
        { type: "table", id: "tabla-parte-entera" },
        {
          type: "p",
          text: "Por la izquierda g(x) tiende a 1 y por la derecha tiende a 0. **Los dos laterales no coinciden**, de modo que cuando x tiende a 1, g(x) no tiende a ningún valor: el límite **no existe**."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to 1^-} g(x) = 1 \\neq 0 = \\lim_{x \\to 1^+} g(x) \\quad \\Rightarrow \\quad \\lim_{x \\to 1} g(x) \\text{ no existe}",
          caption: "El fallo viene de que los dos lados no se ponen de acuerdo."
        },
        {
          type: "note",
          tone: "tip",
          title: "Truco para dibujar la escena",
          text: "Imagina un círculo muy pequeño alrededor de a. `x → a⁻` es entrar en el círculo **por el lado izquierdo**, `x → a⁺` es entrar **por el lado derecho**. Dentro del círculo da igual: todos esos x valen lo mismo en el límite."
        }
      ]
    },

    /* --------------------------------------------------------------------
     * 2. Definición formal
     * ------------------------------------------------------------------ */
    {
      id: "definicion-formal",
      title: "Definición formal de límite",
      icon: "ε",
      summary: "La definición con entornos y con epsilon-delta. Breve: es material de universidad, pero aparece en el temario.",
      blocks: [
        {
          type: "p",
          text: "Todo lo anterior se puede escribir con símbolos exactos. Es la parte más abstracta del tema; para aprobado basta con entender la idea, pero conviene haberla visto alguna vez."
        },
        {
          type: "p",
          text: "**Entorno de centro a y radio δ**: es el intervalo abierto de números que están a distancia menor que δ de a."
        },
        { type: "formula", latex: "E(a,\\delta) = \\{ x \\in \\mathbb{R} \\;;\\; x - a < \\delta \\} = (a-\\delta,\\; a+\\delta)", caption: "Entorno de centro a y radio δ." },
        {
          type: "p",
          text: "**Entorno reducido**: es el mismo entorno pero **sin el propio punto a**."
        },
        { type: "formula", latex: "E^*(a,\\delta) = \\{ x \\in \\mathbb{R} \\;;\\; 0 < x - a < \\delta \\} = (a-\\delta,\\; a) \\cup (a,\\; a+\\delta)", caption: "Entorno reducido de centro a y radio δ." },
        {
          type: "p",
          text: "Por qué se quita el punto: porque en un límite **nunca se llega** a a. La función ni siquiera tiene que estar definida ahí. Por ejemplo, la función `f(x) = (x² − 2x)/(x² + 2x)` no existe en el origen, y sin embargo tiene límite, y vale −1:"
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to 0} \\frac{x^2 - 2x}{x^2 + 2x} = \\lim_{x \\to 0} \\frac{(x - 2)\\,x}{(x + 2)\\,x} = \\lim_{x \\to 0} \\frac{x - 2}{x + 2} = -1",
          caption: "Se cancela la x porque x ≠ 0 en el entorno reducido."
        },
        {
          type: "p",
          text: "**La definición.** La función `f(x)` tiene por límite `L` cuando `x → x₀` si se cumple lo siguiente:"
        },
        {
          type: "ul",
          items: [
            "Para **todo** entorno `E(L, ε)`, con ε > 0, podemos encontrar un entorno `E(x₀, δ)`.",
            "De tal modo que, para **todo** x que pertenezca al entorno reducido `E*(x₀, δ)`, su imagen `f(x)` pertenece a `E(L, ε)`."
          ]
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to x_0} f(x) = L \\iff \\forall\\, E(L,\\varepsilon)\\; \\exists\\, E(x_0,\\delta)\\;\\;\\forall\\, x \\in E^*(x_0,\\delta) \\;\\Rightarrow\\; f(x) \\in E(L,\\varepsilon)",
          caption: "Definición con entornos."
        },
        {
          type: "p",
          text: "Equivalentemente, y esta es la versión `ε − δ` que verás en la selectividad y en la universidad:"
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to x_0} f(x) = L \\iff \\forall\\, \\varepsilon > 0\\; \\exists\\, \\delta > 0\\;\\; \\text{si } 0 < x - x_0 < \\delta \\;\\Rightarrow\\; f(x) - L < \\varepsilon",
          caption: "Definición ε − δ (con módulos, |f(x) − L| < ε)."
        },
        {
          type: "note",
          tone: "warn",
          title: "El ε y el δ no son simétricos",
          text: "ε lo eliges tú (la precisión que quieres) y δ se busca después (la cercanía que hace falta). El orden importa: primero ε, después δ."
        },
        {
          type: "p",
          text: "Una función que cumple esta definición se dice **convergente** en x₀."
        }
      ]
    },

    /* --------------------------------------------------------------------
     * 3. Límites laterales
     * ------------------------------------------------------------------ */
    {
      id: "limites-laterales",
      title: "Límites laterales",
      icon: "±",
      summary: "El teorema que articula todo el tema: el límite existe si y solo si los dos laterales existen y coinciden.",
      blocks: [
        {
          type: "p",
          text: "Un límite por la izquierda `x → x₀⁻` se calcula tomando únicamente valores de x **menores** que x₀. Un límite por la derecha `x → x₀⁺`, únicamente valores **mayores**."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to x_0^-} f(x) = L \\iff \\forall\\, E(L,\\varepsilon),\\; \\exists\\, E^-(x_0,\\delta) = (x_0-\\delta,\\, x_0) \\;\\Rightarrow\\; f(x) \\in E(L,\\varepsilon)",
          caption: "Límite lateral por la izquierda: entorno lateral E⁻."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to x_0^+} f(x) = L \\iff \\forall\\, E(L,\\varepsilon),\\; \\exists\\, E^+(x_0,\\delta) = (x_0,\\, x_0+\\delta) \\;\\Rightarrow\\; f(x) \\in E(L,\\varepsilon)",
          caption: "Límite lateral por la derecha: entorno lateral E⁺."
        },
        {
          type: "note",
          tone: "key",
          title: "Teorema: condición necesaria y suficiente",
          text: "Una función tiene límite en x₀ **si y solo si** tiene límite lateral por la izquierda y límite lateral por la derecha, y ambos son iguales."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to x_0} f(x) = L \\iff \\lim_{x \\to x_0^-} f(x) = \\lim_{x \\to x_0^+} f(x) = L",
          caption: "El teorema de los laterales."
        },
        {
          type: "ul",
          items: [
            "Si los dos laterales existen e **igual** → el límite existe y vale ese número.",
            "Si los dos laterales existen pero son **distintos** → el límite no existe (salto).",
            "Si **alguno** de los dos no existe → el límite no existe."
          ]
        },
        {
          type: "note",
          tone: "tip",
          title: "Un límite, si existe, es único",
          text: "Si una función tiene límite en x₀, ese valor es único. No puede valer 8 y 9 a la vez."
        },
        {
          type: "p",
          text: "**El método de los signos** para límites infinitos. Cuando el denominador se anula y el numerador no, el cociente se dispara. Para saber **hacia qué lado** y con **qué signo**, no hace falta calcular nada: mira el signo del numerador y el del denominador en un punto cercano, con el signo de `(x − x₀)` correspondiente al lado."
        },
        { type: "formula", latex: "\\lim_{x \\to x_0} \\frac{f(x)}{g(x)} = \\pm\\, \\infty \\quad \\text{si } \\lim_{x \\to x_0} g(x) = 0 \\text{ y } \\lim_{x \\to x_0} f(x) \\neq 0", display: true },
        {
          type: "formula",
          latex: "\\lim_{x \\to x_0} \\frac{f(x)}{g(x)} = \\begin{cases} +\\infty & \\text{si } f(x) \\text{ y } g(x) \\text{ tienen el mismo signo} \\\\ -\\infty & \\text{si } tienen signo distinto} \\end{cases}",
          caption: "El signo del cociente es producto de los signos."
        },
        { type: "table", id: "tabla-metodo-signos" },
        {
          type: "note",
          tone: "warn",
          title: "Doble raíz: los dos lados casan",
          text: "Si g(x) tiene el factor `(x − x₀)²`, el denominador **no cambia de signo** al cruzar x₀. Por eso `x²/(x − 1)²` tiende a +∞ por los dos lados: no hay salto, hay asíntota vertical doble."
        }
      ]
    },

    /* --------------------------------------------------------------------
     * 4. Operaciones con límites
     * ------------------------------------------------------------------ */
    {
      id: "operaciones",
      title: "Operaciones con límites",
      icon: "+−",
      summary: "Las seis operaciones, y la tabla del álgebra del infinito. Ojo: no es la álgebra de los reales.",
      blocks: [
        {
          type: "p",
          text: "Si `f(x)` y `g(x)` son convergentes en x₀, con `lim f = L` y `lim g = M`, se puede operar término a término. Las mismas reglas valen también para límites en el infinito."
        },
        { type: "table", id: "tabla-operaciones" },
        {
          type: "p",
          text: "El cociente tiene dos salvedades importantes:"
        },
        {
          type: "ul",
          items: [
            "Si `M ≠ 0`: el límite es `L/M`, sin más.",
            "Si `M = 0`: **no** se puede dividir. Si además `L = 0` estamos ante la indeterminación `0/0`; si `L ≠ 0` obtenemos un límite infinito."
          ]
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to x_0} \\sqrt[n]{f(x)} = \\sqrt[n]{\\lim_{x \\to x_0} f(x)} = \\sqrt[n]{L}",
          caption: "Potencia y raíz: se puede entrar si L es admisible (para raíces de índice par, L ≥ 0)."
        },
        {
          type: "p",
          text: "Cuando en el resultado aparece infinito se usan las siguientes expresiones, cuyos valores son conocidos de antemano."
        },
        { type: "table", id: "tabla-infinito-suma" },
        { type: "table", id: "tabla-infinito-producto" },
        { type: "table", id: "tabla-infinito-cociente" },
        { type: "table", id: "tabla-infinito-potencia" },
        {
          type: "note",
          tone: "warn",
          title: "El aviso importante",
          text: "El **álgebra del infinito NO es la de los números reales**. Hay expresiones que ahí dan un resultado claro (`(∞ + 3) = ∞`) y otras que no dan nada (`∞ − ∞`), y no se puede saber solo con la tabla: hay que mirar la función original. Por eso `(∞ − ∞)` es una **indeterminación**, no un resultado."
        },
        {
          type: "p",
          text: "Dos casos que se resuelven con la tabla y que conviene saber de memoria:"
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to +\\infty} \\frac{k}{\\infty} = 0 \\quad\\text{y}\\quad \\frac{0}{\\infty} = 0",
          caption: "Un número finito partido por infinito es 0, siempre."
        }
      ]
    },

    /* --------------------------------------------------------------------
     * 5. Jerarquía de crecimiento
     * ------------------------------------------------------------------ */
    {
      id: "jerarquia",
      title: "Jerarquía de crecimiento",
      icon: "↑",
      summary: "Qué crece más deprisa. Exponencial > Polinómica > Logarítmica > Constante.",
      blocks: [
        {
          type: "p",
          text: "No todos los infinitos son iguales. Cuando en un límite aparecen sumas, productos o cocientes de funciones de tipos distintos, hay que saber cuál crece más rápido: ese es el **término dominante**, y determina el resultado."
        },
        { type: "formula", latex: "\\text{Exponencial} \\;>\\; \\text{Polinómica} \\;>\\; \\text{Logarítmica} \\;>\\; \\text{Constante}", display: true },
        {
          type: "p",
          text: "Es decir: `2ˣ` crece más rápido que `x⁵`, que a su vez crece más rápido que `ln x`, que no crece (es constante). Para `x = 1000000` la exponencial es un número de miles de cifras; la polinómica, de siete; el logaritmo, de una."
        },
        {
          type: "p",
          text: "**Funciones potenciales** `f(x) = xⁿ`:"
        },
        { type: "table", id: "tabla-potenciales" },
        {
          type: "note",
          tone: "key",
          title: "La paridad decide en −∞",
          text: "En `x → +∞` da igual que n sea par o impar: siempre +∞ si n > 0. En `x → −∞` hay que mirar el signo: una potencia **impar** conserva el signo de x (y se va a −∞), una **par** da siempre positivo."
        },
        {
          type: "p",
          text: "**Funciones exponenciales** `f(x) = aˣ`:"
        },
        { type: "table", id: "tabla-exponenciales" },
        {
          type: "p",
          text: "**Función logarítmica** `log_a x`: es la inversa de la exponencial, así que su comportamiento es el revés."
        },
        { type: "table", id: "tabla-logaritmicas" },
        {
          type: "note",
          tone: "warn",
          title: "Las trigonométricas no tienen límite en el infinito",
          text: "Ninguna función trigonométrica tiene límite definido en el infinito por su **carácter oscilante**: `sen x` toma el valor 1 unas veces y 0 otras, indefinidamente. Por eso `sen(x)/x` **sí** tiene límite (0), pero `sen x` no."
        },
        {
          type: "p",
          text: "Un caso límite muy usado: un número **acotado** partido por infinito da 0, aunque el numerador no tenga límite."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to +\\infty} \\frac{\\sen x}{x} = 0 \\quad\\text{porque } -1 \\le \\sen x \\le 1 \\text{ y } x \\to +\\infty",
          caption: "El seno no tiene límite, pero está acotado. Eso basta."
        }
      ]
    },

    /* --------------------------------------------------------------------
     * 6. Límites infinitos y asíntotas
     * ------------------------------------------------------------------ */
    {
      id: "infinitos-asintotas",
      title: "Límites infinitos y asíntotas",
      icon: "∞",
      summary: "Los seis límites infinitos en un punto y las asíntotas verticales; los cuatro en el infinito y las horizontales.",
      blocks: [
        {
          type: "p",
          text: "Cuando la función crece sin cota al acercarse a un punto, el límite es **infinito**: no es un número, es una manera de decir «se va tan arriba (o tan abajo) como quieras»."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to x_0} f(x) = +\\infty \\iff \\forall\\, K \\in \\mathbb{R},\\; \\exists\\, \\delta > 0\\;\\; \\text{si } x \\in E^*(x_0,\\delta) \\;\\Rightarrow\\; f(x) > K",
          caption: "Definición de límite +∞."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to x_0} f(x) = -\\infty \\iff \\forall\\, K \\in \\mathbb{R},\\; \\exists\\, \\delta > 0\\;\\; \\text{si } x \\in E^*(x_0,\\delta) \\;\\Rightarrow\\; f(x) < K",
          caption: "Definición de límite −∞."
        },
        {
          type: "p",
          text: "Hay **seis** de estos límites: por la izquierda, por la derecha y por los dos lados, cada uno con signo + o −. Cuando existe alguno de ellos, la función tiene una **asíntota vertical** de ecuación `x = x₀`."
        },
        {
          type: "p",
          text: "Las dos fuentes de asíntotas verticales que se estudian en 2º de Bachillerato son:"
        },
        {
          type: "ol",
          items: [
            "**Cocientes**, cuando el denominador se anula y el numerador no. Incluye las trigonométricas `tg x`, `sec x`, `cosec x` y `cotg x`, que son cocientes por definición.",
            "**Logaritmos**, cuando lo que está dentro del logaritmo se hace 0 o se hace negativo: `ln(2x − 1)` tiende a −∞ en `x = 1/2`."
          ]
        },
        { type: "table", id: "tabla-asintotas-verticales" },
        {
          type: "note",
          tone: "warn",
          title: "No existe dividir entre cero",
          text: "No se puede decir que `f(x)/g(x) = f(x)/0`. Lo que se afirma es que **el límite** del cociente es infinito. Es una frase sobre la tendencia, no sobre el valor de la fracción en ese punto."
        },
        {
          type: "p",
          text: "**Límites finitos en el infinito.** Si al tomar x muy grande (o muy negativo) los valores de f(x) se acercan a un número L, entonces:"
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to +\\infty} f(x) = L \\iff \\forall\\, \\varepsilon > 0,\\; \\exists\\, K \\in \\mathbb{R}\\;\\; \\text{si } x > K \\;\\Rightarrow\\; f(x) \\in E(L,\\varepsilon)",
          caption: "Definición de límite finito en el infinito."
        },
        {
          type: "p",
          text: "En ese caso la función tiene una **asíntota horizontal** de ecuación `y = L`."
        },
        {
          type: "note",
          tone: "tip",
          title: "Regla mnemotécnica",
          text: " **Vertical** para las asíntotas verticales, porque la recta es vertical. **Horizontal** para las horizontales. Y ojo: la asíntota vertical se escribe `x = x₀` (se anula el denominador) y la horizontal `y = L` (se estabiliza la altura)."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to +\\infty} \\frac{\\ln(2x - 1)}{2x - 1} = 0 \\;\\Rightarrow\\; \\text{asíntota horizontal } y = 0",
          caption: "El polinomio del denominador crece mucho más rápido que el logaritmo del numerador."
        }
      ]
    },

    /* --------------------------------------------------------------------
     * 7. Cálculo de límites
     * ------------------------------------------------------------------ */
    {
      id: "calculo-limites",
      title: "Cálculo de límites",
      icon: "=",
      summary: "Sustitución directa, el caso del denominador anulado y los límites en el infinito.",
      blocks: [
        {
          type: "p",
          text: "Calcular un límite a partir de la definición es lentísimo. En la práctica se usan atajos, y el atajo es siempre el mismo: **sustituir** y ver qué sale."
        },
        {
          type: "p",
          text: "**Paso 1: sustitución directa.** Se sustituye la variable por el valor al que tiende y se opera. Si el resultado es un número, ya está; si sale infinito, hay que ver el signo; si sale una de las siete indeterminaciones, hay que trabajar."
        },
        { type: "table", id: "tabla-sustitucion-directa" },
        {
          type: "p",
          text: "**Paso 2: el denominador se anula.** Si al sustituir el denominador da 0, **no** se divide: se cierra la puerta y se estudia el caso aparte."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to 1} \\frac{x + 2}{x - 1} = \\frac{1 + 2}{1 - 1} = \\frac{3}{0}",
          caption: "Aquí no se divide: sale ∞/∞ como resultado intermedio de la sustitución, que en realidad es un límite infinito."
        },
        {
          type: "ol",
          items: [
            "**Mira los signos.** El numerador vale 3 (positivo). El denominador `x − 1` es negativo si x se acerca por la izquierda (≈ −0) y positivo si se acerca por la derecha (≈ +0).",
            "**Calcula los dos laterales.** Por la derecha: `3 / (+0) = +∞`. Por la izquierda: `3 / (−0) = −∞`.",
            "**Compara.** Si difieren, el límite **no existe**. Si coinciden (o si los dos son el mismo infinito), el límite existe con ese valor."
          ]
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to 1^+} \\frac{x + 2}{x - 1} = +\\infty, \\qquad \\lim_{x \\to 1^-} \\frac{x + 2}{x - 1} = -\\infty \\;\\Rightarrow\\; \\lim_{x \\to 1} \\frac{x + 2}{x - 1} \\text{ no existe}",
          caption: "Lados distintos: no existe."
        },
        {
          type: "note",
          tone: "key",
          title: "x² es siempre positiva",
          text: "En cambio `lim_{x→1} x²/(x−1)² = +∞` por los **dos** lados, porque el denominador es un cuadrado y nunca cambia de signo. Cada asíntota vertical hay que analizarla por los dos lados: puede ser salto o no."
        },
        {
          type: "p",
          text: "**Paso 3: límites en el infinito.** Ahí la sustitución directa no sirve (no se puede poner x = ∞). Lo que se hace es quedarse con el **término dominante**: en un polinomio, el de **mayor grado**."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to +\\infty} \\left( x^3 - 2x^2 + x - 3 \\right) = +\\infty \\quad\\text{pues}\\quad \\lim_{x\\to+\\infty} x^3 >> \\lim_{x\\to+\\infty} x^2 >> \\lim_{x\\to+\\infty} x >> \\lim_{x\\to+\\infty} 3",
          caption: "Los términos de menor grado son despreciables."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to +\\infty} \\left( 2^x - x^5 \\right) = +\\infty \\quad\\text{pues}\\quad \\lim_{x\\to+\\infty} 2^x >> \\lim_{x\\to+\\infty} x^5",
          caption: "La exponencial manda sobre la polinómica."
        },
        {
          type: "p",
          text: "En un cociente, se aplica la jerarquía **por separado** al numerador y al denominador, y luego se combinan los dos resultados."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to +\\infty} \\frac{2x^4 - 3x^3 + x^2 + x - 5}{x^5 - 3x^2 - 1} = \\lim_{x\\to+\\infty} \\frac{2x^4}{x^5} = \\lim_{x\\to+\\infty} \\frac{2}{x} = 0",
          caption: "El cociente de dos infinitos se resuelve comparando los grados."
        },
        {
          type: "p",
          text: "Y el caso contrario, en el que los grados **son iguales**: entonces el límite es el cociente de los coeficientes de los términos de mayor grado."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to +\\infty} \\frac{x^5 + 2x^4 - x - 5}{2x^5 + x^4 + x^3 + x^2 + x + 1} = \\lim_{x\\to+\\infty} \\frac{x^5}{2x^5} = \\frac{1}{2}",
          caption: "Grados iguales: cociente de coeficientes principales."
        },
        {
          type: "p",
          text: "**Y si los grados no coinciden?** El resultado lo decide cuál manda: grado del numerador mayor → infinito (con el signo del coeficiente principal); menor → 0."
        },
        { type: "table", id: "tabla-grados-infinito" }
      ]
    },

    /* --------------------------------------------------------------------
     * 8. Las siete indeterminaciones
     * ------------------------------------------------------------------ */
    {
      id: "indeterminaciones",
      title: "Las siete indeterminaciones",
      icon: "?",
      summary: "Qué es una indeterminación, cuáles son las siete y qué técnica resuelve cada una.",
      blocks: [
        {
          type: "p",
          text: "Una **indeterminación** no es un resultado: es un aviso de que la sustitución directa no ha servido de nada y de que el resultado **depende de cómo simplifiques**. Hay siete:"
        },
        { type: "math", latex: "\\frac{\\infty}{\\infty}, \\qquad \\frac{0}{0}, \\qquad 0 \\cdot \\infty, \\qquad \\infty - \\infty, \\qquad 1^{\\infty}, \\qquad \\infty^{0}, \\qquad 0^{0}", display: true },
        {
          type: "note",
          tone: "key",
          title: "Por qué son siete",
          text: "Son exactamente las combinaciones que se desvanecen: cocientes donde numerador y denominador caen a la vez (∞/∞, 0/0), restas de dos cosas que crecen igual (∞ − ∞), productos donde un factor cae y otro crece (0 · ∞) y potencias donde base y exponente se anulan el uno al otro (1^∞, ∞⁰, 0⁰). Todas las demás dan un resultado directo."
        },
        { type: "table", id: "tabla-indeterminaciones" },
        {
          type: "p",
          text: "Veamos las técnicas una a una, con el detalle de lo que se hace y un ejemplo."
        },

        {
          type: "p",
          text: "**∞/∞ — comparar grados.** Se divide numerador y denominador entre `xⁿ`, donde n es el mayor grado de los dos. Así se ve de inmediato cuál de los dos manda."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to +\\infty} \\frac{5x^{3/2}}{3x + 1} = \\lim_{x\\to+\\infty} \\frac{5x^{3/2}}{3x} = \\lim_{x\\to+\\infty} \\frac{5}{3} x^{1/2} = +\\infty",
          caption: "El numerador tiene grado mayor (3/2 > 1): el cociente crece."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to -\\infty} \\frac{x^2 - 1}{\\sqrt[3]{4x + 2}} = \\lim_{x\\to-\\infty} \\frac{x^2}{\\sqrt[3]{4x}} = \\lim_{x\\to-\\infty} \\frac{x^2}{\\sqrt[3]{4}\\, x^{1/3}} = \\lim_{x\\to-\\infty} \\frac{x^{5/3}}{\\sqrt[3]{4}} = 0",
          caption: "Grado 2 en el numerador, 1/3 en el denominador: el numerador domina y el resultado es 0."
        },
        {
          type: "note",
          tone: "tip",
          title: "Truco para no equivocarse de signo en −∞",
          text: "Si tras dividir entre `xⁿ` queda un exponente **impar** y estás en `−∞`, el resultado es negativo; si es par, positivo. Comprueba siempre con un valor: en `x = −1000000`, un impar sale negativo."
        },

        {
          type: "p",
          text: "**0/0 — factorizar y cancelar.** Se factorizan numerador y denominador (identidades notables y **regla de Ruffini**), se saca el factor común `(x − a)` y se cancela. El resultado es el cociente de lo que queda, ya sin singularidad."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to 2} \\frac{x^2 - 3x + 2}{x^2 - 4} = \\lim_{x\\to 2} \\frac{(x-2)\\,(x-1)}{(x-2)\\,(x+2)} = \\lim_{x\\to 2} \\frac{x - 1}{x + 2} = \\frac{2 - 1}{2 + 2} = \\frac{1}{4}",
          caption: "Se cancela (x − 2) porque es 0 en x = 2, y para el límite da igual cancelarlo."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to 3} \\frac{x^2 - 9}{x - 3} = \\lim_{x\\to 3} \\frac{(x+3)\\,(x-3)}{x - 3} = \\lim_{x\\to 3} (x + 3) = 6",
          caption: "Igualdad notable: x² − 9 = (x + 3)(x − 3)."
        },
        {
          type: "note",
          tone: "warn",
          title: "Por qué se puede cancelar",
          text: "Cancelar no es «dividir entre cero»: en el punto que se cancela, la función **no está definida**. Como el límite se calcula en un entorno reducido (donde `(x − a) ≠ 0`), quitar el factor no cambia nada de lo que ocurre cerca, y simplifica muchísimo."
        },

        {
          type: "p",
          text: "**∞ − ∞ — dos técnicas según el caso.**"
        },
        {
          type: "ul",
          items: [
            "**Si son cocientes**, se pasa todo a **común denominador**, se desarrollan las operaciones y se aplica el término dominante (o ∞/∞).",
            "**Si son raíces**, se **racionaliza** multiplicando y dividiendo por la expresión conjugada."
          ]
        },
        {
          type: "formula",
          latex: "\\lim_{x\\to+\\infty} \\left( \\frac{x^2 - 1}{x + 4} - \\frac{x^3}{\\sqrt{x^2 + 1}} \\right) = \\lim_{x\\to+\\infty} \\frac{x^4 - 1 - x^3(x + 4)}{(x + 4)\\,\\sqrt{x^2+1}} = \\lim_{x\\to+\\infty} \\frac{-4x^3 - 1}{x^3 + \\cdots} = -4",
          caption: "Cocientes: común denominador y término dominante."
        },
        {
          type: "formula",
          latex: "\\lim_{x\\to+\\infty} \\left( \\sqrt{x^2 - 2} - \\sqrt{x^2 + 3} \\right) = \\lim_{x\\to+\\infty} \\frac{(\\sqrt{x^2-2} - \\sqrt{x^2+3})(\\sqrt{x^2-2} + \\sqrt{x^2+3})}{\\sqrt{x^2-2} + \\sqrt{x^2+3}} = \\lim_{x\\to+\\infty} \\frac{-5}{\\sqrt{x^2-2} + \\sqrt{x^2+3}} = 0",
          caption: "Raíces: se multiplica por el conjugado para quitar la raíz del denominador."
        },
        {
          type: "note",
          tone: "tip",
          title: "Qué es el conjugado",
          text: "En `√A − √B`, el conjugado es `√A + √B`. Su producto es `A − B`, un número sin raíces. Multiplicar y dividir por el conjugado **no cambia el valor de la expresión**, solo la hace más manejable."
        },

        {
          type: "p",
          text: "**0 · ∞ — transformar.** Un producto donde un factor cae a 0 y otro sube a ∞ se reescribe como un cociente, pasándolo a la forma `0/0` o `∞/∞`."
        },
        {
          type: "formula",
          latex: "\\lim_{x\\to+\\infty} x^5 \\cdot e^{-x^2} = \\lim_{x\\to+\\infty} \\frac{x^5}{e^{x^2}} = \\lim_{x\\to+\\infty} \\frac{x^5}{\\infty} = 0",
          caption: "Se pasa a cociente y se aplica la jerarquía: la exponencial manda."
        },

        {
          type: "p",
          text: "**∞⁰ y 0⁰.** Estas dos, junto con la `1^∞`, se resuelven en el capítulo siguiente con **logaritmos** (y con L'Hôpital). En este tema se reconoce el tipo y se deja constancia; el juego no las exige."
        },

        {
          type: "p",
          text: "**1^∞ — la fórmula del número e.** Cuando `f(x) → 1` y `g(x) → ∞`:"
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to a} \\left[ f(x) \\right]^{g(x)} = e^{\\lim_{x \\to a} g(x)\\,\\left[ f(x) - 1 \\right]}",
          caption: "La fórmula de la indeterminación 1^∞."
        },
        {
          type: "p",
          text: "**Por qué funciona: la demostración en cuatro pasos.**"
        },
        {
          type: "ol",
          items: [
            "El número `e` se define como `e = lim_{n→∞} (1 + 1/n)ⁿ`. Nuestro límite tiene exactamente esa forma, solo que con `f(x)` en vez de 1 y `g(x)` en vez de n.",
            "Escribimos la base sumándole y restándole 1: `lim [f(x)]^{g(x)} = lim (1 + [f(x) − 1])^{g(x)}`.",
            "Sacamos factor común `1/g(x)` en la base: `= lim (1 + [f(x)−1]/g(x))^{g(x)·(f(x)−1)}`.",
            "El paréntesis se parece cada vez más a `1 + 1/n` y el exponente a `n`: **el límite de la base es el número e**, así que el resultado es `e` elevado al límite del exponente."
          ]
        },
        {
          type: "formula",
          latex: "\\lim_{x\\to a} [f(x)]^{g(x)} = \\lim_{x\\to a} \\left(1 + \\frac{f(x)-1}{g(x)}\\right)^{g(x)(f(x)-1)} = e^{\\lim_{x\\to a} g(x)\\,(f(x)-1)}",
          caption: "Los cuatro pasos encadenados."
        },
        {
          type: "note",
          tone: "key",
          title: "El atajo mental",
          text: "Base a 1 y exponente a infinito: **el exponente manda**. El resultado es `e` elevado a lo que salga al multiplicar el exponente por `(base − 1)`. Si eso da un número, el límite es un número; si `e` elevado a −∞, el límite es 0."
        },
        {
          type: "p",
          text: "**Ejemplo resuelto paso a paso.** Calculamos `lim_{x→+∞} [ (x² − 3) / (x² + x) ]^{2x+1}`, que es `1^∞` (el cociente tiende a 1 y el exponente a +∞)."
        },
        { type: "formula", latex: "f(x) = \\frac{x^2 - 3}{x^2 + x} \\;\\to\\; 1, \\qquad g(x) = 2x + 1 \\;\\to\\; +\\infty", caption: "Paso 1: identificar la base f y el exponente g." },
        { type: "formula", latex: "f(x) - 1 = \\frac{x^2 - 3}{x^2 + x} - 1 = \\frac{x^2 - 3 - x^2 - x}{x^2 + x} = \\frac{-x - 3}{x^2 + x}", caption: "Paso 2: calcular f(x) − 1." },
        { type: "formula", latex: "g(x)\\,\\left(f(x) - 1\\right) = (2x + 1)\\, \\frac{-x - 3}{x^2 + x} = \\frac{-2x^2 - 6x - x - 3}{x^2 + x} = \\frac{-2x^2 - 7x - 3}{x^2 + x}", caption: "Paso 3: el producto que va al exponente de e." },
        { type: "formula", latex: "\\lim_{x\\to+\\infty} \\frac{-2x^2 - 7x - 3}{x^2 + x} = \\frac{-2}{1} = -2 \\quad\\text{(manda el coeficiente de grado 2)}", caption: "Paso 4: el límite de ese producto, comparando grados." },
        { type: "formula", latex: "\\therefore\\; \\lim_{x\\to+\\infty} \\left[\\frac{x^2 - 3}{x^2 + x}\\right]^{2x+1} = e^{-2} = \\frac{1}{e^2}", caption: "Respuesta final." },
        {
          type: "note",
          tone: "warn",
          title: "Ojo con las que NO son 1^∞",
          text: "`lim_{x→+∞} [(2x−5)/(x+7)]^{2x−1}` **no** es una indeterminación: la base tiende a 2 y el exponente a +∞, y eso es un +∞ corriente. `2^∞ = ∞`. Lo mismo con `[(2x²+x−1)/(2x−1)]^{x−2}`: base 1, exponente +∞, y sí es `1^∞`, que da `e¹ = e`."
        }
      ]
    },

    /* --------------------------------------------------------------------
     * 9. Límites notables
     * ------------------------------------------------------------------ */
    {
      id: "limites-notables",
      title: "Límites notables",
      icon: "≡",
      summary: "Los tres que hay que saberse de memoria: seno sobre x, el número e y logaritmo sobre x.",
      blocks: [
        {
          type: "p",
          text: "Un límite notable es un resultado que se acepta sin demostración y que se usa después como herramienta. Hay tres que aparecen en el temario de 2º."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to 0} \\frac{\\sen x}{x} = 1",
          caption: "El más usado de todos."
        },
        {
          type: "p",
          text: "Se justifica viendo una tabla: `sen x` y `x` se parecen muchísimo cuando x está cerca de 0, y su cociente se acerca a 1."
        },
        { type: "table", id: "tabla-senx-sobre-x" },
        {
          type: "p",
          text: "Con ese límite se resuelven las formas `0/0` con seno y tangente. Ejemplos:"
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to 0} \\frac{\\tg x}{x} = \\lim_{x \\to 0} \\frac{\\sen x}{x}\\, \\frac{1}{\\cos x} = 1 \\cdot \\frac{1}{1} = 1",
          caption: "Se usa tg x = sen x / cos x y se separa el producto."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to 0} \\frac{\\sen 3x}{x} = \\lim_{x \\to 0} 3\\, \\frac{\\sen 3x}{3x} = 3 \\cdot 1 = 3",
          caption: "Sustituyo x por 3x para poder aplicar el límite notable."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to 0} \\frac{1 - \\cos x}{x^2} = \\lim_{x\\to 0} \\frac{2\\sen^2\\frac{x}{2}}{x^2} = \\frac{1}{2}",
          caption: "Con la identidad notable 1 − cos x = 2 sen²(x/2)."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to 0} \\left( \\frac{\\sen x}{x} \\right)^{1/x^2} = 1",
          caption: "Una base que tiende a 1 elevada a algo que tiende a infinito da 1, siempre que el exponente no crezca demasiado."
        },
        {
          type: "p",
          text: "**El número e**, segundo límite notable:"
        },
        {
          type: "formula",
          latex: "e = \\lim_{n \\to \\infty} \\left(1 + \\frac{1}{n}\\right)^n \\approx 2{,}71828183",
          caption: "El límite de la sucesión que aproxima el número e."
        },
        { type: "table", id: "tabla-numero-e" },
        {
          type: "note",
          tone: "tip",
          title: "La intuición",
          text: "La sucesión `(1 + 1/n)ⁿ` empieza en 2 (n = 1) y crece **monótonamente** hacia 2,71828… pero cada término es una aproximación **por debajo**. Da igual cuántos decimales quieras: siempre se queda un poquito corto."
        },
        {
          type: "p",
          text: "Y el tercer límite notable:"
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to 0} \\frac{\\ln(1 + x)}{x} = 1",
          caption: "El logaritmo se parece a x cuando x está cerca de 0."
        },
        {
          type: "p",
          text: "De él se deducen los otros dos limites en x = 0 a base de `e = lim (1+1/n)ⁿ`. Por ejemplo, `ln(1+x)/x` vale 1 porque, poniendo `t = 1/x`, el límite se escribe como `ln(1 + 1/t) : (1/t)`, que tiende a 1. Y `sen x / x` sale de `sen x ~ tan x` y de la igualdad `sen x / tan x = cos x`."
        },
        {
          type: "note",
          tone: "warn",
          title: "Dos límites notables más (nivel superior)",
          text: "`lim_{x→0} (1 + x)^{1/x} = e` y `lim_{x→0} (sen x / x)^{1/x²} = e^{1/2}`. Aparecen en la selectividad como curiosidad; no hace falta dominarlos para este tema."
        }
      ]
    },

    /* --------------------------------------------------------------------
     * 10. Continuidad
     * ------------------------------------------------------------------ */
    {
      id: "continuidad",
      title: "Continuidad",
      icon: "≈",
      summary: "Las tres condiciones, la continuidad lateral y la continuidad en un intervalo.",
      blocks: [
        {
          type: "p",
          text: "La idea intuitiva ya la conoces de la ESO: una función es continua en un punto si su gráfica se puede dibujar en un entorno de ese punto **sin levantar el lápiz del papel**. El límite es lo que convierte esa intuición en matemáticas."
        },
        {
          type: "p",
          text: "Formalmente, una función `f` es **continua en x₀** si se cumplen **tres condiciones** a la vez:"
        },
        {
          type: "ol",
          items: [
            "**Existe `f(x₀)`**, es decir, `x₀` pertenece al dominio de `f`.",
            "**Existe el límite** de `f` cuando `x → x₀` (los dos laterales existen y son iguales).",
            "**Los dos valores anteriores coinciden**: `f(x₀)` es igual al límite."
          ]
        },
        {
          type: "formula",
          latex: "\\begin{aligned} 1.\\;& x_0 \\in \\operatorname{Dom} f \\\\[2pt] 2.\\;& \\lim_{x \\to x_0^-} f(x) = \\lim_{x \\to x_0^+} f(x) \\\\[2pt] 3.\\;& f(x_0) = \\lim_{x \\to x_0} f(x) \\end{aligned}",
          caption: "Las tres condiciones, una por línea."
        },
        {
          type: "note",
          tone: "key",
          title: "Tres condiciones, no dos",
          text: "Lo que más se olvida es la primera. Una función puede tener un límite perfecto en x₀ y seguir sin ser continua ahí, simplemente porque **no está definida**. Es el caso de `(x² − 4)/(x − 2)`: vale 4 en todas partes menos en x = 2."
        },
        {
          type: "p",
          text: "**Operaciones con funciones continuas.** Si `f` y `g` son continuas en x₀, entonces también lo son las funciones que se obtienen de ellas:"
        },
        { type: "table", id: "tabla-operaciones-continuas" },
        {
          type: "p",
          text: "**Continuidad lateral.** Una función puede ser continua por un solo lado, sin serlo por el otro. Eso es lo que pasa en los extremos de un intervalo."
        },
        {
          type: "formula",
          latex: "f \\text{ es continua por la izquierda en } x_0 \\iff \\lim_{x \\to x_0^-} f(x) = f(x_0)",
          caption: "Continuidad por la izquierda."
        },
        {
          type: "formula",
          latex: "f \\text{ es continua por la derecha en } x_0 \\iff \\lim_{x \\to x_0^+} f(x) = f(x_0)",
          caption: "Continuidad por la derecha."
        },
        {
          type: "p",
          text: "**Continuidad en un intervalo.**"
        },
        {
          type: "formula",
          latex: "f \\text{ es continua en } (a,b) \\iff f \\text{ es continua en todos los puntos de } (a,b)",
          caption: "Intervalo abierto."
        },
        {
          type: "formula",
          latex: "f \\text{ es continua en } [a,b] \\iff \\left\\{ \\begin{array}{l} f \\text{ es continua en } (a,b) \\\\ \\lim_{x\\to a^+} f(x) = f(a) \\\\ \\lim_{x\\to b^-} f(x) = f(b) \\end{array} \\right.",
          caption: "Intervalo cerrado: dentro, y por la derecha en a, y por la izquierda en b."
        },
        {
          type: "note",
          tone: "tip",
          title: "Por qué en los extremos se mira un solo lado",
          text: "En el extremo a de `[a, b]` no hay x **menores** que a dentro del dominio, así que el límite por la izquierda ni siquiera tiene sentido. Por eso basta con mirar el lado que sí existe."
        },
        {
          type: "p",
          text: "**Las funciones elementales y dónde son continuas.** Todas lo son en su dominio de definición, y los puntos donde **no** lo son se calculan de forma inmediata:"
        },
        { type: "table", id: "tabla-elementales-continuidad" },
        {
          type: "formula",
          latex: "\\lim_{x \\to +\\pi/2} \\tg x = +\\infty \\;\\text{y}\\; \\lim_{x \\to -\\pi/2} \\tg x = -\\infty \\;\\Rightarrow\\; x = \\pm\\pi/2 \\text{ son asíntotas verticales de } \\tg x",
          caption: "La tg se anula el coseno en x = π/2 + kπ."
        }
      ]
    },

    /* --------------------------------------------------------------------
     * 11. Tipos de discontinuidad
     * ------------------------------------------------------------------ */
    {
      id: "discontinuidad",
      title: "Tipos de discontinuidad",
      icon: "≠",
      summary: "Evitable, salto finito, salto infinito y de segunda especie: cuatro maneras de no ser continua.",
      blocks: [
        {
          type: "p",
          text: "Si `f` no es continua en x₀ se dice que es **discontinua** en ese punto. Según qué condición de las tres falle, se clasifica en cuatro tipos."
        },
        { type: "table", id: "tabla-discontinuidad" },
        {
          type: "note",
          tone: "key",
          title: "La pregunta que decide el tipo",
          text: "Primero: ¿existe el límite? Si **no existe**, es de segunda especie. Si existe, mira si es **finito o infinito**. Y por último: ¿coincide con `f(x₀)`? Si no coincide, es **evitable** y se arregla redefiniendo."
        },
        {
          type: "p",
          text: "**Evitable.** El límite existe y es finito, pero o bien no coincide con `f(x₀)`, o bien la función no está definida en x₀. Se arregla **redefiniendo** la función para que tome el valor del límite."
        },
        {
          type: "formula",
          latex: "f(x) = x \\text{ con } f(0) = 5 \\;\\Rightarrow\\; \\lim_{x \\to 0} f(x) = 0 \\neq 5 = f(0) \\;\\Rightarrow\\; \\text{evitable}",
          caption: "El ejemplo más tonto: la función identidad con el valor en 0 cambiado a 5."
        },
        {
          type: "p",
          text: "Si la redefinimos como `f(0) = 1` (su valor natural), pasa a ser continua y ya no hay nada que objetar."
        },
        {
          type: "p",
          text: "**Salto finito (1ª especie).** Los dos laterales existen y son finitos, pero **distintos**. La gráfica da un brinco de altura medible."
        },
        {
          type: "formula",
          latex: "f(x) = \\begin{cases} 2, & 0 \\le x < 1 \\\\ 1, & 1 < x \\le 2 \\end{cases} \\quad\\Rightarrow\\quad \\lim_{x\\to 1^-} f(x) = 2 \\neq 1 = \\lim_{x\\to 1^+} f(x)",
          caption: "Salto finito de altura 1 en x = 1."
        },
        {
          type: "p",
          text: "**Salto infinito (1ª especie).** Los dos laterales existen, son distintos y al menos uno de ellos es infinito. La gráfica se dispara verticalmente."
        },
        {
          type: "formula",
          latex: "\\lim_{x \\to 0^-} \\frac{1}{x} = -\\infty \\neq +\\infty = \\lim_{x \\to 0^+} \\frac{1}{x}",
          caption: "La función 1/x en el origen: asíntota vertical x = 0."
        },
        {
          type: "p",
          text: "**Segunda especie.** Alguno de los dos laterales **no existe**, normalmente porque la función oscila sin parar. No hay nada que se pueda representar con un salto."
        },
        {
          type: "formula",
          latex: "f(x) = \\sen\\left(\\frac{1}{x}\\right) \\quad \\text{en } x = 0 \\;\\Rightarrow\\; \\lim_{x\\to 0^-} f(x) \\text{ no existe}, \\quad \\lim_{x\\to 0^+} f(x) \\text{ no existe}",
          caption: "El seno de 1/x no para de oscilar al acercarse a 0."
        },
        {
          type: "note",
          tone: "tip",
          title: "Resumen visual",
          text: "Evitable = un agujero pequeño (se tapa con un punto). Salto finito = un escalón. Salto infinito = una pared vertical. Segunda especie = vibración sin fin."
        }
      ]
    },

    /* --------------------------------------------------------------------
     * 12. Teoremas de las funciones continuas
     * ------------------------------------------------------------------ */
    {
      id: "teoremas-continuas",
      title: "Teoremas de las funciones continuas",
      icon: "∀",
      summary: "Conservación del signo, acotación, Bolzano, Darboux y Weierstrass: qué te garantizan.",
      blocks: [
        {
          type: "p",
          text: "Ser continua en un punto no es solo una curiosidad formal: garantiza cinco cosas muy útiles. Intuitivamente son fáciles de creer; demostrarlas es bastante más difícil."
        },
        {
          type: "p",
          text: "**Teorema de la conservación del signo.** Si `f` es continua en x = a y `f(a) ≠ 0`, entonces hay un entorno de a en el que la función tiene el mismo signo que `f(a)`."
        },
        {
          type: "formula",
          latex: "f \\text{ continua en } a,\\; f(a) \\neq 0 \\;\\Rightarrow\\; \\exists\\, \\varepsilon > 0 \\text{ tal que } \\forall x \\in (a-\\varepsilon, a+\\varepsilon) \\!:\\; f(x) \\text{ tiene el signo de } f(a)",
          display: true
        },
        {
          type: "p",
          text: "Sirve para decidir el signo de un cociente **sin calcularlo**: si no se anula, no cambia de signo cerca del punto."
        },
        {
          type: "p",
          text: "**Teorema de la acotación.** Si `f` es continua en x = a, entonces existe un entorno de a en el que la función está acotada (tiene un máximo y un mínimo en ese entorno)."
        },
        {
          type: "p",
          text: "**Teorema de Bolzano.** Si `f` es continua en el intervalo cerrado `[a, b]` y en los extremos toma valores de **signo contrario**, entonces existe un punto del interior del intervalo en el que la función **se anula**."
        },
        {
          type: "formula",
          latex: "f \\text{ continua en } [a,b],\\; f(a) < 0 < f(b) \\;\\Rightarrow\\; \\exists\\, c \\in (a,b) \\text{ tal que } f(c) = 0",
          display: true
        },
        {
          type: "p",
          text: "Es el teorema que dice que una raíz es continua: no se puede pasar de negativo a positivo sin pasar por cero. Se aplica a la existencia de **raíces de ecuaciones**."
        },
        {
          type: "p",
          text: "**Teorema de Darboux.** Si `f` es continua en `[a, b]` y n es un valor comprendido entre `f(a)` y `f(b)`, entonces existe un punto c del interior del intervalo en el que `f(c) = n`."
        },
        {
          type: "formula",
          latex: "f \\text{ continua en } [a,b] \\;\\Rightarrow\\; \\text{toma todos los valores entre } f(a) \\text{ y } f(b)",
          display: true
        },
        {
          type: "p",
          text: "Generaliza a Bolzano: no solo pasa por el 0, pasa por **todos** los valores intermedios, sin saltos."
        },
        {
          type: "p",
          text: "**Teorema de Weierstrass.** Si `f` es continua en el intervalo cerrado `[a, b]`, entonces alcanza un **máximo** y un **mínimo** en ese intervalo."
        },
        {
          type: "formula",
          latex: "f \\text{ continua en } [a,b] \\;\\Rightarrow\\; \\exists\\, c,d \\in [a,b] \\text{ con } f(c) = \\max_{[a,b]} f,\\; f(d) = \\min_{[a,b]} f",
          display: true
        },
        {
          type: "note",
          tone: "key",
          title: "Lo común a todos",
          text: "Los cinco necesitan **continuidad**, y tres de ellos necesitan además que el intervalo sea **cerrado** (`[a, b]`). Es lógico: en un intervalo abierto la función puede irse a infinito por un extremo, y entonces ni se acota ni alcanza extremos."
        }
      ]
    }
  ],

  /* =======================================================================
   * TABLAS
   * ===================================================================== */
  tables: [

    {
      id: "tabla-cerca-4-izquierda",
      title: "f(x) = x² − 2x, acercándose a 4 por la izquierda",
      caption: "x valores menores que 4, cada vez más próximos. f(x) se acerca a 8.",
      columns: ["x", "3", "3,5", "3,9", "3,99", "3,999", "3,9999"],
      rows: [
        ["f(x) = x² − 2x", "3", "5,25", "7,41", "7,9401", "7,994001", "7,99940001"]
      ]
    },

    {
      id: "tabla-cerca-4-derecha",
      title: "f(x) = x² − 2x, acercándose a 4 por la derecha",
      caption: "x valores mayores que 4, cada vez más próximos. f(x) se acerca a 8.",
      columns: ["x", "5", "4,5", "4,1", "4,01", "4,001", "4,0001"],
      rows: [
        ["f(x) = x² − 2x", "15", "11,25", "8,61", "8,0601", "8,006001", "8,00060001"]
      ]
    },

    {
      id: "tabla-parte-entera",
      title: "g(x) = x − E(x) en el punto x = 1",
      caption: "Por la izquierda g(x) → 1; por la derecha g(x) → 0. Distintos: el límite no existe.",
      columns: ["x → 1⁻", "0", "0,5", "0,9", "0,99", "0,999", "0,9999"],
      rows: [
        ["g(x)", "0,9", "0,5", "0,1", "0,01", "0,001", "0,0001"]
      ]
    },

    {
      id: "tabla-metodo-signos",
      title: "Método de los signos: cómo decidir el lado de un límite infinito",
      caption: "Se mira el signo del numerador y el del denominador en un punto cercano al punto de anulación.",
      columns: ["Expresión", "Por la izquierda (x → a⁻)", "Por la derecha (x → a⁺)", "Límite total"],
      rows: [
        ["(x + 2) / (x − 1) en x = 1", "3 / (−0) = −∞", "3 / (+0) = +∞", "No existe"], ["x² / (x − 1)² en x = 1", "+∞ (el cuadrado no cambia de signo)", "+∞", "+∞"],
        ["1 / x en x = 0", "1 / (−0) = −∞", "1 / (+0) = +∞", "No existe"], ["1 / x² en x = 0", "+∞", "+∞", "+∞"],
        ["1 / ln(x − 1) en x = 1", "+∞", "+∞", "+∞"]
      ]
    },

    {
      id: "tabla-operaciones",
      title: "Propiedades de los límites",
      caption: "Si f y g son convergentes en x₀, con límites L y M respectivamente:",
      columns: ["Propiedad", "Resultado", "Condición"],
      rows: [
        ["Suma", "lim (f + g) = L + M", "—"], ["Resta", "lim (f − g) = L − M", "—"], ["Producto por constante", "lim (k · f) = k · L", "k ∈ ℝ"],
        ["Producto", "lim (f · g) = L · M", "—"], ["Cociente", "lim (f / g) = L / M", "M ≠ 0"], ["Potencia", "lim (f(x))ⁿ = Lⁿ", "L admisible"],
        ["Logaritmo", "lim ln(f(x)) = ln L", "L > 0"]
      ]
    },

    {
      id: "tabla-infinito-suma",
      title: "Álgebra del infinito: suma y resta",
      caption: "Sumar o restar un número finito a un infinito no cambia el infinito.",
      columns: ["Expresión", "Resultado"],
      rows: [
        ["(+∞) + k", "+∞"], ["(−∞) + k", "−∞"], ["(+∞) − k", "+∞"], ["(−∞) − k", "−∞"], ["(+∞) + (+∞)", "+∞"], ["(−∞) + (−∞)", "−∞"], ["− (−∞)", "+∞"],
        ["(−∞) − (+∞)", "−∞"]
      ]
    },

    {
      id: "tabla-infinito-producto",
      title: "Álgebra del infinito: producto",
      caption: "El signo del producto lo pone el número k.",
      columns: ["Expresión", "Resultado"],
      rows: [
        ["k · (+∞),  si k > 0", "+∞"], ["k · (+∞),  si k < 0", "−∞"], ["k · (−∞),  si k > 0", "−∞"], ["k · (−∞),  si k < 0", "+∞"],
        ["(+∞) · (−∞)  y  (−∞) · (+∞)", "−∞"]
      ]
    },

    {
      id: "tabla-infinito-cociente",
      title: "Álgebra del infinito: cociente",
      caption: "Un número finito partido por infinito siempre da 0. El problema son dos infinitos.",
      columns: ["Expresión", "Resultado"],
      rows: [
        ["k / (+∞)", "0"], ["k / (−∞)", "0"], ["(+∞) / (+∞)", "Indeterminado"], ["(+∞) / (−∞)", "Indeterminado"], ["(−∞) / (+∞)", "Indeterminado"],
        ["(−∞) / (−∞)", "Indeterminado"], ["(+∞) / k,  si k > 0", "+∞"], ["(+∞) / k,  si k < 0", "−∞"], ["(+∞) / k,  si k = 0", "Indeterminado (∞ · ∞)"],
        ["0 / (−∞)", "0"]
      ]
    },

    {
      id: "tabla-infinito-potencia",
      title: "Álgebra del infinito: potencia",
      caption: "En una potencia hay que mirar a la vez la base y el exponente.",
      columns: ["Expresión", "Resultado"],
      rows: [
        ["k^(+∞),  si k > 1", "+∞"], ["k^(+∞),  si 0 < k < 1", "0"], ["k^(+∞),  si k = 1", "1"], ["k^(−∞),  si k > 1", "0"], ["k^(−∞),  si 0 < k < 1", "+∞"],
        ["(+∞)^k,  si k > 0", "+∞"], ["(+∞)^k,  si k < 0", "0"], ["(+∞)^(+∞)", "+∞"], ["(+∞)^(−∞)", "0"], ["(+∞)^0", "Indeterminado (∞⁰)"],
        ["0^(+∞)", "0"]
      ]
    },

    {
      id: "tabla-potenciales",
      title: "Límites de las funciones potenciales xⁿ",
      caption: "El signo de n y su paridad lo deciden todo.",
      columns: ["Exponente n", "x → +∞", "x → −∞"],
      rows: [
        ["n < 0", "0", "0"]
      ]
    },

    {
      id: "tabla-exponenciales",
      title: "Límites de las funciones exponenciales aˣ",
      caption: "Todo depende de si la base es mayor o menor que 1.",
      columns: ["Base a", "x → +∞", "x → −∞"],
      rows: [
        ["a < 0", "No existe (no es función de ℝ en ℝ)", "No existe"]
      ]
    },

    {
      id: "tabla-logaritmicas",
      title: "Límites de la función logarítmica logₐ x",
      caption: "Es la inversa de la exponencial, así que su comportamiento es el revés.",
      columns: ["Expresión", "Resultado"],
      rows: [
        ["logₐ x,  cuando x → +∞ (a > 1)", "+∞"], ["logₐ x,  cuando x → +∞ (0 < a < 1)", "−∞"], ["logₐ x,  cuando x → 0⁺ (a > 1)", "−∞"],
        ["ln(1 + x) / x,  cuando x → 0", "1 (límite notable)"]
      ]
    },

    {
      id: "tabla-asintotas-verticales",
      title: "Fuentes de asíntota vertical",
      caption: "Si alguno de los seis límites infinitos existe en x₀, x = x₀ es asíntota vertical.",
      columns: ["Tipo de función", "Condición", "Ejemplo"],
      rows: [
        ["Cociente", "El denominador se anula y el numerador no", "(x + 2)/(x − 1) en x = 1"], ["Logaritmo", "Lo que está dentro tiende a 0⁺", "ln(2x − 1) en x = 1/2"],
        ["Tangente", "Se anula el coseno: x = π/2 + kπ", "tg x en x = π/2"], ["Secante", "Se anula el coseno: x = π/2 + kπ", "sec x en x = π/2"],
        ["Cotangente", "Se anula el seno: x = kπ", "cotg x en x = 0"]
      ]
    },

    {
      id: "tabla-sustitucion-directa",
      title: "Sustitución directa: cuatro ejemplos resueltos",
      caption: "Se sustituye y, si no sale ninguna indeterminación, ya está.",
      columns: ["Límite", "Sustituyendo", "Resultado"],
      rows: [
        ["lim (x→3) (x² − 6x + 8)/(x − 3)", "(9 − 18 + 8)/0", "0/0: factorizar"]
      ]
    },

    {
      id: "tabla-grados-infinito",
      title: "Límites en el infinito según los grados",
      caption: "El grado mayor marca el ritmo de todo el cociente.",
      columns: ["Situación", "Resultado"],
      rows: [
        ["grado(numerador) > grado(denominador)", "∞, con el signo del coeficiente principal"], ["grado(numerador) < grado(denominador)", "0"],
        ["x → −∞ y grado impar", "El signo invertido"]
      ]
    },

    {
      id: "tabla-indeterminaciones",
      title: "Las siete indeterminaciones y su técnica",
      caption: "Reconocer el tipo es el 50 % del trabajo; aplicar la técnica correcta es el otro 50 %.",
      columns: ["Indeterminación", "Qué significa de verdad", "Técnica"],
      rows: [
        [
          "∞ / ∞",
          "El numerador y el denominador crecen sin parar. Puede dar ∞, 0 o un número: depende de los grados.",
          "Dividir numerador y denominador entre x elevado al mayor grado de los dos, y comparar los grados resultantes."
        ],
        [
          "0 / 0",
          "Los dos se anulan a la vez. El cociente puede ser cualquier valor: depende de la tasa a la que se anulan.",
          "Factorizar numerador y denominador (identidades notables, regla de Ruffini) y cancelar el factor común (x − a)."
        ],
        [
          "∞ − ∞",
          "Restar dos cantidades que ambas crecen sin parar. El resultado depende de cuál crece más rápido.",
          "Si son cocientes: común denominador y término dominante. Si son raíces: racionalizar con la expresión conjugada."
        ],
        [
          "0 · ∞",
          "Un factor se anula mientras el otro se dispara. El producto puede ser 0, ∞ o un número.",
          "Transformar el producto en un cociente, pasándolo a la forma 0/0 o a la forma ∞/∞, y seguir."
        ],
        [
          "∞⁰",
          "Una base que se dispara elevada a un exponente que se hace 0. El 0 puede ganar o perder.",
          "Pasar a logaritmo y aplicar L'Hôpital. En este tema se reconoce el tipo y se deja consignado."
        ],
        [
          "0⁰",
          "Base y exponente se anulan a la vez en una potencia.",
          "Pasar a logaritmo y aplicar L'Hôpital. En este tema se reconoce el tipo y se deja consignado."
        ],
        [
          "1^∞",
          "Una base que tiende a 1 elevada a un exponente que se dispara. Hay un resultado universal: el número e.",
          "Aplicar la fórmula: lim [f]^g = e^(lim g·(f − 1)), con f → 1 y g → ∞."
        ]
      ]
    },

    {
      id: "tabla-senx-sobre-x",
      title: "El límite notable del seno, tabla de valores",
      caption: "Cuanto más cerca de 0 está x, más se parece sen x a x, y el cociente se acerca a 1.",
      columns: ["x", "sen x", "sen x / x"],
      rows: [
        ["1", "0,841470985", "0,841470985"], ["0,6", "0,564642473", "0,941070789"], ["0,36", "0,352274233", "0,978539537"], ["0,216", "0,214324298", "0,992242120"],
        ["0,1296", "0,129237508", "0,997202990"], ["0,07776", "0,077681660", "0,998992535"], ["0,046656", "0,046639075", "0,999637242"],
        ["0,01679616", "0,016795370", "0,999952982"]
      ]
    },

    {
      id: "tabla-numero-e",
      title: "El número e: la sucesión (1 + 1/n)ⁿ",
      caption: "Cada término se acerca un poco más a 2,71828183… pero ninguno lo alcanza.",
      columns: ["n", "(1 + 1/n)ⁿ"],
      rows: [
        ["1", "2,00000000"], ["2", "2,25000000"], ["3", "2,37037037"], ["5", "2,48832000"], ["10", "2,59374246"], ["50", "2,69158803"], ["100", "2,70481383"],
        ["5000", "2,71801005"]
      ]
    },

    {
      id: "tabla-operaciones-continuas",
      title: "Operaciones con funciones continuas",
      caption: "Si f y g son continuas en x₀, todas estas también lo son.",
      columns: ["Función", "¿Es continua en x₀?", "Condición"],
      rows: [
        ["fⁿ,  ⁿ√f", "Sí", "—"]
      ]
    },

    {
      id: "tabla-elementales-continuidad",
      title: "Las funciones elementales y sus puntos de discontinuidad",
      caption: "Todas son continuas en su dominio. Estos son los puntos donde el dominio se rompe.",
      columns: ["Función", "Es continua en", "No es continua donde"],
      rows: [
        ["Polinómica", "Todo ℝ", "Nunca"], ["Racional", "Todo ℝ salvo las raíces del denominador", "x = raíz del denominador"],
        ["Radical de índice par", "Donde el radicando sea ≥ 0", "Radicando negativo"], ["Radical de índice impar", "Todo ℝ", "Nunca"],
        ["Cosecante y cotangente", "Donde el seno no se anula", "x = kπ"]
      ]
    },

    {
      id: "tabla-discontinuidad",
      title: "Tipos de discontinuidad",
      caption: "La clasificación depende de qué condición de continuidad falla.",
      columns: ["Tipo", "Condición", "Se arregla", "Ejemplo"],
      rows: [
        [
          "Evitable",
          "El límite existe y es finito, pero es distinto de f(x₀); o la función no está definida en x₀.",
          "Sí: se redefine f(x₀) con el valor del límite.",
          "f(x) = x con f(0) = 5"
        ],
        [
          "No evitable, 1ª especie, salto finito",
          "Los dos laterales existen, son distintos y ambos son finitos.",
          "No",
          "f(x) = 2 en [0,1) y f(x) = 1 en (1,2], en x = 1"
        ],
        [
          "No evitable, 1ª especie, salto infinito",
          "Los dos laterales existen, son distintos y al menos uno es infinito.",
          "No",
          "f(x) = 1/x en x = 0"
        ],
        [
          "No evitable, 2ª especie",
          "Alguno de los dos límites laterales no existe (oscilación, etc.).",
          "No",
          "f(x) = sen(1/x) en x = 0"
        ]
      ]
    }
  ],

  /* =======================================================================
   * CHULETA — consulta rápida antes de un test
   * ===================================================================== */
  cheatsheet: [

    {
      label: "Denominador no se anula",
      math: "\\lim_{x \\to a} \\frac{P(x)}{Q(x)} = \\frac{P(a)}{Q(a)}",
      note: "Sustituye y ya está. Si sale un número, ese es el límite."
    },

    {
      label: "Denominador se anula, numerador no",
      math: "\\lim_{x \\to a^\\pm} \\frac{P(x)}{x - a} = \\pm\\, \\frac{P(a)}{0^\\pm} = \\pm\\, \\operatorname{sgn}(P(a)) \\cdot \\infty",
      note: "Mira el signo del numerador y el del lado. Si los dos lados difieren: no existe."
    },

    {
      label: "Los dos laterales",
      math: "\\lim_{x \\to a} f(x) = L \\iff \\lim_{x \\to a^-} f(x) = \\lim_{x \\to a^+} f(x) = L",
      note: "Si uno no existe o no son iguales, el límite no existe."
    },

    {
      label: "Jerarquía de crecimiento",
      math: "\\text{Exponencial} > \\text{Polinómica} > \\text{Logarítmica} > \\text{Constante}",
      note: "Cuando hay sumas o cocientes mixtos, gana la que más crece."
    },

    {
      label: "Cociente en el infinito",
      math: "\\lim_{x \\to \\pm\\infty} \\frac{P(x)}{Q(x)} = \\begin{cases} \\pm\\,\\operatorname{sgn}(a_n) \\cdot \\infty & \\text{si } \\deg P > \\deg Q \\\\ 0 & \\text{si } \\deg P < \\deg Q \\\\ a_n / b_m & \\text{si } \\deg P = \\deg Q \\end{cases}",
      note: "En −∞, si el grado es impar el signo se invierte."
    },

    {
      label: "Indeterminación ∞/∞",
      math: "\\lim \\frac{\\infty}{\\infty} \\;\\Rightarrow\\; \\text{divide entre } x^{\\max} \\text{ y compara grados}",
      note: "Es la que más sale en exámenes. No se puede cancelar nada."
    },

    {
      label: "Indeterminación 0/0",
      math: "\\lim_{x \\to a} \\frac{(x-a)\\,P(x)}{(x-a)\\,Q(x)} = \\lim_{x \\to a} \\frac{P(x)}{Q(x)} = \\frac{P(a)}{Q(a)}",
      note: "Factoriza y cancela. Ruffini o identidades notables."
    },

    {
      label: "Indeterminación ∞ − ∞",
      math: "\\frac{A}{B} - \\frac{C}{D} = \\frac{AD - CB}{BD}, \\qquad \\sqrt{A} - \\sqrt{B} = \\frac{A - B}{\\sqrt{A} + \\sqrt{B}}",
      note: "Cocientes: común denominador. Raíces: racionaliza con el conjugado."
    },

    {
      label: "Indeterminación 0 · ∞",
      math: "0 \\cdot \\infty \\;\\Rightarrow\\; \\text{pásalo a cociente: } \\frac{0}{1/\\infty} = \\frac{0}{0} \\text{ o } \\frac{\\infty}{1/0} = \\frac{\\infty}{\\infty}",
      note: "Elige la forma que te resulte más cómoda."
    },

    {
      label: "Indeterminación 1^∞",
      math: "\\lim \\left[f(x)\\right]^{g(x)} = e^{\\lim g(x)\\,(f(x) - 1)}",
      note: "Con f → 1 y g → ∞. Calcula el producto del exponente: si sale −∞, el límite es 0."
    },

    {
      label: "Las otras tres potencias",
      math: "\\infty^0,\\; 0^0,\\; 1^\\infty \\text{ son indeterminaciones}",
      note: "Las tres se resuelven pasando a logaritmo (L'Hôpital). En este tema se reconocen."
    },

    {
      label: "Asíntota vertical",
      math: "x = x_0 \\;\\text{ si } \\lim_{x \\to x_0^\\pm} f(x) = \\pm\\, \\infty",
      note: "Cociente con denominador anulado, logaritmo de algo que cae a 0, o tg donde el coseno se anula."
    },

    {
      label: "Asíntota horizontal",
      math: "y = L \\;\\text{ si } \\lim_{x \\to +\\infty} f(x) = L \\text{ o } \\lim_{x \\to -\\infty} f(x) = L",
      note: "Se calcula con el término dominante."
    },

    {
      label: "Límites notables",
      math: "\\lim_{x \\to 0} \\frac{\\sen x}{x} = 1, \\qquad e = \\lim_{n\\to\\infty}\\left(1 + \\tfrac{1}{n}\\right)^n, \\qquad \\lim_{x\\to 0} \\frac{\\ln(1+x)}{x} = 1",
      note: "Los tres de memoria. El primero se usa en todas las formas con seno y tangente."
    },

    {
      label: "Las tres condiciones de continuidad",
      math: "f \\text{ continua en } a \\iff f(a) \\text{ existe},\\; \\lim_{x\\to a} f(x) \\text{ existe},\\; f(a) = \\lim_{x \\to a} f(x)",
      note: "Las tres a la vez. Olvidar la primera es el error más común."
    },

    {
      label: "Discontinuidad evitable",
      math: "\\lim_{x \\to a} f(x) \\text{ existe y es finito}, \\quad f(a) \\neq \\lim_{x\\to a} f(x) \\text{ (o } f(a) \\text{ no existe)}",
      note: "Se arregla redefiniendo f(a). Es el único tipo «arreglable»."
    },

    {
      label: "Salto finito",
      math: "\\lim_{x \\to a^-} f(x) = L_1 \\neq L_2 = \\lim_{x \\to a^+} f(x), \\quad L_1, L_2 \\text{ finitos}",
      note: "1ª especie. No se arregla redefiniendo."
    },

    {
      label: "Salto infinito",
      math: "\\lim_{x \\to a^-} f(x) = +\\infty \\neq -\\infty = \\lim_{x \\to a^+} f(x)",
      note: "1ª especie con infinito. Caso típico: 1/x en 0."
    },

    {
      label: "Segunda especie",
      math: "\\lim_{x \\to a^-} f(x) \\text{ no existe (o no existe el de la derecha)}",
      note: "Normalmente por oscilación. Caso típico: sen(1/x) en 0."
    },

    {
      label: "Teorema de Bolzano",
      math: "f \\text{ continua en } [a,b],\\; f(a) < 0 < f(b) \\;\\Rightarrow\\; \\exists\\, c \\in (a,b) : f(c) = 0",
      note: "Cambiar de signo implica pasar por cero."
    },

    {
      label: "Teorema de Darboux",
      math: "f \\text{ continua en } [a,b] \\;\\Rightarrow\\; f \\text{ toma todos los valores entre } f(a) \\text{ y } f(b)",
      note: "La versión fuerte de Bolzano: no hay saltos en una función continua."
    },

    {
      label: "Teorema de Weierstrass",
      math: "f \\text{ continua en } [a,b] \\;\\Rightarrow\\; f \\text{ alcanza máximo y mínimo en } [a,b]",
      note: "Necesita intervalo cerrado."
    },

    {
      label: "Conservación del signo",
      math: "f \\text{ continua en } a,\\; f(a) > 0 \\;\\Rightarrow\\; f(x) > 0 \\text{ cerca de } a",
      note: "Sirve para decidir el signo de un cociente sin calcularlo."
    }
  ]
};

/* Permite cargar el fichero en Node (validación, tests) sin tocar nada más. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = window.THEORY;
}