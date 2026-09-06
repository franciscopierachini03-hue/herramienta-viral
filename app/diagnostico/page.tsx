'use client';

// 🩺 /diagnostico — Diagnóstico de crecimiento "0 a 100K" de Fran Pierachini.
// Vive en su propio subdominio (diagnostico.franpierachini.com) vía middleware.
// Cualifica al lead Y mapea las 6 etapas del proceso de crecimiento para
// detectar dónde está trabado cada uno. POST /api/diagnostico → email + (sheet).

import { useState } from 'react';

// ── Las 6 etapas del proceso de crecimiento (0 → 100K) ──────────────────────
const ETAPAS: { key: string; icon: string; titulo: string; desc: string }[] = [
  { key: 'claridad',      icon: '🎯', titulo: 'Claridad de nicho y mensaje',   desc: 'Saber a quién le hablás y qué te hace distinto.' },
  { key: 'ideas',         icon: '💡', titulo: 'Encontrar ideas virales',        desc: 'Detectar qué temas y ángulos están explotando.' },
  { key: 'guion',         icon: '✍️', titulo: 'Guiones y hooks',                desc: 'Escribir el arranque que retiene en los primeros 3 seg.' },
  { key: 'produccion',    icon: '🎬', titulo: 'Grabar y editar',               desc: 'Producir el video con buena calidad y a tiempo.' },
  { key: 'distribucion',  icon: '📈', titulo: 'Constancia y algoritmo',         desc: 'Publicar seguido y entender qué premia la plataforma.' },
  { key: 'monetizacion',  icon: '💰', titulo: 'Convertir en clientes',          desc: 'Transformar seguidores en ventas de tu oferta.' },
];

// Nivel por etapa: score bajo = más trabado (mayor oportunidad de mejora).
const NIVELES: { label: string; score: number }[] = [
  { label: 'Es mi mayor problema', score: 1 },
  { label: 'Me cuesta bastante',   score: 2 },
  { label: 'Más o menos',          score: 3 },
  { label: 'Lo manejo bien',       score: 4 },
];

const SEGUIDORES = ['Menos de 1.000', '1.000 – 10.000', '10.000 – 50.000', '50.000 – 100.000', 'Más de 100.000'];
const FRECUENCIA = ['Publico todos los días', '2–3 veces por semana', 'De vez en cuando', 'Todavía no publico'];
const HACE_CUANTO = ['Recién empiezo', 'Hace 1–6 meses', 'Hace 6–12 meses', 'Hace más de 1 año'];
const OBJETIVO = ['Crecer en seguidores', 'Conseguir clientes desde mi contenido', 'Posicionarme como referente', 'Escalar un negocio que ya vende'];
const URGENCIA = ['Quiero resolverlo ya', 'En los próximos 1–3 meses', 'Solo estoy explorando por ahora'];

const inputStyle = {
  background: '#0a0a12', border: '1px solid #2a2a36', color: '#fff',
  borderRadius: 14, padding: '13px 15px', fontSize: 15, width: '100%', outline: 'none',
} as const;

function Campo({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block mb-5">
      <span className="block text-[13px] font-bold mb-1.5" style={{ color: '#c9c9d4' }}>{label}</span>
      {hint && <span className="block text-[12px] mb-2" style={{ color: '#7a7a88' }}>{hint}</span>}
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

export default function Diagnostico() {
  const [f, setF] = useState<Record<string, string>>({});
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const [estado, setEstado] = useState<'form' | 'enviando' | 'listo'>('form');
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<{ etapa: string; icon: string } | null>(null);

  function calcularOportunidad(): { etapa: string; icon: string; key: string } {
    // La etapa con menor score (o la marcada "mayor problema") es la oportunidad.
    let peor = ETAPAS[0];
    let peorScore = 99;
    for (const e of ETAPAS) {
      const lvl = NIVELES.find(n => n.label === f[`etapa_${e.key}`]);
      const s = lvl?.score ?? 3;
      if (s < peorScore) { peorScore = s; peor = e; }
    }
    return { etapa: peor.titulo, icon: peor.icon, key: peor.key };
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setEstado('enviando');
    const oportunidad = calcularOportunidad();
    try {
      const r = await fetch('/api/diagnostico', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, oportunidad_etapa: oportunidad.etapa }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'No se pudo enviar. Prueba de nuevo.'); setEstado('form'); return; }
      setResultado({ etapa: oportunidad.etapa, icon: oportunidad.icon });
      setEstado('listo');
    } catch { setError('Error de conexión. Prueba de nuevo.'); setEstado('form'); }
  }

  if (estado === 'listo' && resultado) {
    return (
      <main style={{ background: '#050509', minHeight: '100vh', color: '#fff' }} className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg text-center">
          <div className="text-5xl mb-4">{resultado.icon}</div>
          <h1 className="text-2xl font-extrabold mb-3">¡Listo! Ya tenemos tu diagnóstico.</h1>
          <p className="text-[15px] mb-6" style={{ color: '#c9c9d4' }}>
            Según tus respuestas, tu <b style={{ color: '#fff' }}>mayor oportunidad de mejora</b> ahora mismo está en:
          </p>
          <div className="rounded-2xl px-6 py-5 mb-6" style={{ background: 'linear-gradient(135deg,#1a1030,#0a0a12)', border: '1px solid #6d28d9' }}>
            <div className="text-lg font-bold" style={{ color: '#c084fc' }}>{resultado.icon} {resultado.etapa}</div>
          </div>
          <p className="text-[15px]" style={{ color: '#c9c9d4' }}>
            Lo revisamos a fondo y <b style={{ color: '#fff' }}>te escribimos por WhatsApp</b> con los próximos pasos concretos para tu caso. 🚀
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ background: '#050509', minHeight: '100vh', color: '#fff' }} className="px-4 py-12">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-8 text-center">
          <div className="text-4xl mb-3">🩺</div>
          <h1 className="text-3xl font-extrabold leading-tight mb-3">Diagnóstico de crecimiento</h1>
          <p className="text-[15px]" style={{ color: '#c9c9d4' }}>
            Respondé estas preguntas y descubrí <b style={{ color: '#fff' }}>exactamente dónde está trabado tu crecimiento</b> y qué mejorar primero. Toma 3 minutos.
          </p>
        </header>

        <form onSubmit={enviar} style={{ background: '#0d0d16', border: '1px solid #1e1e2a', borderRadius: 20, padding: 24 }}>
          {/* Honeypot anti-bot */}
          <input type="text" name="hp" value={f.hp || ''} onChange={e => set('hp')(e.target.value)} tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: '-9999px' }} aria-hidden />

          <SectionTitle n={1} t="¿Quién sos?" />
          <Campo label="Nombre *"><input style={inputStyle} required value={f.nombre || ''} onChange={e => set('nombre')(e.target.value)} placeholder="Tu nombre" /></Campo>
          <Campo label="Email *"><input type="email" style={inputStyle} required value={f.email || ''} onChange={e => set('email')(e.target.value)} placeholder="tu@email.com" /></Campo>
          <Campo label="WhatsApp *" hint="Con código de país. Por acá te mandamos tu diagnóstico."><input style={inputStyle} required value={f.whatsapp || ''} onChange={e => set('whatsapp')(e.target.value)} placeholder="+52 55 1234 5678" /></Campo>
          <Campo label="Tu Instagram (o red principal)"><input style={inputStyle} value={f.instagram || ''} onChange={e => set('instagram')(e.target.value)} placeholder="@tuusuario" /></Campo>
          <Campo label="¿De qué es tu contenido / nicho?"><input style={inputStyle} value={f.nicho || ''} onChange={e => set('nicho')(e.target.value)} placeholder="Ej: fitness, finanzas, marca personal…" /></Campo>

          <SectionTitle n={2} t="¿Dónde estás hoy?" />
          <Campo label="Seguidores actuales *"><Select value={f.seguidores || ''} onChange={set('seguidores')} opciones={SEGUIDORES} placeholder="Elige una opción" /></Campo>
          <Campo label="¿Hace cuánto creás contenido?"><Select value={f.hace_cuanto || ''} onChange={set('hace_cuanto')} opciones={HACE_CUANTO} placeholder="Elige una opción" /></Campo>
          <Campo label="¿Con qué frecuencia publicás?"><Select value={f.frecuencia || ''} onChange={set('frecuencia')} opciones={FRECUENCIA} placeholder="Elige una opción" /></Campo>

          <SectionTitle n={3} t="Tu proceso, etapa por etapa" />
          <p className="text-[13px] mb-4" style={{ color: '#7a7a88' }}>Para cada etapa, decinos qué tan bien la manejás. Así detectamos dónde enfocar la ayuda.</p>
          {ETAPAS.map(e => (
            <div key={e.key} className="mb-5 rounded-xl p-4" style={{ background: '#0a0a12', border: '1px solid #1e1e2a' }}>
              <div className="mb-2">
                <span className="text-[14px] font-bold">{e.icon} {e.titulo}</span>
                <span className="block text-[12px] mt-0.5" style={{ color: '#7a7a88' }}>{e.desc}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {NIVELES.map(n => {
                  const activo = f[`etapa_${e.key}`] === n.label;
                  return (
                    <button
                      type="button"
                      key={n.label}
                      onClick={() => set(`etapa_${e.key}`)(n.label)}
                      style={{
                        background: activo ? '#6d28d9' : '#111119',
                        border: `1px solid ${activo ? '#8b5cf6' : '#2a2a36'}`,
                        color: activo ? '#fff' : '#c9c9d4',
                        borderRadius: 10, padding: '9px 8px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {n.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <SectionTitle n={4} t="Cuéntanos más" />
          <Campo label="¿Cuál es tu principal duda o traba ahora mismo? *" hint="Escribe con tus palabras lo que más te frena.">
            <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} required value={f.duda || ''} onChange={e => set('duda')(e.target.value)} placeholder="Ej: no sé qué contenido hacer, publico y no crece, no logro vender…" />
          </Campo>
          <Campo label="¿Qué ya intentaste que NO te funcionó?">
            <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={f.intentado || ''} onChange={e => set('intentado')(e.target.value)} placeholder="Cursos, agencias, hacerlo solo, otro editor…" />
          </Campo>
          <Campo label="¿Qué quieres lograr? *"><Select value={f.objetivo || ''} onChange={set('objetivo')} opciones={OBJETIVO} placeholder="Elige tu objetivo principal" /></Campo>
          <Campo label="¿Qué tan urgente es para vos resolverlo? *"><Select value={f.urgencia || ''} onChange={set('urgencia')} opciones={URGENCIA} placeholder="Elige una opción" /></Campo>

          {error && <p className="mb-3 text-[13px]" style={{ color: '#f87171' }}>{error}</p>}

          <button
            type="submit"
            disabled={estado === 'enviando'}
            style={{
              width: '100%', background: estado === 'enviando' ? '#3b2a66' : 'linear-gradient(135deg,#7c3aed,#a855f7)',
              color: '#fff', border: 'none', borderRadius: 14, padding: '15px', fontSize: 16, fontWeight: 800, cursor: 'pointer',
            }}
          >
            {estado === 'enviando' ? 'Analizando tus respuestas…' : 'Ver mi diagnóstico →'}
          </button>
          <p className="mt-3 text-center text-[11px]" style={{ color: '#5a5a68' }}>
            Tus datos solo se usan para armar tu diagnóstico y contactarte. Nada de spam.
          </p>
        </form>
      </div>
    </main>
  );
}

function SectionTitle({ n, t }: { n: number; t: string }) {
  return (
    <div className="mb-4 mt-2 flex items-center gap-2">
      <span style={{ background: '#6d28d9', color: '#fff', borderRadius: 8, width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>{n}</span>
      <span className="text-[15px] font-extrabold">{t}</span>
    </div>
  );
}
