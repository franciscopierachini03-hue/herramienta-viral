'use client';

// /admin/clases — cargar las grabaciones de la clase semanal (el "classroom"
// de /comunidad). Solo admin. Pegás el link del video (YouTube "Oculto"/Vimeo),
// escribís el resumen y subís los archivos (se suben directo a Supabase Storage).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminGate from '../../_components/AdminGate';
import { createClient } from '@/lib/supabase/client';

const AMBER = '#f59e0b';
const RED = '#ef4444';

type Archivo = { nombre: string; url: string };
type Clase = {
  id: string; fecha: string; titulo: string;
  resumen: string | null; video_url: string | null; archivos: Archivo[]; creado: string;
};

function hoyLocal() {
  try { return new Date().toLocaleDateString('en-CA'); } catch { return ''; } // YYYY-MM-DD
}

export default function AdminClases() {
  const [clases, setClases] = useState<Clase[] | null>(null);
  const [configurada, setConfigurada] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [fecha, setFecha] = useState(hoyLocal());
  const [titulo, setTitulo] = useState('');
  const [resumen, setResumen] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [linkNombre, setLinkNombre] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  function cargar() {
    fetch('/api/comunidad/clases', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d?.ok) { setClases(d.clases || []); setConfigurada(!!d.configurada); }
        else setError(d?.error || 'No se pudo cargar.');
      })
      .catch(() => setError('Error de conexión.'));
  }
  useEffect(cargar, []);

  function limpiar() {
    setEditId(null); setFecha(hoyLocal()); setTitulo(''); setResumen('');
    setVideoUrl(''); setArchivos([]); setLinkNombre(''); setLinkUrl(''); setError(''); setNote('');
  }

  function editar(c: Clase) {
    setEditId(c.id); setFecha(c.fecha); setTitulo(c.titulo);
    setResumen(c.resumen || ''); setVideoUrl(c.video_url || ''); setArchivos(c.archivos || []);
    setError(''); setNote(''); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function onSubirArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setSubiendo(true); setError('');
    const supa = createClient();
    for (const file of files) {
      try {
        const r = await fetch('/api/comunidad/clases/subida', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: file.name }),
        });
        const d = await r.json();
        if (!d.ok) { setError(d.error || 'No se pudo subir.'); break; }
        const { error: upErr } = await supa.storage.from(d.bucket).uploadToSignedUrl(d.path, d.token, file);
        if (upErr) { setError(`No se pudo subir "${file.name}": ${upErr.message}`); break; }
        setArchivos(a => [...a, { nombre: file.name, url: d.publicUrl }]);
      } catch { setError('Error de conexión al subir.'); break; }
    }
    setSubiendo(false);
  }

  function agregarLink() {
    const nombre = linkNombre.trim(); const url = linkUrl.trim();
    if (!nombre || !/^https?:\/\//i.test(url)) { setError('El link tiene que tener nombre y empezar con http.'); return; }
    setArchivos(a => [...a, { nombre, url }]); setLinkNombre(''); setLinkUrl(''); setError('');
  }
  function quitarArchivo(i: number) { setArchivos(a => a.filter((_, j) => j !== i)); }

  async function guardar() {
    if (!fecha || !titulo.trim()) { setError('Poné al menos la fecha y el título.'); return; }
    if (guardando) return;
    setGuardando(true); setError(''); setNote('');
    const payload = { id: editId, fecha, titulo: titulo.trim(), resumen, video_url: videoUrl, archivos };
    try {
      const res = await fetch('/api/comunidad/clases', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'No se pudo guardar.'); }
      else { setNote(editId ? '✅ Clase actualizada.' : '✅ Clase publicada.'); limpiar(); cargar(); }
    } catch { setError('Error de conexión.'); }
    setGuardando(false);
  }

  async function borrar(c: Clase) {
    if (!confirm(`¿Borrar la clase "${c.titulo}"? No se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/comunidad/clases?id=${encodeURIComponent(c.id)}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'No se pudo borrar.'); return; }
      if (editId === c.id) limpiar();
      cargar();
    } catch { setError('Error de conexión.'); }
  }

  const card = { background: 'linear-gradient(145deg, #14141f, #0d0d16)', border: '1px solid #23232f' } as const;
  const input = { background: '#0a0a12', border: '1px solid #2a2a36', color: '#fff' } as const;

  return (
    <main className="min-h-screen text-white px-6 py-8"
      style={{ background: 'radial-gradient(ellipse 90% 45% at 25% 0%, #2a1a06 0%, transparent 60%), #070710' }}>
      <AdminGate />
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-extrabold">🎓 Grabaciones de la clase</h1>
          <Link href="/comunidad" className="text-xs px-3 py-1.5 rounded-full" style={{ background: '#14141f', border: '1px solid #2a2a36', color: '#c9c9d4' }}>
            Ver /comunidad →
          </Link>
        </div>

        {!configurada && (
          <div className="mb-6 rounded-2xl p-4 text-sm" style={{ background: '#1a1408', border: `1px solid ${AMBER}55`, color: '#fde68a' }}>
            ⚙️ Falta correr <b>supabase/clases_grabadas.sql</b> en Supabase (y crear el bucket <b>clases</b> en Storage, público) para poder guardar.
          </div>
        )}

        {/* Formulario */}
        <div className="rounded-3xl p-6 mb-8" style={card}>
          <p className="text-sm font-bold mb-4" style={{ color: '#e8e8ee' }}>
            {editId ? '✏️ Editar clase' : '➕ Nueva clase'}
          </p>

          <div className="grid sm:grid-cols-[160px_1fr] gap-3 mb-3">
            <label className="block">
              <span className="text-xs" style={{ color: '#8b8b96' }}>Fecha de la clase</span>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none mt-1" style={input} />
            </label>
            <label className="block">
              <span className="text-xs" style={{ color: '#8b8b96' }}>Título</span>
              <input value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={200}
                placeholder="Ej: Cómo encontrar tu primer video viral"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none mt-1" style={input} />
            </label>
          </div>

          <label className="block mb-3">
            <span className="text-xs" style={{ color: '#8b8b96' }}>Resumen — de qué se trató la clase</span>
            <textarea value={resumen} onChange={e => setResumen(e.target.value)} rows={3} maxLength={4000}
              placeholder="Un par de líneas de lo que vimos, para quien no pudo entrar en vivo…"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none mt-1" style={input} />
          </label>

          <label className="block mb-4">
            <span className="text-xs" style={{ color: '#8b8b96' }}>Link del video (Vimeo)</span>
            <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} maxLength={2000}
              placeholder="https://vimeo.com/123456789/abcdef"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none mt-1" style={input} />
            <span className="text-[11px]" style={{ color: '#6b6b78' }}>Subí la grabación a Vimeo (privada/oculta) y pegá el link completo — con el código de privacidad si lo tiene (vimeo.com/123…/abcdef). El video no ocupa nuestro almacenamiento.</span>
          </label>

          {/* Archivos */}
          <div className="rounded-2xl p-4 mb-4" style={{ background: '#0a0a12', border: '1px solid #23232f' }}>
            <p className="text-xs font-bold mb-2" style={{ color: '#c9c9d4' }}>📎 Archivos de la clase (PDF, slides, recursos)</p>

            {archivos.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-3">
                {archivos.map((a, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-xs rounded-lg px-3 py-2" style={{ background: '#14141f', border: '1px solid #2a2a36' }}>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="truncate" style={{ color: '#93c5fd' }}>📄 {a.nombre}</a>
                    <button onClick={() => quitarArchivo(i)} className="shrink-0 text-[11px] px-2 py-1 rounded" style={{ color: '#fca5a5' }}>Quitar</button>
                  </div>
                ))}
              </div>
            )}

            <label className="block mb-3">
              <input type="file" multiple onChange={onSubirArchivos} disabled={subiendo}
                className="block w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:cursor-pointer disabled:opacity-50"
                style={{ color: '#9a9aa6' }} />
              {subiendo && <span className="text-[11px]" style={{ color: '#fde68a' }}>Subiendo…</span>}
            </label>

            <div className="flex gap-2 flex-wrap items-end">
              <input value={linkNombre} onChange={e => setLinkNombre(e.target.value)} placeholder="…o pegá un link: nombre"
                className="flex-1 min-w-[120px] px-3 py-2 rounded-lg text-xs outline-none" style={input} />
              <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://…"
                className="flex-1 min-w-[140px] px-3 py-2 rounded-lg text-xs outline-none" style={input} />
              <button onClick={agregarLink} className="text-xs font-bold px-3 py-2 rounded-lg" style={{ background: '#14141f', border: '1px solid #2e2e3e', color: '#c9c9d4' }}>+ Link</button>
            </div>
          </div>

          {error && <p className="text-sm mb-3" style={{ color: '#fca5a5' }}>{error}</p>}
          {note && <p className="text-sm mb-3" style={{ color: '#86efac' }}>{note}</p>}

          <div className="flex gap-2">
            <button onClick={guardar} disabled={guardando || subiendo}
              className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${AMBER}, ${RED})`, color: '#fff' }}>
              {guardando ? 'Guardando…' : editId ? 'Guardar cambios' : 'Publicar clase'}
            </button>
            {editId && (
              <button onClick={limpiar} className="px-4 py-3 rounded-2xl text-sm font-bold" style={{ background: '#14141f', border: '1px solid #2a2a36', color: '#c9c9d4' }}>
                Cancelar
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#8b8b96' }}>
          Clases cargadas {clases ? `(${clases.length})` : ''}
        </p>
        {clases === null ? (
          <p className="text-sm" style={{ color: '#6b6b78' }}>cargando…</p>
        ) : clases.length === 0 ? (
          <p className="text-sm" style={{ color: '#6b6b78' }}>Todavía no hay clases cargadas. Publicá la primera arriba ☝️</p>
        ) : (
          <div className="flex flex-col gap-2">
            {clases.map(c => (
              <div key={c.id} className="rounded-2xl p-4 flex items-start justify-between gap-3" style={card}>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{c.titulo}</p>
                  <p className="text-xs mb-1" style={{ color: '#8b8b96' }}>
                    {c.fecha} · {c.video_url ? '🎬 video' : '— sin video'} · {c.archivos.length} archivo{c.archivos.length === 1 ? '' : 's'}
                  </p>
                  {c.resumen && <p className="text-xs line-clamp-2" style={{ color: '#9a9aa6' }}>{c.resumen}</p>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => editar(c)} className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: '#14141f', border: '1px solid #2e2e3e', color: '#c9c9d4' }}>Editar</button>
                  <button onClick={() => borrar(c)} className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: '#1a0a0a', border: `1px solid ${RED}44`, color: '#fca5a5' }}>Borrar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
