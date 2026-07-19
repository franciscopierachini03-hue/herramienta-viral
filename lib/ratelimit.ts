// Limitador best-effort en memoria (por instancia serverless). No es a prueba de
// balas en un cluster, pero frena abuso casual de endpoints públicos. Combinado
// con modelos baratos y topes de tokens, acota el costo. Para límite duro entre
// instancias, migrar a Upstash/Supabase.

type Hit = { count: number; reset: number };
const buckets = new Map<string, Hit>();

export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= max) {
    return { ok: false, retryAfter: Math.ceil((b.reset - now) / 1000) };
  }
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}

// IP del request (Vercel manda x-forwarded-for). Cae a 'anon' si no hay.
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  return xff.split(',')[0].trim() || req.headers.get('x-real-ip') || 'anon';
}
