// 🧮 CALCULADORA DE VIRALIDAD — el método de Francisco, en código.
//
// Los pesos salen de su hoja de cálculo. La hoja no los muestra (viven dentro
// de la fórmula), así que se despejaron de las 6 filas que tenía llenas y se
// verificó que reproducen las 6 exactamente.
//
// ── Regla de oro de la implementación ─────────────────────────────────────
// La IA SOLO contesta sí/no a las seis preguntas. El puntaje lo calcula este
// archivo. Si dejáramos que el modelo dijera el número, cada corrida daría algo
// distinto y dejaría de ser la calculadora de Francisco para ser una opinión.

export type Criterio = {
  key: string;
  peso: number;
  pregunta: string;      // la pregunta tal cual, para la IA y para la pantalla
  significa: string;     // qué mide, en criollo
  noEs: string;          // el malentendido típico — la IA lo leía mal sin esto
  siFalla: string;       // qué hacer cuando sale "No"
};

export const CRITERIOS: Criterio[] = [
  {
    key: 'nino', peso: 2.5,
    pregunta: '¿Lo entendería un niño de 5 años?',
    significa: 'Que la idea se capte sin esfuerzo, sin tecnicismos y sin tener que explicarla dos veces.',
    noEs: 'NO se trata de que el contenido sea para niños, ni de que un niño de 5 años conozca cada palabra. Se trata de si la IDEA CENTRAL se capta de una sola pasada, sin releer y sin que nadie la explique. Una idea puede usar la palabra “metabolismo” y aun así entenderse al instante.',
    siFalla: 'Quita las palabras que solo entiende tu gremio. Di la idea como se la contarías a alguien que nunca oyó del tema.',
  },
  {
    key: 'referencia', peso: 2,
    pregunta: '¿Se apoya en una referencia que ya explotó?',
    significa: 'Que se parezca a algo que la gente ya vio funcionar: un formato, una frase, una escena conocida.',
    noEs: 'NO es citar una película, un famoso o un meme. Es si el video se apoya en una ESTRUCTURA o un ángulo que la gente ya vio funcionar (un versus, un ranking, un antes y después, una frase que ya circula).',
    siFalla: 'Busca en Virales algo que ya explotó en tu nicho y monta tu idea sobre esa estructura. Es el método: descifrar, no inventar.',
  },
  {
    key: 'amplitud', peso: 1.5,
    pregunta: '¿Le interesaría a 50 de cada 100 personas?',
    significa: 'Que no sea solo para tu nicho cerrado. Un video que le habla a pocos, llega a pocos.',
    noEs: 'NO es que le sirva a todo el mundo, sino que la mitad de quien lo vea se sienta aludido aunque no sea del nicho.',
    siFalla: 'Abre el gancho. Que los primeros segundos le hablen a cualquiera y recién el desarrollo baje a tu público.',
  },
  {
    key: 'mercado', peso: 1.5,
    pregunta: '¿Es un mercado donde las cosas se vuelven virales?',
    significa: 'Hay temas donde el contenido circula solo y otros donde por más bueno que sea, no se mueve.',
    noEs: 'NO es si el tema es popular, sino si en ESE mercado el contenido circula solo (dinero, salud, relaciones, tiempo, vida diaria) o si es un rubro donde nada se mueve.',
    siFalla: 'Conecta tu tema con uno que sí circula: dinero, salud, relaciones, tiempo, o algo de la vida diaria.',
  },
  {
    key: 'tendencia', peso: 1.5,
    pregunta: '¿Va montado en algo que está pasando ahora?',
    significa: 'Una fecha, una discusión del momento, algo que la gente ya tiene en la cabeza esta semana.',
    noEs: 'NO hace falta una moda de TikTok. Cuenta también la época del año, una fecha, o una conversación que ya está dando vueltas entre su gente.',
    siFalla: 'Ánclalo a algo de estos días. No hace falta una moda: sirve la época del año o una conversación que ya está dando vueltas.',
  },
  {
    key: 'controversia', peso: 1,
    pregunta: '¿Genera debate o incomoda un poco?',
    significa: 'Que alguien pueda estar en desacuerdo. Lo que nadie discute, nadie comenta.',
    noEs: 'NO es agredir ni provocar por provocar. Alcanza con tomar posición sobre algo en lo que se pueda estar en desacuerdo.',
    siFalla: 'Toma posición. Di qué está mal de lo que todos hacen, en vez de quedar bien con todos.',
  },
];

export const TOTAL = CRITERIOS.reduce((a, c) => a + c.peso, 0); // 10

// El puntaje: suma de los pesos que salieron en "Sí". Redondeado a un decimal
// porque los pesos son .5 y no queremos 6.499999.
export function puntuar(respuestas: Record<string, boolean>): number {
  const s = CRITERIOS.reduce((a, c) => a + (respuestas[c.key] ? c.peso : 0), 0);
  return Math.round(s * 10) / 10;
}

// Qué significa el número — CALIBRADO CONTRA LA REALIDAD, no contra el 10.
//
// Se corrieron 11 virales de 4.6M a 13.3M por la calculadora completa:
//   mínimo 4.5 · mediana 7 · máximo 7.5
// Y un guion motivacional genérico saca 3.5.
//
// O sea: NINGÚN video de millones llegó a 8. Los cortes viejos (9 = listo,
// 7 = muy bueno) eran imposibles y hacían que un viral de 7 millones se
// mostrara como mediocre. Ahora la referencia es lo que de verdad explota.
export const REFERENCIA = { min: 4.5, mediana: 7, max: 7.5, n: 11 };

export function veredicto(p: number): { nivel: string; color: string; frase: string } {
  if (p >= 7.5) return { nivel: 'Mejor que los virales que medimos', color: '#22c55e', frase: 'Ninguno de los 11 videos de millones que analizamos llegó tan alto. Grábalo.' };
  if (p >= 7)   return { nivel: 'En la mediana de los virales', color: '#86efac', frase: 'Puntúa igual que los videos de 4 a 13 millones que medimos. Está listo.' };
  if (p >= 5.5) return { nivel: 'Dentro del rango viral', color: '#a3e635', frase: 'Varios videos de millones puntúan aquí. Si arreglas lo de abajo, subes al techo.' };
  if (p >= 4.5) return { nivel: 'En el piso de lo que funciona', color: '#fcd34d', frase: 'Justo en el mínimo de los virales medidos. Le queda mucho por ganar.' };
  if (p >= 3.5) return { nivel: 'Flojo', color: '#f59e0b', frase: 'Por debajo de todo lo que llegó a millones. Arregla lo de abajo antes de grabar.' };
  return { nivel: 'No lo grabes todavía', color: '#ef4444', frase: 'Le faltan las bases. Arregla lo de abajo y vuelve a medirlo.' };
}

// ═══════════════════════════════════════════════════════════════════════════
//  BLOQUE 2 · LA FORMA — otros 10 puntos, medidos por el CÓDIGO
// ═══════════════════════════════════════════════════════════════════════════
//
// Los seis criterios de arriba juzgan la IDEA y los contesta la IA. Estos seis
// juzgan cómo está ARMADO el guion, y no necesitan IA: se cuentan. Por eso el
// resultado no cambia entre una corrida y otra, y no cuesta un centavo.
//
// Salen de medir 389 virales (12 creadores, de 100K a 20.7M de vistas): 67
// bajados con su contenido y los 10 más vistos transcritos palabra por palabra.
// Los pesos siguen a qué tan parejo apareció cada patrón:
//
//   ·  0 de 67 duran menos de 15s · la mediana fue 52s
//   · 10 de 10 hablan de "tú" · 0 de 10 se presentan
//   ·  6 de 10 abren con una pregunta o la voz de otra persona
//   ·  3 de 10 repiten un molde tres o más veces
//   · hablan a ~235 palabras por minuto: sin pausas y sin relleno

export type ChequeoForma = {
  key: string; nombre: string; peso: number; cumple: boolean;
  detalle: string;      // qué se encontró en ESTE guion
  arreglo: string;      // qué hacer si no cumple
};

// ⚠️ La duración NO se puntúa sobre una estimación. Al medir los 10 virales,
// el ritmo iba de 146 a 265 palabras por minuto (mediana 205): convertir
// palabras a segundos falla hasta un 40%, y no se puede jugar 2.5 puntos a eso.
// Se puntúa el LARGO EN PALABRAS, que es exacto, y los segundos se muestran
// como un rango, honestamente.
const PPM_LENTO = 150, PPM_RAPIDO = 250;
export const palabrasDe = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
export const rangoSegundos = (t: string) => {
  const p = palabrasDe(t);
  return { min: Math.round(p / PPM_RAPIDO * 60), max: Math.round(p / PPM_LENTO * 60) };
};
// Los 10 virales tenían entre 55 y 443 palabras, con mediana 174. La zona de
// 130 a 260 es donde cae la mayoría a un ritmo de reel.
const PAL_MIN = 130, PAL_MAX = 260;

const RELLENO = /\b(en conclusión|cabe destacar|es importante (que|mencionar)|como (ya )?sabemos|sin más preámbulos|antes de empezar|bienvenidos a un nuevo|no olvides suscribirte|espero que les guste)\b/i;
const PRESENTARSE = /^[^.!?]{0,80}\b(hola|qué tal|que tal|bienvenid\w+|mi nombre es|soy \w+ y|les habla)\b/i;
// Hablarle a la persona no es solo el pronombre: el imperativo también lo es.
// "Observa, decepciónate y aléjate" le habla a alguien tanto como "tú puedes".
// Sin los verbos, un viral de 7M perdía este punto de gratis.
const SEGUNDA = /\b(tú|tu|te|tus|ti|contigo|tienes|puedes|quieres|sabes|piensas|crees|haces|estás|eres|tienen)\b/i;
const IMPERATIVO = /\b(observa|mira|escucha|deja|dejá|haz|piensa|imagina|recuerda|anota|guarda|prueba|empieza|para|detente|aléjate|alejate|olvida|fíjate|fíjate|no (reclames|reclamen|hagas|esperes|creas|pierdas)|decepci[oó]nate)\b/i;

// ¿Abre con la voz de otro, una pregunta o un diálogo?
function abreConOtro(t: string): boolean {
  const primera = t.split(/(?<=[.?!])\s/)[0] || t.slice(0, 140);
  if (/\?/.test(primera)) return true;                              // pregunta
  if (/^[—-]\s|^"|^«/.test(t.trim())) return true;                  // guion de diálogo
  // "Cristian, ¿qué es mejor?" — alguien llamando por su nombre. Pero NO un
  // saludo: "Hola," entraba por acá y daba el punto de gratis.
  if (/^(?!hola|buenas|hey|oigan|amigos|chicos|gente)[A-ZÁÉÍÓÚÑ][\wáéíóúñ]{2,15},\s/i.test(t.trim())) return true;
  if (/\b(me (dijo|preguntó|dice)|le dije|disculp\w+|oye,)\b/i.test(primera)) return true;
  return false;
}

// ¿Hay un molde que se repite 3+ veces? (el patrón del video de 11.4M)
function moldeRepetido(t: string): { hay: boolean; molde: string } {
  const fr = t.toLowerCase().split(/[.?!;]/).map(x => x.trim()).filter(x => x.split(' ').length >= 3);
  const ini: Record<string, number> = {};
  for (const f of fr) { const k = f.split(' ').slice(0, 3).join(' '); ini[k] = (ini[k] || 0) + 1; }
  const par = Object.entries(ini).sort((a, b) => b[1] - a[1])[0];
  return { hay: !!par && par[1] >= 3, molde: par ? par[0] : '' };
}

export function medirForma(guionRaw: string): ChequeoForma[] {
  const t = guionRaw.replace(/\s+/g, ' ').trim();
  const palabras = palabrasDe(t);
  const rango = rangoSegundos(t);
  const arranque = t.split(' ').slice(0, 30).join(' ');
  const molde = moldeRepetido(t);
  const sePresenta = PRESENTARSE.test(t);
  const abre = abreConOtro(t);
  const tuteo = SEGUNDA.test(arranque) || IMPERATIVO.test(arranque);
  const relleno = RELLENO.test(t);

  return [
    {
      key: 'duracion', nombre: 'Tiene el largo de un viral', peso: 2.5,
      cumple: palabras >= PAL_MIN && palabras <= PAL_MAX,
      detalle: `${palabras} palabras → entre ${rango.min}s y ${rango.max}s según qué tan rápido hables. De 67 virales medidos ninguno bajaba de 15s, la mediana fue 52s, y los 10 más grandes tenían entre 55 y 443 palabras.`,
      arreglo: palabras < PAL_MIN
        ? `Se queda corto (${palabras} palabras). Súmale una historia, un ejemplo o un tercer punto hasta llegar a unas 150-200.`
        : `Se pasa de largo (${palabras} palabras). Corta lo que no aporte hasta dejarlo cerca de 200.`,
    },
    {
      key: 'apertura', nombre: 'Abre con una pregunta o la voz de otro', peso: 2,
      cumple: abre,
      detalle: abre ? 'Arranca con una pregunta o un diálogo.' : 'Arranca contigo afirmando algo.',
      arreglo: 'Prueba abrir con una pregunta, o con alguien preguntándote. 6 de los 10 videos más vistos lo hacen: escuchar preguntar engancha más que escuchar afirmar.',
    },
    {
      key: 'sin_presentacion', nombre: 'No te presentas: entras directo', peso: 2,
      cumple: !sePresenta,
      detalle: sePresenta ? 'Empieza saludando o presentándose.' : 'Entra directo al tema.',
      arreglo: 'Borra el saludo. De los 10 videos más vistos, CERO se presentan. Ese segundo es el que te cuesta media audiencia.',
    },
    {
      key: 'segunda_persona', nombre: 'Le hablas a la persona desde el arranque', peso: 1.5,
      cumple: tuteo,
      detalle: tuteo ? 'Usa "tú" o "te" en las primeras palabras.' : 'Las primeras frases no le hablan a nadie en particular.',
      arreglo: 'Mete un "tú" o un "te" en la primera frase. 10 de los 10 más vistos lo hacen, sin una sola excepción.',
    },
    {
      key: 'sin_relleno', nombre: 'Sin muletillas ni relleno', peso: 1,
      cumple: !relleno,
      detalle: relleno ? `Tiene relleno: "${(t.match(RELLENO) || [''])[0]}".` : 'No hay frases de relleno.',
      arreglo: 'Quita las frases que no dicen nada. Los virales hablan a ~235 palabras por minuto: sin pausas y sin adornos.',
    },
    {
      key: 'molde', nombre: 'Repite un molde tres veces o más', peso: 1,
      cumple: molde.hay,
      detalle: molde.hay ? `Repite "${molde.molde}…" y eso engancha.` : 'No hay una estructura que se repita.',
      arreglo: 'Toma UNO de tus bloques y reescríbelo como TRES frases seguidas que empiecen con LAS MISMAS DOS PALABRAS. No parecidas: idénticas. Ejemplo: "Si cobras por hora, vendes tiempo. Si cobras por proyecto, vendes resultado. Si cobras por resultado, vendes criterio." Es el patrón de un video de 11.4M y casi nadie lo usa.',
    },
  ];
}

export const TOTAL_FORMA = 10;
export const puntuarForma = (ch: ChequeoForma[]) =>
  Math.round(ch.reduce((a, c) => a + (c.cumple ? c.peso : 0), 0) * 10) / 10;

// El número grande: el promedio de las dos mitades. Una idea buena mal armada
// no explota, y una idea floja perfectamente armada tampoco.
export const puntajeFinal = (idea: number, forma: number) =>
  Math.round(((idea + forma) / 2) * 10) / 10;
