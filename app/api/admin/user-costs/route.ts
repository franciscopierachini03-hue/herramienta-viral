import { createClient, createServiceClient } from '@/lib/supabase/server';

// GET /api/admin/user-costs
//
// Devuelve el costo estimado por usuario basado en:
//   - viral_search_log  (búsquedas virales no cacheadas)
//   - transcription_log (transcripciones no cacheadas)
//
// Solo accesible para admins.

const PERMANENT_OWNERS = ['franciscopierachini03@gmail.com'];

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  if (PERMANENT_OWNERS.includes(e)) return true;
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(e);
}

// Tarifas estimadas por acción (USD)
const RATES = {
  viral_ig: 0.10,
  viral_tt: 0.05,
  viral_yt: 0.03,
  transcribe_ig: 0.02,
  transcribe_yt: 0.005,
  transcribe_tt: 0.005,
};

interface SearchRow {
  user_email: string;
  platform: string;
  cache_hit: boolean;
}

interface TranscriptRow {
  user_email: string;
  platform: string;
  cache_hit: boolean;
}

interface UserCost {
  email: string;
  searches_ig: number;
  searches_tt: number;
  searches_yt: number;
  transcripts_ig: number;
  transcripts_yt: number;
  transcripts_tt: number;
  total_actions: number;
  estimated_usd: number;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    return Response.json({ error: 'No autorizado' }, { status: 403 });
  }

  const service = createServiceClient();

  // Buscar logs de búsquedas virales (no cacheadas = costo real)
  const { data: searchLogs, error: searchErr } = await service
    .from('viral_search_log')
    .select('user_email, platform, cache_hit')
    .eq('cache_hit', false)
    .not('user_email', 'is', null);

  if (searchErr) {
    console.error('[user-costs] Error fetching viral_search_log:', searchErr.message);
  }

  // Buscar logs de transcripciones (no cacheadas = costo real)
  const { data: transcriptLogs, error: transcriptErr } = await service
    .from('transcription_log')
    .select('user_email, platform, cache_hit')
    .eq('cache_hit', false)
    .not('user_email', 'is', null);

  if (transcriptErr) {
    console.error('[user-costs] Error fetching transcription_log:', transcriptErr.message);
  }

  // Acumular por usuario
  const map = new Map<string, UserCost>();

  function getOrCreate(email: string): UserCost {
    if (!map.has(email)) {
      map.set(email, {
        email,
        searches_ig: 0, searches_tt: 0, searches_yt: 0,
        transcripts_ig: 0, transcripts_yt: 0, transcripts_tt: 0,
        total_actions: 0,
        estimated_usd: 0,
      });
    }
    return map.get(email)!;
  }

  for (const row of (searchLogs || []) as SearchRow[]) {
    if (!row.user_email) continue;
    const u = getOrCreate(row.user_email);
    const p = (row.platform || '').toLowerCase();
    if (p === 'instagram') { u.searches_ig++; u.estimated_usd += RATES.viral_ig; }
    else if (p === 'tiktok') { u.searches_tt++; u.estimated_usd += RATES.viral_tt; }
    else if (p === 'youtube') { u.searches_yt++; u.estimated_usd += RATES.viral_yt; }
    u.total_actions++;
  }

  for (const row of (transcriptLogs || []) as TranscriptRow[]) {
    if (!row.user_email) continue;
    const u = getOrCreate(row.user_email);
    const p = (row.platform || '').toLowerCase();
    if (p === 'instagram') { u.transcripts_ig++; u.estimated_usd += RATES.transcribe_ig; }
    else if (p === 'youtube') { u.transcripts_yt++; u.estimated_usd += RATES.transcribe_yt; }
    else if (p === 'tiktok') { u.transcripts_tt++; u.estimated_usd += RATES.transcribe_tt; }
    u.total_actions++;
  }

  // Ordenar por costo estimado descendente
  const costs = Array.from(map.values())
    .sort((a, b) => b.estimated_usd - a.estimated_usd)
    .map(u => ({ ...u, estimated_usd: Math.round(u.estimated_usd * 100) / 100 }));

  const totalUsd = costs.reduce((s, u) => s + u.estimated_usd, 0);

  return Response.json({ costs, totalUsd: Math.round(totalUsd * 100) / 100, rates: RATES });
}
