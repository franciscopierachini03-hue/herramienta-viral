// 🎯 ¿La persona contestó, o dijo que no sabe?
//
// El chat guardaba TAL CUAL lo que escribieran. Alguien puso "no se cual es mi
// cliente ideal" y el sistema lo tomó como su nicho: le devolvió palabras para
// buscar virales sobre "cómo definir un avatar", y eso quedó guardado como su
// cliente ideal para todas las herramientas.
//
// Vive suelto en su propio archivo porque lo necesitan el navegador (para no
// guardarlo) y el servidor (para no generar sobre eso).

const NO_SABE = [
  /^\s*no\b.{0,30}\bs[eé]\b/i,                       // "no sé", "no se cuál es"
  /\bno\s+(lo\s+)?s[eé]\b/i,
  /\bni\s+idea\b/i,
  /\bno\s+(lo\s+)?tengo\s+(claro|definido|idea)\b/i,
  /\bno\s+estoy\s+segur/i,
  /\bno\s+me\s+queda\s+claro\b/i,
  /\bayud[aá](me|r)\b.{0,25}\bdefinir\b/i,
  /\btodav[ií]a\s+no\b/i,
  /\ba[uú]n\s+no\b/i,
  /^\s*(cualquiera|no\s*s[eé]|nose|ninguno|nada|x+|\.+|\?+)\s*$/i,
];

// true = la persona NO contestó quién es su cliente; hay que ayudarla a definirlo.
//
// La primera versión era demasiado dura y rechazaba descripciones buenas:
// "Emprendedores profesionales atrapados en la operación" quedaba marcada
// porque la lista de palabras pedía \bemprendedor\b y el plural no encajaba.
// Ahora manda la precisión: solo se marca lo que es claramente un "no sé" o un
// TEMA suelto de dos o tres palabras. Una descripción larga se da por buena
// aunque no use ninguna palabra de la lista — mandar a alguien que ya contestó
// a contestar de nuevo es peor que dejar pasar una respuesta floja.
export function noSabeSuCliente(texto: string): boolean {
  const t = (texto || '').trim();
  if (t.length < 10) return true;
  if (NO_SABE.some(re => re.test(t))) return true;

  const palabras = t.split(/\s+/).filter(Boolean).length;
  if (palabras >= 5) return false;   // ya describió algo: se respeta

  // Cuatro palabras o menos: solo pasa si nombra a personas.
  // Sin \b al final, para que "emprendedores" y "coaches" también entren.
  // personas? con límite: si no, "desarrollo personal" pasaba como si hablara de personas.
  return !/\b(personas?\b|gente|mujer|hombre|due[ñn]|emprendedor|coach|consultor|madre|padre|joven|cliente|profesional|empleado|vendedor|terapeuta|nutricionista|entrenador|freelancer|l[ií]der|alguien|otros|quien|los que|las que)/i.test(t);
}

export const MENSAJE_NO_SABE =
  'Tranquilo, casi nadie lo tiene claro al principio — y es la pieza que hace que todo lo demás funcione. '
  + 'Te hago tres preguntas cortas y lo armamos juntos.';
