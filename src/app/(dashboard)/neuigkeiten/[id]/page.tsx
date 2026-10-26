import { redirect } from 'next/navigation'

/**
 * Alte Detail-Adresse (Links aus Mitteilungen, Lesezeichen): es gibt nur noch die eine Ansicht –
 * die Liste klappt die gewünschte Neuigkeit direkt auf (`?open=<id>`).
 */
export default async function NewsDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/neuigkeiten?open=${encodeURIComponent(id)}`)
}
