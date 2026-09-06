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

// Qué significa el número. Los cortes salen de la propia escala: sin los dos
// criterios más pesados (niño + referencia = 4.5) el techo es 5.5, así que
// pasar de 6 ya implica tener al menos uno de los dos.
export function veredicto(p: number): { nivel: string; color: string; frase: string } {
  if (p >= 9) return { nivel: 'Listo para grabar', color: '#22c55e', frase: 'Tiene todo lo que hace falta. Grábalo hoy.' };
  if (p >= 7) return { nivel: 'Muy bueno', color: '#86efac', frase: 'Va a funcionar. Si arreglas lo que falta, sube a 10.' };
  if (p >= 6) return { nivel: 'Sirve', color: '#fcd34d', frase: 'Funciona, pero le queda techo. Mira lo que falta antes de grabar.' };
  if (p >= 4) return { nivel: 'Flojo', color: '#f59e0b', frase: 'Así como está, se va a quedar entre tus seguidores de siempre.' };
  return { nivel: 'No lo grabes todavía', color: '#ef4444', frase: 'Le faltan las bases. Arregla lo de abajo y vuelve a medirlo.' };
}
