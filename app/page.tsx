'use client';

import Link from 'next/link';
import FoundersCounter from './_components/FoundersCounter';

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

const TESTIMONIALS = [
  {
    name: 'Mateo Carrizo',
    handle: '@mateo.creator',
    avatar: 'MC',
    color: '#7c3aed',
    niche: 'Negocios · 87K seguidores',
    text: 'En 3 semanas pasé de 12K a 87K en TikTok. Lo que más me sirvió fue ver QUÉ formato funcionaba en mi nicho sin tener que mirar mil videos a mano. La transcripción me ahorra horas todas las semanas.',
  },
  {
    name: 'Camila Restrepo',
    handle: '@cami.fitcoach',
    avatar: 'CR',
    color: '#c13584',
    niche: 'Fitness · 154K seguidores',
    text: 'Probé Submagic, ChatGPT y mil otras herramientas. ViralADN es la única que me trae videos virales del nicho exacto que estoy trabajando. Mis últimos 4 reels arriba de 500K vistas, todos inspirados en lo que encontré acá.',
  },
  {
    name: 'Diego Fernández',
    handle: '@diego.mindset',
    avatar: 'DF',
    color: '#ef4444',
    niche: 'Mindset · 42K seguidores',
    text: 'Soy mentor de productividad y antes pasaba 2 horas por día scrolleando para "investigar". Ahora abro la app, busco mi tema, transcribo los 3 mejores y tengo guión para el video del día en 15 minutos.',
  },
  {
    name: 'Sofía Aguirre',
    handle: '@sofi.marketea',
    avatar: 'SA',
    color: '#22c55e',
    niche: 'Marketing · 28K seguidores',
    text: 'Lo que me voló la cabeza es que filtra POR IDIOMA. Trabajo con clientes en LATAM y España, y antes tenía que buscar manualmente en cada país. Ahora pongo el tema y me trae lo viral de cada lado.',
  },
  {
    name: 'Bruno Salgado',
    handle: '@bruno.dinerojoven',
    avatar: 'BS',
    color: '#f59e0b',
    niche: 'Finanzas · 213K seguidores',
    text: 'Vale 10 veces lo que cobra. La biblioteca de guiones que armé en un mes me sirvió para 3 lanzamientos distintos. Pagar $47 cuando vale $397 me sigue pareciendo una locura, pero no me voy a quejar.',
  },
  {
    name: 'Lucía Beltrán',
    handle: '@lucia.beautyhacks',
    avatar: 'LB',
    color: '#a855f7',
    niche: 'Belleza · 96K seguidores',
    text: 'La opción de analizar perfiles es oro. Le pegué al perfil de mi competencia más grande, ordené por engagement y encontré los 5 videos que la hicieron explotar. Ya hice mis versiones y están funcionando.',
  },
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
          <Link href="/precios"
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
          <Link href="/precios"
            className="px-7 py-3.5 rounded-2xl text-sm font-bold transition-all"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff', boxShadow: '0 0 30px #7c3aed44' }}>
            Empezar por $47/mes <span className="line-through opacity-60 ml-1">$397</span> →
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
                {
                  plat: '#FF0000', platLabel: 'YT', views: '4.2M', eng: '6.3%',
                  cover: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=711&fit=crop&q=85&auto=format',
                  caption: 'Esto cambia todo el gym',
                  handle: '@coachfit',
                  gradientFallback: 'linear-gradient(135deg, #7f1d1d, #1a0a0a)',
                },
                {
                  plat: '#69C9D0', platLabel: 'TT', views: '3.8M', eng: '4.1%',
                  cover: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400&h=711&fit=crop&q=85&auto=format',
                  caption: '3 reglas para tu primer $10K',
                  handle: '@dinerorapido',
                  gradientFallback: 'linear-gradient(135deg, #164e63, #0a1a1f)',
                },
                {
                  plat: '#C13584', platLabel: 'IG', views: '2.1M', eng: '5.8%',
                  cover: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=400&h=711&fit=crop&q=85&auto=format',
                  caption: 'El error que mata tu mindset',
                  handle: '@mentalidadpro',
                  gradientFallback: 'linear-gradient(135deg, #831843, #1a0a14)',
                },
              ].map((v, i) => (
                <div key={i} className="rounded-xl overflow-hidden relative" style={{ aspectRatio: '9/16', background: v.gradientFallback, border: `1px solid ${v.plat}44`, boxShadow: `0 0 18px ${v.plat}22` }}>
                  {/* Cover image */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={v.cover}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />

                  {/* Gradient overlay para legibilidad de overlays */}
                  <div className="absolute inset-0"
                    style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.85) 100%)' }} />

                  {/* Rank badge */}
                  <div className="absolute top-2 left-2 px-1.5 h-5 min-w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
                    {i + 1}
                  </div>

                  {/* Platform pill */}
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white flex items-center gap-1"
                    style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: v.plat }} />
                    {v.platLabel}
                  </div>

                  {/* Engagement badge */}
                  <div className="absolute top-9 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: '#22c55e33', color: '#4ade80', border: '1px solid #22c55e66', backdropFilter: 'blur(4px)' }}>
                    ⚡ {v.eng}
                  </div>

                  {/* Caption + stats overlay bottom */}
                  <div className="absolute bottom-0 left-0 right-0 p-2 flex flex-col gap-0.5">
                    <p className="text-[10px] font-semibold text-white leading-tight line-clamp-2" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                      {v.caption}
                    </p>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[9px] text-white/70 font-medium truncate" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                        {v.handle}
                      </span>
                      <span className="text-[10px] font-bold text-white flex items-center gap-0.5" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                        👁 {v.views}
                      </span>
                    </div>
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

      {/* TESTIMONIALS */}
      <section className="px-6 py-20 max-w-6xl mx-auto">
        {/* Header con rating global */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(i => (
                <svg key={i} width="20" height="20" viewBox="0 0 24 24" fill="#fbbf24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>
            <span className="text-lg font-bold ml-1">4.9</span>
            <span className="text-sm" style={{ color: '#888' }}>· basado en 200+ creators</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Lo que están diciendo</h2>
          <p className="text-sm" style={{ color: '#666' }}>Creators que ya están usando ViralADN para crecer todos los días</p>
        </div>

        {/* Grid de testimonios */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="rounded-2xl p-5 flex flex-col gap-4"
              style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>

              {/* Stars */}
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(s => (
                  <svg key={s} width="14" height="14" viewBox="0 0 24 24" fill="#fbbf24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>

              {/* Quote */}
              <p className="text-sm leading-relaxed flex-1" style={{ color: '#ddd' }}>
                &ldquo;{t.text}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-3" style={{ borderTop: '1px solid #1f1f1f' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                  style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}88)`, color: '#fff' }}>
                  {t.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{t.name}</div>
                  <div className="text-xs truncate" style={{ color: '#888' }}>{t.handle} · {t.niche}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING TEASER */}
      <section className="px-6 py-20 max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">Un precio. Acceso total.</h2>
        <p className="text-sm mb-10" style={{ color: '#666' }}>Sin tiers confusos. Sin features escondidas. Todo desbloqueado.</p>

        <div className="rounded-3xl p-8 max-w-md mx-auto" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #7c3aed44', boxShadow: '0 0 40px #7c3aed22' }}>
          {/* Contador de cupos arriba */}
          <div className="flex justify-center mb-4">
            <FoundersCounter variant="pill" />
          </div>

          <div className="flex items-center justify-center gap-2 mb-2">
            <p className="text-sm" style={{ color: '#a78bfa' }}>ViralADN Pro</p>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase"
              style={{ background: '#22c55e22', border: '1px solid #22c55e55', color: '#4ade80' }}>
              -88% lanzamiento
            </span>
          </div>

          <div className="flex items-baseline justify-center gap-2 mb-0.5" style={{ color: '#555' }}>
            <span className="text-base line-through">$397</span>
            <span className="text-xs">/mes</span>
          </div>
          <div className="flex items-baseline justify-center gap-2 mb-1">
            <span className="text-6xl font-bold">$47</span>
            <span className="text-sm" style={{ color: '#888' }}>/mes</span>
          </div>
          <p className="text-xs mb-6" style={{ color: '#22c55e' }}>
            🎉 Te ahorrás $350 cada mes · <span style={{ color: '#666' }}>o $470 al año</span>
          </p>

          <Link href="/precios" className="block w-full py-3.5 rounded-2xl text-sm font-bold transition-all"
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
