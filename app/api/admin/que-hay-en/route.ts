import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { cobrosRango, type CobroRango } from '@/lib/ventas-stripe';

// GET /api/admin/que-hay-en?mes=YYYY-MM — QUÉ hay de verdad en la cuenta ese mes.
//
// Para cuando un mes da CERO tuyo y no se entiende por qué. Agrupa TODOS los
// cobros del mes por producto de Stripe y muestra los montos, para poder
// reconocer a simple vista si un producto NUESTRO está cayendo como ajeno
// (ej. un plan viejo cuyo producto no está en la lista del código).
//
// No escribe nada. Solo mira.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  const q = (req.nextUrl.searchParams.get('mes') || '').trim();
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit' }).format(new Date());
  const mes = /^\d{4}-\d{2}$/.test(q) ? q : hoy;
  const [y, m] = mes.split('-').map(Number);
  const desde = Math.floor(Date.UTC(y, m - 1, 1, 6, 0, 0) / 1000);
  const hasta = Math.floor(Date.UTC(y, m, 1, 6, 0, 0) / 1000);

  try {
    const { cobros } = await cobrosRango(desde, hasta);
    const ok = cobros.filter(c => c.estado === 'succeeded' && c.cuenta === '2CLICKS');

    // Agrupamos por producto de Stripe. El nombre lo resolvemos después, solo
    // para los grupos que importan (no gastamos consultas en los chicos).
    type Grupo = { productoId: string; cobros: number; usd: number; montos: Record<string, number>; nuestro: boolean; ejemplo: string };
    const grupos = new Map<string, Grupo>();
    for (const c of ok) {
      const k = c.productoId || (c.suscripcion ? '(factura sin producto)' : '(pago suelto, sin factura)');
      const g = grupos.get(k) || { productoId: k, cobros: 0, usd: 0, montos: {}, nuestro: c.viralAdn, ejemplo: c.email };
      g.cobros++;
      g.usd = r2(g.usd + c.monto - c.refund);
      const etiqueta = `$${Math.round(c.montoOriginal)} ${c.monedaOriginal}`;
      g.montos[etiqueta] = (g.montos[etiqueta] || 0) + 1;
      if (c.viralAdn) g.nuestro = true;
      grupos.set(k, g);
    }

    const lista = [...grupos.values()].sort((a, b) => b.usd - a.usd).slice(0, 25);

    // Nombre legible de cada producto (una consulta por grupo, máx 25).
    const key = process.env.STRIPE_SECRET_KEY!;
    const nombres = await Promise.all(lista.map(async g => {
      if (!g.productoId.startsWith('prod_')) return g.productoId;
      try {
        const r = await fetch(`https://api.stripe.com/v1/products/${g.productoId}`, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
        if (!r.ok) return g.productoId;
        const p = await r.json();
        return `${p.name || g.productoId}`;
      } catch { return g.productoId; }
    }));

    const sum = (arr: CobroRango[]) => r2(arr.reduce((a, c) => a + c.monto - c.refund, 0));

    return Response.json({
      mes,
      resumen: {
        cobros_en_la_cuenta: ok.length,
        tuyos: ok.filter(c => c.viralAdn).length,
        tuyos_usd: sum(ok.filter(c => c.viralAdn)),
        ajenos: ok.filter(c => !c.viralAdn).length,
        ajenos_usd: sum(ok.filter(c => !c.viralAdn)),
      },
      instruccion: 'Si reconocés un producto TUYO marcado ❌ AJENO, abrí su "marcar_como_mio" y el panel lo empieza a contar. Pasa sobre todo con las ligas de pago creadas a mano en Stripe: cada una crea un producto nuevo que el código no conoce.',
      productos: lista.map((g, i) => ({
        producto: nombres[i],
        producto_id: g.productoId,
        cuenta_como: g.nuestro ? '✅ TUYO' : '❌ AJENO',
        cobros: g.cobros,
        usd: g.usd,
        precios: Object.entries(g.montos).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([p, n]) => `${p} ×${n}`),
        un_email: g.ejemplo,
        // Enlace listo para marcarlo como tuyo (solo para los que no lo son).
        marcar_como_mio: g.nuestro || !g.productoId.startsWith('prod_') ? undefined
          : `https://www.viraladn.com/api/admin/marcar-producto?id=${g.productoId}&plataforma=viraladn`,
      })),
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
