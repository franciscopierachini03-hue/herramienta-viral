-- Registros del formulario (/registro).
-- Correr UNA vez en: Supabase → SQL Editor → New query → pegar → Run.
-- Mientras no exista, los registros igual te llegan por correo (Resend). Con la
-- tabla, además quedan guardados para exportar/seguir.

create table if not exists public.registros (
  id          uuid        primary key default gen_random_uuid(),
  nombre      text        not null,
  apellido    text,
  telefono    text,
  correo      text        not null,
  seguidores  text,
  objetivo    text,
  oferta      text,
  created_at  timestamptz not null default now()
);

-- El server escribe con service role (bypassa RLS). Sin policies abiertas →
-- nadie lee/escribe desde el cliente con la anon key.
alter table public.registros enable row level security;
