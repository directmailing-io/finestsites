import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'finestsites.de',
        pathname: '/api/media/**',
      },
      {
        protocol: 'https',
        hostname: 'finestsites.vercel.app',
        pathname: '/api/media/**',
      },
      {
        // local dev: main app running on localhost:3000
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/api/media/**',
      },
    ],
  },
}

export default nextConfig
