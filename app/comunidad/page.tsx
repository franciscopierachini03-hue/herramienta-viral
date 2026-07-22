'use client';

import { useEffect, useState } from 'react';
import ProductNav from '../_components/ProductNav';

// 🎓 Comunidad — la clase semanal EN VIVO (el bono de todos los planes).
// Todos los miércoles 10:00 AM Ciudad de México, en la Sala Z1 de Zoom.
// Config editable acá abajo (CLASE). Gate por plan en layout.tsx.

import { CLASE, HORARIOS } from './clase-config';

type Archivo = { nombre: string; url: string };
type Clase = { id: string; fecha: string; titulo: string; resumen: string | null; video_url: string | null; archivos: Archivo[] };

// Normaliza un link de YouTube/Vimeo al formato embebible.
function toEmbed(url: string): string {
  const u = (url || '').trim();
  if (!u) return '';
  // Ya es un embed (player.vimeo / youtube embed / iframe src) → tal cual.
  if (/player\.vimeo\.com\/video\/|youtube(?:-nocookie)?\.com\/embed\//.test(u)) return u;
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;
  // Vimeo: vimeo.com/ID · vimeo.com/ID/HASH (privado) · ?h=HASH. Hay que conservar
  // el HASH de privacidad o el video privado no carga en el embed.
  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) {
    const h = u.match(/vimeo\.com\/(?:video\/)?\d+\/([A-Za-z0-9]+)/)?.[1] || u.match(/[?&]h=([A-Za-z0-9]+)/)?.[1];
    return `https://player.vimeo.com/video/${vimeo[1]}${h ? `?h=${h}` : ''}`;
  }
  return u;
}

// 'YYYY-MM-DD' → 'miércoles 9 de julio' (parse manual, sin depender de la zona).
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function fmtFecha(f: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f || '');
  if (!m) return f || '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

// Próximo miércoles 10:00 AM CDMX como instante UTC. CDMX es UTC-6 FIJO (sin
// horario de verano desde 2022) → miércoles 16:00 UTC. Calcular en UTC hace que
// el timer sea correcto para cualquier persona, esté en la zona que esté.
const CLASS_UTC_HOUR = 16; // 10:00 CDMX
const DURACION_MS = 90 * 60 * 1000; // la clase dura ~90 min (ventana EN VIVO)

function proximaClaseUTC(ahora: Date): Date {
  const t = new Date(ahora);
  const add = (CLASE.diaSemana - ahora.getUTCDay() + 7) % 7;
  t.setUTCDate(ahora.getUTCDate() + add);
  t.setUTCHours(CLASS_UTC_HOUR, 0, 0, 0);
  if (t.getTime() <= ahora.getTime()) t.setUTCDate(t.getUTCDate() + 7);
  return t;
}

type Restante = { d: number; h: number; m: number; s: number };

export default function Comunidad() {
  const [proxima, setProxima] = useState('');
  const [esHoy, setEsHoy] = useState(false);
  const [restante, setRestante] = useState<Restante | null>(null);
  const [enVivo, setEnVivo] = useState(false);
  const [copiado, setCopiado] = useState<'id' | 'codigo' | null>(null);
  const [clases, setClases] = useState<Clase[] | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [videoAbierto, setVideoAbierto] = useState<string | null>(null);

  // Grabaciones cargadas desde /admin/clases (gateadas: solo miembros).
  useEffect(() => {
    fetch('/api/comunidad/clases', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d?.ok) { setClases(d.clases || []); setEsAdmin(!!d.admin); } else setClases([]); })
      .catch(() => setClases([]));
  }, []);

  useEffect(() => {
    // "Próxima clase" calculada en hora CDMX (client-only: sin hydration mismatch).
    try {
      const cdmx = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
      let faltan = (CLASE.diaSemana - cdmx.getDay() + 7) % 7;
      const pasoLaClase = cdmx.getHours() > CLASE.finVentanaHoy.h
        || (cdmx.getHours() === CLASE.finVentanaHoy.h && cdmx.getMinutes() > CLASE.finVentanaHoy.m);
      if (faltan === 0 && pasoLaClase) faltan = 7;
      const objetivo = new Date(cdmx);
      objetivo.setDate(cdmx.getDate() + faltan);
      setEsHoy(faltan === 0);
      setProxima(objetivo.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }));
    } catch { setProxima('todos los miércoles'); }
  }, []);

  // ⏳ Timer semanal: cuenta regresiva al próximo miércoles 10:00 AM CDMX.
  // Se resetea solo: al terminar la ventana EN VIVO apunta a la semana siguiente.
  useEffect(() => {
    const tick = () => {
      const ahora = new Date();
      const prox = proximaClaseUTC(ahora);
      const falta = prox.getTime() - ahora.getTime();
      // Si la próxima quedó a casi 7 días es porque la de HOY arrancó hace
      // menos de 90 min → estamos EN VIVO.
      const vivo = falta > 7 * 86_400_000 - DURACION_MS;
      setEnVivo(vivo);
      const ms = Math.max(0, falta);
      setRestante({
        d: Math.floor(ms / 86_400_000),
        h: Math.floor(ms / 3_600_000) % 24,
        m: Math.floor(ms / 60_000) % 60,
        s: Math.floor(ms / 1_000) % 60,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  function copiar(texto: string, cual: 'id' | 'codigo') {
    navigator.clipboard?.writeText(texto).then(() => {
      setCopiado(cual);
      setTimeout(() => setCopiado(null), 1600);
    }).catch(() => {});
  }

  const card = { background: 'linear-gradient(145deg, #14141f, #0d0d16)', border: '1px solid #23232f' } as const;

  return (
    <main className="min-h-screen text-white px-6 py-8"
      style={{ background: 'radial-gradient(ellipse 90% 45% at 25% 0%, #2a1a06 0%, transparent 60%), radial-gradient(ellipse 70% 35% at 85% 8%, #2a0a0e 0%, transparent 55%), #070710' }}>
      <div className="max-w-4xl mx-auto">
        <ProductNav active="comunidad" />

        {/* La clase semanal */}
        <div className="rounded-3xl p-7 mb-6 relative overflow-hidden" style={{ background: 'linear-gradient(145deg, #1a1206, #0d0d16)', border: '1px solid #f59e0b55', boxShadow: '0 0 50px #f59e0b22' }}>
          {esHoy && !enVivo && (
            <span className="absolute top-5 right-5 text-[11px] font-extrabold tracking-wider px-3 py-1.5 rounded-full animate-pulse"
              style={{ background: '#ef4444', color: '#fff' }}>🔴 LA CLASE ES HOY</span>
          )}
          <p className="text-xs font-extrabold tracking-widest uppercase mb-2" style={{ color: '#fcd34d' }}>🎓 Clase semanal en vivo</p>
          <h1 className="text-2xl md:text-3xl font-extrabold mb-1">{CLASE.nombre}</h1>
          <p className="text-sm md:text-base font-bold mb-1" style={{ color: '#9a9aa6' }}>Todos los miércoles · {CLASE.horaCDMX} · Ciudad de México</p>
          <p className="text-sm mb-5" style={{ color: '#b4b4c0' }}>
            Nos sentamos con tu cuenta a revisar qué está funcionando, qué ajustar y qué publicar esta semana.
            {proxima && <> Próxima clase: <b style={{ color: '#fcd34d', textTransform: 'capitalize' }}>{proxima}</b>.</>}
          </p>

          {/* ⏳ Cuenta regresiva — se resetea sola cada semana */}
          {restante && (enVivo ? (
            <div className="rounded-2xl px-5 py-4 mb-5 flex items-center justify-between gap-3 flex-wrap"
              style={{ background: '#2a0a0e', border: '1px solid #ef4444aa', boxShadow: '0 0 30px #ef444433' }}>
              <span className="text-base font-extrabold animate-pulse" style={{ color: '#fca5a5' }}>
                🔴 LA CLASE ESTÁ EN VIVO AHORA
              </span>
              <a href={CLASE.zoomUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs font-extrabold px-4 py-2 rounded-xl"
                style={{ background: '#ef4444', color: '#fff' }}>
                Entrar ya →
              </a>
            </div>
          ) : (
            <div className="mb-5">
              <p className="text-[11px] font-extrabold tracking-widest uppercase mb-2" style={{ color: '#8b8b96' }}>⏳ Faltan para la próxima clase</p>
              <div className="flex gap-2 flex-wrap">
                {([['Días', restante.d], ['Horas', restante.h], ['Min', restante.m], ['Seg', restante.s]] as const).map(([label, val]) => (
                  <div key={label} className="rounded-2xl px-4 py-3 text-center min-w-[72px]"
                    style={{ background: '#0a0a12', border: '1px solid #f59e0b44' }}>
                    <div className="text-2xl md:text-3xl font-extrabold tabular-nums" style={{ color: '#fcd34d' }}>
                      {String(val).padStart(2, '0')}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: '#8b8b96' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            {HORARIOS.map(([bandera, hora, lugar]) => (
              <span key={lugar} className="text-xs px-3 py-1.5 rounded-full" style={{ background: '#0a0a12', border: '1px solid #2a2a36', color: '#c9c9d4' }}>
                {bandera} <b>{hora}</b> <span style={{ color: '#8b8b96' }}>{lugar}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Sala Z1 */}
        <div className="rounded-3xl p-7 mb-6" style={card}>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <h2 className="text-lg font-extrabold">📱 {CLASE.sala}</h2>
            <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: '#0d1f12', border: '1px solid #22c55e55', color: '#86efac' }}>
              La misma sala, todas las semanas
            </span>
          </div>

          <a href={CLASE.zoomUrl} target="_blank" rel="noopener noreferrer"
            className="block w-full py-4 rounded-2xl text-base font-extrabold text-center transition-transform hover:-translate-y-0.5 mb-4"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#fff', boxShadow: '0 0 30px #f59e0b44' }}>
            🚀 Entrar a la clase (Zoom) →
          </a>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-2xl px-4 py-3 flex items-center justify-between gap-2" style={{ background: '#0a0a12', border: '1px solid #2a2a36' }}>
              <div>
                <p className="text-[11px] uppercase tracking-wider" style={{ color: '#8b8b96' }}>ID de la reunión</p>
                <p className="text-sm font-bold font-mono">{CLASE.zoomId}</p>
              </div>
              <button onClick={() => copiar(CLASE.zoomId.replace(/\s/g, ''), 'id')}
                className="text-xs font-bold px-3 py-2 rounded-xl shrink-0"
                style={{ background: '#14141f', border: '1px solid #2e2e3e', color: copiado === 'id' ? '#86efac' : '#c9c9d4' }}>
                {copiado === 'id' ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
            <div className="rounded-2xl px-4 py-3 flex items-center justify-between gap-2" style={{ background: '#0a0a12', border: '1px solid #2a2a36' }}>
              <div>
                <p className="text-[11px] uppercase tracking-wider" style={{ color: '#8b8b96' }}>Código de acceso</p>
                <p className="text-sm font-bold font-mono">{CLASE.zoomCodigo}</p>
              </div>
              <button onClick={() => copiar(CLASE.zoomCodigo, 'codigo')}
                className="text-xs font-bold px-3 py-2 rounded-xl shrink-0"
                style={{ background: '#14141f', border: '1px solid #2e2e3e', color: copiado === 'codigo' ? '#86efac' : '#c9c9d4' }}>
                {copiado === 'codigo' ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
          </div>

          <p className="text-xs mt-4" style={{ color: '#8b8b96' }}>
            💡 Llega 5 minutos antes con tu cuenta de Instagram/TikTok a mano — la revisamos en vivo.
          </p>
        </div>

        {/* 📼 Grabaciones — la biblioteca de clases pasadas */}
        <div className="flex items-center justify-between gap-2 mb-3 mt-2">
          <h2 className="text-lg font-extrabold">📼 Grabaciones de las clases</h2>
          {esAdmin && (
            <a href="/admin/clases" className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: '#1a1408', border: '1px solid #f59e0b55', color: '#fcd34d' }}>
              ➕ Administrar
            </a>
          )}
        </div>

        {clases === null ? (
          <p className="text-sm px-1" style={{ color: '#6b6b78' }}>cargando grabaciones…</p>
        ) : clases.length === 0 ? (
          <div className="rounded-3xl p-6" style={{ background: '#0c0c14', border: '1px dashed #2a2a36' }}>
            <p className="text-xs" style={{ color: '#8b8b96' }}>
              Todavía no hay grabaciones subidas. En cuanto termine la próxima clase, la vas a encontrar acá para verla cuando quieras.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {clases.map(c => {
              const embed = c.video_url ? toEmbed(c.video_url) : '';
              const abierto = videoAbierto === c.id;
              return (
                <div key={c.id} className="rounded-3xl p-6" style={card}>
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#fcd34d' }}>{fmtFecha(c.fecha)}</p>
                  <h3 className="text-lg font-extrabold mb-1">{c.titulo}</h3>
                  {c.resumen && <p className="text-sm mb-4 whitespace-pre-line" style={{ color: '#b4b4c0' }}>{c.resumen}</p>}

                  {embed && (abierto ? (
                    <div className="rounded-2xl overflow-hidden mb-4" style={{ border: '1px solid #2a2a36', aspectRatio: '16 / 9' }}>
                      <iframe src={embed} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={c.titulo} />
                    </div>
                  ) : (
                    <button onClick={() => setVideoAbierto(c.id)}
                      className="w-full py-3 rounded-2xl text-sm font-bold mb-4 transition-transform hover:-translate-y-0.5"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#fff' }}>
                      ▶ Ver la grabación
                    </button>
                  ))}

                  {c.archivos.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {c.archivos.map((a, i) => (
                        <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" download
                          className="text-xs font-semibold px-3 py-2 rounded-xl inline-flex items-center gap-1.5"
                          style={{ background: '#0a0a12', border: '1px solid #2a2a36', color: '#93c5fd' }}>
                          📎 {a.nombre}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
