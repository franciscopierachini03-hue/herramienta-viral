// Detecta typos comunes en el dominio del email y sugiere correcciones.
// Ejemplos: gmaoil.com → gmail.com, hotmial → hotmail, etc.
//
// Uso:
//   const fix = suggestEmailFix("franco@gmaoil.com");
//   if (fix) { console.log(fix); // "franco@gmail.com" }

const KNOWN_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com',
  'yahoo.com.mx',
  'yahoo.com.ar',
  'icloud.com',
  'live.com',
  'me.com',
  'protonmail.com',
];

// Distancia de Levenshtein simple (suficiente para typos cortos)
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Si el dominio del email es muy parecido (1-2 letras de diferencia) a un
 * dominio conocido, devuelve la versión corregida. Sino devuelve null.
 */
export function suggestEmailFix(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase().trim();
  if (!domain.includes('.')) return null;

  // Si el dominio ya es conocido exacto → no hace falta corregir
  if (KNOWN_DOMAINS.includes(domain)) return null;

  // Buscar el más cercano
  let best: { d: string; dist: number } | null = null;
  for (const known of KNOWN_DOMAINS) {
    const dist = levenshtein(domain, known);
    if (dist === 0) return null;
    if (dist <= 2 && (!best || dist < best.dist)) {
      best = { d: known, dist };
    }
  }

  if (!best) return null;
  return `${local}@${best.d}`;
}
