-- ═══════════════════════════════════════════════════════════════════════════
--  LIBRO DE COBROS DE VIRALADN  ·  correr UNA vez
--  Supabase → SQL Editor → New query → pegar todo → Run
-- ═══════════════════════════════════════════════════════════════════════════
--
--  QUÉ ES: una fila por cada cobro que entra a TU bolsillo. Es la fuente del
--  panel de facturación. Hoy el panel le pregunta a Stripe en vivo "¿cuánto
--  gané?" y tiene que adivinar cuál plata es tuya dentro de una cuenta donde
--  el 96% del movimiento es de otros negocios. Por eso el número se movía.
--
--  Con este libro:
--    · el panel lee de acá (instantáneo, siempre el mismo número)
--    · queda registrado POR QUÉ se contó cada cobro y con cuánta certeza
--    · podés excluir un cobro a mano cuando ninguna regla lo puede saber
--    · los meses cerrados dejan de moverse
--
--  Correrlo de nuevo no rompe nada (todo es "if not exists").
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.cobros_viraladn (
  -- El id del cobro en Stripe es la llave: el mismo cobro nunca entra dos veces.
  charge_id       text        primary key,
  ts              timestamptz not null,          -- momento exacto del cobro
  fecha           date        not null,          -- día en hora CDMX (para agrupar por mes)

  -- QUIÉN
  email           text,
  nombre          text,
  customer_id     text,
  suscripcion_id  text,

  -- QUÉ SE VENDIÓ. Sale del checkout que creamos nosotros — no se adivina.
  producto        text        not null default 'otro',  -- viraladn | topcut | combo | evento | otro
  ciclo           text,                                  -- mensual | trimestral | anual | unico

  -- LA PLATA, toda en USD ya liquidado (lo que Stripe convierte y deposita).
  bruto_usd       numeric(12,2) not null default 0,
  reembolsado_usd numeric(12,2) not null default 0,
  comision_usd    numeric(12,2) not null default 0,
  -- Lo que de verdad te queda. Se calcula solo: nunca puede quedar desfasado.
  neto_usd        numeric(12,2) generated always as
                    (bruto_usd - reembolsado_usd - comision_usd) stored,

  -- Lo que pagó la persona en SU moneda (para entender un cobro raro).
  moneda_origen   text,
  monto_origen    numeric(12,2),

  -- DE DÓNDE SALE EL DATO y cuánto podemos confiar en él.
  cuenta          text        not null default '2CLICKS',
  origen          text        not null default 'webhook', -- webhook | backfill | manual
  certeza         text        not null default 'checkout',-- checkout (seguro) | producto | metadata | monto
  estado          text,                                   -- succeeded | refunded | disputed

  -- LA VÁLVULA MANUAL: para lo que ninguna regla puede saber.
  -- excluir = true → el cobro existe pero NO suma a tus ingresos.
  excluir         boolean     not null default false,
  nota            text,

  actualizado_at  timestamptz not null default now()
);

-- Buscar por mes y por producto tiene que ser instantáneo.
create index if not exists cobros_viraladn_fecha_idx    on public.cobros_viraladn (fecha desc);
create index if not exists cobros_viraladn_producto_idx on public.cobros_viraladn (producto);
create index if not exists cobros_viraladn_email_idx    on public.cobros_viraladn (lower(email));

-- Solo el servidor escribe (service role, que se saltea RLS). Sin políticas
-- abiertas, nadie puede leer ni escribir desde el navegador.
alter table public.cobros_viraladn enable row level security;


-- ── MESES CERRADOS ─────────────────────────────────────────────────────────
-- Un mes cerrado no se vuelve a tocar. Es lo que hace que julio no diga
-- $2.256 un día y $2.088 al otro.
create table if not exists public.meses_cerrados (
  mes         text        primary key,        -- '2026-07'
  neto_usd    numeric(12,2) not null,
  cobros      integer     not null,
  cerrado_at  timestamptz not null default now(),
  nota        text
);

alter table public.meses_cerrados enable row level security;
