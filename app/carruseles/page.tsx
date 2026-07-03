'use client';

// Carruseles — la máquina completa.
//
// 4 modos de entrada:
//   💡 Idea         — escribís una idea y la IA arma el carrusel.
//   📸 Adaptar viral — pegás capturas de un carrusel ajeno que funcionó; la IA
//                      extrae su mecánica Y su estilo visual, y lo rehace para tu nicho.
//   🖼️ Mi diseño     — subís TU plantilla; la IA clona su paleta y escribe encima.
//   📅 Lote          — un tema → plan de N carruseles con ángulos distintos.
//
// Después de generar: editor fino (regenerar una slide con instrucción, reordenar,
// layouts por slide, fondo por slide subido o con IA) y export PNG/.zip.
// El render a imagen ocurre en TU navegador (html-to-image): lo que ves es lo que baja.

import { useEffect, useMemo, useRef, useState } from 'react';
import ProductNav from '../_components/ProductNav';
import AdminGate from '../_components/AdminGate';
import SlideView, { patchRoles } from './SlideView';
import {
  TEMAS, temaPorKey, temaDesdeExtraido, TEMA_CLONADO_KEY,
  BRAND_KIT_VACIO, CARRUSEL_W, CARRUSEL_H,
  type Carrusel, type Slide, type SlideLayout, type Tema, type BrandKit, type BriefLote,
} from '@/lib/carruseles';

const TOOL = '#10b981';
const TOOL_GRAD = 'linear-gradient(135deg, #10b981, #06b6d4)';
const PREVIEW_W = 384; // ancho del preview en pantalla; el render de export es 1080
const SCALE = PREVIEW_W / CARRUSEL_W;

type ModoUI = 'idea' | 'link' | 'adaptar' | 'diseno' | 'lote';

const MODOS: { key: ModoUI; icon: string; label: string; desc: string }[] = [
  { key: 'idea', icon: '💡', label: 'Idea', desc: 'Escribí una idea y la IA arma todo.' },
  { key: 'link', icon: '🔗', label: 'De un link', desc: 'Pegá un link: un video se transcribe; un carrusel de Instagram se adapta con sus imágenes.' },
  { key: 'adaptar', icon: '📸', label: 'Adaptar viral', desc: 'Capturas de un carrusel ajeno → lo rehace para tu nicho y clona su estilo.' },
  { key: 'diseno', icon: '🖼️', label: 'Mi diseño', desc: 'Subí tu plantilla → clona tu paleta y escribe el contenido encima.' },
  { key: 'lote', icon: '📅', label: 'Lote', desc: 'Un tema → plan de varios carruseles con ángulos distintos.' },
];

// ¿De qué plataforma es el link? (decide el flujo: IG puede ser carrusel de
// imágenes → adaptar directo; el resto siempre es video → transcribir)
function plataformaDe(u: string): 'instagram' | 'tiktok' | 'youtube' | 'facebook' | null {
  const s = u.trim().toLowerCase();
  if (!/^https?:\/\//.test(s)) return null;
  if (s.includes('instagram.com/')) return 'instagram';
  if (s.includes('tiktok.com/')) return 'tiktok';
  if (s.includes('youtube.com/') || s.includes('youtu.be/')) return 'youtube';
  if (s.includes('facebook.com/') || s.includes('fb.watch/')) return 'facebook';
  return null;
}
function esLinkTranscribible(u: string): boolean {
  return plataformaDe(u) !== null;
}

const EJEMPLOS = [
  '5 errores que frenan tu crecimiento en redes',
  'Cómo escribir un hook que pare el scroll',
  'Hábitos de la gente que ahorra sin esfuerzo',
  '3 cosas que aprendí al facturar mi primer mes',
];

const TIPO_LABEL: Record<Slide['tipo'], string> = {
  hook: 'Portada', contenido: 'Contenido', resumen: 'Resumen', cta: 'Cierre',
};

const LAYOUTS_UI: { key: SlideLayout; label: string }[] = [
  { key: 'centrado', label: 'Centrado' },
  { key: 'lista', label: 'Lista' },
  { key: 'stat', label: 'Cifra' },
  { key: 'cita', label: 'Cita' },
];

// Comprime una imagen en el navegador antes de mandarla o usarla de fondo.
async function comprimir(file: File, maxDim = 1100, calidad = 0.82): Promise<string | null> {
  if (!file.type.startsWith('image/')) return null;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, err) => {
      const i = new window.Image();
      i.onload = () => ok(i);
      i.onerror = () => err(new Error('no se pudo leer la imagen'));
      i.src = url;
    });
    const k = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k));
    const h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return c.toDataURL('image/jpeg', calidad);
  } catch { return null; }
  finally { URL.revokeObjectURL(url); }
}

export default function CarruselesPage() {
  // ── Entrada ──
  const [modo, setModo] = useState<ModoUI>('idea');
  const [link, setLink] = useState('');          // modo 'link': URL del video
  const [fase, setFase] = useState('');          // etiqueta de progreso del botón
  const [idea, setIdea] = useState('');
  const [nicho, setNicho] = useState('');
  const [tono, setTono] = useState('');
  const [numSlides, setNumSlides] = useState(7);
  const [cta, setCta] = useState('');
  const [avanzado, setAvanzado] = useState(false);
  const [imagenes, setImagenes] = useState<string[]>([]); // capturas (adaptar / diseño)

  // ── Lote ──
  const [cantLote, setCantLote] = useState(7);
  const [plan, setPlan] = useState<BriefLote[]>([]);
  const [planBusy, setPlanBusy] = useState(false);

  // ── Estilo ──
  const [temaKey, setTemaKey] = useState(TEMAS[0].key);
  const [temaClonado, setTemaClonado] = useState<Tema | null>(null);
  const [brand, setBrand] = useState<BrandKit>(BRAND_KIT_VACIO);

  // ── Resultado ──
  const [carrusel, setCarrusel] = useState<Carrusel | null>(null);
  const [activa, setActiva] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState('');
  const [exportando, setExportando] = useState(false);

  // ── Editor fino ──
  const [instruccion, setInstruccion] = useState('');
  const [regenBusy, setRegenBusy] = useState(false);
  const [fondoBusy, setFondoBusy] = useState(false);
  const [vistiendo, setVistiendo] = useState(false); // clonando el diseño (modo fiel)

  const exportRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fondoInputRef = useRef<HTMLInputElement>(null);
  const tema = useMemo(
    () => (temaKey === TEMA_CLONADO_KEY && temaClonado ? temaClonado : temaPorKey(temaKey)),
    [temaKey, temaClonado],
  );

  // Brand kit + tema clonado ↔ localStorage. Prefill desde el buscador de virales.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('carruseles.brand');
      if (raw) setBrand({ ...BRAND_KIT_VACIO, ...JSON.parse(raw) });
    } catch { /* ignore */ }
    try {
      const rawTema = localStorage.getItem('carruseles.temaClonado');
      if (rawTema) setTemaClonado(JSON.parse(rawTema));
    } catch { /* ignore */ }
    try {
      const pre = sessionStorage.getItem('carruseles.prefill');
      if (pre) {
        sessionStorage.removeItem('carruseles.prefill');
        const p = JSON.parse(pre);
        // Con URL transcribible → modo link (transcribe el video y lo convierte);
        // si no, la idea precargada al modo clásico.
        if (p?.url && esLinkTranscribible(String(p.url))) {
          setModo('link'); setLink(String(p.url));
          if (p?.idea) setIdea(String(p.idea).slice(0, 400));
        } else if (p?.idea) { setModo('idea'); setIdea(String(p.idea).slice(0, 400)); }
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem('carruseles.brand', JSON.stringify(brand)); } catch { /* ignore */ }
  }, [brand]);
  useEffect(() => {
    try {
      if (temaClonado) localStorage.setItem('carruseles.temaClonado', JSON.stringify(temaClonado));
      else localStorage.removeItem('carruseles.temaClonado');
    } catch { /* ignore */ }
  }, [temaClonado]);

  // Pegar capturas con ⌘V en los modos con imágenes.
  useEffect(() => {
    if (modo !== 'adaptar' && modo !== 'diseno') return;
    const h = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter(f => f.type.startsWith('image/'));
      if (files.length) { e.preventDefault(); void agregarImagenes(files); }
    };
    window.addEventListener('paste', h);
    return () => window.removeEventListener('paste', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

  const slides = carrusel?.slides ?? [];
  const slideActiva = slides[activa];

  // Presupuesto TOTAL de capturas en base64. Vercel rechaza requests de más de
  // 4.5MB con un 413 ANTES de llegar a nuestra función, así que nos quedamos
  // bien abajo (≈2.3MB binario) y comprimimos más fuerte si hace falta.
  const BUDGET_IMAGENES = 3_200_000;

  async function agregarImagenes(files: File[]) {
    setError('');
    let total = imagenes.reduce((n, s) => n + s.length, 0);
    const nuevas: string[] = [];
    let capado = false;
    for (const f of files) {
      if (imagenes.length + nuevas.length >= 8) { capado = true; break; }
      let d = await comprimir(f, 1000, 0.8);
      if (!d) continue;
      if (total + d.length > BUDGET_IMAGENES) {
        d = await comprimir(f, 720, 0.66); // más liviana: la IA la lee igual de bien
        if (!d || total + d.length > BUDGET_IMAGENES) { capado = true; break; }
      }
      total += d.length;
      nuevas.push(d);
    }
    if (nuevas.length) setImagenes(prev => [...prev, ...nuevas].slice(0, 8));
    if (capado) setError('Llegamos al tope de peso/cantidad de capturas. Con las que ya subiste alcanza para leer el estilo y la estructura.');
  }

  async function generar(ideaParam?: string, modoParam?: 'idea' | 'adaptar' | 'diseno') {
    if (busy) return;
    const esLink = !modoParam && modo === 'link';
    const elModo = modoParam ?? (modo === 'lote' || modo === 'link' ? 'idea' : modo);
    const laIdea = (ideaParam ?? idea).trim();
    const conCapturas = elModo === 'adaptar' || elModo === 'diseno';

    if (esLink && !esLinkTranscribible(link)) { setError('Pegá un link de Instagram, TikTok, YouTube o Facebook.'); return; }
    if (!esLink && !conCapturas && !laIdea) { setError('Escribí la idea o el tema del carrusel.'); return; }
    if (conCapturas && imagenes.length === 0) { setError('Subí al menos una captura (arrastrá, pegá con ⌘V o tocá el recuadro).'); return; }
    if (elModo === 'diseno' && !laIdea) { setError('Escribí la idea del carrusel (el diseño pone el estilo, la idea pone el contenido).'); return; }

    setBusy(true); setError(''); setCarrusel(null); setActiva(0);

    // Modo link. Instagram primero pasa por el inspector del server: si el post
    // es un carrusel/imagen, vuelve YA adaptado (visión); si es video, seguimos
    // por transcripción. Las otras plataformas siempre son video.
    let transcript = '';
    if (esLink) {
      const u = link.trim();
      const plataforma = plataformaDe(u);

      if (plataforma === 'instagram') {
        setFase('🔎 Leyendo el post de Instagram…');
        try {
          const ri = await fetch('/api/carruseles', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accion: 'link', url: u, idea: laIdea, nicho, tono, cta, numSlides }),
          });
          const rawI = await ri.text();
          let di: Record<string, unknown> = {};
          try { di = JSON.parse(rawI); } catch { /* no-JSON */ }
          if (!ri.ok) {
            setError(typeof di.error === 'string' ? di.error : `No se pudo leer el post (HTTP ${ri.status}).`);
            setBusy(false); setFase(''); return;
          }
          if (!di.transcribir) {
            // Era un carrusel/imagen: llegó el carrusel completo, adaptado y con estilo clonado.
            const c = di as unknown as Carrusel;
            aplicarCarrusel(c);
            if (c.temaExtraido) void vestirCarrusel(c, { url: u }); // fase 2: réplica fiel
            setBusy(false); setFase(''); return;
          }
          // Era un video → seguimos al flujo de transcripción.
        } catch {
          setError('Error de conexión leyendo el post.');
          setBusy(false); setFase(''); return;
        }
      }

      setFase('🎧 Transcribiendo el video…');
      try {
        const rt = await fetch('/api/transcribir', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: u, platform: plataforma }),
        });
        const dt: Record<string, unknown> = await rt.json().catch(() => ({}));
        const texto = typeof dt.texto === 'string' ? dt.texto : '';
        if (!rt.ok || !texto) {
          setError(typeof dt.error === 'string' ? dt.error : 'No se pudo transcribir el video. Probá con otro link.');
          setBusy(false); setFase(''); return;
        }
        transcript = texto;
      } catch {
        setError('Error de conexión transcribiendo el video.');
        setBusy(false); setFase(''); return;
      }
    }

    setFase(conCapturas ? '🧬 Analizando capturas y escribiendo…' : '🎠 Armando el carrusel…');

    // Chequeo de peso ANTES de mandar: si el pedido supera el límite del server
    // (4.5MB), Vercel lo corta con un 413 que ni llega a nuestra función.
    const body = JSON.stringify({
      modo: elModo, idea: laIdea, nicho, tono, cta, numSlides,
      ...(conCapturas ? { imagenes } : {}),
      ...(transcript ? { transcript } : {}),
    });
    if (body.length > 3_800_000) {
      setError('Las capturas pesan demasiado para mandarlas juntas. Sacá alguna (con 3-5 alcanza para leer el estilo) e intentá de nuevo.');
      setBusy(false); setFase(''); return;
    }

    try {
      const res = await fetch('/api/carruseles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body,
      });
      // Respuesta defensiva: un 413 del borde de Vercel devuelve texto plano, no JSON.
      const raw = await res.text();
      let d: Record<string, unknown> = {};
      try { d = JSON.parse(raw); } catch { /* no-JSON */ }
      if (!res.ok) {
        setError(typeof d.error === 'string' ? d.error
          : res.status === 413 ? 'Las capturas pesan demasiado (límite del servidor). Sacá alguna e intentá de nuevo.'
          : `No se pudo generar (HTTP ${res.status}). Probá de nuevo.`);
      }
      else {
        const c = d as unknown as Carrusel;
        aplicarCarrusel(c);
        // Modos con capturas: fase 2 — réplica fiel del diseño de la referencia.
        if (conCapturas && c.temaExtraido) void vestirCarrusel(c, { imagenes });
      }
    } catch { setError('Error de conexión. Probá de nuevo.'); }
    setBusy(false); setFase('');
  }

  async function generarPlan() {
    if (planBusy) return;
    if (!idea.trim()) { setError('Escribí el tema o nicho del plan.'); return; }
    setPlanBusy(true); setError(''); setPlan([]);
    try {
      const res = await fetch('/api/carruseles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'plan', tema: idea, nicho, cantidad: cantLote }),
      });
      const d = await res.json();
      if (!res.ok) setError(d.error || 'No se pudo armar el plan.');
      else setPlan((d.plan as BriefLote[]) || []);
    } catch { setError('Error de conexión. Probá de nuevo.'); }
    setPlanBusy(false);
  }

  function usarBrief(b: BriefLote) {
    setModo('idea');
    setIdea(b.idea);
    void generar(b.idea, 'idea');
  }

  // Aplica un carrusel recibido de la API (y su tema clonado, si vino).
  function aplicarCarrusel(c: Carrusel) {
    setCarrusel(c);
    exportRefs.current = [];
    if (c.temaExtraido) {
      setTemaClonado(temaDesdeExtraido(c.temaExtraido));
      setTemaKey(TEMA_CLONADO_KEY);
    }
  }

  // Modo fiel: segunda fase — pide los HTML que replican la referencia (el server
  // los genera en paralelo). Mientras tanto el carrusel ya se puede editar; al
  // llegar, cada html se parchea con los textos ACTUALES (por si editaste algo).
  async function vestirCarrusel(c: Carrusel, fuente: { imagenes?: string[]; url?: string }) {
    if (!c.temaExtraido || !c.slides.length || (!fuente.imagenes?.length && !fuente.url)) return;
    setVistiendo(true);
    try {
      const res = await fetch('/api/carruseles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'vestir',
          slides: c.slides.map(s => ({ ...s, html: undefined, fondo: undefined })),
          temaExtraido: c.temaExtraido,
          ...fuente,
        }),
      });
      const d: Record<string, unknown> = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(d.htmls)) {
        const htmls = d.htmls as unknown[];
        setCarrusel(prev => {
          if (!prev) return prev;
          const next = prev.slides.map((s, i) => {
            const h = typeof htmls[i] === 'string' && htmls[i] ? patchRoles(htmls[i] as string, s) : '';
            return h ? { ...s, html: h } : s;
          });
          return { ...prev, slides: next };
        });
      }
    } catch { /* si falla, queda el render clásico — no es un error para el usuario */ }
    setVistiendo(false);
  }

  function editarSlide(patch: Partial<Slide>) {
    if (!carrusel) return;
    const next = carrusel.slides.map((s, i) => {
      if (i !== activa) return s;
      const nueva = { ...s, ...patch };
      // Modo fiel: los textos editados también se reflejan dentro del html clonado.
      const tocaTexto = ['kicker', 'titulo', 'cuerpo', 'pie', 'stat'].some(k => k in patch);
      if (nueva.html && tocaTexto) nueva.html = patchRoles(nueva.html, nueva);
      return nueva;
    });
    setCarrusel({ ...carrusel, slides: next });
  }
  function usarHook(texto: string) {
    if (!carrusel) return;
    const next = carrusel.slides.map((s, i) => {
      if (i !== 0) return s;
      const nueva = { ...s, titulo: texto };
      if (nueva.html) nueva.html = patchRoles(nueva.html, nueva);
      return nueva;
    });
    setCarrusel({ ...carrusel, slides: next });
    setActiva(0);
  }

  async function regenerarSlide() {
    if (!carrusel || !slideActiva || regenBusy) return;
    const inst = instruccion.trim();
    if (!inst) { setError('Escribí qué cambiar (ej: "más agresivo, con un ejemplo de finanzas").'); return; }
    setRegenBusy(true); setError('');
    try {
      const res = await fetch('/api/carruseles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'slide', slide: slideActiva, instruccion: inst, indice: activa, total: slides.length,
          contexto: { idea, nicho, tono, titulos: slides.map(s => s.titulo) },
        }),
      });
      const d = await res.json();
      if (!res.ok) setError(d.error || 'No se pudo regenerar la slide.');
      else {
        const recibida = d.slide as Slide;
        const fondo = slideActiva.fondo; // el fondo elegido se conserva
        // Modo fiel: si la IA no devolvió html, mantenemos el clonado con los textos nuevos.
        const html = recibida.html || (slideActiva.html ? patchRoles(slideActiva.html, recibida) : undefined);
        const next = carrusel.slides.map((s, i) => (i === activa ? { ...recibida, fondo, html } : s));
        setCarrusel({ ...carrusel, slides: next });
        setInstruccion('');
      }
    } catch { setError('Error de conexión. Probá de nuevo.'); }
    setRegenBusy(false);
  }

  function moverSlide(dir: -1 | 1) {
    if (!carrusel) return;
    const j = activa + dir;
    if (j < 0 || j >= carrusel.slides.length) return;
    const next = [...carrusel.slides];
    [next[activa], next[j]] = [next[j], next[activa]];
    setCarrusel({ ...carrusel, slides: next });
    setActiva(j);
  }
  function eliminarSlide() {
    if (!carrusel || carrusel.slides.length <= 2) return;
    const next = carrusel.slides.filter((_, i) => i !== activa);
    setCarrusel({ ...carrusel, slides: next });
    setActiva(a => Math.min(a, next.length - 1));
  }
  function agregarSlide() {
    if (!carrusel) return;
    const nueva: Slide = { tipo: 'contenido', layout: 'centrado', kicker: '', titulo: 'Nueva slide', cuerpo: '', pie: '' };
    const next = [...carrusel.slides];
    next.splice(activa + 1, 0, nueva);
    setCarrusel({ ...carrusel, slides: next });
    setActiva(activa + 1);
  }

  async function subirFondo(file: File) {
    const d = await comprimir(file, 1400, 0.85);
    if (d) editarSlide({ fondo: d });
  }
  async function generarFondoIA() {
    if (!slideActiva || fondoBusy) return;
    setFondoBusy(true); setError('');
    try {
      const prompt = `Fondo para una slide de carrusel de Instagram (vertical 4:5). Tema de la slide: "${slideActiva.titulo}". Estética ${tema.dark ? 'oscura' : 'clara'}, minimalista y premium: textura abstracta, degradado suave o formas difusas que combinen con el color de acento ${accent}. SIN texto, SIN letras, SIN logos, SIN personas. Tiene que dejar respirar un texto grande encima.`;
      const res = await fetch('/api/carruseles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'fondo', prompt }),
      });
      const d = await res.json();
      if (!res.ok) setError(d.error || 'No se pudo generar el fondo.');
      else editarSlide({ fondo: d.image as string });
    } catch { setError('Error de conexión generando el fondo.'); }
    setFondoBusy(false);
  }

  async function copiar(texto: string, etiqueta: string) {
    try { await navigator.clipboard.writeText(texto); setCopiado(etiqueta); setTimeout(() => setCopiado(''), 1500); }
    catch { /* ignore */ }
  }

  async function capturar(node: HTMLElement) {
    const { toPng } = await import('html-to-image');
    return toPng(node, { width: CARRUSEL_W, height: CARRUSEL_H, pixelRatio: 1, cacheBust: true });
  }
  function descargar(href: string, nombre: string) {
    const a = document.createElement('a');
    a.href = href; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  }

  async function exportarSlide() {
    const node = exportRefs.current[activa];
    if (!node || exportando) return;
    setExportando(true); setError('');
    try {
      await document.fonts.ready;
      await capturar(node); // warm-up (la 1ª captura puede salir sin fuentes)
      const url = await capturar(node);
      descargar(url, `slide-${String(activa + 1).padStart(2, '0')}.png`);
    } catch { setError('No se pudo exportar la slide. Probá de nuevo.'); }
    setExportando(false);
  }

  async function exportarTodo() {
    if (!carrusel || exportando) return;
    setExportando(true); setError('');
    try {
      const JSZip = (await import('jszip')).default;
      await document.fonts.ready;
      if (exportRefs.current[0]) await capturar(exportRefs.current[0]); // warm-up
      const zip = new JSZip();
      for (let i = 0; i < slides.length; i++) {
        const node = exportRefs.current[i];
        if (!node) continue;
        const url = await capturar(node);
        zip.file(`slide-${String(i + 1).padStart(2, '0')}.png`, url.split(',')[1], { base64: true });
      }
      const tags = carrusel.hashtags.map(h => '#' + h).join(' ');
      zip.file('caption.txt', `${carrusel.caption}\n\n${tags}\n`);
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      descargar(url, 'carrusel.zip');
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch { setError('No se pudo armar el .zip. Probá de nuevo.'); }
    setExportando(false);
  }

  const card = { background: 'linear-gradient(145deg, #14141f, #0d0d16)', border: '1px solid #23232f' } as const;
  const input = 'w-full px-3 py-2.5 rounded-xl text-sm outline-none';
  const inputStyle = { background: '#0a0a12', border: '1px solid #2a2a36', color: '#fff' } as const;
  const btnGhost = { background: '#161620', border: '1px solid #2a2a36', color: '#b4b4c0' } as const;
  const accent = brand.accent || tema.accent;
  const conCapturas = modo === 'adaptar' || modo === 'diseno';
  const modoActivo = MODOS.find(m => m.key === modo)!;
  // Modo fiel: la slide activa tiene su HTML clonado y el tema activo es el clonado
  // → se edita el texto, el diseño lo pone la referencia (sin layouts ni fondos).
  const modoFiel = temaKey === TEMA_CLONADO_KEY && !!slideActiva?.html;

  const labelGenerar = modo === 'adaptar' ? '🧬 Adaptar a mi carrusel'
    : modo === 'diseno' ? '🎨 Escribir sobre mi diseño'
    : modo === 'link' ? '🔗 Transcribir y armar carrusel'
    : '✨ Generar carrusel';

  return (
    <main className="min-h-screen text-white px-6 py-8"
      style={{ background: 'radial-gradient(ellipse 90% 45% at 25% 0%, #052e2a 0%, transparent 60%), radial-gradient(ellipse 70% 35% at 85% 8%, #06283a 0%, transparent 55%), #070710' }}>
      <AdminGate />
      <div className="max-w-6xl mx-auto">
        <ProductNav active="carruseles" />

        <div className="rounded-2xl px-5 py-3 mb-6 text-sm" style={{ ...card, color: '#b4b4c0' }}>
          🎠 <b>Carruseles</b> — de una idea, de un carrusel ajeno que funcionó, de tu propio diseño
          o en lote. La IA escribe, vos editás slide por slide y lo bajás listo para subir.
        </div>

        <div className="grid lg:grid-cols-[400px_1fr] gap-6 items-start">
          {/* ───────── Columna izquierda: controles ───────── */}
          <div className="flex flex-col gap-6">
            {/* 1 · Modo + entrada */}
            <div className="rounded-3xl p-6" style={card}>
              <h2 className="text-lg font-bold mb-3">1 · Punto de partida</h2>

              {/* Tabs de modo */}
              <div className="grid grid-cols-5 gap-1.5 mb-2">
                {MODOS.map(m => (
                  <button key={m.key} onClick={() => { setModo(m.key); setError(''); }}
                    className="rounded-xl px-1 py-2 text-center transition-all"
                    style={{
                      background: modo === m.key ? '#0e1a17' : '#10101a',
                      border: modo === m.key ? `1px solid ${TOOL}88` : '1px solid #23232f',
                      color: modo === m.key ? '#7fd9c4' : '#8b8b96',
                    }}>
                    <div className="text-base leading-none mb-1">{m.icon}</div>
                    <div className="text-[10px] font-bold leading-tight">{m.label}</div>
                  </button>
                ))}
              </div>
              <p className="text-xs mb-4" style={{ color: '#9a9aa6' }}>{modoActivo.desc}</p>

              {/* Capturas (adaptar / diseño) */}
              {conCapturas && (
                <Dropzone
                  imagenes={imagenes}
                  onAdd={files => void agregarImagenes(files)}
                  onRemove={i => setImagenes(prev => prev.filter((_, j) => j !== i))}
                  hint={modo === 'adaptar'
                    ? 'Las slides del carrusel que querés adaptar (hasta 8, en orden)'
                    : 'Capturas de TU plantilla o diseño (hasta 8)'}
                />
              )}

              {/* Link del video (modo link) */}
              {modo === 'link' && (
                <input value={link} onChange={e => setLink(e.target.value)} inputMode="url"
                  placeholder="https://www.instagram.com/reel/…  (IG, TikTok, YouTube, Facebook)"
                  className={input + ' mb-3'} style={inputStyle} />
              )}

              {/* Idea / tema */}
              <textarea value={idea} onChange={e => setIdea(e.target.value)} rows={3} maxLength={400}
                placeholder={
                  modo === 'adaptar' ? 'Opcional: ¿para qué nicho o con qué giro lo adaptamos? Ej: finanzas para creadores…'
                  : modo === 'link' ? 'Opcional: tu giro o nicho. Ej: adaptalo a bienes raíces, tono más polémico…'
                  : modo === 'diseno' ? 'La idea del carrusel. Ej: 5 errores que frenan tu crecimiento…'
                  : modo === 'lote' ? 'El tema o nicho del plan. Ej: marca personal para agentes inmobiliarios…'
                  : 'Ej: 5 errores que frenan tu crecimiento en redes…'
                }
                className={input + ' mb-3'} style={inputStyle} />

              {modo === 'idea' && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {EJEMPLOS.map(e => (
                    <button key={e} onClick={() => setIdea(e)}
                      className="text-xs px-2.5 py-1 rounded-full transition-all"
                      style={{ background: '#0e1a17', border: '1px solid #1d3b34', color: '#7fd9c4' }}>
                      {e}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mb-3">
                <label className="block">
                  <span className="text-xs" style={{ color: '#8b8b96' }}>Nicho</span>
                  <input value={nicho} onChange={e => setNicho(e.target.value)} placeholder="finanzas, fitness…"
                    className={input + ' mt-1'} style={inputStyle} />
                </label>
                <label className="block">
                  <span className="text-xs" style={{ color: '#8b8b96' }}>Tono</span>
                  <input value={tono} onChange={e => setTono(e.target.value)} placeholder="cercano, experto…"
                    className={input + ' mt-1'} style={inputStyle} />
                </label>
              </div>

              {modo !== 'lote' ? (
                <>
                  <label className="block mb-3">
                    <span className="text-xs" style={{ color: '#8b8b96' }}>Slides: <b style={{ color: '#fff' }}>{numSlides}</b></span>
                    <input type="range" min={4} max={10} value={numSlides} onChange={e => setNumSlides(Number(e.target.value))}
                      className="w-full mt-1" style={{ accentColor: TOOL }} />
                  </label>

                  <button onClick={() => setAvanzado(a => !a)} className="text-xs mb-2" style={{ color: '#7fd9c4' }}>
                    {avanzado ? '− Ocultar' : '+ Opciones'} (CTA)
                  </button>
                  {avanzado && (
                    <label className="block mb-3">
                      <span className="text-xs" style={{ color: '#8b8b96' }}>¿Qué querés que hagan al final?</span>
                      <input value={cta} onChange={e => setCta(e.target.value)} placeholder="Ej: que guarden y sigan la cuenta"
                        className={input + ' mt-1'} style={inputStyle} />
                    </label>
                  )}

                  <button onClick={() => void generar()} disabled={busy}
                    className="w-full py-3 rounded-2xl text-sm font-bold transition-all disabled:opacity-50 mt-1"
                    style={{ background: TOOL_GRAD, color: '#04211c' }}>
                    {busy ? (fase || 'Generando…') : labelGenerar}
                  </button>
                </>
              ) : (
                <>
                  <label className="block mb-3">
                    <span className="text-xs" style={{ color: '#8b8b96' }}>Carruseles del plan: <b style={{ color: '#fff' }}>{cantLote}</b></span>
                    <input type="range" min={3} max={10} value={cantLote} onChange={e => setCantLote(Number(e.target.value))}
                      className="w-full mt-1" style={{ accentColor: TOOL }} />
                  </label>
                  <button onClick={() => void generarPlan()} disabled={planBusy}
                    className="w-full py-3 rounded-2xl text-sm font-bold transition-all disabled:opacity-50 mt-1"
                    style={{ background: TOOL_GRAD, color: '#04211c' }}>
                    {planBusy ? 'Armando el plan…' : '🗺️ Generar plan de contenido'}
                  </button>
                </>
              )}
            </div>

            {/* Plan del lote */}
            {modo === 'lote' && plan.length > 0 && (
              <div className="rounded-3xl p-6" style={card}>
                <h2 className="text-lg font-bold mb-1">Tu plan ({plan.length})</h2>
                <p className="text-sm mb-3" style={{ color: '#9a9aa6' }}>Cada uno con un ángulo distinto. Tocá <b>Generar</b> y se arma completo.</p>
                <div className="flex flex-col gap-2">
                  {plan.map((b, i) => (
                    <div key={i} className="rounded-2xl p-3" style={{ background: '#0e1a17', border: '1px solid #1d3b34' }}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                          style={{ background: '#10b98122', color: '#7fd9c4' }}>{b.angulo || `#${i + 1}`}</span>
                        <button onClick={() => usarBrief(b)} disabled={busy}
                          className="text-xs px-2.5 py-1 rounded-lg font-bold disabled:opacity-50"
                          style={{ background: TOOL_GRAD, color: '#04211c' }}>
                          ⚡ Generar
                        </button>
                      </div>
                      <p className="text-xs font-bold" style={{ color: '#e8e8ee' }}>{b.hook}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: '#8fb5a8' }}>{b.idea}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2 · Estilo */}
            <div className="rounded-3xl p-6" style={card}>
              <h2 className="text-lg font-bold mb-1">2 · Estilo</h2>
              <p className="text-sm mb-3" style={{ color: '#9a9aa6' }}>Elegí una plantilla y aplicá tu marca encima.</p>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {temaClonado && (
                  <button onClick={() => setTemaKey(TEMA_CLONADO_KEY)}
                    className="rounded-xl p-2 text-left transition-all relative"
                    style={{ background: temaClonado.bg, border: temaKey === TEMA_CLONADO_KEY ? `2px solid ${TOOL}` : '2px solid transparent', height: 64 }}>
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: temaClonado.panel, color: temaClonado.accent }}>🎨 {temaClonado.name}</span>
                    <div className="mt-1.5 h-1.5 w-8 rounded-full" style={{ background: temaClonado.accent }} />
                    <div className="mt-1 text-[10px] font-bold" style={{ color: temaClonado.fg }}>Aa</div>
                  </button>
                )}
                {TEMAS.map(t => (
                  <button key={t.key} onClick={() => setTemaKey(t.key)}
                    className="rounded-xl p-2 text-left transition-all"
                    style={{ background: t.bg, border: temaKey === t.key ? `2px solid ${TOOL}` : '2px solid transparent', height: 64 }}>
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: t.panel, color: t.accent }}>{t.name}</span>
                    <div className="mt-1.5 h-1.5 w-8 rounded-full" style={{ background: t.accent }} />
                    <div className="mt-1 text-[10px] font-bold" style={{ color: t.fg }}>Aa</div>
                  </button>
                ))}
              </div>
              {temaClonado && (
                <button onClick={() => { setTemaClonado(null); if (temaKey === TEMA_CLONADO_KEY) setTemaKey(TEMAS[0].key); }}
                  className="text-xs mb-3" style={{ color: '#8b8b96' }}>
                  ✕ Quitar el tema clonado
                </button>
              )}

              <div className="grid grid-cols-2 gap-2 mb-3">
                <label className="block">
                  <span className="text-xs" style={{ color: '#8b8b96' }}>Tu @usuario</span>
                  <input value={brand.handle} onChange={e => setBrand({ ...brand, handle: e.target.value })}
                    placeholder="@tucuenta" className={input + ' mt-1'} style={inputStyle} />
                </label>
                <label className="block">
                  <span className="text-xs" style={{ color: '#8b8b96' }}>Color de marca</span>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={brand.accent || tema.accent}
                      onChange={e => setBrand({ ...brand, accent: e.target.value })}
                      className="w-9 h-9 rounded-lg cursor-pointer bg-transparent" style={{ border: '1px solid #2a2a36' }} />
                    {brand.accent && (
                      <button onClick={() => setBrand({ ...brand, accent: '' })} className="text-xs" style={{ color: '#8b8b96' }}>
                        usar el del tema
                      </button>
                    )}
                  </div>
                </label>
              </div>

              <label className="block">
                <span className="text-xs" style={{ color: '#8b8b96' }}>Logo (opcional)</span>
                <div className="flex items-center gap-2 mt-1">
                  <input type="file" accept="image/*"
                    onChange={e => {
                      const f = e.target.files?.[0]; if (!f) return;
                      const r = new FileReader();
                      r.onload = () => setBrand({ ...brand, logo: String(r.result) });
                      r.readAsDataURL(f);
                    }}
                    className="block w-full text-xs file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:cursor-pointer"
                    style={{ color: '#9a9aa6' }} />
                  {brand.logo && (
                    <button onClick={() => setBrand({ ...brand, logo: '' })} className="text-xs shrink-0" style={{ color: '#8b8b96' }}>quitar</button>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* ───────── Columna derecha: preview + acciones ───────── */}
          <div className="rounded-3xl p-6" style={card}>
            {!carrusel ? (
              <div className="flex flex-col items-center justify-center text-center py-20" style={{ color: '#6b6b78' }}>
                <div className="text-5xl mb-4">🎠</div>
                <p className="text-sm max-w-xs">
                  Tu carrusel va a aparecer acá. Elegí un punto de partida a la izquierda
                  {modo === 'lote' ? ' y generá el plan.' : ' y dale a Generar.'}
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-[auto_1fr] gap-6">
                {/* Preview + navegación */}
                <div>
                  <div className="rounded-[28px] overflow-hidden mx-auto" style={{ width: PREVIEW_W, height: PREVIEW_W * (CARRUSEL_H / CARRUSEL_W), boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
                    <div style={{ width: CARRUSEL_W, height: CARRUSEL_H, transform: `scale(${SCALE})`, transformOrigin: 'top left' }}>
                      {slideActiva && <SlideView slide={slideActiva} tema={tema} accent={accent} brand={brand} idx={activa} total={slides.length} />}
                    </div>
                  </div>

                  {/* Tira de miniaturas */}
                  <div className="flex gap-1.5 justify-center mt-3 flex-wrap" style={{ maxWidth: PREVIEW_W }}>
                    {slides.map((s, i) => (
                      <button key={i} onClick={() => setActiva(i)} title={TIPO_LABEL[s.tipo]}
                        className="rounded-md text-[10px] font-bold transition-all"
                        style={{
                          width: 26, height: 33,
                          background: i === activa ? accent : '#1a1a24',
                          color: i === activa ? tema.onAccent : '#6b6b78',
                          border: `1px solid ${i === activa ? accent : '#2a2a36'}`,
                        }}>
                        {i + 1}
                      </button>
                    ))}
                  </div>

                  {vistiendo && (
                    <p className="text-[11px] text-center mt-2 animate-pulse" style={{ color: '#7fd9c4' }}>
                      👔 Clonando el diseño tal cual la referencia… (~20s, podés ir editando)
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-3 gap-2">
                    <button onClick={() => setActiva(a => Math.max(0, a - 1))} disabled={activa === 0}
                      className="px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-30" style={btnGhost}>← Anterior</button>
                    <span className="text-xs" style={{ color: '#8b8b96' }}>{activa + 1} / {slides.length} · {TIPO_LABEL[slideActiva?.tipo ?? 'contenido']}</span>
                    <button onClick={() => setActiva(a => Math.min(slides.length - 1, a + 1))} disabled={activa === slides.length - 1}
                      className="px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-30" style={btnGhost}>Siguiente →</button>
                  </div>

                  {/* Orden / agregar / borrar */}
                  <div className="flex gap-1.5 mt-3">
                    <button onClick={() => moverSlide(-1)} disabled={activa === 0} title="Mover slide a la izquierda"
                      className="flex-1 py-2 rounded-xl text-xs font-bold disabled:opacity-30" style={btnGhost}>⇤ Mover</button>
                    <button onClick={() => moverSlide(1)} disabled={activa === slides.length - 1} title="Mover slide a la derecha"
                      className="flex-1 py-2 rounded-xl text-xs font-bold disabled:opacity-30" style={btnGhost}>Mover ⇥</button>
                    <button onClick={agregarSlide} title="Agregar slide después de esta"
                      className="flex-1 py-2 rounded-xl text-xs font-bold" style={btnGhost}>＋ Slide</button>
                    <button onClick={eliminarSlide} disabled={slides.length <= 2} title="Eliminar esta slide"
                      className="py-2 px-3 rounded-xl text-xs font-bold disabled:opacity-30"
                      style={{ background: '#1c1016', border: '1px solid #4a2030', color: '#f08fa8' }}>🗑</button>
                  </div>

                  {/* Export */}
                  <div className="flex gap-2 mt-4">
                    <button onClick={exportarSlide} disabled={exportando}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50" style={{ ...btnGhost, color: '#fff' }}>
                      ⬇️ Esta slide
                    </button>
                    <button onClick={exportarTodo} disabled={exportando}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50" style={{ background: TOOL_GRAD, color: '#04211c' }}>
                      {exportando ? 'Armando…' : '⬇️ Carrusel (.zip)'}
                    </button>
                  </div>
                </div>

                {/* Edición + munición */}
                <div className="flex flex-col gap-5 min-w-0">
                  {/* Editar slide activa */}
                  <div>
                    <h3 className="text-sm font-bold mb-2" style={{ color: '#d4d4dc' }}>✏️ Editá la slide {activa + 1}</h3>
                    <div className="flex flex-col gap-2">
                      <input value={slideActiva?.kicker ?? ''} onChange={e => editarSlide({ kicker: e.target.value })}
                        placeholder="Etiqueta (ej: PASO 1)" className={input} style={inputStyle} />
                      <textarea value={slideActiva?.titulo ?? ''} onChange={e => editarSlide({ titulo: e.target.value })}
                        rows={2} placeholder="Título" className={input} style={inputStyle} />
                      <textarea value={slideActiva?.cuerpo ?? ''} onChange={e => editarSlide({ cuerpo: e.target.value })}
                        rows={3} placeholder="Texto de apoyo (en listas, un punto por línea)" className={input} style={inputStyle} />
                    </div>

                    {/* Modo fiel: aviso en lugar de layouts/fondos */}
                    {modoFiel && (
                      <p className="text-[11px] mt-2 rounded-lg px-2.5 py-1.5" style={{ background: '#0e1a17', border: '1px solid #1d3b34', color: '#8fd0bd' }}>
                        🎯 Modo fiel al original: editás los textos y el diseño clonado se mantiene tal cual.
                        Elegí otra plantilla en «2 · Estilo» para re-vestirlo (y volver a layouts y fondos).
                      </p>
                    )}

                    {/* Layout de la slide */}
                    {!modoFiel && slideActiva && slideActiva.tipo !== 'resumen' && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-[11px]" style={{ color: '#8b8b96' }}>Layout:</span>
                        {LAYOUTS_UI.map(l => (
                          <button key={l.key} onClick={() => editarSlide({ layout: l.key })}
                            className="text-[11px] px-2 py-1 rounded-lg font-bold transition-all"
                            style={{
                              background: (slideActiva.layout ?? 'centrado') === l.key ? '#0e1a17' : '#10101a',
                              border: (slideActiva.layout ?? 'centrado') === l.key ? `1px solid ${TOOL}88` : '1px solid #23232f',
                              color: (slideActiva.layout ?? 'centrado') === l.key ? '#7fd9c4' : '#8b8b96',
                            }}>
                            {l.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {!modoFiel && slideActiva?.layout === 'stat' && slideActiva.tipo !== 'resumen' && (
                      <input value={slideActiva.stat ?? ''} onChange={e => editarSlide({ stat: e.target.value })}
                        placeholder='La cifra protagonista (ej: "87%", "x3", "0→100K")' className={input + ' mt-2'} style={inputStyle} />
                    )}

                    {/* Fondo de la slide (no aplica en modo fiel: el diseño lo trae la referencia) */}
                    {!modoFiel && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-[11px]" style={{ color: '#8b8b96' }}>Fondo:</span>
                        <button onClick={() => fondoInputRef.current?.click()}
                          className="text-[11px] px-2 py-1 rounded-lg font-bold" style={btnGhost}>📎 Subir</button>
                        <button onClick={() => void generarFondoIA()} disabled={fondoBusy}
                          className="text-[11px] px-2 py-1 rounded-lg font-bold disabled:opacity-50" style={btnGhost}>
                          {fondoBusy ? '✨ Generando… (~30s)' : '✨ Con IA'}
                        </button>
                        {slideActiva?.fondo && (
                          <button onClick={() => editarSlide({ fondo: '' })}
                            className="text-[11px] px-2 py-1 rounded-lg font-bold"
                            style={{ background: '#1c1016', border: '1px solid #4a2030', color: '#f08fa8' }}>✕ Quitar</button>
                        )}
                        <input ref={fondoInputRef} type="file" accept="image/*" hidden
                          onChange={e => { const f = e.target.files?.[0]; if (f) void subirFondo(f); e.target.value = ''; }} />
                      </div>
                    )}

                    {/* Regenerar con instrucción */}
                    <div className="flex gap-1.5 mt-3">
                      <input value={instruccion} onChange={e => setInstruccion(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') void regenerarSlide(); }}
                        placeholder='Rehacé esta slide: "más agresiva", "con un ejemplo"…'
                        className={input} style={inputStyle} />
                      <button onClick={() => void regenerarSlide()} disabled={regenBusy}
                        className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
                        style={{ background: TOOL_GRAD, color: '#04211c' }}>
                        {regenBusy ? '…' : '🪄 Rehacer'}
                      </button>
                    </div>
                  </div>

                  {/* Score viral */}
                  {carrusel.score && (
                    <div className="rounded-2xl p-4" style={{ background: '#0c1614', border: `1px solid ${TOOL}33` }}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold">🔥 Potencial viral</h3>
                        <span className="text-2xl font-extrabold" style={{ color: TOOL }}>{carrusel.score.total}<span className="text-sm" style={{ color: '#6b6b78' }}>/100</span></span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-2">
                        {([['Gancho', 'gancho'], ['Valor', 'valor'], ['Guardable', 'guardabilidad'], ['Claridad', 'claridad']] as const).map(([lbl, k]) => (
                          <div key={k}>
                            <div className="flex justify-between text-[11px] mb-0.5" style={{ color: '#9a9aa6' }}><span>{lbl}</span><span>{carrusel.score[k]}</span></div>
                            <div className="h-1.5 rounded-full" style={{ background: '#1a1a24' }}>
                              <div className="h-full rounded-full" style={{ width: `${carrusel.score[k]}%`, background: TOOL }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      {carrusel.score.veredicto && <p className="text-xs mb-1.5" style={{ color: '#c4c4cc' }}>{carrusel.score.veredicto}</p>}
                      {carrusel.score.mejoras?.length > 0 && (
                        <ul className="text-xs space-y-0.5" style={{ color: '#9a9aa6' }}>
                          {carrusel.score.mejoras.map((m, i) => <li key={i}>• {m}</li>)}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Estilo clonado detectado */}
                  {carrusel.temaExtraido && (
                    <div className="rounded-2xl p-3 text-xs" style={{ background: '#0e1a17', border: '1px solid #1d3b34', color: '#9fc9bb' }}>
                      🎨 Cloné el diseño de la referencia como <b style={{ color: '#e8e8ee' }}>{carrusel.temaExtraido.nombre}</b>
                      {carrusel.slides.some(s => s.html) ? ' — cada slide replica su composición tal cual (modo fiel).' : ' y lo dejé aplicado.'}
                      {carrusel.temaExtraido.notas ? ` ${carrusel.temaExtraido.notas}` : ''} Podés re-vestirlo en «2 · Estilo».
                    </div>
                  )}

                  {/* Ganchos alternativos */}
                  {carrusel.hooksAlternativos?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold mb-2" style={{ color: '#d4d4dc' }}>🎣 Probá otra portada <span className="text-xs font-normal" style={{ color: '#8b8b96' }}>(toca para usar)</span></h3>
                      <div className="flex flex-col gap-1.5">
                        {carrusel.hooksAlternativos.map((h, i) => (
                          <button key={i} onClick={() => usarHook(h)}
                            className="text-left text-xs px-3 py-2 rounded-xl transition-all"
                            style={{ background: '#0e1a17', border: '1px solid #1d3b34', color: '#cfeee5' }}>
                            {h}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Caption + hashtags */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold" style={{ color: '#d4d4dc' }}>📝 Caption</h3>
                      <button onClick={() => copiar(`${carrusel.caption}\n\n${carrusel.hashtags.map(h => '#' + h).join(' ')}`, 'caption')}
                        className="text-xs px-2.5 py-1 rounded-lg font-bold" style={{ background: '#161620', border: '1px solid #2a2a36', color: '#7fd9c4' }}>
                        {copiado === 'caption' ? '✓ Copiado' : 'Copiar'}
                      </button>
                    </div>
                    <p className="text-xs whitespace-pre-wrap rounded-xl p-3" style={{ background: '#0a0a12', border: '1px solid #1d1d28', color: '#c4c4cc' }}>{carrusel.caption}</p>
                    {carrusel.hashtags?.length > 0 && (
                      <p className="text-xs mt-2" style={{ color: '#6fb9a8' }}>{carrusel.hashtags.map(h => '#' + h).join(' ')}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-2xl p-4 text-sm" style={{ background: '#7f1d1d22', border: '1px solid #7f1d1d55', color: '#fca5a5' }}>{error}</div>
            )}
          </div>
        </div>
      </div>

      {/* Nodos ocultos a tamaño completo (1080×1350) para exportar a PNG sin perder calidad. */}
      <div aria-hidden style={{ position: 'fixed', left: -99999, top: 0, pointerEvents: 'none', opacity: 0 }}>
        {slides.map((s, i) => (
          <div key={i} ref={el => { exportRefs.current[i] = el; }} style={{ width: CARRUSEL_W, height: CARRUSEL_H }}>
            <SlideView slide={s} tema={tema} accent={accent} brand={brand} idx={i} total={slides.length} />
          </div>
        ))}
      </div>
    </main>
  );
}

// ── Zona de subida de capturas (drag & drop + click + ⌘V) ──────────────────
function Dropzone({ imagenes, onAdd, onRemove, hint }: {
  imagenes: string[]; onAdd: (files: File[]) => void; onRemove: (i: number) => void; hint: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="mb-3">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); onAdd(Array.from(e.dataTransfer.files)); }}
        className="rounded-2xl p-4 text-center cursor-pointer transition-all"
        style={{ border: '2px dashed #2a4a40', background: '#0c1512', color: '#7fd9c4' }}>
        <div className="text-2xl mb-1">📸</div>
        <p className="text-xs font-bold">Arrastrá, pegá (⌘V) o tocá para subir</p>
        <p className="text-[11px] mt-0.5" style={{ color: '#5f8a7d' }}>{hint}</p>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden
        onChange={e => { if (e.target.files?.length) onAdd(Array.from(e.target.files)); e.target.value = ''; }} />
      {imagenes.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-2">
          {imagenes.map((img, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" className="w-14 h-[70px] object-cover rounded-lg" style={{ border: '1px solid #2a2a36' }} />
              <span className="absolute bottom-0.5 left-1 text-[9px] font-bold text-white" style={{ textShadow: '0 1px 3px #000' }}>{i + 1}</span>
              <button onClick={() => onRemove(i)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-bold leading-none"
                style={{ background: '#dc2626', color: '#fff' }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
