// Cliente de Supabase para el navegador.
// Usa la publishable key — segura para exponer al frontend.
// Si en el futuro activamos Row Level Security (RLS), las políticas se aplican
// automáticamente a las queries hechas desde acá.
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
