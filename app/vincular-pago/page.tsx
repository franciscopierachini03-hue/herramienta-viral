'use client';

import Link from 'next/link';
import { useState } from 'react';

// /vincular-pago — "Pagué pero mi cuenta sale bloqueada" (pagó con OTRO correo).
// Paso 1: escribe el correo con el que pagó → le mandamos un código A ESE correo.
// Paso 2: mete el código → el pago queda enganchado a la cuenta logueada.
// Si el correo de pago es el mismo del login, se vincula directo sin código.

export default function VincularPago() {
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [emailPago, setEmailPago] = useState('');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function llamar(payload: Record<string, unknown>) {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/vincular-pago', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (res.status === 401) { window.location.assign('/login?next=/vincular-pago'); return null; }
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Algo falló. Intenta de nuevo.'); return null; }
      return data;
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
      return null;
    } finally { setLoading(false); }
  }

  async function enviar() {
    const d = await llamar({ accion: 'enviar', emailPago });
    if (!d) return;
    if (d.vinculado) setPaso(3);
    else if (d.enviado) setPaso(2);
  }

  async function verificar() {
    const d = await llamar({ accion: 'verificar', emailPago, codigo });
    if (d?.vinculado) setPaso(3);
  }

  const inputStyle = { background: '#0a0a0a', border: '1px solid #2a2a36', color: '#fff' };

  return (
    <main className="min-h-screen text-white flex items-center justify-center p-6"
      style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
      <div className="w-full max-w-md">
        <div className="rounded-3xl p-8" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>

          {paso === 3 ? (
            <div className="text-center">
              <div className="text-5xl mb-3">✅</div>
              <h1 className="text-xl font-bold mb-2">¡Pago vinculado!</h1>
              <p className="text-sm mb-6" style={{ color: '#999' }}>
                Tu pago quedó conectado a esta cuenta. Ya tienes acceso a lo que compraste.
              </p>
              <Link href="/inicio" className="block w-full py-3.5 rounded-2xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }}>
                Entrar a la plataforma →
              </Link>
            </div>
          ) : (
            <>
              <div className="text-4xl mb-3 text-center">🔗</div>
              <h1 className="text-xl font-bold mb-2 text-center">Vincula tu pago</h1>
              <p className="text-sm mb-6 text-center" style={{ color: '#999' }}>
                {paso === 1
                  ? '¿Pagaste pero tu cuenta sale bloqueada? Suele pasar cuando pagas con un correo y te registras con otro. Escribe el correo que usaste al PAGAR.'
                  : <>Te enviamos un código a <b style={{ color: '#fff' }}>{emailPago}</b>. Revísalo (también spam) y escríbelo acá.</>}
              </p>

              {paso === 1 ? (
                <>
                  <input
                    type="email" value={emailPago} onChange={e => setEmailPago(e.target.value)}
                    placeholder="correo-con-el-que-pagaste@gmail.com" autoFocus
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-3" style={inputStyle}
                    onKeyDown={e => { if (e.key === 'Enter' && !loading) enviar(); }}
                  />
                  <button onClick={enviar} disabled={loading || !emailPago}
                    className="w-full py-3.5 rounded-2xl text-sm font-bold disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }}>
                    {loading ? 'Buscando tu pago...' : 'Continuar →'}
                  </button>
                </>
              ) : (
                <>
                  <input
                    inputMode="numeric" value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••" autoFocus
                    className="w-full px-4 py-3 rounded-xl text-center text-lg tracking-widest outline-none mb-3 font-mono" style={inputStyle}
                    onKeyDown={e => { if (e.key === 'Enter' && !loading) verificar(); }}
                  />
                  <button onClick={verificar} disabled={loading || codigo.length !== 6}
                    className="w-full py-3.5 rounded-2xl text-sm font-bold disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }}>
                    {loading ? 'Verificando...' : 'Vincular mi pago →'}
                  </button>
                  <button onClick={() => { setPaso(1); setCodigo(''); setError(''); }}
                    className="w-full mt-2 py-2 text-xs" style={{ color: '#888' }}>
                    ← Cambiar correo / reenviar
                  </button>
                </>
              )}

              {error && (
                <div className="mt-4 rounded-xl p-3 text-xs" style={{ background: '#7f1d1d22', border: '1px solid #7f1d1d44', color: '#fca5a5' }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <p className="text-center text-xs mt-5" style={{ color: '#666' }}>
          El código llega al correo del pago: así nadie puede reclamar un pago que no es suyo.
          {' '}<Link href="/inicio" className="underline" style={{ color: '#888' }}>Volver a Inicio</Link>
        </p>
      </div>
    </main>
  );
}
