'use client';

// 🆘 Centro de Ayuda (público): chat de FAQ con IA + formulario de contacto.
// El chat llama /api/ayuda/chat (anclado a la base de conocimiento). Si no
// resuelve, el formulario manda el mensaje a contacto@viraladn.com.

import { useEffect, useRef, useState } from 'react';
import { SUGERENCIAS } from '@/lib/ayuda-faq';

type Msg = { role: 'user' | 'assistant'; content: string };

const SALUDO: Msg = {
  role: 'assistant',
  content: '¡Hola! 👋 Soy el asistente de ViralADN ✕ TOPCUT. Preguntame lo que quieras sobre las herramientas, tu acceso, precios o la comunidad. Si es algo de tu cuenta, más abajo podés escribirnos directo.',
};

export default function AyudaCliente() {
  const [messages, setMessages] = useState<Msg[]>([SALUDO]);
  const [input, setInput] = useState('');
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, enviando]);

  async function preguntar(texto: string) {
    const q = texto.trim();
    if (!q || enviando) return;
    const nuevos: Msg[] = [...messages, { role: 'user', content: q }];
    setMessages(nuevos);
    setInput('');
    setEnviando(true);
    try {
      const r = await fetch('/api/ayuda/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nuevos.filter(m => m !== SALUDO).map(m => ({ role: m.role, content: m.content })) }),
      });
      const d = await r.json();
      setMessages(m => [...m, { role: 'assistant', content: d.reply || d.error || 'No pude responder. Probá el formulario de abajo.' }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Se cortó la conexión. Probá de nuevo o escribinos por el formulario de abajo.' }]);
    } finally { setEnviando(false); }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="inline-block text-3xl mb-2">🆘</div>
        <h1 className="text-2xl font-extrabold" style={{ background: 'linear-gradient(135deg,#a855f7,#c13584)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Centro de Ayuda</h1>
        <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>Respuestas al instante — y si necesitás a una persona, escribinos.</p>
      </div>

      {/* Chat */}
      <div className="rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(145deg,#141414,#0d0d0d)', border: '1px solid #262626' }}>
        <div ref={scrollRef} className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: 420, minHeight: 240 }}>
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="text-sm leading-relaxed px-4 py-2.5 rounded-2xl whitespace-pre-wrap" style={{
                maxWidth: '85%',
                background: m.role === 'user' ? 'linear-gradient(135deg,#7c3aed,#c13584)' : '#1c1c22',
                color: m.role === 'user' ? '#fff' : '#e5e7eb',
                border: m.role === 'user' ? 'none' : '1px solid #2a2a32',
                borderBottomRightRadius: m.role === 'user' ? 4 : 16,
                borderBottomLeftRadius: m.role === 'user' ? 16 : 4,
              }}>{m.content}</div>
            </div>
          ))}
          {enviando && (
            <div className="flex justify-start">
              <div className="text-sm px-4 py-2.5 rounded-2xl" style={{ background: '#1c1c22', color: '#9ca3af', border: '1px solid #2a2a32' }}>escribiendo…</div>
            </div>
          )}
        </div>

        {/* Sugerencias (solo antes de la primera pregunta) */}
        {messages.length === 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {SUGERENCIAS.map(s => (
              <button key={s} onClick={() => preguntar(s)} className="text-[12px] px-3 py-1.5 rounded-full"
                style={{ background: '#1a1030', border: '1px solid #4c1d95', color: '#c4b5fd' }}>{s}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <form onSubmit={e => { e.preventDefault(); preguntar(input); }} className="flex items-center gap-2 p-3" style={{ borderTop: '1px solid #262626' }}>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Escribí tu pregunta…"
            className="flex-1 text-sm px-4 py-2.5 rounded-full outline-none"
            style={{ background: '#0a0a12', border: '1px solid #2a2a36', color: '#fff' }} />
          <button type="submit" disabled={enviando || !input.trim()} className="text-sm font-bold px-4 py-2.5 rounded-full whitespace-nowrap"
            style={{ background: enviando || !input.trim() ? '#3f3f46' : 'linear-gradient(135deg,#7c3aed,#c13584)', color: '#fff', opacity: enviando || !input.trim() ? 0.6 : 1 }}>
            Enviar
          </button>
        </form>
      </div>

      {/* Formulario de contacto */}
      <FormularioContacto />
    </div>
  );
}

function FormularioContacto() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [asunto, setAsunto] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [hp, setHp] = useState(''); // honeypot
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true); setError('');
    try {
      const r = await fetch('/api/ayuda/contacto', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, asunto, mensaje, hp }),
      });
      const d = await r.json();
      if (d.error) setError(d.error);
      else setEnviado(true);
    } catch { setError('No se pudo enviar. Probá de nuevo.'); }
    finally { setEnviando(false); }
  }

  const inp = { background: '#0a0a12', border: '1px solid #2a2a36', color: '#fff' } as const;

  if (enviado) return (
    <div className="mt-6 rounded-3xl p-6 text-center" style={{ background: '#0a1a12', border: '1px solid #22c55e55' }}>
      <div className="text-3xl mb-2">✅</div>
      <div className="text-base font-bold" style={{ color: '#86efac' }}>¡Mensaje enviado!</div>
      <p className="text-sm mt-1" style={{ color: '#7da88f' }}>Te llegó una confirmación a tu correo. Te respondemos a la brevedad.</p>
    </div>
  );

  return (
    <div className="mt-6 rounded-3xl p-6" style={{ background: 'linear-gradient(145deg,#141414,#0d0d0d)', border: '1px solid #262626' }}>
      <h2 className="text-base font-bold" style={{ color: '#e4e4e7' }}>¿No resolviste tu duda? Escribinos</h2>
      <p className="text-xs mt-1 mb-4" style={{ color: '#9ca3af' }}>Tu mensaje llega directo a nuestro equipo y te respondemos a tu correo.</p>
      <form onSubmit={enviar} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input required value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre"
            className="text-sm px-4 py-2.5 rounded-xl outline-none" style={inp} />
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Tu correo"
            className="text-sm px-4 py-2.5 rounded-xl outline-none" style={inp} />
        </div>
        <input value={asunto} onChange={e => setAsunto(e.target.value)} placeholder="Asunto (opcional)"
          className="w-full text-sm px-4 py-2.5 rounded-xl outline-none" style={inp} />
        <textarea required value={mensaje} onChange={e => setMensaje(e.target.value)} placeholder="Contanos en qué te ayudamos…" rows={4}
          className="w-full text-sm px-4 py-2.5 rounded-xl outline-none resize-y" style={inp} />
        {/* Honeypot: oculto para humanos, tentador para bots */}
        <input tabIndex={-1} autoComplete="off" value={hp} onChange={e => setHp(e.target.value)}
          aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />
        {error && <div className="text-xs" style={{ color: '#fca5a5' }}>{error}</div>}
        <button type="submit" disabled={enviando} className="w-full text-sm font-bold py-3 rounded-xl"
          style={{ background: enviando ? '#3f3f46' : 'linear-gradient(135deg,#7c3aed,#c13584)', color: '#fff', opacity: enviando ? 0.7 : 1 }}>
          {enviando ? 'Enviando…' : 'Enviar mensaje'}
        </button>
      </form>
    </div>
  );
}
