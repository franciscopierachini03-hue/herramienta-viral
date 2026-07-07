-- Libro de pagos de ViralADN — lo alimenta el webhook de Stripe.
-- Correr UNA vez en: Supabase → SQL Editor → New query → pegar → Run.
--
-- Guarda cada movimiento (venta, renovación, reembolso, disputa, fallo,
-- cancelación) con el producto clasificado → /admin/pagos lo muestra y
-- los avisos por email salen del webhook.

create table if not exists public.pagos_viraladn (
  id          uuid        primary key default gen_random_uuid(),
  evento_id   text        unique,          -- id del evento de Stripe (idempotencia)
  tipo        text        not null,        -- venta | renovacion | reembolso | disputa | disputa_cerrada | fallo_pago | cancelacion
  email       text,
  customer_id text,
  producto    text,                        -- viraladn | topcut | combo | legacy47 | otro
  monto       numeric,                     -- en USD
  moneda      text        default 'usd',
  estado      text,
  detalle     text,
  created_at  timestamptz not null default now()
);

create index if not exists pagos_viraladn_created_idx on public.pagos_viraladn (created_at desc);
create index if not exists pagos_viraladn_tipo_idx on public.pagos_viraladn (tipo);

-- El server escribe con service role (bypassa RLS). Sin policies abiertas →
-- nadie lee/escribe desde el cliente con la anon key.
alter table public.pagos_viraladn enable row level security;
