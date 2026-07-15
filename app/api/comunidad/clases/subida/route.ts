import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { firmarSubida } from '@/lib/clases-store';

// Firma una subida directa navegador → Supabase Storage para un archivo de
// clase (PDF, slides, etc.). Solo admin. El navegador hace PUT a signedUrl con
// el archivo y guarda publicUrl en la clase.
//   POST { nombre } → { bucket, path, token, publicUrl }  (subir con uploadToSignedUrl)

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const nombre = String(body?.nombre || '').trim();
  if (!nombre) return Response.json({ error: 'Falta el nombre del archivo.' }, { status: 400 });
  const r = await firmarSubida(nombre);
  if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
  return Response.json({ ok: true, bucket: r.bucket, path: r.path, token: r.token, publicUrl: r.publicUrl });
}
