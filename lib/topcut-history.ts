// Historial de videos editados — guardado en el NAVEGADOR (localStorage).
// Funciona sin base de datos (no requiere crear ninguna tabla). Es por-navegador
// (no se sincroniza entre dispositivos); si más adelante creamos la tabla en
// Supabase, se puede pasar a server-side y quedar sincronizado.

export type LocalVideo = {
  id: string;
  jobId?: string;
  resultUrl: string;
  title?: string;
  context?: string;
  duration?: number;
  created_at: string; // ISO
};

const KEY = 'topcut_videos_v1';
const MAX_AGE_MS = 30 * 24 * 3600 * 1000; // 30 días
const MAX_ITEMS = 100;

export function getLocalVideos(): LocalVideo[] {
  if (typeof window === 'undefined') return [];
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

export function saveLocalVideo(v: {
  jobId?: string; resultUrl: string; title?: string; context?: string; duration?: number;
}): void {
  if (typeof window === 'undefined' || !v.resultUrl) return;
  try {
    const list = getLocalVideos();
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

export function removeLocalVideo(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getLocalVideos().filter(v => v.id !== id);
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}
