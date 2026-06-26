'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { EVENT_DATE, EVENT_TITLE, EVENT_DATE_LABEL, EVENT_TIME_LABEL } from './event-config';

// TESTIMONIOS — pegá las URLs cuando las tengas (vacío = muestra placeholder):
// Servido desde Supabase Storage (los .mp4 de public/ están gitignoreados).
const TESTIMONIAL_VIDEO_URL = 'https://hkvzmtvifywmqfmjkeeq.supabase.co/storage/v1/object/public/media/testimonio-franc.mp4';
// Imagen de crecimiento de Spencer Hoffmann (creador del método): antes/después.
const SPENCER_IMG = 'https://hkvzmtvifywmqfmjkeeq.supabase.co/storage/v1/object/public/media/spencer-crecimiento.jpg';

// Capturas de cuentas que crecieron → Supabase Storage. Vienen ORDENADAS de mayor
// a menor seguidores (01 = más … 38 = menos), normalizadas al mismo lienzo
// (750×440, fondo negro) para que todas ocupen exactamente el mismo espacio.
// Para quitar una cuenta, suma su número de orden a este set:
const REMOVED_SEGUIDORES = new Set([1]); // 1 = jorgeserratosf (quitada a pedido)
const TESTIMONIAL_IMAGES: string[] = Array.from({ length: 38 }, (_, i) => i + 1)
  .filter((n) => !REMOVED_SEGUIDORES.has(n))
  .map((n) => `https://hkvzmtvifywmqfmjkeeq.supabase.co/storage/v1/object/public/media/seguidores/${String(n).padStart(2, '0')}.jpg?v=2`);
// ──────────────────────────────────────────────────────────────────────────

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
  const dateLabel = EVENT_DATE_LABEL;
  const timeLabel = EVENT_TIME_LABEL;

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
          <div className="flex flex-wrap gap-2 mb-5">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: '#7c3aed22', border: '1px solid #7c3aed55', color: '#c4b5fd' }}>
              🔴 EN VIVO · GRATIS
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: '#10b98122', border: '1px solid #10b98155', color: '#6ee7b7' }}>
              🎟️ Exclusivo para la comunidad de Spencer Hoffmann
            </span>
          </div>
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

        {/* Derecha: formulario de LeadConnector (CRM 2Clicks) */}
        <div>
          <div id="registro" className="rounded-3xl overflow-hidden" style={{ border: '1px solid #1f1f1f', boxShadow: '0 0 40px #7c3aed22', background: '#fff' }}>
            <iframe
              src="https://api.leadconnectorhq.com/widget/form/FeBsauI9yRjhYycW1CJY"
              style={{ width: '100%', height: 640, border: 'none', display: 'block' }}
              id="inline-FeBsauI9yRjhYycW1CJY"
              data-layout="{'id':'INLINE'}"
              data-trigger-type="alwaysShow"
              data-trigger-value=""
              data-activation-type="alwaysActivated"
              data-activation-value=""
              data-deactivation-type="neverDeactivate"
              data-deactivation-value=""
              data-form-name="Registro evento ViralADN"
              data-height="640"
              data-layout-iframe-id="inline-FeBsauI9yRjhYycW1CJY"
              data-form-id="FeBsauI9yRjhYycW1CJY"
              title="Registro evento ViralADN"
            />
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap text-[11px] mt-3" style={{ color: '#9a9aa6' }}>
            <span>✅ 100% gratis</span>
            <span>✅ Sin tarjeta</span>
            <span>✅ Queda grabada</span>
          </div>
          {/* Script de auto-ajuste de altura del formulario embebido */}
          <Script src="https://link.msgsndr.com/js/form_embed.js" strategy="afterInteractive" />
        </div>
        </div>
      </section>

      {/* Qué vas a aprender */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold text-center mb-8">Lo que vas a llevarte de la clase</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { i: '🔥', t: 'Encontrar lo viral en segundos', d: 'Cómo detectar qué está explotando en tu nicho en las 4 plataformas, sin perder horas scrolleando.' },
            { i: '✍️', t: 'Convertirlo en guiones', d: 'Transcribir cualquier video y adaptarlo a tu voz para grabar contenido que ya sabes que funciona.' },
            { i: '✂️', t: 'Editar con inteligencia artificial', d: 'Cortes, subtítulos y ritmo automáticos para publicar todos los días sin morir editando.' },
            { i: '🚀', t: 'Publicar y crecer', d: 'Cuándo, dónde y cómo publicar para que cada video llegue a más personas y tu cuenta crezca de forma constante.' },
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
        <a href={SPENCER_IMG} target="_blank" rel="noopener" className="block max-w-3xl mx-auto rounded-2xl overflow-hidden mb-6 group"
          style={{ border: '1px solid #1f3a2b', boxShadow: '0 10px 34px #0009' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SPENCER_IMG} alt="Spencer Hoffmann: de 260 mil a 2.6 millones de seguidores"
            className="w-full block transition-transform duration-300 group-hover:scale-[1.03]" />
        </a>
        {TESTIMONIAL_IMAGES.length > 0 && (
          <>
            <h3 className="text-xl font-bold text-center mt-14 mb-7">Otras personas que aplicaron la metodología</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TESTIMONIAL_IMAGES.map((src, i) => (
                <a key={i} href={src} target="_blank" rel="noopener" className="block rounded-2xl overflow-hidden group"
                  style={{ border: '1px solid #1f1f2b', background: '#000', boxShadow: '0 6px 24px #0006' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Cuenta ${i + 1}`} loading="lazy"
                    className="w-full block transition-transform duration-300 group-hover:scale-[1.04]"
                    style={{ aspectRatio: '750 / 440', objectFit: 'cover' }} />
                </a>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Para quién + CTA final */}
      <section className="max-w-3xl mx-auto px-6 pb-20 text-center">
        <h2 className="text-2xl font-bold mb-3">¿Para quién es esta clase?</h2>
        <p className="text-base mb-8" style={{ color: '#b4b4c0' }}>
          Para creadores, emprendedores y negocios que quieren crecer en redes con contenido que funciona —
          sin adivinar, sin pasar el día entero produciendo. Si publicas (o quieres empezar), esta clase es para ti.
        </p>
        <a href="#registro" className="inline-flex px-8 py-4 rounded-2xl text-sm font-bold" style={{ background: PURPLE, color: '#fff', boxShadow: '0 0 28px #7c3aed55' }}>
          Sí, quiero mi lugar gratis →
        </a>
      </section>

      <footer className="max-w-6xl mx-auto px-6 pt-8 pb-28 lg:pb-8 text-center text-xs" style={{ borderTop: '1px solid #1a1a1a', color: '#666' }}>
        © 2026 ViralADN ✕ TOPCUT · <a href="/terminos" className="underline" style={{ color: '#888' }}>Términos</a> · <a href="/privacidad" className="underline" style={{ color: '#888' }}>Privacidad</a>
      </footer>

      {/* CTA fija en mobile (la mayoría del tráfico viene de WhatsApp en celular) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-4 py-3"
        style={{ background: 'rgba(7,7,16,0.92)', backdropFilter: 'blur(8px)', borderTop: '1px solid #1f1f2b' }}>
        <a href="#registro" className="flex items-center justify-center w-full py-3 rounded-2xl text-sm font-bold"
          style={{ background: PURPLE, color: '#fff', boxShadow: '0 0 24px #7c3aed55' }}>
          Reservar mi lugar gratis →
        </a>
      </div>
    </main>
  );
}
