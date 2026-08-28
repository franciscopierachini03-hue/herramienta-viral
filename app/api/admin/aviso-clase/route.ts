import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { createServiceClient } from '@/lib/supabase/server';
import { claseEnFecha } from '@/app/comunidad/clase-config';

// GET /api/admin/aviso-clase — aviso puntual a TODOS los miembros activos:
// "la clase de mañana arranca a las 8:00 AM" (cambio de horario puntual).
//   ?test=1            → manda SOLO al dueño (para ver el correo antes)
//   ?enviar=1          → manda a todos (con candado anti doble-clic por día)
//   ?hora=8:00%20AM    → hora a anunciar (default 8:00 AM)
//   ?force=1           → salta el candado (re-envío consciente)
// Solo admin logueado. Sin parámetros = muestra cuántos lo recibirían (dry).

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const OWNER = 'franciscopierachini03@gmail.com';
const APP = 'https://www.viraladn.com';

type ClaseInfo = ReturnType<typeof claseEnFecha>;

function emailMovida(hora: string, fechaTxt: string, C: ClaseInfo): { subject: string; html: string } {
  const subject = `📅 La clase de HOY se mueve para mañana (${hora})`;
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#0b0b10;padding:28px 14px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
<div style="max-width:520px;margin:0 auto;background:#101018;border:1px solid #23232e;border-radius:18px;padding:28px;">
  <div style="background:linear-gradient(90deg,#7c3aed,#ec4899);border-radius:8px;padding:8px 14px;display:inline-block;">
    <span style="color:#fff;font-weight:800;font-size:15px;">ViralADN</span>
  </div>
  <h1 style="margin:18px 0 8px;font-size:25px;color:#fff;">📅 La clase de hoy se mueve para MAÑANA</h1>
  <p style="margin:0 0 16px;font-size:15px;color:#c8c8d4;line-height:1.55;">
    Cambio de último momento: <b style="color:#fff;">${C.nombre}</b> no será hoy.
    Nos vemos <b style="color:#fcd34d;font-size:17px;">${fechaTxt} a las ${hora} (hora CDMX)</b>.
    Misma sala, mismo link — solo cambia el día. ¡Agendalo!
  </p>
  <div style="background:#0b0b10;border:1px solid #23232e;border-radius:14px;padding:16px;margin:0 0 18px;">
    <p style="margin:0 0 6px;font-size:13px;color:#9a9aa6;">📍 Sala: <b style="color:#fff;">${C.sala}</b></p>
    <p style="margin:0 0 6px;font-size:13px;color:#9a9aa6;">ID: <b style="color:#fff;font-family:monospace;">${C.zoomId}</b> · Código: <b style="color:#fff;font-family:monospace;">${C.zoomCodigo}</b></p>
  </div>
  <a href="${C.zoomUrl}" style="display:block;text-align:center;background:linear-gradient(90deg,#7c3aed,#ec4899);color:#fff;font-weight:800;font-size:16px;padding:14px;border-radius:12px;text-decoration:none;">
    👉 Guardar el link de la clase
  </a>
  <p style="margin:16px 0 0;font-size:12px;color:#6a6a76;">Perdón por el cambio y gracias por entender. El acceso está siempre en <a href="${APP}/comunidad" style="color:#fcd34d;">viraladn.com/comunidad</a>.</p>
</div>
</body></html>`;
  return { subject, html };
}

// 🔴 "YA EMPEZAMOS" — se manda con la clase EN VIVO. Nada de agendar: un solo
// botón grande para entrar ahora mismo.
function emailEnVivo(C: ClaseInfo): { subject: string; html: string } {
  const subject = `🔴 Ya empezamos — entrá a la clase ahora`;
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#0b0b10;padding:28px 14px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
<div style="max-width:520px;margin:0 auto;background:#101018;border:1px solid #23232e;border-radius:18px;padding:28px;">
  <div style="background:linear-gradient(90deg,#7c3aed,#ec4899);border-radius:8px;padding:8px 14px;display:inline-block;">
    <span style="color:#fff;font-weight:800;font-size:15px;">ViralADN</span>
  </div>
  <div style="margin:18px 0 0;display:inline-block;background:#7f1d1d55;border:1px solid #ef4444;border-radius:999px;padding:5px 12px;">
    <span style="color:#fca5a5;font-weight:800;font-size:12px;letter-spacing:1px;">● EN VIVO AHORA</span>
  </div>
  <h1 style="margin:12px 0 8px;font-size:27px;color:#fff;line-height:1.2;">Ya arrancamos ${C.nombre}</h1>
  <p style="margin:0 0 18px;font-size:16px;color:#c8c8d4;line-height:1.55;">
    Estamos adentro revisando cuentas. <b style="color:#fff;">Entrá ahora</b> — todavía llegás a la parte buena.
  </p>
  <a href="${APP}/comunidad" style="display:block;text-align:center;background:linear-gradient(90deg,#7c3aed,#ec4899);color:#fff;font-weight:800;font-size:18px;padding:17px;border-radius:14px;text-decoration:none;">
    🔴 ENTRAR A LA CLASE
  </a>
  <p style="margin:10px 0 0;font-size:13px;color:#9a9aa6;text-align:center;">
    Te lleva a <b style="color:#c8c8d4;">viraladn.com/comunidad</b>, donde el link <b style="color:#fff;">siempre</b> está actualizado.
  </p>
  <div style="background:#0b0b10;border:1px solid #23232e;border-radius:14px;padding:16px;margin:18px 0 0;">
    <p style="margin:0 0 8px;font-size:12px;color:#6a6a76;">¿Preferís entrar directo a Zoom?</p>
    <p style="margin:0 0 6px;font-size:13px;color:#9a9aa6;">📍 Sala: <b style="color:#fff;">${C.sala}</b></p>
    <p style="margin:0 0 10px;font-size:13px;color:#9a9aa6;">ID: <b style="color:#fff;font-family:monospace;">${C.zoomId}</b> · Código: <b style="color:#fff;font-family:monospace;">${C.zoomCodigo}</b></p>
    <a href="${C.zoomUrl}" style="font-size:13px;color:#fcd34d;">Abrir Zoom directamente →</a>
  </div>
  <p style="margin:16px 0 0;font-size:12px;color:#6a6a76;">Guardá <a href="${APP}/comunidad" style="color:#fcd34d;">viraladn.com/comunidad</a> en favoritos: si cambiamos de sala, ahí siempre está la buena.</p>
</div>
</body></html>`;
  return { subject, html };
}

// 📅 "LA CLASE SE MUEVE AL VIERNES" — no es que se cae: se corre para que
// puedan estar en algo más grande el mismo día.
function emailViernes(C: ClaseInfo, dia: string, evento: string): { subject: string; html: string } {
  const subject = `📅 La clase del miércoles se mueve al ${dia}`;
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#0b0b10;padding:28px 14px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
<div style="max-width:520px;margin:0 auto;background:#101018;border:1px solid #23232e;border-radius:18px;padding:28px;">
  <div style="background:linear-gradient(90deg,#7c3aed,#ec4899);border-radius:8px;padding:8px 14px;display:inline-block;">
    <span style="color:#fff;font-weight:800;font-size:15px;">ViralADN</span>
  </div>

  <h1 style="margin:20px 0 10px;font-size:27px;line-height:1.2;color:#fff;">
    La clase del miércoles se mueve al <span style="color:#fcd34d;">${dia}</span>
  </h1>

  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#c8c8d4;">
    Y te conviene. La corremos para que puedas estar en
    <b style="color:#fff;">${evento}</b> sin tener que elegir entre las dos cosas.
  </p>

  <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#c8c8d4;">
    No te pierdas ninguna: <b style="color:#fff;">${C.nombre}</b> te espera el ${dia}, misma sala y mismo link de siempre.
  </p>

  <div style="background:#0a1a12;border:1px solid #22c55e55;border-radius:14px;padding:18px;margin:0 0 20px;">
    <p style="margin:0 0 4px;font-size:12px;color:#7dd3a8;letter-spacing:1px;font-weight:800;">NUEVA FECHA</p>
    <p style="margin:0 0 12px;font-size:21px;font-weight:800;color:#fff;">${dia.charAt(0).toUpperCase() + dia.slice(1)} · ${C.horaCDMX}</p>
    <p style="margin:0;font-size:13px;line-height:1.8;color:#9a9aa6;">
      🇲🇽 10:00 AM Ciudad de México &nbsp;·&nbsp; 🇺🇸 9:00 AM Los Ángeles<br>
      🇨🇴🇵🇪 11:00 AM Colombia / Perú &nbsp;·&nbsp; 🇨🇱🇻🇪 12:00 PM Chile / Miami<br>
      🇦🇷🇧🇷 1:00 PM Argentina / Brasil
    </p>
  </div>

  <a href="${C.zoomUrl}" style="display:block;text-align:center;background:linear-gradient(90deg,#7c3aed,#ec4899);color:#fff;font-weight:800;font-size:17px;padding:16px;border-radius:14px;text-decoration:none;">
    📅 GUARDAR EL LINK DE LA CLASE
  </a>

  <p style="margin:14px 0 0;font-size:12px;color:#6a6a76;text-align:center;">
    ${C.sala} · ID <span style="font-family:monospace;color:#9a9aa6;">${C.zoomId}</span> · Código <span style="font-family:monospace;color:#9a9aa6;">${C.zoomCodigo}</span>
  </p>

  <p style="margin:22px 0 0;padding-top:18px;border-top:1px solid #23232e;font-size:14px;line-height:1.7;color:#8b8b96;">
    Nos vemos el ${dia},<br><b style="color:#c8c8d4;">Francisco</b>
  </p>
</div>
</body></html>`;
  return { subject, html };
}

function emailHtml(hora: string, fechaTxt: string, C: ClaseInfo): { subject: string; html: string } {
  const subject = `🕗 Cambio de horario: la clase de mañana es a las ${hora}`;
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#0b0b10;padding:28px 14px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
<div style="max-width:520px;margin:0 auto;background:#101018;border:1px solid #23232e;border-radius:18px;padding:28px;">
  <div style="background:linear-gradient(90deg,#7c3aed,#ec4899);border-radius:8px;padding:8px 14px;display:inline-block;">
    <span style="color:#fff;font-weight:800;font-size:15px;">ViralADN</span>
  </div>
  <h1 style="margin:18px 0 8px;font-size:25px;color:#fff;">🕗 ¡Ojo! Mañana la clase arranca más temprano</h1>
  <p style="margin:0 0 16px;font-size:15px;color:#c8c8d4;line-height:1.55;">
    <b style="color:#fff;">${fechaTxt}</b> la clase <b style="color:#fff;">${C.nombre}</b> comienza a las
    <b style="color:#fcd34d;font-size:18px;">${hora} (hora CDMX)</b> — más temprano que de costumbre. ¡Agendalo para no perdértela!
  </p>
  <div style="background:#0b0b10;border:1px solid #23232e;border-radius:14px;padding:16px;margin:0 0 18px;">
    <p style="margin:0 0 6px;font-size:13px;color:#9a9aa6;">📍 Sala: <b style="color:#fff;">${C.sala}</b></p>
    <p style="margin:0 0 6px;font-size:13px;color:#9a9aa6;">ID: <b style="color:#fff;font-family:monospace;">${C.zoomId}</b> · Código: <b style="color:#fff;font-family:monospace;">${C.zoomCodigo}</b></p>
  </div>
  <a href="${C.zoomUrl}" style="display:block;text-align:center;background:linear-gradient(90deg,#7c3aed,#ec4899);color:#fff;font-weight:800;font-size:16px;padding:14px;border-radius:12px;text-decoration:none;">
    👉 Entrar a la clase (${hora})
  </a>
  <p style="margin:16px 0 0;font-size:12px;color:#6a6a76;">El acceso también está siempre en <a href="${APP}/comunidad" style="color:#fcd34d;">viraladn.com/comunidad</a>.</p>
</div>
</body></html>`;
  return { subject, html };
}

async function enviar(emails: string[], subject: string, html: string): Promise<{ enviados: number; fallidos: number }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { enviados: 0, fallidos: emails.length };
  const from = process.env.RESEND_FROM || 'ViralADN <hola@viraladn.com>';
  let enviados = 0, fallidos = 0;
  for (let i = 0; i < emails.length; i += 90) {
    const chunk = emails.slice(i, i + 90);
    const payload = chunk.map(to => ({ from, to: [to], subject, html }));
    try {
      const r = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (r.ok) enviados += chunk.length;
      else { fallidos += chunk.length; console.error('[aviso-clase] batch', r.status, await r.text().catch(() => '')); }
    } catch { fallidos += chunk.length; }
  }
  return { enviados, fallidos };
}

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const hora = (sp.get('hora') || '8:00 AM').slice(0, 20);
  const test = sp.get('test') === '1';
  const mandar = sp.get('enviar') === '1';
  const force = sp.get('force') === '1';

  // "Mañana" en CDMX, con nombre de día legible.
  const manana = new Date(Date.now() + 24 * 3600 * 1000);
  const fechaTxt = 'Mañana ' + new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', weekday: 'long', day: 'numeric', month: 'long' }).format(manana);
  const mananaCDMX = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(manana);
  const hoyCDMX = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  // ?tipo=envivo → "ya empezamos" (clase de HOY) · movida → se pasa a mañana ·
  // default → cambio de horario de mañana.
  const tipo = sp.get('tipo') || '';
  const enVivo = tipo === 'envivo';
  // El aviso EN VIVO usa la clase de HOY; los otros, la de mañana.
  const C = claseEnFecha(enVivo ? hoyCDMX : mananaCDMX);
  const horaFinal = C.esEspecial ? C.horaCDMX : hora;
  const fechaManana = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', weekday: 'long', day: 'numeric', month: 'long' }).format(manana);
  // ?tipo=viernes → la clase del miércoles se corre al viernes.
  //   &dia=viernes%2028%20de%20agosto   &evento=IA Business Builder de Spencer Hoffmann
  const alViernes = tipo === 'viernes';
  const diaNuevo = (sp.get('dia') || 'viernes').slice(0, 60);
  const evento = (sp.get('evento') || 'el IA Business Builder de Spencer Hoffmann').slice(0, 120);

  const { subject, html } = alViernes
    ? emailViernes(C, diaNuevo, evento)
    : enVivo
      ? emailEnVivo(C)
      : tipo === 'movida'
        ? emailMovida(sp.get('hora') || C.horaCDMX, `mañana ${fechaManana}`, C)
        : emailHtml(horaFinal, fechaTxt, C);
  const resumen = alViernes ? `se mueve al ${diaNuevo} · ${C.horaCDMX} · por ${evento}`
    : enVivo ? `EN VIVO · ${C.sala} · ID ${C.zoomId}`
    : fechaTxt + ' · ' + horaFinal;

  const sb = createServiceClient();
  const { data } = await sb.from('profiles')
    .select('email, subscription_status')
    .in('subscription_status', ['active', 'trialing']);
  let emails = [...new Set((data || []).map(p => (p.email || '').toLowerCase()).filter(e => e.includes('@')))];

  // ?solo=pagan → únicamente quienes tienen un cobro registrado en el libro.
  // Hay ~247 cuentas con acceso pero solo ~46 pagaron: el resto son cortesías,
  // códigos y activaciones a mano. Para Francisco "usuario activo" es el que
  // PAGA, así que este filtro existe para poder respetarlo sin adivinar.
  // El libro cubre desde ene-2026 (y ene→may quedaron verificados en cero), o
  // sea que tiene TODOS los cobros del negocio: nadie que haya pagado queda
  // afuera por un hueco de datos.
  const universo = emails.length;
  if (sp.get('solo') === 'pagan') {
    const pagaron = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const { data: c } = await sb.from('cobros_viraladn')
        .select('email').eq('excluir', false).not('email', 'is', null)
        .range(i * 1000, i * 1000 + 999);
      if (!c || !c.length) break;
      for (const f of c) pagaron.add(String(f.email).toLowerCase());
      if (c.length < 1000) break;
    }
    emails = emails.filter(e => pagaron.has(e));
  }

  if (test) {
    const r = await enviar([OWNER], `[PRUEBA] ${subject}`, html);
    return Response.json({ modo: 'test', para: OWNER, ...r, aviso: resumen, zoom: C.zoomUrl });
  }

  if (!mandar) {
    return Response.json({
      modo: 'dry', recibirian: emails.length,
      grupo: sp.get('solo') === 'pagan'
        ? 'SOLO los que pagaron (tienen cobro en el libro)'
        : 'todos los que tienen acceso — incluye cortesías y códigos',
      con_acceso_en_total: universo,
      aviso: resumen,
      sala: C.sala, zoomId: C.zoomId, zoom: C.zoomUrl,
      siguiente: 'agregá &test=1 para verlo vos, o &enviar=1 para mandarlo a todos',
    });
  }

  // Candado anti doble-clic: 1 envío por día (marca en ai_credits si existe).
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  const marca = `aviso:clase-${tipo || 'horario'}`;
  if (!force) {
    try {
      const { data: m } = await sb.from('ai_credits').select('period').eq('email', marca).maybeSingle();
      if (m?.period === hoy) {
        return Response.json({ modo: 'bloqueado', motivo: `Ya se envió hoy (${hoy}). Agregá &force=1 para re-enviar conscientemente.` });
      }
    } catch { /* sin tabla → sin candado */ }
  }
  try {
    await sb.from('ai_credits').upsert({ email: marca, balance: 0, period: hoy, updated_at: new Date().toISOString() }, { onConflict: 'email' });
  } catch { /* best-effort */ }

  const r = await enviar(emails, subject, html);
  console.log(`[aviso-clase] enviado a ${r.enviados} miembros (${resumen})`);
  return Response.json({ modo: 'enviado', destinatarios: emails.length, ...r, aviso: resumen, zoom: C.zoomUrl });
}
