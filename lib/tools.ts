// Registro de herramientas del Home (/inicio) — ÚNICA fuente de verdad de las
// cards del hub.
//
// Modelo de navegación "hub & spoke": el usuario entra a una herramienta
// (ViralADN, TOPCUT, Guiones…) y, para cambiar a otra, vuelve al Home (/inicio).
// El header ProductNav siempre trae el botón "🏠 Inicio" para volver.
//
// 👉 Para SUMAR una herramienta nueva: agregá UNA entrada acá (con su gate) y
//    aparece sola en el Home. Que la página nueva use <ProductNav/> y listo —
//    así el patrón se mantiene siempre.

import type { Entitlement } from '@/lib/products';

export type Tool = {
  key: string;
  name: string;
  desc: string;
  href: string;              // a dónde entra cuando está desbloqueada
  icon: string;
  needs: keyof Entitlement;  // 'viraladn' | 'topcut' — entitlement que requiere
  unlockOn?: 'any';          // 'any' = se desbloquea con CUALQUIER plan pago
                             // (viraladn O topcut). Para add-ons por créditos.
  producto: 'viraladn' | 'topcut' | 'combo'; // para el CTA de desbloqueo
  price: string;             // texto del precio en el CTA bloqueado
  includedNote?: string;     // ej. "Incluido con ViralADN"
  grad: string; border: string; glow: string; iconGlow: string;
  unlockBorder: string; unlockColor: string;
};

const VIOLET = {
  grad: 'linear-gradient(135deg, #7c3aed, #c13584)',
  border: '#7c3aed55', glow: '#7c3aed1f', iconGlow: '#7c3aed44',
  unlockBorder: '#7c3aed55', unlockColor: '#c4b5fd',
};

export const TOOLS: Tool[] = [
  {
    key: 'viraladn', name: 'ViralADN', href: '/app', icon: '🧬',
    desc: 'Descifra el ADN del contenido viral. Busca los videos que explotan y analiza perfiles.',
    needs: 'viraladn', producto: 'viraladn', price: '$27/mes', ...VIOLET,
  },
  {
    key: 'topcut', name: 'TOPCUT', href: '/editor', icon: '✂️',
    desc: 'Sube tu video y la IA lo edita solo: recorte, subtítulos, B-roll y música.',
    needs: 'topcut', producto: 'topcut', price: '$57/mes',
    grad: 'linear-gradient(135deg, #0e7490, #2563eb)',
    border: '#22d3ee44', glow: '#22d3ee14', iconGlow: '#22d3ee33',
    unlockBorder: '#22d3ee55', unlockColor: '#67e8f9',
  },
  {
    key: 'studio', name: 'Avatares IA', href: '/studio', icon: '🎭',
    desc: 'Crea tu avatar con IA y conviértelo en video. Tu foto cobra vida para tus reels.',
    needs: 'viraladn', unlockOn: 'any', producto: 'combo', price: 'con tu plan',
    includedNote: 'Incluido con tu plan (por créditos)',
    grad: 'linear-gradient(135deg, #db2777, #f59e0b)',
    border: '#f472b644', glow: '#f472b614', iconGlow: '#f472b633',
    unlockBorder: '#f472b655', unlockColor: '#fbcfe8',
  },
  // Guiones NO es card del hub: vive DENTRO de ViralADN (pestaña "📚 Guiones" en
  // /app, con botón "Generar guion" → /guiones). Es parte del plan ViralADN.
];
