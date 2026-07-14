import { EVENT_DATE_LABEL, RECORDING_URL } from '../event-config';

// GRABACIÓN del evento + oferta de ViralADN.
// Vive en evento.franpierachini.com/grabacion (rewrite en middleware).
// Arriba: el video de la clase (YouTube oculto/Vimeo, config en event-config).
// Abajo: qué hace ViralADN + CTA de compra → viraladn.com/precios (absoluto,
// porque esta página se sirve desde el dominio del evento).

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
  ['🔥', 'Búsqueda viral en YouTube + TikTok + Instagram', 'Encuentra los videos que están explotando en tu nicho, en segundos.'],
  ['🧠', 'Chat de ideas', 'Responde 3 preguntas y te da las palabras exactas para buscar.'],
  ['🔍', 'Analizador de perfiles', 'Te dice qué cambiar en tu perfil y tu bio para convertir visitas en seguidores.'],
  ['⚡', 'Transcripción con IA', 'Cualquier video viral → su guion, listo para adaptar con tu voz.'],
  ['🌍', 'Traducción automática', 'Los guiones que funcionan, en 4 idiomas.'],
  ['📚', 'Biblioteca ilimitada', 'Guarda todos tus guiones e ideas en un solo lugar.'],
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
            <p className="text-sm" style={{ color: '#9a9aa6' }}>Vuelve en un rato. Mientras tanto, mira lo que la herramienta hace por ti 👇</p>
          </div>
        )}

        {/* Recap de la clase */}
        <div className="flex flex-wrap justify-center gap-2 mt-6 text-xs" style={{ color: '#9a9aa6' }}>
          {['🔎 Encontrar el contenido que explota', '✍️ Convertirlo en TU guion', '🎬 Grabarlo y editarlo con IA', '🚀 Publicar con constancia'].map(t => (
            <span key={t} className="px-3 py-1.5 rounded-full" style={{ background: '#0f0f17', border: '1px solid #1f1f2b' }}>{t}</span>
          ))}
        </div>
      </section>

      {/* ── OFERTA VIRALADN ── */}
      <section className="px-6 py-12 max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <span className="inline-block text-xs font-extrabold tracking-widest uppercase px-4 py-2 rounded-full mb-4"
            style={{ background: '#14101f', border: '1px solid #7c3aed55', color: '#c4b5fd' }}>
            ⚡ La herramienta de la clase
          </span>
          <h2 className="text-2xl md:text-4xl font-extrabold mb-3">
            Todo lo que viste, <span style={{ color: '#34d399' }}>hecho por ViralADN</span>
          </h2>
          <p className="text-sm md:text-base" style={{ color: '#9a9aa6' }}>
            No tienes que adivinar qué publicar nunca más: la herramienta encuentra lo que explota,
            te da el guion y te dice cómo mejorar tu perfil.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-8">
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

        {/* CTA principal */}
        <div className="rounded-3xl p-8 text-center" style={{ background: '#0b1512', border: '1px solid #1d3b34' }}>
          <p className="text-sm mb-1" style={{ color: '#9fc9bb' }}>ViralADN completo</p>
          <p className="text-5xl font-extrabold mb-1">$47<span className="text-base font-bold" style={{ color: '#9a9aa6' }}>/mes</span></p>
          <p className="text-xs mb-6" style={{ color: '#9a9aa6' }}>cancelas cuando quieras · garantía de reembolso de 7 días desde tu primer cobro</p>
          <a href="https://www.viraladn.com/precios?producto=viraladn"
            className="inline-block px-10 py-4 rounded-2xl text-base font-extrabold transition-transform hover:-translate-y-0.5"
            style={{ background: '#34d399', color: '#04211c', boxShadow: '0 0 30px #34d39944' }}>
            Quiero ViralADN →
          </a>
          <p className="text-xs mt-4" style={{ color: '#6b6b78' }}>Pago seguro con Stripe · acceso al instante</p>
        </div>

        {/* Combo secundario */}
        <div className="mt-4 rounded-2xl px-5 py-4 flex items-center justify-between gap-3 flex-wrap"
          style={{ background: '#0f0f17', border: '1px solid #2a2a3a' }}>
          <span className="text-sm" style={{ color: '#c4b5fd' }}>
            ✨ ¿También quieres que tus videos <b>se editen solos</b>? Llévate ViralADN + TOPCUT por <b>$97/mes</b>.
          </span>
          <a href="https://www.viraladn.com/precios?producto=combo"
            className="text-xs font-bold px-4 py-2 rounded-xl"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }}>
            Ver el combo →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center px-6 py-8" style={{ borderTop: '1px solid #1a1a26' }}>
        <p className="text-xs mb-1" style={{ color: '#6b6b78' }}>📈 De 0 a 100K seguidores — con Spencer Hoffmann y Francisco Pierachini</p>
        <p className="text-xs" style={{ color: '#55555f' }}>Los planes se renuevan automáticamente al precio vigente. Cancelas cuando quieras.</p>
      </footer>
    </main>
  );
}
