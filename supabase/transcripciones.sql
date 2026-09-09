-- ═══════════════════════════════════════════════════════════════════════════
--  TRANSCRIPCIONES QUE FALLARON  ·  correr UNA vez
--  Supabase → SQL Editor → New query → pegar todo → Run
-- ═══════════════════════════════════════════════════════════════════════════
--
--  QUÉ ES: una fila cada vez que alguien pide una transcripción y NO sale.
--
--  POR QUÉ HACE FALTA: hasta ahora los éxitos se guardaban en
--  transcription_log y los fallos no se guardaban en ningún lado — el motivo
--  se escribía en la consola de Vercel, que borra los registros en una hora.
--  Resultado: sabíamos que "hay problemas con las transcripciones" pero no
--  cuántos, ni de qué plataforma, ni por qué. Sin este dato no se puede
--  arreglar nada, solo adivinar.
--
--  POR QUÉ EN TABLA APARTE Y NO EN transcription_log: el cupo diario de cada
--  persona se calcula contando filas de ese log. Si los fallos entraran ahí, a
--  quien le falla el sistema le cobraríamos el intento fallido.
--
--  LA COLUMNA QUE IMPORTA es traza: dice qué motor se probó, en qué orden,
--  qué contestó cada uno y cuánto tardó. Por ejemplo:
--     descarga: ✓ 0.9 MB (206ms) · groq/whisper-large-v3: ✗ HTTP 401 …
--     · openai/gpt-4o-mini-transcribe: ✓ 1335 caracteres (4289ms)
--
--  Correrlo de nuevo no rompe nada (todo es "if not exists").
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.transcripciones_fallidas (
  id          bigserial   primary key,
  creado_at   timestamptz not null default now(),
  user_email  text,                              -- null = no había sesión
  platform    text        not null,              -- youtube · instagram · tiktok · facebook
  video_url   text,
  status      int         not null,              -- el HTTP que vio la persona
  mensaje     text,                              -- lo que se le mostró en pantalla
  traza       text,                              -- qué se probó y qué contestó cada motor
  ms          int                                -- cuánto tardó antes de rendirse
);

-- Para las dos preguntas que se hacen siempre: "¿qué está fallando ahora?" y
-- "¿esta plataforma está peor que antes?".
create index if not exists idx_transcripciones_fallidas_fecha
  on public.transcripciones_fallidas (creado_at desc);
create index if not exists idx_transcripciones_fallidas_plataforma
  on public.transcripciones_fallidas (platform, creado_at desc);

-- Nadie entra a esta tabla desde el navegador: solo la escribe el servidor con
-- la llave de servicio, y solo la lee el panel de admin (que también va por el
-- servidor). Con RLS activo y sin políticas, queda cerrada para todos los demás.
alter table public.transcripciones_fallidas enable row level security;

-- ═══════════════════════════════════════════════════════════════════════════
--  Después de correr esto, en /admin/costos aparece el bloque de fallos.
--  Si algo se rompe otra vez, ahí se ve el motivo exacto el mismo día.
-- ═══════════════════════════════════════════════════════════════════════════
