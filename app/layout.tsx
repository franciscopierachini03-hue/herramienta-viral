import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.franpierachini.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "ViralADN — Descifra el ADN del contenido viral",
  description:
    "Transcribe videos de YouTube, TikTok e Instagram. Descubre qué está funcionando en tu nicho y adapta los mejores guiones a tu voz.",
  icons: {
    icon: [
      { url: "/logo-mark.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    apple: "/logo-mark.svg",
  },
  openGraph: {
    type: "website",
    title: "ViralADN — Descifra el ADN del contenido viral",
    description:
      "Encontrá lo viral en YouTube, TikTok e Instagram en segundos. Creá contenido que explota.",
    url: SITE_URL,
    siteName: "ViralADN",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "ViralADN",
      },
    ],
    locale: "es_AR",
  },
  twitter: {
    card: "summary_large_image",
    title: "ViralADN",
    description: "Encontrá lo viral. Creá contenido que explota.",
    images: ["/og-image.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`min-h-screen bg-gray-950 text-white ${inter.variable}`}>{children}</body>
    </html>
  );
}
