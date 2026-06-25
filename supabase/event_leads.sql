-- Leads de eventos de conversión (landing /evento).
-- Correr UNA vez en: Supabase → SQL Editor → New query → pegar → Run.
-- Mientras no exista, los registros igual te llegan por mail (Resend). Con la
-- tabla, además quedan guardados para exportar/seguir.

create table if not exists public.event_leads (
  id         uuid        primary key default gen_random_uuid(),
  name       text,
  email      text        not null,
  phone      text,
  event      text        not null default 'masterclass-viraladn',
  created_at timestamptz not null default now()
);

-- El server escribe con service role (bypassa RLS). Sin policies abiertas →
-- nadie lee/escribe desde el cliente con la anon key.
alter table public.event_leads enable row level security;

-- (Opcional) evitar duplicados del mismo email en el mismo evento:
-- create unique index if not exists event_leads_email_event_idx on public.event_leads (email, event);
