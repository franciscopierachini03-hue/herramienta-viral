-- Voz clonada por usuario (ElevenLabs) para el "clon que habla" del /studio.
-- Correr UNA vez: Supabase → SQL Editor → New query → pegar → Run.
-- El server la lee/escribe con el service role (bypassa RLS). RLS ON sin
-- policies abiertas → nadie la toca desde el cliente.

create table if not exists public.voice_clones (
  email      text primary key,
  voice_id   text        not null,   -- id de la voz en ElevenLabs
  nombre     text,
  created_at timestamptz not null default now()
);

alter table public.voice_clones enable row level security;
