import { Config } from '@remotion/cli/config';

// Config de render de TOPCUT.
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// Calidad/velocidad: 1080x1920 vertical (reels/shorts/tiktok) se define en la composición.
Config.setConcurrency(4);
