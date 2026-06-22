import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development'

const nextConfig: NextConfig = {
  // Standalone output for self-hosted deployment (Coolify/Docker)
  output: 'standalone',

  // Stripe SDK uses Node.js built-ins — keep as external so Node loads them natively
  serverExternalPackages: ['stripe', 'postgres'],
};

// In local dev only: wire up OpenNext Cloudflare dev server
if (isDev) {
  import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev()).catch(() => {})
}

export default nextConfig;
