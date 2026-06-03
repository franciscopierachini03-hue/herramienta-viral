#!/usr/bin/env python3
"""
Genera el plan de b-roll para un video:
  1. Lee la transcripción (con timing)
  2. La IA (Groq) la segmenta en beats con una query visual de stock cada uno
  3. Busca en Pexels un clip vertical por query
  4. Escribe props-broll.json (words + broll[])

Uso: python3 scripts/broll-plan.py <transcript.json> <out_props.json>
Requiere GROQ_API_KEY y PEXELS_API_KEY en el entorno.
"""
import json, os, sys, urllib.request, urllib.parse

GROQ = os.environ["GROQ_API_KEY"]
PEXELS = os.environ["PEXELS_API_KEY"]


def groq_plan(text, duration):
    prompt = f"""Sos editor de video viral. Te doy la transcripción de un video de {duration:.0f} segundos.
Generá un plan de B-ROLL con CORTES PUNTUALES (NO cubrir todo el video — el orador se ve la mayor parte del tiempo).

Reglas:
- SOLO 3 a 4 segmentos en TOTAL, en los momentos más visuales/impactantes.
- Cada segmento dura entre 2.5 y 4 segundos.
- NO contiguos: dejá huecos grandes entre ellos (donde se ve al orador).
- "query": 1-3 palabras EN INGLÉS, término visual concreto y filmable (ej: "praying hands", "happy family", "sunrise sky", "child smiling"). Que matchee lo que se dice en ese momento.

Devolvé SOLO JSON: {{"segments":[{{"start":8,"end":11,"query":"praying hands"}}, ...]}}

Transcripción:
{text}"""
    body = json.dumps({
        "model": "llama-3.3-70b-versatile",
        "temperature": 0.4,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "user", "content": prompt}],
    }).encode()
    req = urllib.request.Request("https://api.groq.com/openai/v1/chat/completions", body,
        {"Authorization": f"Bearer {GROQ}", "Content-Type": "application/json",
         "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"})
    data = json.load(urllib.request.urlopen(req, timeout=60))
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)["segments"]


def pexels_clip(query, min_dur):
    q = urllib.parse.quote(query)
    url = f"https://api.pexels.com/videos/search?query={q}&orientation=portrait&per_page=5"
    req = urllib.request.Request(url, headers={"Authorization": PEXELS,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"})
    data = json.load(urllib.request.urlopen(req, timeout=30))
    vids = data.get("videos", [])
    # preferir clips suficientemente largos
    vids.sort(key=lambda v: (v.get("duration", 0) < min_dur, -(v.get("duration", 0))))
    for v in vids:
        # elegir un mp4 vertical ~1080 de ancho
        files = [f for f in v["video_files"] if f.get("file_type") == "video/mp4"]
        files.sort(key=lambda f: abs((f.get("width") or 0) - 1080))
        if files:
            return files[0]["link"]
    return None


def main():
    transcript_path, out_path = sys.argv[1], sys.argv[2]
    tr = json.load(open(transcript_path))
    words = [{"text": w["word"].strip(), "start": w["start"], "end": w["end"]}
             for w in tr.get("words", []) if w["word"].strip()]
    duration = words[-1]["end"] if words else 30
    text = tr.get("text", "")

    print(f"Generando plan de b-roll para {duration:.0f}s...")
    segments = groq_plan(text, duration)
    print(f"IA propuso {len(segments)} segmentos")

    broll = []
    for s in segments:
        dur = s["end"] - s["start"]
        link = pexels_clip(s["query"], dur)
        status = "OK" if link else "sin clip"
        print(f"  [{s['start']:.0f}-{s['end']:.0f}s] '{s['query']}' → {status}")
        if link:
            broll.append({"start": s["start"], "end": s["end"], "src": link, "query": s["query"]})

    props = {
        "videoSrc": "sample.mp4",
        "words": words,
        "headline": "",
        "style": "impacto",
        "accent": "#ffffff",
        "broll": broll,
    }
    json.dump(props, open(out_path, "w"), ensure_ascii=False, indent=2)
    print(f"\n{out_path} listo con {len(broll)} clips de b-roll")


if __name__ == "__main__":
    main()
