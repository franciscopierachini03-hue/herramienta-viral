'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';

const TONOS = [
  { id: 'motivacional', label: '🔥 Motivacional', desc: 'Energía alta, inspira a actuar' },
  { id: 'educativo',    label: '🧠 Educativo',    desc: 'Enseña algo con claridad' },
  { id: 'entretenido',  label: '😄 Entretenido',  desc: 'Ligero, divertido, relatable' },
  { id: 'directo',      label: '⚡ Directo',      desc: 'Sin rodeos, va al punto' },
  { id: 'emotivo',      label: '❤️ Emotivo',     desc: 'Conecta con una emoción profunda' },
  { id: 'contundente',  label: '🎯 Contundente',  desc: 'Afirmación fuerte, genera debate' },
];

export default function Guiones() {
  const [tema,    setTema]    = useState('');
  const [estilo,  setEstilo]  = useState('');
  const [tono,    setTono]    = useState('motivacional');
  const [loading, setLoading] = useState(false);
  const [script,   setScript]   = useState('');
  const [copied,   setCopied]   = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const wordCount = script.split(/\s+/).filter(Boolean).length;

  async function generate() {
    if (!tema.trim() || loading) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setScript('');

    try {
      const res = await fetch('/api/guiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema, estilo, tono }),
        signal: abortRef.current.signal,
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('Sin respuesta');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setScript(prev => prev + decoder.decode(value, { stream: true }));
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setScript('Error al generar. Intentá de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#080808', color: '#e5e5e5', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-5 py-3 shrink-0" style={{ borderBottom: '1px solid #161616' }}>
        <div className="flex items-center gap-1 p-1 rounded-2xl shrink-0" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
          <Link href="/"
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200"
            style={{ color: '#555' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.background = '#1a1a1a'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#555'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
            🧬 ViralADN
          </Link>
          <Link href="/editor"
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200"
            style={{ color: '#555' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.background = '#1a1a1a'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#555'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
            ✂️ TOPCUT
          </Link>
          <div className="px-4 py-2 rounded-xl text-xs font-bold cursor-default"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff', boxShadow: '0 0 12px #7c3aed44' }}>
            ✍️ Guiones
          </div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#7c3aed22', border: '1px solid #7c3aed44', color: '#a78bfa' }}>BETA</span>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Inputs ── */}
        <aside className="w-80 shrink-0 flex flex-col gap-5 p-5 overflow-y-auto" style={{ borderRight: '1px solid #161616' }}>

          {/* Tema */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#555' }}>Tema del video *</label>
            <textarea
              value={tema}
              onChange={e => setTema(e.target.value)}
              placeholder="Ej: cómo dejar de procrastinar en 3 pasos"
              rows={3}
              className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none transition-all"
              style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', color: '#e5e5e5', lineHeight: 1.5 }}
              onFocus={e => (e.currentTarget.style.borderColor = '#7c3aed44')}
              onBlur={e => (e.currentTarget.style.borderColor = '#1a1a1a')}
            />
          </div>

          {/* Tono */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#555' }}>Tono</label>
            <div className="grid grid-cols-2 gap-1.5">
              {TONOS.map(t => (
                <button key={t.id} onClick={() => setTono(t.id)}
                  className="flex flex-col gap-0.5 px-2.5 py-2 rounded-xl text-left transition-all"
                  style={tono === t.id
                    ? { background: '#7c3aed22', border: '1px solid #7c3aed55', color: '#c4b5fd' }
                    : { background: '#0f0f0f', border: '1px solid #1a1a1a', color: '#555' }}>
                  <span className="text-xs font-semibold">{t.label}</span>
                  <span className="text-[9px] leading-tight" style={{ color: tono === t.id ? '#7c3aed99' : '#333' }}>{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Estilo / voz */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#555' }}>
              Tu estilo <span style={{ color: '#2a2a2a' }}>(opcional)</span>
            </label>
            <p className="text-[10px] leading-relaxed" style={{ color: '#3a3a3a' }}>
              Pegá algo que hayas escrito o dicho — un caption, una historia, como le hablarías a un amigo. Cuanto más natural, mejor lo replica.
            </p>
            <textarea
              value={estilo}
              onChange={e => setEstilo(e.target.value)}
              placeholder={'Ej: "che, me pasó algo que me cambió la cabeza..."'}
              rows={5}
              className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none transition-all"
              style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', color: '#e5e5e5', lineHeight: 1.5 }}
              onFocus={e => (e.currentTarget.style.borderColor = '#7c3aed44')}
              onBlur={e => (e.currentTarget.style.borderColor = '#1a1a1a')}
            />
          </div>

          {/* Botón */}
          <button
            onClick={generate}
            disabled={!tema.trim() || loading}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all"
            style={{
              background: (!tema.trim() || loading) ? '#111' : 'linear-gradient(135deg,#7c3aed,#c13584)',
              color: (!tema.trim() || loading) ? '#333' : '#fff',
              boxShadow: (!tema.trim() || loading) ? 'none' : '0 0 20px #7c3aed44',
              cursor: (!tema.trim() || loading) ? 'not-allowed' : 'pointer',
            }}>
            {loading
              ? <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Escribiendo guión...
                </span>
              : '✍️ Crear guión viral'}
          </button>
        </aside>

        {/* ── Right: Output ── */}
        <main className="flex-1 flex flex-col overflow-hidden p-6 gap-4">

          {/* Empty state */}
          {!script && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
              <span className="text-5xl">✍️</span>
              <p className="text-sm font-semibold" style={{ color: '#2a2a2a' }}>Tu guión aparece acá</p>
              <p className="text-xs" style={{ color: '#1e1e1e' }}>Completá el tema y hacé clic en Crear guión viral</p>
            </div>
          )}

          {/* Script output */}
          {(script || loading) && (
            <div className="flex flex-col flex-1 gap-3 overflow-hidden">

              {/* Toolbar */}
              <div className="flex items-center justify-between shrink-0">
                <p className="text-xs" style={{ color: '#3a3a3a' }}>
                  {wordCount > 0 ? `${wordCount} palabras · ~${Math.round(wordCount / 2.5)}s hablado` : 'Generando...'}
                </p>
                <div className="flex gap-2">
                  {script && !loading && (
                    <>
                      <button onClick={generate}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                        style={{ background: '#111', border: '1px solid #1a1a1a', color: '#555' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#555'; }}>
                        🔄 Regenerar
                      </button>
                      <button onClick={copy}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                        style={{
                          background: copied ? '#7c3aed22' : '#111',
                          border: `1px solid ${copied ? '#7c3aed55' : '#1a1a1a'}`,
                          color: copied ? '#c4b5fd' : '#666',
                        }}>
                        {copied ? '✓ Copiado' : '📋 Copiar'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Script text */}
              <div className="flex-1 overflow-y-auto rounded-2xl p-6"
                style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
                <p className="text-base leading-[1.85] whitespace-pre-wrap" style={{ color: '#d4d4d4', fontFamily: 'Georgia, serif' }}>
                  {script}
                  {loading && (
                    <span className="inline-block w-0.5 h-5 ml-0.5 align-middle animate-pulse" style={{ background: '#7c3aed' }} />
                  )}
                </p>
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}
