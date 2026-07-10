import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development'

const nextConfig: NextConfig = {
  // Standalone output for self-hosted deployment (Coolify/Docker)
  output: 'standalone',

  // Stripe SDK uses Node.js built-ins — keep as external so Node loads them natively
  serverExternalPackages: ['stripe', 'postgres', 'pg'],

  experimental: {
    // Set client-side router cache stale time to 0 for dynamic routes so
    // users always get fresh HTML after a new deployment.
    staleTimes: {
      dynamic: 0,
    },
  },

  // www → apex redirect (www.finestsites.io → finestsites.io)
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.finestsites.io' }],
        destination: 'https://finestsites.io/:path*',
        permanent: true,
      },
    ]
  },

  // Security headers applied to every response
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent Chrome from showing "Auf andere Apps zugreifen" permission
          // dialogs triggered by FedCM / Digital Credentials / Identity APIs.
          {
            key: 'Permissions-Policy',
            value: 'identity-credentials-get=(), digital-credentials-get=()',
          },
          // Prevent MIME-type sniffing (XSS via malicious uploads served as HTML)
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Prevent this app from being embedded in iframes on other origins (clickjacking)
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Enforce HTTPS for 2 years (only meaningful over TLS, harmless in dev)
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Limit referrer info sent to third parties
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      // CORS for static assets (fonts, images) so they work cross-origin.
      // finestsites.io → app.finestsites.io redirect requires CORS or
      // the browser blocks font/resource loading.
      {
        source: '/(fonts|logos|images|fav)/(.*)',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      // Prevent Cloudflare/CDNs from caching HTML pages.
      // Next.js sets s-maxage=31536000 for static pages, which means Cloudflare
      // caches them for 1 year — new deployments never reach users. Override this
      // for all HTML routes. Static assets (/_next/static/*) still cache normally.
      {
        source: '/((?!_next/static|_next/image|favicon\\.ico).*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
          { key: 'Cloudflare-CDN-Cache-Control', value: 'no-store' },
        ],
      },
    ]
  },
};

// In local dev only: wire up OpenNext Cloudflare dev server
if (isDev) {
  import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev()).catch(() => {})
}

export default nextConfig;
