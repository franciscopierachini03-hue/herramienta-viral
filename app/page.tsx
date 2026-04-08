'use client';
import { useState } from 'react';

const PLATFORMS = [
  { id: 'youtube', label: 'YouTube', color: '#FF0000' },
  { id: 'tiktok', label: 'TikTok', color: '#010101' },
  { id: 'instagram', label: 'Instagram', color: '#C13584' },
  { id: 'facebook', label: 'Facebook', color: '#1877F2' },
];

const SUGGESTIONS = ['fitness', 'dinero', 'motivación', 'recetas', 'negocios', 'éxito'];

export default function Home() {
  const [tab, setTab] = useState('transcribir');
  const [platform, setPlatform] = useState('youtube');
  const [url, setUrl] = useState('');
  const [transcript, setTranscript] = useState('');
  const [loadingT, setLoadingT] = useState(false);
  const [tema, setTema] = useState('');
  const [virales, setVirales] = useState([]);
  const [loadingV, setLoadingV] = useState(false);

  async function transcribir() {
    if (!url) return;
    setLoadingT(true);
    setTranscript('');
    const res = await fetch('/api/transcribir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, platform }),
    });
    const data = await res.json();
    setTranscript(data.texto || data.error || 'Sin resultado');
    setLoadingT(false);
  }

  async function buscarVirales() {
    if (!tema) return;
    setLoadingV(true);
    setVirales([]);
    const res = await fetch('/api/virales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tema }),
    });
    const data = await res.json();
    setVirales(data.videos || []);
    setLoadingV(false);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">🔥 Viral Tool</h1>
      <p className="text-gray-400 mb-6 text-sm">Transcribe videos y encuentra contenido viral</p>

      <div className="flex gap-2 mb-8">
        {['transcribir', 'virales', 'apis'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${tab === t ? 'bg-white text-gray-900 border-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
            {t === 'transcribir' ? 'Transcribir' : t === 'virales' ? 'Buscar virales' : 'Conectar APIs'}
          </button>
        ))}
      </div>

      {tab === 'transcribir' && (
        <div>
          <div className="flex gap-2 mb-4 flex-wrap">
            {PLATFORMS.map(p => (
              <button key={p.id} onClick={() => setPlatform(p.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm border transition-all ${platform === p.id ? 'border-white text-white' : 'border-gray-700 text-gray-400'}`}>
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }}></span>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mb-4">
            <input value={url} onChange={e => setUrl(e.target.value)}
              placeholder="Pega aquí el link del video..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm outline-none focus:border-gray-500" />
            <button onClick={transcribir} disabled={loadingT}
              className="px-5 py-2 bg-white text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50">
              {loadingT ? 'Procesando...' : 'Transcribir'}
            </button>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 min-h-32 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
            {transcript || 'El texto transcrito aparecerá aquí...'}
          </div>
        </div>
      )}

      {tab === 'virales' && (
        <div>
          <div className="flex gap-2 mb-4 flex-wrap">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => setTema(s)}
                className="px-3 py-1 rounded-full border border-gray-700 text-gray-400 text-xs hover:border-gray-500 hover:text-white transition-all">
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mb-6">
            <input value={tema} onChange={e => setTema(e.target.value)}
              placeholder="Escribe un tema... (ej: éxito, finanzas, gym)"
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm outline-none focus:border-gray-500" />
            <button onClick={buscarVirales} disabled={loadingV}
              className="px-5 py-2 bg-white text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50">
              {loadingV ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {virales.length === 0 && !loadingV && (
              <p className="text-gray-500 text-sm text-center py-8">Los 10 videos más virales aparecerán aquí...</p>
            )}
            {virales.map((v: {title: string; channel: string; views: string; likes: string; url?: string}, i) => (
              <a key={i} href={v.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition-colors">
                <span className="text-gray-500 text-sm w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{v.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{v.channel} · {v.views} vistas</p>
                </div>
                <div className="text-right text-xs text-gray-400">{v.likes} likes</div>
              </a>
            ))}
          </div>
        </div>
      )}

      {tab === 'apis' && (
        <div className="flex flex-col gap-4">
          {[
            { name: 'YouTube Data API v3', badge: 'Gratis', desc: 'Para transcribir y buscar videos virales de YouTube. Se obtiene en Google Cloud Console.', url: 'https://console.cloud.google.com' },
            { name: 'RapidAPI (TikTok Scraper)', badge: '~$10/mes', desc: 'Para buscar reels virales de TikTok por keyword o hashtag.', url: 'https://rapidapi.com/hub' },
            { name: 'Instagram Graph API', badge: 'Cuenta Business', desc: 'Para contenido viral de Instagram. Requiere cuenta Business conectada en Meta Developers.', url: 'https://developers.facebook.com' },
            { name: 'Whisper API (OpenAI)', badge: '~$0.006/min', desc: 'Para transcribir audio con alta precisión en español.', url: 'https://platform.openai.com' },
          ].map((api, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">{api.name}</span>
                <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{api.badge}</span>
              </div>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">{api.desc}</p>
              <a href={api.url} target="_blank" className="text-xs text-blue-400 hover:underline">Obtener acceso →</a>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}