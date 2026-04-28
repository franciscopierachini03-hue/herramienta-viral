'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}

function Login() {
  const params = useSearchParams();
  const next = params.get('next') || '';

  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');

    if (password.length < 8) {
      setError('La contraseña tiene que tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, name, email, phone, password, next }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }
      // Éxito → redirigimos a donde diga el server (/precios o /app)
      window.location.href = data.redirect || '/app';
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen text-white flex flex-col" style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
      {/* NAV */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-lg"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', boxShadow: '0 0 20px #7c3aed55' }}>
            🧬
          </div>
          <span className="text-lg font-bold">ViralADN</span>
        </Link>
        <Link href="/precios" className="text-sm" style={{ color: '#888' }}>
          Ver precios →
        </Link>
      </nav>

      {/* FORM */}
      <section className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-3xl p-8"
            style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>

            {/* Toggle login / signup */}
            <div className="flex gap-1 p-1 rounded-2xl mb-6" style={{ background: '#0a0a0a' }}>
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(''); }}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                style={mode === 'signup'
                  ? { background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }
                  : { color: '#666' }}>
                Crear cuenta
              </button>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                style={mode === 'login'
                  ? { background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }
                  : { color: '#666' }}>
                Iniciar sesión
              </button>
            </div>

            <h2 className="text-2xl font-bold mb-2">
              {mode === 'signup' ? 'Empezá tu prueba' : 'Bienvenido de vuelta'}
            </h2>
            <p className="text-sm mb-6" style={{ color: '#888' }}>
              {mode === 'signup'
                ? 'Completá tus datos y elegí una contraseña. Te llevamos a pagar.'
                : 'Ingresá con tu correo y contraseña.'}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {mode === 'signup' && (
                <>
                  <div>
                    <label className="text-xs mb-1.5 block" style={{ color: '#888' }}>Nombre completo</label>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      placeholder="Tu nombre"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
                      style={{ background: '#0a0a0a', border: '1px solid #1f1f1f', color: '#fff' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1.5 block" style={{ color: '#888' }}>Teléfono (con código de país)</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      required
                      placeholder="+52 55 1234 5678"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
                      style={{ background: '#0a0a0a', border: '1px solid #1f1f1f', color: '#fff' }}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#888' }}>Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="tu@correo.com"
                  autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
                  style={{ background: '#0a0a0a', border: '1px solid #1f1f1f', color: '#fff' }}
                />
              </div>

              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#888' }}>
                  Contraseña {mode === 'signup' && <span style={{ color: '#555' }}>(mínimo 8 caracteres)</span>}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="••••••••"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
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
                className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-50 mt-2"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff', boxShadow: '0 0 20px #7c3aed44' }}>
                {loading
                  ? 'Procesando...'
                  : mode === 'signup' ? 'Crear cuenta y pagar →' : 'Entrar →'}
              </button>
            </form>

            <p className="text-xs text-center mt-6" style={{ color: '#555' }}>
              {mode === 'signup'
                ? 'Después de crear tu cuenta te llevamos al checkout.'
                : 'Si todavía no tenés cuenta, creá una arriba.'}
            </p>
          </div>

          <p className="text-xs text-center mt-6" style={{ color: '#555' }}>
            ¿Aún no pagaste? <Link href="/precios" className="underline" style={{ color: '#888' }}>Ver planes →</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
