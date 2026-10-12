# Error Report — Space Bunny Free / Límites

**Fecha**: 2026-10-12
**Proyecto**: Juego web de límites y continuidad para 2º de Bachillerato
**Versión del motor**: `src/engine.js` (sin versionado explícito)

---

## Resumen ejecutivo

El proyecto tiene **23 generadores** de problemas matemáticos, pero la verificación numérica independiente revela **múltiples discrepancias** entre la respuesta que declara el motor y el comportamiento real de la función al evaluarse numéricamente. Además, hay **excepciones en tiempo de ejecución** en al menos un generador y **datos incompletos** en la hoja de teoría.

**Estado general**: El motor funciona y genera problemas, pero **no es matemáticamente fiable** en varios casos críticos. Requiere correcciones antes de considerarse listo para uso pedagógico.

---

## 1. Discrepancias matemáticas (verificación numérica)

La herramienta `tests/numeric-verify.mjs` evalúa cada expresión independientemente del motor (usando `lib/eval-ast.mjs` y `lib/trends.mjs`) y compara la tendencia observada con la respuesta declarada. Con 10 semillas por generador:

| Generador | Casos | Coinciden | Fallan | Excepciones | Problema principal |
|-----------|-------|-----------|--------|-------------|-------------------|
| `subst-directa` | 10 | 1 | 0 | 9 | Solo 1 caso válido (otros se descartan por denominador=0) |
| **`subst-elemental`** | 10 | **0** | **1** | 9 | **Respuesta 1 declarada, numéricamente ~3.33e-12** (caso v=6: `abs(x-3)/x` → 0, no 1) |
| **`lateral-signo`** | 10 | **0** | **2** | 3 | **Signo incorrecto**: declara `+inf`/`-inf` pero numéricamente "oscila signo" |
| **`lateral-dne`** | 10 | **1** | **0** | 4 | Declara "no existe" pero numéricamente muestra divergencia con signo definido |
| **`inf-menos-inf-factor`** | 10 | **0** | **1** | 9 | Declara 1 pero numéricamente "oscila signo 1" |
| **`cero-cero-ruffini`** | 10 | **0** | **0** | **10** | **EXCEPCIÓN**: "Cannot convert und to a BigInt" |
| **`sen-x-partido-x`** | 10 | **4** | **1** | 0 | Declara `1/2` pero numéricamente `0.0000000` (cancelación catastrófica en `1-cos(x)`) |

**Total**: 228 problemas generados · 37 coinciden · **11 fallan · 10 excepciones** · 30 excluidos (continuidad)

### Detalles de las discrepancias más graves

#### 1.1 `subst-elemental` (caso v=6): valor absoluto / expresión lineal
- **Enunciado**: `abs(x-3)/x` con x → 3
- **Respuesta del motor**: `1`
- **Realidad numérica**: `3.33e-12` (tiende a 0)
- **Causa**: El código en `engine.js:1518-1531` asume que `|x-a|/(x-a+c) → 1`, pero para x→a, numerador → 0 y denominador → c ≠ 0, así que el límite es **0**, no 1.

#### 1.2 `lateral-signo`: análisis de signos incorrecto
- **Ejemplos**:
  - `(4x-2)/(x-3)` con x→3⁻: motor dice `-inf`, numérico "oscila signo -1"
  - `4x/(x-1)` con x→1⁺: motor dice `+inf`, numérico "oscila signo 1"
- **Causa probable**: El motor `limit.atPoint` usa multiplicidad de raíces y desarrollo de Taylor, pero para polinomios lineales el signo del denominador cerca del punto debería ser determinista. El evaluador numérico ve "oscila" porque las muestras no son monótonas (ruido de punto flotante cerca de la singularidad).

#### 1.3 `cero-cero-ruffini`: Excepción "Cannot convert und to a BigInt"
- **Causa**: En `engine.js:2332-2375`, la generación de raíces `ra` usa `rand.int(-4, 4)` y `rand.nonzero(3)`. El problema está en `Poly.lin(1, -r1)` etc. donde `r1` puede ser un `number` en lugar de `Q`, y en alguna operación interna se recibe `undefined`.
- **Rastro**: `Q()` en línea 68 recibe `undefined` → `decimalToRatio` → `toBig` → error.

#### 1.4 `sen-x-partido-x` (caso v=2): `(1-cos(kx))/(kx)²`
- **Respuesta del motor**: `1/2` (correcta teóricamente)
- **Realidad numérica**: `0.0000000` 
- **Causa**: **Cancelación catastrófica** en `1 - cos(u)` para u pequeño. En doble precisión, `cos(1e-6) ≈ 1 - 5e-13`, y `1 - cos(u)` pierde todas las cifras significativas.
- **Solución**: Usar la identidad `1 - cos(u) = 2*sin²(u/2)` en el evaluador numérico (ya implementada en `lib/eval-ast.mjs:220-233` como `rewrite()`, pero el generador construye el AST directamente sin esta reescritura).

#### 1.5 `inf-menos-inf-factor`: expresión mal formada
- **Ejemplo**: `(x²-2)/(x-1) - x³/(x²-3)` con x→∞
- **Motor**: declara `1`
- **Numérico**: "oscila signo 1"
- **Causa**: La expresión generada puede no tener el límite que el motor calcula simbólicamente (grados y coeficientes principales no coinciden con la simplificación manual en los pasos).

#### 1.6 `trozos-continua` y `trozos-parametro`: conteos negativos
- En la salida del test aparecen `-10` y `-20` casos. Esto es un **bug en `numeric-verify.mjs`** (línea 167): `n: n - excluidos` donde `excluidos` se incrementa por cada semilla de continuidad, pero `n` cuenta todas las semillas procesadas. Al restar, da negativo.

---

## 2. Excepciones en tiempo de ejecución

### 2.1 `cero-cero-ruffini` (100% de semillas)
```
EXCEPCIÓN Cannot convert und to a BigInt
```
- Ocurre en `Q()` cuando recibe `undefined`
- Probablemente en `Poly.lin(1, -r1)` donde `r1` no está bien definido, o en `factorLinear`
- El generador está en `engine.js:2325-2376`

### 2.2 `subst-elemental` (algunas semillas)
- No lanza excepción pero produce respuesta matemáticamente incorrecta (ver 1.1)

---

## 3. Datos incompletos en la hoja de teoría (`src/theory-data.js`)

Las siguientes tablas tienen **solo cabeceras**, sin filas de datos:

| Tabla ID | Título | Filas actuales |
|----------|--------|----------------|
| `tabla-potenciales` | Límites de las funciones potenciales xⁿ | 1 fila (solo `n < 0`) |
| `tabla-exponenciales` | Límites de las funciones exponenciales aˣ | 1 fila (solo `a < 0`) |
| `tabla-logaritmicas` | Límites de la función logarítmica logₐ x | 4 filas (incompletas) |
| `tabla-operaciones-continuas` | Operaciones con funciones continuas | 1 fila (solo `fⁿ, ⁿ√f`) |
| `tabla-sustitucion-directa` | Sustitución directa: cuatro ejemplos | 1 fila (solo un ejemplo) |

Estas tablas se referencian en las secciones de teoría pero no muestran contenido útil al alumno.

---

## 4. Problemas en la infraestructura de tests

### 4.1 `tests/engine.test.mjs`: **Timeout sistemático**
- La suite de tests no termina (se cuelga en el event loop)
- Probablemente por bucles infinitos en algún generador (mismo problema que resuelve `verify-run.mjs` con procesos hijos)
- Los tests unitarios de `Q`, `Poly`, `ast`, `limit`, `rng` deberían ser rápidos; el problema está en los tests de generadores (líneas 437-505) que iteran 23 generadores × 6 semillas = 138 generaciones completas

### 4.2 `tests/numeric-verify.mjs`: Conteo negativo para continuidad
- Línea 167: `filas.push({ id, n: n - excluidos, ... })` donde `excluidos` se incrementa dentro del bucle de semillas pero `n` cuenta iteraciones totales
- Fix: `n: n - exc` donde `exc` es el contador local de excepciones, no `excluidos`

### 4.3 Falta `tests/smoke.mjs`
- Referenciado en `README.md` línea 271 pero no existe en el filesystem

---

## 5. Problemas menores / deuda técnica

### 5.1 Generador `subst-directa`: desperdicio de semillas
- 9 de 10 semillas se descartan porque `den.eval(at).isZero()` (línea 1332-1333)
- El bucle `while` en línea 1332-1333 puede no terminar si `m*a+b` siempre da 0
- Debería generar denominadores que **garantícen** no anularse en `at`

### 5.2 `lateral-dne`: quiz kind "porque" no estándar
- El contrato §6 define `quiz.kind` como `"metodo" | "indeterminacion" | "porque"`
- `lateral-dne` usa `"porque"` (línea 1645) que es válido pero el test `engine.test.mjs:680-685` lo verifica específicamente

### 5.3 `asintote-vertical`: typo en `statement.kind`
- Línea 1754: `kind: "asyptote"` → debería ser `"asymptote"` o `"asintota"` (consistente con `inf-horizontal` línea 2093)

### 5.4 `cero-cero-comun`: method "restar" para 0/0
- Línea 2383: `method: "restar"` pero el problema es factorización/cancelación de factor común
- Debería ser `"factorizar"` según el contrato §7

### 5.5 `build.mjs`: sin validación de sintaxis
- Concatena archivos sin verificar que el JS resultante sea válido
- Si `engine.js` tiene un error de sintaxis, `index.html` se genera igualmente

---

## 6. Archivos afectados y cambios sugeridos

### Prioridad ALTA (bloquean la corrección matemática)

1. **`src/engine.js`** — Corregir generadores defectuosos:
   - `subst-elemental` caso v=6: cambiar respuesta de `Q.ONE` a `Q.ZERO`
   - `lateral-signo`: revisar lógica de signo en `limit.atPoint` para polinomios lineales
   - `cero-cero-ruffini`: depurar excepción "Cannot convert und to a BigInt"
   - `sen-x-partido-x` caso v=2: asegurar que el AST use `1-cos(u) = 2*sin²(u/2)` o documentar que la verificación numérica necesita reescritura
   - `inf-menos-inf-factor`: validar que la expresión generada coincida con el límite calculado
   - `asintote-vertical`: corregir typo `"asyptote"` → `"asintota"`

2. **`src/theory-data.js`** — Completar tablas vacías:
   - `tabla-potenciales`, `tabla-exponenciales`, `tabla-logaritmicas`, `tabla-operaciones-continuas`, `tabla-sustitucion-directa`

### Prioridad MEDIA (infraestructura)

3. **`tests/engine.test.mjs`** — Dividir en tests rápidos (unitarios) y lentos (generadores con timeout)
4. **`tests/numeric-verify.mjs`** — Fix conteo negativo para continuidad (línea 167)
5. **`tests/lib/verify-run.mjs`** — Úsalo para ejecutar tests de generadores con timeout por proceso

### Prioridad BAJA (calidad)

6. **`build.mjs`** — Añadir validación sintáctica del JS generado
7. **`README.md`** — Eliminar referencia a `tests/smoke.mjs` inexistente o crearlo
8. **`src/engine.js`** — `cero-cero-comun`: cambiar `method: "restar"` a `"factorizar"`

---

## 7. Cómo reproducir los problemas

```bash
# Verificación numérica rápida (10 semillas/generador)
node tests/numeric-verify.mjs 10

# Verificar un generador específico
node -e "
const Lim = require('./src/engine.js');
const p = Lim.generate({seed: 15290434, generatorIds: ['subst-elemental']});
console.log('Expr:', Lim.ast.toPlain(p.statement.expr));
console.log('Target:', p.statement.target);
console.log('Answer:', Lim.answerToString(p.answer));
"

# Ver excepción en cero-cero-ruffini
node -e "
const Lim = require('./src/engine.js');
try {
  const p = Lim.generate({seed: 4, generatorIds: ['cero-cero-ruffini']});
  console.log(p);
} catch(e) { console.error(e.message); }
"
```

---

## 8. Notas para Space Bunny

- El motor usa **aritmética exacta sobre BigInt** para racionales (correcto)
- El renderizado es **MathML nativo** sin dependencias (correcto)
- La arquitectura **single-file HTML** con `build.mjs` es limpia
- El **cuaderno de errores** guarda solo semillas (buen diseño)
- **Los tests E2E en `tests/e2e.html`** son completos y valiosos (política examen, persistencia, etc.)

**Bloqueador principal**: La fiabilidad matemática de 4-5 generadores. Una vez corregidos, el proyecto es sólido para su propósito pedagógico.

---

*Generado automáticamente por revisión de código. No editar a mano — regenerar tras correcciones.*