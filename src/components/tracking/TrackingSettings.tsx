'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Einstellungen → Werbung: Meta / Google Ads / TikTok einrichten, prüfen, auswerten.
 * Nur für Nutzer, die Anzeigen schalten. Konzept: docs/werbung-tracking-konzept.html
 */

interface Config {
  metaPixelId: string; metaTokenSet: boolean
  googleAdsId: string; googleLeadLabel: string; googleContactLabel: string
  tiktokPixelId: string; tiktokTokenSet: boolean
  siteIds: string[] | null
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

const INPUT = 'w-full px-4 py-3 text-[15px] rounded-2xl outline-none transition-all bg-white'
const border = (err?: boolean) => ({ border: `1.5px solid ${err ? '#DC2626' : '#E5E7EB'}` })

function Field({ id, label, hint, value, onChange, placeholder, error, mono, secret }: {
  id: string; label: string; hint?: string; value: string; onChange: (v: string) => void
  placeholder?: string; error?: string | null; mono?: boolean; secret?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-gray-700">{label}</label>
      <input
        id={id} type={secret ? 'password' : 'text'} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        className={INPUT} style={{ ...border(!!error), fontFamily: mono ? 'ui-monospace, Menlo, monospace' : undefined }}
        onFocus={e => { if (!error) e.target.style.borderColor = '#1a1a1a' }}
        onBlur={e => { if (!error) e.target.style.borderColor = '#E5E7EB' }}
      />
      {error ? (
        <p role="alert" className="text-sm font-medium rounded-2xl px-4 py-3" style={{ background: '#FEF2F2', color: '#B91C1C' }}>{error}</p>
      ) : hint ? (
        <p className="text-[13px] px-1" style={{ color: '#64748B' }}>{hint}</p>
      ) : null}
    </div>
  )
}

function Steps({ steps }: { steps: { title: string; text: string }[] }) {
  return (
    <ol className="flex flex-col gap-3 mt-3">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: '#1a1a1a' }}>{i + 1}</span>
          <div>
            <p className="text-[15px] font-semibold text-gray-900">{s.title}</p>
            <p className="text-[15px] text-gray-600 leading-snug">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function Card({ title, badge, children }: { title: string; badge?: { text: string; ok: boolean }; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl p-5 sm:p-7 flex flex-col gap-4" style={{ background: '#F8FAFC' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        {badge && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: badge.ok ? '#DCFCE7' : '#F3F4F6', color: badge.ok ? '#15803D' : '#6B7280' }}>{badge.text}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function CopyButton({ text, label = 'Kopieren' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800) } catch { /* ignore */ } }}
      className="flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-xl"
      style={{ background: done ? '#DCFCE7' : '#1a1a1a', color: done ? '#15803D' : '#fff' }}>
      {done ? 'Kopiert' : label}
    </button>
  )
}

export default function TrackingSettings() {
  const [config, setConfig] = useState<Config | null>(null)
  const [sites, setSites] = useState<Site[]>([])
  const [loaded, setLoaded] = useState(false)
  const [form, setForm] = useState({
    metaPixelId: '', metaToken: '', metaTestCode: '',
    googleAdsId: '', googleLeadLabel: '', googleContactLabel: '',
    tiktokPixelId: '', tiktokToken: '', tiktokTestCode: '',
    confirmed: false, allSites: true, siteIds: [] as string[],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ platform: string; ok: boolean; text: string } | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch('/api/tracking/config').then(r => r.json()).catch(() => null)
    if (!r) return
    setConfig(r.config)
    setSites(r.sites ?? [])
    if (r.config) {
      setForm(f => ({
        ...f,
        metaPixelId: r.config.metaPixelId, googleAdsId: r.config.googleAdsId,
        googleLeadLabel: r.config.googleLeadLabel, googleContactLabel: r.config.googleContactLabel,
        tiktokPixelId: r.config.tiktokPixelId, confirmed: r.config.confirmed,
        allSites: !Array.isArray(r.config.siteIds), siteIds: r.config.siteIds ?? [],
      }))
    }
    setLoaded(true)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!config) return
    fetch('/api/tracking/stats?days=30').then(r => r.json()).then(setStats).catch(() => {})
  }, [config])

  const set = (k: keyof typeof form) => (v: string) => { setForm(f => ({ ...f, [k]: v })); setSaved(false); setErrors(e => ({ ...e, [k]: '' })) }
  const active = !!config && (config.metaPixelId || config.googleAdsId || config.tiktokPixelId)
  const wantsAny = !!(form.metaPixelId || form.googleAdsId || form.tiktokPixelId)

  async function save() {
    setSaving(true); setSaved(false); setErrors({}); setTestResult(null)
    try {
      const res = await fetch('/api/tracking/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metaPixelId: form.metaPixelId, metaToken: form.metaToken,
          googleAdsId: form.googleAdsId, googleLeadLabel: form.googleLeadLabel, googleContactLabel: form.googleContactLabel,
          tiktokPixelId: form.tiktokPixelId, tiktokToken: form.tiktokToken,
          confirmed: form.confirmed, siteIds: form.allSites ? null : form.siteIds,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setErrors({ [data.field ?? 'form']: data.error ?? 'Speichern hat nicht geklappt.' }); return }
      setConfig(data.config)
      // Bereinigte Werte übernehmen (z. B. ID aus einem kopierten Pixel-Code), Tokens leeren
      const c = data.config as Config | null
      setForm(f => ({
        ...f, metaToken: '', tiktokToken: '',
        metaPixelId: c?.metaPixelId ?? '', googleAdsId: c?.googleAdsId ?? '',
        googleLeadLabel: c?.googleLeadLabel ?? '', googleContactLabel: c?.googleContactLabel ?? '',
        tiktokPixelId: c?.tiktokPixelId ?? '', confirmed: c?.confirmed ?? f.confirmed,
      }))
      setSaved(true)
    } finally { setSaving(false) }
  }

  async function test(platform: 'meta' | 'tiktok') {
    setTesting(platform); setTestResult(null)
    try {
      const res = await fetch('/api/tracking/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, testCode: platform === 'meta' ? form.metaTestCode : form.tiktokTestCode }),
      })
      const data = await res.json().catch(() => ({}))
      setTestResult({ platform, ok: !!data.ok, text: data.ok ? data.message : (data.error ?? 'Prüfung fehlgeschlagen.') })
      load()
    } finally { setTesting(null) }
  }

  async function remove() {
    if (!confirm('Tracking komplett ausschalten und alle Angaben löschen?')) return
    await fetch('/api/tracking/config', { method: 'DELETE' })
    setConfig(null); setStats(null)
    setForm(f => ({ ...f, metaPixelId: '', metaToken: '', googleAdsId: '', googleLeadLabel: '', googleContactLabel: '', tiktokPixelId: '', tiktokToken: '', confirmed: false }))
  }

  if (!loaded) return <div className="h-24 rounded-3xl animate-pulse" style={{ background: '#F1F5F9' }} />

  const published = sites.filter(s => s.status === 'published')
  const adLink = (s: Site, p: 'meta' | 'google' | 'tiktok') => {
    const q = p === 'meta'
      ? 'utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{adset.name}}'
      : p === 'google'
        ? 'utm_source=google&utm_medium=paid&utm_campaign={campaignid}&utm_content={adgroupid}'
        : 'utm_source=tiktok&utm_medium=paid&utm_campaign=__CAMPAIGN_NAME__&utm_content=__AID_NAME__'
    return `${s.url}/?${q}`
  }

  const statusLine = (() => {
    if (!config?.lastSend) return null
    const when = new Date(config.lastSend.at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    const name = config.lastSend.platform === 'tiktok' ? 'TikTok' : 'Meta'
    return config.lastSend.status === 'ok'
      ? { ok: true, text: `Letzte Übertragung an ${name}: ${when} Uhr, angenommen.` }
      : { ok: false, text: `Letzte Übertragung an ${name}: ${when} Uhr, fehlgeschlagen. ${config.lastSend.error ?? ''}` }
  })()

  return (
    <div className="flex flex-col gap-6">
      {/* Für wen ist das? */}
      <div className="rounded-3xl p-5 sm:p-6" style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE' }}>
        <p className="text-base font-bold" style={{ color: '#1E3A8A' }}>Schaltest du Werbeanzeigen bei Facebook, Instagram, Google oder TikTok?</p>
        <p className="text-[15px] mt-1 leading-snug" style={{ color: '#1E40AF' }}>
          Nur dann brauchst du diesen Bereich. Hier verbindest du dein Werbekonto, damit es sieht, welche Anzeige echte Anfragen bringt. Wenn du keine Anzeigen schaltest, kannst du das hier ignorieren.
        </p>
      </div>

      {!active && !showAll && (
        <button type="button" onClick={() => setShowAll(true)}
          className="self-start text-[15px] font-semibold px-6 py-3 rounded-2xl" style={{ background: '#1a1a1a', color: '#fff' }}>
          Ich schalte Anzeigen, einrichten
        </button>
      )}

      {(active || showAll) && (
        <>
          {statusLine && (
            <div className="rounded-2xl px-4 py-3 text-[15px] font-medium" style={{ background: statusLine.ok ? '#ECFDF5' : '#FEF2F2', color: statusLine.ok ? '#15803D' : '#B91C1C' }}>
              {statusLine.text}
              {config?.firstLeadAt && statusLine.ok && <span className="block text-sm font-normal mt-0.5">Erste echte Anfrage übertragen am {new Date(config.firstLeadAt).toLocaleDateString('de-DE')}.</span>}
            </div>
          )}

          {/* META */}
          <Card title="Meta (Facebook & Instagram)" badge={config?.metaPixelId ? { text: config.metaTokenSet ? 'Eingerichtet, mit Server-Übertragung' : 'Pixel eingerichtet, ohne Zugriffsschlüssel', ok: true } : undefined}>
            <Field id="metaPixelId" label="Pixel-ID (Datensatz-ID)" value={form.metaPixelId} onChange={set('metaPixelId')} placeholder="z. B. 123456789012345" mono error={errors.metaPixelId}
              hint="15 bis 16 Ziffern. Steht im Events Manager direkt unter dem Namen deines Datensatzes." />
            <Field id="metaToken" label={config?.metaTokenSet ? 'Zugriffsschlüssel (hinterlegt, nur zum Ersetzen eintragen)' : 'Zugriffsschlüssel für die Conversions API'} value={form.metaToken} onChange={set('metaToken')} placeholder={config?.metaTokenSet ? '••••••••' : 'EAA…'} mono secret error={errors.metaToken}
              hint="Damit zählen Anfragen auch dann, wenn ein Werbeblocker den Pixel im Browser blockiert. Wird verschlüsselt gespeichert." />
            <button type="button" onClick={() => setOpen(o => ({ ...o, meta: !o.meta }))} className="self-start text-sm font-semibold underline" style={{ color: '#1a1a1a' }}>
              {open.meta ? 'Anleitung ausblenden' : 'Wo finde ich das? Anleitung in 4 Schritten'}
            </button>
            {open.meta && (
              <Steps steps={[
                { title: 'Events Manager öffnen', text: 'Gehe auf business.facebook.com, links auf „Alle Tools“, dann „Events Manager“. Links unter „Datenquellen“ siehst du deinen Datensatz (früher „Pixel“). Ist keiner da: „Daten verknüpfen“ → „Web“ → Namen eingeben, fertig.' },
                { title: 'Die ID kopieren', text: 'Klicke den Datensatz an. Direkt unter dem Namen steht eine lange Zahl: die Datensatz-ID. Kopieren und oben in „Pixel-ID“ einfügen.' },
                { title: 'Zugriffsschlüssel erzeugen', text: 'Im Datensatz oben auf „Einstellungen“, dann nach unten bis „Conversions API“. Dort „Zugriffsschlüssel generieren“. Es erscheint ein langer Text, der mit EAA beginnt. Kopieren und oben einfügen.' },
                { title: 'Speichern und prüfen', text: 'Unten auf „Speichern“. Dann im Datensatz auf „Ereignisse testen“: Dort steht ein Code wie TEST12345. Hier eintragen und „Verbindung prüfen“ drücken. In Meta erscheint sofort ein Test-Ereignis „Lead“.' },
              ]} />
            )}
            {config?.metaPixelId && config.metaTokenSet && (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="flex-1">
                  <Field id="metaTestCode" label="Test-Code aus „Ereignisse testen“ (freiwillig)" value={form.metaTestCode} onChange={set('metaTestCode')} placeholder="TEST12345" mono />
                </div>
                <button type="button" onClick={() => test('meta')} disabled={testing === 'meta'}
                  className="text-[15px] font-semibold px-5 py-3 rounded-2xl disabled:opacity-60" style={{ background: '#fff', color: '#1a1a1a', border: '1.5px solid #1a1a1a' }}>
                  {testing === 'meta' ? 'Prüfe …' : 'Verbindung prüfen'}
                </button>
              </div>
            )}
            {testResult?.platform === 'meta' && (
              <p role="status" className="text-[15px] font-medium rounded-2xl px-4 py-3" style={{ background: testResult.ok ? '#ECFDF5' : '#FEF2F2', color: testResult.ok ? '#15803D' : '#B91C1C' }}>{testResult.text}</p>
            )}
          </Card>

          {/* GOOGLE */}
          <Card title="Google Ads" badge={config?.googleAdsId ? { text: 'Eingerichtet', ok: true } : undefined}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="googleAdsId" label="Conversion-ID" value={form.googleAdsId} onChange={set('googleAdsId')} placeholder="AW-123456789" mono error={errors.googleAdsId} />
              <Field id="googleLeadLabel" label="Conversion-Label „Anfrage“" value={form.googleLeadLabel} onChange={set('googleLeadLabel')} placeholder="AbC-dEfGhIjK1LmN" mono error={errors.googleLeadLabel} />
            </div>
            <Field id="googleContactLabel" label="Conversion-Label „Kontakt“ (freiwillig, für WhatsApp-Klicks)" value={form.googleContactLabel} onChange={set('googleContactLabel')} placeholder="leer lassen, wenn du nur Anfragen zählen willst" mono error={errors.googleContactLabel} />
            <button type="button" onClick={() => setOpen(o => ({ ...o, google: !o.google }))} className="self-start text-sm font-semibold underline" style={{ color: '#1a1a1a' }}>
              {open.google ? 'Anleitung ausblenden' : 'Wo finde ich das? Anleitung in 3 Schritten'}
            </button>
            {open.google && (
              <Steps steps={[
                { title: 'Conversion anlegen', text: 'In Google Ads links auf „Ziele“ → „Conversions“ → „Zusammenfassung“ → „Neue Conversion-Aktion“ → „Website“. Deine Seitenadresse eingeben, dann „Conversion-Aktion manuell hinzufügen“. Kategorie „Lead senden“, Name „Anfrage“. Optional eine zweite mit Namen „Kontakt“.' },
                { title: 'ID und Label kopieren', text: 'Nach dem Anlegen auf „Tag-Einrichtung“ → „Tag selbst einrichten“. Dort stehen „Conversion-ID“ (AW-…) und „Conversion-Label“. Beides oben eintragen. Mehr musst du nicht einbauen, das übernehmen wir.' },
                { title: 'Erweiterte Conversions einschalten', text: 'In der Conversion-Aktion unter „Erweiterte Conversions“ einschalten und „Google-Tag“ wählen. Dann erkennt Google Anfragen besser.' },
              ]} />
            )}
          </Card>

          {/* TIKTOK */}
          <Card title="TikTok" badge={config?.tiktokPixelId ? { text: config.tiktokTokenSet ? 'Eingerichtet, mit Server-Übertragung' : 'Pixel eingerichtet', ok: true } : undefined}>
            <Field id="tiktokPixelId" label="Pixel-ID" value={form.tiktokPixelId} onChange={set('tiktokPixelId')} placeholder="z. B. CABC1DEFGH2IJKLM3NOP" mono error={errors.tiktokPixelId} />
            <Field id="tiktokToken" label={config?.tiktokTokenSet ? 'Zugriffstoken (hinterlegt, nur zum Ersetzen eintragen)' : 'Zugriffstoken für die Events API'} value={form.tiktokToken} onChange={set('tiktokToken')} placeholder={config?.tiktokTokenSet ? '••••••••' : ''} mono secret error={errors.tiktokToken} />
            <button type="button" onClick={() => setOpen(o => ({ ...o, tiktok: !o.tiktok }))} className="self-start text-sm font-semibold underline" style={{ color: '#1a1a1a' }}>
              {open.tiktok ? 'Anleitung ausblenden' : 'Wo finde ich das? Anleitung in 3 Schritten'}
            </button>
            {open.tiktok && (
              <Steps steps={[
                { title: 'Pixel öffnen', text: 'Im TikTok Ads Manager oben auf „Tools“ → „Events“ → „Web-Events“. Pixel anlegen (Name eingeben, „Manuell einrichten“) oder einen vorhandenen öffnen.' },
                { title: 'Pixel-ID kopieren', text: 'Oben im Pixel steht die Pixel-ID (etwa 20 Zeichen). Kopieren und oben eintragen.' },
                { title: 'Zugriffstoken erzeugen', text: 'Im Pixel auf „Einstellungen“ → „Events API“ → „Zugriffstoken generieren“. Kopieren und oben eintragen, dann speichern und „Verbindung prüfen“.' },
              ]} />
            )}
            {config?.tiktokPixelId && config.tiktokTokenSet && (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="flex-1">
                  <Field id="tiktokTestCode" label="Test-Code (freiwillig)" value={form.tiktokTestCode} onChange={set('tiktokTestCode')} placeholder="TEST…" mono />
                </div>
                <button type="button" onClick={() => test('tiktok')} disabled={testing === 'tiktok'}
                  className="text-[15px] font-semibold px-5 py-3 rounded-2xl disabled:opacity-60" style={{ background: '#fff', color: '#1a1a1a', border: '1.5px solid #1a1a1a' }}>
                  {testing === 'tiktok' ? 'Prüfe …' : 'Verbindung prüfen'}
                </button>
              </div>
            )}
            {testResult?.platform === 'tiktok' && (
              <p role="status" className="text-[15px] font-medium rounded-2xl px-4 py-3" style={{ background: testResult.ok ? '#ECFDF5' : '#FEF2F2', color: testResult.ok ? '#15803D' : '#B91C1C' }}>{testResult.text}</p>
            )}
          </Card>

          {/* Seiten + Bestätigung + Speichern */}
          <Card title="Auf welchen Seiten?">
            <label className="flex items-center gap-3 text-[15px] text-gray-800">
              <input type="checkbox" checked={form.allSites} onChange={e => setForm(f => ({ ...f, allSites: e.target.checked }))} className="w-5 h-5" />
              Auf allen meinen veröffentlichten Seiten (empfohlen)
            </label>
            {!form.allSites && (
              <div className="flex flex-col gap-2 pl-8">
                {published.map(s => (
                  <label key={s.id} className="flex items-center gap-3 text-[15px] text-gray-800">
                    <input type="checkbox" className="w-5 h-5" checked={form.siteIds.includes(s.id)}
                      onChange={e => setForm(f => ({ ...f, siteIds: e.target.checked ? [...f.siteIds, s.id] : f.siteIds.filter(x => x !== s.id) }))} />
                    {s.host}
                  </label>
                ))}
                {published.length === 0 && <p className="text-sm text-gray-500">Du hast noch keine veröffentlichte Seite.</p>}
              </div>
            )}
            {wantsAny && !config?.confirmed && (
              <label className="flex items-start gap-3 text-[15px] text-gray-800 mt-2">
                <input type="checkbox" checked={form.confirmed} onChange={e => { setForm(f => ({ ...f, confirmed: e.target.checked })); setErrors(er => ({ ...er, confirmed: '' })) }} className="w-5 h-5 mt-0.5" />
                <span>Ich bin für mein Werbekonto verantwortlich und weiß, dass meine Besucher dann einen kurzen Hinweis zur Einwilligung sehen. Die Datenschutzseite meiner Webseite wird automatisch ergänzt.</span>
              </label>
            )}
            {errors.confirmed && <p role="alert" className="text-sm font-medium rounded-2xl px-4 py-3" style={{ background: '#FEF2F2', color: '#B91C1C' }}>{errors.confirmed}</p>}
            {errors.form && <p role="alert" className="text-sm font-medium rounded-2xl px-4 py-3" style={{ background: '#FEF2F2', color: '#B91C1C' }}>{errors.form}</p>}
            <div className="flex items-center gap-3 flex-wrap">
              <button type="button" onClick={save} disabled={saving}
                className="text-[15px] font-semibold px-6 py-3 rounded-2xl disabled:opacity-60" style={{ background: '#1a1a1a', color: '#fff' }}>
                {saving ? 'Wird gespeichert …' : 'Speichern'}
              </button>
              {saved && <span role="status" className="text-sm font-semibold" style={{ color: '#15803D' }}>Gespeichert. Auf deinen Seiten in spätestens einer Minute aktiv.</span>}
              {active && (
                <button type="button" onClick={remove} className="text-sm font-semibold underline ml-auto" style={{ color: '#B91C1C' }}>Tracking ausschalten</button>
              )}
            </div>
          </Card>

          {active && (
            <>
              {/* Anzeigen-Links */}
              <Card title="Dein Anzeigen-Link je Seite">
                <p className="text-[15px] text-gray-600 leading-snug">
                  Diesen Link setzt du in der Anzeige als Website-Adresse ein. Die Plattform ersetzt die Platzhalter automatisch durch Kampagnen- und Anzeigennamen. So siehst du unten, aus welcher Kampagne jede Anfrage kam.
                </p>
                {published.map(s => (
                  <div key={s.id} className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
                    <p className="text-sm font-semibold text-gray-900">{s.host}</p>
                    {(['meta', 'google', 'tiktok'] as const).filter(p => (p === 'meta' && config?.metaPixelId) || (p === 'google' && config?.googleAdsId) || (p === 'tiktok' && config?.tiktokPixelId)).map(p => (
                      <div key={p} className="flex items-center gap-2">
                        <span className="text-xs font-semibold w-14 flex-shrink-0 text-gray-500">{p === 'meta' ? 'Meta' : p === 'google' ? 'Google' : 'TikTok'}</span>
                        <code className="flex-1 min-w-0 text-[12px] break-all text-gray-700">{adLink(s, p)}</code>
                        <CopyButton text={adLink(s, p)} />
                      </div>
                    ))}
                  </div>
                ))}
                <div className="rounded-2xl p-4 text-[15px] leading-snug" style={{ background: '#fff', border: '1px solid #E5E7EB', color: '#374151' }}>
                  <p className="font-semibold text-gray-900 mb-1">So legst du die Anzeige bei Meta an</p>
                  Kampagnenziel <strong>Leads</strong> · Conversion-Ort <strong>Website</strong> · dein Datensatz · Conversion-Ereignis <strong>Lead</strong> · Website-URL: der Link oben.
                </div>
              </Card>

              {/* Mein Gerät */}
              <Card title="Mein Gerät nicht mitzählen">
                <p className="text-[15px] text-gray-600 leading-snug">Wenn du deine Seite selbst öffnest, würde das sonst als Besuch zählen. Tippe den Link auf jedem Gerät an, mit dem du deine Seite anschaust.</p>
                <div className="flex flex-col gap-2">
                  {published.map(s => (
                    <div key={s.id} className="flex items-center gap-3 flex-wrap">
                      <a href={`${s.url}/.finestsites/notrack`} target="_blank" rel="noopener noreferrer" className="text-[15px] font-semibold underline" style={{ color: '#1a1a1a' }}>{s.host}: dieses Gerät ausschließen</a>
                      <a href={`${s.url}/.finestsites/notrack?off=1`} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 underline">wieder mitzählen</a>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Auswertung */}
              <Card title={`Auswertung, letzte ${stats?.days ?? 30} Tage`}>
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
                      <p className="text-sm text-gray-600">
                        Einwilligung: {Math.round(stats.totals.consentYes / (stats.totals.consentYes + stats.totals.consentNo) * 100)} % der Besucher, die gewählt haben, haben zugestimmt. Nur bei diesen sehen die Werbeplattformen etwas. Anfragen und Kontakte zählen wir hier unabhängig davon.
                      </p>
                    )}
                    {stats.byCampaign.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="text-left text-xs text-gray-500"><th className="py-2 pr-3">Quelle</th><th className="py-2 pr-3">Kampagne</th><th className="py-2 pr-3 text-right">Aufrufe</th><th className="py-2 pr-3 text-right">Kontakte</th><th className="py-2 text-right">Anfragen</th></tr></thead>
                          <tbody>
                            {stats.byCampaign.map((r, i) => (
                              <tr key={i} style={{ borderTop: '1px solid #E5E7EB' }}>
                                <td className="py-2 pr-3 font-medium text-gray-900">{r.source}</td>
                                <td className="py-2 pr-3 text-gray-700">{r.campaign || '–'}</td>
                                <td className="py-2 pr-3 text-right text-gray-700">{r.pageviews}</td>
                                <td className="py-2 pr-3 text-right text-gray-700">{r.contacts}</td>
                                <td className="py-2 text-right font-semibold text-gray-900">{r.leads}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {stats.bySite.length > 1 && (
                      <div className="flex flex-col gap-1 text-sm text-gray-700">
                        {stats.bySite.map(s => <p key={s.siteId}><strong>{s.host}</strong>: {s.pageviews} Aufrufe, {s.contacts} Kontakte, {s.leads} Anfragen</p>)}
                      </div>
                    )}
                  </>
                )}
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}
