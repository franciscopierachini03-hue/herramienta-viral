// Componente de loading compartido para Suspense / loading.tsx.
// Mantiene la marca ViralADN (gradient + dot animado) y se ve igual en
// cualquier página, para que la sensación al navegar sea coherente.

export default function PageLoader({ label = 'Cargando' }: { label?: string }) {
  return (
    <main
      className="min-h-screen flex items-center justify-center text-white"
      style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}
    >
      <div className="flex flex-col items-center gap-5">
        {/* Logo con pulso */}
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mark.svg"
            alt="ViralADN"
            width={56}
            height={56}
            className="animate-pulse"
            style={{ filter: 'drop-shadow(0 0 20px #7c3aed88)' }}
          />
        </div>

        {/* Spinner gradient ring */}
        <div
          className="w-8 h-8 rounded-full animate-spin"
          style={{
            border: '3px solid #1f1f1f',
            borderTopColor: '#7c3aed',
            borderRightColor: '#c13584',
          }}
        />

        {/* Label */}
        <p className="text-sm flex items-center gap-2" style={{ color: '#888' }}>
          {label}
          <span className="flex gap-1">
            <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#7c3aed', animationDelay: '0ms' }} />
            <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#a855f7', animationDelay: '200ms' }} />
            <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#c13584', animationDelay: '400ms' }} />
          </span>
        </p>
      </div>
    </main>
  );
}
