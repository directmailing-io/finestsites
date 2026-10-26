import { NewsEditor } from '../NewsEditor'

export const dynamic = 'force-dynamic'

export default async function EditNewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <NewsEditor id={id} />
}
