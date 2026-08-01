import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import Link from 'next/link'
import { DeleteAllButton } from './DeleteAllButton'

// Temporäre Feedback-Kampagne (anonym). Zum vollständigen Entfernen:
// siehe docs/feedback-aktion-entfernen.md

export const dynamic = 'force-dynamic'

type Answers = {
  note_optimalset: number | null
  text_optimalset: string
  note_business: number | null
  text_business: string
  template_wuensche: string[]
  text_templates: string
  tarif: string | null
  preis_meinung: string | null
  text_preise: string
  upgrade_grund: string | null
  text_upgrade: string
  empfehlung: string | null
  text_empfehlung: string
  text_chef: string
}

type FeedbackRow = {
  id: string
  created_at: Date
  answers: Answers | string
}

const TARIF_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  unlimited: 'Unlimited',
  unbekannt: 'Weiß nicht',
}

const PREIS_LABELS: Record<string, { label: string; color: string }> = {
  zu_teuer: { label: 'Zu teuer', color: '#DC2626' },
  geht_so: { label: 'Geht so', color: '#CA8A04' },
  fair: { label: 'Fair', color: '#16A34A' },
  guenstig: { label: 'Richtig günstig', color: '#059669' },
}

const GRUND_LABELS: Record<string, string> = {
  zu_teuer: 'Für mich ist das zu teuer',
  nicht_ueberzeugt: 'Die Seiten überzeugen mich noch nicht',
  anderer: 'Anderer Grund',
}

const cardStyle = {
  boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
  border: '1px solid #F1F5F9',
} as const

function noteColor(avg: number | null): string {
  if (avg === null) return '#94A3B8'
  if (avg <= 2) return '#15803D'
  if (avg <= 3.5) return '#CA8A04'
  return '#DC2626'
}

function avgOf(notes: number[]): number | null {
  return notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : null
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }) + ', ' +
    new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function NoteDistribution({ title, notes }: { title: string; notes: number[] }) {
  const avg = avgOf(notes)
  const counts = [1, 2, 3, 4, 5, 6].map(n => notes.filter(x => x === n).length)
  const max = Math.max(...counts, 1)

  return (
    <div className="rounded-[20px] p-5 bg-white" style={cardStyle}>
      <div className="flex items-baseline justify-between mb-4">
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <span className="text-2xl font-bold tracking-tight" style={{ color: noteColor(avg) }}>
          {avg !== null ? 'Ø ' + avg.toFixed(1) : '—'}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {counts.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[11px] font-semibold w-4 text-right" style={{ color: '#64748B' }}>{i + 1}</span>
            <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ background: '#F8FAFC' }}>
              <div className="h-full rounded-full"
                style={{ width: `${(c / max) * 100}%`, background: i < 2 ? '#22C55E' : i < 4 ? '#EAB308' : '#EF4444', minWidth: c > 0 ? 8 : 0 }} />
            </div>
            <span className="text-[11px] w-6" style={{ color: '#94A3B8' }}>{c > 0 ? c : ''}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] mt-3" style={{ color: '#CBD5E1' }}>{notes.length} Bewertungen · 1 = sehr gut, 6 = ungenügend</p>
    </div>
  )
}

function CountList({ title, entries, total, colors }: {
  title: string
  entries: [string, number][]
  total: number
  colors?: Record<string, string>
}) {
  const max = Math.max(...entries.map(([, c]) => c), 1)
  return (
    <div className="rounded-[20px] p-5 bg-white" style={cardStyle}>
      <span className="text-sm font-semibold text-gray-900 block mb-4">{title}</span>
      {entries.length === 0 ? (
        <p className="text-xs" style={{ color: '#94A3B8' }}>Noch keine Angaben</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {entries.map(([label, count]) => (
            <div key={label}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs font-medium" style={{ color: '#374151' }}>{label}</span>
                <span className="text-xs font-semibold" style={{ color: '#6B7280' }}>
                  {count}{total > 0 ? ` · ${Math.round((count / total) * 100)} %` : ''}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F8FAFC' }}>
                <div className="h-full rounded-full" style={{ width: `${(count / max) * 100}%`, background: colors?.[label] ?? '#3B82F6' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TextAnswers({ title, items }: {
  title: string
  items: { text: string; date: Date }[]
}) {
  return (
    <div className="rounded-[20px] p-5 bg-white" style={cardStyle}>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <span className="text-xs font-medium" style={{ color: '#94A3B8' }}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>Noch keine Antworten</p>
      ) : (
        <div className="flex flex-col gap-2 mt-3">
          {items.map((item, i) => (
            <div key={i} className="rounded-[14px] px-4 py-3" style={{ background: '#F8FAFC' }}>
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: '#1F2937' }}>{item.text}</p>
              <p className="text-[10px] mt-1.5" style={{ color: '#CBD5E1' }}>{fmtDate(item.date)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default async function FeedbackAdminPage() {
  const rows = await db.execute<FeedbackRow>(sql`
    SELECT id, created_at, answers FROM feedback_responses ORDER BY created_at DESC
  `)

  const responses = rows.map(r => ({
    date: r.created_at,
    a: (typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers) as Answers,
  }))

  const total = responses.length

  const notesOptimalset = responses.map(r => r.a.note_optimalset).filter((n): n is number => typeof n === 'number')
  const notesBusiness = responses.map(r => r.a.note_business).filter((n): n is number => typeof n === 'number')

  const count = (fn: (a: Answers) => string | null | undefined) => {
    const m = new Map<string, number>()
    for (const r of responses) {
      const v = fn(r.a)
      if (v) m.set(v, (m.get(v) ?? 0) + 1)
    }
    return m
  }

  const preisCounts = count(a => a.preis_meinung)
  const tarifCounts = count(a => a.tarif)
  const grundCounts = count(a => a.upgrade_grund)
  const empfehlungCounts = count(a => a.empfehlung)

  const templateCounts = new Map<string, number>()
  for (const r of responses) {
    for (const t of r.a.template_wuensche ?? []) templateCounts.set(t, (templateCounts.get(t) ?? 0) + 1)
  }

  const ja = empfehlungCounts.get('ja') ?? 0
  const nein = empfehlungCounts.get('nein') ?? 0
  const empfehlungQuote = ja + nein > 0 ? Math.round((ja / (ja + nein)) * 100) : null

  const avgOptimalset = avgOf(notesOptimalset)
  const avgBusiness = avgOf(notesBusiness)

  const texts = (key: keyof Answers) =>
    responses
      .filter(r => typeof r.a[key] === 'string' && (r.a[key] as string).trim().length > 0)
      .map(r => ({ text: (r.a[key] as string).trim(), date: r.date }))

  const preisColorMap: Record<string, string> = {}
  for (const v of Object.values(PREIS_LABELS)) preisColorMap[v.label] = v.color

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="mb-6">
        <Link href="/admin" className="flex items-center gap-2 text-sm mb-5" style={{ color: '#94A3B8' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Zurück zum Dashboard
        </Link>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Feedback-Aktion</h1>
            <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
              Anonyme Antworten von <span className="font-mono">/feedback</span> — temporäre Kampagne
            </p>
          </div>
          <DeleteAllButton count={total} />
        </div>
      </div>

      {total === 0 ? (
        <div className="rounded-[20px] bg-white p-10 text-center" style={cardStyle}>
          <p className="text-sm font-medium text-gray-900">Noch kein Feedback</p>
          <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
            Teile den Link <span className="font-mono">app.finestsites.io/feedback</span> mit deinen Nutzern.
          </p>
        </div>
      ) : (
        <>
          {/* Kopfzahlen */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="rounded-[20px] p-5 bg-white flex flex-col gap-1" style={cardStyle}>
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>Antworten</span>
              <span className="text-3xl font-bold tracking-tight" style={{ color: '#1D4ED8' }}>{total}</span>
            </div>
            <div className="rounded-[20px] p-5 bg-white flex flex-col gap-1" style={cardStyle}>
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>Ø Optimalset-Seite</span>
              <span className="text-3xl font-bold tracking-tight" style={{ color: noteColor(avgOptimalset) }}>
                {avgOptimalset !== null ? avgOptimalset.toFixed(1) : '—'}
              </span>
            </div>
            <div className="rounded-[20px] p-5 bg-white flex flex-col gap-1" style={cardStyle}>
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>Ø Business-Seite</span>
              <span className="text-3xl font-bold tracking-tight" style={{ color: noteColor(avgBusiness) }}>
                {avgBusiness !== null ? avgBusiness.toFixed(1) : '—'}
              </span>
            </div>
            <div className="rounded-[20px] p-5 bg-white flex flex-col gap-1" style={cardStyle}>
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>Würden empfehlen</span>
              <span className="text-3xl font-bold tracking-tight"
                style={{ color: empfehlungQuote === null ? '#94A3B8' : empfehlungQuote >= 70 ? '#15803D' : empfehlungQuote >= 40 ? '#CA8A04' : '#DC2626' }}>
                {empfehlungQuote !== null ? `${empfehlungQuote} %` : '—'}
              </span>
              <span className="text-[11px]" style={{ color: '#94A3B8' }}>{ja} Ja · {nein} Nein</span>
            </div>
          </div>

          {/* Notenverteilungen */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <NoteDistribution title="Optimalset-Seite" notes={notesOptimalset} />
            <NoteDistribution title="Business-Seite" notes={notesBusiness} />
          </div>

          {/* Wünsche + Preis */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <CountList
              title="Wunsch-Seiten (max. 3 pro Person)"
              total={total}
              entries={[...templateCounts.entries()].sort((a, b) => b[1] - a[1])}
            />
            <CountList
              title="Wie finden sie den Preis?"
              total={total}
              colors={preisColorMap}
              entries={Object.entries(PREIS_LABELS)
                .filter(([k]) => preisCounts.has(k))
                .map(([k, v]) => [v.label, preisCounts.get(k)!] as [string, number])}
            />
          </div>

          {/* Tarif + Upgrade-Grund */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <CountList
              title="Aktueller Tarif"
              total={total}
              entries={Object.keys(TARIF_LABELS)
                .filter(k => tarifCounts.has(k))
                .map(k => [TARIF_LABELS[k], tarifCounts.get(k)!] as [string, number])}
            />
            <CountList
              title="Warum kein größeres Paket?"
              total={total}
              entries={Object.keys(GRUND_LABELS)
                .filter(k => grundCounts.has(k))
                .map(k => [GRUND_LABELS[k], grundCounts.get(k)!] as [string, number])}
            />
          </div>

          {/* Freitexte */}
          <div className="flex flex-col gap-3">
            <TextAnswers title="Optimalset-Seite: Was fehlt? Was soll anders werden?" items={texts('text_optimalset')} />
            <TextAnswers title="Business-Seite: Was fehlt? Was soll anders werden?" items={texts('text_business')} />
            <TextAnswers title="Eigene Template-Ideen" items={texts('text_templates')} />
            <TextAnswers title="Was wäre ein fairer Preis?" items={texts('text_preise')} />
            <TextAnswers title="Upgrade: Warum nicht? (Freitext)" items={texts('text_upgrade')} />
            <TextAnswers title="Was muss anders sein für eine Empfehlung?" items={texts('text_empfehlung')} />
            <TextAnswers title="„Wenn ich Chef wäre…“" items={texts('text_chef')} />
          </div>
        </>
      )}
    </div>
  )
}
