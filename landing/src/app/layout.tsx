import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VoltarisOS — Gestão Inteligente de Energia Descentralizada",
  description:
    "Plataforma VPP de última geração que unifica painéis solares, baterias e carregadores EV com otimização em tempo real, previsão por IA e controlo total.",
  keywords: [
    "VPP",
    "Virtual Power Plant",
    "gestão de energia",
    "painéis solares",
    "baterias",
    "carregadores EV",
    "otimização energética",
    "IA",
    "previsão energética",
  ],
  authors: [{ name: "VoltarisOS" }],
  openGraph: {
    title: "VoltarisOS — Gestão Inteligente de Energia Descentralizada",
    description:
      "Plataforma VPP que unifica solar, baterias e EV com otimização em tempo real e IA.",
    type: "website",
    locale: "pt_PT",
    siteName: "VoltarisOS",
  },
  twitter: {
    card: "summary_large_image",
    title: "VoltarisOS — Gestão Inteligente de Energia Descentralizada",
    description:
      "Plataforma VPP que unifica solar, baterias e EV com otimização em tempo real e IA.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen bg-surface-950 text-surface-100 antialiased">
        {children}
      </body>
    </html>
  );
}