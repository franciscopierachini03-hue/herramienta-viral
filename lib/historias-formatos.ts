// 📖 FORMATOS DE HISTORIAS QUE VENDEN — el método de Francisco (secuencias de 1
// historia). Cada formato trae el ejemplo original de la clase, para que la IA
// entienda la ESTRUCTURA y la adapte al nicho y al cliente ideal de cada persona.
//
// Para sumar un formato: agregá una entrada acá y aparece solo en /historias.

export type Formato = {
  key: string;
  nombre: string;
  icono: string;
  cuando: string;          // día sugerido + frecuencia
  paraQue: string;         // qué logra (en criollo)
  comoFunciona: string;    // la mecánica, para el usuario
  opciones: number;        // cuántas opciones lleva (0 = ninguna)
  ejemplo: {               // el ejemplo original de la clase
    encabezado?: string;
    pregunta: string;
    opciones?: string[];
    cta: string;
  };
  receta: string;          // instrucciones para la IA (estructura exacta)
};

export const FORMATOS: Formato[] = [
  {
    key: 'cuestionario',
    opciones: 4,
    nombre: 'Cuestionario',
    icono: '📝',
    cuando: 'Lunes · 1 vez por semana',
    paraQue: 'Segmentar a tu audiencia: cada respuesta te dice en qué punto está esa persona.',
    comoFunciona: 'Hacés una pregunta sobre lo que los frena y das 4 opciones (A, B, C, D). Cada quien responde con una letra y vos sabés exactamente qué venderle.',
    ejemplo: {
      pregunta: '¿Qué te detiene HOY para tener libertad financiera?',
      opciones: [
        'A · No me alcanza para invertir',
        'B · No tengo tiempo, vivo para trabajar',
        'C · No sé por dónde empezar',
        'D · Miedo a arriesgar lo que ya tengo',
      ],
      cta: 'Responde con la letra que más te identifique y te doy el primer paso para salir de ahí.',
    },
    receta: `PREGUNTA sobre el DOLOR principal del cliente ideal (qué lo detiene HOY), en segunda persona y con "HOY" o "ahora" para que sea urgente.
4 OPCIONES (A, B, C, D) que sean las 4 objeciones/situaciones más comunes de ESE cliente. Cada una en 4-8 palabras, en las palabras que usaría él (no en jerga de marketing).
CTA: pedir que respondan con la letra + prometer algo concreto a cambio (el primer paso, un consejo puntual).`,
  },
  {
    key: 'rellena',
    opciones: 0,
    nombre: 'Rellena el espacio',
    icono: '✍️',
    cuando: 'Martes · 1 vez por semana',
    paraQue: 'Que te escriban con SUS palabras: te dan el lenguaje exacto de tu cliente para tus próximos contenidos y ofertas.',
    comoFunciona: 'Dejás una frase a medias con un espacio en blanco. La gente completa y te responde. Cada respuesta es material de venta.',
    ejemplo: {
      pregunta: 'Si dejara de cambiar mi tiempo por dinero, lo primero que haría sería ______',
      cta: 'Respóndeme esto y te muestro cómo empezar a construir ingresos que no dependan de ti.',
    },
    receta: `FRASE incompleta en PRIMERA persona (habla el seguidor, no vos), que lo haga proyectar el DESEO o la transformación que vende tu oferta. Termina en un espacio en blanco "______".
La frase tiene que ser fácil de completar en 3-6 palabras.
CTA: pedir que respondan + prometer mostrarles el camino hacia eso que acaban de escribir.`,
  },
  {
    key: 'leadmagnet',
    opciones: 0,
    nombre: 'Leadmagnet',
    icono: '🎁',
    cuando: 'Jueves · 2-3 veces por semana',
    paraQue: 'Convertir seguidores en conversaciones: piden algo con una palabra clave y entrás al chat con ellos.',
    comoFunciona: 'Anunciás que vas a revelar algo valioso y pedís que comenten UNA palabra para recibirlo. Cada comentario es un lead con nombre y apellido.',
    ejemplo: {
      pregunta: '🚨 Voy a revelar EN VIVO la estrategia con la que dejé de cambiar tiempo por dinero y hoy mi negocio trabaja para mí. 🚨',
      cta: 'Comenta LIBERTAD y te doy acceso al entrenamiento.',
    },
    receta: `ANUNCIO de algo concreto y deseable que vas a entregar (entrenamiento, plantilla, checklist, clase en vivo), contado desde TU experiencia ("la estrategia con la que yo…"). Que se entienda el resultado, no el formato.
Usá 🚨 o similar al principio y al final para dar urgencia.
CTA: "Comenta <PALABRA>" — UNA sola palabra, en mayúsculas, corta y ligada al deseo (LIBERTAD, ESCALAR, CLIENTES) + qué reciben al comentarla.`,
  },
  {
    key: 'dimex',
    opciones: 0,
    nombre: 'Dime X y te digo X',
    icono: '🔮',
    cuando: 'Viernes · 1 vez por semana',
    paraQue: 'Demostrar autoridad uno a uno: te cuentan su caso y vos respondés con criterio. Ahí nace la venta.',
    comoFunciona: 'Pedís un dato simple sobre ellos y prometés devolverles un diagnóstico personalizado a cambio.',
    ejemplo: {
      encabezado: 'EMPRENDEDOR',
      pregunta: 'Dime en qué trabajas…',
      cta: '…y te digo cómo escalarlo para que deje de depender de ti.',
    },
    receta: `ETIQUETA arriba con a quién le hablás en UNA palabra (EMPRENDEDOR, COACH, DUEÑA DE MARCA…).
PEDIDO simple y de una línea: "Dime <dato fácil de contestar>…" (en qué trabajas, cuántos seguidores tenés, qué vendés).
CTA que cierra la frase: "…y te digo <la transformación concreta que ofrecés>". El intercambio tiene que sonar irresistible y fácil.`,
  },
];

export function getFormato(key: string): Formato | undefined {
  return FORMATOS.find(f => f.key === key);
}
