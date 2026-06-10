// Historial de videos editados — guardado en el NAVEGADOR (localStorage),
// SIEMPRE namespaceado por usuario: clave `topcut_videos_v2_<userKey>`.
// Así una cuenta NUNCA ve los videos de otra cuenta que entró en el mismo
// navegador. Sin userKey → no lee ni escribe nada (cero fuga por clave global).
// (Si se crea la tabla en Supabase, el historial pasa a server-side por usuario.)

export type LocalVideo = {
  id: string;
  jobId?: string;
  resultUrl: string;
  title?: string;
  context?: string;
  duration?: number;
  created_at: string; // ISO
};

const BASE = 'topcut_videos_v2';
const LEGACY = 'topcut_videos_v1'; // clave global vieja (mezclaba a todos) → se purga
const MAX_AGE_MS = 30 * 24 * 3600 * 1000; // 30 días
const MAX_ITEMS = 100;

function keyFor(userKey: string): string | null {
  const u = (userKey || '').trim();
  return u ? `${BASE}_${u}` : null;
}

// Purga la clave global vieja que mezclaba videos de todos los usuarios.
function purgeLegacy(): void {
  try { window.localStorage.removeItem(LEGACY); } catch { /* noop */ }
}

export function getLocalVideos(userKey: string): LocalVideo[] {
  if (typeof window === 'undefined') return [];
  purgeLegacy();
  const KEY = keyFor(userKey);
  if (!KEY) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr: LocalVideo[] = raw ? JSON.parse(raw) : [];
    const cutoff = Date.now() - MAX_AGE_MS;
    return arr
      .filter(v => v && v.resultUrl && new Date(v.created_at).getTime() > cutoff)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch {
    return [];
  }
}

export function saveLocalVideo(userKey: string, v: {
  jobId?: string; resultUrl: string; title?: string; context?: string; duration?: number;
}): void {
  if (typeof window === 'undefined' || !v.resultUrl) return;
  const KEY = keyFor(userKey);
  if (!KEY) return;
  try {
    const list = getLocalVideos(userKey);
    // Dedupe por jobId (un re-render del mismo job reemplaza la entrada vieja).
    const filtered = v.jobId ? list.filter(x => x.jobId !== v.jobId) : list;
    const item: LocalVideo = {
      id: `${v.jobId || 'v'}_${Date.now()}`,
      jobId: v.jobId,
      resultUrl: v.resultUrl,
      title: v.title,
      context: v.context,
      duration: v.duration,
      created_at: new Date().toISOString(),
    };
    window.localStorage.setItem(KEY, JSON.stringify([item, ...filtered].slice(0, MAX_ITEMS)));
  } catch {
    /* localStorage lleno o bloqueado → ignoramos */
  }
}

export function removeLocalVideo(userKey: string, id: string): void {
  if (typeof window === 'undefined') return;
  const KEY = keyFor(userKey);
  if (!KEY) return;
  try {
    const list = getLocalVideos(userKey).filter(v => v.id !== id);
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}
