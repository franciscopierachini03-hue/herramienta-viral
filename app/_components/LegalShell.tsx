import Link from 'next/link';

// Contenedor común de las páginas legales (Términos, Privacidad, Reembolsos).
// Estilo oscuro acorde a la app. El contenido va como children con <h2>/<p>/<ul>.
export default function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen" style={{ background: '#080808', color: '#e5e5e5' }}>
      <style>{`
        .lp h2{font-size:1.02rem;font-weight:700;color:#fff;margin:30px 0 8px}
        .lp h3{font-size:.92rem;font-weight:700;color:#e5e5e5;margin:18px 0 6px}
        .lp p,.lp li{font-size:.875rem;line-height:1.75;color:#b4b4c0;margin:0 0 8px}
        .lp ul{margin:6px 0 12px 20px;list-style:disc}
        .lp li{margin:0 0 4px}
        .lp strong{color:#e9e9ee}
        .lp a{color:#c4b5fd;text-decoration:underline}
      `}</style>

      <nav className="flex items-center justify-between px-6 py-5 max-w-3xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="ViralADN" width={32} height={32} style={{ filter: 'drop-shadow(0 0 12px #7c3aed55)' }} />
          <span className="text-base font-bold">ViralADN</span>
        </Link>
        <Link href="/precios" className="text-sm" style={{ color: '#888' }}>Ver precios →</Link>
      </nav>

      <article className="max-w-3xl mx-auto px-6 pb-24 pt-4">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: '#fff' }}>{title}</h1>
        <p className="text-xs mb-2" style={{ color: '#666' }}>Última actualización: {updated}</p>

        {/* navegación entre documentos legales */}
        <div className="flex flex-wrap gap-2 mb-8 mt-4">
          {[
            { href: '/terminos', label: 'Términos y Condiciones' },
            { href: '/privacidad', label: 'Privacidad' },
            { href: '/reembolsos', label: 'Reembolsos y Cancelación' },
          ].map(l => (
            <Link key={l.href} href={l.href} className="text-xs px-3 py-1.5 rounded-full"
              style={{ background: '#101019', border: '1px solid #23232f', color: '#a1a1aa' }}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="lp">{children}</div>

        <div className="mt-12 pt-6 text-xs" style={{ borderTop: '1px solid #1f1f1f', color: '#666' }}>
          <p style={{ margin: 0 }}>
            <strong style={{ color: '#888' }}>2CLICKS.COM LLC</strong> · ViralADN ✕ TOPCUT · <a href="https://viraladn.com" style={{ color: '#888' }}>viraladn.com</a><br />
            Dudas: <a href="mailto:hola@viraladn.com" style={{ color: '#888' }}>hola@viraladn.com</a>
          </p>
        </div>
      </article>
    </main>
  );
}
