import type { MetadataRoute } from 'next'

// Nur die Marketing-Seiten sind für Suchmaschinen offen. Icons, OG-Bild, Logos und die
// Next-Assets (CSS/JS) müssen trotzdem erreichbar sein: Google zeigt kein Favicon, das es
// nicht crawlen darf, und bewertet Seiten ohne CSS/JS schlechter. Längste Regel gewinnt.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/$',
          '/webinar$',
          '/app$',
          '/konto-loeschen$',
          '/favicon.ico',
          '/fav/',
          '/app-icon-192.png',
          '/og-image.png',
          '/logos/',
          '/_next/static/',
          '/_next/image',
        ],
        disallow: ['/'],
      },
    ],
    sitemap: 'https://finestsites.io/sitemap.xml',
  }
}
