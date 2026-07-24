import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { createServiceClient } from '@/lib/supabase/server';
import { getBaseVideo, saveBaseVideo } from '@/lib/voice-store';

// VIDEO BASE del clon (arquitectura lipsync) — se sube UNA vez.
//   GET                → { url }  (el video base del usuario, si ya lo subió)
//   POST { nombre }    → { bucket, path, token, publicUrl }  (firma la subida
//                        directa navegador → Storage; el archivo pesa más de lo
//                        que acepta el body de Vercel, por eso va directo)
//   PATCH { url }      → guarda el publicUrl como video base del usuario.
// Solo admin (el Studio sigue cerrado a clientes).

export const dynamic = 'force-dynamic';

const BUCKET = 'clones';

export async function GET() {
  const { email, admin } = await getAccess();
  if (!email) return Response.json({ error: 'No autorizado' }, { status: 401 });
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });
  const { url, faltaSql } = await getBaseVideo(email);
  return Response.json({ url, faltaSql });
}

export async function POST(req: NextRequest) {
  const { email, admin } = await getAccess();
  if (!email) return Response.json({ error: 'No autorizado' }, { status: 401 });
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const limpio = String(body?.nombre || 'clon.mp4')
    .normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(-80) || 'clon.mp4';
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `${email.replace(/[^\w.@-]+/g, '_')}/${rand}_${limpio}`;

  try {
    const sb = createServiceClient();
    const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      const msg = /not found|does not exist|bucket/i.test(error?.message || '')
        ? `Falta crear el bucket "${BUCKET}" en Supabase → Storage (marcalo Public).`
        : (error?.message || 'No se pudo preparar la subida.');
      return Response.json({ error: msg }, { status: 400 });
    }
    const publicUrl = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return Response.json({ ok: true, bucket: BUCKET, path, token: data.token, publicUrl });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}

export async function PATCH(req: NextRequest) {
  const { email, admin } = await getAccess();
  if (!email) return Response.json({ error: 'No autorizado' }, { status: 401 });
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const url = String(body?.url || '').trim();
  // Solo aceptamos URLs de NUESTRO storage público (bucket clones).
  const prefijo = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
  if (!url.startsWith(prefijo)) return Response.json({ error: 'URL de video inválida.' }, { status: 400 });

  const { ok, faltaSql } = await saveBaseVideo(email, url);
  if (faltaSql) return Response.json({ error: 'Falta correr supabase/clon_video.sql en Supabase (1 min).' }, { status: 503 });
  if (!ok) return Response.json({ error: 'No se pudo guardar el video.' }, { status: 502 });
  return Response.json({ ok: true, url });
}
