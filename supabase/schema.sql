-- ════════════════════════════════════════════════════════════════
-- ViralADN — Schema completo para Supabase
-- ════════════════════════════════════════════════════════════════
-- Cómo usar:
--   1. Crear un proyecto en https://supabase.com
--   2. Supabase Dashboard → SQL Editor → New query
--   3. Pegar TODO este archivo → Run
--   4. Listo. Las 4 tablas + índices + extensiones quedan creadas.
--
-- Auth: este schema asume que Supabase Auth está habilitado
-- (viene por default). No creamos `auth.users` — Supabase lo hace solo.
-- ════════════════════════════════════════════════════════════════

-- Extensión para generar uuids
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────────────────────────
-- profiles — datos extendidos del usuario + estado de suscripción
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                    text NOT NULL UNIQUE,
  name                     text,
  phone                    text,

  -- Stripe
  stripe_customer_id       text,
  stripe_subscription_id   text,
  subscription_status      text DEFAULT 'pending',
  activated_at             timestamptz,
  cancelled_at             timestamptz,
  renews_at                timestamptz,

  -- Trial / códigos
  trial_ends_at            timestamptz,
  redeemed_code            text,

  -- Email verification (signup con código de 6 dígitos)
  email_verified           boolean DEFAULT false,
  pending_code             text,
  pending_code_expires_at  timestamptz,
  pending_code_attempts    int DEFAULT 0,
  pending_code_purpose     text,  -- 'signup' | 'reset'

  -- Timestamps
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (email);
CREATE INDEX IF NOT EXISTS profiles_stripe_customer_idx ON public.profiles (stripe_customer_id);

-- Trigger para mantener updated_at al día
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- ────────────────────────────────────────────────────────────────
-- guion_folders — carpetas para organizar la biblioteca
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guion_folders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email  text NOT NULL,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guion_folders_user_email_idx ON public.guion_folders (user_email);


-- ────────────────────────────────────────────────────────────────
-- guiones — biblioteca de transcripciones guardadas por el usuario
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guiones (
  id          text PRIMARY KEY,        -- generado en el cliente (timestamp string)
  user_email  text NOT NULL,
  name        text NOT NULL,
  url         text NOT NULL,
  platform    text NOT NULL,           -- 'youtube' | 'tiktok' | 'instagram' | 'unknown'
  transcript  text NOT NULL,
  saved_at    timestamptz NOT NULL DEFAULT now(),
  folder_id   uuid REFERENCES public.guion_folders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS guiones_user_email_idx ON public.guiones (user_email);
CREATE INDEX IF NOT EXISTS guiones_folder_id_idx ON public.guiones (folder_id);
CREATE INDEX IF NOT EXISTS guiones_saved_at_idx ON public.guiones (saved_at DESC);


-- ────────────────────────────────────────────────────────────────
-- viral_cache — cache de búsquedas de videos virales (24h TTL)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.viral_cache (
  cache_key   text PRIMARY KEY,        -- hash de (tema + platform)
  tema        text NOT NULL,
  platform    text NOT NULL,           -- 'youtube' | 'tiktok' | 'instagram'
  videos      jsonb NOT NULL,
  fetched_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS viral_cache_fetched_at_idx ON public.viral_cache (fetched_at);


-- ════════════════════════════════════════════════════════════════
-- Row Level Security (opcional pero recomendado)
-- ════════════════════════════════════════════════════════════════
-- La app usa el service_role en el server, así que RLS no es
-- estrictamente necesario, pero lo activamos por defensa.
-- Si querés, descomentá las policies de abajo.

-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.guion_folders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.guiones ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY profiles_own ON public.profiles
--   FOR ALL USING (auth.jwt() ->> 'email' = email);
-- CREATE POLICY folders_own ON public.guion_folders
--   FOR ALL USING (auth.jwt() ->> 'email' = user_email);
-- CREATE POLICY guiones_own ON public.guiones
--   FOR ALL USING (auth.jwt() ->> 'email' = user_email);


-- ════════════════════════════════════════════════════════════════
-- Listo. La app ya puede leer/escribir en estas tablas
-- usando el service_role key (SUPABASE_SERVICE_ROLE_KEY en .env).
-- ════════════════════════════════════════════════════════════════
