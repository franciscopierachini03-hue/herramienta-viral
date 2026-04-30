'use client';

import Link from 'next/link';
import { useState } from 'react';

// Esta página la abre el usuario tras clickear el link "Olvidé mi contraseña"
// del correo. Cuando llegan acá, Supabase ya intercambió el code en
// /auth/callback y la cookie de sesión está seteada.
//
// Si la cookie expiró o el link es inválido, /api/auth/update-password
// devuelve 401 y le pedimos que pida un nuevo link.

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');

    if (password.length < 8) {
      setError('Mínimo 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }
      setDone(true);
      setTimeout(() => { window.location.href = '/app?session=new'; }, 1500);
    } catch {
      setError('Error de conexión. Probá de nuevo.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen text-white flex flex-col" style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="ViralADN" width={36} height={36}
            style={{ filter: 'drop-shadow(0 0 14px #7c3aed55)' }} />
          <span className="text-lg font-bold">ViralADN</span>
        </Link>
      </nav>

      <section className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-3xl p-8"
            style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>

            {done ? (
              <div className="text-center">
                <div className="text-5xl mb-4">✅</div>
                <h2 className="text-2xl font-bold mb-2">Contraseña actualizada</h2>
                <p className="text-sm" style={{ color: '#888' }}>Te llevamos a tu cuenta…</p>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-2">Nueva contraseña</h2>
                <p className="text-sm mb-6" style={{ color: '#888' }}>
                  Elegí una contraseña nueva y volvemos a entrar.
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs mb-1.5 block" style={{ color: '#888' }}>
                      Nueva contraseña <span style={{ color: '#555' }}>(mínimo 8 caracteres)</span>
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: '#0a0a0a', border: '1px solid #1f1f1f', color: '#fff' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1.5 block" style={{ color: '#888' }}>Confirmar</label>
                    <input
                      type="password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: '#0a0a0a', border: '1px solid #1f1f1f', color: '#fff' }}
                    />
                  </div>

                  {error && (
                    <div className="rounded-xl p-3 text-xs" style={{ background: '#7f1d1d22', border: '1px solid #7f1d1d44', color: '#fca5a5' }}>
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-2xl text-sm font-bold disabled:opacity-50 mt-2"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff', boxShadow: '0 0 20px #7c3aed44' }}>
                    {loading ? 'Guardando...' : 'Guardar contraseña →'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
