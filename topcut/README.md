# TOPCUT — motor de render (Remotion)

Proyecto **aislado** del app Next.js de ViralADN. Acá vive la edición de video
(subtítulos animados, headlines, b-roll). No se sube al deploy de Vercel ni
comparte dependencias con la app.

## Fase 1 (MVP) — lo que hay ahora
- Composición **Captions**: subtítulos animados estilo viral (palabra activa
  resaltada, pop de entrada, borde negro para legibilidad) + headline opcional.
- 3 estilos: `pop`, `highlight`, `karaoke`.
- Formato vertical 1080×1920 (reels / shorts / tiktok).

## Cómo previsualizar (ver la "obra de arte" en vivo)

```bash
cd topcut
npm install            # instala Remotion (la primera vez baja Chromium, tarda)
npm run studio         # abre Remotion Studio en el navegador
```

En el Studio podés editar los textos/tiempos y ver los subtítulos animados al
instante (hot-reload). Probá cambiar `style` y `accent` en los props.

## Probar con tu propio video
1. Poné un video vertical en `topcut/public/sample.mp4`
2. En `sample-words.json`, cambiá `"videoSrc": null` por `"videoSrc": "sample.mp4"`
3. `npm run studio`

## Renderizar a MP4

```bash
npm run render         # genera out/video.mp4
```

## Próximas fases (todavía no)
- **1b:** transcripción word-level (Whisper) → genera el JSON de palabras solo
- **1c:** subida de video desde el app + Supabase Storage
- **1d:** render en la nube (Remotion Lambda / servidor de render) disparado
  desde el app, con descarga del MP4
- **2:** headlines + recorte · **3:** b-roll automático de stock · **4:** auto-cortes
