import { Resend } from 'resend';

// Cliente Resend reutilizable. Se inicializa lazy para que falle solo en uso.
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

// Genera código numérico de 6 dígitos.
export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── Templates ──────────────────────────────────────────────────────────

function shellEmail(opts: { title: string; preheader: string; body: string }): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>${opts.title}</title></head>
<body style="margin:0;padding:0;background:#080808;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e5e5;">
<span style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${opts.preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:linear-gradient(145deg,#141414,#0d0d0d);border:1px solid #1f1f1f;border-radius:24px;padding:32px;">
      <tr><td>
        <div style="font-size:20px;font-weight:800;background:linear-gradient(135deg,#7c3aed,#c13584);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:24px;">ViralADN</div>
        ${opts.body}
        <div style="margin-top:32px;padding-top:24px;border-top:1px solid #1f1f1f;font-size:11px;color:#666;line-height:1.6;">
          Si no pediste esto, ignorá este correo. Tu cuenta sigue segura.<br/>
          ViralADN · <a href="https://viraladn.com" style="color:#888;">viraladn.com</a>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

function codeBlock(code: string): string {
  return `<div style="background:#0a0a0a;border:1px solid #7c3aed55;border-radius:16px;padding:24px;text-align:center;margin:24px 0;">
    <div style="font-size:11px;color:#888;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:12px;">Tu código</div>
    <div style="font-size:36px;font-weight:800;letter-spacing:0.3em;color:#fff;font-family:monospace;">${code}</div>
    <div style="font-size:11px;color:#666;margin-top:12px;">Vence en 15 minutos</div>
  </div>`;
}

// ── API pública ────────────────────────────────────────────────────────

export async function sendVerificationCode(email: string, code: string, name?: string) {
  const greet = name ? `Hola ${name},` : 'Hola,';
  const body = `
    <h1 style="font-size:22px;color:#fff;margin:0 0 12px;">Confirmá tu correo</h1>
    <p style="font-size:14px;color:#aaa;line-height:1.6;margin:0 0 8px;">${greet}</p>
    <p style="font-size:14px;color:#aaa;line-height:1.6;margin:0;">Usá este código para confirmar tu cuenta de ViralADN:</p>
    ${codeBlock(code)}
    <p style="font-size:13px;color:#888;line-height:1.6;margin:0;">Ingresalo en la pantalla donde lo solicitaste para terminar de crear tu cuenta.</p>
  `;
  const html = shellEmail({
    title: 'Tu código de ViralADN',
    preheader: `Tu código es ${code}. Vence en 15 minutos.`,
    body,
  });
  return client().emails.send({
    from: from(),
    to: email,
    subject: `Tu código de ViralADN: ${code}`,
    html,
  });
}

export async function sendPasswordResetCode(email: string, code: string) {
  const body = `
    <h1 style="font-size:22px;color:#fff;margin:0 0 12px;">Recuperá tu contraseña</h1>
    <p style="font-size:14px;color:#aaa;line-height:1.6;margin:0;">Pediste cambiar la contraseña de tu cuenta. Usá este código para confirmar que sos vos:</p>
    ${codeBlock(code)}
    <p style="font-size:13px;color:#888;line-height:1.6;margin:0;">Si no pediste esto, podés ignorar el correo — nadie podrá acceder sin el código.</p>
  `;
  const html = shellEmail({
    title: 'Recuperá tu contraseña',
    preheader: `Tu código de recuperación es ${code}.`,
    body,
  });
  return client().emails.send({
    from: from(),
    to: email,
    subject: `Código para recuperar tu contraseña: ${code}`,
    html,
  });
}
