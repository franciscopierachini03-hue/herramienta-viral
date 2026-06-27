// Loader propio del evento (sin la marca de la plataforma). Sobrescribe el
// PageLoader global con logo ViralADN solo para /evento y /evento/gracias.
export default function EventoLoading() {
  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: '#070710' }}>
      <div
        className="w-8 h-8 rounded-full animate-spin"
        style={{ border: '3px solid #1f1f1f', borderTopColor: '#10b981', borderRightColor: '#34d399' }}
      />
    </main>
  );
}
