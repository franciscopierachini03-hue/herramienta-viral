import type { Metadata } from 'next';

// Metadata propia del evento (sobrescribe la del layout raíz) para que el título,
// la descripción y el preview al compartir (Open Graph / Twitter) NO muestren la
// marca de la plataforma — todo queda como "De 0 a 100K seguidores".
const OG_IMAGE = 'https://hkvzmtvifywmqfmjkeeq.supabase.co/storage/v1/object/public/media/og-evento.png';
const TITLE = 'De 0 a 100K seguidores — Clase en vivo';
const DESC = 'Clase en vivo y gratis: cómo encontrar contenido viral y crear videos con inteligencia artificial para hacer crecer tu cuenta de 0 a 100 mil seguidores.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESC,
    url: 'https://franpierachini.com',
    siteName: 'De 0 a 100K seguidores',
    images: [{ url: OG_IMAGE, width: 1024, height: 1024, alt: 'De 0 a 100K seguidores' }],
    locale: 'es_LA',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESC,
    images: [OG_IMAGE],
  },
};

export default function EventoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
