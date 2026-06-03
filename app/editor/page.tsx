'use client';

// TOPCUT — pestaña de edición automática de video.
//
// El cliente sube un video → el backend de render (api.viraladn.com) lo edita
// con IA (subtítulos animados, beats, b-roll, música) → devuelve el MP4 final.
//
// El "motor" de render vive en un servidor aparte (Hetzner). Acá solo subimos
// el video, mostramos el progreso y damos el link de descarga.
//
// Requiere env var: NEXT_PUBLIC_VIDEO_API = https://api.viraladn.com
//
// NOTA: el editor client-side anterior (FFmpeg en navegador) quedó respaldado
// en /editor-client-editor.bak en la raíz del repo (recuperable de git).

import { useState, useRef } from 'react';
import ProductNav from '../_components/ProductNav';
import SessionGuard from '../_components/SessionGuard';

const API = process.env.NEXT_PUBLIC_VIDEO_API || 'https://api.viraladn.com';

type Status = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

// Etapas que reporta el backend → texto humano.
const STAGE_ES: Record<string, string> = {
  uploading:  'Subiendo video',
  queued:     'En cola',
  transcribe: 'Transcribiendo audio',
  plan:       'Diseñando la edición (IA)',
  broll:      'Buscando B-roll',
  music:      'Agregando música',
  render:     'Renderizando video',
  done:       'Listo',
};

const STAGE_ORDER = ['uploading', 'queued', 'transcribe', 'plan', 'broll', 'music', 'render', 'done'];

export default function Topcut() {
  const [status, setStatus] = useState<Status>('idle');
  const [stage, setStage] = useState('');
  const [uploadPct, setUploadPct] = useState(0);
  const [resultUrl, setResultUrl] = useState('');
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const busy = status === 'uploading' || status === 'processing';

  function pickFile() {
    if (!busy) fileRef.current?.click();
  }

  function onFile(file: File | undefined) {
    if (!file || busy) return;
    if (!file.type.startsWith('video/')) {
      setStatus('error');
      setError('El archivo no es un video.');
      return;
    }
    start(file);
  }

  function start(file: File) {
    setStatus('uploading');
    setStage('uploading');
    setUploadPct(0);
    setError('');
    setResultUrl('');

    // Subida con progreso (XHR para poder mostrar el %).
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/api/jobs?style=default`);
    xhr.setRequestHeader('content-type', file.type || 'video/mp4');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const { id } = JSON.parse(xhr.responseText);
          if (!id) throw new Error('no id');
          setStatus('processing');
          setStage('queued');
          poll(id);
        } catch {
          fail('Respuesta inválida del servidor.');
        }
      } else {
        fail(`Error al subir (${xhr.status}).`);
      }
    };
    xhr.onerror = () => fail('No se pudo conectar con el servidor de edición.');
    xhr.send(file);
  }

  async function poll(id: string) {
    try {
      const r = await fetch(`${API}/api/jobs/${id}`, { cache: 'no-store' });
      const j = await r.json();
      if (j.stage) setStage(j.stage);
      if (j.status === 'done') {
        setStatus('done');
        setResultUrl(typeof j.result === 'string' && j.result.startsWith('http') ? j.result : `${API}${j.result}`);
        return;
      }
      if (j.status === 'error') {
        fail((j.error || '').split('\n')[0] || 'El servidor reportó un error.');
        return;
      }
      setTimeout(() => poll(id), 2500);
    } catch {
      fail('Se perdió la conexión con el servidor.');
    }
  }

  function fail(msg: string) {
    setStatus('error');
    setError(msg);
  }

  function reset() {
    setStatus('idle');
    setStage('');
    setUploadPct(0);
    setResultUrl('');
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  const stageIdx = STAGE_ORDER.indexOf(stage);

  return (
    <main className="min-h-screen text-white" style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
      <div className="px-6 pt-10 pb-2 max-w-6xl mx-auto w-full">
        <SessionGuard />
        <ProductNav active="topcut" />
      </div>

      <div className="px-6 pb-24 max-w-2xl mx-auto">
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />

        {/* ── IDLE: dropzone ───────────────────────────────── */}
        {status === 'idle' && (
          <>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">
                Subí tu video.{' '}
                <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a855f7, #ec4899)' }}>
                  La IA lo edita.
                </span>
              </h2>
              <p className="text-sm" style={{ color: '#999' }}>
                Subtítulos animados, beats, B-roll y música — automático, en minutos.
              </p>
            </div>

            <div
              onClick={pickFile}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); onFile(e.dataTransfer.files?.[0]); }}
              className="border-2 border-dashed rounded-3xl p-16 cursor-pointer text-center transition-all"
              style={isDragging
                ? { borderColor: '#a855f7', background: '#a855f70d', boxShadow: '0 0 40px #a855f722' }
                : { borderColor: '#2a2a2a', background: '#0c0c0c' }}
            >
              <div className="text-6xl mb-4">{isDragging ? '📂' : '🎬'}</div>
              <h3 className="text-lg font-bold mb-1">Soltá tu video acá</h3>
              <p className="text-sm mb-5" style={{ color: '#666' }}>o hacé clic para elegirlo</p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {['MP4', 'MOV', 'AVI', 'MKV'].map((f) => (
                  <span key={f} className="text-[10px] px-2.5 py-1 rounded-full" style={{ background: '#141414', border: '1px solid #222', color: '#555' }}>{f}</span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-6">
              {[
                { icon: '💬', label: 'Subtítulos' },
                { icon: '✨', label: 'Animaciones' },
                { icon: '🎬', label: 'B-Roll' },
                { icon: '🎵', label: 'Música' },
              ].map((f) => (
                <div key={f.label} className="flex flex-col items-center gap-1.5 p-3 rounded-2xl" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
                  <span className="text-xl">{f.icon}</span>
                  <span className="text-[10px]" style={{ color: '#666' }}>{f.label}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── UPLOADING / PROCESSING ───────────────────────── */}
        {(status === 'uploading' || status === 'processing') && (
          <div className="rounded-3xl p-8" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #7c3aed44' }}>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4"
                style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', boxShadow: '0 0 40px #a855f755', animation: 'tcpulse 2s ease-in-out infinite' }}>
                ✂️
              </div>
              <h3 className="text-lg font-bold">
                {status === 'uploading' ? 'Subiendo tu video…' : 'Editando con IA…'}
              </h3>
              <p className="text-sm" style={{ color: '#888' }}>
                {status === 'uploading' ? `${uploadPct}%` : 'Puede tardar unos minutos. No cierres esta pestaña.'}
              </p>
            </div>

            {status === 'uploading' && (
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1a1a1a' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${uploadPct}%`, background: 'linear-gradient(90deg, #a855f7, #ec4899)' }} />
              </div>
            )}

            {status === 'processing' && (
              <div className="flex flex-col gap-2">
                {STAGE_ORDER.filter((s) => s !== 'uploading' && s !== 'done').map((s, i) => {
                  const idx = i + 1; // offset: sacamos 'uploading' del orden
                  const done = stageIdx > idx;
                  const active = stage === s;
                  return (
                    <div key={s} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                      style={active ? { background: '#7c3aed22', border: '1px solid #7c3aed44' } : done ? { background: '#0a1a0a', border: '1px solid #143314' } : { opacity: 0.4, border: '1px solid transparent' }}>
                      <span className="text-base w-5 text-center">{done ? '✅' : active ? '⏳' : '•'}</span>
                      <span className="text-sm" style={{ color: active ? '#c4b5fd' : done ? '#4ade80' : '#555' }}>{STAGE_ES[s] || s}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── DONE ─────────────────────────────────────────── */}
        {status === 'done' && (
          <div className="rounded-3xl p-8 text-center" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #22c55e55' }}>
            <div className="text-5xl mb-3">✨</div>
            <h3 className="text-xl font-bold mb-1">¡Tu video está listo!</h3>
            <p className="text-sm mb-6" style={{ color: '#888' }}>Editado automáticamente con IA.</p>

            {resultUrl && (
              <video src={resultUrl} controls className="w-full rounded-2xl mb-5 mx-auto" style={{ maxWidth: 320, border: '1px solid #222' }} />
            )}

            <div className="flex flex-col gap-3">
              <a href={resultUrl} download
                className="w-full py-3.5 rounded-2xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff', boxShadow: '0 0 24px #a855f744' }}>
                ⬇️ Descargar video editado
              </a>
              <button onClick={reset} className="text-xs underline" style={{ color: '#888' }}>
                Editar otro video
              </button>
            </div>
          </div>
        )}

        {/* ── ERROR ────────────────────────────────────────── */}
        {status === 'error' && (
          <div className="rounded-3xl p-8 text-center" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #7f1d1d55' }}>
            <div className="text-5xl mb-3">⚠️</div>
            <h3 className="text-lg font-bold mb-1">Algo salió mal</h3>
            <p className="text-sm mb-6" style={{ color: '#fca5a5' }}>{error}</p>
            <button onClick={reset}
              className="px-6 py-3 rounded-2xl text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff' }}>
              Intentar de nuevo
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes tcpulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.85;transform:scale(0.96)} }`}</style>
    </main>
  );
}
