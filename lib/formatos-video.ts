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
};

export const FORMATOS: Formato[] = [
  {
    key: 'talking',
    icono: '🎤',
    nombre: 'A cámara',
    cuando: 'Tu opinión, una idea, una enseñanza. El más rápido de todos.',
    comoSeGraba: 'Vos hablando al teléfono. Nada más.',
    dificultad: 1,
    salida: 'hablado',
    receta: `Gancho de 1-2 frases que frene el dedo · desarrollo de máximo 3 ideas,
una por frase corta · cierre con UNA sola acción.
Todo va HABLADO, de corrido, como si se lo contaras a un amigo.`,
    ejemplo: '"Dejá de cobrar por hora. Te explico por qué te está costando plata."',
  },
  {
    key: 'ranking',
    icono: '🔢',
    nombre: 'Ranking / Lista',
    cuando: 'Cuando tenés varias cosas que enseñar. Fácil de consumir y de guardar.',
    comoSeGraba: 'Vos hablando + un número grande en pantalla por cada punto.',
    dificultad: 1,
    salida: 'pantalla',
    receta: `Título que promete el número exacto ("5 X que…") · luego CADA punto con:
una línea corta para leer en pantalla (máximo 8 palabras) y una o dos frases
habladas que la explican · cierre pidiendo guardar.
El punto más fuerte va PRIMERO, no último: en 3 segundos se van.`,
    ejemplo: '"5 negocios que arrancás con menos de $500. Número uno…"',
  },
  {
    key: 'vs',
    icono: '⚔️',
    nombre: 'VS — dos personajes',
    cuando: 'Para marcar un contraste fuerte. De los más virales que hay.',
    comoSeGraba: 'Vos hacés los dos personajes: cambiás de lado y de gesto.',
    dificultad: 3,
    salida: 'columnas',
    receta: `Dos personajes enfrentados, con nombre claro (ej. "El que cobra por hora"
vs "El que cobra por resultado"). CADA línea de A tiene su espejo exacto en B,
mismo tema y misma longitud. Entre 4 y 6 pares. Sin narrador.
El remate lo dice el personaje que gana, sin moraleja explicada.`,
    ejemplo: '"El empleado: necesito que me aprueben. — El dueño: necesito que funcione."',
  },
  {
    key: 'pov',
    icono: '🎭',
    nombre: 'POV — una escena',
    cuando: 'Para que se vean reflejados. No explica: hace sentir.',
    comoSeGraba: 'Actuás una escena. La cámara es los ojos de alguien.',
    dificultad: 3,
    salida: 'escena',
    receta: `NO lleva gancho: entrás en medio de la acción, ya empezada.
Arriba va un texto tipo "POV: …" que ubica al espectador en 8 palabras.
Después, la escena: qué se dice y qué se hace, en presente.
Máximo 6 momentos. Nadie explica nada. El final es un golpe, no una conclusión.`,
    ejemplo: '"POV: tu cliente te pide descuento por quinta vez."',
  },
  {
    key: 'podcast',
    icono: '🎙️',
    nombre: 'Clip de podcast',
    cuando: 'Da autoridad. Parece un pedazo de algo más grande.',
    comoSeGraba: 'Vos hablando sentado, como respondiendo. Subtítulos grandes.',
    dificultad: 2,
    salida: 'respuesta',
    receta: `Se escribe LA RESPUESTA, no la pregunta. La pregunta va SOLO como texto
arriba, corta y filosa. La respuesta arranca a mitad de idea ("…y eso es lo que
nadie te dice") para que parezca un recorte.
Sin saludo, sin presentación, sin cierre de despedida.`,
    ejemplo: 'En pantalla: "¿Cuánto deberías cobrar?" — Hablado: "Mirá, el error es…"',
  },
  {
    key: 'broll',
    icono: '🎞️',
    nombre: 'B-roll + texto',
    cuando: 'Cuando no querés salir en cámara. El más fácil de producir.',
    comoSeGraba: 'Imágenes de archivo + tu voz en off + texto en pantalla.',
    dificultad: 2,
    salida: 'pantalla',
    receta: `Cada bloque lleva TRES cosas separadas: qué se ESCUCHA (voz en off),
qué se LEE en pantalla (máximo 6 palabras, nunca lo mismo que se escucha) y
qué IMAGEN va detrás (concreta y fácil de conseguir).
El texto en pantalla remata lo que dice la voz, no lo repite.`,
    ejemplo: 'Voz: "nadie empieza con plata" · Pantalla: "0 pesos." · Imagen: billetera vacía',
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
