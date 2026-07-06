import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ChunkErrorHandler } from "@/components/ChunkErrorHandler";
import UrlParamPersistence from "@/components/UrlParamPersistence";
import CookieBanner from "@/components/CookieBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL('https://finestsites.io'),
  title: "FinestSites",
  description: "Deine professionelle Webseite – Online in unter 5 Minuten.",
  icons: {
    icon: [
      { url: '/fav/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/fav/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/fav/apple-touch-icon.png',
  },
  openGraph: {
    title: 'FinestSites - Deine Network Marketing Webseiten',
    description: 'Professionelle Produktwebsite für Network-Marketing-Profis. In unter 5 Minuten live. Ab 20 € / Monat, jederzeit kündbar.',
    url: 'https://finestsites.io',
    siteName: 'FinestSites',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'FinestSites – Deine professionelle Website',
      },
    ],
    locale: 'de_DE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FinestSites - Deine Network Marketing Webseiten',
    description: 'Professionelle Produktwebsite für Network-Marketing-Profis. Ab 20 € / Monat.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ChunkErrorHandler />
        <UrlParamPersistence />
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
