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
  const reason = params.get('reason') || '';

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');

    // ── FORGOT PASSWORD ──────────────────────────────────
    if (mode === 'forgot') {
      if (!email.includes('@')) {
        setError('Correo inválido.');
        return;
      }
      setLoading(true);
      try {
        await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        setForgotSent(true);
      } catch {
        setError('Error de conexión. Probá de nuevo.');
      }
      setLoading(false);
      return;
    }

    // ── SIGNUP / LOGIN ───────────────────────────────────
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
      // Éxito → redirigimos a donde diga el server (/precios o /app).
      // Le pegamos ?session=new para que SessionGuard marque la pestaña.
      const target = data.redirect || '/app';
      const sep = target.includes('?') ? '&' : '?';
      window.location.href = `${target}${sep}session=new`;
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
      setLoading(false);
    }
  }

  function switchMode(newMode: 'login' | 'signup' | 'forgot') {
    setMode(newMode);
    setError('');
    setForgotSent(false);
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

            {/* Toggle login / signup (oculto en modo forgot) */}
            {mode !== 'forgot' && (
              <div className="flex gap-1 p-1 rounded-2xl mb-6" style={{ background: '#0a0a0a' }}>
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={mode === 'signup'
                    ? { background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }
                    : { color: '#666' }}>
                  Crear cuenta
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={mode === 'login'
                    ? { background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }
                    : { color: '#666' }}>
                  Iniciar sesión
                </button>
              </div>
            )}

            {(reason === 'idle' || reason === 'tab') && mode !== 'forgot' && (
              <div className="rounded-xl p-3 text-xs mb-4"
                style={{ background: '#7c3aed22', border: '1px solid #7c3aed44', color: '#c4b5fd' }}>
                {reason === 'idle'
                  ? 'Cerramos tu sesión por inactividad. Volvé a entrar para seguir.'
                  : 'Por seguridad, cerramos tu sesión al cerrar la pestaña. Volvé a entrar.'}
              </div>
            )}

            <h2 className="text-2xl font-bold mb-2">
              {mode === 'signup' ? 'Empezá tu prueba'
                : mode === 'login' ? 'Bienvenido de vuelta'
                : 'Recuperar contraseña'}
            </h2>
            <p className="text-sm mb-6" style={{ color: '#888' }}>
              {mode === 'signup'
                ? 'Completá tus datos y elegí una contraseña. Te llevamos a pagar.'
                : mode === 'login'
                ? 'Ingresá con tu correo y contraseña.'
                : 'Te mandamos un correo con un link para crear una contraseña nueva.'}
            </p>

            {mode === 'forgot' && forgotSent ? (
              <div className="text-center py-4">
                <div className="text-5xl mb-3">📬</div>
                <p className="text-sm mb-4" style={{ color: '#aaa' }}>
                  Si <span style={{ color: '#fff' }}>{email}</span> está registrado,
                  te llegó un correo con el link para cambiar tu contraseña.
                  Revisá también tu carpeta de spam.
                </p>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-xs underline" style={{ color: '#888' }}>
                  ← Volver a iniciar sesión
                </button>
              </div>
            ) : (
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

              {mode !== 'forgot' && (
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
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs mt-2 underline"
                      style={{ color: '#888' }}>
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
              )}

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
                  : mode === 'signup' ? 'Crear cuenta y pagar →'
                  : mode === 'login' ? 'Entrar →'
                  : 'Mandame el link →'}
              </button>

              {mode === 'forgot' && (
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-xs underline mt-2 self-center"
                  style={{ color: '#888' }}>
                  ← Volver
                </button>
              )}
            </form>
            )}

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
