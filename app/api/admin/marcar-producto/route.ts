import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { createServiceClient } from '@/lib/supabase/server';

// GET /api/admin/marcar-producto?id=prod_XXX&plataforma=viraladn
//   → declara que ese producto de Stripe es TUYO. El panel lo empieza a contar
//     en menos de un minuto, sin deploy.
//
//   &quitar=1   → lo saca de la lista (si te equivocaste)
//   sin params  → muestra los que ya marcaste
//
// Existe porque cada liga de pago creada a mano en Stripe genera un producto
// nuevo que el código no conoce: esa venta entra a tu banco pero no al panel.

export const dynamic = 'force-dynamic';

const PLATAFORMAS = ['viraladn', 'topcut', 'combo'];

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const id = (sp.get('id') || '').trim();
  const plataforma = (sp.get('plataforma') || 'viraladn').trim().toLowerCase();
  const quitar = sp.get('quitar') === '1';
  const sb = createServiceClient();

  // Sin parámetros: la lista actual.
  if (!id) {
    const { data, error } = await sb.from('productos_viraladn').select('*').order('agregado_at', { ascending: false });
    if (error) {
      return Response.json({
        error: 'Falta crear la tabla. Corré supabase/productos.sql en Supabase → SQL Editor.',
        detalle: error.message.slice(0, 160),
      }, { status: 503 });
    }
    return Response.json({
      marcados: (data || []).length,
      productos: data || [],
      como_agregar: '/api/admin/marcar-producto?id=prod_XXX&plataforma=viraladn|topcut|combo',
      como_encontrarlos: '/api/admin/que-hay-en?mes=2026-04',
    });
  }

  if (!id.startsWith('prod_')) {
    return Response.json({ error: 'El id tiene que empezar con prod_ (lo saca /api/admin/que-hay-en).' }, { status: 400 });
  }

  if (quitar) {
    const { error } = await sb.from('productos_viraladn').delete().eq('producto_id', id);
    if (error) return Response.json({ error: error.message.slice(0, 160) }, { status: 502 });
    return Response.json({ ok: true, quitado: id, nota: 'El panel deja de contarlo en menos de 1 minuto. Volvé a sincronizar el mes para que el libro se actualice.' });
  }

  if (!PLATAFORMAS.includes(plataforma)) {
    return Response.json({ error: `plataforma tiene que ser: ${PLATAFORMAS.join(' | ')}` }, { status: 400 });
  }

  // Nombre legible del producto, para reconocerlo después en la lista.
  let nombre: string | null = null;
  try {
    const r = await fetch(`https://api.stripe.com/v1/products/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }, cache: 'no-store',
    });
    if (r.ok) nombre = (await r.json())?.name || null;
    else if (r.status === 404) {
      return Response.json({ error: `Stripe no conoce ese producto (${id}). Revisá el id.` }, { status: 400 });
    }
  } catch { /* seguimos sin nombre */ }

  const { error } = await sb.from('productos_viraladn')
    .upsert({ producto_id: id, plataforma, nombre }, { onConflict: 'producto_id' });
  if (error) {
    return Response.json({
      error: 'No se pudo guardar. ¿Corriste supabase/productos.sql?',
      detalle: error.message.slice(0, 160),
    }, { status: 503 });
  }

  return Response.json({
    ok: true,
    marcado: { producto_id: id, nombre, plataforma },
    siguiente: `Ahora sincronizá los meses donde vendiste con este producto: /api/admin/sincronizar-cobros?desde=2026-04&hasta=2026-08`,
  });
}
