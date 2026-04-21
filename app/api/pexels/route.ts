import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') || 'business';
  const apiKey = process.env.PEXELS_API_KEY;

  if (!apiKey) return Response.json({ error: 'Falta PEXELS_API_KEY' }, { status: 422 });

  try {
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=15&orientation=portrait`,
      { headers: { Authorization: apiKey } }
    );
    if (!res.ok) throw new Error('Error al conectar con Pexels');
    const data = await res.json();

    const videos = (data.videos || []).map((v: {
      id: number;
      image: string;
      duration: number;
      width: number;
      height: number;
      video_files: { quality: string; width: number; link: string }[];
    }) => {
      // Preferir calidad HD, sino SD
      const file = v.video_files
        .filter(f => f.quality === 'hd' || f.quality === 'sd')
        .sort((a, b) => b.width - a.width)[0];
      return {
        id: v.id,
        thumbnail: v.image,
        url: file?.link || '',
        duration: v.duration,
        width: v.width,
        height: v.height,
      };
    }).filter((v: { url: string }) => v.url);

    return Response.json({ videos });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
