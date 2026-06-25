'use client';

import { useEffect, useMemo, useState } from 'react';

// ──────────────────────────────────────────────────────────────────────────
//  EDITÁ ESTO PARA TU EVENTO  (fecha, título, slug para identificar los leads)
// ──────────────────────────────────────────────────────────────────────────
const EVENT_DATE = new Date('2026-07-10T19:00:00-05:00'); // ← fecha y hora del evento
const EVENT_TITLE = 'Cómo encontrar contenido viral y crear videos que explotan con inteligencia artificial';
const EVENT_SLUG = 'masterclass-viraladn'; // identifica estos registros en tu mail/tabla

// TESTIMONIOS — pegá las URLs cuando las tengas (vacío = muestra placeholder):
// Servido desde Supabase Storage (los .mp4 de public/ están gitignoreados).
const TESTIMONIAL_VIDEO_URL = 'https://hkvzmtvifywmqfmjkeeq.supabase.co/storage/v1/object/public/media/testimonio-franc.mp4';
const TESTIMONIAL_IMAGES: string[] = []; // URLs de imágenes/capturas de testimonios
// ──────────────────────────────────────────────────────────────────────────

const COUNTRY_CODES = ['+52', '+57', '+51', '+54', '+593', '+56', '+591', '+507', '+1', '+34'];

function useCountdown(target: Date) {
  // now arranca en null → server y cliente renderizan 0 en el primer paint
  // (sin hydration mismatch); recién en el cliente, tras montar, corre el reloj.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = now === null ? 0 : Math.max(0, target.getTime() - now);
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
  };
}

const PURPLE = 'linear-gradient(135deg,#7c3aed,#c13584)';

// Renderiza el video de testimonios según la URL (YouTube/Vimeo → iframe, mp4 → video).
function TestimonialVideo({ url }: { url: string }) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  const embed = yt ? `https://www.youtube.com/embed/${yt[1]}` : vimeo ? `https://player.vimeo.com/video/${vimeo[1]}` : null;
  const box = { aspectRatio: '16/9', border: '1px solid #1f1f2b', borderRadius: 16 } as const;
  if (embed) {
    return <iframe src={embed} className="w-full" style={box} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />;
  }
  return <video src={url} controls className="w-full" style={{ ...box, background: '#000' }} />;
}

export default function EventoLanding() {
  const { days, hours, minutes, seconds } = useCountdown(EVENT_DATE);
  const [form, setForm] = useState({ name: '', email: '', countryCode: '+52', phone: '' });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'ok' | 'error'>('idle');

  const dateLabel = useMemo(
    () => EVENT_DATE.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }),
    [],
  );
  const timeLabel = useMemo(
    () => EVENT_DATE.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    [],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'submitting') return;
    if (!form.name || !form.email || !form.phone) { setStatus('error'); return; }
    setStatus('submitting');
    try {
      const r = await fetch('/api/evento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: `${form.countryCode} ${form.phone.trim()}`,
          event: EVENT_SLUG,
        }),
      });
      setStatus(r.ok ? 'ok' : 'error');
    } catch {
      setStatus('error');
    }
  }

  const input = 'w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors';
  const inputStyle = { background: '#0b0b14', border: '1px solid #2a2a3a', color: '#fff' } as const;

  return (
    <main className="min-h-screen text-white" style={{ background: 'radial-gradient(ellipse 100% 50% at 50% 0%, #1a0a2e 0%, transparent 55%), radial-gradient(ellipse 70% 40% at 85% 10%, #06243a 0%, transparent 55%), #070710' }}>
      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="ViralADN" width={32} height={32} style={{ filter: 'drop-shadow(0 0 14px #7c3aed66)' }} />
          <span className="text-lg font-bold">ViralADN <span style={{ color: '#5f5f6e' }}>✕</span> <span style={{ color: '#67e8f9' }}>TOPCUT</span></span>
        </div>
        <a href="#registro" className="hidden sm:inline-flex px-4 py-2 text-sm font-bold rounded-full" style={{ background: PURPLE, color: '#fff' }}>
          Reservar mi lugar
        </a>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-6 pb-16">
        {/* Pitch (ancho completo) */}
        <div className="max-w-3xl mb-10">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-5"
            style={{ background: '#7c3aed22', border: '1px solid #7c3aed55', color: '#c4b5fd' }}>
            🔴 CLASE EN VIVO · GRATIS
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-4">{EVENT_TITLE}</h1>
          <p className="text-base mb-4" style={{ color: '#b4b4c0' }}>
            En esta clase te muestro, paso a paso, cómo usar inteligencia artificial para encontrar lo que está
            explotando en YouTube, TikTok, Instagram y Facebook, convertirlo en guiones listos para grabar y
            editar tus videos en minutos.
          </p>
          <p className="text-base font-semibold" style={{ color: '#e9e9ee' }}>
            Es la misma metodología con la que <span style={{ color: '#c4b5fd' }}>Spencer Hoffmann</span> hizo
            crecer sus ventas.
          </p>
        </div>

        {/* Fila: video de testimonios (izquierda) + formulario (derecha) */}
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          {/* Izquierda: video de testimonios + countdown */}
          <div>
            <div className="mb-2 text-sm font-bold" style={{ color: '#67e8f9' }}>▶ Lo que dicen quienes ya lo aplican</div>
            {TESTIMONIAL_VIDEO_URL
              ? <TestimonialVideo url={TESTIMONIAL_VIDEO_URL} />
              : <div className="flex items-center justify-center text-center text-sm" style={{ aspectRatio: '16/9', background: '#0f0f17', border: '1px dashed #2a2a3a', borderRadius: 16, color: '#6b6b76' }}>🎬 Video de testimonios (próximamente)</div>}

            {/* Fecha + countdown */}
            <div className="rounded-2xl p-5 mt-5" style={{ background: 'linear-gradient(145deg,#14141f,#0d0d16)', border: '1px solid #23232f' }}>
              <div className="text-sm mb-3" style={{ color: '#e5e5ea' }}>
                📅 <b className="capitalize">{dateLabel}</b> · 🕖 {timeLabel} hs
              </div>
              <div className="flex gap-3">
                {[['Días', days], ['Hs', hours], ['Min', minutes], ['Seg', seconds]].map(([l, v]) => (
                  <div key={l as string} className="flex-1 text-center rounded-xl py-2" style={{ background: '#0b0b14', border: '1px solid #23232f' }}>
                    <div className="text-2xl font-extrabold" style={{ color: '#fff' }}>{String(v).padStart(2, '0')}</div>
                    <div className="text-[10px] uppercase tracking-wide" style={{ color: '#8b8b96' }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs mt-2" style={{ color: '#8b8b96' }}>Cupos limitados · queda grabada para los registrados</p>
          </div>

        {/* Derecha: formulario */}
        <div id="registro" className="rounded-3xl p-7" style={{ background: 'linear-gradient(145deg,#141414,#0d0d0d)', border: '1px solid #1f1f1f', boxShadow: '0 0 40px #7c3aed22' }}>
          {status === 'ok' ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-2xl font-bold mb-2">¡Registrado!</h2>
              <p className="text-sm" style={{ color: '#b4b4c0' }}>
                Te esperamos el <b className="capitalize">{dateLabel}</b> a las {timeLabel} hs. Revisa tu correo
                (y spam) — te enviaremos el enlace para entrar.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-1">Reserva tu lugar gratis</h2>
              <p className="text-sm mb-5" style={{ color: '#a1a1aa' }}>Completa tus datos y te mandamos el acceso.</p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <input className={input} style={inputStyle} placeholder="Tu nombre"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                <input className={input} style={inputStyle} type="email" placeholder="Tu mejor correo" autoComplete="email"
                  value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                <div className="flex gap-2">
                  <select className="px-3 py-3 rounded-xl text-sm outline-none" style={inputStyle}
                    value={form.countryCode} onChange={e => setForm({ ...form, countryCode: e.target.value })}>
                    {COUNTRY_CODES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input className={input} style={inputStyle} type="tel" placeholder="WhatsApp" inputMode="numeric"
                    value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/[^\d]/g, '') })} required />
                </div>
                {status === 'error' && (
                  <div className="text-xs rounded-lg px-3 py-2" style={{ background: '#7f1d1d22', border: '1px solid #7f1d1d55', color: '#fca5a5' }}>
                    Completa nombre, correo y WhatsApp para reservar.
                  </div>
                )}
                <button type="submit" disabled={status === 'submitting'}
                  className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-50 mt-1"
                  style={{ background: PURPLE, color: '#fff', boxShadow: '0 0 24px #7c3aed44' }}>
                  {status === 'submitting' ? 'Reservando…' : 'Reservar mi lugar gratis →'}
                </button>
                <p className="text-[11px] text-center" style={{ color: '#6b6b76' }}>
                  Tus datos están seguros. No spam — solo info del evento.
                </p>
              </form>
            </>
          )}
        </div>
        </div>
      </section>

      {/* Qué vas a aprender */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold text-center mb-8">Lo que vas a llevarte de la clase</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { i: '🔥', t: 'Encontrar lo viral en segundos', d: 'Cómo detectar qué está explotando en tu nicho en las 4 plataformas, sin perder horas scrolleando.' },
            { i: '✍️', t: 'Convertirlo en guiones', d: 'Transcribir cualquier video y adaptarlo a tu voz para grabar contenido que ya sabes que funciona.' },
            { i: '✂️', t: 'Editar con inteligencia artificial', d: 'Cortes, subtítulos y ritmo automáticos para publicar todos los días sin morir editando.' },
          ].map(c => (
            <div key={c.t} className="rounded-2xl p-5" style={{ background: '#0f0f17', border: '1px solid #1f1f2b' }}>
              <div className="text-3xl mb-3">{c.i}</div>
              <h3 className="font-bold mb-1">{c.t}</h3>
              <p className="text-sm" style={{ color: '#9a9aa6' }}>{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonios */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold text-center mb-2">Resultados de quienes ya lo aplican</h2>
        <p className="text-sm text-center mb-8" style={{ color: '#9a9aa6' }}>La metodología de Spencer Hoffmann, en acción.</p>
        <div className="max-w-2xl mx-auto mb-6">
          {TESTIMONIAL_VIDEO_URL ? (
            <TestimonialVideo url={TESTIMONIAL_VIDEO_URL} />
          ) : (
            <div className="flex items-center justify-center text-center text-sm" style={{ aspectRatio: '16/9', background: '#0f0f17', border: '1px dashed #2a2a3a', borderRadius: 16, color: '#6b6b76' }}>
              🎬 Video de testimonios (próximamente)
            </div>
          )}
        </div>
        {TESTIMONIAL_IMAGES.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TESTIMONIAL_IMAGES.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt={`Testimonio ${i + 1}`} className="w-full rounded-xl" style={{ border: '1px solid #1f1f2b' }} />
            ))}
          </div>
        )}
      </section>

      {/* Para quién + CTA final */}
      <section className="max-w-3xl mx-auto px-6 pb-20 text-center">
        <h2 className="text-2xl font-bold mb-3">¿Para quién es esta clase?</h2>
        <p className="text-base mb-8" style={{ color: '#b4b4c0' }}>
          Para creadores, emprendedores y negocios que quieren crecer en redes con contenido que funciona —
          sin adivinar, sin pasar el día entero produciendo. Si publicas (o querés empezar), esta clase es para ti.
        </p>
        <a href="#registro" className="inline-flex px-8 py-4 rounded-2xl text-sm font-bold" style={{ background: PURPLE, color: '#fff', boxShadow: '0 0 28px #7c3aed55' }}>
          Sí, quiero mi lugar gratis →
        </a>
      </section>

      <footer className="max-w-6xl mx-auto px-6 py-8 text-center text-xs" style={{ borderTop: '1px solid #1a1a1a', color: '#666' }}>
        © 2026 ViralADN ✕ TOPCUT · <a href="/terminos" className="underline" style={{ color: '#888' }}>Términos</a> · <a href="/privacidad" className="underline" style={{ color: '#888' }}>Privacidad</a>
      </footer>
    </main>
  );
}
