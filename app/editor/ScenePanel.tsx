"use client";
// Panel de escenas tipo Submagic para TOPCUT.
// Lista el vídeo por escenas y deja al usuario, por escena: editar el subtítulo,
// poner/quitar/cambiar el B-roll, y activar un zoom. + Auto B-rolls / Auto Zooms.
// Habla con el backend vía el proxy /api/topcut/* (mismo-origen + auth por ticket).
import { useEffect, useRef, useState } from "react";

type Scene = {
  id: string; start: number; end: number; text: string;
  broll: { enabled: boolean; query: string };
  zoom: boolean;
};
type Caption = { start: number; end: number; text: string };
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function ScenePanel({ jobId, videoUrl }: { jobId: string; videoUrl?: string }) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [subPos, setSubPos] = useState<"middle" | "low">("middle");
  const [activeCap, setActiveCap] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "rendering" | "done" | "error">("idle");
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => { loadScenes(); /* eslint-disable-next-line */ }, [jobId]);

  async function loadScenes() {
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/topcut/jobs/${jobId}/scenes`, { cache: "no-store" });
      if (!r.ok) throw new Error(`No pude cargar las escenas (${r.status})`);
      const d = await r.json();
      setScenes(d.scenes || []);
      setCaptions(d.captions || []);
      setSubPos(d.subtitles?.position === "low" ? "low" : "middle");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  // Previo en vivo: el subtítulo activo según el tiempo del vídeo (mismos chunks que el render).
  function onTime() {
    const t = videoRef.current?.currentTime || 0;
    const c = captions.find((c) => t >= c.start && t < c.end);
    setActiveCap(c ? c.text : "");
  }

  function patch(id: string, fn: (s: Scene) => Scene) {
    setScenes((sc) => sc.map((s) => (s.id === id ? fn(s) : s)));
  }

  async function applyAndRender() {
    setStatus("rendering"); setStage("queued"); setError(""); setResultUrl("");
    const edits = scenes.map((s) => ({ id: s.id, text: s.text, broll: s.broll, zoom: s.zoom }));
    try {
      const r = await fetch(`/api/topcut/jobs/${jobId}/scenes`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ edits }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `Error (${r.status})`); }
      poll();
    } catch (e: any) { setStatus("error"); setError(e.message); }
  }

  async function poll() {
    try {
      const r = await fetch(`/api/topcut/jobs/${jobId}`, { cache: "no-store" });
      const j = await r.json();
      setStage(j.stage);
      if (j.status === "done") { setStatus("done"); setResultUrl(`/api/topcut/jobs/${jobId}/result?t=${Date.now()}`); return; }
      if (j.status === "error") { setStatus("error"); setError((j.error || "Error").split("\n")[0]); return; }
      setTimeout(poll, 2500);
    } catch (e: any) { setStatus("error"); setError(e.message); }
  }

  const busy = status === "rendering";

  if (loading) return <div className="text-white/60 py-8 text-center">Cargando escenas…</div>;
  if (error && !scenes.length) return <div className="text-red-400 py-8 text-center">❌ {error} <button onClick={loadScenes} className="underline ml-2">reintentar</button></div>;

  return (
    <div className="text-white">
      {/* PREVIO EN VIVO — subtítulos sobre tu vídeo, sin gastar render */}
      {videoUrl && (
        <div className="mb-4">
          <div className="relative mx-auto rounded-xl overflow-hidden bg-black" style={{ maxWidth: 280, containerType: "size" }}>
            <video ref={videoRef} src={videoUrl} controls playsInline onTimeUpdate={onTime} className="w-full block" />
            {activeCap && (
              <div className="pointer-events-none absolute left-0 right-0 flex justify-center px-3"
                style={{ top: `${subPos === "low" ? 72 : 52}%`, transform: "translateY(-50%)" }}>
                {/* 3.2cqh = mismo % de la altura que el render (0.032·H) → tamaño fiel */}
                <span className="font-extrabold text-white text-center leading-none whitespace-nowrap"
                  style={{ fontSize: "3.2cqh", textShadow: "0 2px 6px rgba(0,0,0,.95),0 0 10px rgba(0,0,0,.85)" }}>
                  {activeCap}
                </span>
              </div>
            )}
          </div>
          <p className="text-center text-[11px] text-white/40 mt-1">Previo en vivo — así saldrán los subtítulos (1 línea, centrados). No gasta render.</p>
        </div>
      )}

      {/* Barra de acciones */}
      <div className="flex flex-wrap items-center gap-2 mb-4 sticky top-0 bg-black/40 backdrop-blur py-2 z-10">
        <span className="font-bold mr-auto">🎬 Escenas <span className="text-white/40 font-normal">({scenes.length})</span></span>
        <button onClick={applyAndRender} disabled={busy} className="px-4 py-1.5 rounded-lg text-sm font-bold bg-gradient-to-r from-purple-500 to-pink-500 disabled:opacity-40">
          {busy ? "Renderizando…" : "Aplicar y renderizar"}
        </button>
      </div>

      {status === "rendering" && <p className="text-purple-300 mb-3">⏳ {stage || "procesando"}… (unos minutos, no cierres)</p>}
      {status === "error" && <p className="text-red-400 mb-3">❌ {error}</p>}

      {resultUrl && status === "done" && (
        <div className="mb-4">
          <video src={resultUrl} controls className="w-full rounded-xl bg-black" />
          <a href={resultUrl} download className="inline-block mt-2 text-pink-400 font-bold">⬇ Descargar vídeo</a>
        </div>
      )}

      {/* Lista de escenas */}
      <div className="space-y-2">
        {scenes.map((s) => (
          <div key={s.id} className="rounded-xl border border-white/10 p-3 bg-white/[0.03]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs tabular-nums text-purple-300 font-bold">{fmt(s.start)}</span>
              <input
                value={s.text}
                onChange={(e) => patch(s.id, (x) => ({ ...x, text: e.target.value }))}
                className="flex-1 bg-transparent border-b border-white/10 focus:border-purple-400 outline-none text-sm py-1"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 pl-10">
              <button
                onClick={() => patch(s.id, (x) => ({ ...x, broll: { ...x.broll, enabled: !x.broll.enabled } }))}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold ${s.broll.enabled ? "bg-blue-500/30 border border-blue-400 text-blue-200" : "bg-white/5 border border-white/10 text-white/50"}`}
              >🎞️ B-roll {s.broll.enabled ? "ON" : "OFF"}</button>
              {s.broll.enabled && (
                <input
                  value={s.broll.query}
                  placeholder="qué stock buscar (inglés)"
                  onChange={(e) => patch(s.id, (x) => ({ ...x, broll: { ...x.broll, query: e.target.value } }))}
                  className="flex-1 min-w-[140px] bg-black/30 rounded-md px-2 py-1 text-xs border border-white/10 focus:border-blue-400 outline-none"
                />
              )}
              <button
                onClick={() => patch(s.id, (x) => ({ ...x, zoom: !x.zoom }))}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold ${s.zoom ? "bg-pink-500/30 border border-pink-400 text-pink-200" : "bg-white/5 border border-white/10 text-white/50"}`}
              >🔍 Zoom {s.zoom ? "ON" : "OFF"}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
