'use client';

import { useState } from 'react';

// Panel para enviar el correo de acceso Legacy (branded, con código de descuento)
// a una lista de emails. Pegás emails + elegís el código → Resend los manda.

const CODES = ['LegacyPeru', 'LegacyQuito', 'LegacyBogota', 'LegacyPanama'];

export default function SendAccessPanel() {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState('');
  const [code, setCode] = useState(CODES[0]);
  const [customCode, setCustomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const emailCount = emails.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean).length;
  const finalCode = code === '__custom__' ? customCode.trim() : code;

  async function send() {
    if (loading) return;
    if (!finalCode) { setResult('⚠️ Falta el código.'); return; }
    if (emailCount === 0) { setResult('⚠️ Pegá al menos un email.'); return; }
    if (!confirm(`Vas a enviar el correo de acceso con el código "${finalCode}" a ${emailCount} email(s). ¿Confirmás?`)) return;

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/send-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails, code: finalCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(`❌ ${data.error || 'Error al enviar.'}`);
      } else {
        let msg = `✅ Enviados ${data.sent}/${data.total} con código "${data.code}".`;
        if (data.failed > 0) msg += ` Fallaron ${data.failed}.`;
        if (data.invalid?.length) msg += ` Inválidos ignorados: ${data.invalid.length}.`;
        setResult(msg);
        if (data.sent > 0) setEmails('');
      }
    } catch {
      setResult('❌ Error de conexión.');
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-xl text-xs font-bold"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }}>
        ✉️ Enviar accesos
      </button>
    );
  }

  return (
    <div className="rounded-2xl p-5 mb-6"
      style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #7c3aed55' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold" style={{ color: '#c4b5fd' }}>✉️ Enviar correo de acceso Legacy</h3>
        <button onClick={() => setOpen(false)} className="text-xs" style={{ color: '#888' }}>Cerrar ✕</button>
      </div>

      <p className="text-xs mb-3" style={{ color: '#888' }}>
        Pegá los emails (separados por coma, espacio o salto de línea). Cada uno recibe el correo branded con el código que elijas para poner en Stripe.
      </p>

      <textarea
        value={emails}
        onChange={e => setEmails(e.target.value)}
        rows={5}
        placeholder={'juan@gmail.com\nmaria@hotmail.com\n...'}
        className="w-full px-3 py-2 rounded-xl text-sm outline-none mb-3"
        style={{ background: '#0a0a0a', border: '1px solid #1f1f1f', color: '#fff', fontFamily: 'monospace' }}
      />

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: '#888' }}>Código:</span>
          <select value={code} onChange={e => setCode(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
            style={{ background: '#0a0a0a', border: '1px solid #1f1f1f', color: '#fff' }}>
            {CODES.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__custom__">Otro…</option>
          </select>
          {code === '__custom__' && (
            <input value={customCode} onChange={e => setCustomCode(e.target.value)}
              placeholder="MICODIGO"
              className="px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: '#0a0a0a', border: '1px solid #7c3aed55', color: '#fff' }} />
          )}
        </div>
        <span className="text-xs" style={{ color: '#666' }}>{emailCount} email(s) detectado(s)</span>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={send} disabled={loading}
          className="px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }}>
          {loading ? 'Enviando…' : `Enviar a ${emailCount} →`}
        </button>
        {result && <span className="text-xs" style={{ color: result.startsWith('✅') ? '#86efac' : '#fca5a5' }}>{result}</span>}
      </div>

      <p className="text-[10px] mt-3" style={{ color: '#555' }}>
        ⚠️ Confirmá que el código exista en Stripe (cupón &ldquo;Mes gratis Viral ADN&rdquo;) antes de enviar. Máx 500 por tanda.
      </p>
    </div>
  );
}
