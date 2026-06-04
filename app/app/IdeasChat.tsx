'use client';

// Chat de ideas de ViralADN — método de 3 preguntas:
//   1) ¿A qué te dedicás hoy? (nicho)
//   2) ¿Qué es lo que más te apasiona hoy? (pilar 1)
//   3) ¿Qué es lo que más amás hoy? (pilar 2)
// Con eso la IA devuelve 15 palabras CLAVE (de a una palabra) como chips
// clicables. Al tocar un chip, se dispara la búsqueda (via onPick).

import { useState, useRef, useEffect } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string; terms?: string[] };
type Answers = { dedico: string; apasiona: string; amo: string };

const Q1 = 'Te ayudo a armar tu lista de palabras 🔥 Respondé 3 cosas (una por una):\n\n1️⃣ ¿A qué te dedicás hoy en día? (tu nicho)';
const Q2 = '2️⃣ ¿Qué es lo que MÁS te apasiona hoy en día?';
const Q3 = '3️⃣ Y por último: ¿qué es lo que más amás hoy?';

export default function IdeasChat({ onPick }: { onPick: (term: string) => void }) {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0); // 0,1,2 = juntando respuestas · 3 = generado
  const [ans, setAns] = useState<Answers>({ dedico: '', apasiona: '', amo: '' });
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: Q1 }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const shownRef = useRef<string[]>([]); // palabras ya mostradas (para "dame más")
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  async function generate(answers: Answers, extra: string) {
    setBusy(true);
    try {
      const r = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...answers, exclude: shownRef.current, extra }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'error');
      const terms: string[] = Array.isArray(j.terms) ? j.terms : [];
      shownRef.current = [...shownRef.current, ...terms];
      setMessages(m => [...m, { role: 'assistant', content: j.reply || 'Acá tenés tus palabras:', terms }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'No pude generar las palabras ahora. Probá de nuevo en un momento.' }]);
    } finally {
      setBusy(false);
    }
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setMessages(m => [...m, { role: 'user', content: t }]);
    setInput('');

    if (step === 0) {
      setAns(a => ({ ...a, dedico: t }));
      setMessages(m => [...m, { role: 'assistant', content: Q2 }]);
      setStep(1);
    } else if (step === 1) {
      setAns(a => ({ ...a, apasiona: t }));
      setMessages(m => [...m, { role: 'assistant', content: Q3 }]);
      setStep(2);
    } else if (step === 2) {
      const finalAns = { ...ans, amo: t };
      setAns(finalAns);
      setStep(3);
      await generate(finalAns, '');
    } else {
      await generate(ans, t); // refinamiento libre
    }
  }

  function reset() {
    setStep(0);
    setAns({ dedico: '', apasiona: '', amo: '' });
    shownRef.current = [];
    setMessages([{ role: 'assistant', content: 'Dale, arrancamos de nuevo 🔥\n\n1️⃣ ¿A qué te dedicás hoy en día? (tu nicho)' }]);
  }

  const placeholder = step < 3 ? 'Escribí tu respuesta…' : 'Pedí más o ajustá (ej: más de fitness)…';

  return (
    <div className="rounded-2xl mb-5 overflow-hidden" style={{ background: 'linear-gradient(145deg, #120c1f, #0b0b0b)', border: '1px solid #7c3aed44' }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-sm font-bold text-white">
          <span>💡</span> ¿No sabés qué buscar? Respondé 3 preguntas y te doy tu lista
        </span>
        <span className="text-xs" style={{ color: '#888' }}>{open ? 'Ocultar ▲' : 'Mostrar ▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {/* Progreso de las 3 preguntas */}
          {step < 3 && (
            <div className="flex items-center gap-1.5 mb-3">
              {[0, 1, 2].map(i => (
                <span key={i} className="h-1 flex-1 rounded-full" style={{ background: i <= step ? 'linear-gradient(90deg,#a855f7,#ec4899)' : '#222' }} />
              ))}
              <span className="text-[10px] ml-1" style={{ color: '#888' }}>{Math.min(step + 1, 3)}/3</span>
            </div>
          )}

          <div className="flex flex-col gap-2.5 mb-3 max-h-80 overflow-y-auto pr-1">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'self-end max-w-[85%]' : 'self-start max-w-[92%]'}>
                <div className="px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-line"
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
                buscando tus palabras…
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Acciones tras generar */}
          {step === 3 && !busy && (
            <div className="flex gap-2 mb-3 flex-wrap">
              <button onClick={() => generate(ans, '')}
                className="text-xs px-3 py-1.5 rounded-full font-semibold"
                style={{ background: '#7c3aed22', border: '1px solid #7c3aed55', color: '#c4b5fd' }}>🔄 Dame más palabras</button>
              <button onClick={reset}
                className="text-xs px-3 py-1.5 rounded-full"
                style={{ background: '#141414', border: '1px solid #2a2a2a', color: '#888' }}>↺ Empezar de nuevo</button>
            </div>
          )}

          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder={placeholder}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: '#0c0c0c', border: '1px solid #2a2a2a', color: '#fff' }} />
            <button onClick={() => send(input)} disabled={busy || !input.trim()}
              className="px-4 rounded-xl text-sm font-bold disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff' }}>↑</button>
          </div>
          {step === 3 && <p className="text-[11px] mt-2" style={{ color: '#555' }}>Tocá una palabra 🔎 y se busca sola.</p>}
        </div>
      )}
    </div>
  );
}
