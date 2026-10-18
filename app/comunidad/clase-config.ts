// CONFIG DE LA CLASE SEMANAL — única fuente para la página /comunidad, el banner
// de /app y los correos (/api/cron/recordatorio-clase y /api/admin/aviso-clase).
// Se edita acá y cambia en los cuatro lados.

export const CLASE = {
  // 0=DOMINGO · 1=lunes · 2=martes · 3=miércoles · 4=jueves · 5=viernes · 6=sábado
  // Cambiado de miércoles a DOMINGO el 18-oct-2026, por decisión de Francisco.
  // Cambiar este número mueve la clase en TODA la plataforma: la página, el
  // contador, los dos recordatorios por correo, el hub y el centro de ayuda.
  diaSemana: 0,
  horaCDMX: '10:00 AM',
  finVentanaHoy: { h: 11, m: 30 }, // hasta esta hora (CDMX) el día de clase cuenta como "HOY"
  nombre: 'Mañanas de Viralidad',
  sala: 'Sesión de viralidad',
  zoomUrl: 'https://us06web.zoom.us/j/84896541773?pwd=UB3ba5XpdOZFyii8ctrbKZPehgP7un.1',
  zoomId: '848 9654 1773',
  zoomCodigo: '889645',
};

// ── El nombre del día, derivado ─────────────────────────────────────────────
// Antes el día estaba escrito a mano en nueve archivos y cambiarlo era cazar la
// palabra "miércoles" por todo el repo. Ahora sale de `diaSemana` y basta con
// mover ese número.
const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export const DIA_NOMBRE = DIAS_ES[CLASE.diaSemana];                    // 'domingo'
// lunes/martes/miércoles/jueves/viernes ya terminan en s: no llevan otra.
export const DIA_PLURAL = DIA_NOMBRE.endsWith('s') ? `los ${DIA_NOMBRE}` : `los ${DIA_NOMBRE}s`;

// El día de antes — el recordatorio de 24 horas sale ese día.
export const DIA_PREVIO = (CLASE.diaSemana + 6) % 7;                   // sábado
export const DIA_PREVIO_NOMBRE = DIAS_ES[DIA_PREVIO];

// Mismo horario en las zonas de la comunidad (10:00 AM CDMX).
export const HORARIOS: Array<[string, string, string]> = [
  ['🇲🇽', '10:00 AM', 'Ciudad de México'],
  ['🇺🇸', '9:00 AM', 'Los Ángeles / Tijuana'],
  ['🇨🇴🇵🇪', '11:00 AM', 'Colombia / Perú / Texas'],
  ['🇺🇸🇨🇱🇻🇪', '12:00 PM', 'Miami / Chile / Venezuela'],
  ['🇦🇷🇧🇷', '1:00 PM', 'Argentina / Brasil'],
];

// 🕗 CLASE ESPECIAL de UN día (link/hora distintos). Vigente SOLO en su fecha
// (CDMX): /comunidad y el aviso por correo la toman solos; después, todo
// vuelve a la clase semanal normal sin tocar nada.
//
// AHORA MISMO NO HAY NINGUNA: `fecha` vacío nunca coincide con un día, así que
// siempre manda la sala de arriba. Para activar una, poné la fecha y los datos
// de esa sala; para apagarla, volvé a dejar `fecha` en ''.
export const CLASE_ESPECIAL = {
  fecha: '',             // '' = apagada · 'YYYY-MM-DD' = solo ese día
  hora: '10:00 AM',
  sala: 'Sesión de viralidad',
  zoomUrl: 'https://us06web.zoom.us/j/84896541773?pwd=UB3ba5XpdOZFyii8ctrbKZPehgP7un.1',
  zoomId: '848 9654 1773',
  zoomCodigo: '889645',
};

// La clase que corresponde a una fecha CDMX (YYYY-MM-DD): la especial si es su
// día, si no la semanal de siempre.
export function claseEnFecha(fechaCDMX: string) {
  if (CLASE_ESPECIAL.fecha && fechaCDMX === CLASE_ESPECIAL.fecha) {
    return { ...CLASE, horaCDMX: CLASE_ESPECIAL.hora, sala: CLASE_ESPECIAL.sala || CLASE.sala, zoomUrl: CLASE_ESPECIAL.zoomUrl, zoomId: CLASE_ESPECIAL.zoomId, zoomCodigo: CLASE_ESPECIAL.zoomCodigo, esEspecial: true as const };
  }
  return { ...CLASE, esEspecial: false as const };
}

// 📣 AVISO en pantalla (banner) para cambios de último momento. Se muestra en
// /comunidad y /app mientras HOY (CDMX) esté entre `desde` y `hasta`.
// Para apagarlo: dejá `texto` vacío.
export const AVISO = {
  desde: '2026-10-18',
  hasta: '2026-11-08',
  titulo: '📅 La clase se cambió a los DOMINGOS 10:00 AM',
  texto: 'Ya no es los miércoles. De ahora en adelante nos vemos todos los domingos a las 10:00 AM (Ciudad de México), en la misma sala de siempre. Entra con el botón de abajo.',
};

export function avisoVigente(hoyCDMX: string) {
  if (!AVISO.texto) return null;
  if (hoyCDMX < AVISO.desde || hoyCDMX > AVISO.hasta) return null;
  return AVISO;
}
