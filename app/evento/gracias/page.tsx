'use client';

import {
  EVENT_DATE, EVENT_TITLE, EVENT_DATE_LABEL, EVENT_TIME_LABEL, EVENT_TZ_LABEL,
  EVENT_DURATION_MIN, TELEGRAM_URL, ZOOM_URL,
} from '../event-config';

const PURPLE = 'linear-gradient(135deg,#7c3aed,#c13584)';

// ── Calendario ──────────────────────────────────────────────────────────────
// Fechas en UTC compacto (YYYYMMDDTHHMMSSZ) a partir del instante del evento.
function toICSDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
const START_UTC = toICSDate(EVENT_DATE);
const END_UTC = toICSDate(new Date(EVENT_DATE.getTime() + EVENT_DURATION_MIN * 60_000));

const CAL_DETAILS = ZOOM_URL
  ? `Clase en vivo De 0 a 100K seguidores, con Spencer Hoffmann. Enlace de Zoom: ${ZOOM_URL}`
  : 'Clase en vivo De 0 a 100K seguidores, con Spencer Hoffmann. El enlace de Zoom te llegará por Telegram y correo.';
const CAL_LOCATION = ZOOM_URL || 'En línea (Zoom)';

const GOOGLE_CAL_URL =
  'https://calendar.google.com/calendar/render?action=TEMPLATE' +
  `&text=${encodeURIComponent(EVENT_TITLE)}` +
  `&dates=${START_UTC}/${END_UTC}` +
  `&details=${encodeURIComponent(CAL_DETAILS)}` +
  `&location=${encodeURIComponent(CAL_LOCATION)}`;

// Escapa texto para el formato .ics (comas, puntos y coma, barras y saltos).
const escICS = (s: string) => s.replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n');

function downloadICS() {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//De 0 a 100K seguidores//Evento//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:de-0-a-100k-${START_UTC}@franpierachini.com`,
    `DTSTAMP:${START_UTC}`,
    `DTSTART:${START_UTC}`,
    `DTEND:${END_UTC}`,
    `SUMMARY:${escICS(EVENT_TITLE)}`,
    `DESCRIPTION:${escICS(CAL_DETAILS)}`,
    `LOCATION:${escICS(CAL_LOCATION)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Recordatorio',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'de-0-a-100k-seguidores.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function StepNumber({ n }: { n: number }) {
  return (
    <div className="flex-none w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold"
      style={{ background: PURPLE, color: '#fff' }}>
      {n}
    </div>
  );
}

export default function GraciasEvento() {
  return (
    <main className="min-h-screen text-white" style={{ background: 'radial-gradient(ellipse 100% 50% at 50% 0%, #1a0a2e 0%, transparent 55%), radial-gradient(ellipse 70% 40% at 85% 10%, #06243a 0%, transparent 55%), #070710' }}>
      {/* Header */}
      <header className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-2">
        <span className="text-2xl" aria-hidden="true">📈</span>
        <span className="text-lg font-bold">De 0 a 100K <span style={{ color: '#34d399' }}>seguidores</span></span>
      </header>

      <section className="max-w-2xl mx-auto px-6 pt-4 pb-20">
        {/* Confirmación */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">¡Listo, estás dentro!</h1>
          <p className="text-base" style={{ color: '#b4b4c0' }}>
            Reservaste tu lugar para la clase en vivo. Sigue estos pasos para no perdértela 👇
          </p>
          <div className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-full text-sm font-semibold"
            style={{ background: '#10b98118', border: '1px solid #10b98144', color: '#6ee7b7' }}>
            📅 <span className="capitalize">{EVENT_DATE_LABEL}</span> · 🕖 {EVENT_TIME_LABEL} ({EVENT_TZ_LABEL})
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Paso 1 — Telegram (clave) */}
          <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(145deg,#101a22,#0c1116)', border: '1px solid #1f3a44', boxShadow: '0 8px 30px #0007' }}>
            <div className="flex items-start gap-3">
              <StepNumber n={1} />
              <div className="flex-1">
                <h2 className="font-bold text-lg mb-1">Únete a la comunidad de Telegram</h2>
                <p className="text-sm mb-4" style={{ color: '#a7c7d6' }}>
                  Es el paso más importante: ahí te enviamos el <b>enlace de Zoom</b>, los recordatorios
                  y el material. Sin esto te puedes perder el acceso.
                </p>
                <a href={TELEGRAM_URL} target="_blank" rel="noopener"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold w-full sm:w-auto"
                  style={{ background: '#229ED2', color: '#fff', boxShadow: '0 0 20px #229ED255' }}>
                  💬 Entrar a la comunidad de Telegram →
                </a>
              </div>
            </div>
          </div>

          {/* Paso 2 — Calendario */}
          <div className="rounded-2xl p-5" style={{ background: '#0f0f17', border: '1px solid #1f1f2b' }}>
            <div className="flex items-start gap-3">
              <StepNumber n={2} />
              <div className="flex-1">
                <h2 className="font-bold text-lg mb-1">Agenda la clase en tu calendario</h2>
                <p className="text-sm mb-4" style={{ color: '#9a9aa6' }}>
                  Súmala a tu calendario para que no se te pase (te recordará 30 min antes).
                </p>
                <div className="flex flex-wrap gap-3">
                  <a href={GOOGLE_CAL_URL} target="_blank" rel="noopener"
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold"
                    style={{ background: '#1a1a24', border: '1px solid #2a2a3a', color: '#fff' }}>
                    📅 Google Calendar
                  </a>
                  <button type="button" onClick={downloadICS}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold"
                    style={{ background: '#1a1a24', border: '1px solid #2a2a3a', color: '#fff' }}>
                    🍎 Apple / Outlook (.ics)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Paso 3 — Zoom */}
          <div className="rounded-2xl p-5" style={{ background: '#0f0f17', border: '1px solid #1f1f2b' }}>
            <div className="flex items-start gap-3">
              <StepNumber n={3} />
              <div className="flex-1">
                <h2 className="font-bold text-lg mb-1">Tu enlace de Zoom</h2>
                {ZOOM_URL ? (
                  <>
                    <p className="text-sm mb-4" style={{ color: '#9a9aa6' }}>
                      Guarda el enlace para entrar el día de la clase:
                    </p>
                    <a href={ZOOM_URL} target="_blank" rel="noopener"
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold w-full sm:w-auto"
                      style={{ background: PURPLE, color: '#fff', boxShadow: '0 0 20px #7c3aed44' }}>
                      🎥 Entrar a la clase (Zoom) →
                    </a>
                  </>
                ) : (
                  <div className="text-sm rounded-xl px-4 py-3" style={{ background: '#0b0b14', border: '1px dashed #2a2a3a', color: '#b4b4c0' }}>
                    Te enviaremos el enlace de Zoom por <b>Telegram</b> y por <b>correo</b> antes de empezar.
                    Por eso es clave que entres a la comunidad (paso 1).
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs mt-8" style={{ color: '#6b6b76' }}>
          Revisa tu correo (y la carpeta de spam) — también te llegará la confirmación ahí.
        </p>
      </section>

      <footer className="max-w-3xl mx-auto px-6 py-8 text-center text-xs" style={{ borderTop: '1px solid #1a1a1a', color: '#666' }}>
        © 2026 De 0 a 100K seguidores · <a href="/terminos" className="underline" style={{ color: '#888' }}>Términos</a> · <a href="/privacidad" className="underline" style={{ color: '#888' }}>Privacidad</a>
      </footer>
    </main>
  );
}
