import { NextRequest } from 'next/server';

export const maxDuration = 10;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return new Response('Missing url', { status: 400 });

  // Solo permitir dominios de Instagram y TikTok
  const allowed = ['instagram.com', 'cdninstagram.com', 'fbcdn.net', 'tiktokcdn.com', 'tiktok.com', 'musical.ly'];
  try {
    const hostname = new URL(url).hostname;
    if (!allowed.some(d => hostname.endsWith(d))) {
      return new Response('Domain not allowed', { status: 403 });
    }
  } catch {
    return new Response('Invalid url', { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://www.instagram.com/',
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
