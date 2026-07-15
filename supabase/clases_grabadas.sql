-- 🎓 Biblioteca de clases grabadas de /comunidad (el "classroom").
-- Correr UNA vez: Supabase → SQL Editor → New query → pegar → Run.
-- El server lee/escribe con el service role (bypassa RLS). RLS ON sin policies
-- abiertas → nadie la toca desde el cliente; el acceso pasa por /api (gateado).

create table if not exists public.clases_grabadas (
  fecha      date        not null,            -- fecha de la clase
  titulo     text        not null,
  resumen    text,                            -- de qué se trató (el resumencito)
  video_url  text,                            -- link YouTube "Oculto"/Vimeo (se embebe)
  archivos   jsonb       not null default '[]'::jsonb,  -- [{ "nombre": "...", "url": "..." }]
  id         uuid        primary key default gen_random_uuid(),
  creado     timestamptz not null default now()
);

create index if not exists clases_grabadas_fecha_idx on public.clases_grabadas (fecha desc);

alter table public.clases_grabadas enable row level security;

-- ── Almacenamiento de ARCHIVOS ────────────────────────────────────────────────
-- Además del SQL de arriba, creá el bucket para los archivos de las clases:
--   Supabase → Storage → New bucket → nombre exacto: clases → marcá "Public".
-- (Los videos NO van acá: se suben a YouTube "Oculto" y se pega el link.)
