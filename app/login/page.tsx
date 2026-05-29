'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import PasswordInput from '../_components/PasswordInput';
import { suggestEmailFix } from '../_components/emailTypos';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}

// 'login' | 'signup' | 'signup-verify' | 'forgot' | 'forgot-verify'
type Mode = 'login' | 'signup' | 'signup-verify' | 'forgot' | 'forgot-verify';

function Login() {
  const params = useSearchParams();
  const next = params.get('next') || '';
  const reason = params.get('reason') || '';
  const wantsSignup = params.get('signup') === '1';

  const hintEmail = params.get('email') || '';

  const [mode, setMode] = useState<Mode>(wantsSignup ? 'signup' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(hintEmail);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [showCodeField, setShowCodeField] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);

  function switchMode(newMode: Mode) {
    setMode(newMode);
    setError('');
    setInfo('');
    setVerifyCode('');
    setEmailSuggestion(null);
    setFailedAttempts(0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');

    // ── LOGIN ──────────────────────────────────────────
    if (mode === 'login') {
      if (password.length < 8) {
        setError('La contraseña tiene que tener al menos 8 caracteres.');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch('/api/auth/magic-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'login', email: email.trim().toLowerCase(), password, next }),
        });
        const data = await res.json();
        if (data.error) {
          setError(data.error);
          setFailedAttempts(n => n + 1);
          setLoading(false);
          return;
        }
        const target = data.redirect || '/app';
        const sep = target.includes('?') ? '&' : '?';
        window.location.href = `${target}${sep}session=new`;
      } catch {
        setError('Error de conexión. Probá de nuevo.');
        setLoading(false);
      }
      return;
    }

    // ── SIGNUP (paso 1: pedir código) ──────────────────
    if (mode === 'signup') {
      if (password.length < 8) {
        setError('La contraseña tiene que tener al menos 8 caracteres.');
        return;
      }
      const fix = suggestEmailFix(email);
      if (fix && !emailSuggestion) {
        setEmailSuggestion(fix);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch('/api/auth/send-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'signup',
            email: email.trim().toLowerCase(),
            password,
            name,
            phone,
            code: inviteCode,
          }),
        });
        const data = await res.json();
        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }
        setInfo(`Te enviamos un código de 6 dígitos a ${email}. Revisá también spam.`);
        setMode('signup-verify');
      } catch {
        setError('Error de conexión. Probá de nuevo.');
      }
      setLoading(false);
      return;
    }

    // ── SIGNUP (paso 2: verificar código) ──────────────
    if (mode === 'signup-verify') {
      if (verifyCode.trim().length !== 6) {
        setError('El código tiene 6 dígitos.');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch('/api/auth/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'signup',
            email: email.trim().toLowerCase(),
            code: verifyCode.trim(),
            password,
          }),
        });
        const data = await res.json();
        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }
        const target = data.redirect || '/app';
        const sep = target.includes('?') ? '&' : '?';
        window.location.href = `${target}${sep}session=new`;
      } catch {
        setError('Error de conexión. Probá de nuevo.');
        setLoading(false);
      }
      return;
    }

    // ── FORGOT (paso 1: pedir código) ──────────────────
    if (mode === 'forgot') {
      if (!email.includes('@')) {
        setError('Correo inválido.');
        return;
      }
      setLoading(true);
      try {
        await fetch('/api/auth/send-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'reset', email: email.trim().toLowerCase() }),
        });
        setInfo(`Si ${email} está registrado, te enviamos un código.`);
        setMode('forgot-verify');
      } catch {
        setError('Error de conexión. Probá de nuevo.');
      }
      setLoading(false);
      return;
    }

    // ── FORGOT (paso 2: verificar + nueva password) ────
    if (mode === 'forgot-verify') {
      if (verifyCode.trim().length !== 6) {
        setError('El código tiene 6 dígitos.');
        return;
      }
      if (newPassword.length < 8) {
        setError('La nueva contraseña tiene que tener al menos 8 caracteres.');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch('/api/auth/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'reset',
            email: email.trim().toLowerCase(),
            code: verifyCode.trim(),
            newPassword,
          }),
        });
        const data = await res.json();
        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }
        const target = data.redirect || '/app';
        const sep = target.includes('?') ? '&' : '?';
        window.location.href = `${target}${sep}session=new`;
      } catch {
        setError('Error de conexión. Probá de nuevo.');
        setLoading(false);
      }
      return;
    }
  }

  async function resendCode() {
    setError('');
    setLoading(true);
    try {
      const isReset = mode === 'forgot-verify';
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isReset
            ? { mode: 'reset', email: email.trim().toLowerCase() }
            : { mode: 'signup', email: email.trim().toLowerCase(), password, name, phone, code: inviteCode },
        ),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setInfo('Listo, te reenviamos el código.');
    } catch {
      setError('Error al reenviar el código.');
    }
    setLoading(false);
  }

  const inVerify = mode === 'signup-verify' || mode === 'forgot-verify';

  return (
    <main className="min-h-screen text-white flex flex-col" style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="ViralADN" width={36} height={36}
            style={{ filter: 'drop-shadow(0 0 14px #7c3aed55)' }} />
          <span className="text-lg font-bold">ViralADN</span>
        </Link>
        <Link href="/precios" className="text-sm" style={{ color: '#888' }}>
          Ver precios →
        </Link>
      </nav>

      <section className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-3xl p-8"
            style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>

            {(reason === 'idle' || reason === 'tab') && mode === 'login' && (
              <div className="rounded-xl p-3 text-xs mb-4"
                style={{ background: '#7c3aed22', border: '1px solid #7c3aed44', color: '#c4b5fd' }}>
                {reason === 'idle'
                  ? 'Cerramos tu sesión por inactividad. Volvé a entrar para seguir.'
                  : 'Por seguridad, cerramos tu sesión al cerrar la pestaña. Volvé a entrar.'}
              </div>
            )}

            <h2 className="text-2xl font-bold mb-2">
              {mode === 'signup' ? 'Empezá tu prueba'
                : mode === 'signup-verify' ? 'Confirmá tu correo'
                : mode === 'login' ? 'Bienvenido de vuelta'
                : mode === 'forgot' ? 'Recuperar contraseña'
                : 'Ingresá el código'}
            </h2>
            <p className="text-sm mb-6" style={{ color: '#888' }}>
              {mode === 'signup'
                ? 'Completá tus datos. Te mandamos un código para confirmar.'
                : mode === 'signup-verify'
                ? `Te enviamos un código a ${email}. Tiene 6 dígitos y vence en 15 min.`
                : mode === 'login'
                ? 'Ingresá con tu correo y contraseña.'
                : mode === 'forgot'
                ? 'Te mandamos un código por correo para cambiar tu contraseña.'
                : `Pegá el código que te enviamos a ${email} y elegí una nueva contraseña.`}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {/* ───────── VERIFY STEP ───────── */}
              {inVerify ? (
                <>
                  <div>
                    <label className="text-xs mb-1.5 block" style={{ color: '#888' }}>Código de 6 dígitos</label>
                    <input
                      value={verifyCode}
                      onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="000000"
                      className="w-full px-4 py-3 rounded-xl text-lg outline-none transition-colors text-center"
                      style={{ background: '#0a0a0a', border: '1px solid #7c3aed55', color: '#fff', letterSpacing: '0.4em', fontFamily: 'monospace' }}
                    />
                  </div>

                  {mode === 'forgot-verify' && (
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: '#888' }}>
                        Nueva contraseña <span style={{ color: '#555' }}>(mínimo 8 caracteres)</span>
                      </label>
                      <PasswordInput
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        required
                        minLength={8}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
                        style={{ background: '#0a0a0a', border: '1px solid #1f1f1f', color: '#fff' }}
                      />
                    </div>
                  )}

                  {info && (
                    <div className="rounded-xl p-3 text-xs"
                      style={{ background: '#7c3aed22', border: '1px solid #7c3aed44', color: '#c4b5fd' }}>
                      {info}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {mode === 'signup' && (
                    <>
                      <div>
                        <label className="text-xs mb-1.5 block" style={{ color: '#888' }}>Nombre completo</label>
                        <input value={name} onChange={e => setName(e.target.value)} required placeholder="Tu nombre"
                          className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
                          style={{ background: '#0a0a0a', border: '1px solid #1f1f1f', color: '#fff' }} />
                      </div>
                      <div>
                        <label className="text-xs mb-1.5 block" style={{ color: '#888' }}>Teléfono (con código de país)</label>
                        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="+52 55 1234 5678"
                          className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
                          style={{ background: '#0a0a0a', border: '1px solid #1f1f1f', color: '#fff' }} />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="text-xs mb-1.5 block" style={{ color: '#888' }}>Correo electrónico</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="tu@correo.com" autoComplete="email"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
                      style={{ background: '#0a0a0a', border: '1px solid #1f1f1f', color: '#fff' }} />
                  </div>

                  {(mode === 'login' || mode === 'signup') && (
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: '#888' }}>
                        Contraseña {mode === 'signup' && <span style={{ color: '#555' }}>(mínimo 8 caracteres)</span>}
                      </label>
                      <PasswordInput value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                        placeholder="••••••••"
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
                        style={{ background: '#0a0a0a', border: '1px solid #1f1f1f', color: '#fff' }} />
                      {mode === 'login' && (
                        <button type="button" onClick={() => switchMode('forgot')}
                          className="text-xs mt-2 underline" style={{ color: '#888' }}>
                          ¿Olvidaste tu contraseña?
                        </button>
                      )}
                    </div>
                  )}

                  {mode === 'signup' && (
                    showCodeField ? (
                      <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(145deg, #1a0f2e, #120a1f)', border: '1px solid #7c3aed66' }}>
                        <label className="text-sm font-bold mb-1 flex items-center gap-2" style={{ color: '#c4b5fd' }}>
                          🎟️ Código de acceso
                        </label>
                        <p className="text-xs mb-3" style={{ color: '#888' }}>
                          Activa tus días gratis. Pegalo acá 👇
                        </p>
                        <input value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
                          placeholder="EJ: LEGACYPANAMA" autoCapitalize="characters" autoFocus
                          className="w-full px-4 py-3.5 rounded-xl text-base font-bold text-center outline-none transition-colors"
                          style={{ background: '#0a0a0a', border: '2px solid #7c3aed', color: '#fff', letterSpacing: '0.15em' }} />
                      </div>
                    ) : (
                      <button type="button" onClick={() => setShowCodeField(true)}
                        className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                        style={{ background: '#140d24', border: '1px dashed #7c3aed88', color: '#c4b5fd' }}>
                        🎟️ ¿Tenés un código de acceso? Tocá acá
                      </button>
                    )
                  )}

                  {emailSuggestion && (
                    <div className="rounded-xl p-3 text-xs"
                      style={{ background: '#92400e22', border: '1px solid #fbbf2455', color: '#fde68a' }}>
                      ¿Quisiste decir{' '}
                      <button type="button"
                        onClick={() => { setEmail(emailSuggestion); setEmailSuggestion(null); }}
                        className="font-bold underline">
                        {emailSuggestion}
                      </button>?
                      <button type="button" onClick={() => setEmailSuggestion(null)} className="ml-2 opacity-60 underline">
                        No, está bien así
                      </button>
                    </div>
                  )}
                </>
              )}

              {error && (
                <div className="rounded-xl p-3 text-xs" style={{ background: '#7f1d1d22', border: '1px solid #7f1d1d44', color: '#fca5a5' }}>
                  {error}
                </div>
              )}

              {mode === 'login' && failedAttempts >= 1 && (
                <div className="rounded-xl p-3 text-xs"
                  style={{ background: '#7c3aed22', border: '1px solid #7c3aed44', color: '#c4b5fd' }}>
                  Si no recordás tu contraseña,{' '}
                  <button type="button" onClick={() => switchMode('forgot')} className="font-bold underline">
                    pedí una nueva acá
                  </button>.
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-50 mt-2"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff', boxShadow: '0 0 20px #7c3aed44' }}>
                {loading ? 'Procesando...'
                  : mode === 'signup' ? 'Enviarme el código →'
                  : mode === 'signup-verify' ? 'Confirmar y entrar →'
                  : mode === 'login' ? 'Entrar →'
                  : mode === 'forgot' ? 'Enviarme el código →'
                  : 'Cambiar contraseña →'}
              </button>

              {inVerify && (
                <div className="flex items-center justify-between mt-1 text-xs">
                  <button type="button" disabled={loading} onClick={resendCode}
                    className="underline" style={{ color: '#888' }}>
                    Reenviar código
                  </button>
                  <button type="button"
                    onClick={() => switchMode(mode === 'signup-verify' ? 'signup' : 'forgot')}
                    className="underline" style={{ color: '#888' }}>
                    ← Cambiar datos
                  </button>
                </div>
              )}

              {mode === 'forgot' && (
                <button type="button" onClick={() => switchMode('login')}
                  className="text-xs underline mt-2 self-center" style={{ color: '#888' }}>
                  ← Volver
                </button>
              )}
            </form>

            {(mode === 'login' || mode === 'signup') && (
              <div className="mt-6 pt-6 text-center text-sm"
                style={{ borderTop: '1px solid #1f1f1f', color: '#888' }}>
                {mode === 'login' ? (
                  <>
                    ¿Todavía no tenés cuenta?{' '}
                    <button type="button" onClick={() => switchMode('signup')}
                      className="font-semibold underline" style={{ color: '#c4b5fd' }}>
                      Crear cuenta →
                    </button>
                  </>
                ) : (
                  <>
                    ¿Ya tenés cuenta?{' '}
                    <button type="button" onClick={() => switchMode('login')}
                      className="font-semibold underline" style={{ color: '#c4b5fd' }}>
                      Iniciar sesión →
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <p className="text-xs text-center mt-6" style={{ color: '#555' }}>
            ¿Aún no pagaste? <Link href="/precios" className="underline" style={{ color: '#888' }}>Ver planes →</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
