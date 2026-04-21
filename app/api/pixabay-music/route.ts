import { NextRequest } from 'next/server';

// ── Demo tracks (CC0 / libre de derechos) ────────────────────────────────────
// Usados como fallback si no hay JAMENDO_CLIENT_ID configurado.
// Fuente: SoundHelix (public domain) — soundhelix.com
const BASE = 'https://www.soundhelix.com/examples/mp3';
const DEMO_TRACKS = [
  { id: 101, title: 'Alto Impacto',      user: 'SoundHelix', preview: `${BASE}/SoundHelix-Song-1.mp3`,  duration: 371, tags: ['motivacional','épico','upbeat'] },
  { id: 102, title: 'Momentum',          user: 'SoundHelix', preview: `${BASE}/SoundHelix-Song-2.mp3`,  duration: 340, tags: ['motivacional','upbeat','corporate'] },
  { id: 103, title: 'Chill Drive',       user: 'SoundHelix', preview: `${BASE}/SoundHelix-Song-3.mp3`,  duration: 415, tags: ['chill','corporate'] },
  { id: 104, title: 'Deep Focus',        user: 'SoundHelix', preview: `${BASE}/SoundHelix-Song-4.mp3`,  duration: 392, tags: ['chill','cinematic'] },
  { id: 105, title: 'Energía Viral',     user: 'SoundHelix', preview: `${BASE}/SoundHelix-Song-5.mp3`,  duration: 336, tags: ['upbeat','motivacional'] },
  { id: 106, title: 'Epic Rise',         user: 'SoundHelix', preview: `${BASE}/SoundHelix-Song-6.mp3`,  duration: 280, tags: ['épico','cinematic'] },
  { id: 107, title: 'Business Forward',  user: 'SoundHelix', preview: `${BASE}/SoundHelix-Song-7.mp3`,  duration: 351, tags: ['corporate','upbeat'] },
  { id: 108, title: 'Cinematic Wave',    user: 'SoundHelix', preview: `${BASE}/SoundHelix-Song-8.mp3`,  duration: 401, tags: ['cinematic','épico'] },
  { id: 109, title: 'Tarde Tranquila',   user: 'SoundHelix', preview: `${BASE}/SoundHelix-Song-9.mp3`,  duration: 358, tags: ['chill','motivacional'] },
  { id: 110, title: 'Pulse',             user: 'SoundHelix', preview: `${BASE}/SoundHelix-Song-10.mp3`, duration: 323, tags: ['upbeat','épico'] },
  { id: 111, title: 'Groove Corp',       user: 'SoundHelix', preview: `${BASE}/SoundHelix-Song-11.mp3`, duration: 390, tags: ['corporate','chill'] },
  { id: 112, title: 'Ascend',            user: 'SoundHelix', preview: `${BASE}/SoundHelix-Song-12.mp3`, duration: 344, tags: ['motivacional','épico'] },
];

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || 'upbeat').toLowerCase();

  // ── Jamendo (si tiene client_id configurado) ────────────────────────────────
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (clientId) {
    try {
      const res = await fetch(
        `https://api.jamendo.com/v3.0/tracks/?client_id=${clientId}&format=json&limit=20&fuzzytags=${encodeURIComponent(q)}&orderby=popularity_total`
      );
      if (res.ok) {
        const data = await res.json();
        const tracks = ((data.results || []) as Record<string, unknown>[])
          .map(t => ({
            id:       Number(t.id),
            title:    t.name as string,
            preview:  t.audio as string,
            duration: t.duration as number,
            user:     t.artist_name as string,
          }))
          .filter(t => t.preview);
        if (tracks.length > 0) return Response.json({ tracks, source: 'jamendo' });
      }
    } catch { /* fallback to demo */ }
  }

  // ── Demo tracks fallback ────────────────────────────────────────────────────
  const filtered = DEMO_TRACKS.filter(t =>
    t.tags.some(tag => tag.toLowerCase().includes(q) || q.includes(tag.toLowerCase()))
  );
  const tracks = filtered.length > 0 ? filtered : DEMO_TRACKS.slice(0, 6);

  return Response.json({ tracks, source: 'demo' });
}
