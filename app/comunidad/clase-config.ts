// CONFIG DE LA CLASE SEMANAL — única fuente para la página /comunidad y los
// recordatorios por correo (/api/cron/recordatorio-clase). Editá acá y cambia
// en los dos lados.

export const CLASE = {
  diaSemana: 3,            // 0=domingo … 3=MIÉRCOLES
  horaCDMX: '10:00 AM',
  finVentanaHoy: { h: 11, m: 30 }, // hasta esta hora (CDMX) el miércoles cuenta como "HOY"
  nombre: 'Mañanas de Viralidad',
  sala: 'SALA Z3',
  zoomUrl: 'https://us02web.zoom.us/j/84756346742?pwd=v1BkAgV10JYEfdO61lU4AXN4scDFtb.1',
  zoomId: '847 5634 6742',
  zoomCodigo: 'C123',
};

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
export const CLASE_ESPECIAL = {
  fecha: '2026-08-14',
  hora: '10:00 AM',
  sala: 'Mañanas de Viralidad',
  zoomUrl: 'https://us02web.zoom.us/j/84285002353?pwd=bhioRJpJeTJ1eoyghCtHMi4UF7aHNw.1',
  zoomId: '842 8500 2353',
  zoomCodigo: 'C123',
};

// La clase que corresponde a una fecha CDMX (YYYY-MM-DD): la especial si es su
// día, si no la semanal de siempre.
export function claseEnFecha(fechaCDMX: string) {
  if (CLASE_ESPECIAL && fechaCDMX === CLASE_ESPECIAL.fecha) {
    return { ...CLASE, horaCDMX: CLASE_ESPECIAL.hora, sala: CLASE_ESPECIAL.sala || CLASE.sala, zoomUrl: CLASE_ESPECIAL.zoomUrl, zoomId: CLASE_ESPECIAL.zoomId, zoomCodigo: CLASE_ESPECIAL.zoomCodigo, esEspecial: true as const };
  }
  return { ...CLASE, esEspecial: false as const };
}

// 📣 AVISO en pantalla (banner) para cambios de último momento. Se muestra en
// /comunidad y /app mientras HOY (CDMX) esté entre `desde` y `hasta`.
// Para apagarlo: dejá `texto` vacío.
export const AVISO = {
  desde: '2026-08-14',
  hasta: '2026-08-14',
  titulo: '🔴 La clase está EN VIVO — entrá ahora',
  texto: 'Usamos una sala nueva: ID 842 8500 2353 · código C123. Tocá el botón de abajo para entrar.',
};

export function avisoVigente(hoyCDMX: string) {
  if (!AVISO.texto) return null;
  if (hoyCDMX < AVISO.desde || hoyCDMX > AVISO.hasta) return null;
  return AVISO;
}
