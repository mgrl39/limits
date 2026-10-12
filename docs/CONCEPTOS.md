# Conceptos

Una guía para el que está usando el juego. Sin fórmulas complicadas y sin jerga. Si
algo aquí no se entiende, es culpa del que lo escribió, no tuya.

---

## 1. Qué es un límite, de verdad

Piensa en una función como en una máquina. Tú le das un número, ella te devuelve otro.
El límite es una pregunta mucho más rara:

> **Si le doy números cada vez más cerca del 7 (sin darle nunca el 7), ¿hacia qué
> número va saliendo lo que devuelve?**

Eso es todo. Y la palabra clave es **sin darle nunca el 7**. En un límite, la variable
nunca llega al punto. Se acerca, se acerca, y siempre le queda un poco más de camino.

Un ejemplo que se te va a quedar. Considera `f(x) = x² − 2x` y acerca `x` a 4:

| x | 3 | 3,5 | 3,9 | 3,99 | 3,999 |
|---|---|---|---|---|---|
| f(x) | 3 | 5,25 | 7,41 | 7,9401 | 7,994001 |

Los números de abajo se van uno a uno acercándose a 8. Da igual por dónde vengas
siempre: por la izquierda o por la derecha. Por eso decimos que
`lim (x → 4) f(x) = 8`.

Fíjate en una cosa rara: **la función no está definida en el 4**. Da igual. Puedes
tener un límite perfecto en un punto donde la función no existe. De hecho, es
perfectamente posible, y sale en cada examen.

### Lo que NO es un límite

- No es «cuánto vale la función aquí». Eso es `f(7)`, y es otra cosa.
- No es «el valor más grande» ni «el más pequeño».
- No es una división por cero. Cuando alguien dice «el límite es infinito», no está
  diciendo que la división valga infinito: está diciendo que **la flecha se dispara**.

---

## 2. Por qué los dos lados tienen que coincidir

Aquí está el 70 % de los errores del tema, así que léelo dos veces.

Los **límites laterales** son el mismo límite pero restringidos a un lado: te
acercas a 4 **solo por la izquierda**, o **solo por la derecha**. Se escriben con
un signo pegado: `x → 4⁻` y `x → 4⁺`.

Y aquí está la regla que lo explica todo:

> El límite en un punto existe **si y solo si** el límite por la izquierda existe,
> el límite por la derecha existe, y **los dos son iguales**.

Piensa por qué. Si te acercas a 4 por un lado y la función vale 8, y te acercas por
otro lado y vale 3, entonces la pregunta «¿hacia qué valor va tendiendo?» no tiene
respuesta: depende de por dónde vengas. Sería como preguntar «¿qué dirección lleva
esta carretera?» y que te dijeran «depende de si entras por el norte o por el sur».

El contraejemplo clásico es la función parte entera. `E(x)` devuelve el entero más
grande menor o igual que `x`. Mira `g(x) = x − E(x)` cerca de 1:

- **Por la izquierda** (x = 0,999): `E(0,999) = 0`, luego `g(0,999) = 0,999`. Cada
  vez más cerca de **1**.
- **Por la derecha** (x = 1,001): `E(1,001) = 1`, luego `g(1,001) = 0,001`. Cada
  vez más cerca de **0**.

1 por un lado, 0 por el otro. **`lim (x → 1) g(x)` no existe.**

Que los laterales no coincidan tiene un nombre bastante bonito cuando ambos son números
finitos: un **salto**. Es literalmente un escalón en la gráfica. Si además uno de
los dos es infinito, es un **salto infinito**. Si alguno de los dos no existe (por
oscilación, por ejemplo), ya no es salto: es una discontinuidad de **segunda
especie**.

Y aquí viene lo importante para el resto del tema: **todo lo demás se apoya en
esto**. La continuidad, las asíntotas, los tipos de discontinuidad. Si tienes clara
una cosa sola del capítulo, que sea esta.

---

## 3. La trampa número 1: 0/0 no vale 0

Aquí se cae la mitad de la clase. Léelo despacio.

Cuando sustituyes en un cociente y te sale de numerador 0 y de denominador 0, tu
cerebro dice «0 partido por 0 es 0». **No.** Es 0 partido por 0 es 0. Eso no está
definido en ninguna parte. Si existiera, la pregunta «¿cuánto es medio partido por
medio?» tendría respuesta, y la tiene: no la tiene.

Mira este ejemplo, que sale mucho:

```
(x² − 4) / (x − 2)
```

Sustituyendo `x = 2` sale `0/0`. ¿Y ahora qué? Por fin te toca trabajar. Factorizas:

```
[(x − 2)(x + 2)] / (x − 2) = x + 2 = 4
```

El límite vale **4**. No 0, no 1, no «da igual». Cuatro.

Aquí está la trampa, y la entiende poca gente hasta que se la locomotivan:
**al cancelar `x − 2` estás dividiendo entre cero**, pero te da igual, porque estás
cancelando en todos los puntos **excepto** en el 2, y el 2 no es ninguno de los
puntos que mira un límite. El límite se calcula en un vecindario del 2 lleno de
números que **no son** el 2. Y en todos esos números, cancelar es perfectamente
legal.

### Entonces, ¿qué significa 0/0?

Significa: «el numerador y el denominador se anulan a la vez y no sé todavía cuál
gana». Es un **aviso de que la sustitución directa no vale**, no un resultado.

Según a qué velocidad se anulen, puede pasar cualquier cosa:

- Si el numerador se anula más despacio → el resultado es **0**.
- Si se anulan a la misma velocidad → un **número cualquiera**.
- Si el numerador se anula más rápido → el cociente **se dispara** (∞ o −∞).

Un ejemplo clásico: `x / x²` en el origen da `1/x`, que se dispara a infinito.
`(2x)/x` da 2. `x/(2x)` da 1/2. Los tres son `0/0` al sustituir y los tres dan cosas
distintas. Por eso `0/0` es una **indeterminación**: no te dice el resultado, te
dice que tienes trabajo por hacer.

En el juego esto aparece constantemente. Cuando el enunciado te da un límite y al
sustituir te sale `0/0`, el **interrogatorio de método** te va a preguntar qué técnica
aplicas. Ahí no vale la sustitución: hay que factorizar y cancelar.

---

## 4. Qué es una indeterminación (y por qué hay siete)

Una indeterminación es una forma que no significa nada por sí sola, sino que está
pidiéndote que hagas algo más. Hay siete, y no son arbitrarias: son exactamente las
combinaciones en las que dos cosas que van en direcciones opuestas se anulan entre sí.

| Indeterminación | Qué está pasando | Cómo la resuelves |
|---|---|---|
| `∞ / ∞` | Los dos se disparan. Gana el que crece más rápido. | Divide entre `x` elevado al mayor grado y compara. |
| `0 / 0` | Los dos se anulan. Gana el que se anula más lento. | Factoriza y cancela el factor común. |
| `∞ − ∞` | Restas dos cosas enormes; el resultado depende de cuál era mayor. | Común denominador, o racionaliza si hay raíces. |
| `0 · ∞` | Un factor cae a cero mientras otro se dispara. | Pásalo a cociente: te queda `0/0` o `∞/∞`. |
| `1^∞` | La base roza 1 y el exponente se dispara. Hay un resultado universal. | La fórmula del número `e`. |
| `∞^0` | Base disparada, exponente que se anula. | logaritmo y L'Hôpital (tema siguiente). |
| `0^0` | Base y exponente se anulan a la vez. | logaritmo y L'Hôpital (tema siguiente). |

Fíjate en que hay un patrón: en todas, **algo grande se anula con algo pequeño**, o
dos magnitudes se restan. Eso es lo que las hace degeneradas.

Lo que **no** es una indeterminación, aunque lo parezca:

- `(+∞) + 7` → eso sí vale `+∞`, sin más.
- `(+∞) / 7` → eso sí vale `+∞`.
- `2^(+∞)` → base mayor que 1, exponente a infinito: eso sí es `+∞`.
- `0 / (+∞)` → eso sí vale `0`.

El juego te pregunta por la técnica, no solo por el resultado, precisamente para que
no te cuelgues de la tabla del álgebra del infinito.

---

## 5. La fórmula del número e, en serio

Es lo más raro del temario y lo que más se olvida. La versión corta:

> Si `f(x)` tiende a 1 y `g(x)` tiende a infinito, entonces
> `lim [f(x)]^(g(x)) = e` elevado a `lim g(x) · (f(x) − 1)`.

Lo bonito (y lo que ayuda a recordarla) es el porqué. El número `e` se define justo
como el límite `lim (1 + 1/n)ⁿ`. Nuestro límite tiene la misma pinta: una base que
roza 1, elevada a un exponente enorme. Si la base la escribes como
`1 + (f − 1)`, y el exponente lo partes en trozos de tamaño `1/g`, te queda un
montón de factores que son cada vez más parecidos a `1 + 1/n`. Cada trozo tiende a
`e`, y multiplicarlos `g` veces da `e` multiplicado por `g` veces... que es
exactamente el exponente que te queda.

Ejemplo completo, para que veas que es mecánico:

```
lim (x→+∞) [ (x² − 3) / (x² + x) ] ^ (2x+1)
```

1. La base tiende a 1 y el exponente a infinito. Es `1^∞`.
2. `f(x) − 1 = (x² − 3)/(x² + x) − 1 = (−x − 3)/(x² + x)`
3. `g(x) · (f(x) − 1) = (2x+1) · (−x − 3)/(x² + x) = (−2x² − 7x − 3)/(x² + x)`
4. Ese cociente tiende a −2 (manda el coeficiente de grado 2).
5. Resultado: `e^(−2)`.

Y una advertencia que te va a ahorrar puntos: si la base tiende a **2** en vez de a
1, no es `1^∞`. `2^∞` es un infinito corriente, sin historia.

---

## 6. El cuaderno de errores: fallar es información

Aquí hay una cosa que cambia la manera de estudiar, y quiero ser claro: **el cuaderno
de errores no es una lista de fracasos**. Es un diagnóstico.

Cuando fallas un problema, el juego guarda tres cosas:

- el **enunciado** (más exactamente, la **semilla**: el número que identifica el
  problema de forma única y permanente),
- **tu respuesta**,
- y **la respuesta correcta**.

Eso significa que el cuaderno es, literalmente, una lista de los conceptos donde tu
procedimiento falla. Es un diagnóstico por diferencia entre lo que esperabas y lo que
era.

Y tiene un truco: la semilla. Como el generador es determinista, el mismo número
produce siempre el mismo problema. Si guardas `seed: 4211`, puedes volver a ese
problema exacto todas las veces que quieras, sin que se genere ni se vuelva a
generar. No pierdes nada por equivocarte.

### Cómo usarlo de verdad

**No lo uses como un ranking.** «Tengo 14 errores» no significa nada. «Tengo 14
errores» es como un sismógrafo: te dice dónde está el temblor.

**Agrupa por método, no por problema.** El juego etiqueta cada fallo con la técnica
que hacía falta. Si te salen muchos fallos de `factorizar` y ninguno de `grados`, tu
problema no es el cálculo: es que no reconoces cuándo hay que factorizar. Esa es una
información accionable; «fallé el problema 37» no lo es.

**Repite hasta el aburrimiento.** La segunda vez que resuelves un problema ya no
estás comprobando si sabes la técnica: estás comprobando si la reconoces. A la
tercera ya es automático. La curva bonita de aprendizaje está entre la
segunda y la tercera repetición, no entre la primera y la segunda.

**Vuelve en orden inverso.** Cuando ya no falles, deja de practicar ese bloque y
centra el esfuerzo en el peor. Es tentador practicar lo que ya sabes (y es agradable),
pero no sirve para nada.

Y un consejo sobre el ajuste `examen`: con la política estricta, las opciones no
aparecen hasta que intentas responder, y si fallas no se desbloquean. Suena duro,
pero funciona: **obliga a decidir antes de mirar**, que es exactamente lo que te van
a exigir en el examen. Si te agobia, cámbiate a `boton` o a `visible` y vuelve a
estricto cuando ya domines el tema.

---

## 7. Glosario

| Término | Qué significa |
|---|---|
| **Límite** | El valor al que una función se acerca cuando la variable se acerca a un punto (o al infinito), sin llegar nunca a él. |
| **Función convergente** | Una función que tiene límite en ese punto. Sin más rodeos: significa que cumple la definición. |
| **Límite lateral** | El mismo límite, pero restringido a un solo lado del punto: por izquierda (`x → a⁻`) o por derecha (`x → a⁺`). |
| **Entorno de centro a y radio δ** | El intervalo abierto de números que están a distancia menor que δ de a. Se escribe `E(a, δ)`. |
| **Entorno reducido** | El mismo entorno pero **sin el punto central**: `E*(a, δ)`. Existe porque en un límite nunca se llega a `a`. |
| **Límite ε − δ** | La definición formal: para cualquier precisión ε hay un δ tal que, a menos de δ del punto, el error es menor que ε. |
| **Indeterminación** | Una forma (`0/0`, `∞/∞`, ...) que no da un resultado por sí sola, sino que está pidiendo una técnica. |
| **Factorizar** | Escribir un polinomio como producto. Se hace con identidades notables o con la regla de Ruffini. |
| **Regla de Ruffini** | Método para dividir un polinomio entre `x − a` y obtener el cociente y el resto. Si el resto es 0, `a` es una raíz. |
| **Identidad notable** | Igualdad algebraica que conviene memorizar: `(a+b)²`, `a² − b² = (a−b)(a+b)`, `a³ − b³`, etc. |
| **Factor común** | Un factor que aparece en el numerador y en el denominador. Se puede cancelar en 0/0. |
| **Término dominante** | El que crece más rápido y por tanto decide el valor de un límite en el infinito. |
| **Jerarquía de crecimiento** | Exponencial > Polinómica > Logarítmica > Constante. El orden en que mandan las funciones. |
| **Comparar grados** | Técnica para `∞/∞`: dividir numerador y denominador entre `x` elevado al mayor grado. |
| **Racionalizar** | Quitar una raíz del denominador multiplicando por la expresión conjugada. |
| **Expresión conjugada** | En `√A − √B`, es `√A + √B`. Su producto es `A − B`, sin raíces. |
| **Común denominador** | Llevar dos cocientes a uno solo multiplicando en cruz. Es el primer paso para resolver `∞ − ∞`. |
| **Límite notable** | Un límite que se acepta sin demostrar: `lim sen x / x = 1`, el número `e`, `lim ln(1+x)/x = 1`. |
| **Asíntota vertical** | Recta `x = x₀` que la gráfica cruza subiendo o bajando a infinito. Aparece cuando el cociente se dispara o cuando un logaritmo se anula. |
| **Asíntota horizontal** | Recta `y = L` a la que la gráfica se acerca al alejarse. Aparece cuando el límite en el infinito es un número. |
| **Continuidad** | Que se pueda dibujar la gráfica sin levantar el lápiz. Matemáticamente: definida, con límite, y límite = valor del punto. |
| **Continuidad lateral** | Que el límite por un solo lado exista y coincida con el valor de la función. Importa en los extremos de un intervalo. |
| **Discontinuidad** | Un punto donde la función **no** es continua. |
| **Discontinuidad evitable** | El límite existe y es finito pero es distinto del valor de la función, o la función no está definida ahí. Se arregla redefiniendo. |
| **Salto** | Los dos laterales existen, son distintos y ambos finitos. La gráfica da un escalón. También se llama discontinuidad de primera especie. |
| **Salto infinito** | Los dos laterales existen, son distintos y al menos uno es infinito. |
| **Segunda especie** | Alguno de los dos laterales no existe. Lo típico: oscilación, como `sen(1/x)` en el origen. |
| **Teorema de Bolzano** | Si una función es continua en `[a, b]` y en los extremos tiene signos opuestos, en algún punto del medio hay un cero. |
| **Teorema de Darboux** | Si es continua en `[a, b]`, toma **todos** los valores entre `f(a)` y `f(b)`. La versión fuerte de Bolzano. |
| **Teorema de Weierstrass** | Si es continua en `[a, b]`, alcanza un máximo y un mínimo. Necesita intervalo cerrado. |
| **Conservación del signo** | Si `f` es continua y `f(a) > 0`, entonces cerca de `a` también es positiva. Sirve para el método de los signos. |
| **Método de los signos** | Para límites infinitos: mirar el signo del numerador y del denominador cerca del punto para saber a qué lado y con qué signo se dispara. |
| **Dominio de una función** | El conjunto de valores que puedes darle sin que la operación deje de tener sentido. No es todo ℝ: el logaritmo no acepta negativos, una raíz cuadrada no acepta negativos. |