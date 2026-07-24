-- 🎬 Clon de IA v2: video base por usuario (arquitectura lipsync).
-- El clon ya no anima una foto: la persona sube UN video selfie (30-60s) una
-- sola vez, y cada reel solo le sincroniza la boca con su voz clonada
-- (fal LatentSync ≈ $0.30/min vs $3-7/min de los avatares generativos).
--
-- Correr UNA vez: Supabase → SQL Editor → New query → pegar → Run.

-- 1) Columna para guardar el video base del clon (en la tabla de voces,
--    una fila por usuario). Nullable: puede subir el video antes que la voz.
alter table public.voice_clones add column if not exists base_video_url text;

-- 2) La voz ya no es obligatoria para tener fila (puede cargar primero el video).
alter table public.voice_clones alter column voice_id drop not null;

-- ── Almacenamiento del VIDEO BASE ────────────────────────────────────────────
-- Además del SQL, creá el bucket para los videos base:
--   Supabase → Storage → New bucket → nombre exacto: clones → marcá "Public".
-- (El navegador sube directo con URL firmada; el server solo firma. Tope de
--  archivo del plan Free de Supabase: 50 MB → la UI limita a 45 MB.)
