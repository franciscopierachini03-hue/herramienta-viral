'use client';

// 🚀 /0a100k — aplicación del funnel "0 a 100K" de Fran Pierachini.
// Vive también en franpierachini.com/0a100k (mismo proyecto, ruta pública).
// Formulario de calificación: seguidores, oferta, facturación, meta, frenos.
// POST /api/0a100k → llega por correo con todas las respuestas.

import { useState } from 'react';

const SEGUIDORES = ['Menos de 1.000', '1.000 – 10.000', '10.000 – 50.000', '50.000 – 100.000', 'Más de 100.000'];
const FACTURACION = ['Todavía no facturo', 'Menos de $1.000 USD/mes', '$1.000 – $5.000 USD/mes', '$5.000 – $10.000 USD/mes', '$10.000 – $30.000 USD/mes', 'Más de $30.000 USD/mes'];
const META = ['$5.000 USD/mes', '$10.000 USD/mes', '$30.000 USD/mes', '$100.000+ USD/mes'];
const FRECUENCIA = ['Publico todos los días', '2–3 veces por semana', 'De vez en cuando', 'Todavía no publico'];
const EQUIPO = ['Solo yo', 'Tengo editor o asistente', 'Equipo de 2–5', 'Equipo de más de 5'];
const INVERSION = ['Sí, estoy listo ya', 'Sí, en los próximos 1–3 meses', 'Por ahora solo busco info gratis'];

const inputStyle = {
  background: '#0a0a12', border: '1px solid #2a2a36', color: '#fff',
  borderRadius: 14, padding: '13px 15px', fontSize: 15, width: '100%', outline: 'none',
} as const;

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block text-[13px] font-bold mb-1.5" style={{ color: '#c9c9d4' }}>{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, opciones, placeholder }: { value: string; onChange: (v: string) => void; opciones: string[]; placeholder: string }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark', cursor: 'pointer' }} required>
      <option value="" disabled>{placeholder}</option>
      {opciones.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export default function Aplicacion0a100k() {
  const [f, setF] = useState<Record<string, string>>({});
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const [estado, setEstado] = useState<'form' | 'enviando' | 'listo'>('form');
  const [error, setError] = useState('');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setEstado('enviando');
    try {
      const r = await fetch('/api/0a100k', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'No se pudo enviar. Probá de nuevo.'); setEstado('form'); return; }
      setEstado('listo');
    } catch { setError('Error de conexión. Probá de nuevo.'); setEstado('form'); }
  }

  if (estado === 'listo') {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 text-white" style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
        <div className="max-w-md text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-extrabold mb-3">¡Aplicación recibida!</h1>
          <p className="text-sm leading-relaxed" style={{ color: '#b4b4c0' }}>
            Gracias por contarnos de tu negocio. La estamos revisando y <b style={{ color: '#fff' }}>te escribimos por WhatsApp en las próximas 24–48 horas</b>.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white py-10 px-4" style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <p className="text-xs font-extrabold tracking-widest uppercase mb-2" style={{ color: '#c4b5fd' }}>Fran Pierachini</p>
          <h1 className="text-3xl md:text-4xl font-extrabold mb-3">
            De <span style={{ color: '#fca5a5' }}>0</span> a <span style={{ background: 'linear-gradient(90deg,#a78bfa,#ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>100K</span> 🚀
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: '#b4b4c0' }}>
            Contanos de tu negocio en 2 minutos. Con esta info vemos si podemos ayudarte a escalar — y <b style={{ color: '#fff' }}>te respondemos por WhatsApp</b>.
          </p>
        </div>

        <form onSubmit={enviar} className="rounded-3xl p-6 md:p-8" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #2a2a36' }}>
          {/* honeypot invisible anti-bots */}
          <input type="text" value={f.hp || ''} onChange={e => set('hp')(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />

          <Campo label="Tu nombre completo *">
            <input style={inputStyle} required minLength={2} value={f.nombre || ''} onChange={e => set('nombre')(e.target.value)} placeholder="Nombre y apellido" />
          </Campo>
          <Campo label="Tu email *">
            <input style={inputStyle} type="email" required value={f.email || ''} onChange={e => set('email')(e.target.value)} placeholder="tucorreo@gmail.com" />
          </Campo>
          <Campo label="Tu WhatsApp (con código de país) *">
            <input style={inputStyle} required value={f.whatsapp || ''} onChange={e => set('whatsapp')(e.target.value)} placeholder="+52 1 55 1234 5678" />
          </Campo>
          <Campo label="Tu Instagram (o tu red principal) *">
            <input style={inputStyle} required value={f.instagram || ''} onChange={e => set('instagram')(e.target.value)} placeholder="@tuusuario" />
          </Campo>
          <Campo label="¿Cuántos seguidores tenés hoy? *">
            <Select value={f.seguidores || ''} onChange={set('seguidores')} opciones={SEGUIDORES} placeholder="Elegí un rango" />
          </Campo>
          <Campo label="¿Qué vendés hoy? (tu oferta y su precio) *">
            <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} required minLength={10} value={f.oferta || ''} onChange={e => set('oferta')(e.target.value)}
              placeholder="Ej.: mentoría de 8 semanas para coaches, $997 USD…" />
          </Campo>
          <Campo label="¿Cuánto estás facturando por mes? *">
            <Select value={f.facturacion || ''} onChange={set('facturacion')} opciones={FACTURACION} placeholder="Elegí un rango" />
          </Campo>
          <Campo label="¿Cuál es tu meta a 12 meses? *">
            <Select value={f.meta || ''} onChange={set('meta')} opciones={META} placeholder="Elegí tu meta" />
          </Campo>
          <Campo label="¿Qué es lo que MÁS te está frenando hoy? *">
            <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} required minLength={10} value={f.freno || ''} onChange={e => set('freno')(e.target.value)}
              placeholder="Ej.: no sé qué publicar, no me llegan clientes, no tengo tiempo de editar…" />
          </Campo>
          <Campo label="¿Cada cuánto publicás contenido? *">
            <Select value={f.frecuencia || ''} onChange={set('frecuencia')} opciones={FRECUENCIA} placeholder="Elegí una opción" />
          </Campo>
          <Campo label="¿Trabajás solo o con equipo? *">
            <Select value={f.equipo || ''} onChange={set('equipo')} opciones={EQUIPO} placeholder="Elegí una opción" />
          </Campo>
          <Campo label="Si vemos que podemos ayudarte, ¿estás en un momento de invertir en tu negocio? *">
            <Select value={f.inversion || ''} onChange={set('inversion')} opciones={INVERSION} placeholder="Elegí una opción" />
          </Campo>

          {error && <p className="text-sm mb-3 font-bold" style={{ color: '#fca5a5' }}>{error}</p>}

          <button type="submit" disabled={estado === 'enviando'}
            className="w-full py-4 rounded-2xl text-base font-extrabold transition-transform hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(90deg, #7c3aed, #ec4899)', color: '#fff', opacity: estado === 'enviando' ? 0.6 : 1, boxShadow: '0 0 30px #7c3aed44' }}>
            {estado === 'enviando' ? 'Enviando…' : '🚀 Enviar mi aplicación'}
          </button>
          <p className="text-[11px] text-center mt-3" style={{ color: '#6a6a76' }}>
            Tus datos solo se usan para evaluar tu aplicación y contactarte. Nada de spam.
          </p>
        </form>
      </div>
    </main>
  );
}
