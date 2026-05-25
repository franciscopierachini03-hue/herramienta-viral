import PageLoader from './_components/PageLoader';

// Loading fallback global. Se muestra mientras cualquier server component
// del segmento raíz está renderizando y no hay un loading.tsx más cercano.
export default function Loading() {
  return <PageLoader />;
}
