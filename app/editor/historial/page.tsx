'use client';

// Historial de videos editados con TOPCUT (últimos 30 días).
// Lista los renders del usuario: preview, descargar, eliminar.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProductNav from '../../_components/ProductNav';
import SessionGuard from '../../_components/SessionGuard';

type Video = {
  id: string;
  job_id: string | null;
  result_url: string;
  title: string | null;
  context: string | null;
  duration: number | null;
  created_at: string;
};

function fmtDur(n: number | null): string {
  if (!n || n <= 0) return '';
  const m = Math.floor(n / 60), s = Math.round(n % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
function fmtDate(s: string): string {
  try { return new Date(s).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

export default function Historial() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/mis-videos', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setVideos(Array.isArray(d.videos) ? d.videos : []))
      .catch(() => setVideos([]));
  }, []);

  async function del(id: string) {
    setVideos(v => (v || []).filter(x => x.id !== id));
    setConfirmId(null);
    await fetch(`/api/mis-videos/${id}`, { method: 'DELETE' }).catch(() => {});
  }

  return (
    <main className="min-h-screen text-white" style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
      <div className="px-6 pt-10 pb-2 max-w-6xl mx-auto w-full">
        <SessionGuard />
        <ProductNav active="topcut" />
      </div>

      <div className="px-6 pb-24 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold">📁 Mis videos</h2>
            <p className="text-sm" style={{ color: '#888' }}>Tus ediciones de los últimos 30 días.</p>
          </div>
          <Link href="/editor" className="px-4 py-2.5 rounded-2xl text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff' }}>＋ Editar nuevo</Link>
        </div>

        {videos === null && (
          <div className="text-center py-20 text-sm" style={{ color: '#666' }}>Cargando tus videos…</div>
        )}

        {videos !== null && videos.length === 0 && (
          <div className="rounded-3xl p-12 text-center" style={{ background: '#0c0c0c', border: '1px dashed #2a2a2a' }}>
            <div className="text-5xl mb-3">🎬</div>
            <h3 className="text-lg font-bold mb-1">Todavía no editaste ningún video</h3>
            <p className="text-sm mb-5" style={{ color: '#888' }}>Cuando edites uno con TOPCUT, te va a quedar acá guardado por 30 días.</p>
            <Link href="/editor" className="inline-block px-5 py-3 rounded-2xl text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff' }}>Editar mi primer video</Link>
          </div>
        )}

        {videos !== null && videos.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map(v => (
              <div key={v.id} className="rounded-2xl overflow-hidden flex flex-col" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
                <video src={v.result_url} controls playsInline preload="metadata"
                  className="w-full" style={{ aspectRatio: '9/16', maxHeight: 320, objectFit: 'cover', background: '#000' }} />
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <div className="text-sm font-semibold line-clamp-2" style={{ color: '#eee' }}>
                    {v.title || v.context || 'Video editado'}
                  </div>
                  <div className="text-[11px] flex items-center gap-2" style={{ color: '#666' }}>
                    <span>{fmtDate(v.created_at)}</span>
                    {fmtDur(v.duration) && <span>· {fmtDur(v.duration)}</span>}
                  </div>
                  <div className="flex gap-2 mt-auto pt-1">
                    <a href={v.result_url} download className="flex-1 text-center py-2 rounded-xl text-xs font-bold"
                      style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff' }}>⬇️ Descargar</a>
                    {confirmId === v.id ? (
                      <button onClick={() => del(v.id)} className="px-3 py-2 rounded-xl text-xs font-bold"
                        style={{ background: '#5c1414', border: '1px solid #7f1d1d', color: '#fca5a5' }}>¿Seguro?</button>
                    ) : (
                      <button onClick={() => setConfirmId(v.id)} className="px-3 py-2 rounded-xl text-xs font-bold"
                        style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#f87171' }}>🗑️</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
