'use client';

// Chat de ideas para ViralADN: la persona cuenta su nicho y la IA le sugiere
// TÉRMINOS de búsqueda (chips clicables). Al tocar un chip, dispara la búsqueda
// (via onPick). Sirve para que el que no sabe qué buscar arranque con una noción.

import { useState, useRef, useEffect } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string; terms?: string[] };

const STARTERS = [
  'Vendo cursos online', 'Tengo un gimnasio', 'Soy coach de vida',
  'Negocio de comida', 'Finanzas e inversión', 'Marketing para mi marca',
];

export default function IdeasChat({ onPick }: { onPick: (term: string) => void }) {
  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    const next: Msg[] = [...messages, { role: 'user', content: msg }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const r = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'error');
      setMessages(m => [...m, { role: 'assistant', content: j.reply || 'Probá con estos temas:', terms: Array.isArray(j.terms) ? j.terms : [] }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'No pude generar ideas ahora. Probá de nuevo en un momento.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl mb-5 overflow-hidden" style={{ background: 'linear-gradient(145deg, #120c1f, #0b0b0b)', border: '1px solid #7c3aed44' }}>
      {/* Header */}
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-sm font-bold text-white">
          <span>💡</span> ¿No sabés qué buscar? Pedile ideas a la IA
        </span>
        <span className="text-xs" style={{ color: '#888' }}>{open ? 'Ocultar ▲' : 'Mostrar ▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {/* Mensajes */}
          {messages.length > 0 && (
            <div className="flex flex-col gap-2.5 mb-3 max-h-72 overflow-y-auto pr-1">
              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'self-end max-w-[85%]' : 'self-start max-w-[92%]'}>
                  <div className="px-3.5 py-2.5 rounded-2xl text-sm"
                    style={m.role === 'user'
                      ? { background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }
                      : { background: '#141414', border: '1px solid #232323', color: '#ddd' }}>
                    {m.content}
                  </div>
                  {m.terms && m.terms.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {m.terms.map((t, k) => (
                        <button key={k} onClick={() => onPick(t)}
                          className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
                          style={{ background: '#7c3aed1f', border: '1px solid #7c3aed55', color: '#c4b5fd' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#7c3aed33'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#7c3aed1f'; }}
                          title="Buscar este tema">
                          🔎 {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {busy && (
                <div className="self-start px-3.5 py-2.5 rounded-2xl text-sm" style={{ background: '#141414', border: '1px solid #232323', color: '#888' }}>
                  pensando ideas…
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}

          {/* Sugerencias de arranque (cuando está vacío) */}
          {messages.length === 0 && (
            <div className="mb-3">
              <p className="text-xs mb-2" style={{ color: '#999' }}>Contame qué hacés y te doy temas para buscar. Por ejemplo:</p>
              <div className="flex flex-wrap gap-1.5">
                {STARTERS.map(s => (
                  <button key={s} onClick={() => send(s)} disabled={busy}
                    className="text-xs px-3 py-1.5 rounded-full transition-all disabled:opacity-50"
                    style={{ background: '#141414', border: '1px solid #2a2a2a', color: '#aaa' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder="Ej: tengo una marca de ropa, ¿qué busco?"
              className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: '#0c0c0c', border: '1px solid #2a2a2a', color: '#fff' }} />
            <button onClick={() => send(input)} disabled={busy || !input.trim()}
              className="px-4 rounded-xl text-sm font-bold disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff' }}>↑</button>
          </div>
          <p className="text-[11px] mt-2" style={{ color: '#555' }}>Tocá un tema sugerido 🔎 y se busca solo.</p>
        </div>
      )}
    </div>
  );
}
