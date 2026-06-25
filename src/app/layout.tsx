import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ChunkErrorHandler } from "@/components/ChunkErrorHandler";
import UrlParamPersistence from "@/components/UrlParamPersistence";

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
  title: "FinestSites",
  description: "Deine professionelle Webseite – Online in unter 5 Minuten.",
  icons: {
    icon: [
      { url: '/fav/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/fav/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/fav/apple-touch-icon.png',
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
      </body>
    </html>
  );
}
