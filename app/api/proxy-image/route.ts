import { NextRequest } from 'next/server';

export const maxDuration = 10;

// Dominios permitidos para evitar SSRF (lista por sufijos válidos)
const ALLOWED_SUFFIXES = [
  'instagram.com',
  'cdninstagram.com',
  'fbcdn.net',
  // TikTok variantes regionales
  'tiktokcdn.com',
  'tiktokcdn-eu.com',
  'tiktokcdn-us.com',
  'tiktok.com',
  'musical.ly',
  'byteoversea.com',
];

function getReferer(hostname: string): string {
  if (hostname.includes('tiktok')) return 'https://www.tiktok.com/';
  if (hostname.includes('musical')) return 'https://www.tiktok.com/';
  if (hostname.includes('byteoversea')) return 'https://www.tiktok.com/';
  return 'https://www.instagram.com/';
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return new Response('Missing url', { status: 400 });

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return new Response('Invalid url', { status: 400 });
  }
  if (!ALLOWED_SUFFIXES.some(d => hostname.endsWith(d))) {
    return new Response('Domain not allowed', { status: 403 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': getReferer(hostname),
      },
    });

    if (!res.ok) return new Response('Failed to fetch image', { status: res.status });

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = await res.arrayBuffer();

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new Response('Error fetching image', { status: 502 });
  }
}
