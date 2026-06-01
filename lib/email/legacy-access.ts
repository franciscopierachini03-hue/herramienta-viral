import { Resend } from 'resend';

// Envío del correo de acceso Legacy (el branded con el código de descuento que
// la persona pone en el checkout de Stripe). Mismo diseño que email-legacy.html,
// parametrizado por código. Lo usa /api/admin/send-access para envíos masivos.

let _client: Resend | null = null;
function client(): Resend {
  if (_client) return _client;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY no configurado');
  _client = new Resend(key);
  return _client;
}
function from(): string {
  return process.env.RESEND_FROM || 'ViralADN <hola@viraladn.com>';
}

const PRECIOS_URL = 'https://www.viraladn.com/precios';

// HTML del correo de acceso, con el código inyectado.
export function legacyAccessHtml(code: string): string {
  const c = (code || '').trim();
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Tu acceso a ViralADN</title></head>
<body style="margin:0;padding:0;background-color:#080808;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Tu primer mes gratis en ViralADN. Usá tu código en el checkout.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#080808;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td align="center" style="background-color:#7c3aed;background-image:linear-gradient(135deg,#7c3aed,#c13584);border-radius:20px 20px 0 0;padding:40px 30px 32px;">
    <div style="font-size:30px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">ViralADN</div>
    <div style="font-size:13px;color:#f0e6ff;margin-top:6px;">Encontrá lo viral. Creá contenido que explota.</div>
  </td></tr>

  <tr><td style="background-color:#0f0f0f;padding:36px 32px 8px;border-left:1px solid #1f1f1f;border-right:1px solid #1f1f1f;">
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#ffffff;line-height:1.3;">Tu primer mes es gratis 🚀</h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#bbbbbb;">Como parte de la comunidad <strong style="color:#ffffff;">Legacy</strong>, te damos acceso completo a <strong style="color:#c4b5fd;">ViralADN</strong> — la herramienta que usan los creadores para encontrar el contenido más viral de YouTube, TikTok e Instagram y convertirlo en guiones listos para grabar.</p>
    <p style="margin:0;font-size:15px;line-height:1.65;color:#bbbbbb;">Con tu código exclusivo, el <strong style="color:#ffffff;">primer mes te sale $0</strong>. Cancelás cuando quieras antes de que termine — sin compromiso.</p>
  </td></tr>

  <tr><td style="background-color:#0f0f0f;padding:28px 32px;border-left:1px solid #1f1f1f;border-right:1px solid #1f1f1f;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:18px;box-shadow:0 8px 30px rgba(124,58,237,0.35);"><tr><td align="center" style="padding:30px 20px;">
      <div style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#7c3aed;margin-bottom:16px;">🎟️ Tu código de descuento</div>
      <div style="font-size:40px;line-height:1.1;font-weight:800;color:#1a0a2e;letter-spacing:2px;font-family:Arial,Helvetica,sans-serif;">${c}</div>
      <div style="display:inline-block;margin-top:18px;background-color:#22c55e;color:#ffffff;font-size:13px;font-weight:700;padding:8px 18px;border-radius:999px;">✅ Primer mes gratis · un solo uso</div>
    </td></tr></table>
  </td></tr>

  <tr><td style="background-color:#0f0f0f;padding:16px 32px 8px;border-left:1px solid #1f1f1f;border-right:1px solid #1f1f1f;">
    <h2 style="margin:0 0 6px;font-size:18px;font-weight:700;color:#ffffff;">Cómo activar tu acceso</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#888888;">Te toma menos de 2 minutos.</p>
  </td></tr>

  ${stepRow('1', 'Entrá a los planes', `Abrí <a href="${PRECIOS_URL}" style="color:#c4b5fd;text-decoration:underline;">viraladn.com/precios</a> desde el botón de abajo.`)}
  ${stepRow('2', 'Elegí el plan Mensual', `Tocá <strong style="color:#ffffff;">&ldquo;Empezar por $47/mes&rdquo;</strong>. Te lleva al checkout seguro de Stripe.`)}
  ${stepRow('3', 'Aplicá tu código', `En el checkout tocá <span style="color:#c4b5fd;font-weight:700;">&ldquo;Añadir código de promoción&rdquo;</span> y escribí <strong style="color:#c4b5fd;">${c}</strong>. El total del primer mes pasa a <strong style="color:#22c55e;">$0</strong>.`)}
  ${stepRow('4', 'Completá y entrá', `Cargás tus datos (el primer mes es <strong style="color:#22c55e;">$0</strong>), creás tu cuenta y entrás a la herramienta. Listo.`, '#22c55e')}

  <tr><td align="center" style="background-color:#0f0f0f;padding:8px 32px 36px;border-left:1px solid #1f1f1f;border-right:1px solid #1f1f1f;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="background-color:#7c3aed;background-image:linear-gradient(135deg,#7c3aed,#c13584);border-radius:14px;">
      <a href="${PRECIOS_URL}" target="_blank" style="display:inline-block;padding:16px 44px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Activar mi primer mes gratis →</a>
    </td></tr></table>
  </td></tr>

  <tr><td align="center" style="background-color:#0a0a0a;padding:26px 32px;border:1px solid #1f1f1f;border-top:none;border-radius:0 0 20px 20px;">
    <p style="margin:0 0 6px;font-size:13px;color:#888888;">¿Dudas? Respondé este correo y te ayudamos.</p>
    <p style="margin:0;font-size:11px;color:#555555;">© 2026 ViralADN · Hecho para creadores que toman en serio su crecimiento</p>
  </td></tr>

</table></td></tr></table></body></html>`;
}

function stepRow(n: string, title: string, desc: string, dotColor = '#7c3aed'): string {
  return `<tr><td style="background-color:#0f0f0f;padding:0 32px 16px;border-left:1px solid #1f1f1f;border-right:1px solid #1f1f1f;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="40" valign="top"><div style="width:30px;height:30px;background-color:${dotColor};border-radius:50%;color:#ffffff;font-weight:700;font-size:14px;text-align:center;line-height:30px;">${n}</div></td>
      <td valign="top" style="padding-left:8px;">
        <div style="font-size:15px;font-weight:600;color:#ffffff;margin-bottom:3px;">${title}</div>
        <div style="font-size:14px;color:#aaaaaa;line-height:1.55;">${desc}</div>
      </td>
    </tr></table>
  </td></tr>`;
}

const SUBJECT = 'Tu acceso a ViralADN — primer mes gratis 🎟️';

// Envía el correo de acceso a UN email. Devuelve el resultado de Resend.
export async function sendLegacyAccessEmail(email: string, code: string) {
  return client().emails.send({
    from: from(),
    to: email,
    subject: SUBJECT,
    html: legacyAccessHtml(code),
  });
}

// Envío masivo: manda el mismo correo (con el código dado) a muchos emails.
// Usa el endpoint batch de Resend (hasta 100 por llamada) para evitar el
// rate limit. Devuelve cuántos se enviaron y los errores por lote.
export async function sendLegacyAccessBatch(
  emails: string[],
  code: string,
): Promise<{ sent: number; errors: string[] }> {
  const html = legacyAccessHtml(code);
  const fromAddr = from();
  const CHUNK = 100;
  let sent = 0;
  const errors: string[] = [];

  for (let i = 0; i < emails.length; i += CHUNK) {
    const chunk = emails.slice(i, i + CHUNK);
    try {
      const res = await client().batch.send(
        chunk.map(to => ({ from: fromAddr, to, subject: SUBJECT, html })),
      );
      // Resend devuelve { data, error }. Si error → todo el lote falló.
      if ((res as { error?: { message?: string } | null })?.error) {
        errors.push((res as { error: { message?: string } }).error.message || 'error de Resend');
      } else {
        sent += chunk.length;
      }
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  return { sent, errors };
}
