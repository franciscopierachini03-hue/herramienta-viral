-- 🧬 Cliente ideal + palabras clave guardadas por usuario (ViralADN).
-- El usuario define su CLIENTE IDEAL una sola vez, genera sus palabras clave y
-- las GUARDA para no rehacer el proceso cada vez que entra. Una fila por usuario.
--
-- Correr UNA vez: Supabase → SQL Editor → New query → pegar → Run.
-- El server lee/escribe con el service role (bypassa RLS). RLS ON sin policies
-- abiertas → nadie la toca desde el cliente; todo el acceso pasa por /api/nicho.

create table if not exists public.nicho_usuario (
  user_id       uuid        primary key references auth.users(id) on delete cascade,
  cliente_ideal text,                                     -- descripción del cliente ideal
  palabras      jsonb       not null default '[]'::jsonb, -- ["palabra 1","palabra 2", ...]
  updated_at    timestamptz not null default now()
);

alter table public.nicho_usuario enable row level security;
