import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 15;

// Configura estas dos variables en tu .env.local (y en producción):
//   EXMA_GS_URL=https://script.google.com/macros/s/AKfycbx.../exec
//   EXMA_GS_SECRET=EL_MISMO_SECRETO_QUE_PUSISTE_EN_APPS_SCRIPT

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, countryCode, phone } = await req.json();

    if (!name || !email || !phone) {
      return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
    }

    const url = process.env.EXMA_GS_URL;
    const secret = process.env.EXMA_GS_SECRET;
    if (!url || !secret) {
      return NextResponse.json({ ok: false, error: 'server_not_configured' }, { status: 500 });
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        name: String(name).slice(0, 120),
        email: String(email).slice(0, 200),
        countryCode: String(countryCode || '').slice(0, 8),
        phone: String(phone).slice(0, 40),
      }),
      // Apps Script redirects; follow them
      redirect: 'follow',
    });

    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Apps Script sometimes returns HTML on errors
    }

    if (!res.ok || (parsed as { ok?: boolean } | null)?.ok !== true) {
      return NextResponse.json(
        { ok: false, error: 'upstream_error' },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('exma-register error', err);
    return NextResponse.json({ ok: false, error: 'unknown' }, { status: 500 });
  }
}
