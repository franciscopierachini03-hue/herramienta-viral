'use client';

import { useEffect, useMemo, useState } from 'react';

const EVENT_DATE = new Date('2026-05-23T09:00:00-05:00');

const COUNTRIES = [
  { code: '+52', flag: '🇲🇽', name: 'México' },
  { code: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: '+57', flag: '🇨🇴', name: 'Colombia' },
  { code: '+56', flag: '🇨🇱', name: 'Chile' },
  { code: '+51', flag: '🇵🇪', name: 'Perú' },
  { code: '+593', flag: '🇪🇨', name: 'Ecuador' },
  { code: '+58', flag: '🇻🇪', name: 'Venezuela' },
  { code: '+506', flag: '🇨🇷', name: 'Costa Rica' },
  { code: '+507', flag: '🇵🇦', name: 'Panamá' },
  { code: '+502', flag: '🇬🇹', name: 'Guatemala' },
  { code: '+503', flag: '🇸🇻', name: 'El Salvador' },
  { code: '+504', flag: '🇭🇳', name: 'Honduras' },
  { code: '+505', flag: '🇳🇮', name: 'Nicaragua' },
  { code: '+1', flag: '🇺🇸', name: 'Estados Unidos' },
  { code: '+34', flag: '🇪🇸', name: 'España' },
];

const BENEFITS = [
  {
    icon: '💰',
    title: 'Monetiza tus redes desde cero',
    desc: 'Aprende los modelos de negocio probados para generar ingresos todos los días con el contenido que ya publicas.',
  },
  {
    icon: '🚀',
    title: 'Fórmulas virales probadas',
    desc: 'Los frameworks exactos que están usando los creadores #1 de habla hispana para llegar a millones orgánicamente.',
  },
  {
    icon: '🎯',
    title: 'Posicionamiento que vende',
    desc: 'Cómo construir una marca personal magnética que atrae clientes en automático sin perseguir a nadie.',
  },
  {
    icon: '🧠',
    title: 'Estrategia de contenido 2026',
    desc: 'Qué formatos están explotando este año y cómo adaptarlos a tu nicho sin perder tu voz.',
  },
  {
    icon: '🤝',
    title: 'Networking de alto nivel',
    desc: 'Un día entero rodeado de emprendedores, creadores y expertos que ya están monetizando en serio.',
  },
  {
    icon: '📈',
    title: 'Plan de acción en 1 día',
    desc: 'Sales con un roadmap claro para aplicar esa misma semana. Nada de teoría, todo ejecutable.',
  },
];

const SPEAKERS = [
  {
    name: 'Fer Anzures',
    role: 'Host del evento · Mentor en monetización digital',
    initials: 'FA',
    headliner: true,
  },
  {
    name: 'Spencer Hoffmann',
    role: 'Speaker invitado · Contexto Millonario',
    initials: 'SH',
  },
  {
    name: 'Top #1 en Viralidad',
    role: 'Creador +10M seguidores',
    initials: 'V1',
  },
  {
    name: 'Estratega de Marca Personal',
    role: 'Posicionamiento que vende',
    initials: 'MP',
  },
];

function useCountdown(target: Date) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, target.getTime() - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return { days, hours, minutes, seconds };
}

export default function ExmaSummitLanding() {
  const { days, hours, minutes, seconds } = useCountdown(EVENT_DATE);
  const [form, setForm] = useState({
    name: '',
    email: '',
    countryCode: '+52',
    phone: '',
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'ok' | 'error'>('idle');

  const eventDateLabel = useMemo(
    () =>
      EVENT_DATE.toLocaleDateString('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone) return;
    setStatus('submitting');
    try {
      const res = await fetch('/api/exma-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok) throw new Error('register_failed');
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0014] text-white overflow-x-hidden">
      {/* Header */}
      <header className="relative z-30 border-b border-white/5 backdrop-blur bg-black/40">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-xs uppercase tracking-[0.3em] text-white/70">Fer Anzures</span>
            <span className="text-white/30">·</span>
            <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-fuchsia-400 to-amber-300 bg-clip-text text-transparent">
              EXMA SUMMIT
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <span className="text-xs uppercase tracking-widest text-white/60">23 MAY · 9AM</span>
            <a
              href="#registro"
              className="inline-flex px-4 py-2 text-sm font-semibold rounded-full bg-white text-black hover:bg-amber-300 transition"
            >
              Registrarme
            </a>
          </div>
        </div>
      </header>

      {/* Hero + Form */}
      <section className="relative overflow-hidden">
        {/* Background stage image */}
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center opacity-90"
          style={{
            backgroundImage: "url('/hero-stage.jpg')",
            filter: 'brightness(1.6) saturate(1.1)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-[#0a0014]/30 via-[#0a0014]/55 to-[#0a0014]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(217,70,239,0.35),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(245,158,11,0.2),transparent_55%)]"
        />

        <div className="relative max-w-6xl mx-auto px-5 pt-12 pb-16">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            {/* Left column: copy + VSL */}
            <div className="relative z-10">
              <span className="inline-block px-3 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-400/30 text-fuchsia-200 text-xs font-semibold tracking-widest uppercase">
                1 día · En vivo · Cupos limitados
              </span>

              <p className="mt-6 text-xs sm:text-sm uppercase tracking-[0.3em] text-white/60">
                Fer Anzures presenta
              </p>
              <h1 className="mt-2 text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight">
                EXMA{' '}
                <span className="bg-gradient-to-r from-fuchsia-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
                  SUMMIT
                </span>
              </h1>
              <p className="mt-5 text-lg sm:text-xl font-semibold text-white/90 max-w-lg leading-snug">
                Aprende a monetizar tus redes y construir un negocio que te genere dinero todos los
                días <span className="text-amber-300">de forma orgánica</span>.
              </p>
              <p className="mt-4 text-sm text-white/70 max-w-lg">
                Un día junto a Fer Anzures y un lineup de invitados —incluyendo a{' '}
                <span className="text-white font-semibold">Spencer Hoffmann</span>— para que salgas
                con tu marca personal lista para vender.
              </p>

              {/* VSL slot */}
              <div className="mt-7 relative max-w-lg">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-fuchsia-500/40 to-amber-400/40 blur-xl" />
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/15 bg-black/70 backdrop-blur flex items-center justify-center">
                  {/* TODO: reemplazar por VSL */}
                  <div className="text-center px-6">
                    <div className="mx-auto w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-2xl">
                      ▶
                    </div>
                    <p className="mt-3 text-sm text-white/70">
                      Mira el mensaje de Fer antes de registrarte
                    </p>
                    <p className="text-xs text-white/40">Video próximamente</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right column: form */}
            <div className="relative">
              {/* Registration Form */}
              <div id="registro" className="relative z-10 mx-auto max-w-md">
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-fuchsia-500 to-amber-400 opacity-40 blur-xl" />
            <form
              onSubmit={handleSubmit}
              className="relative bg-black/70 backdrop-blur border border-white/10 rounded-3xl p-7 shadow-2xl"
            >
              <h2 className="text-2xl font-bold">Registrate GRATIS</h2>
              <p className="text-sm text-white/60 mt-1">
                Reserva tu lugar. Cupos limitados para el EXMA Summit.
              </p>

              <div className="mt-6 space-y-3">
                <input
                  type="text"
                  required
                  placeholder="Nombre completo"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-fuchsia-400 focus:outline-none placeholder:text-white/40"
                />
                <input
                  type="email"
                  required
                  placeholder="Correo electrónico"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-fuchsia-400 focus:outline-none placeholder:text-white/40"
                />
                <div className="flex gap-2">
                  <select
                    value={form.countryCode}
                    onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
                    className="px-3 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-fuchsia-400 focus:outline-none"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code + c.name} value={c.code} className="bg-black">
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    required
                    placeholder="WhatsApp"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-fuchsia-400 focus:outline-none placeholder:text-white/40"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={status === 'submitting'}
                className="mt-6 w-full py-4 rounded-xl font-bold text-black bg-gradient-to-r from-amber-300 via-pink-400 to-fuchsia-400 hover:opacity-90 transition disabled:opacity-60"
              >
                {status === 'submitting'
                  ? 'Reservando...'
                  : status === 'ok'
                    ? '✓ ¡Lugar reservado!'
                    : 'QUIERO MI BOLETO GRATIS'}
              </button>

              {status === 'ok' && (
                <p className="mt-3 text-sm text-emerald-300 text-center">
                  Revisa tu WhatsApp y correo con los detalles del evento.
                </p>
              )}
              {status === 'error' && (
                <p className="mt-3 text-sm text-red-300 text-center">
                  Hubo un error. Intenta de nuevo.
                </p>
              )}
              <p className="mt-3 text-[11px] text-white/40 text-center">
                Al registrarte aceptas recibir información del evento por correo y WhatsApp.
              </p>
            </form>
              </div>
            </div>
          </div>

          {/* Stats strip — aligned full-width below hero grid */}
          <div className="relative z-10 mt-14 pt-8 border-t border-white/10 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-white/50 uppercase tracking-widest text-[10px] sm:text-xs">Fecha</p>
              <p className="mt-1 font-semibold capitalize text-sm sm:text-base">{eventDateLabel}</p>
            </div>
            <div className="border-x border-white/10">
              <p className="text-white/50 uppercase tracking-widest text-[10px] sm:text-xs">Inicio</p>
              <p className="mt-1 font-semibold text-sm sm:text-base">9:00 AM</p>
            </div>
            <div>
              <p className="text-white/50 uppercase tracking-widest text-[10px] sm:text-xs">Modalidad</p>
              <p className="mt-1 font-semibold text-sm sm:text-base">Presencial + Streaming</p>
            </div>
          </div>
        </div>
      </section>


      {/* Countdown */}
      <section className="relative border-y border-white/5 bg-black/40">
        <div className="max-w-6xl mx-auto px-5 py-10 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">El evento inicia en</p>
          <div className="mt-5 flex justify-center gap-3 sm:gap-6">
            {[
              { label: 'Días', value: days },
              { label: 'Horas', value: hours },
              { label: 'Min', value: minutes },
              { label: 'Seg', value: seconds },
            ].map((u) => (
              <div
                key={u.label}
                className="min-w-[70px] sm:min-w-[100px] px-3 py-4 rounded-2xl bg-gradient-to-b from-white/10 to-white/0 border border-white/10"
              >
                <div className="text-3xl sm:text-5xl font-black tabular-nums">
                  {String(u.value).padStart(2, '0')}
                </div>
                <div className="mt-1 text-[10px] sm:text-xs uppercase tracking-widest text-white/50">
                  {u.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sobre Fer Anzures — Authority */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,rgba(217,70,239,0.18),transparent_55%),radial-gradient(ellipse_at_right,rgba(245,158,11,0.12),transparent_55%)]"
        />
        <div className="relative max-w-6xl mx-auto px-5 py-20 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-16 items-center">
          {/* Fer photo */}
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(217,70,239,0.35),transparent_60%)] blur-3xl"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/fer-anzures.png?v=2"
              alt="Fer Anzures"
              className="relative w-full max-w-md mx-auto drop-shadow-[0_30px_60px_rgba(0,0,0,0.5)] [mask-image:linear-gradient(to_bottom,black_70%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_70%,transparent_100%)]"
            />
          </div>

          {/* Bio + credentials */}
          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-amber-400/10 border border-amber-300/30 text-amber-200 text-xs font-semibold tracking-widest uppercase">
              Tu host del evento
            </span>
            <h2 className="mt-5 text-4xl sm:text-5xl font-black tracking-tight leading-[1.05]">
              Fer Anzures,{' '}
              <span className="bg-gradient-to-r from-fuchsia-400 to-amber-300 bg-clip-text text-transparent">
                la voz #1 en monetización digital
              </span>{' '}
              de habla hispana
            </h2>
            <p className="mt-5 text-lg text-white/75 leading-relaxed">
              Fer lleva más de una década ayudando a emprendedores, creadores y marcas a convertir
              sus redes sociales en un negocio que genera dinero todos los días, sin pauta y sin
              depender de algoritmos.
            </p>
            <p className="mt-4 text-base text-white/60 leading-relaxed">
              Ha construido una comunidad global alrededor de una idea simple: tu marca personal es
              el activo más rentable del siglo XXI, y se puede sistematizar. En el EXMA Summit te
              va a mostrar exactamente cómo.
            </p>

            {/* Stats */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { value: '+10', label: 'Años formando creadores' },
                { value: '+50K', label: 'Estudiantes formados' },
                { value: '+20', label: 'Países alcanzados' },
              ].map((s) => (
                <div
                  key={s.label}
                  className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col items-center justify-center text-center min-h-[130px]"
                >
                  <p className="text-4xl sm:text-5xl font-black leading-none whitespace-nowrap bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
                    {s.value}
                  </p>
                  <p className="mt-2 text-[11px] text-white/55 uppercase tracking-wider leading-tight">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Highlights */}
            <ul className="mt-7 space-y-3 text-sm text-white/80">
              <li className="flex gap-3">
                <span className="text-amber-300 font-black">★</span>
                Conferencista invitado en los eventos de negocios más importantes de Latinoamérica.
              </li>
              <li className="flex gap-3">
                <span className="text-amber-300 font-black">★</span>
                Mentor de creadores que hoy facturan 6 y 7 cifras con marca personal.
              </li>
              <li className="flex gap-3">
                <span className="text-amber-300 font-black">★</span>
                Arquitecto del método EXMA: el framework para monetizar redes de forma orgánica.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-6xl mx-auto px-5 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
            Qué vas a llevarte
            <br />
            <span className="bg-gradient-to-r from-fuchsia-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
              del EXMA Summit
            </span>
          </h2>
          <p className="mt-4 text-white/70">
            Un día diseñado para que salgas con un negocio digital funcionando, no con una libreta
            llena de teoría.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-fuchsia-400/40 hover:bg-white/[0.06] transition"
            >
              <div className="text-3xl">{b.icon}</div>
              <h3 className="mt-4 text-lg font-bold">{b.title}</h3>
              <p className="mt-2 text-sm text-white/60 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Speakers */}
      <section className="relative bg-gradient-to-b from-transparent via-fuchsia-950/20 to-transparent border-y border-white/5">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-xs uppercase tracking-[0.3em] text-fuchsia-300">
              Line-up de expertos
            </span>
            <h2 className="mt-3 text-3xl sm:text-5xl font-black tracking-tight">
              Los #1 en monetización y viralidad en un mismo escenario
            </h2>
          </div>

          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SPEAKERS.map((s) => (
              <div
                key={s.name}
                className="group p-6 rounded-2xl bg-black/60 border border-white/10 text-center"
              >
                <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-fuchsia-500 to-amber-400 flex items-center justify-center text-2xl font-black">
                  {s.initials}
                </div>
                <h3 className="mt-4 font-bold">{s.name}</h3>
                <p className="text-sm text-white/60">{s.role}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-white/50">
            Lista completa de speakers se revelará en los próximos días.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative">
        <div className="max-w-4xl mx-auto px-5 py-20 text-center">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
            Un día puede cambiar tu forma de hacer dinero en redes
          </h2>
          <p className="mt-4 text-white/70">
            Los cupos son limitados y se cierran apenas se llenan. Reserva el tuyo antes de que se
            acabe.
          </p>
          <a
            href="#registro"
            className="mt-8 inline-block px-10 py-4 rounded-full bg-gradient-to-r from-amber-300 via-pink-400 to-fuchsia-400 text-black font-bold hover:opacity-90 transition"
          >
            REGISTRARME GRATIS →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-white/50">
          <p>© {new Date().getFullYear()} EXMA Summit. Todos los derechos reservados.</p>
          <div className="flex gap-5">
            <a href="#" className="hover:text-white">
              Términos
            </a>
            <a href="#" className="hover:text-white">
              Privacidad
            </a>
            <a href="#" className="hover:text-white">
              Contacto
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
