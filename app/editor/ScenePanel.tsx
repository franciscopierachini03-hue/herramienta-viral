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
  const [hook, setHook] = useState<Caption | null>(null);
  const [hookText, setHookText] = useState("");
  const [subPos, setSubPos] = useState<"middle" | "low">("middle");
  const [subSize, setSubSize] = useState<"small" | "medium" | "large">("medium");
  const [subColor, setSubColor] = useState("#FFFFFF");
  const [accent, setAccent] = useState("#60a5fa");
  const [musicMood, setMusicMood] = useState("");
  const [activeCap, setActiveCap] = useState("");
  const [activeHook, setActiveHook] = useState(false);
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
      setHook(d.hook || null);
      setHookText(d.hookText || d.hook?.text || "");
      setSubPos(d.subtitles?.position === "low" ? "low" : "middle");
      setSubSize((["small", "medium", "large"].includes(d.subtitles?.size) ? d.subtitles.size : "medium"));
      setSubColor(d.subtitles?.color || "#FFFFFF");
      setAccent(d.accent || "#60a5fa");
      setMusicMood(d.music_mood || "");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  // Previo en vivo: el subtítulo activo según el tiempo del vídeo (mismos chunks que el render).
  function onTime() {
    const t = videoRef.current?.currentTime || 0;
    if (hook && t >= hook.start && t < hook.end) { setActiveHook(true); setActiveCap(hook.text); return; }
    setActiveHook(false);
    const c = captions.find((c) => t >= c.start && t < c.end);
    setActiveCap(c ? c.text : "");
  }

  function patch(id: string, fn: (s: Scene) => Scene) {
    setScenes((sc) => sc.map((s) => (s.id === id ? fn(s) : s)));
  }

  async function applyAndRender() {
    setStatus("rendering"); setStage("queued"); setError(""); setResultUrl("");
    const edits = scenes.map((s) => ({ id: s.id, text: s.text, broll: s.broll, zoom: s.zoom }));
    const settings = { subtitleSize: subSize, subtitlePos: subPos, subtitleColor: subColor, accent, musicMood };
    try {
      const r = await fetch(`/api/topcut/jobs/${jobId}/scenes`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ edits, hookText, settings }),
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
  const chip = (on: boolean) => `px-2.5 py-1 rounded-md text-xs font-semibold ${on ? "bg-purple-500/30 border border-purple-400 text-purple-100" : "bg-white/5 border border-white/10 text-white/50"}`;
  const swatch = (c: string, on: boolean) => `w-6 h-6 rounded-full border-2 ${on ? "border-white" : "border-white/20"}`;

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
                style={{ top: `${activeHook ? 48 : subPos === "low" ? 72 : 52}%`, transform: "translateY(-50%)" }}>
                {/* gancho: 5.8cqh multilínea · resto: 3.2cqh 1 línea — mismos % que el render */}
                <span className="font-extrabold text-center"
                  style={activeHook
                    ? { color: subColor, fontSize: "5.8cqh", lineHeight: 1.12, letterSpacing: "-0.5px", maxWidth: "86%", textShadow: "0 3px 10px rgba(0,0,0,.95),0 0 5px rgba(0,0,0,.8)" }
                    : { color: subColor, fontSize: "3.2cqh", lineHeight: 1, whiteSpace: "nowrap", textShadow: "0 2px 6px rgba(0,0,0,.95),0 0 10px rgba(0,0,0,.85)" }}>
                  {activeCap}
                </span>
              </div>
            )}
          </div>
          <p className="text-center text-[11px] text-white/40 mt-1">Previo en vivo — así saldrán los subtítulos (1 línea, centrados). No gasta render.</p>
        </div>
      )}

      {/* TITULAR / GANCHO INICIAL editable (se ve grande al inicio del vídeo) */}
      <div className="mb-4 rounded-xl border border-white/10 p-3 bg-white/[0.03]">
        <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">🎬 Titular / Gancho inicial</div>
        <input
          value={hookText}
          onChange={(e) => { setHookText(e.target.value); setHook((h) => (h ? { ...h, text: e.target.value } : h)); }}
          placeholder="Frase de apertura grande…"
          className="w-full bg-black/30 rounded-md px-3 py-2 text-sm font-semibold border border-white/10 focus:border-purple-400 outline-none"
        />
        <p className="text-[11px] text-white/40 mt-1">Sale grande los primeros segundos. Vacío = usa la primera frase del vídeo. (Míralo en el previo de arriba.)</p>
      </div>

      {/* AJUSTES GLOBALES (directos, sin IA / sin tokens) */}
      <div className="mb-4 rounded-xl border border-white/10 p-3 bg-white/[0.03] space-y-3">
        <div className="text-[10px] uppercase tracking-wider text-white/40">⚙️ Ajustes (no gastan tokens)</div>

        <div>
          <div className="text-xs text-white/60 mb-1.5">Subtítulos — tamaño · posición · color</div>
          <div className="flex flex-wrap items-center gap-2">
            {(["small", "medium", "large"] as const).map((s) => (
              <button key={s} onClick={() => setSubSize(s)} className={chip(subSize === s)}>{({ small: "Chico", medium: "Medio", large: "Grande" } as const)[s]}</button>
            ))}
            <span className="w-px h-4 bg-white/10" />
            {(["middle", "low"] as const).map((p) => (
              <button key={p} onClick={() => setSubPos(p)} className={chip(subPos === p)}>{p === "middle" ? "Medio" : "Abajo"}</button>
            ))}
            <span className="w-px h-4 bg-white/10" />
            {["#FFFFFF", "#FAC51C", "#60a5fa", "#4ade80"].map((c) => (
              <button key={c} onClick={() => setSubColor(c)} title={c} style={{ background: c }} className={swatch(c, subColor.toUpperCase() === c.toUpperCase())} />
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs text-white/60 mb-1.5">Color de acento (palabras destacadas)</div>
          <div className="flex items-center gap-2">
            {["#60a5fa", "#FAC51C", "#4ade80", "#ff4444", "#a78bfa", "#fb923c"].map((c) => (
              <button key={c} onClick={() => setAccent(c)} title={c} style={{ background: c }} className={swatch(c, accent.toUpperCase() === c.toUpperCase())} />
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs text-white/60 mb-1.5">Música (estilo)</div>
          <input value={musicMood} onChange={(e) => setMusicMood(e.target.value)} placeholder="ej: uplifting motivational"
            className="w-full bg-black/30 rounded-md px-3 py-2 text-sm border border-white/10 focus:border-purple-400 outline-none" />
          <div className="flex gap-1.5 flex-wrap mt-2">
            {["uplifting motivational", "epic motivational", "calm piano", "lofi chill", "ambient inspiring", ""].map((m) => (
              <button key={m || "none"} onClick={() => setMusicMood(m)} className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60">{m || "Sin música"}</button>
            ))}
          </div>
        </div>
      </div>

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
