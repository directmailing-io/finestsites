import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ChunkErrorHandler } from "@/components/ChunkErrorHandler";
import UrlParamPersistence from "@/components/UrlParamPersistence";
import CookieBanner from "@/components/CookieBanner";
import RefCookieSetter from "@/components/RefCookieSetter";

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
  description: "Deine professionelle Webseite – Online in unter 3 Minuten.",
  // Google zeigt in der Suche nur Favicons, die ein Vielfaches von 48 px sind und per robots.txt
  // erreichbar sind (siehe robots.ts). Darum 48/96/192 zusätzlich zu 16/32.
  icons: {
    icon: [
      { url: '/fav/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/fav/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/fav/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/fav/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/fav/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/fav/apple-touch-icon.png',
  },
  openGraph: {
    title: 'FinestSites – Deine professionelle Website in Minuten',
    description: 'Professionelle Produktwebsite für Network-Marketing-Profis. In unter 3 Minuten live. Ab 17 € / Monat, jederzeit kündbar.',
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
    title: 'FinestSites – Deine professionelle Website in Minuten',
    description: 'Professionelle Produktwebsite für Network-Marketing-Profis. Ab 17 € / Monat.',
    images: ['/og-image.png'],
  },
};

// Ältere Android-WebViews (Chrome < 97/110, z. B. Samsung ohne WebView-Update) kennen findLast/at/toSorted noch nicht;
// der Richtext-Editor (ProseMirror) nutzt findLast → „Etwas ist schiefgelaufen“ (Daniels Samsung, 02.11.2026).
// Reines ES5, läuft vor allen Bündeln.
const POLYFILLS = `(function(){var A=Array.prototype,d=Object.defineProperty,o={configurable:true,writable:true};
if(!A.findLast)d(A,'findLast',Object.assign({value:function(f,t){for(var i=this.length-1;i>=0;i--)if(f.call(t,this[i],i,this))return this[i]}},o));
if(!A.findLastIndex)d(A,'findLastIndex',Object.assign({value:function(f,t){for(var i=this.length-1;i>=0;i--)if(f.call(t,this[i],i,this))return i;return -1}},o));
if(!A.at)d(A,'at',Object.assign({value:function(n){n=Math.trunc(n)||0;if(n<0)n+=this.length;return n<0||n>=this.length?undefined:this[n]}},o));
if(!String.prototype.at)d(String.prototype,'at',Object.assign({value:function(n){n=Math.trunc(n)||0;if(n<0)n+=this.length;return n<0||n>=this.length?undefined:this.charAt(n)}},o));
if(!A.toSorted)d(A,'toSorted',Object.assign({value:function(c){return this.slice().sort(c)}},o));
if(!A.toReversed)d(A,'toReversed',Object.assign({value:function(){return this.slice().reverse()}},o));
if(!Object.hasOwn)d(Object,'hasOwn',Object.assign({value:function(a,b){return Object.prototype.hasOwnProperty.call(a,b)}},o));
})();`

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
        <script dangerouslySetInnerHTML={{ __html: POLYFILLS }} />
        <ChunkErrorHandler />
        <UrlParamPersistence />
        <RefCookieSetter />
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
