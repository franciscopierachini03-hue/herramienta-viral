# ViralADN — Pitch Deck

**El motor de inteligencia viral para creators y emprendedores.**

> *"Buscar contenido viral hoy es como buscar agua en el desierto con un palito. Nosotros traemos un satélite."*

---

## 1. El problema

Cada día se publican **~95M videos cortos** entre TikTok, Instagram Reels y YouTube Shorts. El 99% es ruido. Los creators y emprendedores pierden **horas diarias** buscando referencias virales con valor real para crear contenido que funcione.

Las herramientas existentes:
- ❌ Solo cubren una plataforma
- ❌ No filtran por calidad — devuelven memes, dance challenges y clickbait
- ❌ No hablan inglés ni portugués (mercado global ignorado)
- ❌ Cobran $99–$499/mes por dashboards genéricos

---

## 2. La solución — ViralADN

Un buscador unificado de **YouTube + TikTok + Instagram** con una capa de IA curatorial que separa el oro del ruido.

### Stack técnico clave
```
TikWM (gratis, ilimitado)  ──┐
Serper / Google Search   ────┼──→  ~2,500 candidatos crudos
YouTube Data API v3      ────┤
instagram-looter2 (RapidAPI)─┘
                              ↓
                    Filtros tradicionales
                    (likes ≥ 500, blacklist, tema en título)
                              ↓
                    GPT-4o-mini curator
                    (escala 0-10, multilingual ES/EN/PT,
                     prompt entrenado con ejemplos)
                              ↓
                    Round-robin balanceado por idioma
                              ↓
                    Top 100 por plataforma — ORO PURO
```

### Diferenciadores
1. **3 plataformas, 1 búsqueda** — no existe esto en el mercado
2. **IA curadora multilingüe** — separa "tip aplicable" de "POV: cuando…"
3. **Transcripción + traducción + biblioteca** integradas — pipeline completo de creator
4. **Sub-3 minutos** por búsqueda exhaustiva (~2,500 candidatos evaluados)

---

## 3. Estructura de costos — 10,000 usuarios mensuales

**Asunción de uso por usuario/mes:** 3 búsquedas virales + 2 transcripciones + 1 traducción.
Total mensual: **30K búsquedas, 20K transcripciones, 10K traducciones**.

| # | Servicio | Función | Volumen | Costo/mes |
|---|---|---|---|---|
| 1 | OpenAI GPT-4o-mini | Expansión keywords + scoring IA + traducción | ~400M tokens | $100 |
| 2 | Serper.dev | Google Search para IG/YT | ~360K queries | $350 |
| 3 | YouTube Data API v3 | Stats + búsqueda YouTube | ~6M units (cuota gratuita ampliada) | $0 |
| 4 | TikWM | TikTok search + metadata | Ilimitado | $0 |
| 5 | instagram-looter2 (RapidAPI) | Engagement real de reels | 1.5M calls | $225 |
| 6 | Groq Whisper Large V3 | Transcripción de audio | 333 horas | $13 |
| 7 | Supadata | YouTube transcripts directos | 20K transcripts | $25 |
| 8 | Apify (fallback) | Scrapers nativos IG/TikTok | ~2K runs | $25 |
| 9 | Vercel Pro | Hosting + serverless | 1,500 GB-Hrs execution | $60 |
| 10 | Dominio | franpierachini.com | Anual | $1.25 |
| 11 | Resend (email transaccional) | Notificaciones, magic links | ~5K emails | $20 |
|  | **TOTAL** |  |  | **~$820/mes** |

### Costo unitario
- **Por usuario:** $0.082/mes
- **Por búsqueda:** $0.027
- **Por transcripción:** $0.04
- **Por traducción:** $0.01

---

## 4. Modelos de precio — Variaciones a probar

### Modelo A — Freemium clásico ⭐ (recomendado)
| Tier | Precio | Búsquedas | Transcripciones | Biblioteca |
|---|---|---|---|---|
| Free | $0 | 5/mes | 3/mes | 5 guiones |
| Pro | **$9/mes** | Ilimitadas | 50/mes | Ilimitada |
| Studio | **$29/mes** | Ilimitadas | 200/mes | + traducción + topcut |

**Conversión esperada:** 8% free → Pro, 1.5% free → Studio.

### Modelo B — Solo paid (más simple, menos volumen)
| Tier | Precio |
|---|---|
| Starter | **$15/mes** — todo incluido, 100 búsquedas/mes |
| Pro | **$39/mes** — ilimitado |

### Modelo C — Pay-as-you-go (creators ocasionales)
- $1.50 por búsqueda
- $2 por transcripción
- $5 paquete de 5 búsquedas + 5 transcripciones

### Modelo D — Anual con descuento
- Pro anual: $79/año (vs $108 si mensual) → ahorro 27%, retención brutal

---

## 5. Proyección de ingresos — Modelo A (Freemium)

### Escenario base: 10K usuarios activos
| Tier | Usuarios | Conversión | Ingreso/mes |
|---|---|---|---|
| Free | 9,050 | 90.5% | $0 |
| Pro ($9) | 800 | 8% | $7,200 |
| Studio ($29) | 150 | 1.5% | $4,350 |
| **MRR total** |  |  | **$11,550** |

**Ganancia neta:** $11,550 − $820 = **$10,730/mes** (margen 92.9%)

### Escenarios alternativos

| Usuarios | MRR | Costos | Neto | Margen |
|---|---|---|---|---|
| 1K | $1,155 | $120 | $1,035 | 89.6% |
| 10K | $11,550 | $820 | $10,730 | 92.9% |
| 50K | $57,750 | $3,500 | $54,250 | 93.9% |
| 100K | $115,500 | $6,400 | $109,100 | 94.5% |
| 500K | $577,500 | $28,000 | $549,500 | 95.2% |
| 1M | $1,155,000 | $52,000 | $1,103,000 | 95.5% |

> **Las economías de escala juegan a nuestro favor** — más usuarios = más caché compartido = costo marginal cae.

---

## 6. Variaciones de precio — Sensibilidad

### ¿Qué pasa si cambiamos el precio Pro?

| Precio Pro | Conversión esperada | Pro users (de 10K) | Ingreso Pro |
|---|---|---|---|
| $5 | 12% | 1,200 | $6,000 |
| $7 | 10% | 1,000 | $7,000 |
| **$9** ⭐ | **8%** | **800** | **$7,200** |
| $12 | 6% | 600 | $7,200 |
| $15 | 4% | 400 | $6,000 |
| $19 | 2.5% | 250 | $4,750 |

**Punto óptimo: $9–$12.** Más bajo deja dinero en la mesa, más alto pierde volumen.

### ¿Y si solo es paid (Modelo B)?
| Tier | Conversión esperada | Usuarios | MRR |
|---|---|---|---|
| Starter $15 | 3% | 300 | $4,500 |
| Pro $39 | 0.8% | 80 | $3,120 |
| **Total** |  | **380** | **$7,620** |

Menos MRR pero también **menos costo variable** (~$300/mes en lugar de $820), porque no hay free users consumiendo.

**Neto Modelo B: $7,320/mes** — peor que Modelo A pero más simple.

---

## 7. Roadmap de monetización

### Mes 1–2: Validación
- Lanzar con Modelo A (Free + Pro $9)
- Medir: % activación, retención día 7/30, NPS
- A/B test precio Pro: $7 vs $9 vs $12

### Mes 3–4: Expansión
- Lanzar Studio $29 con: traducción ilimitada, TopCut, equipos
- Anuncio en Twitter/IG con cohorte beta cerrada
- Programa de afiliados 30% recurrente

### Mes 5–6: Escala
- Plan equipos $79/mes (5 seats)
- API pública $99/mes (5K búsquedas) — para agencias
- Whitelabel $499/mes — para grandes marcas

### Mes 7+: Vertical expansion
- ViralADN para Marketing — análisis de competidores
- ViralADN para Educadores — bibliotecas curadas
- Mobile app (PWA primero, nativo después)

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| TikTok bloquea TikWM | Media | Alto | Apify + scraping propio como fallback |
| RapidAPI sube precios | Baja | Medio | Migrar a Apify scraper directo (más barato a volumen) |
| OpenAI sube precios | Baja | Bajo | Migrar a Groq Llama-3 (10× más barato, calidad ~90%) |
| Vercel se queda corto | Alta a 100K+ | Medio | Migrar a Railway/Fly.io con docker, ~50% menos costo |
| Competidor copia (VidIQ, etc.) | Alta | Medio | Velocidad de iteración + comunidad + marca |

---

## 9. Pedido — Lo que hace falta

### Capital semilla: $30,000 USD
**Distribución:**
- $5K — 6 meses de costos operativos a 10K usuarios
- $10K — Marketing inicial (anuncios, creators)
- $5K — Infraestructura de pagos (Stripe), legal, contabilidad
- $10K — Buffer + contratación de 1 freelance ingeniero

### Métricas a 6 meses
- 25,000 usuarios activos mensuales
- $25,000 MRR
- 92%+ margen bruto
- NPS > 50

### A 18 meses
- 250,000 usuarios activos
- $250,000 MRR / **$3M ARR**
- Equipo de 5 personas
- Listos para Series A

---

## 10. ¿Por qué ahora?

1. **Costo de IA bajó 50× en 18 meses** — lo que era impagable hoy es trivial
2. **Creator economy = $250B en 2027** — y crece 22% anual
3. **TikTok + Reels + Shorts = consolidación de formato** — el ganador se queda con todo
4. **Anthropic + OpenAI + Groq = APIs commodity** — la diferenciación es el producto, no el modelo

---

## 11. La visión a 5 años

> **No es un buscador de videos. Es la capa de inteligencia que define qué se vuelve viral.**

Imaginá un creator que abre ViralADN, escribe su tema, recibe **100 referencias curadas en 3 idiomas, transcripciones, guion adaptado, y publica en 4 plataformas** — todo en 10 minutos.

A los 5 años:
- 5M usuarios activos
- $50M ARR
- API consumida por TikTok, Meta, YouTube como **señal de calidad**
- Adquisición potencial por Adobe, Canva o Meta — valuación 10-15× ARR = **$500M-750M**

---

**Next step:** ejecución. La tecnología funciona, los costos están claros, el mercado está caliente.

> *"The first step is to establish that something is possible; then probability will occur."* — Elon Musk

**Hecho.** Toca escalar.

---

*Última actualización: 26 abril 2026 · Francisco Pierachini · ViralADN*
