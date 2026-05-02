import { NextRequest } from 'next/server';

export const maxDuration = 300; // 5 minutos — Vercel Pro

// ── Cache ─────────────────────────────────────────────────────────────────────
type CacheEntry = { videos: unknown[]; ts: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 6 * 60 * 60 * 1000;
function getCached(k: string): unknown[] | null {
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { cache.delete(k); return null; }
  return e.videos;
}
function setCached(k: string, v: unknown[]) { cache.set(k, { videos: v, ts: Date.now() }); }

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: string | number | undefined): string {
  if (!n) return '0';
  const num = typeof n === 'string' ? parseInt(n) : n;
  if (isNaN(num)) return '0';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000)     return (num / 1_000).toFixed(0) + 'K';
  return num.toLocaleString('es');
}
function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 9999;
  return parseInt(m[1]||'0')*3600 + parseInt(m[2]||'0')*60 + parseInt(m[3]||'0');
}
function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}
function stripTags(t: string) {
  return t.replace(/#\S+/g,'').replace(/\s+/g,' ').trim();
}

// ── Blacklist ─────────────────────────────────────────────────────────────────
const BLACKLIST = [
  // Humor / entretenimiento sin valor replicable
  'funny','prank','pranks','fail','fails','meme','memes','humor','comedy',
  'gracioso','chistoso','chiste','broma','jajaja','lol','hilarious','roast',
  'comedia','cómico','comico','humorista','sketche','sketch',
  'pov:','me when','nobody:','npc','when you',
  // Música
  'song','lyrics','letra','remix','beat','lyric video','music video',
  'cancion','canción','video oficial','(video oficial)','official video',
  'exito viral','éxito viral','mix exito','mix exitos','exitos 202',
  'nueva cancion','nuevo sencillo','álbum musical',
  // Entretenimiento masivo
  'bollywood','movie','film','telenovela','netflix','trailer','actor','actress',
  'challenge','viral dance','baile viral','dance challenge',
  'compilation','compilación','recopilación','best moments','reaction','react',
  // Gaming
  'gaming','gameplay','gamer','minecraft','fortnite','roblox','valorant',
  // Nicho sin valor para creators
  'asmr','mukbang','tiktok compilation','shorts compilation',
  // Contexto escolar / infantil (no replicable para negocios/contenido)
  'maestra','maestro','profesora','profesor','alumno','alumnos',
  'escuela','colegio','salón de clases','classroom','teacher telling',
  'niños','niñas','kinder','preescolar','primaria','secundaria',
  'school business','school kid','school girl','school boy',
  // Música explícita (riddim, feat., prod. son señales de track musical)
  'riddim','(feat.','prod.','official audio','official video','music video',
  'happy papi','mind my business','minding my own',
  // Remakes / parodies / memes de video
  'remake','parody','parodia','gente de megocios','gente de negocios 😂',
  // Emojis de risa en el TÍTULO indican contenido cómico no replicable
  '😂','🤣','💀','😹','💩',
  // Contenido de productos / lifestyle sin valor replicable
  'batom','maquiagem','maquillaje','sucesso de venda','suceso de venta',
  'receita','receta de','cocina facil','faz sucesso',
  'guru','indian guru','spiritual',
  // Canciones infantiles / bebés
  'cancion del','bebe','bebé','potty','popo','popó','baño bebe',
];

// ── Patrones de PROMO disfrazada ──────────────────────────────────────────────
// Reels/videos que en vez de enseñar, venden cursos, mentorías o productos.
// Detectamos en el título/caption — si hay 2+ matches, descartamos.
const PROMO_PATTERNS = [
  // Cursos/academias específicas de trading/crypto/forex (mucho ruido en #dinero)
  /\b(curso|academia|formaci[óo]n|programa)\s+(de\s+)?(trading|forex|crypto|bolsa|inversiones?)\b/i,
  /\b(se[ñn]ales|alertas)\s+(de\s+)?(trading|forex|crypto|bitcoin)\b/i,
  /\b(predicciones?|an[áa]lisis)\s+(bitcoin|crypto|bolsa|forex)\b/i,
  /\bquiero\s+(ganar|hacer)\s+\d+\s+(d[óo]lares|dolares|usd|mxn|pesos|euros)\b/i,
  // Patrones genéricos de venta
  // CTAs comerciales explícitos
  /\blink\s*(en|in|na)\s*(la\s*)?bio\b/i,
  /\blinkin\.?bio\b/i,
  /\blinkbi\b/i,
  /\bdm\s+(me|para|for)\b/i,
  /\benv[ií]ame\s+(un\s+)?(dm|mensaje|whats)/i,
  /\bmand[áa]me\s+(un\s+)?(dm|mensaje|whats)/i,
  /\bescribime\s+(al\s+)?(whats|dm|priv)/i,
  /\bagenda\s+(tu\s+)?(cita|llamada|reuni[óo]n|sesi[óo]n)\b/i,
  /\bagenda\s+aqu[íi]\b/i,
  /\bcompr[áa]\s+(ya|aqu[íi]|tu)\b/i,
  /\bregistr[áa]te\s+(ya|aqu[íi]|gratis)\b/i,
  /\binscr[íi]bete\s+(ya|aqu[íi]|gratis)\b/i,
  // Productos/servicios pagos
  /\b(curso|mentor[íi]a|asesor[íi]a|consultor[íi]a|coaching|workshop|masterclass|webinar|programa)\s+(de|para|gratuito|gratis|en\s+vivo|completo|exclusivo)\b/i,
  /\b(course|mentorship|consulting|coaching|workshop|masterclass|webinar|program)\s+(for|on|free|live|complete|exclusive)\b/i,
  /\b(curso|programa|masterclass|webinar)\s+gratis\b/i,
  /\b\$\s?\d{2,5}\s*(usd|mxn|cop|ars|pesos|d[óo]lares)?\s*(al\s+mes|mensual|por\s+mes)?/i, // Precios visibles
  // Patrones de "llamada a acción" intrusiva
  /\bcomenta\s+["'']?(yo|si|listo|info|interes|🙋)/i,
  /\bcomenta\s+(la\s+palabra)\b/i,
  /\benv[ií]o\s+(toda\s+)?(la\s+)?(info|informaci[óo]n)\s+(por|via|al)\b/i,
  /\bcuposlimitados\b/i,
  /\bcupos\s+limitados\b/i,
  /\b[úu]ltimos\s+cupos\b/i,
  /\bsolo\s+\d+\s+cupos\b/i,
  // WhatsApp / contacto directo
  /(\+?[1-9]{1,3}\s?)?\d{2,4}\s?\d{3,4}\s?\d{4}/,  // teléfono c/ código
  /\bwhats?app\b.{0,30}\d/i,
  // Bio/IG-specific
  /\bsigueme\b.{0,50}m[áa]s\s+contenido/i,
  /\bsuscr[íi]bete\b.{0,30}canal/i,
];

function looksLikePromo(caption: string): boolean {
  if (!caption) return false;
  // Si el caption tiene 3+ patterns = casi seguro promo
  let hits = 0;
  for (const re of PROMO_PATTERNS) {
    if (re.test(caption)) {
      hits++;
      if (hits >= 2) return true; // Con 2 ya descartamos
    }
  }
  return false;
}

// Idiomas de audio europeos/americanos permitidos
const ALLOWED_AUDIO = new Set([
  'es','en','pt','de','fr','it','nl','pl','ro','sv','no','da','ca','gl','eu',''
]);

// ── Mapa de temas conocidos ───────────────────────────────────────────────────
const TEMA_MAP: Record<string, Record<string, string[]>> = {
  // ── Relaciones / amor ────────────────────────────────────────────────────────
  'amor consciente':   { es:['amor consciente','relaciones conscientes','amor real'],         en:['conscious love','conscious relationship','mindful love'],     pt:['amor consciente','relacionamento consciente'] },
  'relaciones toxicas':{ es:['relaciones tóxicas','pareja tóxica','amor tóxico'],             en:['toxic relationship','toxic love','abusive relationship'],     pt:['relacionamento tóxico','amor tóxico'] },
  'apego emocional':   { es:['apego emocional','apego ansioso','apego evitativo'],            en:['emotional attachment','anxious attachment','avoidant'],      pt:['apego emocional','apego ansioso'] },
  'autoestima':        { es:['autoestima','amor propio','confianza en uno mismo'],            en:['self esteem','self love','self confidence'],                  pt:['autoestima','amor próprio'] },
  'duelo amoroso':     { es:['duelo amoroso','superar ruptura','corazón roto'],               en:['heartbreak','breakup recovery','moving on'],                  pt:['luto amoroso','superar separação'] },
  // ── Negocios / finanzas ──────────────────────────────────────────────────────
  negocios:       { es:['negocios','emprendimiento','empresario'], en:['business','entrepreneur','startup'],        pt:['negócios','empreendedorismo'],        de:['business','unternehmen'],   fr:['business','entreprise'] },
  dinero:         { es:['dinero','finanzas','riqueza'],            en:['money','wealth','finance'],                  pt:['dinheiro','finanças'],                 de:['geld','finanzen'],          fr:['argent','finances'] },
  finanzas:       { es:['finanzas','dinero','inversión'],          en:['finance','money','investing'],               pt:['finanças','dinheiro'],                 de:['finanzen','geld'],          fr:['finances','argent'] },
  exito:          { es:['éxito','mentalidad','mindset'],           en:['success','mindset','winning'],               pt:['sucesso','mentalidade'],               de:['erfolg','mindset'],         fr:['succès','mindset'] },
  motivacion:     { es:['motivación','inspiración','superación'],  en:['motivation','inspiration','mindset'],        pt:['motivação','inspiração'],              de:['motivation','inspiration'], fr:['motivation','inspiration'] },
  emprendimiento: { es:['emprendimiento','emprendedor','startup'], en:['entrepreneurship','entrepreneur','startup'], pt:['empreendedorismo','empreendedor'],     de:['startup','gründer'],        fr:['entrepreneuriat','startup'] },
  inversion:      { es:['inversión','invertir','acciones'],        en:['investing','investment','stocks'],           pt:['investimento','investir'],             de:['investieren','aktien'],     fr:['investissement','investir'] },
  fitness:        { es:['fitness','ejercicio','entrenamiento'],    en:['fitness','workout','gym'],                   pt:['fitness','treino','academia'],          de:['fitness','training'],       fr:['fitness','musculation'] },
  salud:          { es:['salud','bienestar','hábitos'],            en:['health','wellness','healthy'],               pt:['saúde','bem-estar'],                   de:['gesundheit','wohlbefinden'],fr:['santé','bien-être'] },
  nutricion:      { es:['nutrición','alimentación','dieta'],       en:['nutrition','diet','food'],                   pt:['nutrição','alimentação'],              de:['ernährung','diät'],         fr:['nutrition','alimentation'] },
  marketing:      { es:['marketing','ventas','publicidad'],        en:['marketing','sales','branding'],              pt:['marketing','vendas'],                  de:['marketing','vertrieb'],     fr:['marketing','ventes'] },
  productividad:  { es:['productividad','hábitos','eficiencia'],   en:['productivity','habits','efficiency'],        pt:['produtividade','hábitos'],             de:['produktivität','gewohnheiten'],fr:['productivité','habitudes'] },
  ventas:         { es:['ventas','vender','clientes'],             en:['sales','selling','customers'],               pt:['vendas','vender'],                     de:['vertrieb','verkauf'],       fr:['ventes','vendre'] },
  liderazgo:      { es:['liderazgo','líder','equipo'],             en:['leadership','leader','management'],          pt:['liderança','líder'],                   de:['führung','leadership'],     fr:['leadership','dirigeant'] },
  tecnologia:     { es:['tecnología','ia','innovación'],           en:['technology','ai','innovation'],              pt:['tecnologia','ia'],                     de:['technologie','ki'],         fr:['technologie','ia'] },
  crypto:         { es:['crypto','bitcoin','blockchain'],          en:['crypto','bitcoin','blockchain'],             pt:['crypto','bitcoin'],                    de:['krypto','bitcoin'],         fr:['crypto','bitcoin'] },
  redes:          { es:['redes sociales','instagram','contenido'], en:['social media','content','creator'],          pt:['redes sociais','conteúdo'],            de:['social media','content'],   fr:['réseaux sociaux','contenu'] },
  mindset:        { es:['mindset','mentalidad','crecimiento'],     en:['mindset','growth','mentality'],              pt:['mindset','mentalidade'],               de:['mindset','mentalität'],     fr:['mindset','mentalité'] },
  amor:           { es:['amor','relación de pareja','enamorados'], en:['love','relationship','couple'],              pt:['amor','relacionamento'],               de:['liebe','beziehung'],        fr:['amour','relation'] },
  autoayuda:      { es:['autoayuda','superación personal','crecimiento personal'], en:['self help','self improvement','growth'], pt:['autoajuda','crescimento'],  de:['selbsthilfe','wachstum'],   fr:['développement personnel'] },
  psicologia:     { es:['psicología','mente','emociones'],         en:['psychology','mind','emotions'],              pt:['psicologia','mente'],                  de:['psychologie','gedanken'],   fr:['psychologie','émotions'] },
  meditacion:     { es:['meditación','mindfulness','paz interior'],en:['meditation','mindfulness','calm'],           pt:['meditação','mindfulness'],             de:['meditation','achtsamkeit'], fr:['méditation','pleine conscience'] },
  dieta:          { es:['dieta','adelgazar','bajar de peso'],      en:['diet','weight loss','fat loss'],             pt:['dieta','emagrecimento'],               de:['diät','abnehmen'],          fr:['régime','minceur'] },
  viajes:         { es:['viajes','viaje','turismo'],               en:['travel','trip','tourism'],                   pt:['viagens','viagem'],                    de:['reisen','urlaub'],          fr:['voyage','tourisme'] },
  moda:           { es:['moda','estilo','ropa'],                   en:['fashion','style','outfit'],                  pt:['moda','estilo'],                       de:['mode','stil'],              fr:['mode','style'] },
};

// Configs por idioma
const LANGS = [
  { code:'es', region:'MX', flag:'🇪🇸', label:'Español'  },
  { code:'en', region:'US', flag:'🇺🇸', label:'English'  },
  { code:'pt', region:'BR', flag:'🇧🇷', label:'Português' },
  { code:'de', region:'DE', flag:'🇩🇪', label:'Deutsch'  },
  { code:'fr', region:'FR', flag:'🇫🇷', label:'Français' },
] as const;

// Detecta si el tema está en el mapa — prefiere coincidencias más largas (más específicas)
function findMapEntry(tema: string): Record<string,string[]> | null {
  const temaLower = norm(tema);
  const temaSlug  = temaLower.replace(/[^a-z0-9]/g,'');

  let bestKey = '';
  let bestEntry: Record<string,string[]> | null = null;

  for (const [key, langs] of Object.entries(TEMA_MAP)) {
    const keyLower = norm(key);
    const keySlug  = keyLower.replace(/[^a-z0-9]/g,'');
    // Coincidencia exacta o parcial — preferir la clave más larga
    const matches = temaLower.includes(keyLower) || temaSlug.includes(keySlug)
      || keyLower.includes(temaLower) || keySlug.includes(temaSlug.slice(0,6));
    if (matches && key.length > bestKey.length) {
      bestKey   = key;
      bestEntry = langs;
    }
  }
  return bestEntry;
}

// Devuelve el término de búsqueda preferido: usa el tema del usuario si es específico (>1 palabra)
function preferredTerm(tema: string, mappedTerm: string | undefined): string {
  const words = tema.trim().split(/\s+/);
  // Si el usuario escribió más de una palabra, usar su query exacta (es más específico)
  if (words.length > 1) return tema;
  return mappedTerm || tema;
}

// ── IA: expandir cualquier tema con GPT-4o-mini ──────────────────────────────
interface AIKeywords { es: string[]; en: string[]; pt: string[]; ru?: string[]; de?: string[] }

// Detectar el idioma del término buscado por el usuario.
// Heurística simple: caracteres especiales + palabras frecuentes.
function detectQueryLanguage(tema: string): 'es' | 'en' | 'pt' | 'de' | 'ru' {
  const t = tema.toLowerCase().trim();
  // Cirílico → ruso
  if (/[Ѐ-ӿ]/.test(tema)) return 'ru';
  // Caracteres especiales españoles
  if (/[ñáéíóú¿¡]/.test(tema)) return 'es';
  // Caracteres alemanes
  if (/[äöüß]/.test(tema)) return 'de';
  // Caracteres portugueses (combinaciones únicas)
  if (/[ãõç]/.test(tema) || /(ção|nho|nha)$/.test(t)) return 'pt';
  // Palabras frecuentes ES
  const esWords = ['dinero','negocio','negocios','amor','éxito','exito','salud','belleza','familia','viaje','casa','auto','comer','trabajo','vida','ventas','marketing','crecer','aprender','enseñar','enseñanza','productividad','psicología','psicologia','mente','cuerpo','mejor','rápido','rapido','fácil','facil','consejo','consejos','tip','tips','cómo','como'];
  if (esWords.some(w => new RegExp(`\\b${w}\\b`).test(t))) return 'es';
  // Palabras frecuentes PT
  const ptWords = ['dinheiro','negócio','sucesso','saúde','vida','amor','beleza','viagem'];
  if (ptWords.some(w => new RegExp(`\\b${w}\\b`).test(t))) return 'pt';
  // Default: inglés
  return 'en';
}

async function expandWithAI(tema: string): Promise<AIKeywords | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 700,
        response_format: { type: 'json_object' },
        messages: [{
          role: 'system',
          content: `Eres un experto en hashtags virales que usan creators GRANDES (1M+ followers). Dado un tema, generás 4 grupos de hashtags para construir un pool de búsqueda profundo.

Formato ESTRICTO JSON:
{"es":["k1","k2","k3","k4","k5","k6","k7","k8"],"en":["k1","k2","k3","k4","k5","k6"],"pt":["k1","k2","k3","k4"],"ru":["k1","k2"],"de":["k1","k2"]}

ESTRUCTURA — 4 grupos por idioma, en este orden:
1. **Tema literal + sinónimos directos** (2 keywords): la palabra exacta + traducciones cortas
2. **Conceptos del nicho que usan creators grandes** (3-4 keywords): los hashtags que un creador top usaría — abstractos, aspiracionales, mentalidad
3. **Adyacentes ALINEADOS** (2-3 keywords): conceptos cercanos que un creador del tema típicamente cubre. **NO incluyas adyacentes ruidosos** que tendrían que filtrarse después.
4. **Multi-idioma** (RU + DE) para 2-3 conceptos universales

REGLAS NO NEGOCIABLES:
- Frases cortas, 1-2 palabras (van después de #)
- Sin espacios largos, sin "como hacer", sin artículos
- TODOS los keywords deben ser de la MISMA familia conceptual del tema. Si el tema es "dinero", NO pongas "5amroutine" o "gymmotivation" aunque se cruce a veces — eso lo filtramos diferente.
- Excluí explícitamente nichos técnicos especializados (trading técnico, análisis bursátil, criptos detalladas) salvo que el tema los pida directamente
- Excluí lifestyle desconectado (5amroutine, gymworkout, fooddiet) salvo que el tema sea ese
- RU en cirílico nativo, DE con palabras alemanas reales

EJEMPLO tema "dinero":
{"es":["dinero","plata","riqueza","libertadfinanciera","mentalidadrica","educacionfinanciera","emprendimiento","ahorro"],"en":["money","wealth","financialfreedom","richmindset","passiveincome","savings","finance","entrepreneurship"],"pt":["dinheiro","riqueza","liberdadefinanceira","mentalidaderica"],"ru":["деньги","богатство"],"de":["geld","reichtum"]}

EJEMPLO tema "fitness":
{"es":["fitness","entrenamiento","transformacion","mentefuerte","disciplina","rutinaentreno","nutricion","comidasaludable"],"en":["fitness","workout","transformation","strongmindset","discipline","training","nutrition","healthyfood"],"pt":["fitness","treino","transformacao","disciplina"],"ru":["фитнес","тренировка"],"de":["fitness","training"]}

EJEMPLO tema "amor consciente":
{"es":["amorconsciente","apegoseguro","relacionessanas","amorpropio","autoestima","intelygenciaemocional","comunicacionsana","limitessaludables"],"en":["consciousLove","secureattachment","healthyrelationship","selflove","emotionalintelligence","mindfulDating"],"pt":["amorconsciente","apegoseguro","relacionamentosaudavel","amorproprio"],"ru":["любовь","отношения"],"de":["liebe","beziehung"]}`,
        }, {
          role: 'user',
          content: `Tema: "${tema}"`,
        }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '';
    const parsed = JSON.parse(text);
    if (parsed.es && parsed.en) return parsed as AIKeywords;
  } catch { /* fallback */ }
  return null;
}

// ── Análisis visual con GPT-4o-mini (Vision) ──────────────────────────────────
// Mira el THUMBNAIL del video junto con el caption y devuelve un score por cada
// candidato. Detecta promos disfrazadas, banners de venta, lifestyle vacío.
// Solo se llama sobre los top 30 candidatos para ahorrar tokens.
//
// Retorna un Map<index, score 0-10> donde:
//   0-2 = promo / banner / venta de curso
//   3-4 = lifestyle vacío sin enseñanza
//   5-6 = contenido aceptable pero genérico
//   7-8 = contenido educativo replicable
//   9-10 = oro: framework, caso de éxito con números, autoridad real
async function visionRescore(
  candidates: VideoCandidate[],
  tema: string,
  maxAnalyze = 30,
): Promise<Map<number, number>> {
  const apiKey = process.env.OPENAI_API_KEY;
  const out = new Map<number, number>();
  if (!apiKey) return out;

  const subset = candidates.slice(0, maxAnalyze).filter(c => c.thumbnail);
  if (subset.length === 0) return out;

  // Procesar en batches de 10 para no exceder rate limits ni timeout
  const BATCH = 10;
  for (let start = 0; start < subset.length; start += BATCH) {
    const batch = subset.slice(start, start + BATCH);

    const userContent: Array<Record<string, unknown>> = [];
    userContent.push({
      type: 'text',
      text: `Tema buscado: "${tema}"\n\nCalificá cada video del 0 al 10 según qué tan replicable es por un creador para crecer en su nicho.\n\nReglas:\n- 0-2: Banner/promo de curso/mentoría, anuncio de producto, llamada a comprar/agendar\n- 3-4: Lifestyle vacío (autos, mansiones, viajes), motivación genérica sin método\n- 5-6: Habla del tema pero superficial o muy básico\n- 7-8: Consejo claro y aplicable, framework concreto, lección extraíble\n- 9-10: Mentor con autoridad, números/datos específicos, framework completo\n\nDevolvé SOLO un array JSON: [{"i":0,"s":7},{"i":1,"s":3},...] (i=índice 0-based, s=score 0-10).`,
    });
    batch.forEach((c, i) => {
      userContent.push({ type: 'text', text: `[${i}] @${c.channel} — "${c.title.slice(0, 150)}"` });
      userContent.push({ type: 'image_url', image_url: { url: c.thumbnail, detail: 'low' } });
    });

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Sos un curador experto de contenido viral. Evaluás videos cortos para creadores que quieren replicar fórmulas que funcionan.' },
            { role: 'user', content: userContent },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: 600,
        }),
      });
      if (!res.ok) {
        console.warn(`[vision] HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const raw = data?.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw);
      // Aceptar { scores: [...] } o array directo
      const scores: Array<{ i: number; s: number }> = Array.isArray(parsed)
        ? parsed
        : parsed.scores || parsed.items || [];
      for (const s of scores) {
        const globalIdx = start + (s.i ?? -1);
        if (globalIdx >= 0 && globalIdx < subset.length) {
          // Encontrar el índice del candidato dentro del array original
          const origIdx = candidates.indexOf(subset[globalIdx]);
          if (origIdx >= 0 && typeof s.s === 'number') {
            out.set(origIdx, Math.max(0, Math.min(10, s.s)));
          }
        }
      }
    } catch (e) {
      console.warn(`[vision] batch ${start} falló:`, (e as Error).message);
    }
  }
  console.log(`[vision] analizados ${out.size}/${subset.length} thumbnails`);
  return out;
}

// Todas las palabras aceptables en el título (cualquier idioma)
function getAllTerms(tema: string): string[] {
  const entry = findMapEntry(tema);
  const all = new Set<string>([norm(tema)]);
  if (entry) Object.values(entry).flat().forEach(t => all.add(norm(t)));
  // También agregar palabras individuales del tema (para "amor consciente" → ["amor","consciente"])
  norm(tema).split(/\s+/).filter(w => w.length > 3).forEach(w => all.add(w));
  return Array.from(all);
}

// Queries de búsqueda por idioma
type LangCode = 'es'|'en'|'pt'|'de'|'fr';
const EDU_QUALS: Record<LangCode, string[]> = {
  es: ['consejos','cómo','secretos'],
  en: ['tips','how to','secrets'],
  pt: ['dicas','como','segredos'],
  de: ['tipps','wie','ratgeber'],
  fr: ['conseils','comment','guide'],
};

function buildQueries(tema: string, langCode: LangCode, entry: Record<string,string[]>|null): string[] {
  const terms = entry?.[langCode] || [tema];
  const primary = terms[0];
  const quals = EDU_QUALS[langCode];
  // Solo 2 queries por idioma (antes eran 4) → ahorramos 50% de cuota
  return [
    `${primary} ${quals[0]}`,      // "negocios consejos"
    `${primary} ${quals[1]}`,      // "negocios cómo"
  ];
}

// Para temas no conocidos: solo ES + EN con palabras individuales
function buildNicheQueries(tema: string, langCode: LangCode): string[] {
  const words = norm(tema).split(/\s+/).filter(w => w.length > 3);
  const quals = EDU_QUALS[langCode];
  const queries: string[] = [
    `${tema} ${quals[0]}`,
    `${tema} ${quals[1]}`,
    tema,
  ];
  // Palabras individuales como fallback
  words.slice(0,2).forEach(w => queries.push(`${w} ${quals[0]}`));
  return queries;
}

// ── Filtro en 3 niveles ───────────────────────────────────────────────────────
type FilterLevel = 'strict' | 'medium' | 'loose';

interface VideoCandidate {
  id: string; title: string; channel: string;
  views: string; likes: string; viewsRaw: number; likesRaw: number;
  commentsRaw: number;
  commentScore: number; // 0 = todo ruido, 1 = todo valor, 0.5 = neutral/sin datos
  duration: number; thumbnail: string; url: string;
  platform: string; flag: string; langLabel: string; audioLang: string;
  enriched?: boolean; // true si las stats fueron verificadas (Instagram via instagram-looter2)
  fromHashtag?: boolean; // true si vino de un scrape de hashtag/keyword (ya es topic-relevante)
}

// ── Análisis de calidad de comentarios ────────────────────────────────────────
// Palabras que indican que el video genera conversación de valor
const COMMENT_VALUE = [
  // Acción / aprendizaje (ES)
  'consejo','tip','aplico','aprendí','aprendi','aprendo','me sirve','me sirvió',
  'me ayudó','me ayudo','gracias por','implementar','funciona','funcionó','funciono',
  'útil','practico','práctico','voy a aplicar','lo voy a','lo haré','lo hare',
  'excelente','muy bueno','muy útil','gran consejo','comparto','compartiré',
  'motivado','me motiva','inspirado','me inspiró','lo hago','empiezo',
  // Negocios / valor (ES)
  'negocio','emprender','dinero','inversión','inversion','ventas','clientes',
  'crecer','crecimiento','mentor','emprendedor','startup',
  // Inglés — acción
  'useful','helpful','learned','applying','will try','great tip','good advice',
  'how to','thank you for','advice','going to apply','this works','game changer',
  'mind blown','changed my','sharing this','bookmarking','saving this',
  'taking notes','note taken','gold','valuable','worth watching','so true',
  'implement','i needed this','needed to hear','wake up call','fire 🔥',
  // Inglés — engagement real
  'facts','real talk','based','respect','legend','respect','w video','banger content',
  // Portugués
  'obrigado','aprendi','vou aplicar','incrível','muito bom','muito útil',
  // Alemán / francés
  'danke','sehr gut','merci','très utile','très bon',
];

// Palabras que indican entretenimiento / reacción emocional (sin valor replicable)
const COMMENT_NOISE = [
  // Humor / risa
  'jajaja','jeje','jaja','jajajaja','lol','hahaha','haha','lmao','lmfao','💀',
  'me morí','me muero','ded','muerto','dead','sksksk','😹',
  // Reacciones emocionales sin acción
  'aww','qué lindo','que lindo','qué tierno','que tierno','qué bonito','que bonito',
  '🥹','cute','adorable','tierno','hermoso','beautiful','so cute','awww','precious',
  'me hizo llorar','crying','lloro','im crying','i cried',
  // Fan/idol reactions
  'king','queen','icon','stan','slay','era','mother','periodt','girlboss',
  'omg omg','bestie','besties','iconic','legend wait what',
  // Ruido puro
  'first','primero','frist','early','aquí antes de que sea famoso',
  '❤️❤️❤️','💕💕','😍😍😍','🔥🔥🔥🔥🔥','🔥🔥🔥🔥🔥🔥',
  // Música / entretenimiento
  'banger','tune','this song','the beat','drop','slaps','goes hard','fire song',
];

async function fetchCommentScore(videoId: string, apiKey: string): Promise<number> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=8&order=relevance&textFormat=plainText&key=${apiKey}`
    );
    if (!res.ok) return 0.5;
    const data = await res.json();

    type CommentItem = { snippet: { topLevelComment: { snippet: { textDisplay: string } } } };
    const comments: string[] = (data.items as CommentItem[] || [])
      .map(item => item.snippet.topLevelComment.snippet.textDisplay.toLowerCase());

    if (comments.length === 0) return 0.5;

    let value = 0;
    let noise = 0;

    for (const c of comments) {
      for (const w of COMMENT_VALUE) { if (c.includes(w)) value++; }
      for (const w of COMMENT_NOISE) { if (c.includes(w)) noise++; }
    }

    const total = value + noise;
    if (total === 0) return 0.5; // neutral: comentarios neutros (emoji, nombres, etc.)
    return value / total; // 0 = todo ruido, 1 = todo valor
  } catch {
    return 0.5;
  }
}

// Umbrales para filtro "viral y replicable"
const MIN_VIEWS_STRICT   = 100_000;  // 100K vistas mínimo en strict
const MIN_VIEWS_MEDIUM   =  20_000;  // 20K en medium
const MIN_VIEWS_LOOSE    =   1_000;  // 1K en loose
const MIN_COMMENTS_STRICT =    100;  // 100 comentarios mínimo en strict
const MIN_COMMENTS_MEDIUM =     20;  // 20 en medium (puede ser 0 si no disponible)
const MIN_LIKES           =    500;  // mínimo absoluto de likes (cuando es conocido)

const BLOCKED_AUDIO = new Set(['hi','ta','te','mr','bn','gu','kn','ml','pa','ur','ar','zh','ja','ko','th','vi','id','ms','tl']);

function hasTopicInTitle(titleNorm: string, allTerms: string[]): boolean {
  return allTerms.some(t => t.split(/\s+/).some(w => w.length > 3 && titleNorm.includes(w)));
}

function applyFilter(candidates: VideoCandidate[], allTerms: string[], level: FilterLevel): VideoCandidate[] {
  return candidates.filter(v => {
    // Siempre: duración válida para Short
    if (v.duration <= 3 || v.duration > 180) return false;

    const rawTitleNorm  = norm(v.title);           // con hashtags, para blacklist
    const clean         = stripTags(v.title);       // sin hashtags, para tema
    if (!clean || clean.length < 3) return false;
    const titleNorm     = norm(clean);
    const channelNorm   = v.channel.toLowerCase();

    // Siempre: canales de música auto-generados de YouTube ("Artist - Topic")
    if (channelNorm.includes('- topic')) return false;

    // Siempre: blacklist — revisar AMBOS: título con hashtags Y sin ellos
    if (BLACKLIST.some(w => rawTitleNorm.includes(norm(w)))) return false;

    // Siempre: mínimo de likes — solo aplica si las stats están verificadas (enriquecidas)
    // Si likesRaw === 0 puede ser desconocido (Serper no enriquecido), dejamos pasar y la IA decide
    if (v.enriched && v.likesRaw > 0 && v.likesRaw < MIN_LIKES) return false;
    // Si están enriquecidas y likes es 0 explícito (verificado bajo), también descartar
    if (v.enriched && v.likesRaw === 0) return false;

    // El tema DEBE aparecer en el título limpio... salvo que el video haya
    // venido de un scrape por hashtag/keyword (ya pasó por ese match en la
    // plataforma). Apify scraper de #dinero ya devuelve solo posts del
    // hashtag — re-exigir "dinero" en caption descarta videos virales que
    // taggean el hashtag pero no escriben la palabra en el caption.
    if (!v.fromHashtag && !hasTopicInTitle(titleNorm, allTerms)) return false;

    if (level === 'strict') {
      const audioBase = v.audioLang.split('-')[0].toLowerCase();
      if (!audioBase || !ALLOWED_AUDIO.has(audioBase)) return false;
      if (v.viewsRaw < MIN_VIEWS_STRICT) return false;
      if (v.commentsRaw > 0 && v.commentsRaw < MIN_COMMENTS_STRICT) return false;
      // Comentarios de ruido puro → descartar (solo si tenemos el score real, no el 0.5 neutral)
      if (v.commentScore !== 0.5 && v.commentScore < 0.2) return false;
      return true;
    }

    if (level === 'medium') {
      const audioBase = v.audioLang.split('-')[0].toLowerCase();
      if (audioBase && BLOCKED_AUDIO.has(audioBase)) return false;
      // viewsRaw === 0 = desconocido (Serper) → dejar pasar
      if (v.viewsRaw > 0 && v.viewsRaw < MIN_VIEWS_MEDIUM) return false;
      if (v.commentsRaw > 0 && v.commentsRaw < MIN_COMMENTS_MEDIUM) return false;
      return true;
    }

    // loose: blacklist + tema en título + mínimo de vistas
    // viewsRaw === 0 = desconocido (Serper no siempre reporta vistas) → dejar pasar
    return v.viewsRaw === 0 || v.viewsRaw >= MIN_VIEWS_LOOSE;
  });
}

// Score compuesto: vistas × calidad de comentarios
function scoreComposite(v: VideoCandidate): number {
  return v.viewsRaw * (0.5 + v.commentScore);
}

// Deduplicar + filtrar con cascada de relevancia + ordenar por score → top N
// Cascada: medium (relevancia + vistas mín) → loose (relevancia + min loose) → sin tema (último recurso)
function topByViews(candidates: VideoCandidate[], allTerms: string[], topN = 20): VideoCandidate[] {
  const urlSeen = new Set<string>();
  const deduped = candidates.filter(v => {
    if (urlSeen.has(v.url)) return false;
    urlSeen.add(v.url);
    return true;
  });

  const sortByScore = (arr: VideoCandidate[]) =>
    arr.sort((a, b) => scoreComposite(b) - scoreComposite(a));

  // 1. Filtro medium: tema en título + sin blacklist + duración + vistas mínimas
  if (allTerms.length > 0) {
    const medium = applyFilter(deduped, allTerms, 'medium');
    if (medium.length >= Math.min(topN, 8)) {
      return sortByScore(medium).slice(0, topN);
    }

    // 2. Filtro loose: tema en título + sin blacklist + duración (sin mín de vistas estrictos)
    const loose = applyFilter(deduped, allTerms, 'loose');
    if (loose.length >= Math.min(topN, 5)) {
      return sortByScore(loose).slice(0, topN);
    }

    // Si filtros con tema dan muy pocos, devolver lo que haya pero priorizándolos
    if (loose.length > 0) {
      // Completar con candidatos sin filtro de tema (solo dedupe+blacklist+duración)
      const sin = sinTemaFilter(deduped);
      const ids = new Set(loose.map(v => v.url));
      const extras = sin.filter(v => !ids.has(v.url));
      return [...sortByScore(loose), ...sortByScore(extras)].slice(0, topN);
    }
  }

  // 3. Último recurso: sin filtro de tema (solo dedupe + blacklist + duración)
  return sortByScore(sinTemaFilter(deduped)).slice(0, topN);
}

// Filtro mínimo: dedupe + blacklist + duración (sin requerir tema en título)
function sinTemaFilter(candidates: VideoCandidate[]): VideoCandidate[] {
  return candidates.filter(v => {
    if (v.duration <= 3 || v.duration > 180) return false;
    const rawTitleNorm = norm(v.title);
    const clean = stripTags(v.title);
    if (!clean || clean.length < 3) return false;
    if (v.channel.toLowerCase().includes('- topic')) return false;
    if (BLACKLIST.some(w => rawTitleNorm.includes(norm(w)))) return false;
    if (v.likesRaw > 0 && v.likesRaw < MIN_LIKES) return false;
    return v.viewsRaw === 0 || v.viewsRaw >= MIN_VIEWS_LOOSE;
  });
}

// Compatibilidad con código existente
function guaranteeResults(candidates: VideoCandidate[], allTerms: string[], minResults: number): VideoCandidate[] {
  return topByViews(candidates, allTerms, minResults);
}

// ── YouTube ───────────────────────────────────────────────────────────────────
async function fetchYTQuery(query: string, apiKey: string, langCode: string, region: string) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=id,snippet&q=${encodeURIComponent(query)}&type=video&videoDuration=short&order=viewCount&maxResults=50&relevanceLanguage=${langCode}&regionCode=${region}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message || 'YouTube error'); }
  const data = await res.json();
  return (data.items||[]).map((i:{id:{videoId:string};snippet:{title:string;channelTitle:string}}) => ({
    id: i.id.videoId, title: i.snippet.title, channelTitle: i.snippet.channelTitle,
  }));
}

async function searchYouTube(tema: string, apiKey: string) {
  const cacheKey = `yt:${norm(tema.trim())}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const entry = findMapEntry(tema);
  const allTerms = getAllTerms(tema);
  const isKnown = entry !== null;

  // Para temas conocidos: 3 idiomas (ES+EN+PT). Para temas nicho: solo ES+EN
  // Reducimos de 5→3 para ahorrar cuota de YouTube API (10K units/día)
  const searchLangs = isKnown ? LANGS.slice(0, 3) : LANGS.slice(0, 2);

  // Lanzar todas las queries en paralelo
  type SearchItem = { id: string; title: string; channelTitle: string };
  const searchJobs: { lang: typeof LANGS[number]; query: string }[] = [];
  for (const lang of searchLangs) {
    const queries = isKnown
      ? buildQueries(tema, lang.code as LangCode, entry)
      : buildNicheQueries(tema, lang.code as LangCode);
    for (const query of queries) {
      searchJobs.push({ lang, query });
    }
  }

  const results = await Promise.allSettled(
    searchJobs.map(({ lang, query }) =>
      fetchYTQuery(query, apiKey, lang.code, lang.region)
        .then((items: SearchItem[]) => ({ lang, items }))
    )
  );

  // Deduplicar globalmente por videoId, mantener referencia del idioma buscado
  const globalSeen = new Set<string>();
  const perLangCandidates = new Map<string, { lang: typeof LANGS[number]; ids: string[] }>();

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { lang, items } = r.value;
    const entry2 = perLangCandidates.get(lang.code) || { lang, ids: [] };
    for (const item of items) {
      if (!globalSeen.has(item.id)) {
        globalSeen.add(item.id);
        entry2.ids.push(item.id);
      }
    }
    perLangCandidates.set(lang.code, entry2);
  }

  // Obtener stats/metadata en batches de 50
  const allIds = Array.from(globalSeen);
  if (allIds.length === 0) return [];

  const statsMap: Record<string,{viewCount?:string;likeCount?:string;commentCount?:string}> = {};
  const thumbMap: Record<string,string> = {};
  const durMap: Record<string,number> = {};
  const audioLangMap: Record<string,string> = {};
  // Keep title from search results
  const titleMap: Record<string,string> = {};
  const channelMap: Record<string,string> = {};

  // Reconstruct titleMap from search results
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const item of r.value.items) {
      titleMap[item.id] = item.title;
      channelMap[item.id] = item.channelTitle;
    }
  }

  const batches: string[][] = [];
  for (let i = 0; i < allIds.length; i += 50) batches.push(allIds.slice(i, i+50));

  await Promise.all(batches.map(async batch => {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${batch.join(',')}&key=${apiKey}`
    );
    const data = await res.json();
    for (const v of (data.items||[])) {
      statsMap[v.id]      = v.statistics || {};
      thumbMap[v.id]      = v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || '';
      durMap[v.id]        = parseDuration(v.contentDetails?.duration || '');
      audioLangMap[v.id]  = v.snippet?.defaultAudioLanguage || v.snippet?.defaultLanguage || '';
      if (v.snippet?.title) titleMap[v.id] = v.snippet.title;
      if (v.snippet?.channelTitle) channelMap[v.id] = v.snippet.channelTitle;
    }
  }));

  // Construir candidatos con su idioma de búsqueda asignado
  const candidates: VideoCandidate[] = [];
  for (const { lang, ids } of perLangCandidates.values()) {
    for (const id of ids) {
      candidates.push({
        id,
        title:     titleMap[id] || '',
        channel:   channelMap[id] || '',
        views:        fmt(statsMap[id]?.viewCount),
        likes:        fmt(statsMap[id]?.likeCount),
        viewsRaw:     parseInt(statsMap[id]?.viewCount   || '0'),
        likesRaw:     parseInt(statsMap[id]?.likeCount   || '0'),
        commentsRaw:  parseInt(statsMap[id]?.commentCount || '0'),
        commentScore: 0.5, // se actualiza abajo
        duration:     durMap[id] ?? 9999,
        thumbnail:    thumbMap[id] || '',
        url:          `https://www.youtube.com/shorts/${id}`,
        platform:     'youtube',
        flag:         lang.flag,
        langLabel:    lang.label,
        audioLang:    audioLangMap[id] || '',
      });
    }
  }

  // Filtro previo rápido para no pedir comentarios de candidatos que no pasan
  const preFiltered = candidates.filter(v =>
    v.viewsRaw >= MIN_VIEWS_MEDIUM &&
    v.duration > 3 && v.duration <= 180 &&
    !BLACKLIST.some(w => v.title.toLowerCase().includes(w))
  ).sort((a, b) => b.viewsRaw - a.viewsRaw).slice(0, 20);

  // Fetch de comentarios en paralelo para los top 40 candidatos
  await Promise.all(
    preFiltered.map(async v => {
      v.commentScore = await fetchCommentScore(v.id, apiKey);
    })
  );

  const final = guaranteeResults(candidates, allTerms, 12);
  setCached(cacheKey, final);
  return final;
}

// ── Enriquecer YouTube Shorts con stats reales (vía Data API) ──────────────
// Serper devuelve URLs sin views/likes. Si no enriquecemos, el filtro de viralidad
// no puede descartar videos con 1 like. Hacemos UNA llamada batch al Data API
// (50 IDs por request) para traer los stats de todos los candidatos.
function extractYoutubeId(url: string): string | null {
  const m1 = url.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
  if (m2) return m2[1];
  const m3 = url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
  if (m3) return m3[1];
  return null;
}

async function enrichYouTubeStats(
  candidates: VideoCandidate[],
  ytKey: string,
): Promise<void> {
  // Mapear URL → candidate (con su id de YouTube)
  const idToCandidate = new Map<string, VideoCandidate>();
  for (const c of candidates) {
    const id = extractYoutubeId(c.url);
    if (id) idToCandidate.set(id, c);
  }
  if (idToCandidate.size === 0) return;

  const ids = Array.from(idToCandidate.keys());
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += 50) batches.push(ids.slice(i, i + 50));

  await Promise.all(batches.map(async batch => {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${batch.join(',')}&key=${ytKey}`,
      );
      if (!res.ok) {
        console.warn(`[enrichYT] HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      for (const v of (data.items || [])) {
        const c = idToCandidate.get(v.id);
        if (!c) continue;
        const views = parseInt(v.statistics?.viewCount || '0', 10);
        const likes = parseInt(v.statistics?.likeCount || '0', 10);
        const comments = parseInt(v.statistics?.commentCount || '0', 10);
        if (views > 0) { c.viewsRaw = views; c.views = fmt(views); }
        if (likes > 0) { c.likesRaw = likes; c.likes = fmt(likes); }
        if (comments > 0) c.commentsRaw = comments;
        if (v.snippet?.title) c.title = v.snippet.title;
        if (v.snippet?.channelTitle) c.channel = v.snippet.channelTitle;
        if (v.snippet?.thumbnails?.medium?.url) c.thumbnail = v.snippet.thumbnails.medium.url;
        if (v.contentDetails?.duration) c.duration = parseDuration(v.contentDetails.duration);
        c.enriched = true;
      }
    } catch (e) {
      console.warn(`[enrichYT] error:`, (e as Error).message);
    }
  }));

  const enrichedCount = candidates.filter(c => c.enriched).length;
  console.log(`[enrichYT] enriched ${enrichedCount}/${candidates.length} YouTube candidates`);
}

// ── TikTok — TikWM (gratis, sin cuota) ───────────────────────────────────────
interface TikWMVideo {
  video_id?: string; title?: string;
  play_count?: number; digg_count?: number; comment_count?: number;
  author?: { id?: string; unique_id?: string; nickname?: string };
  cover?: string;
}

// Busca múltiples páginas en TikWM para obtener ~100 videos por keyword
async function fetchTikWMSearch(kw: string, pages = 5): Promise<TikWMVideo[]> {
  const results: TikWMVideo[] = [];
  let cursor = 0;
  for (let i = 0; i < pages; i++) {
    try {
      const res = await fetch(
        `https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(kw)}&count=20&cursor=${cursor}&web=1&hd=1`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      if (!res.ok) break;
      const data = await res.json();
      const videos: TikWMVideo[] = data?.data?.videos || [];
      if (!videos.length) break;
      results.push(...videos);
      cursor = data?.data?.cursor || (cursor + 20);
      if (!data?.data?.has_more) break;
    } catch { break; }
  }
  return results;
}

function tikwmToCandidate(v: TikWMVideo, lang: { flag: string; label: string }): VideoCandidate | null {
  const id = v.video_id || '';
  const uid = v.author?.unique_id || '';
  if (!id || !uid) return null;
  return {
    id, title: v.title?.slice(0, 120) || 'Video de TikTok',
    channel: v.author?.nickname || uid || 'Usuario',
    views: fmt(v.play_count), likes: fmt(v.digg_count),
    viewsRaw: v.play_count || 0, likesRaw: v.digg_count || 0, commentsRaw: v.comment_count || 0,
    commentScore: 0.5, duration: 30,
    thumbnail: v.cover || '',
    url: `https://www.tiktok.com/@${uid}/video/${id}`,
    platform: 'tiktok', flag: lang.flag, langLabel: lang.label, audioLang: '',
  };
}

async function searchTikTok(tema: string, _key: string) {
  const entry = findMapEntry(tema);
  const allTerms = getAllTerms(tema);

  const searchConfigs = [
    { lang: LANGS[0], term: preferredTerm(tema, entry?.es?.[0]) },
    { lang: LANGS[1], term: preferredTerm(tema, entry?.en?.[0]) },
    { lang: LANGS[2], term: preferredTerm(tema, entry?.pt?.[0]) },
  ];

  // 1️⃣ TikWM — gratis, sin cuota
  const searches = await Promise.allSettled(
    searchConfigs.map(c => fetchTikWMSearch(c.term).then(items => ({ ...c, items })))
  );

  const seen = new Set<string>();
  const candidates: VideoCandidate[] = [];

  for (const r of searches) {
    if (r.status !== 'fulfilled') continue;
    const { lang, items } = r.value;
    for (const v of items) {
      const id = v.video_id || '';
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const c = tikwmToCandidate(v, lang);
      if (c) candidates.push(c);
    }
  }

  if (candidates.length === 0) throw new Error('No se encontraron videos en TikTok.');
  return guaranteeResults(candidates, allTerms, 12);
}

// ── Instagram ─────────────────────────────────────────────────────────────────
function toSlug(t:string){ return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,''); }

function candidateUsernames(tema: string): string[] {
  const entry = findMapEntry(tema);
  const cands = new Set<string>();
  const base = toSlug(tema);

  cands.add(base); cands.add(base+'tips'); cands.add(base+'oficial');
  if (entry) {
    for (const terms of Object.values(entry)) {
      terms.slice(0,2).forEach(t => { const s=toSlug(t); cands.add(s); cands.add(s+'tips'); });
    }
  }
  return Array.from(cands).slice(0,10);
}

async function igLookupId(username:string,key:string):Promise<number|null>{
  try {
    const res = await fetch(
      `https://instagram-api-fast-reliable-data-scraper.p.rapidapi.com/user_id_by_username?username=${encodeURIComponent(username)}`,
      { headers:{'x-rapidapi-host':'instagram-api-fast-reliable-data-scraper.p.rapidapi.com','x-rapidapi-key':key} }
    );
    const d = await res.json();
    if(d?.message?.includes('exceeded')||d?.message?.includes('quota')) throw new Error('QUOTA');
    return d?.UserID||null;
  } catch(e){ if((e as Error).message==='QUOTA') throw e; return null; }
}

async function igGetReels(uid:number,key:string){
  const res = await fetch(
    `https://instagram-api-fast-reliable-data-scraper.p.rapidapi.com/reels?user_id=${uid}&count=10`,
    { headers:{'x-rapidapi-host':'instagram-api-fast-reliable-data-scraper.p.rapidapi.com','x-rapidapi-key':key} }
  );
  return res.ok ? ((await res.json())?.data?.items||[]) : [];
}

async function searchInstagram(tema:string, key:string) {
  const usernames = candidateUsernames(tema);
  const allTerms = getAllTerms(tema);
  let rawItems: unknown[] = [];
  let tried = 0;

  for (const u of usernames) {
    let uid:number|null;
    try { uid = await igLookupId(u,key); }
    catch { throw new Error('⚠️ Se agotó el cupo mensual de la API de Instagram.'); }
    if (!uid) continue;
    tried++;
    const items = await igGetReels(uid,key);
    if (items.length>0){ rawItems=items; break; }
  }
  if (tried===0) throw new Error(`No se encontraron cuentas para "${tema}". Prueba con el nombre de un creador.`);
  if (rawItems.length===0) throw new Error(`No se encontraron reels para "${tema}".`);

  type RI = {media?:{code?:string;caption?:{text?:string};like_count?:number;play_count?:number;user?:{username?:string};image_versions2?:{candidates?:{url?:string}[]}}};
  const candidates: VideoCandidate[] = (rawItems as RI[]).map(item => {
    const m=item.media||{};
    const u=m.user?.username||'';
    return {
      id:m.code||u, title:m.caption?.text?.slice(0,120)||`Reel de @${u}`,
      channel:u, views:fmt(m.play_count), likes:fmt(m.like_count),
      viewsRaw:m.play_count||0, likesRaw:m.like_count||0, commentsRaw:0, commentScore:0.5, duration:30, thumbnail:m.image_versions2?.candidates?.[0]?.url||'',
      url:m.code?`https://www.instagram.com/reel/${m.code}/`:`https://www.instagram.com/${u}/`,
      platform:'instagram', flag:'🌐', langLabel:'Mixed', audioLang:'',
    };
  });

  return guaranteeResults(candidates, allTerms, 8);
}

// ── Apify — scrapers nativos de TikTok e Instagram ───────────────────────────
async function searchViaApify(
  tema: string,
  platform: 'tiktok'|'instagram',
  apifyToken: string,
  aiKeysOverride?: AIKeywords | null,
) {
  const entry = findMapEntry(tema);
  const allTerms = getAllTerms(tema);

  // Pool ANCHO de keywords. La IA ahora genera 4 grupos por idioma:
  // literal + conceptos + adyacentes alineados + multi-idioma.
  // Total objetivo: ~22 hashtags por búsqueda.
  const ai = aiKeysOverride || null;
  const esKeywords = Array.from(new Set([
    tema,
    ...(ai?.es || []).slice(0, 8),           // hasta 8 keywords ES
    ...(entry?.es || []).slice(0, 1),
  ])).filter(Boolean).slice(0, 9);
  const enKeywords = Array.from(new Set([
    ...(ai?.en || []).slice(0, 6),           // hasta 6 EN
    ...(entry?.en || []).slice(0, 1),
  ])).filter(Boolean).slice(0, 6);
  const ptKeywords = Array.from(new Set([
    ...(ai?.pt || []).slice(0, 4),           // hasta 4 PT
    ...(entry?.pt || []).slice(0, 1),
  ])).filter(Boolean).slice(0, 4);
  const ruKeywords = (ai?.ru || []).slice(0, 2);
  const deKeywords = (ai?.de || []).slice(0, 2);

  let items: unknown[] = [];

  if (platform === 'tiktok') {
    // clockworks/tiktok-scraper — usa el motor de búsqueda nativo de TikTok.
    // Returns posts ordered by TikTok's own virality ranking — exactamente
    // lo que se ve si abrís la app y buscás.
    const allKeywords = [...esKeywords, ...enKeywords, ...ptKeywords, ...ruKeywords, ...deKeywords];
    const res = await fetch(
      `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${apifyToken}&memory=1024&timeout=240`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchSection: '',  // Vacío = búsqueda general (incluye videos)
          searchQueries: allKeywords,
          maxItems: 200, // 200 totales, distribuidos entre las queries para más cobertura
          shouldDownloadVideos: false,
          shouldDownloadCovers: false,
          shouldDownloadSubtitles: false,
        }),
      }
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => String(res.status));
      throw new Error(`Apify TikTok ${res.status}: ${errText.slice(0, 200)}`);
    }
    items = await res.json();
  } else {
    // apify/instagram-scraper — busca por hashtag (motor de descubrimiento
    // nativo de IG). Cada hashtag devuelve los TOP posts ordenados por engagement.
    const allKeywords = [...esKeywords, ...enKeywords, ...ptKeywords, ...ruKeywords, ...deKeywords];
    const hashtags = allKeywords.map(k =>
      `https://www.instagram.com/explore/tags/${encodeURIComponent(String(k).replace(/\s+/g,''))}/`,
    );
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyToken}&memory=1024&timeout=240`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directUrls: hashtags,
          resultsType: 'posts',
          // 150 por hashtag × ~22 hashtags = ~3300 posts crudos.
          // Después filtramos solo videos (~30% del feed) → ~1000 videos virales.
          // 150 vs 200 evita timeouts en hashtags muy fotograficos.
          resultsLimit: 150,
          addParentData: false,
        }),
      }
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => String(res.status));
      throw new Error(`Apify Instagram ${res.status}: ${errText.slice(0, 200)}`);
    }
    items = await res.json();
  }

  // Si Apify literalmente no devolvió posts (raro), throw para que el caller pruebe fallback
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Sin resultados de Apify');
  }
  // Si devolvió posts pero ninguno es video (típico en hashtags muy fotograficos como #cerveza),
  // NO throw — devolvemos array vacío para que el caller decida si caer a fallback o no.

  const flag  = platform === 'tiktok' ? '🎵' : '📸';
  const label = platform === 'tiktok' ? 'TikTok' : 'Instagram';

  const rawCandidates = items.map((raw): VideoCandidate | null => {
    const v = raw as Record<string, unknown>;

    if (platform === 'tiktok') {
      const id       = (v.id as string) || '';
      const authorId = (v.authorMeta as Record<string,unknown>)?.name as string || '';
      const plays    = (v.playCount as number) || 0;
      // Descartar slideshows (carruseles de fotos con música) — no son video replicable
      if (v.isSlideshow === true) return null;
      // Descartar posts sin engagement (geo-restricted o defectuosos)
      if (plays === 0 && !(v.diggCount as number)) return null;
      const videoMeta = (v.videoMeta as Record<string, unknown>) || {};
      const duration = (videoMeta.duration as number) || 0;
      // Si no hay duración real (=slideshow disfrazado o error), descartar
      if (duration <= 0) return null;
      // Thumbnail: TikTok lo pone en videoMeta.coverUrl (no en covers root)
      const thumbnail =
        (videoMeta.coverUrl as string) ||
        (videoMeta.originalCoverUrl as string) ||
        (v.covers as string[])?.[0] ||
        (v.coverUrl as string) ||
        '';
      return {
        id,
        title:     (v.text as string)?.slice(0, 120) || 'Video de TikTok',
        channel:   `@${authorId}`,
        views:       fmt(plays), likes: fmt((v.diggCount as number) || 0),
        viewsRaw:    plays, likesRaw: (v.diggCount as number) || 0, commentsRaw: (v.commentCount as number) || 0, commentScore: 0.5,
        duration,
        thumbnail,
        url:         `https://www.tiktok.com/@${authorId}/video/${id}`,
        platform, flag, langLabel: label, audioLang: (v.textLanguage as string) || '',
        fromHashtag: true, // ya vino de búsqueda por keyword en TikTok nativo
        enriched: true,
      };
    } else {
      // Instagram: SOLO videos/reels, descartar Images y Sidecars (fotos)
      const type = String(v.type || '');
      const productType = String(v.productType || '');
      const isVideoLike = type === 'Video' || productType === 'clips';
      if (!isVideoLike) return null;

      const shortCode = (v.shortCode as string) || '';
      const owner     = (v.ownerUsername as string) || '';
      // Engagement: views vienen de videoViewCount/videoPlayCount, NO confundir con likes
      const views = (v.videoViewCount as number) || (v.videoPlayCount as number) || 0;
      const likes = (v.likesCount as number) || 0;
      const comments = (v.commentsCount as number) || 0;
      // Descartar reels sin engagement reportado (Apify a veces devuelve posts vacíos)
      if (views === 0 && likes === 0) return null;

      return {
        id:          shortCode || owner,
        title:       (v.caption as string)?.slice(0, 120) || `Reel de @${owner}`,
        channel:     `@${owner}`,
        views:       fmt(views), likes: fmt(likes),
        viewsRaw:    views, likesRaw: likes, commentsRaw: comments, commentScore: 0.5,
        duration:    (v.videoDuration as number) || 30,
        thumbnail:   (v.displayUrl as string) || '',
        url:         shortCode ? `https://www.instagram.com/reel/${shortCode}/` : `https://www.instagram.com/${owner}/`,
        platform, flag, langLabel: label, audioLang: '',
        enriched:    true, // Apify ya nos dio los datos completos
        fromHashtag: true, // ya vino de scrapeo de hashtag en IG nativo
      };
    }
  });

  // Filtrar nulls (posts que descartamos por ser fotos o estar vacíos)
  const candidates = rawCandidates.filter((c): c is VideoCandidate => c !== null);

  // Ordenar por engagement (views + likes×8) ANTES del filtro para que los
  // realmente virales (millones de vistas) lleguen primero a la IA.
  candidates.sort((a, b) => {
    const sa = a.viewsRaw + a.likesRaw * 8;
    const sb = b.viewsRaw + b.likesRaw * 8;
    return sb - sa;
  });

  console.log(`[searchViaApify] ${platform}: ${items.length} items → ${candidates.length} videos | top viral: ${candidates[0]?.viewsRaw || 0} views`);

  return guaranteeResults(candidates, allTerms, 12);
}

// ── Serper.dev — Google Search como fuente de TikTok e Instagram ─────────────
// Extrae views aproximados del snippet de Google ("1.2M views", "500K views", etc.)
function parseViewsFromSnippet(snippet: string): number {
  const m = snippet.match(/([\d.,]+)\s*([KMB])?\s*(?:views?|visualizaciones?|visitas?)/i);
  if (!m) return 0;
  const num = parseFloat(m[1].replace(/,/g,''));
  const mul = m[2]?.toUpperCase();
  if (mul==='B') return num * 1_000_000_000;
  if (mul==='M') return num * 1_000_000;
  if (mul==='K') return num * 1_000;
  return num;
}

// Construye queries optimizadas para Serper por plataforma
function buildSerperQueries(tema: string, platform: 'tiktok'|'instagram'|'youtube', entry: Record<string,string[]>|null): { q: string; gl: string; hl: string }[] {
  const esTerm = entry?.es?.[0] || tema;
  const enTerm = entry?.en?.[0] || tema;
  const ptTerm = entry?.pt?.[0] || tema;

  if (platform === 'youtube') {
    return [
      { q: `site:youtube.com/shorts ${esTerm}`,  gl:'us', hl:'es' },
      { q: `site:youtube.com/shorts ${enTerm}`,  gl:'us', hl:'en' },
      { q: `youtube shorts ${esTerm} viral`,     gl:'mx', hl:'es' },
      { q: `site:youtube.com/shorts ${ptTerm}`,  gl:'br', hl:'pt' },
    ];
  }

  if (platform === 'tiktok') {
    // TikTok: Google indexa URLs como tiktok.com/@user/video/ID — buscar sin el /video/ en la query
    return [
      { q: `site:tiktok.com ${esTerm}`,           gl:'us', hl:'es' },
      { q: `site:tiktok.com ${enTerm}`,           gl:'us', hl:'en' },
      { q: `site:tiktok.com ${ptTerm}`,           gl:'br', hl:'pt' },
      { q: `tiktok.com ${esTerm} video`,          gl:'mx', hl:'es' },
    ];
  } else {
    // Instagram: buscar reels con hashtag + keyword, en varios países hispanohablantes
    return [
      { q: `site:instagram.com/reel ${esTerm}`,        gl:'es', hl:'es' },
      { q: `site:instagram.com/reel #${esTerm.replace(/\s+/g,'')}`, gl:'mx', hl:'es' },
      { q: `site:instagram.com/reel ${enTerm}`,        gl:'us', hl:'en' },
      { q: `site:instagram.com/reel ${ptTerm}`,        gl:'br', hl:'pt' },
    ];
  }
}

async function searchViaSerper(tema: string, platform: 'tiktok'|'instagram'|'youtube', serperKey: string) {
  const entry = findMapEntry(tema);
  const allTerms = getAllTerms(tema);
  const flag  = platform === 'tiktok' ? '🎵' : platform === 'youtube' ? '▶' : '📸';
  const label = platform === 'tiktok' ? 'TikTok' : platform === 'youtube' ? 'YouTube' : 'Instagram';

  // preferredTerm garantiza que "amor consciente" no se reduce a solo "amor"
  const esTerm = preferredTerm(tema, entry?.es?.[0]);
  const enTerm = preferredTerm(tema, entry?.en?.[0]);
  const ptTerm = preferredTerm(tema, entry?.pt?.[0]);
  // Frase exacta entre comillas para Google (más precisión)
  const esExact = `"${esTerm}"`;
  const enExact = `"${enTerm}"`;

  const serperCalls: { endpoint: string; body: object }[] = platform === 'tiktok'
    ? [
        { endpoint: 'videos', body: { q: `${esTerm} tiktok`,      gl:'us', hl:'es', num:10 } },
        { endpoint: 'videos', body: { q: `${enTerm} tiktok`,      gl:'us', hl:'en', num:10 } },
        { endpoint: 'videos', body: { q: `${ptTerm} tiktok`,      gl:'br', hl:'pt', num:10 } },
        { endpoint: 'search', body: { q: `site:tiktok.com ${esExact}`, gl:'mx', hl:'es', num:20 } },
      ]
    : platform === 'youtube'
    ? [
        { endpoint: 'videos', body: { q: `${esTerm} youtube shorts`, gl:'us', hl:'es', num:10 } },
        { endpoint: 'videos', body: { q: `${enTerm} youtube shorts`, gl:'us', hl:'en', num:10 } },
        { endpoint: 'search', body: { q: `site:youtube.com/shorts ${esExact}`, gl:'mx', hl:'es', num:20 } },
        { endpoint: 'search', body: { q: `site:youtube.com/shorts ${enExact}`, gl:'us', hl:'en', num:20 } },
      ]
    : [
        // Instagram: query exacta primero, luego variantes con hashtag
        { endpoint: 'search', body: { q: `site:instagram.com/reel ${esExact}`,                          gl:'mx', hl:'es', num:20 } },
        { endpoint: 'search', body: { q: `site:instagram.com/reel #${esTerm.replace(/\s+/g,'')}`,       gl:'mx', hl:'es', num:20 } },
        { endpoint: 'search', body: { q: `site:instagram.com/reel ${enExact}`,                          gl:'us', hl:'en', num:20 } },
        { endpoint: 'search', body: { q: `site:instagram.com/reel ${esTerm}`,                           gl:'es', hl:'es', num:20 } },
      ];

  const searches = await Promise.allSettled(
    serperCalls.map(({ endpoint, body }) =>
      fetch(`https://google.serper.dev/${endpoint}`, {
        method: 'POST',
        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json())
    )
  );

  const seen = new Set<string>();
  const candidates: VideoCandidate[] = [];

  for (const r of searches) {
    if (r.status !== 'fulfilled') continue;
    const data = r.value;

    // /videos devuelve { videos: [...] }, /search devuelve { organic: [...] }
    type SerperItem = {title?:string; link?:string; snippet?:string; imageUrl?:string; thumbnailUrl?:string};
    const items: SerperItem[] = data?.videos || data?.organic || [];

    for (const item of items) {
      const url   = item.link || '';
      const title = item.title || '';
      if (!url || seen.has(url)) continue;

      // Solo URLs válidas por plataforma
      if (platform==='tiktok' && !url.includes('tiktok.com')) continue;
      if (platform==='tiktok' && !url.includes('/video/') && !url.match(/tiktok\.com\/@[^/]+\/video/)) continue;
      if (platform==='instagram' && !url.includes('/reel/')) continue;
      if (platform==='youtube' && !url.includes('youtube.com/shorts/') && !url.includes('youtu.be/')) continue;

      seen.add(url);
      const viewsRaw = parseViewsFromSnippet(item.snippet || '');
      const channelMatch = url.match(/@([^/]+)/);
      const channel = channelMatch ? `@${channelMatch[1]}` : label;

      candidates.push({
        id: url,
        title: title.replace(/\s*[\|·—-]\s*TikTok.*$/i,'').replace(/\s*[\|·—-]\s*Instagram.*$/i,'').trim(),
        channel,
        views:       viewsRaw ? fmt(viewsRaw) : '—',
        likes:       '—',
        viewsRaw,
        likesRaw:    0,
        commentsRaw: 0,
        commentScore: 0.5,
        duration:    30,
        thumbnail:   item.imageUrl || '',
        url,
        platform,
        flag,
        langLabel: label,
        audioLang: '',
      });
    }
  }

  if (candidates.length === 0) {
    throw new Error(`No se encontraron videos de ${label} para "${tema}". Prueba con otro término.`);
  }

  // Ordenar: primero los que tienen views conocidos, luego el resto
  return guaranteeResults(candidates, allTerms, 12);
}

// ── IA evaluadora: filtra por valor real al tema ────────────────────────────
// GPT-4o-mini puntúa cada candidato 0-10 según relevancia + valor educativo replicable.
// Ruido (memes, música, clickbait sin valor) → score ≤ 3 → descartado.
async function aiScoreRelevance(
  candidates: VideoCandidate[],
  tema: string,
  topInput = 60,
  topOutput = 20,
  minScore = 7
): Promise<VideoCandidate[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || candidates.length === 0) return candidates.slice(0, topOutput);

  // Idioma del query → para boostear contenido en ese idioma
  const queryLang = detectQueryLanguage(tema);
  console.log(`[aiScore] queryLang detected: ${queryLang} for "${tema}"`);

  // ── 1. Agrupar por idioma para cuotas balanceadas ─────────────────────────
  const byLang = new Map<string, VideoCandidate[]>();
  for (const c of candidates) {
    const k = c.langLabel || 'Otros';
    if (!byLang.has(k)) byLang.set(k, []);
    byLang.get(k)!.push(c);
  }
  // Ordenar cada grupo por engagement
  for (const arr of byLang.values()) {
    arr.sort((a, b) => scoreComposite(b) - scoreComposite(a));
  }

  // ── 2. Tomar top N de cada idioma para enviar a la IA ─────────────────────
  const perLangInput = Math.ceil(topInput / Math.max(byLang.size, 1));
  const toScore: VideoCandidate[] = [];
  for (const arr of byLang.values()) {
    toScore.push(...arr.slice(0, perLangInput));
  }

  // Lote compacto con idioma para que la IA contextualice
  const list = toScore.map((v, i) =>
    `${i}|${v.langLabel}|${v.title.replace(/\s+/g,' ').slice(0,140)}|@${v.channel.slice(0,30)}`
  ).join('\n');

  // ── 3. Prompt entrenado: ejemplos, reglas multilingües, escala estricta ───
  const systemPrompt = `Eres un CURADOR ÉLITE de contenido educativo en TikTok, Instagram y YouTube. Trabajas para emprendedores, creators y profesionales que buscan APRENDER algo concreto. Tu trabajo es separar contenido de ALTO VALOR del ruido viral.

═══════════════════════════════════════
INPUT
═══════════════════════════════════════
Recibes una lista en formato:
"índice|idioma|título|@autor"

═══════════════════════════════════════
OUTPUT (estricto JSON, sin markdown)
═══════════════════════════════════════
{"scores":[{"i":0,"s":9},{"i":1,"s":2},...]}

═══════════════════════════════════════
ESCALA 0-10
═══════════════════════════════════════
🚫 0-2 RUIDO PURO (descartar)
- Memes, comedia, sketches, parodias, reacciones
- Patrones: "POV:", "When you...", "Nadie:", "Cuando…", "Me when"
- Música, letras, lyrics, dance challenges, lip-sync
- Drama, chisme, vida personal sin enseñanza
- Lifestyle de lujo sin contenido (autos, mansiones, viajes)
- Clickbait vacío: "No vas a creer", "Mira esto", "Esto cambió mi vida" sin sustancia
- Idiomas no soportados (hindi, árabe, chino, japonés, coreano, tailandés, etc.) → SIEMPRE 0

😐 3-4 IRRELEVANTE
- Menciona el tema solo de paso
- Motivación genérica, frases inspiradoras vacías
- "Trabaja duro", "Cree en ti", sin método ni framework
- Hablan del tema pero NO enseñan nada aplicable

✅ 5-6 ACEPTABLE
- Habla del tema con algo de sustancia pero superficial
- Tip muy básico o demasiado conocido
- Lista corta de obviedades

⭐ 7-8 BUENO
- Consejo claro, concreto y aplicable
- Caso de éxito con lección extraíble
- Framework, sistema o método específico
- Mentor demuestra credibilidad (resultados, empresa, libro)

🏆 9-10 ORO PURO
- Mentor con autoridad real (empresario reconocido, autor, experto)
- Caso de estudio detallado con números/datos
- Secreto poco conocido o framework completo
- Insight contraintuitivo respaldado con experiencia

═══════════════════════════════════════
EJEMPLOS DE CALIBRACIÓN
═══════════════════════════════════════
[ES] "3 negocios que puedes empezar con $500 — paso a paso" → 9 ✅
[EN] "How I built a 7-figure agency in 18 months" → 9 ✅
[PT] "5 erros que cometi no meu primeiro negócio (não repita)" → 8 ✅
[ES] "El framework de Naval Ravikant para crear riqueza" → 9 ✅
[EN] "POV: when your business partner ghosts you 😂" → 1 ❌
[ES] "Cuando intentas emprender pero…" → 1 ❌
[EN] "Entrepreneur grindset 💀🔥" → 1 ❌
[ES] "Trabaja duro, cree en ti mismo, todo es posible" → 3 ❌
[PT] "Acordar às 5am muda tudo" (sin método) → 4 ⚠️
[EN] "5 books every entrepreneur must read" → 7 ✅
[ES] "Mi día como CEO" (lifestyle sin enseñanza) → 3 ❌

═══════════════════════════════════════
REGLAS NO NEGOCIABLES
═══════════════════════════════════════
1. **RELEVANCIA AL TEMA del usuario:** prioridad alta pero no excluyente.
2. **Adyacencia se evalúa así:**
   - Habla DIRECTAMENTE de "${tema}" → 7+ (siempre que tenga calidad)
   - Habla de un nicho cercano y útil para el creador del tema (ej: para "negocios" → emprendimiento, escalar, ventas, marketing) → 5-7
   - Tema completamente diferente (ej: para "negocios" → salud, gym, recetas) → 0-3
3. Sé ULTRA ESTRICTO con la relevancia al tema. Ante la duda, baja el score 2 puntos.
4. ES/EN/PT: puntúa con la misma vara — NO favorezcas español.
5. Otros idiomas (hindi, árabe, chino, japonés, coreano, tailandés, vietnamita, indonesio, ruso, etc.) → score 0 sin excepciones.
6. Hashtags y emojis no aportan score: evalúa el contenido del título.
7. Autoridad del creador OBLIGATORIA para 7+: el @autor debe sonar a empresa real, mentor reconocido, marca consolidada o experto. Cuentas genéricas (nombres aleatorios, números al final, "official" sin contexto, "tips_xyz") → máximo 4.
8. Clickbait vacío sin payload concreto → máximo 3.
9. Contenido infantil, médico-clínico, lifestyle de marca, o promo de producto en el título → máximo 3.
10. **Trading/crypto especializado (gráficos, análisis técnico, predicciones bursátiles, "señales", "alertas")** → máximo 4 — es nicho técnico, no replicable para creators generales.
11. Títulos genéricos sin gancho específico → máximo 4.
12. Score 9-10 SOLO si el título promete framework concreto, números específicos, o cita autoridad nombrada (Naval, Hormozi, Buffett, etc.) Y trata el tema buscado.
13. Devuelve SOLO el JSON, sin explicaciones.`;

  let scoreMap = new Map<number, number>();

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: `Tema: "${tema}"\n\nLista a evaluar:\n${list}` },
        ],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim() || '{}';
      const parsed = JSON.parse(text) as { scores?: { i: number; s: number }[] };
      for (const item of parsed.scores || []) {
        if (typeof item.i === 'number' && typeof item.s === 'number') scoreMap.set(item.i, item.s);
      }
    }
  } catch (e) {
    console.warn('[IA] Error:', (e as Error).message);
  }

  // ── 3.5. Vision rescore (GPT-4o-mini con thumbnails) ─────────────────────
  // Aplicamos solo a los top 30 que pasaron el primer corte de IA (score >= minScore).
  // Esto descarta promos disfrazadas que el texto no detecta pero el banner sí.
  const topForVision = toScore
    .map((v, i) => ({ v, i, ai: scoreMap.get(i) ?? 0 }))
    .filter(x => x.ai >= minScore)
    .sort((a, b) => b.ai - a.ai)
    .slice(0, 30);

  if (topForVision.length > 0) {
    try {
      const visionScores = await visionRescore(
        topForVision.map(x => x.v),
        tema,
        30,
      );
      // Combinar: score final = (texto + visión) / 2.
      // Si el visual contradice fuerte (>= 3 puntos menos), pesa el visual.
      let visionAdjusted = 0;
      visionScores.forEach((vs, subsetIdx) => {
        const x = topForVision[subsetIdx];
        if (!x) return;
        const txtScore = x.ai;
        const combined = vs <= txtScore - 3
          ? vs                    // Visual fuertemente contradictorio → confiar en visual
          : Math.round((txtScore + vs) / 2); // Promedio
        scoreMap.set(x.i, combined);
        if (combined !== txtScore) visionAdjusted++;
      });
      console.log(`[vision] ajustó ${visionAdjusted}/${visionScores.size} scores`);
    } catch (e) {
      console.warn('[vision] error:', (e as Error).message);
      // No bloquear el flujo si vision falla
    }
  }

  // ── 4. Filtro duro post-IA + agrupar por idioma ──────────────────────────
  // Reglas no negociables:
  //  • IA score >= minScore (ya viene)
  //  • Si tiene stats verificadas → views >= 10K Y likes >= 500
  //  • Si stats están en 0 (no enriquecido) → solo entra si la IA le dio >= 8
  type Scored = { v: VideoCandidate; ai: number; viralScore: number };
  // Umbrales calibrados para un pool grande:
  //   - Estricto (HARD_MIN) = 40K vistas / 2K likes — sigue descartando contenido
  //     mediocre, pero permite que más videos virales medianos pasen.
  //   - Sin stats verificables → AI debe estar muy convencida (>=8).
  const HARD_MIN_VIEWS = 40_000;
  const HARD_MIN_LIKES = 2_000;
  const NO_STATS_MIN_AI = 8;

  const scoredByLang = new Map<string, Scored[]>();
  let dropped = { lowAi: 0, lowViews: 0, lowLikes: 0, noStats: 0, promo: 0 };

  for (let i = 0; i < toScore.length; i++) {
    const v  = toScore[i];
    const ai = scoreMap.get(i) ?? 0;
    if (ai < minScore) { dropped.lowAi++; continue; }

    // Filtro de promo disfrazada: si el caption suena a venta de
    // curso/mentoría/DM/whatsapp, descartar — no es contenido replicable.
    if (looksLikePromo(v.title)) { dropped.promo++; continue; }

    const hasStats = v.viewsRaw > 0 || v.likesRaw > 0;

    if (hasStats) {
      if (v.viewsRaw > 0 && v.viewsRaw < HARD_MIN_VIEWS) { dropped.lowViews++; continue; }
      if (v.likesRaw > 0 && v.likesRaw < HARD_MIN_LIKES) { dropped.lowLikes++; continue; }
    } else {
      // Sin stats → la IA tiene que estar relativamente convencida.
      if (ai < NO_STATS_MIN_AI) { dropped.noStats++; continue; }
    }

    // Score viral combinado: IA (0-10) × log de vistas × (1 + 5 * engagement)
    const views      = Math.max(v.viewsRaw, 1);
    const engagement = v.viewsRaw > 0 ? v.likesRaw / v.viewsRaw : 0;
    // Bonus por matchear idioma del query del usuario, pero moderado:
    // 30% más al match (no 60%) para que contenido viral global en otro idioma
    // siga siendo competitivo en temas nicho con poco contenido regional.
    const audioLangShort = (v.audioLang || '').split('-')[0].toLowerCase();
    const langMatchBonus = audioLangShort === queryLang ? 1.3
      : (queryLang === 'es' && audioLangShort === '') ? 1.05
      : 1.0;
    const viralScore = ai * Math.log10(views + 1) * (1 + 5 * Math.min(engagement, 0.2)) * langMatchBonus;

    const k = v.langLabel || 'Otros';
    if (!scoredByLang.has(k)) scoredByLang.set(k, []);
    scoredByLang.get(k)!.push({ v, ai, viralScore });
  }

  // Ordenar cada idioma por viralScore (combinación IA + virality real)
  for (const arr of scoredByLang.values()) {
    arr.sort((a, b) => b.viralScore - a.viralScore);
  }

  // ── 5. Round-robin con calidad: solo se rellena con videos cuyo viralScore
  //      sea al menos 50% del mejor global. Esto evita meter resultados flojos
  //      de un idioma con tal de "diversificar".
  const allScored: Scored[] = [];
  for (const arr of scoredByLang.values()) allScored.push(...arr);
  const bestGlobal = allScored.reduce((m, s) => Math.max(m, s.viralScore), 0);
  const qualityFloor = bestGlobal * 0.5;

  const final: VideoCandidate[] = [];
  const langs = Array.from(scoredByLang.keys());
  let round = 0;
  while (final.length < topOutput) {
    let added = false;
    for (const k of langs) {
      const bucket = scoredByLang.get(k)!;
      const next   = bucket[round];
      if (!next) continue;
      // Solo agregar si supera el piso de calidad (o es uno de los primeros 3 globales)
      if (final.length < 3 || next.viralScore >= qualityFloor) {
        final.push(next.v);
        added = true;
        if (final.length >= topOutput) break;
      }
    }
    if (!added) break;
    round++;
  }

  // Re-orden global final: dentro del top elegido, ordenar por viralScore puro
  // (no por round-robin) para que el #1 sea siempre el más viral
  const finalScored = final.map(v => {
    const lang = v.langLabel || 'Otros';
    const found = scoredByLang.get(lang)?.find(s => s.v.url === v.url);
    return { v, score: found?.viralScore ?? 0 };
  });
  finalScored.sort((a, b) => b.score - a.score);
  const finalOrdered = finalScored.map(s => s.v);

  console.log(`[IA] ${toScore.length} evaluados | descartados: lowAi=${dropped.lowAi} promo=${dropped.promo} lowViews=${dropped.lowViews} lowLikes=${dropped.lowLikes} noStats=${dropped.noStats} | aprobados: ${finalOrdered.length} | distribución: ${
    Array.from(scoredByLang.entries()).map(([k,v]) => `${k}:${v.length}`).join(', ')
  }`);

  // Cantidad objetivo: 25 resultados de calidad consistente.
  const TARGET_MIN = 25;
  // Floor para fillers: 30K vistas / 1.5K likes — videos de creators medianos
  // con engagement real (no mediocre, no spam).
  const QUALITY_FLOOR_VIEWS = 30_000;
  const QUALITY_FLOOR_LIKES = 1_500;

  if (finalOrdered.length >= TARGET_MIN) return finalOrdered;

  // Pasada 2: rellenar SOLO con candidatos que cumplen el quality floor.
  const fillerSet = new Set(finalOrdered.map(v => v.url));
  const candidatesByEngagement = [...candidates].sort(
    (a, b) => (b.viewsRaw + b.likesRaw * 8) - (a.viewsRaw + a.likesRaw * 8),
  );
  for (const c of candidatesByEngagement) {
    if (finalOrdered.length >= TARGET_MIN) break;
    if (fillerSet.has(c.url)) continue;
    if (looksLikePromo(c.title)) continue;
    // Si tiene stats, exigir el floor de calidad
    if (c.viewsRaw > 0 && c.viewsRaw < QUALITY_FLOOR_VIEWS) continue;
    if (c.likesRaw > 0 && c.likesRaw < QUALITY_FLOOR_LIKES) continue;
    finalOrdered.push(c);
    fillerSet.add(c.url);
  }

  // No hay pasada 3 con relax total. Si después del floor no llegamos a 6,
  // devolvemos lo que haya (ej. 4 resultados PERFECTOS) en vez de inflar
  // con junk. Mejor menos cantidad que peor calidad.
  return finalOrdered.slice(0, topOutput);
}

// ── Enriquecer reels de Instagram con engagement real vía Apify ──────────────
// Estrategia: Apify es más caro/lento que RapidAPI pero NO se queda sin cuota
// con plan Starter. Lo usamos para completar lo que RapidAPI no pudo enriquecer.
async function enrichInstagramReelsViaApify(
  candidates: VideoCandidate[],
  apifyToken: string,
  maxEnrich = 30,
): Promise<void> {
  // Filtrar solo los que aún no están enriquecidos y tomar hasta maxEnrich.
  const toEnrich = candidates.filter(c => !c.enriched).slice(0, maxEnrich);
  if (toEnrich.length === 0) return;

  const urls = toEnrich.map(c => c.url);
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyToken}&memory=512&timeout=120`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directUrls: urls,
          resultsType: 'posts',
          resultsLimit: urls.length,
          addParentData: false,
        }),
      },
    );
    if (!res.ok) {
      console.warn(`[enrichApify] HTTP ${res.status}`);
      return;
    }
    const items = await res.json();
    if (!Array.isArray(items)) return;

    // Indexar por shortcode para hacer match con candidates
    const byShort = new Map<string, Record<string, unknown>>();
    for (const it of items) {
      const short = (it as { shortCode?: string }).shortCode;
      if (short) byShort.set(short, it as Record<string, unknown>);
    }

    for (const c of toEnrich) {
      const m = c.url.match(/\/(?:reel|p)\/([A-Za-z0-9_-]+)/);
      const short = m?.[1];
      if (!short) continue;
      const data = byShort.get(short);
      if (!data) continue;

      const likes = (data.likesCount as number) || 0;
      const views = (data.videoViewCount as number) || (data.videoPlayCount as number) || 0;
      const comments = (data.commentsCount as number) || 0;
      const caption = (data.caption as string) || '';
      const owner = (data.ownerUsername as string) || '';

      if (likes > 0)    { c.likesRaw = likes; c.likes = fmt(likes); }
      if (views > 0)    { c.viewsRaw = views; c.views = fmt(views); }
      if (comments > 0) { c.commentsRaw = comments; }
      if (caption && c.title.startsWith('Reel de @')) c.title = caption.slice(0, 120);
      if (owner) c.channel = `@${owner}`;
      c.enriched = true;
    }
    console.log(`[enrichApify] enriched ${toEnrich.filter(c => c.enriched).length}/${toEnrich.length} reels`);
  } catch (e) {
    console.warn(`[enrichApify] error: ${(e as Error).message}`);
  }
}

// ── Enriquecer reels de Instagram con engagement real (instagram-looter2) ────
async function enrichInstagramReels(
  candidates: VideoCandidate[],
  rapidKey: string,
  maxEnrich = 25
): Promise<VideoCandidate[]> {
  // Limitar enriquecimiento a los primeros N (priorizando los que ya tienen views por snippet)
  const sorted = [...candidates].sort((a, b) => b.viewsRaw - a.viewsRaw);
  const toEnrich = sorted.slice(0, maxEnrich);
  const rest = sorted.slice(maxEnrich);

  type IgPost = {
    like_count?: number; play_count?: number; video_view_count?: number;
    edge_liked_by?: { count?: number };
    edge_media_preview_like?: { count?: number };
    edge_media_to_comment?: { count?: number };
    comment_count?: number;
    caption?: string;
    edge_media_to_caption?: { edges?: Array<{ node?: { text?: string } }> };
    owner?: { username?: string };
    user?: { username?: string };
  };

  await Promise.all(toEnrich.map(async (c) => {
    try {
      const res = await fetch(
        `https://instagram-looter2.p.rapidapi.com/post?link=${encodeURIComponent(c.url)}`,
        {
          headers: {
            'x-rapidapi-host': 'instagram-looter2.p.rapidapi.com',
            'x-rapidapi-key':  rapidKey,
          },
        }
      );
      if (!res.ok) return;
      const data: IgPost = await res.json();
      const likes    = data.like_count ?? data.edge_liked_by?.count ?? data.edge_media_preview_like?.count ?? 0;
      const views    = data.play_count ?? data.video_view_count ?? 0;
      const comments = data.comment_count ?? data.edge_media_to_comment?.count ?? 0;
      const caption  = data.caption || data.edge_media_to_caption?.edges?.[0]?.node?.text || '';
      const owner    = data.owner?.username || data.user?.username || '';

      if (likes > 0)    { c.likesRaw = likes; c.likes = fmt(likes); }
      if (views > 0)    { c.viewsRaw = views; c.views = fmt(views); }
      if (comments > 0) { c.commentsRaw = comments; }
      if (caption && c.title.startsWith('Reel de @')) c.title = caption.slice(0, 120);
      if (owner) c.channel = `@${owner}`;
      c.enriched = true;
    } catch { /* mantener stats originales */ }
  }));

  return [...toEnrich, ...rest];
}

// ── Cache vía Supabase ────────────────────────────────────────────────────────
// TTL: 24 horas. Si una búsqueda (tema+platform) se hizo en las últimas 24h,
// devolvemos lo cacheado en lugar de re-correr todo el pipeline.
// Tabla: public.viral_cache (cache_key PK, tema, platform, videos, fetched_at)
const CACHE_TTL_HOURS = 24;

function cacheKey(tema: string, platform: string): string {
  return `${tema.trim().toLowerCase()}|${platform}`;
}

async function readCache(tema: string, platform: string): Promise<unknown[] | null> {
  try {
    const { createServiceClient } = await import('@/lib/supabase/server');
    const sb = createServiceClient();
    const { data, error } = await sb
      .from('viral_cache')
      .select('videos, fetched_at')
      .eq('cache_key', cacheKey(tema, platform))
      .maybeSingle();
    if (error || !data) return null;
    const ageMs = Date.now() - new Date(data.fetched_at).getTime();
    if (ageMs > CACHE_TTL_HOURS * 60 * 60 * 1000) return null;
    return data.videos as unknown[];
  } catch { return null; }
}

async function writeCache(tema: string, platform: string, videos: unknown[]): Promise<void> {
  if (!Array.isArray(videos) || videos.length === 0) return;
  try {
    const { createServiceClient } = await import('@/lib/supabase/server');
    const sb = createServiceClient();
    await sb.from('viral_cache').upsert(
      {
        cache_key: cacheKey(tema, platform),
        tema: tema.trim().toLowerCase(),
        platform,
        videos,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'cache_key' },
    );
  } catch (e) {
    console.warn('[cache] write error:', (e as Error).message);
  }
}

// Helper: responde con videos y fire-and-forget escribe al cache.
// Usar en lugar de `return Response.json({ videos })` en handlers que
// resuelven búsquedas exitosas para que las próximas requests las tengan
// instantáneas.
function respondAndCache(tema: string, platform: string, videos: unknown[]) {
  // No bloqueamos la respuesta esperando el write — best-effort.
  void writeCache(tema, platform, videos);
  return Response.json({ videos });
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { tema, platform } = await req.json();
  if (!tema) return Response.json({ error:'Falta el tema' },{status:400});

  // ── Cache hit? — devolver instantáneo si la búsqueda está fresca ────────
  const cached = await readCache(tema, platform);
  if (cached && cached.length > 0) {
    console.log(`[cache] HIT ${tema}|${platform} (${cached.length} videos)`);
    return Response.json({ videos: cached, cached: true });
  }

  // ── Expansión de keywords con IA (SIEMPRE, también para temas conocidos) ─────
  // La IA enriquece con variantes nativas que el mapa no tiene
  const enMapa = findMapEntry(tema) !== null;
  const aiKeys: AIKeywords | null = await expandWithAI(tema);

  // Helper: tema enriquecido por IA o el original
  function temaES(): string { return aiKeys?.es?.[0] || tema; }
  function temaEN(): string { return aiKeys?.en?.[0] || tema; }
  function temaPT(): string { return aiKeys?.pt?.[0] || tema; }

  // Inyectar keywords de IA en el mapa temporal para que todas las funciones las usen
  if (aiKeys && !enMapa) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (TEMA_MAP as any)[norm(tema).replace(/[^a-z0-9]/g,'')] = {
      es: aiKeys.es, en: aiKeys.en, pt: aiKeys.pt,
    };
  }

  console.log(`[virales] tema="${tema}" enMapa=${enMapa} aiKeys=${JSON.stringify(aiKeys)}`);

  if (platform==='youtube') {
    const serperKey = process.env.SERPER_API_KEY;
    const ytKey     = process.env.YOUTUBE_API_KEY;

    // 1. Serper — búsqueda profunda en ES + EN + PT en paralelo
    if (serperKey) {
      try {
        // Si tenemos keywords de IA, buscamos en múltiples variantes a la vez
        const searches = aiKeys
          ? await Promise.allSettled([
              searchViaSerper(tema, 'youtube' as never, serperKey),
              searchViaSerper(temaEN(), 'youtube' as never, serperKey),
            ])
          : [{ status: 'fulfilled' as const, value: await searchViaSerper(tema, 'youtube' as never, serperKey) }];

        const allVideos: VideoCandidate[] = [];
        for (const r of searches) {
          if (r.status === 'fulfilled') allVideos.push(...(r.value as VideoCandidate[]));
        }
        // Deduplicar por URL
        const seen = new Set<string>();
        const unique = allVideos.filter((v) => {
          if (seen.has(v.url)) return false;
          seen.add(v.url); return true;
        });
        if (unique.length > 0) {
          // Enriquecer con stats reales del YouTube Data API antes de filtrar.
          // Sin esto, Serper devuelve URLs vacías y el filtro de virality
          // (HARD_MIN_VIEWS/LIKES) no puede aplicar — colábamos shorts con 1 like.
          if (ytKey) {
            await enrichYouTubeStats(unique, ytKey);
          }

          const allTerms = getAllTerms(tema);
          const preFiltered = topByViews(unique, allTerms, 250);
          const final = await aiScoreRelevance(preFiltered, tema, 250, 100, 6);
          // Si el filtro de IA descartó todo (porque Serper no trae stats y la
          // IA es muy estricta sin ellas), caemos al YouTube Data API que sí
          // devuelve videos con vistas/likes verificadas.
          if (final.length > 0) {
            return respondAndCache(tema, platform, final);
          }
          console.warn(`[virales] Serper devolvió ${unique.length} pero filtro IA dejó 0. Fallback a YouTube API.`);
        }
      } catch(e) {
        console.warn('Serper YouTube falló:', (e as Error).message);
      }
    }

    // 2. YouTube Data API — fallback (siempre que Serper haya quedado vacío,
    // ya sea porque falló o porque el filtro IA descartó todo)
    if (ytKey) {
      const termToSearch = aiKeys ? temaES() : tema;
      try {
        const ytVideos = await searchYouTube(termToSearch, ytKey);
        if (ytVideos.length > 0) return respondAndCache(tema, platform, ytVideos);
      }
      catch(e) { console.warn('YouTube API falló:', (e as Error).message); }
    }

    return Response.json({ error: 'No se encontraron videos de YouTube. Intenta con otro tema.' }, { status: 422 });
  }

  if (platform==='tiktok') {
    const serperKey = process.env.SERPER_API_KEY;
    const rapidKey  = process.env.RAPIDAPI_KEY;
    const apifyToken = process.env.APIFY_TOKEN;

    // 1. Apify — PRIMARIO: usa el motor de búsqueda nativo de TikTok,
    // así obtenemos lo mismo que se ve abriendo la app y buscando.
    if (apifyToken) {
      try {
        const videos = await searchViaApify(tema, 'tiktok', apifyToken, aiKeys);
        if (videos.length > 0) {
          const allTerms = getAllTerms(tema);
          const preFiltered = topByViews(videos, allTerms, 200);
          const final = await aiScoreRelevance(preFiltered, tema, 200, 100, 6);
          if (final.length > 0) return respondAndCache(tema, platform, final);
          // Si el filtro IA descarta todo pero Apify devolvió contenido,
          // devolvemos top 20 por views (Apify ya viene ordenado por trending)
          const topByViewsRaw = [...videos]
            .sort((a, b) => b.viewsRaw - a.viewsRaw)
            .slice(0, 20);
          if (topByViewsRaw.length > 0) return respondAndCache(tema, platform, topByViewsRaw);
        }
      } catch(e) {
        console.warn('Apify TikTok falló:', (e as Error).message);
      }
    }

    // 2. TikWM — fallback (free, rate-limited)
    try {
      // Construir términos por idioma: IA + mapa + tema base
      const entry = findMapEntry(tema);
      const esTerms = Array.from(new Set([
        ...(aiKeys?.es || []),
        ...(entry?.es || []),
        tema,
      ])).slice(0, 5);
      const enTerms = Array.from(new Set([
        ...(aiKeys?.en || []),
        ...(entry?.en || []),
      ])).slice(0, 5);
      const ptTerms = Array.from(new Set([
        ...(aiKeys?.pt || []),
        ...(entry?.pt || []),
      ])).slice(0, 5);

      console.log(`[TikTok] keywords ES=${esTerms.join('|')} EN=${enTerms.join('|')} PT=${ptTerms.join('|')}`);

      // Buscar cada keyword con 8 páginas (~160 videos) — en paralelo
      const [esResults, enResults, ptResults] = await Promise.allSettled([
        Promise.all(esTerms.map(t => fetchTikWMSearch(t, 8))).then(r => r.flat()),
        Promise.all(enTerms.map(t => fetchTikWMSearch(t, 8))).then(r => r.flat()),
        Promise.all(ptTerms.map(t => fetchTikWMSearch(t, 8))).then(r => r.flat()),
      ]);

      const seen = new Set<string>();
      const candidates: VideoCandidate[] = [];

      const buckets = [
        { result: esResults, lang: LANGS[0] },
        { result: enResults, lang: LANGS[1] },
        { result: ptResults, lang: LANGS[2] },
      ];

      for (const { result, lang } of buckets) {
        if (result.status !== 'fulfilled') continue;
        for (const v of result.value) {
          const id = v.video_id || '';
          if (!id || seen.has(id)) continue;
          seen.add(id);
          const c = tikwmToCandidate(v, lang);
          if (c) candidates.push(c);
        }
      }

      console.log(`[TikTok] ${candidates.length} candidatos recolectados`);

      if (candidates.length > 0) {
        const allTerms = getAllTerms(tema);
        // 1) Filtros tradicionales (tema, likes, blacklist) — top 250
        const preFiltered = topByViews(candidates, allTerms, 250);
        // 2) IA cura los 250 → top 100
        const final = await aiScoreRelevance(preFiltered, tema, 250, 100, 6);
        // Si el filtro IA dejó algo, lo devolvemos. Si no, caemos al fallback.
        if (final.length > 0) return respondAndCache(tema, platform, final);
        console.warn(`[virales] TikWM devolvió ${candidates.length} pero filtro IA dejó 0. Fallback a Serper/Rapid.`);
      }
    } catch(e) {
      console.warn('TikWM falló:', (e as Error).message);
    }

    // 3. Serper — fallback
    if (serperKey) {
      try {
        const videos = await searchViaSerper(tema, 'tiktok', serperKey);
        if (videos.length > 0) return Response.json({ videos });
      } catch(e) {
        console.warn('Serper TikTok falló:', (e as Error).message);
      }
    }

    // 4. RapidAPI — último recurso
    if (rapidKey) {
      try {
        const videos = await searchTikTok(tema, rapidKey);
        return Response.json({ videos });
      } catch(e) { return Response.json({ error: `TikTok: ${(e as Error).message}` }, { status: 502 }); }
    }

    return Response.json({ error: 'No se encontraron videos en TikTok.' }, { status: 422 });
  }

  if (platform==='instagram') {
    const apifyToken = process.env.APIFY_TOKEN;
    const serperKey  = process.env.SERPER_API_KEY;
    const rapidKey   = process.env.RAPIDAPI_KEY;

    // 1. Apify — PRIMARIO: hashtag scraper con engagement real.
    // Tracking si Apify funcionó pero el tema simplemente NO tiene reels virales
    // en IG (típico para temas muy fotograficos como #cerveza, #comida, etc.)
    let apifyWorkedButEmpty = false;
    if (apifyToken) {
      try {
        const videos = await searchViaApify(tema, 'instagram', apifyToken, aiKeys);
        if (videos.length > 0) {
          const allTerms = getAllTerms(tema);
          const preFiltered = topByViews(videos, allTerms, 200);
          const final = await aiScoreRelevance(preFiltered, tema, 200, 100, 6);
          if (final.length > 0) return respondAndCache(tema, platform, final);
          // Fallback: si IA descarta todo, devolver top 20 por views/likes
          const topByEngagement = [...videos]
            .sort((a, b) => (b.viewsRaw + b.likesRaw * 10) - (a.viewsRaw + a.likesRaw * 10))
            .slice(0, 20);
          if (topByEngagement.length > 0) return respondAndCache(tema, platform, topByEngagement);
        } else {
          // Apify funcionó pero devolvió 0 videos = tema sin contenido viral en IG.
          // No tiene sentido caer a RapidAPI (que va a fallar igual). Mensaje claro.
          apifyWorkedButEmpty = true;
        }
      } catch(e) {
        console.warn('Apify Instagram falló:', (e as Error).message);
      }
    }

    // Si Apify funcionó pero no hay videos del tema → mensaje claro, no RapidAPI
    if (apifyWorkedButEmpty) {
      return Response.json({
        error: `No encontramos reels virales en Instagram para "${tema}". Probá un tema más popular o buscá en TikTok/YouTube.`,
      }, { status: 422 });
    }

    // 2. Serper — fallback (Google search en site:instagram.com)
    if (serperKey) {
      try {
        // Búsqueda profunda: tema base + keywords IA en 3 idiomas, en paralelo.
        // Cuanta más diversidad de queries, más material le damos al filtro IA.
        const igQueries: Array<Promise<VideoCandidate[]>> = [
          searchViaSerper(tema, 'instagram', serperKey),
        ];
        if (aiKeys) {
          // Una query por cada keyword IA (hasta 2 por idioma) — más cobertura.
          for (const k of (aiKeys.es || []).slice(0, 2)) {
            if (k && k !== tema) igQueries.push(searchViaSerper(k, 'instagram', serperKey));
          }
          for (const k of (aiKeys.en || []).slice(0, 2)) {
            if (k) igQueries.push(searchViaSerper(k, 'instagram', serperKey));
          }
          for (const k of (aiKeys.pt || []).slice(0, 2)) {
            if (k) igQueries.push(searchViaSerper(k, 'instagram', serperKey));
          }
        }

        const searches = await Promise.allSettled(igQueries);

        const allVideos: VideoCandidate[] = [];
        for (const r of searches) {
          if (r.status === 'fulfilled') allVideos.push(...(r.value as VideoCandidate[]));
        }
        const seen = new Set<string>();
        let unique = allVideos.filter((v) => {
          if (seen.has(v.url)) return false;
          seen.add(v.url); return true;
        });
        console.log(`[Instagram] ${unique.length} URLs únicos de ${searches.length} queries`);

        // Marcar todos como no enriquecidos por defecto
        unique.forEach(v => { v.enriched = false; });

        // 1) Enriquecer con RapidAPI (rápido, gratis hasta 500/mes)
        if (rapidKey && unique.length > 0) {
          unique = await enrichInstagramReels(unique, rapidKey, 50);
        }

        // 2) Apify como fallback robusto: completa los que RapidAPI no pudo
        // (cuota agotada o errores) — toma 30-90s pero con plan Starter aguanta
        // miles de reels al mes. Lo corremos en paralelo con el filtro tradicional.
        if (apifyToken && unique.some(v => !v.enriched)) {
          await enrichInstagramReelsViaApify(unique, apifyToken, 40);
        }

        const allTerms = getAllTerms(tema);
        // 1) Filtros tradicionales (tema en caption, blacklist, likes solo si verified)
        const preFiltered = topByViews(unique, allTerms, 200);
        // 2) IA evalúa relevancia + valor → top 100
        const final = await aiScoreRelevance(preFiltered, tema, 200, 100, 6);
        if (final.length > 0) return respondAndCache(tema, platform, final);
      } catch(e) {
        console.warn('Serper Instagram falló:', (e as Error).message);
      }
    }

    // 3. RapidAPI — último recurso (free tier, ~500/mes)
    if (rapidKey) {
      try {
        return Response.json({ videos: await searchInstagram(tema, rapidKey) });
      } catch(e) { return Response.json({ error: `Instagram: ${(e as Error).message}` }, { status: 502 }); }
    }

    return Response.json({ error: 'No se encontraron reels en Instagram.' }, { status: 422 });
  }

  return Response.json({ error:'Plataforma no soportada' }, { status: 400 });
}
