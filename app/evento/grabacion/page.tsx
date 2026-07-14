import { EVENT_DATE_LABEL, RECORDING_URL } from '../event-config';

// GRABACIÓN del evento + la OFERTA de la clase (planes de ViralADN con los
// bonos del evento, sacados de ViralADN_Planes_Evento.pptx).
// Vive en evento.franpierachini.com/grabacion (rewrite en middleware).
// CTAs absolutos → viraladn.com/precios con producto y ciclo preseleccionados.

export const metadata = {
  title: 'La grabación — De 0 a 100K seguidores',
  robots: { index: false, follow: false }, // link para registrados, no para buscadores
};

// Normaliza un link de YouTube/Vimeo al formato embebible.
function toEmbed(url: string): string {
  const u = url.trim();
  if (!u) return '';
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;
  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return u; // ya es embebible u otro host: se usa tal cual
}

const BENEFICIOS = [
  ['🔥', 'Búsqueda viral en 3 plataformas', 'Encuentra los videos que explotan en YouTube, TikTok e Instagram.'],
  ['🧠', 'Chat de ideas', 'Responde 3 preguntas y te da las palabras exactas para buscar.'],
  ['🔍', 'Analizador de perfiles', 'Qué cambiar en tu perfil y tu bio para convertir visitas en seguidores.'],
  ['⚡', 'Transcripción con IA', 'Cualquier video viral → su guion, listo para adaptar con tu voz.'],
  ['🌍', 'Traducción automática', 'Los guiones que funcionan, en 4 idiomas.'],
  ['📚', 'Biblioteca ilimitada', 'Todos tus guiones e ideas en un solo lugar.'],
] as const;

// Planes de ViralADN con los BONOS del evento (pptx de la clase).
const PLANES = [
  {
    nombre: 'Mensual', precio: '$47', sufijo: '/mes', ahorro: '',
    nota: 'Empiezas cuando quieras, cancelas cuando quieras.',
    bonos: ['Sesión semanal en vivo con Francisco', 'Ranking + recompensas mensuales'],
    ciclo: 'monthly', destacado: false,
  },
  {
    nombre: 'Trimestral', precio: '$127', sufijo: ' /3 meses', ahorro: 'AHORRA 10%',
    nota: 'Sale $42.3/mes vs. $141 mes a mes.',
    bonos: ['Todo lo del mensual', '20 guiones validados para tu cuenta', 'Evento Road to 1M (solo suscriptores)', 'Sesión de evaluación de perfil'],
    ciclo: 'quarterly', destacado: false,
  },
  {
    nombre: 'Anual', precio: '$451', sufijo: '/año', ahorro: 'AHORRA 20%',
    nota: 'Sale $37.6/mes vs. $564 mes a mes.',
    bonos: ['Todo lo del mensual y trimestral', 'Plan de acción Road to 10K', 'Plan de acción Road to 100K', 'Plan de acción 100K → 1M', 'Análisis de perfil + evaluación'],
    ciclo: 'yearly', destacado: true,
  },
] as const;

export default function Grabacion() {
  const embed = toEmbed(RECORDING_URL);

  return (
    <main className="min-h-screen text-white" style={{ background: '#0a0a0f' }}>
      {/* NAV marca del evento */}
      <nav className="flex items-center justify-center px-6 py-5" style={{ borderBottom: '1px solid #1a1a26' }}>
        <span className="text-lg font-extrabold">📈 De 0 a 100K <span style={{ color: '#34d399' }}>seguidores</span></span>
      </nav>

      {/* HERO + VIDEO */}
      <section className="px-6 pt-10 pb-6 max-w-4xl mx-auto text-center">
        <span className="inline-block text-xs font-extrabold tracking-widest uppercase px-4 py-2 rounded-full mb-5"
          style={{ background: '#0b1512', border: '1px solid #1d3b34', color: '#34d399' }}>
          🎬 La grabación completa
        </span>
        <h1 className="text-3xl md:text-5xl font-extrabold mb-3">Revive la clase completa</h1>
        <p className="text-base mb-8" style={{ color: '#9a9aa6' }}>
          La metodología de <span style={{ color: '#c4b5fd' }}>Spencer Hoffmann</span> para pasar de 0 a 100K — clase del {EVENT_DATE_LABEL}.
        </p>

        {embed ? (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1f1f2b', boxShadow: '0 0 60px #34d39922' }}>
            <div style={{ position: 'relative', paddingTop: '56.25%' }}>
              <iframe
                src={embed}
                title="Grabación — De 0 a 100K seguidores"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                allowFullScreen
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-12 text-center" style={{ background: '#0f0f17', border: '1px dashed #2a2a3a' }}>
            <div className="text-5xl mb-3">🎬</div>
            <p className="text-lg font-bold mb-1">Estamos subiendo la grabación</p>
            <p className="text-sm" style={{ color: '#9a9aa6' }}>Vuelve en un rato. Mientras tanto, mira la oferta de la clase 👇</p>
          </div>
        )}

        {/* Recap de la clase */}
        <div className="flex flex-wrap justify-center gap-2 mt-6 text-xs" style={{ color: '#9a9aa6' }}>
          {['🔎 Encontrar el contenido que explota', '✍️ Convertirlo en TU guion', '🎬 Grabarlo y editarlo con IA', '🚀 Publicar con constancia'].map(t => (
            <span key={t} className="px-3 py-1.5 rounded-full" style={{ background: '#0f0f17', border: '1px solid #1f1f2b' }}>{t}</span>
          ))}
        </div>
      </section>

      {/* ── LA OFERTA DE LA CLASE ── */}
      <section className="px-6 py-12 max-w-5xl mx-auto">
        <div className="text-center mb-8 max-w-2xl mx-auto">
          <span className="inline-block text-xs font-extrabold tracking-widest uppercase px-4 py-2 rounded-full mb-4"
            style={{ background: '#14101f', border: '1px solid #7c3aed55', color: '#c4b5fd' }}>
            ⚡ La oferta de la clase
          </span>
          <h2 className="text-2xl md:text-4xl font-extrabold mb-3">
            No es más software. <span style={{ color: '#34d399' }}>Es que te acompañe a llegar.</span>
          </h2>
          <p className="text-sm md:text-base" style={{ color: '#9a9aa6' }}>
            ViralADN encuentra lo que explota y te da el guion — y además te sientas cada semana
            con Francisco a revisar qué está funcionando en TU cuenta. Software + seguimiento.
          </p>
        </div>

        {/* Qué hace ViralADN */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
          {BENEFICIOS.map(([icono, titulo, desc]) => (
            <div key={titulo} className="rounded-2xl p-4 flex gap-3" style={{ background: '#0f0f17', border: '1px solid #1f1f2b' }}>
              <div className="text-2xl">{icono}</div>
              <div>
                <p className="text-sm font-bold mb-0.5">{titulo}</p>
                <p className="text-xs leading-relaxed" style={{ color: '#9a9aa6' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Los 3 planes con los bonos del evento */}
        <div className="grid md:grid-cols-3 gap-4 items-start mb-4">
          {PLANES.map(p => (
            <div key={p.nombre} className="rounded-3xl p-6 flex flex-col relative"
              style={{
                background: p.destacado ? '#0b1512' : '#0f0f17',
                border: `1px solid ${p.destacado ? '#1d3b34' : '#1f1f2b'}`,
                boxShadow: p.destacado ? '0 0 40px #34d39922' : 'none',
              }}>
              {p.ahorro && (
                <span className="absolute -top-3 right-5 text-[10px] font-extrabold tracking-wider px-3 py-1 rounded-full"
                  style={{ background: p.destacado ? '#34d399' : '#2a2a3a', color: p.destacado ? '#04211c' : '#c9c9d4' }}>
                  {p.ahorro}
                </span>
              )}
              <p className="text-xs font-extrabold tracking-widest uppercase mb-1" style={{ color: p.destacado ? '#34d399' : '#8b8b96' }}>
                ViralADN · {p.nombre}
              </p>
              <p className="text-4xl font-extrabold mb-1">{p.precio}<span className="text-sm font-bold" style={{ color: '#9a9aa6' }}>{p.sufijo}</span></p>
              <p className="text-xs mb-4" style={{ color: '#9a9aa6' }}>{p.nota}</p>

              <p className="text-[11px] font-extrabold tracking-widest uppercase mb-2" style={{ color: '#c4b5fd' }}>🎁 Bonos de la clase</p>
              <ul className="flex flex-col gap-1.5 mb-5 flex-1">
                {p.bonos.map(b => (
                  <li key={b} className="flex items-start gap-2 text-xs" style={{ color: '#d6d6de' }}>
                    <span style={{ color: '#34d399' }}>✓</span><span>{b}</span>
                  </li>
                ))}
              </ul>

              <a href={`https://www.viraladn.com/precios?producto=viraladn&ciclo=${p.ciclo}`}
                className="block w-full py-3 rounded-2xl text-sm font-extrabold text-center transition-transform hover:-translate-y-0.5"
                style={p.destacado
                  ? { background: '#34d399', color: '#04211c', boxShadow: '0 0 24px #34d39944' }
                  : { background: '#14141f', border: '1px solid #2e2e3e', color: '#fff' }}>
                Elegir {p.nombre} →
              </a>
            </div>
          ))}
        </div>

        <p className="text-center text-xs mb-8" style={{ color: '#c9b48a' }}>
          ⏳ El seguimiento semanal, los guiones y los planes de acción son el <b>bono de la clase</b> — cupo limitado, para quien toma acción ahora.
        </p>

        {/* Combo secundario */}
        <div className="rounded-2xl px-5 py-4 flex items-center justify-between gap-3 flex-wrap max-w-3xl mx-auto"
          style={{ background: '#0f0f17', border: '1px solid #2a2a3a' }}>
          <span className="text-sm" style={{ color: '#c4b5fd' }}>
            ✨ ¿También quieres que tus videos <b>se editen solos</b>? Combo ViralADN + TOPCUT: <b>$97/mes</b> · $262 /3 meses · $931/año.
          </span>
          <a href="https://www.viraladn.com/precios?producto=combo"
            className="text-xs font-bold px-4 py-2 rounded-xl"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }}>
            Ver el combo →
          </a>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#6b6b78' }}>
          Pago seguro con Stripe · acceso al instante · garantía de reembolso de 7 días desde tu primer cobro
        </p>
      </section>

      {/* Footer */}
      <footer className="text-center px-6 py-8" style={{ borderTop: '1px solid #1a1a26' }}>
        <p className="text-xs mb-1" style={{ color: '#6b6b78' }}>📈 De 0 a 100K seguidores — con Spencer Hoffmann y Francisco Pierachini</p>
        <p className="text-xs" style={{ color: '#55555f' }}>Los planes se renuevan automáticamente al precio vigente. Cancelas cuando quieras.</p>
      </footer>
    </main>
  );
}
