import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'

const GIPHY_API_KEY = process.env.GIPHY_API_KEY ?? 'dc6zaTOxFJmzC' // Public beta key — replace in production

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = new URL(req.url).searchParams.get('q') ?? ''
  if (!q.trim()) return NextResponse.json({ gifs: [] })

  try {
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(q)}&limit=16&rating=g`
    const res = await fetch(url, { next: { revalidate: 60 } })
    const json = await res.json()

    const gifs = (json.data ?? []).map((g: { id: string; title: string; images: { fixed_height_small: { url: string; width: string; height: string }; original: { url: string } } }) => ({
      id: g.id,
      title: g.title,
      previewUrl: g.images?.fixed_height_small?.url,
      url: g.images?.original?.url,
      width: parseInt(g.images?.fixed_height_small?.width ?? '100'),
      height: parseInt(g.images?.fixed_height_small?.height ?? '100'),
    }))

    return NextResponse.json({ gifs })
  } catch {
    return NextResponse.json({ gifs: [] })
  }
}
