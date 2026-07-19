import type { Metadata } from 'next';
import AyudaCliente from './AyudaCliente';

// Centro de Ayuda — público (chat de FAQ con IA + formulario a contacto@).
export const metadata: Metadata = {
  title: 'Centro de Ayuda — ViralADN',
  description: 'Resolvé tus dudas al instante con el asistente, o escribinos y te respondemos a tu correo.',
};

export default function AyudaPage() {
  return (
    <main className="min-h-screen" style={{ background: '#080808' }}>
      <AyudaCliente />
    </main>
  );
}
