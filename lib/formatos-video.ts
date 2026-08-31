// 🎬 FORMATOS DE VIDEO — el catálogo que usa /formatos.
//
// ── Por qué existe ─────────────────────────────────────────────────────────
// El generador viejo (/guiones) escribía SIEMPRE lo mismo: un párrafo de
// talking head. Por eso el 84% de lo que la gente guarda en la plataforma es
// talking head — es lo único que la herramienta les sabía dar.
//
// El formato no es cómo se filma: es CÓMO SE ESCRIBE.
//   · Un POV no tiene hook — entrás en medio de la escena.
//   · Un VS no es un texto, son dos columnas espejadas.
//   · Un clip de podcast es una RESPUESTA; la pregunta va en el texto de arriba.
//   · Un b-roll separa lo que se dice de lo que se lee en pantalla.
//
// Los porcentajes salen de analizar 205 virales guardados por los usuarios
// (agosto 2026, nicho negocios/emprendimiento/motivación).

export type Salida = 'hablado' | 'columnas' | 'escena' | 'pantalla' | 'respuesta';

export type Formato = {
  key: string;
  icono: string;
  nombre: string;
  cuando: string;        // cuándo conviene usarlo
  comoSeGraba: string;   // qué necesita la persona para grabarlo
  dificultad: 1 | 2 | 3; // 1 = lo grabás hoy · 3 = hay que actuar/editar
  salida: Salida;
  receta: string;        // el esqueleto que la IA DEBE respetar
  ejemplo: string;       // una línea de muestra, para que se entienda de un vistazo
  queRecibes: string;    // qué le llega a la persona, en criollo
  ojo: string;           // el error que arruina ESE formato
};

export const FORMATOS: Formato[] = [
  {
    key: 'talking',
    icono: '🎤',
    nombre: 'A cámara',
    cuando: 'Tu opinión, una idea, una enseñanza. El más rápido de todos.',
    comoSeGraba: 'Tú hablando al teléfono. Nada más.',
    dificultad: 1,
    salida: 'hablado',
    receta: `Gancho de 1-2 frases que frene el dedo · desarrollo de máximo 3 ideas,
una por frase corta · cierre con UNA sola acción.
Todo va HABLADO, de corrido, como si se lo contaras a un amigo.`,
    ejemplo: '"Deja de cobrar por hora. Te explico por qué te está costando dinero."',
    queRecibes: 'Un texto corrido para leer de principio a fin.',
    ojo: 'Si arrancas con "hola, soy...", ya perdiste. Empieza por lo que le sirve.',
  },
  {
    key: 'ranking',
    icono: '🔢',
    nombre: 'Ranking / Lista',
    cuando: 'Cuando tienes varias cosas que enseñar. Fácil de consumir y de guardar.',
    comoSeGraba: 'Tú hablando + un número grande en pantalla por cada punto.',
    dificultad: 1,
    salida: 'pantalla',
    receta: `Título que promete el número exacto ("5 X que…") · luego CADA punto con:
una línea corta para leer en pantalla (máximo 8 palabras) y una o dos frases
habladas que la explican · cierre pidiendo guardar.
El punto más fuerte va PRIMERO, no último: en 3 segundos se van.`,
    ejemplo: '"5 negocios que empiezas con menos de $500. Número uno…"',
    queRecibes: 'Cada punto separado: lo que dices y lo que va escrito en pantalla.',
    ojo: 'Guarda el mejor punto para el final y nadie lo ve. Va primero.',
  },
  {
    key: 'vs',
    icono: '⚔️',
    nombre: 'VS — dos personajes',
    cuando: 'Para marcar un contraste fuerte. De los más virales que hay.',
    comoSeGraba: 'Te paras debajo del cartel de cada personaje y lo interpretas. Mismo encuadre, cambias de lado.',
    dificultad: 3,
    salida: 'columnas',
    receta: `Dos personajes enfrentados, cada uno con su cartel arriba
(ej. "EL QUE COBRA POR HORA" vs "EL QUE COBRA POR RESULTADO").

⚠️ REGLA QUE NO SE ROMPE: la persona se para DEBAJO del cartel e INTERPRETA a
ese personaje. Entonces cada línea va en PRIMERA PERSONA y en presente, dicha
por el personaje. Nunca en tercera persona, nunca un narrador describiendo.
  ✅ "Me enfermo cada dos años."     ❌ "Se enfermó una vez en dos años."
  ✅ "Yo lo pienso dos días."        ❌ "Lo piensa dos días."
  ✅ "Llevo ocho lunes esperando."   ❌ "Lleva ocho lunes esperando."

CADA línea de A tiene su espejo exacto en B: mismo tema, misma longitud.
Entre 4 y 6 pares. El remate lo dice el personaje que gana, también en primera
persona, sin moraleja explicada.`,
    ejemplo: '"EL EMPLEADO: necesito que me aprueben. — EL DUEÑO: necesito que funcione."',
    queRecibes: 'Dos columnas, A y B, línea por línea enfrentadas.',
    ojo: 'Cada línea la DICE el personaje, en primera persona. Si suena a narrador ("ella compró..."), se rompe la actuación.',
  },
  {
    key: 'pov',
    icono: '🎭',
    nombre: 'POV — una escena',
    cuando: 'Para que se vean reflejados. No explica: hace sentir.',
    comoSeGraba: 'Actúas una escena. La cámara es los ojos de alguien.',
    dificultad: 3,
    salida: 'escena',
    receta: `NO lleva gancho: entras en medio de la acción, ya empezada.
Arriba va un texto tipo "POV: …" que ubica al espectador en 8 palabras.
Después, la escena: qué se dice y qué se hace, en presente.
Máximo 6 momentos. Nadie explica nada. El final es un golpe, no una conclusión.`,
    ejemplo: '"POV: tu cliente te pide descuento por quinta vez."',
    queRecibes: 'Una escena: lo que se dice y lo que se hace, momento a momento.',
    ojo: 'En cuanto explicas lo que está pasando, se rompe. Se muestra, no se cuenta.',
  },
  {
    key: 'podcast',
    icono: '🎙️',
    nombre: 'Clip de podcast',
    cuando: 'Da autoridad. Parece un pedazo de algo más grande.',
    comoSeGraba: 'Tú hablando sentado, como respondiendo. Subtítulos grandes.',
    dificultad: 2,
    salida: 'respuesta',
    receta: `Se escribe LA RESPUESTA, no la pregunta. La pregunta va SOLO como texto
arriba, corta y filosa. La respuesta arranca a mitad de idea ("…y eso es lo que
nadie te dice") para que parezca un recorte.
Sin saludo, sin presentación, sin cierre de despedida.`,
    ejemplo: 'En pantalla: "¿Cuánto deberías cobrar?" — Hablado: "Mira, el error es…"',
    queRecibes: 'La pregunta para poner arriba y la respuesta para decir.',
    ojo: 'Si saludas o te presentas, deja de parecer un recorte.',
  },
  {
    key: 'broll',
    icono: '🎞️',
    nombre: 'B-roll + texto',
    cuando: 'Cuando no quieres salir en cámara. El más fácil de producir.',
    comoSeGraba: 'Imágenes de archivo + tu voz en off + texto en pantalla.',
    dificultad: 2,
    salida: 'pantalla',
    receta: `Cada bloque lleva TRES cosas separadas: qué se ESCUCHA (voz en off),
qué se LEE en pantalla (máximo 6 palabras, nunca lo mismo que se escucha) y
qué IMAGEN va detrás (concreta y fácil de conseguir).
El texto en pantalla remata lo que dice la voz, no lo repite.`,
    ejemplo: 'Voz: "nadie empieza con dinero" · Pantalla: "0 pesos." · Imagen: billetera vacía',
    queRecibes: 'Tres columnas: qué se escucha, qué se lee y qué imagen va detrás.',
    ojo: 'Si el texto en pantalla repite lo que dices, sobra. Tiene que rematar.',
  },
];

export const getFormato = (k: string) => FORMATOS.find(f => f.key === k);

// ── Estructuras narrativas ────────────────────────────────────────────────
// El formato es CÓMO se ve. La estructura es QUÉ historia se cuenta.
// Los % son de los 205 virales analizados.
export type Estructura = { key: string; nombre: string; angulo: string; peso: string };

export const ESTRUCTURAS: Estructura[] = [
  { key: 'contra',   nombre: 'Contra la corriente', angulo: 'Todos dicen X. Es mentira, y te explico por qué.', peso: '30% de los virales del nicho' },
  { key: 'ensenar',  nombre: 'Enseñanza directa',   angulo: 'Acá va algo que te sirve. Sin vueltas.',            peso: '35% — el más común' },
  { key: 'lista',    nombre: 'Lista numerada',      angulo: 'Son N cosas y te las digo una por una.',            peso: '20%' },
  { key: 'pregunta', nombre: 'La pregunta que duele', angulo: 'Abro con el dolor exacto que esa persona siente.', peso: '11%' },
  { key: 'error',    nombre: 'El error caro',       angulo: 'Perdí tiempo o plata haciendo esto mal. No lo repitas.', peso: 'poco usado — funciona' },
  { key: 'historia', nombre: 'Historia personal',   angulo: 'Me pasó a mí. Así salí.',                            peso: 'solo 1% — el hueco más grande' },
];

export const getEstructura = (k: string) => ESTRUCTURAS.find(e => e.key === k);
