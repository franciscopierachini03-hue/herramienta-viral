// ──────────────────────────────────────────────────────────────────────────
//  CONFIG DEL EVENTO — una sola fuente para la landing (/evento) y la
//  página de gracias (/evento/gracias). Edita aquí fecha, título y enlaces.
// ──────────────────────────────────────────────────────────────────────────
export const EVENT_DATE = new Date('2026-07-10T10:00:00-06:00'); // ← fecha y hora del evento (10am CDMX)
export const EVENT_TZ_OFFSET = -6; // hora del evento en GMT-6 (Ciudad de México). Cambialo si tu evento es en otra zona.
export const EVENT_TZ_LABEL = 'hora Ciudad de México'; // etiqueta que se muestra junto a la hora
export const EVENT_TITLE = 'Cómo encontrar contenido viral y crear videos que explotan con inteligencia artificial';
export const EVENT_SLUG = 'masterclass-viraladn'; // identifica estos registros en tu mail/tabla
export const EVENT_DURATION_MIN = 90; // duración estimada (para el evento de calendario)

// Próximos pasos (página de gracias):
export const TELEGRAM_URL = 'https://t.me/+69M7e37DIgEwYTEx';
export const ZOOM_URL = 'https://us02web.zoom.us/j/82701665842?pwd=2MijtfGb0f5NjtB6HTwxL9TccJDxFH.1';

// Fecha/hora formateadas SIN depender de la zona horaria ni del locale del
// runtime. Usamos solo getters UTC (idénticos en server y navegador) + nombres
// fijos en español → server y cliente producen EXACTAMENTE el mismo texto, así
// que no hay "hydration mismatch" (y no parpadea un placeholder).
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function formatEvento(d: Date) {
  const z = new Date(d.getTime() + EVENT_TZ_OFFSET * 3_600_000); // corremos a la zona del evento y leemos getters UTC
  let h = z.getUTCHours();
  const ampm = h >= 12 ? 'p.m.' : 'a.m.';
  h = h % 12 || 12;
  const mm = String(z.getUTCMinutes()).padStart(2, '0');
  return {
    dateLabel: `${DIAS[z.getUTCDay()]}, ${z.getUTCDate()} de ${MESES[z.getUTCMonth()]}`,
    timeLabel: `${h}:${mm} ${ampm}`,
  };
}
export const { dateLabel: EVENT_DATE_LABEL, timeLabel: EVENT_TIME_LABEL } = formatEvento(EVENT_DATE);
