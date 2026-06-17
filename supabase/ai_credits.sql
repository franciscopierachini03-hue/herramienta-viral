-- Créditos de IA (Avatares / foto→video) por usuario.
-- Correr UNA vez en: Supabase → SQL Editor → New query → pegar → Run.
--
-- El server lee/escribe esta tabla con el service role (bypassa RLS). Dejamos
-- RLS habilitado SIN policies abiertas → nadie puede leer/escribir desde el
-- cliente con la anon key; solo el backend.

create table if not exists public.ai_credits (
  email      text primary key,
  balance    integer     not null default 0,
  period     text        not null default to_char(now(), 'YYYY-MM'),  -- mes del último refill
  updated_at timestamptz not null default now()
);

alter table public.ai_credits enable row level security;

-- (Opcional) índice por updated_at para reportes:
-- create index if not exists ai_credits_updated_idx on public.ai_credits (updated_at desc);
