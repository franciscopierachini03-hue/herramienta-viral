import { NextRequest, NextResponse } from 'next/server';

// POST /api/admin/pin { pin }
//
// Si el PIN coincide con ADMIN_PIN, setea una cookie de sesión que vale por
// 4 horas y redirige a /admin. Si no, manda a /admin?wrong=1.
//
// La cookie es httpOnly + secure + sameSite=lax — no la puede leer JS y
// solo viaja por HTTPS. Vive 4 horas, después tenés que volver a poner el PIN.

const COOKIE_NAME = 'admin_pin_ok';
const COOKIE_MAX_AGE = 4 * 60 * 60; // 4 horas en segundos

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const pin = String(formData.get('pin') || '').trim();
  const expected = (process.env.ADMIN_PIN || '').trim();

  // Fail-closed: si no hay PIN configurado, nadie pasa.
  if (!expected) {
    return NextResponse.redirect(new URL('/admin?wrong=noconfig', req.url), 303);
  }

  if (pin !== expected) {
    return NextResponse.redirect(new URL('/admin?wrong=1', req.url), 303);
  }

  const res = NextResponse.redirect(new URL('/admin', req.url), 303);
  res.cookies.set(COOKIE_NAME, '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
