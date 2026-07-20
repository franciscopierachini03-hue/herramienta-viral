'use client';

// 🎯 Chat de ViralADN — basado en el CLIENTE IDEAL:
//   1) La persona describe su cliente ideal (una vez).
//   2) La IA devuelve palabras clave (1-2 palabras) como chips clicables.
//   3) Las palabras se GUARDAN en su cuenta (/api/nicho) → cuando vuelve, su
//      lista ya está lista para buscar, sin rehacer el proceso.
// Tocar un chip 🔎 dispara la búsqueda (via onPick). El ⭐ guarda/quita.

import { useState, useRef, useEffect } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string; terms?: string[] };

const EJEMPLO_CLIENTE = 'Ej: Expertos, coaches, consultores y mentores con una oferta validada que quieren escalar sus ventas convirtiendo su conocimiento en contenido viral.';

export default function IdeasChat({ onPick }: { onPick: (term: string) => void }) {
  const [open, setOpen] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [dormido, setDormido] = useState(false);
  const [clienteIdeal, setClienteIdeal] = useState('');
  const [saved, setSaved] = useState<string[]>([]);
  const [definiendo, setDefiniendo] = useState(true); // pidiendo el cliente ideal
  const [ayudando, setAyudando] = useState(false);    // modo "ayudame a definirlo"
  const [propuesta, setPropuesta] = useState('');     // cliente ideal propuesto por la IA
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const shownRef = useRef<string[]>([]); // palabras ya mostradas/guardadas (para "dame más")
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy, cargando]);

  // Cargar lo guardado al abrir.
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/nicho', { cache: 'no-store' });
        const j = await r.json();
        const ci: string = j.clienteIdeal || '';
        const pal: string[] = Array.isArray(j.palabras) ? j.palabras : [];
        setDormido(!!j.dormido);
        setClienteIdeal(ci);
        setSaved(pal);
        shownRef.current = [...pal];
        setDefiniendo(!ci);
        setMessages([{
          role: 'assistant',
          content: ci
            ? '¡Hola de nuevo! 👋 Tu cliente ideal ya está guardado. Tocá ✨ Generar más palabras cuando quieras, o cambialo.'
            : 'Armemos tu lista 🔥 Contame en una frase: ¿quién es tu CLIENTE IDEAL?',
        }]);
      } catch {
        setDefiniendo(true);
        setMessages([{ role: 'assistant', content: '¿Quién es tu CLIENTE IDEAL? Describilo en una frase y te armo la lista.' }]);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  async function persistir(ci: string, pal: string[]) {
    try {
      const r = await fetch('/api/nicho', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteIdeal: ci, palabras: pal }),
      });
      const j = await r.json().catch(() => ({}));
      if (j?.dormido) setDormido(true);
    } catch { /* best-effort */ }
  }

  async function generar(ci: string, extra: string) {
    setBusy(true);
    try {
      const r = await fetch('/api/ideas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteIdeal: ci, exclude: shownRef.current, extra }),
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

  // Modo "ayudame a definirlo": la IA hace preguntas cortas y propone la frase.
  async function ayudarADefinir(historial: Msg[]) {
    setBusy(true);
    try {
      const r = await fetch('/api/ideas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'definir', messages: historial.map(m => ({ role: m.role, content: m.content })) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'error');
      setMessages(m => [...m, { role: 'assistant', content: j.reply || '¿Qué vendés?' }]);
      setPropuesta(typeof j.propuesta === 'string' ? j.propuesta : '');
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'No pude seguir ahora. Probá de nuevo en un momento.' }]);
    } finally { setBusy(false); }
  }

  function arrancarAyuda() {
    setAyudando(true);
    setPropuesta('');
    setMessages(m => [...m, { role: 'assistant', content: 'Dale, lo armamos juntos 💪 Contame: ¿qué vendés o qué resultado le hacés lograr a la gente?' }]);
  }

  function usarPropuesta() {
    const ci = propuesta.trim();
    if (!ci) return;
    setClienteIdeal(ci);
    setDefiniendo(false);
    setAyudando(false);
    setPropuesta('');
    setMessages(m => [...m, { role: 'assistant', content: `Guardado ✅\n\n🎯 ${ci}\n\nAhora te armo tus palabras.` }]);
    persistir(ci, saved);
    generar(ci, '');
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    const nuevos: Msg[] = [...messages, { role: 'user', content: t }];
    setMessages(nuevos);
    setInput('');
    if (ayudando) {
      await ayudarADefinir(nuevos);
    } else if (definiendo) {
      setClienteIdeal(t);
      setDefiniendo(false);
      persistir(t, saved);
      await generar(t, '');
    } else {
      await generar(clienteIdeal, t); // ajuste/refinamiento libre
    }
  }

  const isSaved = (t: string) => saved.some(x => x.toLowerCase() === t.toLowerCase());

  function toggleSave(t: string) {
    setSaved(prev => {
      const yaEsta = prev.some(x => x.toLowerCase() === t.toLowerCase());
      const next = yaEsta ? prev.filter(x => x.toLowerCase() !== t.toLowerCase()) : [...prev, t];
      persistir(clienteIdeal, next);
      return next;
    });
  }

  function guardarTodas(terms: string[]) {
    setSaved(prev => {
      const set = new Set(prev.map(x => x.toLowerCase()));
      const next = [...prev];
      for (const t of terms) if (!set.has(t.toLowerCase())) { next.push(t); set.add(t.toLowerCase()); }
      persistir(clienteIdeal, next);
      return next;
    });
  }

  function cambiarCliente() {
    setDefiniendo(true);
    setMessages(m => [...m, { role: 'assistant', content: 'Dale 👇 ¿Quién es tu nuevo CLIENTE IDEAL? (tus palabras guardadas quedan intactas)' }]);
  }

  // Todavía no definió su cliente ideal → lo mostramos como PASO 1, destacado y
  // sin poder ocultarlo (antes quedaba escondido como un ayudante opcional).
  const sinDefinir = !clienteIdeal && !cargando;
  const ultimaConTerms = [...messages].reverse().find(m => m.terms && m.terms.length);
  const placeholder = ayudando ? 'Contame qué vendés o a quién ayudás…'
    : definiendo ? EJEMPLO_CLIENTE
    : 'Ajustá o pedí más (ej: más de ventas, en inglés)…';

  return (
    <div className="rounded-2xl mb-5 overflow-hidden" style={{
      background: 'linear-gradient(145deg, #120c1f, #0b0b0b)',
      border: sinDefinir ? '1px solid #a855f7' : '1px solid #7c3aed44',
      boxShadow: sinDefinir ? '0 0 40px rgba(168,85,247,.22)' : undefined,
    }}>
      <button onClick={() => { if (!sinDefinir) setOpen(o => !o); }}
        className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left">
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-bold text-white">
            <span>🎯</span> {sinDefinir ? 'Paso 1 — Definí tu cliente ideal' : 'Tu cliente ideal y tu lista de palabras'}
          </span>
          {sinDefinir && (
            <span className="block text-[11px] mt-1" style={{ color: '#a78bfa' }}>
              Lo hacés <b>una sola vez</b>: te arma tus palabras para buscar virales y, desde ahora, <b>tus guiones se adaptan solos</b> a quien le vendés.
            </span>
          )}
        </span>
        {!sinDefinir && <span className="text-xs shrink-0" style={{ color: '#888' }}>{open ? 'Ocultar ▲' : 'Mostrar ▼'}</span>}
      </button>

      {(open || sinDefinir) && (
        <div className="px-4 pb-4">
          {/* Palabras guardadas — persisten, no se rehacen */}
          {saved.length > 0 && (
            <div className="rounded-xl p-3 mb-3" style={{ background: '#0a1508', border: '1px solid #22c55e33' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold" style={{ color: '#86efac' }}>⭐ Tus palabras guardadas ({saved.length})</span>
                <span className="text-[10px]" style={{ color: '#5a8a6a' }}>se guardan solas · tocá 🔎 para buscar</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {saved.map((t, k) => (
                  <span key={k} className="inline-flex items-center rounded-full overflow-hidden" style={{ background: '#22c55e14', border: '1px solid #22c55e44' }}>
                    <button onClick={() => onPick(t)} className="text-xs pl-3 pr-2 py-1.5 font-semibold" style={{ color: '#86efac' }} title="Buscar este tema">🔎 {t}</button>
                    <button onClick={() => toggleSave(t)} className="text-xs px-2 py-1.5" style={{ color: '#5a8a6a' }} title="Quitar de guardadas">✕</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Cliente ideal actual */}
          {clienteIdeal && !definiendo && (
            <div className="rounded-xl p-3 mb-3 flex items-start justify-between gap-3" style={{ background: '#120c1f', border: '1px solid #7c3aed33' }}>
              <div className="min-w-0">
                <div className="text-[11px] font-bold mb-0.5" style={{ color: '#a78bfa' }}>🎯 Tu cliente ideal</div>
                <div className="text-xs" style={{ color: '#cbb8f0' }}>{clienteIdeal}</div>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button onClick={() => generar(clienteIdeal, '')} disabled={busy}
                  className="text-[11px] px-2.5 py-1 rounded-full font-bold whitespace-nowrap disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#a855f7,#ec4899)', color: '#fff' }}>✨ Generar más</button>
                <button onClick={cambiarCliente}
                  className="text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap"
                  style={{ background: '#141414', border: '1px solid #2a2a2a', color: '#888' }}>✎ Cambiar</button>
              </div>
            </div>
          )}

          {dormido && (
            <div className="rounded-xl p-2.5 mb-3 text-[11px]" style={{ background: '#2a1a06', border: '1px solid #7c5410', color: '#fbbf24' }}>
              ⚠️ El guardado se activa al correr el SQL (nicho_usuario). Por ahora las palabras no persisten al recargar.
            </div>
          )}

          {/* Conversación */}
          <div className="flex flex-col gap-2.5 mb-3 max-h-80 overflow-y-auto pr-1">
            {cargando && <div className="self-start text-xs" style={{ color: '#888' }}>cargando tu lista…</div>}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'self-end max-w-[85%]' : 'self-start max-w-[92%]'}>
                <div className="px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-line"
                  style={m.role === 'user'
                    ? { background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }
                    : { background: '#141414', border: '1px solid #232323', color: '#ddd' }}>
                  {m.content}
                </div>
                {m.terms && m.terms.length > 0 && (
                  <>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {m.terms.map((t, k) => (
                        <span key={k} className="inline-flex items-center rounded-full overflow-hidden" style={{ background: '#7c3aed1f', border: '1px solid #7c3aed55' }}>
                          <button onClick={() => onPick(t)} className="text-xs pl-3 pr-2 py-1.5 font-semibold" style={{ color: '#c4b5fd' }} title="Buscar este tema">🔎 {t}</button>
                          <button onClick={() => toggleSave(t)} className="text-xs px-2 py-1.5" style={{ color: isSaved(t) ? '#fcd34d' : '#7c6aa8' }} title={isSaved(t) ? 'Guardada' : 'Guardar'}>{isSaved(t) ? '⭐' : '☆'}</button>
                        </span>
                      ))}
                    </div>
                    <button onClick={() => guardarTodas(m.terms!)}
                      className="text-[11px] px-3 py-1 mt-2 rounded-full font-semibold"
                      style={{ background: '#22c55e18', border: '1px solid #22c55e44', color: '#86efac' }}>⭐ Guardar todas</button>
                  </>
                )}
              </div>
            ))}
            {busy && (
              <div className="self-start px-3.5 py-2.5 rounded-2xl text-sm" style={{ background: '#141414', border: '1px solid #232323', color: '#888' }}>
                armando tus palabras…
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* "No lo sé" → la IA te ayuda a definir el cliente ideal */}
          {definiendo && !ayudando && !busy && (
            <button onClick={arrancarAyuda} className="text-xs px-3 py-1.5 rounded-full mb-3"
              style={{ background: '#1a1030', border: '1px solid #7c3aed55', color: '#c4b5fd' }}>
              🤔 No lo sé — ayudame a definirlo
            </button>
          )}

          {/* Propuesta de cliente ideal, lista para guardar */}
          {propuesta && !busy && (
            <div className="rounded-xl p-3 mb-3" style={{ background: '#0a1508', border: '1px solid #22c55e44' }}>
              <div className="text-[11px] font-bold mb-1" style={{ color: '#86efac' }}>🎯 Tu cliente ideal (propuesta)</div>
              <div className="text-xs mb-2.5" style={{ color: '#d7f5e3' }}>{propuesta}</div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={usarPropuesta} className="text-[11px] px-3 py-1.5 rounded-full font-bold"
                  style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff' }}>
                  ✅ Usar este y darme las palabras
                </button>
                <button onClick={() => setPropuesta('')} className="text-[11px] px-3 py-1.5 rounded-full"
                  style={{ background: '#141414', border: '1px solid #2a2a2a', color: '#888' }}>
                  ✍️ Ajustarlo
                </button>
              </div>
            </div>
          )}

          {/* Acciones tras generar */}
          {!definiendo && ultimaConTerms && !busy && (
            <div className="flex gap-2 mb-3 flex-wrap">
              <button onClick={() => generar(clienteIdeal, '')}
                className="text-xs px-3 py-1.5 rounded-full font-semibold"
                style={{ background: '#7c3aed22', border: '1px solid #7c3aed55', color: '#c4b5fd' }}>🔄 Dame más palabras</button>
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
          {definiendo && <p className="text-[11px] mt-2" style={{ color: '#7c6aa8' }}>💡 Cuanto más claro el cliente ideal, más acertadas las palabras.</p>}
        </div>
      )}
    </div>
  );
}
