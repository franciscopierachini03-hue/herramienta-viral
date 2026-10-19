// CONFIG DE LAS CLASES EN VIVO — única fuente para /comunidad, el cartel que
// sale en toda la plataforma (<ClaseEnVivo/>) y los correos de recordatorio.
// Se edita acá y cambia en todos lados.
//
// ── Historia ───────────────────────────────────────────────────────────────
// Hasta el 18-oct-2026 había UNA sola clase (miércoles 10 AM) y su día estaba
// escrito a mano en nueve archivos. Ese día pasó a domingo y el día se centralizó
// acá. El 19-oct-2026 se sumó la segunda clase (lunes, con Rogger), así que lo
// que era un objeto ahora es una LISTA: agregar una tercera es agregar una
// entrada, nada más.

export type Clase = {
  id: string;
  nombre: string;
  con: string;                      // quién la da
  tema: string;                     // una línea de qué se ve
  diaSemana: number;                // 0=domingo · 1=lunes … 6=sábado
  horaInicio: { h: number; m: number };   // hora CDMX en números
  duracionMin: number;              // cuánto dura la ventana EN VIVO
  sala: string;
  zoomUrl: string;
  zoomId: string;
  zoomCodigo: string;               // '' = no hay / va dentro del enlace
  acento: string;                   // color con el que se pinta en la interfaz
};

export const CLASES: Clase[] = [
  {
    id: 'viralidad',
    nombre: 'Domingos de Viralidad',
    con: 'Francisco',
    tema: 'Revisamos tu cuenta: qué está funcionando, qué ajustar y qué publicar esta semana.',
    diaSemana: 0,                   // domingo
    horaInicio: { h: 10, m: 0 },
    duracionMin: 90,
    sala: 'Sesión de viralidad',
    zoomUrl: 'https://us06web.zoom.us/j/84896541773?pwd=UB3ba5XpdOZFyii8ctrbKZPehgP7un.1',
    zoomId: '848 9654 1773',
    zoomCodigo: '889645',
    acento: '#f59e0b',
  },
  {
    id: 'ofertas',
    nombre: 'Creación de ofertas y monetización',
    con: 'Rogger',
    tema: 'Cómo armar una oferta que la gente quiera comprar y cómo cobrarla.',
    diaSemana: 1,                   // lunes
    horaInicio: { h: 9, m: 0 },
    duracionMin: 90,
    sala: 'Ofertas y monetización',
    zoomUrl: 'https://us06web.zoom.us/j/82883453558?pwd=UvQG5NT6JEqCp6dX9l45ZTA8bA0Kse.1',
    zoomId: '828 8345 3558',
    // ❓ El código numérico de esta sala no lo tenemos: el enlace ya lo lleva
    // dentro, así que con el botón se entra igual. Si Rogger lo pasa, va acá.
    zoomCodigo: '',
    acento: '#22d3ee',
  },
];

// La de siempre, para lo que todavía habla de "la clase" en singular.
export const CLASE = CLASES[0];

// ── Nombres de los días, derivados ──────────────────────────────────────────
const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export const diaNombre = (c: Clase) => DIAS_ES[c.diaSemana];
// lunes/martes/miércoles/jueves/viernes ya terminan en s: no llevan otra.
export const diaPlural = (c: Clase) =>
  DIAS_ES[c.diaSemana].endsWith('s') ? `los ${DIAS_ES[c.diaSemana]}` : `los ${DIAS_ES[c.diaSemana]}s`;

// El día anterior — el recordatorio de 24 horas sale ese día.
export const diaPrevio = (c: Clase) => (c.diaSemana + 6) % 7;
export const diaPrevioNombre = (c: Clase) => DIAS_ES[diaPrevio(c)];

// '10:00 AM' / '9:00 AM' a partir de los números.
export function horaTexto(c: Clase): string {
  const h12 = c.horaInicio.h % 12 || 12;
  const ampm = c.horaInicio.h < 12 ? 'AM' : 'PM';
  return `${h12}:${String(c.horaInicio.m).padStart(2, '0')} ${ampm}`;
}

// ── Horarios por país ───────────────────────────────────────────────────────
// Se calculan desde la hora de la clase en vez de estar escritos a mano: así
// la tabla sale bien para las dos clases (una a las 10, otra a las 9).
const ZONAS: Array<[string, number, string]> = [
  ['🇲🇽', 0, 'Ciudad de México'],
  ['🇺🇸', -1, 'Los Ángeles / Tijuana'],
  ['🇨🇴🇵🇪', +1, 'Colombia / Perú / Texas'],
  ['🇺🇸🇨🇱🇻🇪', +2, 'Miami / Chile / Venezuela'],
  ['🇦🇷🇧🇷', +3, 'Argentina / Brasil'],
];

export function horarios(c: Clase): Array<[string, string, string]> {
  return ZONAS.map(([bandera, offset, lugar]) => {
    const h = (c.horaInicio.h + offset + 24) % 24;
    const h12 = h % 12 || 12;
    const ampm = h < 12 ? 'AM' : 'PM';
    return [bandera, `${h12}:${String(c.horaInicio.m).padStart(2, '0')} ${ampm}`, lugar] as [string, string, string];
  });
}

// Compatibilidad: la tabla de la clase de los domingos.
export const HORARIOS = horarios(CLASES[0]);

// ── Cuándo es cada clase ────────────────────────────────────────────────────
// CDMX es UTC-6 FIJO (sin horario de verano desde 2022), así que la clase cae
// siempre a la misma hora UTC. Calcular en UTC hace que el contador sea
// correcto para cualquier persona, esté en la zona que esté.
export function inicioUTC(c: Clase): number {
  return (c.horaInicio.h + 6) * 60 + c.horaInicio.m;   // minutos desde las 00:00 UTC
}

// El próximo arranque de ESA clase, como instante.
export function proximoInicio(c: Clase, ahora: Date): Date {
  const t = new Date(ahora);
  const add = (c.diaSemana - ahora.getUTCDay() + 7) % 7;
  t.setUTCDate(ahora.getUTCDate() + add);
  const min = inicioUTC(c);
  t.setUTCHours(Math.floor(min / 60), min % 60, 0, 0);
  if (t.getTime() <= ahora.getTime()) t.setUTCDate(t.getUTCDate() + 7);
  return t;
}

// La más cercana de todas: a la que apunta el contador grande.
export function proximaClase(ahora: Date): { clase: Clase; cuando: Date } {
  return CLASES
    .map(clase => ({ clase, cuando: proximoInicio(clase, ahora) }))
    .sort((a, b) => a.cuando.getTime() - b.cuando.getTime())[0];
}

// 'vivo' mientras corre · 'hoy' el día de la clase antes de que abra · null el resto.
// La sala abre 15 min antes: quien llega temprano ya puede entrar.
export type EstadoClase = 'vivo' | 'hoy' | null;

export function estadoClase(c: Clase, ahora: Date): EstadoClase {
  try {
    const cdmx = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    if (cdmx.getDay() !== c.diaSemana) return null;
    const min = cdmx.getHours() * 60 + cdmx.getMinutes();
    const abre = c.horaInicio.h * 60 + c.horaInicio.m;
    if (min >= abre - 15 && min <= abre + c.duracionMin) return 'vivo';
    if (min < abre - 15) return 'hoy';
    return null;                      // ya terminó: se apaga sola
  } catch { return null; }
}

// ── 🕗 CLASE ESPECIAL de UN día ─────────────────────────────────────────────
// Para cuando una clase cambia de link u hora SOLO ese día. Vigente solo en su
// fecha (CDMX); después todo vuelve a la normal sin tocar nada.
// Apagada = `fecha` en ''.
export const CLASE_ESPECIAL = {
  fecha: '',             // '' = apagada · 'YYYY-MM-DD' = solo ese día
  claseId: 'viralidad',  // a cuál de las clases reemplaza
  hora: '10:00 AM',
  sala: 'Sesión de viralidad',
  zoomUrl: 'https://us06web.zoom.us/j/84896541773?pwd=UB3ba5XpdOZFyii8ctrbKZPehgP7un.1',
  zoomId: '848 9654 1773',
  zoomCodigo: '889645',
};

// La clase que corresponde a una fecha CDMX: la especial si es su día, si no la normal.
export function claseEnFecha(fechaCDMX: string, clase: Clase = CLASES[0]) {
  if (CLASE_ESPECIAL.fecha && fechaCDMX === CLASE_ESPECIAL.fecha && CLASE_ESPECIAL.claseId === clase.id) {
    return {
      ...clase,
      horaCDMX: CLASE_ESPECIAL.hora,
      sala: CLASE_ESPECIAL.sala || clase.sala,
      zoomUrl: CLASE_ESPECIAL.zoomUrl,
      zoomId: CLASE_ESPECIAL.zoomId,
      zoomCodigo: CLASE_ESPECIAL.zoomCodigo,
      esEspecial: true as const,
    };
  }
  return { ...clase, horaCDMX: horaTexto(clase), esEspecial: false as const };
}

// ── 📣 AVISO en pantalla para cambios de último momento ─────────────────────
// Se muestra en /comunidad y /app mientras HOY (CDMX) esté entre `desde` y
// `hasta`. Para apagarlo: dejar `texto` vacío.
export const AVISO = {
  desde: '2026-10-19',
  hasta: '2026-11-08',
  titulo: '📅 Ahora son DOS clases por semana',
  texto: 'Domingos 10:00 AM — Domingos de Viralidad con Francisco. Lunes 9:00 AM — Creación de ofertas y monetización con Rogger. Las dos en hora de Ciudad de México.',
};

export function avisoVigente(hoyCDMX: string) {
  if (!AVISO.texto) return null;
  if (hoyCDMX < AVISO.desde || hoyCDMX > AVISO.hasta) return null;
  return AVISO;
}
