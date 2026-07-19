import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import TermsGate from "./_components/TermsGate";
import HelpButton from "./_components/HelpButton";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://viraladn.com";

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
      "Encuentra lo viral en YouTube, TikTok e Instagram en segundos. Edítalo con IA. Crea contenido que explota.",
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
    locale: "es_LA",
  },
  twitter: {
    card: "summary_large_image",
    title: "ViralADN",
    description: "Encuentra lo viral. Edítalo con IA. Crea contenido que explota.",
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
      <body className={`min-h-screen bg-gray-950 text-white ${inter.variable}`}>
        {children}
        <TermsGate />
        <HelpButton />
      </body>
    </html>
  );
}
