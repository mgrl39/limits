/* =====================================================================
 * src/i18n.js — núcleo bilingüe (es ⇄ ca) de toda la interfaz.
 * ---------------------------------------------------------------------
 * Expone:  window.I18N
 *
 *   I18N.escenas          ["es", "ca"]          — los dos idiomas
 *   I18N.REVISION         "2026-10-12"          — fecha del diccionario
 *   I18N.pares()          232                   — pares ES/CA del diccionario
 *   I18N.actual()         "es" | "ca"           — idioma en uso
 *   I18N.fijar(lang)      cambia y guarda en localStorage["limites:lang"]
 *   I18N.t(clave, vars)   traduce; si falta la clave devuelve la clave
 *   I18N.fn(n, sing, plur) pluralización es/ca
 *   I18N.recargar()       vuelve a pintar la página actual preservando la URL
 *
 * Auxiliares (los usan ui-core.js y las páginas):
 *   I18N.nombreMetodo(id) los 13 métodos de Lim.METHODS
 *   I18N.nombreTopico(id) los 4 tópicos de Lim.TOPICS
 *   I18N.nombreNivel(id)  los 10 niveles de Lim.LEVELS
 *   I18N.titulo(txt)      «Juego»/«Teoría»… en el idioma activo (los .html
 *                         passesan el título en el script en línea)
 *   I18N.on(fn) / I18N.aviso()  evento `i18n:cambio` para repintar
 *
 * --- QUÉ SE TRADUCE Y QUÉ NO -----------------------------------------
 * Se traduce la INTERFAZ y la REDACCIÓN: botones, menús, títulos, mensajes
 * de retroalimentación, nombres de método, avisos, explanatory texts.
 * NO se tocan las MATEMÁTICAS: los símbolos, las unidades y las fórmulas
 * se dejan tal cual (`∫`, `→`, `∞`, `√`, `±`, `≤`…).
 *
 * Única excepción: la GRAFÍA del seno y de la tangente, que es distinta
 * en cada idioma. Español `sen` / `tg` (es lo que usa el PDF de Marea
 * Verde), catalán `sin` / `tg` / `arctan`. Ver el grupo `mat.*`.
 *
 * --- ORDEN DE CARGA ---------------------------------------------------
 *   engine.js → i18n.js → ui-core.js → pagina-*.js
 * i18n.js ANTES de ui-core.js porque ui-core pinta textos al arrancar.
 * Si se carga al revés, la cabecera sale con las claves en crudo.
 *
 * --- ROBUSTEZ ---------------------------------------------------------
 * · localStorage puede estar bloqueado (modo privado, iframe, file://):
 *   todo el acceso va en try/catch y se degrada a español sin lanzar.
 * · Clave ausente → se devuelve la propia clave (nunca «undefined»).
 * · Clave presente sólo en español → cae al español antes que a la clave.
 * ===================================================================== */
(function (global) {
  "use strict";

  /* ---------- constantes --------------------------------------------- */

  var CLAVE = "limites:lang";     // localStorage["limites:lang"]
  var DEFECTO = "es";             // si todo falla, español
  var ESCENAS = ["es", "ca"];
  var REVISION = "2026-10-12";
  var EVENTO = "i18n:cambio";

  /* Los 13 métodos del motor (Lim.METHODS), en el mismo orden. */
  var METODOS = [
    "sustitucion", "denominador", "lateral", "dominantePolinomio",
    "jerarquia", "grados", "factorizar", "racionalizar",
    "restar", "transformar", "numeroE", "notable", "continuidad"
  ];

  /* Títulos que pasan los .html en línea: UI.montar("juego", "Juego", …) */
  var TITULOS = {
    "Inicio": "nav.inicio",
    "Campaña": "nav.campana",
    "Juego": "nav.juego",
    "Cuaderno": "nav.cuaderno",
    "Teoría": "nav.teoria"
  };

  /* =====================================================================
   * DICCIONARIO — 232 pares ES/CA.
   * Claves con punto y minúsculas, agrupadas por pantalla:
   *   nav.*  app.*  cab.*  ajustes.*  ui.*  idioma.*
   *   juego.* (pantalla de juego, la usa pagina-juego.js)
   *   metodo.* tema.* nivel.* (vocabulario de Lim.METHODS/TOPICS/LEVELS)
   *   term.*  (palabras que cambian de forma es→ca)
   *   mat.*   (grafías: sen/sin, tg, arctan…)
   * ===================================================================== */
  var DICC = {
    /* ---------------------------------------------------------------- */
    es: {
      /* --- navegación y marco --------------------------------------- */
      "nav.inicio": "Inicio",
      "nav.campana": "Campaña",
      "nav.juego": "Juego",
      "nav.cuaderno": "Cuaderno",
      "nav.teoria": "Teoría",
      "nav.secciones": "Secciones",

      "app.marca": "Límites",
      "app.pie": "Límites y continuidad · 2º de Bachillerato",
      "app.borrar": "Borrar progreso",
      "app.borrarConfirm": "¿Borrar todo el progreso (racha, campaña y cuaderno)?",

      "cab.racha": "Racha",
      "cab.xp": "Puntos de experiencia",

      /* --- interruptor de idioma ------------------------------------ */
      "idioma.titulo": "Idioma",
      "idioma.es": "Español",
      "idioma.ca": "Català",

      /* --- panel de ajustes ------------------------------------------ */
      "ajustes.titulo.modo": "Cómo respondo — modo",
      "ajustes.titulo.politica": "Cuándo veo las opciones — política",
      "ajustes.modo.escribir.nombre": "escribir",
      "ajustes.modo.opciones.nombre": "opciones",
      "ajustes.modo.mixto.nombre": "mixto",
      "ajustes.modo.escribir.sub": "Solo escribes la respuesta",
      "ajustes.modo.opciones.sub": "Solo eliges entre 4",
      "ajustes.modo.mixto.sub": "Alterna al azar",
      "ajustes.politica.visible.nombre": "visible",
      "ajustes.politica.boton.nombre": "botón",
      "ajustes.politica.examen.nombre": "examen",
      "ajustes.politica.visible.sub": "Siempre a la vista",
      "ajustes.politica.boton.sub": "A pedido",
      "ajustes.politica.examen.sub": "Tras un intento",
      "ajustes.aviso.mixto": "Cada problema elige al azar entre escribir y elegir. La política se aplica al tipo que toque en ese problema.",
      "ajustes.aviso.escribir.visible": "Escribes tú. Las opciones no se muestran en absoluto.",
      "ajustes.aviso.escribir.boton": "Escribes tú. Puedes pedir ver las opciones como pista.",
      "ajustes.aviso.escribir.examen": "Escribes tú, sin opciones. Es el modo examen.",
      "ajustes.aviso.opciones.visible": "Eliges entre 4 opciones, visibles desde el principio.",
      "ajustes.aviso.opciones.boton": "Las opciones están ocultas hasta que pidas verlas.",
      "ajustes.aviso.opciones.examen": "Primero escribes y compruebas. Si fallas, las opciones quedan bloqueadas para siempre.",

      /* --- utilidades de texto (plural, «hace X») ------------------- */
      "ui.ahora": "ahora mismo",
      "ui.hace": "hace {n} {u}",
      "ui.meses": "meses",
      "ui.un.min": "min",
      "ui.un.hora": "h",
      "ui.un.dia": "d",
      "ui.un.min.largo": "minuto",
      "ui.un.hora.largo": "hora",
      "ui.un.dia.largo": "día",
      "ui.error": "No se ha podido pintar la página.",

      /* --- pantalla de juego (pagina-juego.js) ---------------------- */
      "juego.how.fallo": "fallo",
      "juego.how.metodo": "fallo de método",
      "juego.how.saltado": "saltado",
      "juego.how.solucion": "visto solución",
      "juego.how.ayudado": "ayudado",
      "juego.how.acierto": "acierto",
      "juego.modo.escribiendo": "escribiendo",
      "juego.modo.eligiendo": "eligiendo",
      "juego.modo.mixto": "mixto",
      "juego.resp.si": "Sí",
      "juego.resp.no": "No",
      "juego.resp.noexiste": "no existe",

      "juego.feedback.ok.titulo": "¡Correcto!",
      "juego.feedback.ok.detalle": "Has acertado el valor del límite.",
      "juego.feedback.mal.titulo": "No es correcto",
      "juego.feedback.mal.opcion": "Esa opción no es",
      "juego.feedback.mal.reintento": "Vuelve a intentarlo o mira la solución.",
      "juego.feedback.mal.echo": "Entendí «{v}» como respuesta. Inténtalo otra vez o mira la solución.",
      "juego.feedback.noentiendo": "No entiendo esa respuesta",
      "juego.feedback.escrito": "Has escrito: {v}",

      "juego.quiz.chip": "Interrogatorio",
      "juego.quiz.chipFallado": "has fallado una vez",
      "juego.quiz.pregunta": "¿Qué técnica hay que aplicar?",
      "juego.quiz.metodoOk": "¡Método correcto!",
      "juego.quiz.metodoOk.detalle": "Has identificado la técnica adecuada.",
      "juego.quiz.metodoMal": "Fallo de método",
      "juego.quiz.metodoMal.detalle": "Ese no es el procedimiento que toca aquí.",
      "juego.quiz.porque": "Por qué: ",
      "juego.quiz.revisa": "Revisa la solución paso a paso.",
      "juego.quiz.segunda": "Has acertado, pero a la segunda. ",
      "juego.quiz.anotado": "El método se anota como fallado: queda en el cuaderno.",
      "juego.quiz.reintentar": "Reintentar método",
      "juego.quiz.verSolucion": "Ver solución",
      "juego.quiz.siguiente": "Siguiente problema →",
      "juego.quiz.metodoPrefijo": "Método: ",
      "juego.quiz.aria": "Opciones de método",

      "juego.dif.sustitucion": "sustitución",
      "juego.dif.facil": "fácil",
      "juego.dif.media": "media",
      "juego.dif.dificil": "difícil",
      "juego.dif.muyDificil": "muy difícil",
      "juego.dif.titulo": "Dificultad {n} de 5",

      "juego.partida.libre": "Práctica libre",
      "juego.partida.marcador": "{ok}/{req} nº · {met}/{req} método",

      "juego.prob.nivel": "Nivel {n} · {name}",
      "juego.prob.cuaderno": "Cuaderno",
      "juego.prob.libre": "Libre",
      "juego.prob.enunciado": "Calcula el siguiente límite:",
      "juego.prob.continua": "¿Es f continua en ese punto?",
      "juego.prob.objetivo": "Objetivo",
      "juego.prob.cabeceraAria": "Tu respuesta",

      "juego.examen.aviso": "Modo examen: escribe primero el valor del límite. Si aciertas, las opciones no hacen falta.",
      "juego.input.phOpciones": "Escribe el valor y comprueba",
      "juego.input.phLibre": "Escribe el valor (3/4, +inf, dne…)",
      "juego.comprobar": "Comprobar",
      "juego.seAcepta": "Se acepta ",
      "juego.opciones.aria": "Opciones de respuesta",

      "juego.opciones.visibles": "Opciones visibles",
      "juego.opciones.bloqueadas": "Opciones bloqueadas: ya fallaste",
      "juego.opciones.boton": "🔢 Ver opciones",
      "juego.opciones.tituloIntento": "Primero escribe y comprueba una respuesta",
      "juego.opciones.tituloRevelar": "Revelar las cuatro opciones",
      "juego.solucion.boton": "👁 Ver solución",
      "juego.solucion.tituloExamen": "En modo examen necesitas comprobar una respuesta primero",
      "juego.solucion.titulo": "Ver la solución paso a paso",
      "juego.saltar": "⏭ Saltar",
      "juego.herramientas.titulo": "Ajustes de modo y política",
      "juego.herramientas.aria": "Ajustes",

      "juego.sol.titulo": "Solución paso a paso",
      "juego.sol.sub": "Léela antes de volver a intentarlo.",
      "juego.sol.ocultar": "Ocultar",
      "juego.sol.clave": "clave",
      "juego.sol.respuesta": "Respuesta correcta: ",
      "juego.sol.paso": "Paso {n}",

      "juego.bienv.titulo": "Juego",
      "juego.bienv.sub": "Elige nivel y practica 10 problemas. Cada acierto incluye un interrogatorio de método; lo que no te salga entra en el cuaderno.",
      "juego.bienv.sinNiveles": "El motor no ha cargado: no hay niveles disponibles.",
      "juego.bienv.empezar": "Empezar",
      "juego.bienv.cuaderno": "Practicar el cuaderno ({n})",
      "juego.bienv.campana": "Campaña",
      "juego.bienv.inicio": "Inicio",
      "juego.bienv.resueltos": "resueltos",
      "juego.bienv.perfectos": "perfectos",
      "juego.bienv.racha": "racha",
      "juego.bienv.tituloNivel": "Nivel {n}: {name}",
      "juego.bienv.marca": "{best}/{total} núm.",
      "juego.bienv.problemas": "{total} problemas",

      "juego.res.estrellas": "{n} de 3 estrellas",
      "juego.res.superado": "¡Nivel superado!",
      "juego.res.terminada": "Partida terminada",
      "juego.res.superado.sub": "Has superado el nivel. Se ha desbloqueado el siguiente.",
      "juego.res.faltan": "Te faltan {n} aciertos de número y {n} de método.",
      "juego.res.repasa": "Repasa el cuaderno y vuelve a intentarlo: ahora sabes dónde fallaste.",
      "juego.res.numero": "número",
      "juego.res.metodo": "método",
      "juego.res.xp": "XP ganados",
      "juego.res.tablaTopico": "Tópico",
      "juego.res.tablaNumero": "Número",
      "juego.res.mejorMarca": "Mejor marca del nivel: {num}/{total} en número y {met}/{total} en método ({stars}★).",
      "juego.res.ultimo": "Último problema: {v}",
      "juego.res.siguienteNivel": "Siguiente nivel →",
      "juego.res.otra": "Otra vez",
      "juego.res.practicarCuaderno": "Practicar el cuaderno",
      "juego.res.inicio": "Inicio",
      "juego.res.campana": "¡Campaña completada! Has superado los diez niveles. Ahora a por la matrícula de honor.",
      "juego.repaso.chip": "Repaso de un fallo tuyo",
      "juego.repaso.aviso": "Si lo fallas otra vez, se rompe la racha.",
      "juego.vacio.titulo": "No hay ningún problema activo",
      "juego.vacio.sub": "Empieza una partida nueva.",
      "juego.vacio.boton": "Volver al inicio",

      /* --- los 13 métodos de Lim.METHODS (nombre + descripción) ------- */
      "metodo.sustitucion": "Sustitución directa",
      "metodo.sustitucion.desc": "Se sustituye y ya está.",
      "metodo.denominador": "Denominador anulado",
      "metodo.denominador.desc": "Se anula el denominador: hay que mirar el signo y los lados.",
      "metodo.lateral": "Límites laterales",
      "metodo.lateral.desc": "Se estudia por izquierda y por derecha por separado.",
      "metodo.dominantePolinomio": "Término dominante (polinomio)",
      "metodo.dominantePolinomio.desc": "En un polinomio manda el término de mayor grado.",
      "metodo.jerarquia": "Jerarquía de crecimiento",
      "metodo.jerarquia.desc": "Exponencial > Polinómica > Logarítmica > Constante.",
      "metodo.grados": "Comparar grados",
      "metodo.grados.desc": "Se divide numerador y denominador entre x elevado al grado mayor.",
      "metodo.factorizar": "Factorizar y simplificar",
      "metodo.factorizar.desc": "Indeterminación 0/0: se factoriza y se cancela el factor común.",
      "metodo.racionalizar": "Racionalizar",
      "metodo.racionalizar.desc": "Se multiplica por el conjugado para quitar la raíz del denominador.",
      "metodo.restar": "Desarrollar la resta",
      "metodo.restar.desc": "Indeterminación ∞−∞ en cocientes: común denominador y término dominante.",
      "metodo.transformar": "Transformar a otra forma",
      "metodo.transformar.desc": "0·∞ se pasa a 0/0 o a ∞/∞.",
      "metodo.numeroE": "Fórmula del número e",
      "metodo.numeroE.desc": "1^∞ se resuelve con la fórmula de la e.",
      "metodo.notable": "Límite notable",
      "metodo.notable.desc": "Se usa un límite conocido, como sen x / x = 1.",
      "metodo.continuidad": "Las tres condiciones",
      "metodo.continuidad.desc": "f definida, límite existente y límite = f(a).",

      /* --- tópicos y niveles del motor ------------------------------- */
      "tema.sustitucion": "Sustitución y laterales",
      "tema.infinito": "Límites en el infinito",
      "tema.indeterminacion": "Indeterminaciones",
      "tema.continuidad": "Continuidad",

      "nivel.sustituir": "Sustituir",
      "nivel.elementos": "Elementos",
      "nivel.laterales": "Laterales",
      "nivel.asintotas": "Asíntotas",
      "nivel.polinomios": "Polinomios en el infinito",
      "nivel.grados": "Comparar grados",
      "nivel.restas": "Restas de infinitos",
      "nivel.factores": "Factorizar",
      "nivel.transformar": "Transformar",
      "nivel.continuidad": "Continuidad",

      /* --- palabras que cambian de forma (es → ca) ------------------- */
      "term.limite": "límite",
      "term.limites": "límites",
      "term.continuidad": "continuidad",
      "term.funcion": "función",
      "term.funciones": "funciones",
      "term.lateral": "lateral",
      "term.laterales": "laterales",
      "term.indeterminacion": "indeterminación",
      "term.indeterminaciones": "indeterminaciones",
      "term.sustitucion": "sustitución",
      "term.racionalizar": "racionalizar",
      "term.asintota": "asíntota",
      "term.asintotas": "asíntotas",
      "term.dominio": "dominio",
      "term.creciente": "creciente",
      "term.prueba": "prueba",
      "term.pruebas": "pruebas",
      "term.respuesta": "respuesta",
      "term.respuestas": "respuestas",
      /* vocabulario propio de la asignatura en catalán */
      "term.arrel": "raíz",
      "term.arrels": "raíces",
      "term.demostrar": "demuestra",
      "term.demostrar.notas": "demuestra",
      "term.continua": "continua",
      "term.familia": "familia de funciones",
      "term.crecimiento": "sentido del crecimiento",
      "term.trabajo": "trabajo",

      /* --- grafías: aquí SÍ cambian, no son matemáticas puras ----- */
      "mat.sen": "sen",
      "mat.tg": "tg",
      "mat.arctan": "arctan",
      "mat.lim": "lim",
      "mat.log": "log",
      "mat.dne": "no existe",
      "mat.infinito": "infinito",
      "mat.seno": "seno",
      "mat.tangente": "tangente"
    },

    /* ---------------------------------------------------------------- */
    ca: {
      /* --- navegación y marco --------------------------------------- */
      "nav.inicio": "Inici",
      "nav.campana": "Campanya",
      "nav.juego": "Joc",
      "nav.cuaderno": "Quadern",
      "nav.teoria": "Teoria",
      "nav.secciones": "Seccions",

      "app.marca": "Límits",
      "app.pie": "Límits i continuitat · 2n de Batxillerat",
      "app.borrar": "Esborrar el progrés",
      "app.borrarConfirm": "Voleu esborrar tot el progrés (ràtxa, campanya i quadern)?",

      "cab.racha": "Ràtxa",
      "cab.xp": "Punts d'experiència",

      /* --- interruptor de idioma ------------------------------------ */
      "idioma.titulo": "Idioma",
      "idioma.es": "Español",
      "idioma.ca": "Català",

      /* --- panel de ajustes ------------------------------------------ */
      "ajustes.titulo.modo": "Com responc — mode",
      "ajustes.titulo.politica": "Quan veig les opcions — política",
      "ajustes.modo.escribir.nombre": "escriure",
      "ajustes.modo.opciones.nombre": "opcions",
      "ajustes.modo.mixto.nombre": "mixt",
      "ajustes.modo.escribir.sub": "Només escrius la resposta",
      "ajustes.modo.opciones.sub": "Només tries entre 4",
      "ajustes.modo.mixto.sub": "Alterna a l'atzar",
      "ajustes.politica.visible.nombre": "visible",
      "ajustes.politica.boton.nombre": "botó",
      "ajustes.politica.examen.nombre": "examen",
      "ajustes.politica.visible.sub": "Sempre a la vista",
      "ajustes.politica.boton.sub": "A petició",
      "ajustes.politica.examen.sub": "Després d'un intent",
      "ajustes.aviso.mixto": "Cada problema tria a l'atzar entre escriure i triar. La política s'aplica al tipus que toqui en aquell problema.",
      "ajustes.aviso.escribir.visible": "Escrius tu. Les opcions no es mostren en absolut.",
      "ajustes.aviso.escribir.boton": "Escrius tu. Pots demanar veure les opcions com a pista.",
      "ajustes.aviso.escribir.examen": "Escrius tu, sense opcions. És el mode examen.",
      "ajustes.aviso.opciones.visible": "Tries entre 4 opcions, visibles des del principi.",
      "ajustes.aviso.opciones.boton": "Les opcions estan amagades fins que en demanis veure-les.",
      "ajustes.aviso.opciones.examen": "Primer escrius i comproves. Si fallen, les opcions queden bloquejades per sempre.",

      /* --- utilidades de texto (plural, «fa X») --------------------- */
      "ui.ahora": "ara mateix",
      "ui.hace": "fa {n} {u}",
      "ui.meses": "mesos",
      "ui.un.min": "min",
      "ui.un.hora": "h",
      "ui.un.dia": "d",
      "ui.un.min.largo": "minut",
      "ui.un.hora.largo": "hora",
      "ui.un.dia.largo": "dia",
      "ui.error": "No s'ha pogut pintar la pàgina.",

      /* --- pantalla de juego (pagina-juego.js) ---------------------- */
      "juego.how.fallo": "fall",
      "juego.how.metodo": "fall de mètode",
      "juego.how.saltado": "saltat",
      "juego.how.solucion": "solució vista",
      "juego.how.ayudado": "ajudat",
      "juego.how.acierto": "encert",
      "juego.modo.escribiendo": "escrivint",
      "juego.modo.eligiendo": "escollint",
      "juego.modo.mixto": "mixt",
      "juego.resp.si": "Sí",
      "juego.resp.no": "No",
      "juego.resp.noexiste": "no existeix",

      "juego.feedback.ok.titulo": "Correcte!",
      "juego.feedback.ok.detalle": "Has encertat el valor del límit.",
      "juego.feedback.mal.titulo": "No és correcte",
      "juego.feedback.mal.opcion": "Aquesta opció no és",
      "juego.feedback.mal.reintento": "Torna-ho a provar o mira la solució.",
      "juego.feedback.mal.echo": "He entès «{v}» com a resposta. Torna-ho a provar o mira la solució.",
      "juego.feedback.noentiendo": "No entenc aquesta resposta",
      "juego.feedback.escrito": "Has escrit: {v}",

      "juego.quiz.chip": "Interrogatori",
      "juego.quiz.chipFallado": "has fallat una vegada",
      "juego.quiz.pregunta": "Quina tècnica s'ha d'aplicar?",
      "juego.quiz.metodoOk": "Mètode correcte!",
      "juego.quiz.metodoOk.detalle": "Has identificat la tècnica adequada.",
      "juego.quiz.metodoMal": "Fall de mètode",
      "juego.quiz.metodoMal.detalle": "Aquest no és el procediment que toca aquí.",
      "juego.quiz.porque": "Per què: ",
      "juego.quiz.revisa": "Repassa la solució pas a pas.",
      "juego.quiz.segunda": "Has encertat, però a la segona. ",
      "juego.quiz.anotado": "El mètode s'anota com a fallat: queda al quadern.",
      "juego.quiz.reintentar": "Tornar a intentar el mètode",
      "juego.quiz.verSolucion": "Veure la solució",
      "juego.quiz.siguiente": "Problema següent →",
      "juego.quiz.metodoPrefijo": "Mètode: ",
      "juego.quiz.aria": "Opcions de mètode",

      "juego.dif.sustitucion": "substitució",
      "juego.dif.facil": "fàcil",
      "juego.dif.media": "mitjana",
      "juego.dif.dificil": "difícil",
      "juego.dif.muyDificil": "molt difícil",
      "juego.dif.titulo": "Dificultat {n} de 5",

      "juego.partida.libre": "Pràctica lliure",
      "juego.partida.marcador": "{ok}/{req} nº · {met}/{req} mètode",

      "juego.prob.nivel": "Nivell {n} · {name}",
      "juego.prob.cuaderno": "Quadern",
      "juego.prob.libre": "Lliure",
      "juego.prob.enunciado": "Calcula el límit següent:",
      "juego.prob.continua": "És f contínua en aquell punt?",
      "juego.prob.objetivo": "Objectiu",
      "juego.prob.cabeceraAria": "La teva resposta",

      "juego.examen.aviso": "Mode examen: escriu primer el valor del límit. Si encertes, les opcions no calen.",
      "juego.input.phOpciones": "Escriu el valor i comprova",
      "juego.input.phLibre": "Escriu el valor (3/4, +inf, dne…)",
      "juego.comprobar": "Comprovar",
      "juego.seAcepta": "S'accepta ",
      "juego.opciones.aria": "Opcions de resposta",

      "juego.opciones.visibles": "Opcions visibles",
      "juego.opciones.bloqueadas": "Opcions bloquejades: ja has fallat",
      "juego.opciones.boton": "🔢 Veure opcions",
      "juego.opciones.tituloIntento": "Primer escriu i comprova una resposta",
      "juego.opciones.tituloRevelar": "Mostra les quatre opcions",
      "juego.solucion.boton": "👁 Veure solució",
      "juego.solucion.tituloExamen": "En mode examen necessites comprovar una resposta primer",
      "juego.solucion.titulo": "Veure la solució pas a pas",
      "juego.saltar": "⏭ Saltar",
      "juego.herramientas.titulo": "Ajustos de mode i política",
      "juego.herramientas.aria": "Ajustos",

      "juego.sol.titulo": "Solució pas a pas",
      "juego.sol.sub": "Llegeix-la abans de tornar-ho a intentar.",
      "juego.sol.ocultar": "Amagar",
      "juego.sol.clave": "clau",
      "juego.sol.respuesta": "Resposta correcta: ",
      "juego.sol.paso": "Pas {n}",

      "juego.bienv.titulo": "Joc",
      "juego.bienv.sub": "Tria nivell i practica 10 problemes. Cada encert inclou un interrogatori de mètode; el que no surti entra al quadern.",
      "juego.bienv.sinNiveles": "El motor no ha carregat: no hi ha nivells disponibles.",
      "juego.bienv.empezar": "Començar",
      "juego.bienv.cuaderno": "Practicar el quadern ({n})",
      "juego.bienv.campana": "Campanya",
      "juego.bienv.inicio": "Inici",
      "juego.bienv.resueltos": "resolts",
      "juego.bienv.perfectos": "perfectes",
      "juego.bienv.racha": "ràtxa",
      "juego.bienv.tituloNivel": "Nivell {n}: {name}",
      "juego.bienv.marca": "{best}/{total} núm.",
      "juego.bienv.problemas": "{total} problemes",

      "juego.res.estrellas": "{n} de 3 estrells",
      "juego.res.superado": "Nivell superat!",
      "juego.res.terminada": "Partida acabada",
      "juego.res.superado.sub": "Has superat el nivell. S'ha desbloquejat el següent.",
      "juego.res.faltan": "Et falten {n} encerts de número i {n} de mètode.",
      "juego.res.repasa": "Repassa el quadern i torna-ho a provar: ara saps on has fallat.",
      "juego.res.numero": "número",
      "juego.res.metodo": "mètode",
      "juego.res.xp": "XP guanyats",
      "juego.res.tablaTopico": "Tòpic",
      "juego.res.tablaNumero": "Número",
      "juego.res.mejorMarca": "Millor marca del nivell: {num}/{total} en número i {met}/{total} en mètode ({stars}★).",
      "juego.res.ultimo": "Últim problema: {v}",
      "juego.res.siguienteNivel": "Nivell següent →",
      "juego.res.otra": "Una altra vegada",
      "juego.res.practicarCuaderno": "Practicar el quadern",
      "juego.res.inicio": "Inici",
      "juego.res.campana": "¡Campanya completada! Has superat els deu nivells. Ara a per la matrícula d'honor.",
      "juego.repaso.chip": "Repàs d'un fallo teu",
      "juego.repaso.aviso": "Si el tornes a fallar, es trenca la ràtxa.",
      "juego.vacio.titulo": "No hi ha cap problema actiu",
      "juego.vacio.sub": "Comença una partida nova.",
      "juego.vacio.boton": "Tornar a l'inici",

      /* --- los 13 métodos de Lim.METHODS (nombre + descripción) ------- */
      "metodo.sustitucion": "Substitució directa",
      "metodo.sustitucion.desc": "Es substitueix i ja està.",
      "metodo.denominador": "Denominador anul·lat",
      "metodo.denominador.desc": "S'anul·la el denominador: cal mirar el signe i els costats.",
      "metodo.lateral": "Límits laterals",
      "metodo.lateral.desc": "S'estudia per l'esquerra i per la dreta per separat.",
      "metodo.dominantePolinomio": "Termini dominant (polinomi)",
      "metodo.dominantePolinomio.desc": "En un polinomi mana el terme de grau més alt.",
      "metodo.jerarquia": "Jerarquia de creixement",
      "metodo.jerarquia.desc": "Exponencial > Polinòmica > Logarítmica > Constant.",
      "metodo.grados": "Comparar graus",
      "metodo.grados.desc": "Es divideix numerador i denominador entre x elevat al grau més alt.",
      "metodo.factorizar": "Factoritzar i simplificar",
      "metodo.factorizar.desc": "Indeterminació 0/0: es factoritza i se simplifica el factor comú.",
      "metodo.racionalizar": "Racionalitzar",
      "metodo.racionalizar.desc": "Es multiplica pel conjugat per treure l'arrel del denominador.",
      "metodo.restar": "Desenvolupar la resta",
      "metodo.restar.desc": "Indeterminació ∞−∞ en quocients: denominador comú i terme dominant.",
      "metodo.transformar": "Transformar en una altra forma",
      "metodo.transformar.desc": "0·∞ es passa a 0/0 o a ∞/∞.",
      "metodo.numeroE": "Fórmula del nombre e",
      "metodo.numeroE.desc": "1^∞ es resol amb la fórmula de l'e.",
      "metodo.notable": "Límit notable",
      "metodo.notable.desc": "S'usa un límit conegut, com ara sin x / x = 1.",
      "metodo.continuidad": "Les tres condicions",
      "metodo.continuidad.desc": "f definida, límit existent i límit = f(a).",

      /* --- tópicos y niveles del motor ------------------------------- */
      "tema.sustitucion": "Substitució i laterals",
      "tema.infinito": "Límits en l'infinit",
      "tema.indeterminacion": "Indeterminacions",
      "tema.continuidad": "Continuïtat",

      "nivel.sustituir": "Substituix",
      "nivel.elementos": "Elements",
      "nivel.laterales": "Laterals",
      "nivel.asintotas": "Asíntotes",
      "nivel.polinomios": "Polinomis en l'infinit",
      "nivel.grados": "Comparar graus",
      "nivel.restas": "Restes d'infinits",
      "nivel.factores": "Factoritzar",
      "nivel.transformar": "Transformar",
      "nivel.continuidad": "Continuïtat",

      /* --- palabras que cambian de forma (es → ca) ------------------- */
      "term.limite": "límit",
      "term.limites": "límits",
      "term.continuidad": "continuïtat",
      "term.funcion": "funció",
      "term.funciones": "funcions",
      "term.lateral": "lateral",
      "term.laterales": "laterals",
      "term.indeterminacion": "indeterminació",
      "term.indeterminaciones": "indeterminacions",
      "term.sustitucion": "substitució",
      "term.racionalizar": "racionalitzar",
      "term.asintota": "asíntota",
      "term.asintotas": "asíntotes",
      "term.dominio": "domini",
      "term.creciente": "creixent",
      "term.prueba": "prova",
      "term.pruebas": "proves",
      "term.respuesta": "resposta",
      "term.respuestas": "respostes",
      /* vocabulario propio de la asignatura en catalán */
      "term.arrel": "arrel",
      "term.arrels": "arrels",
      "term.demostrar": "demostreu",
      "term.demostrar.notas": "demostrau",
      "term.continua": "continua",
      "term.familia": "família de funcions",
      "term.crecimiento": "sentit del creixement",
      "term.trabajo": "treball",

      /* --- grafías: aquí SÍ cambian, no son matemáticas puras ----- */
      "mat.sen": "sin",
      "mat.tg": "tg",
      "mat.arctan": "arctan",
      "mat.lim": "lim",
      "mat.log": "log",
      "mat.dne": "no existeix",
      "mat.infinito": "infinint",
      "mat.seno": "sinus",
      "mat.tangente": "tangent"
    }
  };

  /* ---------- persistencia tolerante a errores ---------------------- */

  /** Devuelve el almacén, o null si localStorage está bloqueado/ausente. */
  function almacen() {
    try {
      if (global && global.localStorage) return global.localStorage;
      if (typeof localStorage !== "undefined" && localStorage) return localStorage;
    } catch (e) { /* acceso denegado: modo privado o iframe sandbox */ }
    return null;
  }

  function leerGuardado() {
    try {
      var a = almacen();
      if (!a) return null;
      return a.getItem(CLAVE);
    } catch (e) { return null; }
  }

  function guardar(lang) {
    try {
      var a = almacen();
      if (!a) return false;
      a.setItem(CLAVE, lang);
      return true;
    } catch (e) { return false; }   // modo privado, cuota llena…
  }

  /** Normaliza a "es" | "ca"; cualquier otra cosa (o null) → español. */
  function normal(lang) {
    var l = String(lang == null ? "" : lang).trim().toLowerCase();
    if (l === "ca" || l.indexOf("ca-") === 0 || l === "cat") return "ca";
    if (l === "es" || l.indexOf("es-") === 0) return "es";
    return DEFECTO;
  }

  /** Idioma del navegador, como pista. Nunca lanza. */
  function navegador() {
    try {
      if (global && global.navigator && global.navigator.language) return normal(global.navigator.language);
      if (typeof navigator !== "undefined" && navigator.language) return normal(navigator.language);
    } catch (e) { /* sin navigator */ }
    return null;
  }

  /** Idioma inicial: lo guardado → el del navegador → español. */
  function inicial() {
    var guardado = leerGuardado();
    if (guardado !== null && guardado !== undefined && String(guardado).trim() !== "") {
      return normal(guardado);
    }
    return navegador() || DEFECTO;
  }

  var lang = inicial();

  /* ---------- <html lang="…"> ---------------------------------------- */

  function aplicarLang() {
    try {
      if (typeof document === "undefined" || !document || !document.documentElement) return false;
      document.documentElement.setAttribute("lang", lang);
      if (document.title) {
        var sep = document.title.lastIndexOf(" — ");
        document.title = sep >= 0
          ? document.title.slice(0, sep + 3) + t("app.marca")
          : document.title;
      }
      return true;
    } catch (e) { return false; }
  }

  /* ---------- API ------------------------------------------------------ */

  function actual() { return lang; }

  /**
   * Fija el idioma. NO repinta: de eso se encarga `recargar()`.
   * Siempre deja el estado coherente, aunque localStorage esté bloqueado.
   */
  function fijar(nuevo) {
    lang = normal(nuevo);
    guardar(lang);
    aplicarLang();
    avisar();
    return lang;
  }

  /**
   * Traduce. `vars` sustituye los marcadores {nombre}.
   * Cadena de cambio: idioma activo → español → la propia clave.
   */
  function t(clave, vars) {
    var k = String(clave == null ? "" : clave);
    var activa = DICC[lang];
    var s;
    if (activa && activa[k] !== undefined) s = activa[k];
    else if (DICC.es[k] !== undefined) s = DICC.es[k];
    else s = k;
    if (vars && typeof vars === "object") {
      s = String(s).replace(/\{(\w+)\}/g, function (todo, nombre) {
        return vars[nombre] !== undefined && vars[nombre] !== null ? String(vars[nombre]) : todo;
      });
    }
    return s;
  }

  /** Plural es/ca: fn(1,"archivo","archivos") → "archivo". */
  function fn(n, formaSing, formaPlur) {
    var uno;
    try { uno = Number(n) === 1; } catch (e) { uno = n === 1; }
    if (uno) return formaSing;
    return (formaPlur !== undefined && formaPlur !== null && formaPlur !== "")
      ? formaPlur : (formaSing + "s");
  }

  /** Nombre traducido de uno de los 13 métodos. Si no hay clave, el del motor. */
  function nombreMetodo(id) {
    var k = "metodo." + id;
    if (DICC.es[k] !== undefined) return t(k);
    var L = global && global.Lim;
    if (L && L.METHODS && L.METHODS[id] && L.METHODS[id].name) return L.METHODS[id].name;
    return String(id == null ? "" : id);
  }

  /** Igual, para los 4 tópicos de Lim.TOPICS. */
  function nombreTopico(id) {
    var k = "tema." + id;
    if (DICC.es[k] !== undefined) return t(k);
    var L = global && global.Lim;
    if (L && L.TOPICS) {
      for (var i = 0; i < L.TOPICS.length; i++) if (L.TOPICS[i].id === id) return L.TOPICS[i].name;
    }
    return String(id == null ? "" : id);
  }

  /** Igual, para los 10 niveles de Lim.LEVELS. */
  function nombreNivel(id) {
    var k = "nivel." + id;
    if (DICC.es[k] !== undefined) return t(k);
    var L = global && global.Lim;
    if (L && L.LEVELS) {
      for (var i = 0; i < L.LEVELS.length; i++) if (L.LEVELS[i].id === id) return L.LEVELS[i].name;
    }
    return String(id == null ? "" : id);
  }

  /**
   * Traduce el título de pantalla que pasan los .html en línea
   * (`UI.montar("juego", "Juego", …)`). Si no lo conoce, lo devuelve tal cual.
   */
  function titulo(texto) {
    var s = String(texto == null ? "" : texto).trim();
    if (TITULOS[s]) return t(TITULOS[s]);
    return texto;
  }

  /** Vuelve a pintar la página actual PRESERVANDO la URL (query incluida). */
  function recargar() {
    aplicarLang();
    try {
      if (global && global.UI && typeof global.UI.remontar === "function" && global.UI.remontar()) {
        return true;
      }
    } catch (e) { /* la página no se montó con UI.montar: recargamos */ }
    try {
      if (global && global.location && typeof global.location.reload === "function") {
        global.location.reload();
        return true;
      }
    } catch (e) { /* file:// o sandbox */ }
    return false;
  }

  /* ---------- avisos a las páginas ------------------------------------ */

  var oyentes = [];

  /** Se suscribe al cambio de idioma. Devuelve la función para darse de baja. */
  function on(fn) {
    if (typeof fn !== "function") return function () { };
    oyentes.push(fn);
    return function () {
      var i = oyentes.indexOf(fn);
      if (i >= 0) oyentes.splice(i, 1);
    };
  }

  function avisar() {
    for (var i = 0; i < oyentes.length; i++) {
      try { oyentes[i](lang); } catch (e) { /* un oyente roto no rompe el cambio */ }
    }
    try {
      if (typeof document !== "undefined" && document && typeof CustomEvent === "function") {
        document.dispatchEvent(new CustomEvent(EVENTO, { detail: { lang: lang } }));
      }
    } catch (e) { /* sin CustomEvent */ }
  }

  /** Cuántos pares ES/CA hay en el diccionario (y cuáles sobran/faltan). */
  function pares() {
    var n = 0, k;
    for (k in DICC.es) if (Object.prototype.hasOwnProperty.call(DICC.es, k)) n++;
    return n;
  }

  /** Auditoría: claves que sólo existen en un idioma. Sirve para depurar. */
  function auditar() {
    var soloEs = [], soloCa = [], k;
    for (k in DICC.es) {
      if (Object.prototype.hasOwnProperty.call(DICC.es, k) && DICC.ca[k] === undefined) soloEs.push(k);
    }
    for (k in DICC.ca) {
      if (Object.prototype.hasOwnProperty.call(DICC.ca, k) && DICC.es[k] === undefined) soloCa.push(k);
    }
    return { pares: pares(), soloEs: soloEs, soloCa: soloCa };
  }

  /* ---------- publicación --------------------------------------------- */

  var I18N = {
    escenas: ESCENAS,
    METODOS: METODOS,
    CLAVE: CLAVE,
    DEFECTO: DEFECTO,
    REVISION: REVISION,
    VERSION: 1,
    actual: actual,
    fijar: fijar,
    t: t,
    fn: fn,
    recargar: recargar,
    titulo: titulo,
    nombreMetodo: nombreMetodo,
    nombreTopico: nombreTopico,
    nombreNivel: nombreNivel,
    pares: pares,
    auditar: auditar,
    on: on,
    aviso: avisar,
    aplicarLang: aplicarLang,
    DICC: DICC
  };

  global.I18N = I18N;
  if (typeof globalThis !== "undefined" && globalThis !== global) globalThis.I18N = I18N;

  /* En el navegador se pone el `lang` al cargar: así el corrector ortográfico
   * y los lectores de pantalla arrancan ya en el idioma guardado. */
  if (typeof document !== "undefined" && document) aplicarLang();
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));