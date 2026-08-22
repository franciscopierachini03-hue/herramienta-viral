-- ═══════════════════════════════════════════════════════════════════════════
--  PRODUCTOS TUYOS  ·  correr UNA vez  ·  Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════════════
--
--  EL PROBLEMA QUE RESUELVE: hasta ahora, la lista de "qué productos son de
--  ViralADN" vivía dentro del código. Cada vez que creás una liga de pago a
--  mano en Stripe, ese producto es nuevo → el código no lo conoce → esa venta
--  entra a tu banco pero NO aparece en el panel. Y hay que esperar un deploy
--  para arreglarlo.
--
--  Con esta tabla la lista pasa a ser tuya: marcás un producto como tuyo desde
--  el navegador y el panel lo cuenta al instante, sin tocar código.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.productos_viraladn (
  producto_id text primary key,          -- prod_… de Stripe
  plataforma  text not null,             -- viraladn | topcut | combo
  nombre      text,                      -- nombre legible, para reconocerlo
  nota        text,
  agregado_at timestamptz not null default now()
);

alter table public.productos_viraladn enable row level security;
