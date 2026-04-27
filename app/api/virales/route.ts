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
interface AIKeywords { es: string[]; en: string[]; pt: string[] }

async function expandWithAI(tema: string): Promise<AIKeywords | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 200,
        messages: [{
          role: 'system',
          content: `Eres un experto en SEO para redes sociales. Dado un tema, devuelves EXACTAMENTE un JSON con keywords de búsqueda en 3 idiomas para encontrar videos virales en TikTok, Instagram y YouTube.
Formato ESTRICTO (sin markdown, solo JSON):
{"es":["keyword1","keyword2","keyword3"],"en":["keyword1","keyword2","keyword3"],"pt":["keyword1","keyword2"]}
- Las keywords deben ser términos de búsqueda reales que la gente usa en cada plataforma
- Máximo 3 keywords por idioma, sin artículos ni palabras vacías
- En inglés siempre, incluso si el tema está en español`,
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
  views: string; likes: string; viewsRaw: number;
  commentsRaw: number;
  commentScore: number; // 0 = todo ruido, 1 = todo valor, 0.5 = neutral/sin datos
  duration: number; thumbnail: string; url: string;
  platform: string; flag: string; langLabel: string; audioLang: string;
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

    // Siempre: el tema DEBE aparecer en el título limpio (en cualquier idioma)
    if (!hasTopicInTitle(titleNorm, allTerms)) return false;

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

// Deduplicar + filtrar (loose) + ordenar por vistas → devolver top N
function topByViews(candidates: VideoCandidate[], topN = 20): VideoCandidate[] {
  const urlSeen = new Set<string>();
  const deduped = candidates.filter(v => {
    if (urlSeen.has(v.url)) return false;
    urlSeen.add(v.url);
    return true;
  });
  // Aplicar filtro básico (loose): descarta duración inválida y blacklist
  const filtered = applyFilter(deduped, [], 'loose');
  // Ordenar por vistas (mayor a menor) y devolver top N
  return filtered
    .sort((a, b) => scoreComposite(b) - scoreComposite(a))
    .slice(0, topN);
}

// Compatibilidad con código existente
function guaranteeResults(candidates: VideoCandidate[], _allTerms: string[], minResults: number): VideoCandidate[] {
  return topByViews(candidates, minResults);
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
    viewsRaw: v.play_count || 0, commentsRaw: v.comment_count || 0,
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
      viewsRaw:m.play_count||0, commentsRaw:0, commentScore:0.5, duration:30, thumbnail:m.image_versions2?.candidates?.[0]?.url||'',
      url:m.code?`https://www.instagram.com/reel/${m.code}/`:`https://www.instagram.com/${u}/`,
      platform:'instagram', flag:'🌐', langLabel:'Mixed', audioLang:'',
    };
  });

  return guaranteeResults(candidates, allTerms, 8);
}

// ── Apify — scrapers nativos de TikTok e Instagram ───────────────────────────
async function searchViaApify(tema: string, platform: 'tiktok'|'instagram', apifyToken: string) {
  const entry = findMapEntry(tema);
  const allTerms = getAllTerms(tema);

  const esTerm = entry?.es?.[0] || tema;
  const enTerm = entry?.en?.[0] || tema;

  let items: unknown[] = [];

  if (platform === 'tiktok') {
    // clockworks/tiktok-scraper — busca por keyword (usa timeout alto por el cold start)
    const keywords = [esTerm, enTerm].filter((v, i, a) => a.indexOf(v) === i);
    const res = await fetch(
      `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${apifyToken}&memory=512&timeout=120`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchSection: 'keyword',
          searchQueries: keywords,
          maxItems: 20,
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
    // apify/instagram-scraper — busca por hashtag
    const hashtags = [
      `https://www.instagram.com/explore/tags/${encodeURIComponent(esTerm.replace(/\s+/g,''))}/`,
      `https://www.instagram.com/explore/tags/${encodeURIComponent(enTerm.replace(/\s+/g,''))}/`,
    ].filter((v, i, a) => a.indexOf(v) === i);
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyToken}&memory=512&timeout=120`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directUrls: hashtags, resultsType: 'posts', resultsLimit: 30, addParentData: false }),
      }
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => String(res.status));
      throw new Error(`Apify Instagram ${res.status}: ${errText.slice(0, 200)}`);
    }
    items = await res.json();
  }

  if (!Array.isArray(items) || items.length === 0) throw new Error('Sin resultados de Apify');

  const flag  = platform === 'tiktok' ? '🎵' : '📸';
  const label = platform === 'tiktok' ? 'TikTok' : 'Instagram';

  const candidates: VideoCandidate[] = items.map((raw) => {
    const v = raw as Record<string, unknown>;

    if (platform === 'tiktok') {
      const id       = (v.id as string) || '';
      const authorId = (v.authorMeta as Record<string,unknown>)?.name as string || '';
      const plays    = (v.playCount as number) || 0;
      return {
        id,
        title:     (v.text as string)?.slice(0, 120) || 'Video de TikTok',
        channel:   `@${authorId}`,
        views:       fmt(plays), likes: fmt((v.diggCount as number) || 0),
        viewsRaw:    plays, commentsRaw: (v.commentCount as number) || 0, commentScore: 0.5,
        duration:    (v.videoMeta as Record<string,unknown>)?.duration as number || 30,
        thumbnail:   (v.covers as string[])?.[0] || (v.coverUrl as string) || '',
        url:         `https://www.tiktok.com/@${authorId}/video/${id}`,
        platform, flag, langLabel: label, audioLang: '',
      };
    } else {
      const shortCode = (v.shortCode as string) || '';
      const owner     = (v.ownerUsername as string) || '';
      const plays     = (v.videoPlayCount as number) || (v.likesCount as number) || 0;
      return {
        id:          shortCode || owner,
        title:       (v.caption as string)?.slice(0, 120) || `Reel de @${owner}`,
        channel:     `@${owner}`,
        views:       fmt(plays), likes: fmt((v.likesCount as number) || 0),
        viewsRaw:    plays, commentsRaw: (v.commentsCount as number) || 0, commentScore: 0.5,
        duration:    (v.videoDuration as number) || 30,
        thumbnail:   (v.displayUrl as string) || '',
        url:         shortCode ? `https://www.instagram.com/reel/${shortCode}/` : `https://www.instagram.com/${owner}/`,
        platform, flag, langLabel: label, audioLang: '',
      };
    }
  });

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

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { tema, platform } = await req.json();
  if (!tema) return Response.json({ error:'Falta el tema' },{status:400});

  // ── Expansión de keywords con IA (si el tema no está en el mapa) ─────────────
  // Se hace UNA VEZ y se inyecta en la lógica de búsqueda de cada plataforma
  const enMapa = findMapEntry(tema) !== null;
  const aiKeys: AIKeywords | null = enMapa ? null : await expandWithAI(tema);

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

        const allVideos: unknown[] = [];
        for (const r of searches) {
          if (r.status === 'fulfilled') allVideos.push(...(r.value as unknown[]));
        }
        // Deduplicar por URL
        const seen = new Set<string>();
        const unique = allVideos.filter((v: unknown) => {
          const url = (v as { url: string }).url;
          if (seen.has(url)) return false;
          seen.add(url); return true;
        });
        if (unique.length > 0) return Response.json({ videos: unique.slice(0, 20) });
      } catch(e) {
        console.warn('Serper YouTube falló:', (e as Error).message);
      }
    }

    // 2. YouTube Data API — fallback
    if (ytKey) {
      const termToSearch = aiKeys ? temaES() : tema;
      try { return Response.json({ videos: await searchYouTube(termToSearch, ytKey) }); }
      catch(e) { console.warn('YouTube API falló:', (e as Error).message); }
    }

    return Response.json({ error: 'No se encontraron videos de YouTube. Intenta con otro tema.' }, { status: 422 });
  }

  if (platform==='tiktok') {
    const serperKey = process.env.SERPER_API_KEY;
    const rapidKey  = process.env.RAPIDAPI_KEY;

    // 1. TikWM — ~100 videos por idioma, top 20 por vistas
    try {
      // Construir términos por idioma: principal de IA o del mapa
      const entry = findMapEntry(tema);
      const esTerms = aiKeys ? aiKeys.es : (entry?.es?.slice(0,3) || [tema]);
      const enTerms = aiKeys ? aiKeys.en : (entry?.en?.slice(0,3) || [tema]);
      const ptTerms = aiKeys ? aiKeys.pt : (entry?.pt?.slice(0,2) || [tema]);

      // Buscar cada keyword con 5 páginas (~100 videos) — en paralelo por idioma
      const [esResults, enResults, ptResults] = await Promise.allSettled([
        Promise.all(esTerms.map(t => fetchTikWMSearch(t, 5))).then(r => r.flat()),
        Promise.all(enTerms.map(t => fetchTikWMSearch(t, 5))).then(r => r.flat()),
        Promise.all(ptTerms.map(t => fetchTikWMSearch(t, 5))).then(r => r.flat()),
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

      console.log(`[TikTok] ${candidates.length} candidatos recolectados, devolviendo top 20`);

      if (candidates.length > 0) {
        return Response.json({ videos: topByViews(candidates, 20) });
      }
    } catch(e) {
      console.warn('TikWM falló:', (e as Error).message);
    }

    // 2. Serper — fallback
    if (serperKey) {
      try {
        const videos = await searchViaSerper(tema, 'tiktok', serperKey);
        if (videos.length > 0) return Response.json({ videos });
      } catch(e) {
        console.warn('Serper TikTok falló:', (e as Error).message);
      }
    }

    // 3. RapidAPI — último recurso
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

    // 1. Serper — búsqueda en ES + EN en paralelo (primary para Instagram)
    if (serperKey) {
      try {
        const searches = aiKeys
          ? await Promise.allSettled([
              searchViaSerper(tema, 'instagram', serperKey),
              searchViaSerper(temaEN(), 'instagram', serperKey),
            ])
          : [{ status: 'fulfilled' as const, value: await searchViaSerper(tema, 'instagram', serperKey) }];

        const allVideos: unknown[] = [];
        for (const r of searches) {
          if (r.status === 'fulfilled') allVideos.push(...(r.value as unknown[]));
        }
        const seen = new Set<string>();
        const unique = allVideos.filter((v: unknown) => {
          const url = (v as { url: string }).url;
          if (seen.has(url)) return false;
          seen.add(url); return true;
        });
        if (unique.length > 0) return Response.json({ videos: unique.slice(0, 20) });
      } catch(e) {
        console.warn('Serper Instagram falló:', (e as Error).message);
      }
    }

    // 2. Apify
    if (apifyToken) {
      try {
        const videos = await searchViaApify(tema, platform, apifyToken);
        return Response.json({ videos });
      } catch(e) {
        console.warn('Apify falló:', (e as Error).message);
      }
    }

    // 3. RapidAPI
    if (rapidKey) {
      try {
        return Response.json({ videos: await searchInstagram(tema, rapidKey) });
      } catch(e) { return Response.json({ error: `Instagram: ${(e as Error).message}` }, { status: 502 }); }
    }

    return Response.json({ error: 'No se encontraron reels en Instagram.' }, { status: 422 });
  }

  return Response.json({ error:'Plataforma no soportada' }, { status: 400 });
}
