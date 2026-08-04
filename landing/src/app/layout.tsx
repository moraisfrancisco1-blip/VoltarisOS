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
  title: "VoltarisOS - Intelligent Energy VPP Platform",
  description:
    "Next-generation Virtual Power Plant platform for energy optimization, trading, and grid management. AI-powered forecasting and real-time control.",
  keywords: [
    "VPP",
    "Virtual Power Plant",
    "Energy Trading",
    "Grid Management",
    "AI Forecasting",
    "Battery Optimization",
  ],
  authors: [{ name: "VoltarisOS" }],
  openGraph: {
    title: "VoltarisOS - Intelligent Energy VPP Platform",
    description:
      "Next-generation Virtual Power Plant platform for energy optimization, trading, and grid management.",
    type: "website",
    locale: "en_US",
    siteName: "VoltarisOS",
  },
  twitter: {
    card: "summary_large_image",
    title: "VoltarisOS - Intelligent Energy VPP Platform",
    description:
      "Next-generation Virtual Power Plant platform for energy optimization, trading, and grid management.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
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