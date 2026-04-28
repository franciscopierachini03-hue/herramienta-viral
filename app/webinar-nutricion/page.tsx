'use client';

import { useEffect, useMemo, useState } from 'react';

const EVENT_DATE = new Date('2026-06-14T10:00:00-05:00');

const COUNTRIES = [
  { code: '+52', flag: '🇲🇽', name: 'México' },
  { code: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: '+57', flag: '🇨🇴', name: 'Colombia' },
  { code: '+56', flag: '🇨🇱', name: 'Chile' },
  { code: '+51', flag: '🇵🇪', name: 'Perú' },
  { code: '+593', flag: '🇪🇨', name: 'Ecuador' },
  { code: '+58', flag: '🇻🇪', name: 'Venezuela' },
  { code: '+506', flag: '🇨🇷', name: 'Costa Rica' },
  { code: '+1', flag: '🇺🇸', name: 'Estados Unidos' },
  { code: '+34', flag: '🇪🇸', name: 'España' },
];

const PAINS = [
  'Sientes que tus hijos no comen bien y no sabes por dónde empezar a cambiarlo',
  'Estás agotada aunque duermas, y te cuesta tener energía para tu familia',
  'Cocinas "sano" pero en casa hay inflamación, antojos o sobrepeso',
  'Te abruma tanta información contradictoria sobre qué darles de comer',
  'Quieres transformar la salud de tu familia pero no quieres vivir a dieta',
];

const BENEFITS = [
  {
    icon: '👩‍👧‍👦',
    title: 'Cómo nutrir a tu familia sin vivir en la cocina',
    desc: 'El marco simple para que mamá, hijos y pareja coman mejor sin preparar 3 menús distintos.',
  },
  {
    icon: '⚡',
    title: 'Recupera tu energía de mamá',
    desc: 'Por qué estás tan cansada aunque "comas bien" — y los ajustes reales que devuelven energía estable todo el día.',
  },
  {
    icon: '🧒',
    title: 'Qué hacer si tu hijo no está bien nutrido',
    desc: 'Señales que casi nadie te dice, y por dónde empezar sin pelear en cada comida.',
  },
  {
    icon: '🥗',
    title: 'Los pilares del bienestar natural',
    desc: 'Alimentación, descanso, movimiento e hidratación adaptados a la vida real de una madre.',
  },
  {
    icon: '🗺️',
    title: 'Tu ruta de acción para los próximos 21 días',
    desc: 'Sales con un plan concreto que puedes aplicar desde la cena de hoy — sin culpa y sin dietas.',
  },
];

const AGENDA = [
  { time: '10:00', title: 'Apertura: por qué tu hijo (y tú) no están bien nutridos' },
  { time: '10:45', title: 'Los pilares de la nutrición moderna en la vida real de una mamá' },
  { time: '12:00', title: 'Taller: arma el plato de tu familia' },
  { time: '13:30', title: 'Break' },
  { time: '14:00', title: 'Casos reales: mamás que transformaron su casa' },
  { time: '15:30', title: 'Cómo sostener el cambio sin pelear en cada comida' },
  { time: '16:30', title: 'Q&A en vivo con Luisana y próximos pasos' },
];

const TESTIMONIALS = [
  {
    name: 'María G.',
    role: 'Mamá de 2, Bogotá',
    quote: 'En 3 semanas mis hijos dejaron de pedir azúcar todo el día y yo recuperé la energía que creía perdida.',
    initials: 'MG',
  },
  {
    name: 'Andrea R.',
    role: 'Mamá de 3, CDMX',
    quote: 'Dejé de cocinar 3 menús distintos. Ahora comemos lo mismo en casa y todos estamos mejor — incluida yo.',
    initials: 'AR',
  },
  {
    name: 'Lucía P.',
    role: 'Mamá primeriza, Medellín',
    quote: 'Por fin entendí qué darle a mi bebé sin culpa ni miedo. Luisana explica como si fuera tu amiga.',
    initials: 'LP',
  },
];

const BONUSES = [
  { title: 'Guía PDF: 7 días de menú familiar', desc: 'Desayunos, almuerzos y cenas para toda la casa con lista de compras.' },
  { title: 'Plantilla "Plato de mi familia"', desc: 'Imprimible para la cocina. Hasta los niños entienden en 5 segundos.' },
  { title: 'Acceso a la comunidad "Mamitas"', desc: 'Grupo privado de WhatsApp con acompañamiento por 30 días.' },
];

const FAQ = [
  {
    q: '¿Es realmente gratis?',
    a: 'Sí, 100% gratis. Solo pedimos tu compromiso de asistir en vivo porque no habrá grabación.',
  },
  {
    q: '¿Habrá grabación?',
    a: 'No. Este taller es en vivo una sola vez para mantener la energía y el compromiso del grupo.',
  },
  {
    q: '¿Necesito experiencia previa en nutrición?',
    a: 'Ninguna. Empezamos desde los conceptos base, con ejemplos cotidianos.',
  },
  {
    q: '¿Desde dónde se transmite?',
    a: 'Zoom en vivo. Recibirás el link por correo y WhatsApp 24 horas antes.',
  },
  {
    q: '¿Recibo certificado?',
    a: 'Sí, un certificado de asistencia digital al finalizar el taller.',
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

export default function WebinarNutricionLanding() {
  const { days, hours, minutes, seconds } = useCountdown(EVENT_DATE);
  const [form, setForm] = useState({
    name: '',
    email: '',
    countryCode: '+52',
    phone: '',
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'ok' | 'error'>('idle');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

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
      await new Promise((r) => setTimeout(r, 800));
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  }

  return (
    <main className="min-h-screen bg-[#0b1410] text-white overflow-x-hidden">
      {/* Header */}
      <header className="relative z-20 border-b border-white/5 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-emerald-300 to-lime-300 bg-clip-text text-transparent">
              NUTRICIÓN
            </span>
            <span className="text-xs uppercase tracking-[0.3em] text-white/60">Moderna</span>
          </div>
          <a
            href="#registro"
            className="hidden sm:inline-flex px-4 py-2 text-sm font-semibold rounded-full bg-lime-300 text-black hover:bg-lime-200 transition"
          >
            Reservar mi lugar
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(52,211,153,0.2),transparent_50%),radial-gradient(circle_at_80%_30%,rgba(163,230,53,0.15),transparent_50%)]" />
        <div className="relative max-w-6xl mx-auto px-5 pt-14 pb-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-widest text-lime-300 bg-lime-300/10 border border-lime-300/30 rounded-full">
              Masterclass gratuita en vivo
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight">
              Mamita, transforma la{' '}
              <span className="bg-gradient-to-r from-emerald-300 to-lime-300 bg-clip-text text-transparent">
                salud de tu familia
              </span>{' '}
              (y la tuya) desde la próxima comida
            </h1>
            <p className="mt-5 text-lg text-white/70 leading-relaxed">
              Masterclass en vivo con la Lic. Luisana Perozo. Aprende los fundamentos de la nutrición moderna para
              nutrir a tus hijos, recuperar tu energía y vivir con bienestar — sin dietas ni culpa.
            </p>

            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10">📅 {eventDateLabel}</span>
              <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10">🕙 10:00 AM (CDMX)</span>
              <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10">💻 Zoom en vivo</span>
              <span className="px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-300">
                ⚠ Sin grabación
              </span>
            </div>

            <div className="mt-8 grid grid-cols-4 gap-3 max-w-md">
              {[
                { label: 'Días', value: days },
                { label: 'Horas', value: hours },
                { label: 'Min', value: minutes },
                { label: 'Seg', value: seconds },
              ].map((t) => (
                <div key={t.label} className="rounded-xl bg-white/5 border border-white/10 py-3 text-center">
                  <div className="text-3xl font-black tabular-nums">{String(t.value).padStart(2, '0')}</div>
                  <div className="text-[10px] uppercase tracking-widest text-white/50 mt-1">{t.label}</div>
                </div>
              ))}
            </div>

            <a
              href="#registro"
              className="mt-8 inline-flex items-center gap-2 px-6 py-4 rounded-full bg-lime-300 text-black font-bold text-lg hover:bg-lime-200 transition shadow-lg shadow-lime-300/20"
            >
              Quiero mi acceso gratuito →
            </a>
            <p className="mt-3 text-xs text-white/50">Más de 10,000 mamás ya transformaron su casa con Luisana</p>
          </div>

          {/* Video placeholder */}
          <div className="relative aspect-[4/5] max-w-md mx-auto w-full rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-emerald-900/40 to-lime-900/20 flex items-center justify-center">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(163,230,53,0.2),transparent_70%)]" />
            <div className="relative text-center px-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-lime-300 text-black flex items-center justify-center text-3xl shadow-xl">
                ▶
              </div>
              <p className="mt-4 text-sm text-white/70">Video del expositor (20s)</p>
              <p className="text-xs text-white/40 mt-1">Placeholder — agregar MP4</p>
            </div>
          </div>
        </div>
      </section>

      {/* Prueba social / logos */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-white/40">
          <span className="text-xs uppercase tracking-widest">Mencionado en</span>
          {['Forbes', 'El Tiempo', 'Semana', 'CNN', 'Mindful'].map((m) => (
            <span key={m} className="font-serif italic text-xl">
              {m}
            </span>
          ))}
        </div>
      </section>

      {/* Dolores */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-5">
          <h2 className="text-3xl sm:text-4xl font-black text-center">¿Te pasa esto, mamita?</h2>
          <p className="text-center text-white/60 mt-3">Si marcaste al menos uno, este taller es para ti.</p>
          <div className="mt-10 grid sm:grid-cols-2 gap-4">
            {PAINS.map((p, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-5 rounded-2xl bg-white/[0.03] border border-white/10"
              >
                <span className="text-red-400 text-xl leading-none">✗</span>
                <p className="text-white/80">{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section className="py-20 bg-gradient-to-b from-transparent via-emerald-950/30 to-transparent">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center">
            <span className="text-xs uppercase tracking-widest text-lime-300">Qué vas a aprender</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black">Lo que te llevarás como mamá</h2>
          </div>
          <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="p-6 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-lime-300/40 transition"
              >
                <div className="text-4xl">{b.icon}</div>
                <h3 className="mt-4 font-bold text-lg">{b.title}</h3>
                <p className="mt-2 text-sm text-white/60 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agenda */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-5">
          <div className="text-center">
            <span className="text-xs uppercase tracking-widest text-lime-300">Agenda del día</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black">8 horas de inmersión total</h2>
          </div>
          <div className="mt-12 space-y-3">
            {AGENDA.map((a, i) => (
              <div
                key={i}
                className="flex gap-5 p-5 rounded-2xl bg-white/[0.03] border border-white/10 items-center"
              >
                <div className="text-lime-300 font-black text-lg tabular-nums w-16">{a.time}</div>
                <div className="h-8 w-px bg-white/10" />
                <div className="text-white/80">{a.title}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Expositor */}
      <section className="py-20 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-5 grid md:grid-cols-[1fr_2fr] gap-10 items-center">
          <div className="aspect-square max-w-xs w-full mx-auto rounded-3xl bg-gradient-to-br from-emerald-700/40 to-lime-500/20 border border-white/10 flex items-center justify-center text-6xl font-black">
            LU
          </div>
          <div>
            <span className="text-xs uppercase tracking-widest text-lime-300">Tu expositora</span>
            <h2 className="mt-3 text-3xl font-black">Lic. Luisana Perozo</h2>
            <p className="mt-2 text-white/60">Coach en Nutrición Moderna y Bienestar Natural</p>
            <p className="mt-5 text-white/80 leading-relaxed">
              Luisana entrena a madres a transformar su vida y la de su familia a través de la nutrición. Autora del
              libro <em>"SOS Mamá. Tu HIJO no está bien nutrido y TÚ tampoco"</em> y creadora del reto{' '}
              <em>"21 días contigo Mamita"</em>, acompaña a miles de mamás en Latinoamérica a recuperar su energía y
              nutrir a sus hijos sin dietas ni culpa.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              {['Nutrición Moderna', 'Bienestar Natural', 'Autora del libro SOS Mamá', 'Reto 21 días'].map((t) => (
                <span key={t} className="px-3 py-1 rounded-full bg-lime-300/10 border border-lime-300/30 text-lime-200">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonios */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-5">
          <h2 className="text-3xl sm:text-4xl font-black text-center">Lo que dicen quienes ya lo vivieron</h2>
          <div className="mt-12 grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="p-6 rounded-2xl bg-white/[0.04] border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-lime-400 flex items-center justify-center text-black font-black">
                    {t.initials}
                  </div>
                  <div>
                    <div className="font-bold">{t.name}</div>
                    <div className="text-xs text-white/50">{t.role}</div>
                  </div>
                </div>
                <p className="mt-4 text-white/80 leading-relaxed">"{t.quote}"</p>
                <div className="mt-3 text-amber-300">★★★★★</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bonus */}
      <section className="py-20 bg-gradient-to-b from-transparent via-lime-950/20 to-transparent">
        <div className="max-w-4xl mx-auto px-5">
          <div className="text-center">
            <span className="text-xs uppercase tracking-widest text-lime-300">Bonos exclusivos</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black">Si asistes en vivo, te llevas:</h2>
          </div>
          <div className="mt-10 space-y-4">
            {BONUSES.map((b, i) => (
              <div
                key={i}
                className="flex items-start gap-5 p-6 rounded-2xl bg-white/[0.04] border border-lime-300/20"
              >
                <div className="w-12 h-12 rounded-full bg-lime-300 text-black flex items-center justify-center font-black text-xl shrink-0">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{b.title}</h3>
                  <p className="text-sm text-white/60 mt-1">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-5">
          <h2 className="text-3xl sm:text-4xl font-black text-center">Preguntas frecuentes</h2>
          <div className="mt-10 space-y-3">
            {FAQ.map((item, i) => (
              <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-white/[0.02]"
                >
                  <span className="font-semibold">{item.q}</span>
                  <span className="text-lime-300 text-xl">{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-white/70 leading-relaxed">{item.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Registro */}
      <section id="registro" className="py-20 bg-gradient-to-b from-emerald-950/40 to-[#0b1410]">
        <div className="max-w-xl mx-auto px-5">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-black">Reserva tu lugar gratis</h2>
            <p className="mt-3 text-white/70">Cupos limitados. No habrá grabación.</p>
            <div className="mt-6 inline-flex gap-2 text-sm">
              <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                ⏰ Quedan {days}d {hours}h
              </span>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-8 p-6 rounded-3xl bg-white/[0.04] border border-white/10 space-y-4"
          >
            <div>
              <label className="text-xs uppercase tracking-widest text-white/50">Nombre completo</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-lime-300 outline-none"
                placeholder="Tu nombre"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-white/50">Correo</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-lime-300 outline-none"
                placeholder="tu@correo.com"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-white/50">WhatsApp</label>
              <div className="mt-1 flex gap-2">
                <select
                  value={form.countryCode}
                  onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
                  className="px-3 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-lime-300 outline-none"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code} className="bg-[#0b1410]">
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-lime-300 outline-none"
                  placeholder="Número"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full py-4 rounded-xl bg-lime-300 text-black font-bold text-lg hover:bg-lime-200 transition disabled:opacity-60"
            >
              {status === 'submitting'
                ? 'Enviando...'
                : status === 'ok'
                ? '✓ ¡Te esperamos!'
                : 'Confirmar mi lugar gratis'}
            </button>
            <p className="text-xs text-white/40 text-center">
              Al registrarte aceptas recibir comunicaciones del webinar. Sin spam.
            </p>
          </form>
        </div>
      </section>

      <footer className="py-10 border-t border-white/5 text-center text-white/40 text-sm">
        © 2026 Nutrición Moderna — Maqueta en construcción
      </footer>

      {/* Sticky mobile CTA */}
      <a
        href="#registro"
        className="sm:hidden fixed bottom-4 left-4 right-4 z-30 py-4 rounded-full bg-lime-300 text-black font-bold text-center shadow-xl shadow-lime-300/30"
      >
        Reservar mi lugar gratis →
      </a>
    </main>
  );
}
