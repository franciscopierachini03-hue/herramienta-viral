'use client';

// /admin/whatsapp — enviador masivo de plantillas de WhatsApp (Meta Cloud API).
// Flujo: 1) elegí una plantilla APROBADA (se leen de Meta) → 2) subí tu lista
// (CSV exportado de GoHighLevel o tu Sheet) → 3) mapeá variables → 4) disparo
// con progreso en vivo. El navegador llama /api/admin/whatsapp/send por fila
// (concurrencia suave) — se puede frenar a mitad y descargar los resultados.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import AdminGate from '../../_components/AdminGate';

type Plantilla = {
  name: string;
  language: string;
  category: string;
  body: string;
  variables: number;
  headerConVariable: boolean;
};

type Cfg = { configurado: boolean; faltan?: string[]; plantillas?: Plantilla[]; error?: string };
type MapVar = { tipo: 'col' | 'fijo'; valor: string };
type Resultado = { tel: string; ok: boolean; error?: string };

// CSV con comillas y delimitador auto (',' o ';').
function parseCSV(text: string): string[][] {
  const primera = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'));
  const delim = (primera.match(/;/g)?.length || 0) > (primera.match(/,/g)?.length || 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some(v => v.trim() !== '')) rows.push(row.map(v => v.trim()));
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some(v => v.trim() !== '')) rows.push(row.map(v => v.trim()));
  return rows;
}

function normTel(raw: string): string | null {
  const d = String(raw || '').replace(/[^\d]/g, '');
  return d.length >= 8 && d.length <= 15 ? d : null;
}

export default function WhatsAppPage() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [tplName, setTplName] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [conHeaders, setConHeaders] = useState(true);
  const [colTel, setColTel] = useState(0);
  const [mapVars, setMapVars] = useState<MapVar[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [error, setError] = useState('');
  const stopRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/admin/whatsapp/templates', { cache: 'no-store' })
      .then(r => r.json()).then(d => setCfg(d as Cfg))
      .catch(() => setCfg({ configurado: false, error: 'No se pudo consultar.' }));
  }, []);

  const tpl = useMemo(() => cfg?.plantillas?.find(p => p.name === tplName) || null, [cfg, tplName]);

  // Al elegir plantilla, prepara el mapeo de variables ({{1}} = 1ª columna no-teléfono).
  useEffect(() => {
    if (!tpl) { setMapVars([]); return; }
    setMapVars(Array.from({ length: tpl.variables }, (_, i) => ({ tipo: 'col', valor: String(i === 0 ? 1 : i + 1) })));
  }, [tpl]);

  const headers = useMemo(() => {
    if (!rows.length) return [];
    return conHeaders
      ? rows[0].map((h, i) => h || `Columna ${i + 1}`)
      : rows[0].map((_, i) => `Columna ${i + 1}`);
  }, [rows, conHeaders]);

  const datos = useMemo(() => (conHeaders ? rows.slice(1) : rows), [rows, conHeaders]);

  // Lista final: teléfonos normalizados + variables resueltas, sin duplicados.
  const lista = useMemo(() => {
    const vistos = new Set<string>();
    const out: { tel: string; vars: string[] }[] = [];
    let invalidos = 0;
    for (const r of datos) {
      const tel = normTel(r[colTel] ?? '');
      if (!tel) { invalidos++; continue; }
      if (vistos.has(tel)) continue;
      vistos.add(tel);
      const vars = mapVars.map(m => (m.tipo === 'fijo' ? m.valor : (r[Number(m.valor)] ?? '').trim() || '—'));
      out.push({ tel, vars });
    }
    return { out, invalidos, duplicados: datos.length - invalidos - out.length };
  }, [datos, colTel, mapVars]);

  function cargarCSV(f: File) {
    const r = new FileReader();
    r.onload = () => {
      const parsed = parseCSV(String(r.result || ''));
      setRows(parsed);
      setResultados([]);
      // Auto: si la primera fila no tiene ningún teléfono válido, son títulos.
      if (parsed.length) setConHeaders(!parsed[0].some(c => normTel(c)));
      // Auto: primera columna que parezca teléfono en la fila 2 (o 1).
      const fila = parsed[1] ?? parsed[0] ?? [];
      const idx = fila.findIndex(c => normTel(c));
      if (idx >= 0) setColTel(idx);
    };
    r.readAsText(f);
  }

  async function enviarTodo() {
    if (!tpl || enviando || !lista.out.length) return;
    setEnviando(true); setError(''); setResultados([]);
    stopRef.current = false;
    const cola = [...lista.out];
    const worker = async () => {
      while (cola.length && !stopRef.current) {
        const item = cola.shift();
        if (!item) break;
        try {
          const r = await fetch('/api/admin/whatsapp/send', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: item.tel, template: tpl.name, lang: tpl.language, vars: item.vars }),
          });
          const d = await r.json().catch(() => ({}));
          setResultados(p => [...p, { tel: item.tel, ok: !!(d as { ok?: boolean }).ok, error: (d as { ok?: boolean; error?: string }).ok ? undefined : ((d as { error?: string }).error || `HTTP ${r.status}`) }]);
        } catch {
          setResultados(p => [...p, { tel: item.tel, ok: false, error: 'Error de conexión' }]);
        }
        await new Promise(res => setTimeout(res, 350)); // ritmo suave (≈8 msg/s con 3 hilos)
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setEnviando(false);
  }

  function descargarResultados() {
    const csv = ['telefono,estado,error', ...resultados.map(r => `${r.tel},${r.ok ? 'enviado' : 'error'},"${(r.error || '').replace(/"/g, '""')}"`)].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'whatsapp-resultados.csv';
    a.click();
  }

  const ok = resultados.filter(r => r.ok).length;
  const fallos = resultados.filter(r => !r.ok);
  const pct = lista.out.length ? Math.round((resultados.length / lista.out.length) * 100) : 0;

  const card = { background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' } as const;
  const input = 'w-full px-3 py-2.5 rounded-xl text-sm outline-none';
  const inputStyle = { background: '#0a0a0a', border: '1px solid #2a2a2a', color: '#fff' } as const;

  return (
    <main className="min-h-screen text-white px-6 py-8" style={{ background: '#080808' }}>
      <AdminGate />
      <div className="max-w-4xl mx-auto">

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">📲 WhatsApp masivo</h1>
            <p className="text-xs" style={{ color: '#666' }}>Plantillas aprobadas de Meta · para invitar y recordar el evento</p>
          </div>
          <Link href="/admin" className="text-sm" style={{ color: '#888' }}>← Panel</Link>
        </div>

        {/* Configuración pendiente */}
        {cfg && !cfg.configurado && (
          <div className="rounded-2xl p-5 mb-6" style={{ background: '#1a1408', border: '1px solid #a1620a55' }}>
            <p className="text-sm font-bold mb-2" style={{ color: '#fcd34d' }}>⚙️ Falta conectar tu WhatsApp Business (5 min, una sola vez)</p>
            <p className="text-xs mb-2" style={{ color: '#c9b48a' }}>Agregá en Vercel → Settings → Environment Variables:</p>
            <ul className="text-xs space-y-1 mb-3 font-mono" style={{ color: '#e8d9b0' }}>
              {(cfg.faltan || []).map(f => <li key={f}>• {f}</li>)}
            </ul>
            <ol className="text-xs space-y-1.5" style={{ color: '#c9b48a' }}>
              <li>1. <b>WHATSAPP_TOKEN</b>: business.facebook.com → Configuración del negocio → Usuarios del sistema → creá uno (admin) → Generar token → seleccioná tu app y marcá <i>whatsapp_business_messaging</i> y <i>whatsapp_business_management</i> (sin vencimiento).</li>
              <li>2. <b>WHATSAPP_PHONE_ID</b> y <b>WHATSAPP_WABA_ID</b>: developers.facebook.com → tu app → WhatsApp → API Setup: ahí aparecen «Phone number ID» y «WhatsApp Business Account ID».</li>
              <li>3. Redeploy y recargá esta página.</li>
            </ol>
          </div>
        )}
        {cfg?.error && (
          <div className="rounded-2xl p-4 mb-6 text-sm" style={{ background: '#7f1d1d22', border: '1px solid #7f1d1d55', color: '#fca5a5' }}>
            Meta respondió con error: {cfg.error}
          </div>
        )}

        {/* Paso 1 · Plantilla */}
        {cfg?.configurado && !cfg.error && (
          <div className="rounded-2xl p-5 mb-4" style={card}>
            <h2 className="text-sm font-bold mb-3">1 · Plantilla aprobada</h2>
            {(cfg.plantillas?.length ?? 0) === 0 ? (
              <p className="text-xs" style={{ color: '#888' }}>No hay plantillas APROBADAS en tu cuenta todavía.</p>
            ) : (
              <>
                <select value={tplName} onChange={e => setTplName(e.target.value)} className={input} style={inputStyle}>
                  <option value="">Elegí una plantilla…</option>
                  {cfg.plantillas!.map(p => (
                    <option key={`${p.name}-${p.language}`} value={p.name}>
                      {p.name} · {p.language} · {p.category.toLowerCase()}
                    </option>
                  ))}
                </select>
                {tpl && (
                  <div className="mt-3 rounded-xl p-3 text-xs whitespace-pre-wrap" style={{ background: '#0a0a0a', border: '1px solid #1f1f1f', color: '#c9c9d4' }}>
                    {tpl.body}
                  </div>
                )}
                {tpl?.headerConVariable && (
                  <p className="text-xs mt-2" style={{ color: '#fcd34d' }}>⚠️ Esta plantilla tiene encabezado con variable/multimedia — este enviador (v1) solo completa variables del CUERPO. Elegí otra o pedime soporte para header.</p>
                )}
              </>
            )}
          </div>
        )}

        {/* Paso 2 · Lista */}
        {tpl && (
          <div className="rounded-2xl p-5 mb-4" style={card}>
            <h2 className="text-sm font-bold mb-1">2 · Tu lista (CSV)</h2>
            <p className="text-xs mb-3" style={{ color: '#888' }}>
              Exportá contactos de GoHighLevel (Contacts → Export) o bajá tu Sheet como CSV.
              Los teléfonos DEBEN traer código de país (52 México, 57 Colombia, 1 USA…).
            </p>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={e => { const f = e.target.files?.[0]; if (f) cargarCSV(f); e.currentTarget.value = ''; }}
              className="block w-full text-xs file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:cursor-pointer" style={{ color: '#9a9aa6' }} />

            {rows.length > 0 && (
              <>
                <label className="flex items-center gap-2 mt-3 text-xs" style={{ color: '#aaa' }}>
                  <input type="checkbox" checked={conHeaders} onChange={e => setConHeaders(e.target.checked)} />
                  La primera fila son títulos de columna
                </label>

                <div className="grid sm:grid-cols-2 gap-2 mt-3">
                  <label className="block">
                    <span className="text-xs" style={{ color: '#888' }}>📞 Columna del teléfono</span>
                    <select value={colTel} onChange={e => setColTel(Number(e.target.value))} className={input + ' mt-1'} style={inputStyle}>
                      {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                    </select>
                  </label>
                  {mapVars.map((m, vi) => (
                    <label key={vi} className="block">
                      <span className="text-xs" style={{ color: '#888' }}>{'{{'}{vi + 1}{'}}'} de la plantilla</span>
                      <div className="flex gap-1.5 mt-1">
                        <select value={m.tipo === 'col' ? `c:${m.valor}` : 'fijo'}
                          onChange={e => {
                            const v = e.target.value;
                            setMapVars(p => p.map((x, j) => j === vi ? (v === 'fijo' ? { tipo: 'fijo', valor: x.tipo === 'fijo' ? x.valor : '' } : { tipo: 'col', valor: v.slice(2) }) : x));
                          }}
                          className={input} style={inputStyle}>
                          {headers.map((h, i) => <option key={i} value={`c:${i}`}>{h}</option>)}
                          <option value="fijo">✏️ Texto fijo…</option>
                        </select>
                        {m.tipo === 'fijo' && (
                          <input value={m.valor} onChange={e => setMapVars(p => p.map((x, j) => j === vi ? { ...x, valor: e.target.value } : x))}
                            placeholder="texto" className={input} style={inputStyle} />
                        )}
                      </div>
                    </label>
                  ))}
                </div>

                <div className="mt-3 text-xs rounded-xl p-3" style={{ background: '#0a0a0a', border: '1px solid #1f1f1f', color: '#aaa' }}>
                  ✅ <b style={{ color: '#86efac' }}>{lista.out.length}</b> destinatarios listos
                  {lista.invalidos > 0 && <> · <span style={{ color: '#fcd34d' }}>{lista.invalidos} teléfonos inválidos (se saltan)</span></>}
                  {lista.duplicados > 0 && <> · {lista.duplicados} duplicados eliminados</>}
                  {lista.out[0] && (
                    <div className="mt-1.5" style={{ color: '#777' }}>
                      Ejemplo → 📞 {lista.out[0].tel}{lista.out[0].vars.length ? ` · variables: ${lista.out[0].vars.join(' · ')}` : ''}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Paso 3 · Enviar */}
        {tpl && lista.out.length > 0 && (
          <div className="rounded-2xl p-5 mb-4" style={card}>
            <h2 className="text-sm font-bold mb-2">3 · Disparar</h2>
            <div className="text-xs rounded-xl p-3 mb-3" style={{ background: '#1a1408', border: '1px solid #a1620a55', color: '#c9b48a' }}>
              ⚠️ <b style={{ color: '#fcd34d' }}>Antes de enviar:</b> Meta cobra por mensaje de plantilla (≈ US$0.01–0.05 según país)
              → este envío ≈ <b style={{ color: '#fcd34d' }}>US${(lista.out.length * 0.03).toFixed(2)}</b> aprox.
              Tu número tiene un límite diario de destinatarios únicos según su nivel (250 → 1.000 → 10.000).
              Y enviá solo a gente que espera saber de vos: los reportes de spam bajan la calidad del número.
            </div>
            {!enviando ? (
              <button onClick={() => void enviarTodo()}
                className="w-full py-3 rounded-2xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#04210f' }}>
                📲 Enviar a {lista.out.length} contactos
              </button>
            ) : (
              <button onClick={() => { stopRef.current = true; }}
                className="w-full py-3 rounded-2xl text-sm font-bold"
                style={{ background: '#7f1d1d', color: '#fff' }}>
                ⏹ Detener (van {resultados.length}/{lista.out.length})
              </button>
            )}

            {(enviando || resultados.length > 0) && (
              <>
                <div className="h-2 rounded-full mt-4" style={{ background: '#1f1f1f' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#22c55e' }} />
                </div>
                <div className="flex justify-between text-xs mt-1.5" style={{ color: '#888' }}>
                  <span>✅ {ok} enviados · ❌ {fallos.length} con error</span>
                  <span>{pct}%</span>
                </div>
                {resultados.length > 0 && !enviando && (
                  <button onClick={descargarResultados} className="mt-3 px-4 py-2 rounded-xl text-xs font-bold"
                    style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#eee' }}>
                    ⬇ Descargar resultados (CSV)
                  </button>
                )}
                {fallos.length > 0 && (
                  <div className="mt-3 max-h-48 overflow-y-auto rounded-xl p-3 text-xs space-y-1" style={{ background: '#0a0a0a', border: '1px solid #1f1f1f' }}>
                    {fallos.slice(0, 60).map((f, i) => (
                      <div key={i} style={{ color: '#fca5a5' }}>📞 {f.tel} — {f.error}</div>
                    ))}
                    {fallos.length > 60 && <div style={{ color: '#777' }}>… y {fallos.length - 60} más (descargá el CSV).</div>}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-2xl p-4 text-sm" style={{ background: '#7f1d1d22', border: '1px solid #7f1d1d55', color: '#fca5a5' }}>{error}</div>
        )}
        {!cfg && <div className="text-center py-16 text-sm" style={{ color: '#666' }}>Consultando tu cuenta de WhatsApp…</div>}
      </div>
    </main>
  );
}
