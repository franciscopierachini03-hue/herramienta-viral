# ViralADN — Setup Guide

Una herramienta SaaS para descubrir contenido viral en TikTok / Instagram / YouTube y generar guiones inspirados en ese estilo. Built con **Next.js 16 + Supabase + Stripe + Resend + Apify + OpenAI**.

Esta guía te lleva de cero a producción. Calcula ~60-90 min la primera vez.

---

## 0. Requisitos previos

- **Node 20+** y **npm** instalados.
- Una cuenta de **GitHub** (para clonar y deployar).
- Tarjeta de crédito (varias APIs requieren tarjeta aunque tengan tier gratis).

---

## 1. Clonar el repo

```bash
unzip viraladn-template.zip
cd viraladn-template
npm install
cp .env.example .env.local
```

Abrí `.env.local` en tu editor. Vamos a completarlo de a poco mientras conectás cada servicio.

---

## 2. Supabase (DB + Auth)

1. Andá a **https://supabase.com** → New project.
2. Settings → API → copiá:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` (secret) → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ nunca exponer al cliente
3. SQL Editor → New query → pegá TODO el contenido de `supabase/schema.sql` → **Run**.
4. Auth → URL Configuration:
   - **Site URL**: `http://localhost:3000` (cambiarlo a tu dominio en prod)
   - **Redirect URLs**: agregá `http://localhost:3000/**` y `http://localhost:3000/auth/callback`

---

## 3. Resend (emails transaccionales)

1. **https://resend.com/signup** → registrate.
2. **Domains → Add Domain** → tu dominio (ej. `tudominio.com`).
3. Pegá los 3 records DNS (SPF + DKIM) en tu registrador (GoDaddy / Namecheap / Cloudflare). Verificá.
4. **API Keys → Create** → permisos "Sending access" → copiá:
   - `RESEND_API_KEY=re_xxx`
   - `RESEND_FROM="ViralADN <hola@tudominio.com>"`

*Si todavía no tenés dominio, podés usar `RESEND_FROM="ViralADN <onboarding@resend.dev>"` para probar local sin verificar nada.*

---

## 4. Stripe (pagos + suscripciones)

1. **https://dashboard.stripe.com** → registrate en modo Test.
2. **Developers → API keys** → copiá:
   - `STRIPE_PUBLISHABLE_KEY=pk_test_xxx`
   - `STRIPE_SECRET_KEY=sk_test_xxx`
3. **Products → Add product**:
   - Crear "ViralADN Pro" con 2 prices: mensual y anual.
   - Copiá los `price_id` → `STRIPE_PRICE_MONTHLY` y `STRIPE_PRICE_YEARLY`.
4. **Customer Portal** → Settings → activá cancelaciones e info de cliente.
5. **Webhooks** → Add endpoint:
   - URL: `https://TU_DOMINIO/api/webhook/stripe` (en local: usá `stripe listen` — ver más abajo).
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`.
   - Copiá el **Signing secret** → `STRIPE_WEBHOOK_SECRET=whsec_xxx`.

### Probar webhook en local
```bash
npm install -g stripe
stripe login
stripe listen --forward-to localhost:3000/api/webhook/stripe
# Te imprime un whsec_xxx temporal — pegalo en .env.local mientras desarrollás.
```

---

## 5. OpenAI (generación de guiones + scoring)

1. **https://platform.openai.com/api-keys** → Create.
2. Cargá $5 mínimo de crédito.
3. Copiá → `OPENAI_API_KEY=sk-xxx`

Modelos usados: `gpt-4o` (guiones), `gpt-4o-mini` (relevance scoring + vision).

---

## 6. Apify (scraping de TikTok + Instagram)

1. **https://console.apify.com/sign-up** → registrate (free tier: $5/mes).
2. Plan recomendado: **Starter ($29/mes)** si vas a tener tráfico real.
3. Settings → Integrations → copiá `API token` → `APIFY_TOKEN=apify_api_xxx`.
4. Actores que la app llama (se cargan automáticamente al usarse):
   - `apify/instagram-scraper`
   - `clockworks/tiktok-scraper`
   - `apify/instagram-hashtag-scraper`
   - `apify/instagram-reel-scraper`

---

## 7. YouTube Data API

1. **https://console.cloud.google.com** → New project.
2. APIs & Services → Enable APIs → buscar **YouTube Data API v3** → Enable.
3. Credentials → Create credentials → API key → restringilo a YouTube Data API.
4. Copiá → `YOUTUBE_API_KEY=AIzaSy_xxx`.

---

## 8. Supadata (transcripción)

1. **https://supadata.ai** → sign up.
2. Copiá API key → `SUPADATA_API_KEY=sd_xxx`.

Si usás otra alternativa (Whisper directo, AssemblyAI), tendrás que editar `app/api/transcribir/route.ts`.

---

## 9. Admin panel

En `.env.local`:

```
ADMIN_EMAILS=tu-email@gmail.com
ADMIN_PIN=4242
```

- `ADMIN_EMAILS`: emails que pueden entrar a `/admin` (coma-separados).
- `ADMIN_PIN`: PIN numérico que se pide cada vez que entrás al panel.

---

## 10. Códigos de invitación (opcional)

```
INVITE_CODES=BETA50,VIP:1h,EXPERT:5d,PRUEBA:15m
TRIAL_DAYS=5
```

- Cada código activa un trial sin pasar por Stripe.
- Formato: `NOMBRE` o `NOMBRE:DURACION` (`15m`, `2h`, `5d`).
- `TRIAL_DAYS=5` es la duración default si el código no trae duración propia.

---

## 11. Probar en local

```bash
npm run dev
```

Abrí http://localhost:3000:

1. Click "Crear cuenta" → completá email + contraseña → debe llegar código por mail.
2. Ingresá el código → te redirige a `/precios` (o `/app` si usaste invite code).
3. Probá hacer un checkout con tarjeta de prueba `4242 4242 4242 4242` (cualquier CVC, cualquier fecha futura).

Si algo falla:
- `npm run dev` muestra logs en consola.
- Supabase Dashboard → Logs → API para ver errores de DB.
- `/api/admin/env-status` (logueado como admin) muestra qué env vars están cargadas.

---

## 12. Deploy a Vercel

1. Subí el repo a GitHub.
2. **https://vercel.com/new** → Import del repo.
3. Framework: Next.js (auto-detect).
4. Environment Variables → pegá TODAS las de `.env.local` (sin las comillas).
   - Cambiá `NEXT_PUBLIC_APP_URL` a `https://tudominio.com` para Production.
   - Marcalas en Production + Preview.
5. Deploy.
6. Settings → Domains → Add → tu dominio. Vercel te da 2 records DNS (A y CNAME) → pegalos en tu registrador.
7. Volvé a Supabase → Auth → URL Configuration → cambiá Site URL y Redirect URLs al dominio nuevo.
8. Stripe Webhooks → editá el endpoint → cambiá a `https://tudominio.com/api/webhook/stripe`.

---

## Estructura del proyecto

```
app/
  api/
    auth/           # signup con código, login, reset password, redeem
    biblioteca/     # biblioteca de guiones del usuario + carpetas
    virales/        # búsqueda de virales multi-plataforma con IA
    transcribir/    # transcripción de videos
    guiones/        # generación de guiones con OpenAI
    checkout/       # Stripe checkout
    billing/portal/ # Stripe customer portal
    webhook/stripe/ # webhook handler
    admin/          # endpoints del panel admin
  app/              # /app dashboard principal
  admin/            # /admin panel (PIN protected)
  login/            # login + signup + reset password
  cuenta/           # /cuenta página del usuario
  precios/          # /precios página de planes
lib/
  email/resend.ts   # cliente Resend + templates
  stripe-admin.ts   # helpers de Stripe para admin
  supabase/         # clients de Supabase
supabase/
  schema.sql        # schema completo de DB
```

---

## Costos aproximados (mensual)

- **Supabase**: Free tier (hasta 500 MB DB + 50k MAU)
- **Vercel**: Free tier (Hobby) o Pro $20
- **Resend**: Free 3.000 emails/mes
- **Stripe**: 2.9% + $0.30 por transacción
- **OpenAI**: ~$10-50 según uso
- **Apify**: $29 plan Starter
- **YouTube API**: Gratis (10.000 units/día)
- **Supadata**: Pago por uso (~$0.005/minuto)

Total piso: **~$50-80/mes** con tráfico bajo.

---

## Customización rápida

- **Branding**: buscar y reemplazar "ViralADN" → tu nombre.
- **Dominio**: buscar y reemplazar "viraladn.com" → tu dominio.
- **Logo**: reemplazar `public/logo-mark.svg`.
- **Colores**: gradiente principal `linear-gradient(135deg, #7c3aed, #c13584)` en muchos archivos.
- **Trial default**: env var `TRIAL_DAYS=5`.

---

## ¿Problemas?

- **No llega el email**: verificá que el dominio esté `Verified` en Resend Dashboard.
- **Stripe webhook falla**: revisá que `STRIPE_WEBHOOK_SECRET` coincida con el endpoint actual.
- **Apify timeout**: subí el plan o reducí la cantidad de resultados en `/api/virales`.
- **No puedo entrar a /admin**: revisá que tu email esté en `ADMIN_EMAILS` y reiniciá `npm run dev`.

---

## Stack técnico

- **Next.js 16** App Router + Server Components
- **TypeScript** strict mode
- **Tailwind CSS** + inline styles
- **Supabase** Postgres + Auth
- **Stripe** Checkout + Customer Portal + Webhooks
- **Resend** transactional email
- **OpenAI GPT-4o + Vision**
- **Apify** scraping
- **Vercel** hosting + Edge functions

Made with care. Mucha suerte con tu app.
