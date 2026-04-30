'use client';

import Link from 'next/link';

const FEATURES = [
  { icon: '⚡', title: 'Transcripción instantánea', desc: 'Pegá el link de cualquier video y obtené el guión en segundos. YouTube, TikTok e Instagram.' },
  { icon: '🔥', title: 'Detector de virales con IA', desc: 'Buscá un tema y la IA filtra los 100 mejores de cada plataforma. Sin memes, sin ruido.' },
  { icon: '🔍', title: 'Analizador de perfiles', desc: 'Pegá cualquier perfil y obtené sus videos ordenados por engagement, vistas o comentarios.' },
  { icon: '🌍', title: 'Multilingüe', desc: 'Resultados en español, inglés y portugués balanceados. Traducción incluida.' },
  { icon: '📚', title: 'Biblioteca personal', desc: 'Guardá los guiones, organizalos y adaptalos a tu voz cuando los necesites.' },
];

const HOW = [
  { step: '01', title: 'Buscá tu tema', desc: 'Escribí "negocios", "fitness", lo que quieras dominar — la IA trae los videos más virales.' },
  { step: '02', title: 'Transcribí en un click', desc: 'Cualquier video se vuelve un guión completo. Lo traducís, lo guardás, lo adaptás.' },
  { step: '03', title: 'Publicá y crecé', desc: 'Tomás los mejores patrones, los hacés tuyos, y publicás contenido que la gente quiere ver.' },
];

export default function Landing() {
  return (
    <main className="min-h-screen text-white" style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>

      {/* NAV */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="ViralADN" width={36} height={36}
            style={{ filter: 'drop-shadow(0 0 14px #7c3aed55)' }} />
          <span className="text-lg font-bold">ViralADN</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/precios" className="px-4 py-2 text-sm transition-colors" style={{ color: '#888' }}>
            Precios
          </Link>
          <Link href="/login" className="px-4 py-2 rounded-xl text-sm transition-colors"
            style={{ background: '#111', border: '1px solid #1f1f1f', color: '#ccc' }}>
            Iniciar sesión
          </Link>
          <Link href="/login?signup=1"
            className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff', boxShadow: '0 0 20px #7c3aed44' }}>
            Empezar →
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="text-center px-6 pt-16 pb-20 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-8"
          style={{ background: '#0f0f0f', border: '1px solid #1f1f1f', color: '#888' }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22c55e' }}></span>
          Búsqueda multi-plataforma con IA
        </div>

        <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
          Encontrá lo viral.<br />
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed, #c13584, #ef4444)' }}>
            Creá contenido que explota.
          </span>
        </h1>

        <p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed" style={{ color: '#999' }}>
          Transcribí cualquier video de YouTube, TikTok o Instagram en segundos.
          Descubrí qué está funcionando en tu nicho y adaptá los mejores guiones a tu voz.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/login?signup=1"
            className="px-7 py-3.5 rounded-2xl text-sm font-bold transition-all"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff', boxShadow: '0 0 30px #7c3aed44' }}>
            Empezar ahora — $47/mes →
          </Link>
          <Link href="#features"
            className="px-7 py-3.5 rounded-2xl text-sm font-semibold transition-colors"
            style={{ background: '#0f0f0f', border: '1px solid #1f1f1f', color: '#ccc' }}>
            Ver qué incluye
          </Link>
        </div>
        <p className="text-xs mt-4" style={{ color: '#555' }}>
          Acceso inmediato · Cancelá cuando quieras · 20% off pagando anual
        </p>

        {/* Demo preview */}
        <div className="mt-16 relative">
          <div className="rounded-2xl p-6 text-left shadow-2xl"
            style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
            <div className="flex gap-2 mb-4">
              <div className="w-3 h-3 rounded-full" style={{ background: '#ef4444' }}></div>
              <div className="w-3 h-3 rounded-full" style={{ background: '#eab308' }}></div>
              <div className="w-3 h-3 rounded-full" style={{ background: '#22c55e' }}></div>
            </div>
            <div className="flex gap-2 mb-4">
              <div className="h-9 rounded-xl flex-1 flex items-center px-3" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
                <span className="text-xs" style={{ color: '#555' }}>Buscar virales: fitness, dinero, motivación, negocios...</span>
              </div>
              <div className="h-9 rounded-xl px-4 flex items-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)' }}>
                <span className="text-xs text-white font-medium">🔍 Buscar</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { plat: '#FF0000', icon: '▶', views: '4.2M', eng: '6.3%' },
                { plat: '#69C9D0', icon: '◆', views: '3.8M', eng: '4.1%' },
                { plat: '#C13584', icon: '◉', views: '2.1M', eng: '5.8%' },
              ].map((v, i) => (
                <div key={i} className="rounded-xl overflow-hidden relative" style={{ aspectRatio: '9/16', background: '#0a0a0a', border: `1px solid ${v.plat}33` }}>
                  <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-30">{v.icon}</div>
                  <div className="absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'rgba(0,0,0,0.7)' }}>
                    {i + 1}
                  </div>
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: '#22c55e22', color: '#4ade80', border: '1px solid #22c55e44' }}>
                    ⚡ {v.eng}
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 text-[10px] font-bold text-white">
                    👁 {v.views}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-3">Así de simple</h2>
        <p className="text-center text-sm mb-14" style={{ color: '#666' }}>De cero a guión viral en menos de 2 minutos</p>
        <div className="grid md:grid-cols-3 gap-8">
          {HOW.map((h, i) => (
            <div key={i}>
              <div className="text-5xl font-bold mb-4" style={{ color: '#222' }}>{h.step}</div>
              <h3 className="text-lg font-semibold mb-2">{h.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#888' }}>{h.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="px-6 py-20" style={{ background: '#06060a', borderTop: '1px solid #1a1a1a', borderBottom: '1px solid #1a1a1a' }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-3">Todo lo que necesitás</h2>
          <p className="text-center text-sm mb-14" style={{ color: '#666' }}>Para crear contenido que la gente quiere ver</p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="rounded-2xl p-5 transition-colors"
                style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="text-sm font-semibold mb-2">{f.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: '#888' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section className="px-6 py-20 max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">Un precio. Acceso total.</h2>
        <p className="text-sm mb-10" style={{ color: '#666' }}>Sin tiers confusos. Sin features escondidas. Todo desbloqueado.</p>

        <div className="rounded-3xl p-8 max-w-md mx-auto" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #7c3aed44', boxShadow: '0 0 40px #7c3aed22' }}>
          <p className="text-sm mb-2" style={{ color: '#a78bfa' }}>ViralADN Pro</p>
          <div className="flex items-baseline justify-center gap-2 mb-1">
            <span className="text-6xl font-bold">$47</span>
            <span className="text-sm" style={{ color: '#888' }}>/mes</span>
          </div>
          <p className="text-xs mb-6" style={{ color: '#666' }}>o $470 al año <span style={{ color: '#22c55e' }}>(20% off)</span></p>

          <Link href="/login?signup=1" className="block w-full py-3.5 rounded-2xl text-sm font-bold transition-all"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff', boxShadow: '0 0 20px #7c3aed44' }}>
            Empezar ahora →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t px-6 py-8 text-center" style={{ borderColor: '#1a1a1a' }}>
        <p className="text-xs" style={{ color: '#444' }}>© 2026 ViralADN · Hecho para creadores que toman en serio su crecimiento</p>
      </footer>
    </main>
  );
}
