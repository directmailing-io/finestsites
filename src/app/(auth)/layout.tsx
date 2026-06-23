import { Logo } from '@/components/shared/Logo'
import { unstable_noStore as noStore } from 'next/cache'

// Force dynamic rendering so Vercel/Cloudflare never cache auth pages as static.
// Without this, Next.js sets s-maxage=31536000 which causes Cloudflare to serve
// stale HTML for up to 1 year — new deployments don't reach users until cache expires.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Explicitly opt out of the Full Route Cache and Data Cache on Vercel/Next.js edge.
  // `force-dynamic` alone doesn't always prevent Vercel's ISR prerender cache from
  // serving stale HTML; noStore() ensures every request hits the origin server.
  noStore()
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: '#FAFAFA' }}
    >
      <div className="mb-10">
        <Logo variant="black" height={26} />
      </div>
      <div
        className="w-full max-w-[400px] bg-white rounded-3xl p-8"
        style={{
          boxShadow: '0 2px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
