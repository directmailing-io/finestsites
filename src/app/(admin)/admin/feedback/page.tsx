import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import Link from 'next/link'
import { DeleteAllButton } from './DeleteAllButton'

// Temporäre Feedback-Kampagne (anonym). Zum vollständigen Entfernen:
// siehe docs/feedback-aktion-entfernen.md

export const dynamic = 'force-dynamic'

type Answers = {
  note_webseite: number | null
  text_webseite: string
  text_templates: string
  note_preise: number | null
  text_preise: string
  tarif: string | null
  upgrade_blocker: string[]
  text_upgrade: string
  text_chef: string
  text_offen: string
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

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }) + ', ' +
    new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function NoteDistribution({ title, notes }: { title: string; notes: number[] }) {
  const avg = notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : null
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

function CountList({ title, entries, total }: { title: string; entries: [string, number][]; total: number }) {
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
                <div className="h-full rounded-full" style={{ width: `${(count / max) * 100}%`, background: '#3B82F6' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TextAnswers({ title, hint, items }: {
  title: string
  hint?: string
  items: { text: string; date: Date }[]
}) {
  return (
    <div className="rounded-[20px] p-5 bg-white" style={cardStyle}>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <span className="text-xs font-medium" style={{ color: '#94A3B8' }}>{items.length}</span>
      </div>
      {hint && <p className="text-[11px] mb-3" style={{ color: '#94A3B8' }}>{hint}</p>}
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

  const notesWebseite = responses.map(r => r.a.note_webseite).filter((n): n is number => n !== null)
  const notesPreise = responses.map(r => r.a.note_preise).filter((n): n is number => n !== null)

  const tarifCounts = new Map<string, number>()
  const blockerCounts = new Map<string, number>()
  for (const r of responses) {
    if (r.a.tarif) tarifCounts.set(r.a.tarif, (tarifCounts.get(r.a.tarif) ?? 0) + 1)
    for (const b of r.a.upgrade_blocker ?? []) blockerCounts.set(b, (blockerCounts.get(b) ?? 0) + 1)
  }

  const texts = (key: keyof Answers) =>
    responses
      .filter(r => typeof r.a[key] === 'string' && (r.a[key] as string).trim().length > 0)
      .map(r => ({ text: (r.a[key] as string).trim(), date: r.date }))

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
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-[20px] p-5 bg-white flex flex-col gap-1" style={cardStyle}>
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>Antworten</span>
              <span className="text-3xl font-bold tracking-tight" style={{ color: '#1D4ED8' }}>{total}</span>
            </div>
            <div className="rounded-[20px] p-5 bg-white flex flex-col gap-1" style={cardStyle}>
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>Ø Note Webseiten</span>
              <span className="text-3xl font-bold tracking-tight"
                style={{ color: noteColor(notesWebseite.length ? notesWebseite.reduce((a, b) => a + b, 0) / notesWebseite.length : null) }}>
                {notesWebseite.length ? (notesWebseite.reduce((a, b) => a + b, 0) / notesWebseite.length).toFixed(1) : '—'}
              </span>
            </div>
            <div className="rounded-[20px] p-5 bg-white flex flex-col gap-1" style={cardStyle}>
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>Ø Note Preise</span>
              <span className="text-3xl font-bold tracking-tight"
                style={{ color: noteColor(notesPreise.length ? notesPreise.reduce((a, b) => a + b, 0) / notesPreise.length : null) }}>
                {notesPreise.length ? (notesPreise.reduce((a, b) => a + b, 0) / notesPreise.length).toFixed(1) : '—'}
              </span>
            </div>
          </div>

          {/* Notenverteilungen */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <NoteDistribution title="Webseiten & Templates" notes={notesWebseite} />
            <NoteDistribution title="Preise" notes={notesPreise} />
          </div>

          {/* Tarif + Upgrade-Blocker */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <CountList
              title="Aktueller Tarif"
              total={total}
              entries={Object.keys(TARIF_LABELS)
                .filter(k => tarifCounts.has(k))
                .map(k => [TARIF_LABELS[k], tarifCounts.get(k)!] as [string, number])}
            />
            <CountList
              title="Warum kein Upgrade?"
              total={total}
              entries={[...blockerCounts.entries()].sort((a, b) => b[1] - a[1])}
            />
          </div>

          {/* Freitexte */}
          <div className="flex flex-col gap-3">
            <TextAnswers title="Was nervt oder fehlt bei den Webseiten?" items={texts('text_webseite')} />
            <TextAnswers title="Template-Wünsche" items={texts('text_templates')} />
            <TextAnswers title="Preisgestaltung aus Nutzersicht" hint="„Stell dir vor, du dürftest die Preise selbst festlegen“" items={texts('text_preise')} />
            <TextAnswers title="Upgrade-Blocker (Freitext)" items={texts('text_upgrade')} />
            <TextAnswers title="„Wenn ich Chef von FinestSites wäre…“" items={texts('text_chef')} />
            <TextAnswers title="Offenes Feedback" items={texts('text_offen')} />
          </div>
        </>
      )}
    </div>
  )
}
