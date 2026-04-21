import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ViralADN — Descifra el ADN del contenido viral",
  description: "Transcribe videos de YouTube, TikTok e Instagram. Descubre qué está funcionando en tu nicho y adapta los mejores guiones a tu voz.",
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
