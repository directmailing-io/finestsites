'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Einstellungen → Werbung.
 * Übersicht: drei Karten (Meta, Google Ads, TikTok) mit Status und einem Knopf.
 * Einrichten: je Plattform ein kurzer Ablauf, ein Schritt pro Bildschirm.
 * Danach: Was wird gemessen (Schalter), Retargeting-Hilfe, Auswertung, „Mehr“ zugeklappt.
 * Konzept: docs/werbung-tracking-konzept.html
 */

type Platform = 'meta' | 'google' | 'tiktok'

interface Config {
  metaPixelId: string; metaTokenSet: boolean
  googleAdsId: string; googleLeadLabel: string; googleContactLabel: string
  tiktokPixelId: string; tiktokTokenSet: boolean
  siteIds: string[] | null
  events: { contact: boolean; lead: boolean }
  confirmed: boolean
  lastSend: { at: string; platform: string | null; status: string | null; error: string | null } | null
  firstLeadAt: string | null
}
interface Site { id: string; status: string; title: string; host: string; url: string }
interface Stats {
  days: number
  totals: { pageviews: number; contacts: number; leads: number; consentYes: number; consentNo: number }
  bySite: { siteId: string; host: string; pageviews: number; contacts: number; leads: number }[]
  byCampaign: { source: string; campaign: string; pageviews: number; contacts: number; leads: number }[]
}

const PLATFORMS: Record<Platform, { name: string; sub: string }> = {
  meta:   { name: 'Meta',       sub: 'Facebook & Instagram' },
  google: { name: 'Google Ads', sub: 'Google-Suche & YouTube' },
  tiktok: { name: 'TikTok',     sub: 'TikTok-Anzeigen' },
}

function Logo({ p, size = 36 }: { p: Platform; size?: number }) {
  if (p === 'meta') return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#0866FF" d="M14.3 11C8.4 11 4 18.1 4 26.1 4 32.4 7.2 36.5 11.6 36.5c3.2 0 5.5-1.9 8.6-7.3l3.8-6.7c3.3 6.4 5.1 8.9 6.3 10.3 2 2.5 4 3.7 6.6 3.7 3 0 5.2-1.5 6.5-4.1 1-2 1.5-4.4 1.5-6.8C45 17.3 40 11 34.1 11c-3.4 0-6.1 2.3-9.3 7.9l-1.2 2.1C20.3 14.4 18 11 14.3 11zm.2 4.6c1.7 0 3.9 3.5 7.1 9.6l-1.6 2.8c-2.6 4.6-3.8 5.4-5.6 5.4-2.7 0-4.6-2.8-4.6-7 0-6.2 2.2-10.8 4.7-10.8zm19.4 0c3 0 6 5.9 6 11 0 4-1.5 6.2-3.6 6.2-1.6 0-2.7-1.2-4.7-4.1-1.3-1.9-3.3-5.1-5.6-9.5 3-5.3 5.2-7.6 7.9-7.6z"/>
    </svg>
  )
  if (p === 'google') return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FBBC04" d="M7.2 31.3 21.1 7.2a7.2 7.2 0 0 1 12.5 7.2L19.7 38.5a7.2 7.2 0 0 1-12.5-7.2z"/>
      <path fill="#4285F4" d="m27.4 14.4 13.9 24.1a7.2 7.2 0 1 1-12.5 7.2L14.9 21.6z"/>
      <circle fill="#34A853" cx="13.4" cy="35" r="7.2"/>
    </svg>
  )
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#25F4EE" d="M31 5h-6.4v26.9a5.6 5.6 0 1 1-5.6-5.6c.5 0 1 .1 1.5.2v-6.6a12.2 12.2 0 1 0 10.5 12.1V18.6a15.6 15.6 0 0 0 8.9 2.8v-6.5A9.2 9.2 0 0 1 31 5z" transform="translate(-1.6 1.2)"/>
      <path fill="#FE2C55" d="M31 5h-6.4v26.9a5.6 5.6 0 1 1-5.6-5.6c.5 0 1 .1 1.5.2v-6.6a12.2 12.2 0 1 0 10.5 12.1V18.6a15.6 15.6 0 0 0 8.9 2.8v-6.5A9.2 9.2 0 0 1 31 5z" transform="translate(1.6 -1.2)"/>
      <path fill="#111" d="M31 5h-6.4v26.9a5.6 5.6 0 1 1-5.6-5.6c.5 0 1 .1 1.5.2v-6.6a12.2 12.2 0 1 0 10.5 12.1V18.6a15.6 15.6 0 0 0 8.9 2.8v-6.5A9.2 9.2 0 0 1 31 5z"/>
    </svg>
  )
}

const INPUT = 'w-full px-4 py-3 text-[16px] rounded-2xl outline-none transition-all bg-white'

function Field({ id, label, value, onChange, placeholder, error, secret, hint }: {
  id: string; label: string; value: string; onChange: (v: string) => void
  placeholder?: string; error?: string | null; secret?: boolean; hint?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-gray-700">{label}</label>
      <input
        id={id} type={secret ? 'password' : 'text'} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        className={INPUT} style={{ border: `1.5px solid ${error ? '#DC2626' : '#E5E7EB'}`, fontFamily: 'ui-monospace, Menlo, monospace' }}
        onFocus={e => { if (!error) e.target.style.borderColor = '#1a1a1a' }}
        onBlur={e => { if (!error) e.target.style.borderColor = '#E5E7EB' }}
      />
      {error ? (
        <p role="alert" className="text-[15px] font-medium rounded-2xl px-4 py-3" style={{ background: '#FEF2F2', color: '#B91C1C' }}>{error}</p>
      ) : hint ? <p className="text-[13px] px-1" style={{ color: '#64748B' }}>{hint}</p> : null}
    </div>
  )
}

function Where({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl px-4 py-3.5 text-[15px] leading-snug" style={{ background: '#fff', border: '1px solid #E5E7EB', color: '#374151' }}>
      <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#6B7280' }}>Wo finde ich das?</p>
      {children}
    </div>
  )
}

function Primary({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="text-[16px] font-semibold px-6 py-3.5 rounded-2xl disabled:opacity-60 min-h-[50px]" style={{ background: '#1a1a1a', color: '#fff' }}>
      {children}
    </button>
  )
}
function Secondary({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="text-[16px] font-semibold px-6 py-3.5 rounded-2xl disabled:opacity-60 min-h-[50px]" style={{ background: '#fff', color: '#1a1a1a', border: '1.5px solid #D1D5DB' }}>
      {children}
    </button>
  )
}

function Switch({ on, onChange, disabled }: { on: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange?.(!on)}
      className="relative flex-shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-60"
      style={{ background: on ? '#16A34A' : '#D1D5DB' }}>
      <span className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all" style={{ left: on ? 22 : 2 }} />
    </button>
  )
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800) } catch { /* ignore */ } }}
      className="flex-shrink-0 text-sm font-semibold px-3.5 py-2 rounded-xl min-h-[40px]"
      style={{ background: done ? '#DCFCE7' : '#F3F4F6', color: done ? '#15803D' : '#111' }}>
      {done ? 'Kopiert' : 'Kopieren'}
    </button>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl p-5 sm:p-7 flex flex-col gap-4" style={{ background: '#F8FAFC' }}>
      <div>
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-[15px] text-gray-600 mt-0.5 leading-snug">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function TrackingSettings() {
  const [config, setConfig] = useState<Config | null>(null)
  const [sites, setSites] = useState<Site[]>([])
  const [loaded, setLoaded] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [view, setView] = useState<'overview' | Platform>('overview')
  const [more, setMore] = useState(false)
  const [eventsSaving, setEventsSaving] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch('/api/tracking/config').then(r => r.json()).catch(() => null)
    if (!r) return
    setConfig(r.config); setSites(r.sites ?? []); setLoaded(true)
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!config) return
    fetch('/api/tracking/stats?days=30').then(r => r.json()).then(setStats).catch(() => {})
  }, [config])

  const connected = (p: Platform) => !!config && (p === 'meta' ? !!config.metaPixelId : p === 'google' ? !!config.googleAdsId : !!config.tiktokPixelId)
  const anyConnected = connected('meta') || connected('google') || connected('tiktok')
  const problem = (p: Platform) => !!config?.lastSend && config.lastSend.platform === p && config.lastSend.status === 'error'
  const published = sites.filter(s => s.status === 'published')

  async function saveEvents(events: { contact: boolean; lead: boolean }) {
    setEventsSaving(true)
    try {
      const r = await fetch('/api/tracking/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok) setConfig(d.config)
    } finally { setEventsSaving(false) }
  }

  async function saveSites(siteIds: string[] | null) {
    const r = await fetch('/api/tracking/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteIds }) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) setConfig(d.config)
  }

  if (!loaded) return <div className="h-40 rounded-3xl animate-pulse" style={{ background: '#F1F5F9' }} />

  if (view !== 'overview') {
    return <PlatformFlow platform={view} config={config} sites={sites} onBack={() => { setView('overview'); load() }} onSaved={c => setConfig(c)} />
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Drei Karten */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(Object.keys(PLATFORMS) as Platform[]).map(p => {
          const on = connected(p); const err = problem(p)
          return (
            <div key={p} className="rounded-3xl p-5 flex flex-col gap-3" style={{ background: '#fff', border: `1.5px solid ${on ? (err ? '#FCA5A5' : '#BBF7D0') : '#E5E7EB'}` }}>
              <div className="flex items-center gap-3">
                <Logo p={p} />
                <div className="min-w-0">
                  <p className="text-base font-bold text-gray-900 leading-tight">{PLATFORMS[p].name}</p>
                  <p className="text-xs text-gray-500">{PLATFORMS[p].sub}</p>
                </div>
              </div>
              <span className="self-start text-[12px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: on ? (err ? '#FEF2F2' : '#ECFDF5') : '#F3F4F6', color: on ? (err ? '#B91C1C' : '#15803D') : '#6B7280' }}>
                {on ? (err ? 'Problem, bitte prüfen' : 'Verbunden') : 'Nicht verbunden'}
              </span>
              <button type="button" onClick={() => setView(p)}
                className="mt-auto text-[15px] font-semibold px-4 py-3 rounded-2xl min-h-[48px]"
                style={on ? { background: '#fff', color: '#1a1a1a', border: '1.5px solid #D1D5DB' } : { background: '#1a1a1a', color: '#fff' }}>
                {on ? 'Verwalten' : 'Einrichten'}
              </button>
            </div>
          )
        })}
      </div>

      {anyConnected && config && (
        <>
          {/* Was wird gemessen */}
          <Section title="Was wird gemessen" subtitle="Drei Ereignisse, für alle verbundenen Plattformen gleich. Nur mit Zustimmung der Besucher.">
            {[
              { key: 'pageview', title: 'Seitenaufruf', text: 'Jemand öffnet deine Seite. Immer an, sonst kann die Plattform keine Zielgruppen bilden.', on: true, fixed: true },
              { key: 'contact', title: 'Kontakt-Klick', text: 'Jemand tippt auf WhatsApp, Telefon oder E-Mail. Wichtig, wenn deine Seite kein Formular hat.', on: config.events.contact, fixed: false },
              { key: 'lead', title: 'Anfrage', text: 'Jemand schickt das Kontaktformular ab. Darauf optimierst du deine Kampagnen.', on: config.events.lead, fixed: false },
            ].map(row => (
              <div key={row.key} className="flex items-start gap-3 rounded-2xl px-4 py-3.5" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-gray-900">{row.title}</p>
                  <p className="text-[14px] text-gray-600 leading-snug">{row.text}</p>
                </div>
                <Switch on={row.on} disabled={row.fixed || eventsSaving}
                  onChange={v => saveEvents({ ...config.events, [row.key]: v })} />
              </div>
            ))}
          </Section>

          {/* Zielgruppen-Helfer (Retargeting) */}
          <AudienceHelper sites={published} stats={stats} />

          {/* Auswertung */}
          <Section title={`Auswertung, letzte ${stats?.days ?? 30} Tage`} subtitle="Aus unserer eigenen Zählung, unabhängig von Werbeblockern und Zustimmung.">
            {!stats ? <p className="text-sm text-gray-500">Lade …</p> : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {[['Seitenaufrufe', stats.totals.pageviews], ['Kontakte', stats.totals.contacts], ['Anfragen', stats.totals.leads]].map(([l, v]) => (
                    <div key={String(l)} className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
                      <p className="text-2xl font-bold text-gray-900">{v}</p>
                      <p className="text-xs text-gray-500">{l}</p>
                    </div>
                  ))}
                </div>
                {(stats.totals.consentYes + stats.totals.consentNo) > 0 && (
                  <p className="text-[14px] text-gray-600 leading-snug">
                    {Math.round(stats.totals.consentYes / (stats.totals.consentYes + stats.totals.consentNo) * 100)} % der Besucher haben dem Messen zugestimmt. Nur diese sieht die Werbeplattform.
                  </p>
                )}
                {stats.byCampaign.length > 0 && (
                  <div className="overflow-x-auto rounded-2xl" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs text-gray-500"><th className="py-2.5 px-3">Woher</th><th className="py-2.5 px-3">Kampagne</th><th className="py-2.5 px-3 text-right">Aufrufe</th><th className="py-2.5 px-3 text-right">Kontakte</th><th className="py-2.5 px-3 text-right">Anfragen</th></tr></thead>
                      <tbody>
                        {stats.byCampaign.map((r, i) => (
                          <tr key={i} style={{ borderTop: '1px solid #F1F5F9' }}>
                            <td className="py-2.5 px-3 font-medium text-gray-900">{r.source}</td>
                            <td className="py-2.5 px-3 text-gray-700">{r.campaign || '–'}</td>
                            <td className="py-2.5 px-3 text-right text-gray-700">{r.pageviews}</td>
                            <td className="py-2.5 px-3 text-right text-gray-700">{r.contacts}</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-gray-900">{r.leads}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {stats.byCampaign.length === 0 && <p className="text-[14px] text-gray-500">Sobald Besucher über eine Anzeige kommen, siehst du hier, aus welcher Kampagne die Anfragen stammen.</p>}
              </>
            )}
          </Section>

          {/* Mehr */}
          <button type="button" onClick={() => setMore(m => !m)} className="self-start text-[15px] font-semibold underline" style={{ color: '#1a1a1a' }}>
            {more ? 'Weitere Einstellungen ausblenden' : 'Weitere Einstellungen'}
          </button>
          {more && (
            <>
              <Section title="Link für deine Anzeige" subtitle="Nur nötig, wenn du in der Auswertung oben sehen willst, welche Kampagne eine Anfrage gebracht hat. Setze den Link als Website-Adresse in der Anzeige ein, mehr nicht.">
                {published.map(s => (
                  <div key={s.id} className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
                    <p className="text-sm font-semibold text-gray-900">{s.host}</p>
                    {(['meta', 'google', 'tiktok'] as Platform[]).filter(connected).map(p => {
                      const q = p === 'meta' ? 'utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{adset.name}}'
                        : p === 'google' ? 'utm_source=google&utm_medium=paid&utm_campaign={campaignid}&utm_content={adgroupid}'
                          : 'utm_source=tiktok&utm_medium=paid&utm_campaign=__CAMPAIGN_NAME__&utm_content=__AID_NAME__'
                      const link = `${s.url}/?${q}`
                      return (
                        <div key={p} className="flex items-center gap-2">
                          <Logo p={p} size={22} />
                          <code className="flex-1 min-w-0 text-[12px] break-all text-gray-600">{link}</code>
                          <CopyButton text={link} />
                        </div>
                      )
                    })}
                  </div>
                ))}
                <p className="text-[13px] text-gray-500">Die geschweiften Teile ersetzt die Plattform selbst durch den Namen deiner Kampagne.</p>
              </Section>

              <Section title="Mein Gerät nicht mitzählen" subtitle="Wenn du deine Seite selbst öffnest, zählt das sonst als Besuch. Einmal pro Gerät antippen.">
                <div className="flex flex-col gap-2">
                  {published.map(s => (
                    <div key={s.id} className="flex items-center gap-3 flex-wrap">
                      <a href={`${s.url}/.finestsites/notrack`} target="_blank" rel="noopener noreferrer" className="text-[15px] font-semibold underline" style={{ color: '#1a1a1a' }}>{s.host}</a>
                      <a href={`${s.url}/.finestsites/notrack?off=1`} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 underline">wieder mitzählen</a>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Auf welchen Seiten?">
                <label className="flex items-center gap-3 text-[15px] text-gray-800">
                  <input type="checkbox" className="w-5 h-5" checked={config.siteIds === null} onChange={e => saveSites(e.target.checked ? null : published.map(s => s.id))} />
                  Auf allen meinen veröffentlichten Seiten
                </label>
                {config.siteIds !== null && (
                  <div className="flex flex-col gap-2 pl-8">
                    {published.map(s => (
                      <label key={s.id} className="flex items-center gap-3 text-[15px] text-gray-800">
                        <input type="checkbox" className="w-5 h-5" checked={config.siteIds!.includes(s.id)}
                          onChange={e => saveSites(e.target.checked ? [...config.siteIds!, s.id] : config.siteIds!.filter(x => x !== s.id))} />
                        {s.host}
                      </label>
                    ))}
                  </div>
                )}
              </Section>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ─── Zielgruppen-Helfer ───────────────────────────────────────────────────────
// Übersetzt „Ich will die ansprechen, die X, aber nicht Y“ in die Klicks bei Meta.
// Unterscheidung läuft über die Seitenadresse (jede Seite hat ihre eigene) und die
// Ereignisse Lead/Contact, die der Pixel mit derselben Adresse meldet.

const SITUATIONS = [
  { key: 'visited',       title: 'Seite besucht',                          text: 'Alle, die die Seite geöffnet haben.' },
  { key: 'no_lead',       title: 'Besucht, aber keine Anfrage gestellt',   text: 'Für Erinnerungs-Anzeigen: „Du warst auf meiner Seite, hast aber noch nicht angefragt.“' },
  { key: 'no_contact',    title: 'Besucht, aber weder Kontakt noch Anfrage', text: 'Noch enger: auch WhatsApp-, Telefon- und E-Mail-Klicker sind raus.' },
  { key: 'lead',          title: 'Anfrage gestellt',                       text: 'Zum Ausschließen aus Werbung oder als Vorlage für eine Lookalike-Zielgruppe.' },
] as const
type SituationKey = typeof SITUATIONS[number]['key']

function AudienceHelper({ sites, stats }: { sites: Site[]; stats: Stats | null }) {
  const [siteId, setSiteId] = useState<string>(sites[0]?.id ?? '')
  const [situation, setSituation] = useState<SituationKey>('no_lead')
  const [days, setDays] = useState(30)
  const site = sites.find(s => s.id === siteId) ?? sites[0]
  const n = stats?.bySite.find(b => b.siteId === site?.id)
  const consentRate = stats && (stats.totals.consentYes + stats.totals.consentNo) > 0
    ? stats.totals.consentYes / (stats.totals.consentYes + stats.totals.consentNo) : null

  if (sites.length === 0) {
    return (
      <Section title="Zielgruppe für Retargeting zusammenstellen" subtitle="Sobald du eine Seite veröffentlicht hast, zeigt dir dieser Helfer Klick für Klick, wie du z. B. alle ansprichst, die deine Seite besucht, aber nicht angefragt haben." >
        <p className="text-[14px] text-gray-500">Du hast noch keine veröffentlichte Seite.</p>
      </Section>
    )
  }

  const include = `URL enthält  ${site.host}`
  const excludeLead = `Ereignis „Lead“, verfeinert nach: URL enthält  ${site.host}`
  const excludeContact = `Ereignis „Contact“, verfeinert nach: URL enthält  ${site.host}`

  const estimate = (() => {
    if (!n) return null
    const base = situation === 'lead' ? n.leads : situation === 'visited' ? n.pageviews : situation === 'no_lead' ? Math.max(0, n.pageviews - n.leads) : Math.max(0, n.pageviews - n.leads - n.contacts)
    return base
  })()

  return (
    <Section title="Zielgruppe für Retargeting zusammenstellen" subtitle="Sag, wen du ansprechen willst. Du bekommst die genauen Klicks für Meta und siehst, wie groß die Gruppe ungefähr ist.">
      {/* 1. Seite */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-gray-700">1. Welche Seite?</p>
        <div className="flex flex-wrap gap-2">
          {sites.map(s => (
            <button key={s.id} type="button" onClick={() => setSiteId(s.id)}
              className="text-[14px] font-semibold px-3.5 py-2.5 rounded-xl min-h-[42px]"
              style={site?.id === s.id ? { background: '#1a1a1a', color: '#fff' } : { background: '#fff', color: '#1a1a1a', border: '1.5px solid #D1D5DB' }}>
              {s.title}
            </button>
          ))}
        </div>
      </div>
      {/* 2. Situation */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-gray-700">2. Wen davon?</p>
        {SITUATIONS.map(o => (
          <button key={o.key} type="button" onClick={() => setSituation(o.key)}
            className="text-left rounded-2xl px-4 py-3"
            style={{ background: '#fff', border: `1.5px solid ${situation === o.key ? '#1a1a1a' : '#E5E7EB'}` }}>
            <p className="text-[15px] font-semibold text-gray-900">{o.title}</p>
            <p className="text-[14px] text-gray-600 leading-snug">{o.text}</p>
          </button>
        ))}
      </div>
      {/* 3. Zeitraum */}
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-sm font-semibold text-gray-700">3. Wie lange zurück?</p>
        {[7, 30, 90, 180].map(d => (
          <button key={d} type="button" onClick={() => setDays(d)} className="text-[14px] font-semibold px-3 py-2 rounded-xl min-h-[40px]"
            style={days === d ? { background: '#1a1a1a', color: '#fff' } : { background: '#fff', color: '#1a1a1a', border: '1.5px solid #D1D5DB' }}>{d} Tage</button>
        ))}
      </div>

      {/* Ergebnis */}
      <div className="rounded-2xl p-4 sm:p-5 flex flex-col gap-3" style={{ background: '#fff', border: '1.5px solid #1a1a1a' }}>
        <p className="text-[15px] font-bold text-gray-900">So legst du die Zielgruppe bei Meta an</p>
        <ol className="text-[15px] text-gray-700 leading-snug flex flex-col gap-2 pl-5 list-decimal">
          <li>Werbeanzeigenmanager → <strong>Zielgruppen</strong> → <strong>Zielgruppe erstellen</strong> → <strong>Custom Audience</strong> → Quelle <strong>Website</strong>.</li>
          {situation === 'lead' ? (
            <li>Bei „Ereignisse“ statt „Alle Website-Besucher“ das Ereignis <strong>Lead</strong> wählen. Auf <strong>Verfeinern nach</strong> → <strong>URL</strong> → <strong>enthält</strong> und einfügen:
              <Rule text={site.host} /></li>
          ) : (
            <li>„Ereignisse“ auf <strong>Alle Website-Besucher</strong> lassen. Auf <strong>Verfeinern nach</strong> → <strong>URL</strong> → <strong>enthält</strong> und einfügen:
              <Rule text={site.host} /></li>
          )}
          <li>Rechts daneben „in den letzten … Tagen“ auf <strong>{days}</strong> stellen.</li>
          {(situation === 'no_lead' || situation === 'no_contact') && (
            <li>Auf <strong>Weitere Personen ausschließen</strong>. Dort das Ereignis <strong>Lead</strong> wählen, wieder <strong>Verfeinern nach URL enthält</strong> mit derselben Adresse, ebenfalls {days} Tage.
              {situation === 'no_contact' && <> Danach noch einmal <strong>Weitere Personen ausschließen</strong> mit dem Ereignis <strong>Contact</strong>, gleiche Adresse.</>}
            </li>
          )}
          <li>Namen vergeben, z. B. <em>„{site.title}: {SITUATIONS.find(x => x.key === situation)?.title}“</em>, speichern. In der Anzeige unter „Zielgruppe“ diese Custom Audience wählen.</li>
        </ol>
        <details className="text-[14px] text-gray-600">
          <summary className="font-semibold cursor-pointer" style={{ color: '#1a1a1a' }}>Zur Kontrolle: Regeln als Text</summary>
          <div className="mt-2 flex flex-col gap-1.5 font-mono text-[12px]">
            <p><span className="text-gray-400">Einschließen:</span> {situation === 'lead' ? excludeLead.replace('Ereignis', 'Ereignis') : `Alle Website-Besucher, ${include}`}</p>
            {(situation === 'no_lead' || situation === 'no_contact') && <p><span className="text-gray-400">Ausschließen:</span> {excludeLead}</p>}
            {situation === 'no_contact' && <p><span className="text-gray-400">Ausschließen:</span> {excludeContact}</p>}
          </div>
        </details>
        {estimate !== null && n && (
          <p className="text-[14px] leading-snug rounded-xl px-3.5 py-3" style={{ background: '#F8FAFC', color: '#374151' }}>
            <strong>Größe, grob geschätzt:</strong> In den letzten {stats?.days ?? 30} Tagen hatte {site.host} {n.pageviews} Aufrufe, {n.contacts} Kontakte und {n.leads} Anfragen. Für diese Auswahl bleiben etwa <strong>{estimate}</strong> Aufrufe übrig.
            {consentRate !== null && <> Davon landen nur die mit Zustimmung bei Meta, zuletzt {Math.round(consentRate * 100)} %.</>}
            {' '}Meta zeigt die Zielgruppe erst ab 100 Personen an.
          </p>
        )}
        <p className="text-[13px] text-gray-500 leading-snug">Google Ads: Zielgruppenverwaltung → „Website-Besucher“ mit Regel „URL enthält {site.host}“, zum Ausschließen eine zweite Liste aus der Conversion „Anfrage“. TikTok: Zielgruppen → Custom Audience → Website-Traffic, gleiche Logik mit „Formular absenden“. Die Begriffe können bei den Plattformen leicht abweichen, schreib uns im Chat, wenn etwas anders aussieht.</p>
      </div>
    </Section>
  )
}

function Rule({ text }: { text: string }) {
  return (
    <span className="mt-1.5 flex items-center gap-2">
      <code className="flex-1 min-w-0 text-[14px] font-semibold px-3 py-2 rounded-xl break-all" style={{ background: '#F3F4F6', color: '#111' }}>{text}</code>
      <CopyButton text={text} />
    </span>
  )
}

// ─── Einrichten je Plattform ──────────────────────────────────────────────────

function PlatformFlow({ platform, config, sites, onBack, onSaved }: {
  platform: Platform; config: Config | null; sites: Site[]; onBack: () => void; onSaved: (c: Config) => void
}) {
  const info = PLATFORMS[platform]
  const isConnected = !!config && (platform === 'meta' ? !!config.metaPixelId : platform === 'google' ? !!config.googleAdsId : !!config.tiktokPixelId)
  const [step, setStep] = useState(1)
  const [f, setF] = useState({
    id: platform === 'meta' ? config?.metaPixelId ?? '' : platform === 'google' ? config?.googleAdsId ?? '' : config?.tiktokPixelId ?? '',
    label: config?.googleLeadLabel ?? '',
    contactLabel: config?.googleContactLabel ?? '',
    token: '',
    testCode: '',
    confirmed: config?.confirmed ?? false,
  })
  const [error, setError] = useState<{ field: string; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const tokenSet = platform === 'meta' ? !!config?.metaTokenSet : platform === 'tiktok' ? !!config?.tiktokTokenSet : false
  const hasServer = platform !== 'google'
  const lastStep = hasServer ? 3 : 2
  const statusError = config?.lastSend?.platform === platform && config.lastSend.status === 'error' ? config.lastSend.error : null

  async function save(fields: Record<string, unknown>): Promise<boolean> {
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/tracking/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fields, confirmed: f.confirmed }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError({ field: d.field ?? 'form', text: d.error ?? 'Speichern hat nicht geklappt.' }); return false }
      onSaved(d.config)
      return true
    } finally { setBusy(false) }
  }

  async function next() {
    if (step === 1) {
      const ok = platform === 'meta' ? await save({ metaPixelId: f.id })
        : platform === 'google' ? await save({ googleAdsId: f.id, googleLeadLabel: f.label, googleContactLabel: f.contactLabel })
          : await save({ tiktokPixelId: f.id })
      if (ok) setStep(2)
      return
    }
    if (step === 2 && hasServer) {
      if (f.token.trim() === '') { setStep(3); return } // „Später“: ohne Serverweg
      const ok = platform === 'meta' ? await save({ metaToken: f.token }) : await save({ tiktokToken: f.token })
      if (ok) { setF(x => ({ ...x, token: '' })); setStep(3) }
      return
    }
    onBack()
  }

  async function test() {
    setBusy(true); setResult(null)
    try {
      const r = await fetch('/api/tracking/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform, testCode: f.testCode }) })
      const d = await r.json().catch(() => ({}))
      setResult({ ok: !!d.ok, text: d.ok ? d.message : (d.error ?? 'Prüfung fehlgeschlagen.') })
    } finally { setBusy(false) }
  }

  async function disconnect() {
    if (!confirm(`${info.name} trennen? Die Angaben werden gelöscht.`)) return
    const ok = platform === 'meta' ? await save({ metaPixelId: '', metaToken: '-' })
      : platform === 'google' ? await save({ googleAdsId: '', googleLeadLabel: '', googleContactLabel: '' })
        : await save({ tiktokPixelId: '', tiktokToken: '-' })
    if (ok) onBack()
  }

  const siteName = sites.find(s => s.status === 'published')?.host ?? 'deine Seite'

  return (
    <div className="flex flex-col gap-5">
      <button type="button" onClick={onBack} className="self-start flex items-center gap-1.5 text-[15px] font-semibold" style={{ color: '#1a1a1a' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
        Zurück zur Übersicht
      </button>

      <div className="flex items-center gap-3">
        <Logo p={platform} size={44} />
        <div>
          <h3 className="text-xl font-bold text-gray-900 leading-tight">{info.name} {isConnected ? 'verwalten' : 'einrichten'}</h3>
          <p className="text-sm text-gray-500">Schritt {step} von {lastStep}</p>
        </div>
      </div>

      {statusError && step === 1 && (
        <p className="text-[15px] font-medium rounded-2xl px-4 py-3" style={{ background: '#FEF2F2', color: '#B91C1C' }}>Letzte Übertragung fehlgeschlagen: {statusError}</p>
      )}

      <div className="rounded-3xl p-5 sm:p-7 flex flex-col gap-4" style={{ background: '#F8FAFC' }}>
        {/* Schritt 1: ID */}
        {step === 1 && platform === 'meta' && (
          <>
            <h4 className="text-lg font-bold text-gray-900">Deine Pixel-ID</h4>
            <Field id="id" label="Pixel-ID (Meta nennt sie Datensatz-ID)" value={f.id} onChange={v => { setF({ ...f, id: v }); setError(null) }} placeholder="123456789012345" error={error?.field === 'metaPixelId' ? error.text : null} hint="15 bis 16 Ziffern. Ein kopierter Pixel-Code ist auch okay, wir ziehen die Zahl heraus." />
            <Where>
              <p>Gehe auf <strong>business.facebook.com</strong>, links auf <strong>Alle Tools</strong>, dann <strong>Events Manager</strong>. Unter <strong>Datenquellen</strong> klickst du deinen Datensatz an (früher „Pixel“). Die lange Zahl direkt unter dem Namen ist die ID.</p>
              <p className="mt-2">Noch kein Datensatz? <strong>Daten verknüpfen</strong> → <strong>Web</strong> → Namen eingeben, fertig.</p>
            </Where>
          </>
        )}
        {step === 1 && platform === 'google' && (
          <>
            <h4 className="text-lg font-bold text-gray-900">Deine Conversion-Daten</h4>
            <Field id="id" label="Conversion-ID" value={f.id} onChange={v => { setF({ ...f, id: v }); setError(null) }} placeholder="AW-123456789" error={error?.field === 'googleAdsId' ? error.text : null} />
            <Field id="label" label="Conversion-Label für „Anfrage“" value={f.label} onChange={v => { setF({ ...f, label: v }); setError(null) }} placeholder="AbC-dEfGhIjK1LmN" error={error?.field === 'googleLeadLabel' ? error.text : null} />
            <Where>
              <p>In Google Ads links auf <strong>Ziele</strong> → <strong>Conversions</strong> → <strong>Zusammenfassung</strong> → <strong>Neue Conversion-Aktion</strong> → <strong>Website</strong>. Deine Seitenadresse eingeben, dann <strong>Conversion-Aktion manuell hinzufügen</strong>: Kategorie „Lead senden“, Name „Anfrage“.</p>
              <p className="mt-2">Danach <strong>Tag-Einrichtung</strong> → <strong>Tag selbst einrichten</strong>. Dort stehen Conversion-ID und Conversion-Label. Mehr musst du nicht einbauen, das machen wir.</p>
            </Where>
            <details className="text-[15px]">
              <summary className="font-semibold cursor-pointer" style={{ color: '#1a1a1a' }}>Auch WhatsApp-Klicks zählen (freiwillig)</summary>
              <div className="mt-3">
                <Field id="contactLabel" label="Conversion-Label für „Kontakt“" value={f.contactLabel} onChange={v => { setF({ ...f, contactLabel: v }); setError(null) }} placeholder="zweite Conversion-Aktion mit Namen „Kontakt“" error={error?.field === 'googleContactLabel' ? error.text : null} />
              </div>
            </details>
          </>
        )}
        {step === 1 && platform === 'tiktok' && (
          <>
            <h4 className="text-lg font-bold text-gray-900">Deine Pixel-ID</h4>
            <Field id="id" label="Pixel-ID" value={f.id} onChange={v => { setF({ ...f, id: v }); setError(null) }} placeholder="CABC1DEFGH2IJKLM3NOP" error={error?.field === 'tiktokPixelId' ? error.text : null} hint="Etwa 20 Zeichen aus Buchstaben und Ziffern." />
            <Where>
              <p>Im <strong>TikTok Ads Manager</strong> oben auf <strong>Tools</strong> → <strong>Events</strong> → <strong>Web-Events</strong>. Pixel anlegen („Manuell einrichten“) oder einen vorhandenen öffnen. Die Pixel-ID steht oben.</p>
            </Where>
          </>
        )}
        {step === 1 && !config?.confirmed && (
          <label className="flex items-start gap-3 text-[15px] text-gray-800">
            <input type="checkbox" className="w-5 h-5 mt-0.5" checked={f.confirmed} onChange={e => { setF({ ...f, confirmed: e.target.checked }); setError(null) }} />
            <span>Ich bin für mein Werbekonto verantwortlich und weiß, dass meine Besucher dann einen kurzen Hinweis zur Einwilligung sehen. Die Datenschutzseite meiner Webseite wird automatisch ergänzt.</span>
          </label>
        )}
        {error && !['metaPixelId', 'googleAdsId', 'googleLeadLabel', 'googleContactLabel', 'tiktokPixelId', 'metaToken', 'tiktokToken'].includes(error.field) && (
          <p role="alert" className="text-[15px] font-medium rounded-2xl px-4 py-3" style={{ background: '#FEF2F2', color: '#B91C1C' }}>{error.text}</p>
        )}

        {/* Schritt 2: Token (Meta/TikTok) bzw. Fertig (Google) */}
        {step === 2 && hasServer && (
          <>
            <h4 className="text-lg font-bold text-gray-900">Zugriffsschlüssel {tokenSet ? '(bereits hinterlegt)' : '(empfohlen)'}</h4>
            <p className="text-[15px] text-gray-600 leading-snug">Damit melden wir Anfragen zusätzlich direkt von unserem Server. So zählen sie auch, wenn ein Werbeblocker den Pixel im Browser blockiert. Wird verschlüsselt gespeichert und nie angezeigt.</p>
            <Field id="token" label={tokenSet ? 'Neuen Schlüssel eintragen (nur zum Ersetzen)' : 'Zugriffsschlüssel'} value={f.token} onChange={v => { setF({ ...f, token: v }); setError(null) }} placeholder={platform === 'meta' ? 'EAA…' : ''} secret error={error?.field === 'metaToken' || error?.field === 'tiktokToken' ? error.text : null} />
            <Where>
              {platform === 'meta'
                ? <p>Im Events Manager in deinem Datensatz oben auf <strong>Einstellungen</strong>, dann nach unten bis <strong>Conversions API</strong>. Dort <strong>Zugriffsschlüssel generieren</strong>. Der lange Text beginnt mit EAA. Kopieren und hier einfügen.</p>
                : <p>Im Pixel auf <strong>Einstellungen</strong> → <strong>Events API</strong> → <strong>Zugriffstoken generieren</strong>. Kopieren und hier einfügen.</p>}
            </Where>
          </>
        )}
        {step === 2 && !hasServer && (
          <>
            <h4 className="text-lg font-bold text-gray-900">Fertig. Ein Tipp noch:</h4>
            <p className="text-[15px] text-gray-700 leading-snug">Schalte in Google Ads in der Conversion-Aktion <strong>„Erweiterte Conversions“</strong> ein und wähle „Google-Tag“. Dann erkennt Google Anfragen deutlich besser. Google-Anzeigen messen wir im Browser des Besuchers, mit Google Consent Mode.</p>
            <p className="text-[15px] text-gray-700 leading-snug">In der Kampagne wählst du als Ziel die Conversion <strong>„Anfrage“</strong>.</p>
          </>
        )}

        {/* Schritt 3: Prüfen */}
        {step === 3 && (
          <>
            <h4 className="text-lg font-bold text-gray-900">Verbindung prüfen</h4>
            {(platform === 'meta' ? config?.metaTokenSet : config?.tiktokTokenSet) ? (
              <>
                <p className="text-[15px] text-gray-600 leading-snug">Wir schicken ein Test-Ereignis „Lead“. {platform === 'meta' ? 'Mit Test-Code siehst du es in Meta sofort unter „Ereignisse testen“.' : ''}</p>
                {platform === 'meta' && (
                  <Field id="testCode" label="Test-Code (freiwillig)" value={f.testCode} onChange={v => setF({ ...f, testCode: v })} placeholder="TEST12345" hint="Im Events Manager in deinem Datensatz unter „Ereignisse testen“." />
                )}
                <div className="flex flex-wrap gap-2">
                  <Secondary onClick={test} disabled={busy}>{busy ? 'Prüfe …' : 'Jetzt prüfen'}</Secondary>
                </div>
                {result && (
                  <p role="status" className="text-[15px] font-medium rounded-2xl px-4 py-3" style={{ background: result.ok ? '#ECFDF5' : '#FEF2F2', color: result.ok ? '#15803D' : '#B91C1C' }}>{result.text}</p>
                )}
              </>
            ) : (
              <p className="text-[15px] text-gray-700 leading-snug">Ohne Zugriffsschlüssel läuft der Pixel nur im Browser deiner Besucher. Das funktioniert, zählt aber weniger, wenn Werbeblocker im Spiel sind. Du kannst den Schlüssel jederzeit nachtragen.</p>
            )}
            <div className="rounded-2xl px-4 py-3.5 text-[15px] leading-snug" style={{ background: '#fff', border: '1px solid #E5E7EB', color: '#374151' }}>
              <p className="font-semibold text-gray-900 mb-1">So legst du die Anzeige an</p>
              {platform === 'meta' && <p>Kampagnenziel <strong>Leads</strong> · Conversion-Ort <strong>Website</strong> · dein Datensatz · Ereignis <strong>Lead</strong>. Als Website-Adresse {siteName}.</p>}
              {platform === 'tiktok' && <p>Kampagnenziel <strong>Lead-Generierung</strong> · <strong>Website</strong> · dein Pixel · Ereignis <strong>Formular absenden</strong>. Als Website-Adresse {siteName}.</p>}
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {step > 1 && <Secondary onClick={() => setStep(step - 1)} disabled={busy}>Zurück</Secondary>}
          <Primary onClick={next} disabled={busy || (step === 1 && !f.id.trim())}>
            {busy && step < 3 ? 'Speichert …' : step === lastStep ? 'Fertig' : step === 2 && hasServer && f.token.trim() === '' && !tokenSet ? 'Später, ohne Schlüssel weiter' : 'Weiter'}
          </Primary>
          {isConnected && (
            <button type="button" onClick={disconnect} className="ml-auto text-sm font-semibold underline" style={{ color: '#B91C1C' }}>{info.name} trennen</button>
          )}
        </div>
      </div>
    </div>
  )
}
