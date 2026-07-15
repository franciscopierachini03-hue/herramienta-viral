import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';

// Cron DIARIO consolidado (Hobby permite máx 2 crons — este junta tareas):
//   1. SIEMPRE: chequeo de salud de las APIs (/api/cron/health) con alertas.
//   2. MIÉRCOLES: recordatorio "1 hora antes" de la clase semanal.
// Programado 14:45 UTC (8:45 AM CDMX): el recordatorio sale 15-75 min antes de
// la clase de las 10:00 (los crons de Hobby pueden demorar hasta ~1h).

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function esCron(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') || '';
  if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  return (req.headers.get('user-agent') || '').includes('vercel-cron');
}

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!esCron(req) && !admin) return Response.json({ error: 'No autorizado.' }, { status: 401 });

  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.viraladn.com').replace(/\/$/, '');
  const interno = { headers: { 'user-agent': 'vercel-cron/interno' } };
  const resultado: Record<string, unknown> = {};

  // 1) Salud de las APIs (todos los días).
  try {
    const r = await fetch(`${base}/api/cron/health`, interno);
    resultado.health = r.ok ? 'ok' : `HTTP ${r.status}`;
  } catch (e) { resultado.health = `error: ${(e as Error).message.slice(0, 80)}`; }

  // 2) Miércoles → recordatorio de la clase (1h antes).
  if (new Date().getUTCDay() === 3) {
    try {
      const r = await fetch(`${base}/api/cron/recordatorio-clase`, interno);
      resultado.recordatorio = await r.json().catch(() => `HTTP ${r.status}`);
    } catch (e) { resultado.recordatorio = `error: ${(e as Error).message.slice(0, 80)}`; }
  } else {
    resultado.recordatorio = 'hoy no toca (solo miércoles)';
  }

  return Response.json({ ok: true, ...resultado });
}
