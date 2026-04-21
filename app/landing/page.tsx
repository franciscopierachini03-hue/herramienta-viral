'use client';
import { useState } from 'react';

const FEATURES = [
  {
    icon: '⚡',
    title: 'Transcripción instantánea',
    desc: 'Pega el link de cualquier video y obtén el guión completo en segundos. YouTube, TikTok e Instagram.',
  },
  {
    icon: '🔥',
    title: 'Detecta lo viral',
    desc: 'Busca por tema y encuentra el top 10 de videos más virales de cada plataforma al mismo tiempo.',
  },
  {
    icon: '📚',
    title: 'Biblioteca de guiones',
    desc: 'Guarda los guiones que más te gusten, organízalos y cópialos cuando los necesites.',
  },
  {
    icon: '🤖',
    title: 'Filtro inteligente',
    desc: 'Nuestro algoritmo descarta memes, canciones y contenido de entretenimiento. Solo contenido que aporta valor.',
  },
  {
    icon: '🌍',
    title: '3 plataformas, 1 búsqueda',
    desc: 'Un solo tema y obtienes los mejores Shorts, Reels y TikToks virales al mismo tiempo.',
  },
  {
    icon: '🎯',
    title: 'Listo para publicar',
    desc: 'Adapta el guión a tu voz, graba y publica. Así de simple es crear contenido viral.',
  },
];

const PLANS = [
  {
    name: 'Gratis',
    price: '$0',
    period: 'para siempre',
    color: 'border-gray-700',
    btnClass: 'border border-gray-600 text-gray-300 hover:border-gray-400',
    features: [
      '5 transcripciones al mes',
      'Búsqueda de virales limitada',
      'Biblioteca de guiones',
      'YouTube únicamente',
    ],
    cta: 'Empezar gratis',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$19',
    period: 'al mes',
    color: 'border-white',
    btnClass: 'bg-white text-gray-900 hover:bg-gray-100',
    features: [
      '100 transcripciones al mes',
      'Búsqueda ilimitada de virales',
      'YouTube + TikTok + Instagram',
      'Biblioteca ilimitada',
      'Filtro inteligente de contenido',
      'Soporte prioritario',
    ],
    cta: 'Empezar prueba gratis 7 días',
    highlight: true,
  },
  {
    name: 'Agencia',
    price: '$49',
    period: 'al mes',
    color: 'border-gray-700',
    btnClass: 'border border-gray-600 text-gray-300 hover:border-gray-400',
    features: [
      'Transcripciones ilimitadas',
      'Múltiples links a la vez',
      'Acceso completo a las 3 plataformas',
      'Biblioteca ilimitada',
      'API access (próximamente)',
      'Soporte dedicado',
    ],
    cta: 'Hablar con ventas',
    highlight: false,
  },
];

const HOW = [
  { step: '01', title: 'Busca tu tema', desc: 'Escribe un tema — fitness, negocios, dinero — y encuentra los videos más virales de YouTube, TikTok e Instagram.' },
  { step: '02', title: 'Transcribe en un clic', desc: 'Haz clic en "Transcribir" sobre cualquier video viral y obtén el guión completo en segundos.' },
  { step: '03', title: 'Guarda y adapta', desc: 'Guarda los guiones que más te gusten en tu biblioteca, adáptalos a tu voz y publícalos.' },
];

export default function Landing() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* NAV */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <span className="text-lg font-bold">🧬 ViralADN</span>
        <div className="flex items-center gap-4">
          <a href="#precios" className="text-sm text-gray-400 hover:text-white transition-colors">Precios</a>
          <a href="/app" className="px-4 py-1.5 border border-gray-600 rounded-lg text-sm hover:border-gray-400 transition-colors">
            Ver demo →
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="text-center px-6 pt-20 pb-24 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-700 text-xs text-gray-400 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
          Nuevo — Búsqueda multi-plataforma con IA
        </div>

        <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
          Encuentra lo viral.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-pink-400 to-purple-400">
            Crea contenido que explota.
          </span>
        </h1>

        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          Transcribe cualquier video de YouTube, TikTok o Instagram en segundos.
          Descubre qué está funcionando en tu nicho y adapta los mejores guiones a tu voz.
        </p>

        {submitted ? (
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-950 border border-green-700 rounded-xl text-green-300 text-sm">
            ✅ ¡Listo! Te avisamos cuando abramos acceso.
          </div>
        ) : (
          <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-500"
              required
            />
            <button type="submit"
              className="px-6 py-3 bg-white text-gray-900 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors whitespace-nowrap">
              Quiero acceso gratis →
            </button>
          </form>
        )}
        <p className="text-xs text-gray-600 mt-3">Sin tarjeta de crédito. 7 días gratis en el plan Pro.</p>

        {/* Demo preview */}
        <div className="mt-16 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-950 z-10 pointer-events-none" style={{ top: '60%' }}></div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left shadow-2xl">
            <div className="flex gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <div className="flex gap-2 mb-4">
              <div className="h-8 bg-gray-800 rounded-lg flex-1 flex items-center px-3">
                <span className="text-xs text-gray-500">Buscar en todas las plataformas... (ej: fitness, dinero, motivacion)</span>
              </div>
              <div className="h-8 bg-white rounded-lg px-4 flex items-center">
                <span className="text-xs text-gray-900 font-medium">Buscar</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {[
                { num: '1', title: '5 errores que te impiden tener éxito financiero', views: '4.2M', platform: '#FF0000' },
                { num: '2', title: 'Cómo invertir $100 y convertirlos en $10,000', views: '3.8M', platform: '#FF0000' },
                { num: '3', title: '3 hábitos de millonarios que puedes aplicar hoy', views: '2.1M', platform: '#69C9D0' },
              ].map((v, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-800 rounded-xl px-3 py-2.5">
                  <span className="text-gray-600 text-xs w-4">{v.num}</span>
                  <div className="w-10 h-6 rounded bg-gray-700 shrink-0"></div>
                  <p className="text-xs text-gray-300 flex-1 truncate">{v.title}</p>
                  <span className="text-xs text-gray-500">{v.views}</span>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: v.platform }}></div>
                  <div className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-400">Transcribir</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-6 py-24 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">Así de simple</h2>
        <p className="text-center text-gray-400 text-sm mb-14">De cero a guión viral en menos de 2 minutos</p>
        <div className="grid md:grid-cols-3 gap-8">
          {HOW.map((h, i) => (
            <div key={i} className="relative">
              <div className="text-5xl font-bold text-gray-800 mb-4">{h.step}</div>
              <h3 className="text-lg font-semibold mb-2">{h.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{h.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-6 py-24 bg-gray-900/30 border-y border-gray-800">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Todo lo que necesitas</h2>
          <p className="text-center text-gray-400 text-sm mb-14">Para crear contenido que la gente quiere ver</p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="text-sm font-semibold mb-2">{f.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="precios" className="px-6 py-24 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">Precios</h2>
        <p className="text-center text-gray-400 text-sm mb-14">Empieza gratis. Escala cuando lo necesites.</p>
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {PLANS.map((p, i) => (
            <div key={i} className={`rounded-2xl border p-6 ${p.color} ${p.highlight ? 'bg-gray-900' : ''} relative`}>
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-white text-gray-900 text-xs font-semibold rounded-full">
                  Más popular
                </div>
              )}
              <div className="mb-4">
                <p className="text-sm text-gray-400 mb-1">{p.name}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{p.price}</span>
                  <span className="text-sm text-gray-400">{p.period}</span>
                </div>
              </div>
              <ul className="flex flex-col gap-2.5 mb-6">
                {p.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-xs text-gray-300">
                    <span className="text-green-400 shrink-0 mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${p.btnClass}`}>
                {p.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="px-6 py-16 bg-gray-900/30 border-y border-gray-800">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6 text-center">
            {[
              { num: '10,000+', label: 'Videos transcritos' },
              { num: '3', label: 'Plataformas conectadas' },
              { num: '< 30 seg', label: 'Por transcripción' },
            ].map((s, i) => (
              <div key={i}>
                <p className="text-4xl font-bold mb-1">{s.num}</p>
                <p className="text-sm text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="text-center px-6 py-24 max-w-2xl mx-auto">
        <h2 className="text-4xl font-bold mb-4">Empieza a crear<br />contenido viral hoy</h2>
        <p className="text-gray-400 text-sm mb-8">Sin tarjeta de crédito. Cancela cuando quieras.</p>
        {submitted ? (
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-950 border border-green-700 rounded-xl text-green-300 text-sm">
            ✅ Ya estás en lista. ¡Te contactamos pronto!
          </div>
        ) : (
          <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-500"
              required
            />
            <button type="submit"
              className="px-6 py-3 bg-white text-gray-900 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors whitespace-nowrap">
              Quiero acceso →
            </button>
          </form>
        )}
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-800 px-6 py-8 text-center">
        <p className="text-xs text-gray-600">© 2026 ViralADN. Hecho con ❤️ para creadores de contenido.</p>
      </footer>

    </main>
  );
}
