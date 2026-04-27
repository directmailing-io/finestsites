const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export interface Template {
  id: string
  title: string
  description: string | null
  preview_images: string[]
  domain: string
  status: 'draft' | 'published'
  tags: string[] | null
  is_free: boolean
}

async function supabaseFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
    },
    next: { revalidate: 60 }, // ISR: revalidate every 60s
  })
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`)
  return res.json() as Promise<T>
}

export async function getPublishedTemplates(): Promise<Template[]> {
  return supabaseFetch<Template[]>(
    'templates?select=id,title,description,preview_images,domain,status,tags,is_free&status=eq.published&is_test=eq.false&order=created_at.asc'
  )
}

export async function getTemplate(id: string): Promise<Template | null> {
  const rows = await supabaseFetch<Template[]>(
    `templates?select=id,title,description,preview_images,domain,status,tags,is_free&id=eq.${encodeURIComponent(id)}&status=eq.published&limit=1`
  )
  return rows[0] ?? null
}

export function templateImageUrl(path: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  // path starts with /api/media/... — prefix with main app URL
  return `${appUrl}${path}`
}
