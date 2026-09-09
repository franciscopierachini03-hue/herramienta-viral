// CONFIG DE LA CLASE SEMANAL — única fuente para la página /comunidad, el banner
// de /app y los correos (/api/cron/recordatorio-clase y /api/admin/aviso-clase).
// Se edita acá y cambia en los cuatro lados.

export const CLASE = {
  diaSemana: 3,            // 0=domingo … 3=MIÉRCOLES
  horaCDMX: '10:00 AM',
  finVentanaHoy: { h: 11, m: 30 }, // hasta esta hora (CDMX) el miércoles cuenta como "HOY"
  nombre: 'Mañanas de Viralidad',
  sala: 'Mañanas de Viralidad',
  zoomUrl: 'https://us06web.zoom.us/j/85248003047?pwd=3fsruMbb4cmq16kzZruXytJmj7Hlrj.1',
  zoomId: '852 4800 3047',
  zoomCodigo: '321801',
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
//
// AHORA MISMO NO HAY NINGUNA: `fecha` vacío nunca coincide con un día, así que
// siempre manda la sala de arriba. Para activar una, poné la fecha y los datos
// de esa sala; para apagarla, volvé a dejar `fecha` en ''.
export const CLASE_ESPECIAL = {
  fecha: '',             // '' = apagada · 'YYYY-MM-DD' = solo ese día
  hora: '10:00 AM',
  sala: 'Mañanas de Viralidad',
  zoomUrl: 'https://us06web.zoom.us/j/85248003047?pwd=3fsruMbb4cmq16kzZruXytJmj7Hlrj.1',
  zoomId: '852 4800 3047',
  zoomCodigo: '321801',
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
  desde: '2026-09-08',
  hasta: '2026-09-09',
  titulo: '🔴 La clase está EN VIVO — entra ahora',
  texto: 'Estamos adentro revisando cuentas. Toca el botón de abajo para entrar: sala nueva, ID 852 4800 3047 · código 321801. Si tienes guardado el link anterior, ya no sirve.',
};

export function avisoVigente(hoyCDMX: string) {
  if (!AVISO.texto) return null;
  if (hoyCDMX < AVISO.desde || hoyCDMX > AVISO.hasta) return null;
  return AVISO;
}
