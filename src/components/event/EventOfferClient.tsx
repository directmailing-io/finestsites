'use client'

import { useMemo, useState } from 'react'
import { PLANS, type BillingInterval, type PlanKey } from '@/lib/plans'
import { campaignDiscount, type PublicCampaign } from '@/lib/billing/campaign-shared'
import { discountedTotal, formatEur, promoDurationInfo } from '@/lib/billing/promo-duration'
import { useCampaignCountdown } from '@/components/billing/useCampaign'
import type { EventConfig } from '@/lib/event/config'

export interface DemoSite { domain: string; label: string; thumbUrl: string | null }

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io'

/** Kurztexte der nicht empfohlenen Tarife (der empfohlene kommt aus der Event-Konfiguration) */
const PLAN_COPY: Record<PlanKey, { title: string; text: string; alt: string }> = {
  starter: { title: '1 Webseite', text: 'Zum Beispiel deine Optimalset-Seite. Mehr Seiten gehen später jederzeit dazu.', alt: 'Nur eine Seite? Starter' },
  pro: { title: '3 Webseiten', text: 'Optimalset, PM-Business und cellRESET. Fertige Texte, fertiges Design, du trägst nur deine Daten ein.', alt: 'Zurück zu Pro' },
  unlimited: { title: 'Alle Webseiten', text: 'Optimalset, PM-Business, cellRESET, Vitalprofil und jede neue Vorlage, die dazukommt.', alt: 'Alle Vorlagen? Unlimited' },
}

function pad(n: number): string { return n < 10 ? `0${n}` : String(n) }

export default function EventOfferClient({ event, campaign, demoSites, canceled }: {
  event: EventConfig
  campaign: PublicCampaign | null
  demoSites: DemoSite[]
  canceled: boolean
}) {
  const [plan, setPlan] = useState<PlanKey>(event.recommendedPlan)
  const [interval, setInterval] = useState<BillingInterval>(event.defaultInterval)
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ text: string; existing?: boolean } | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'copied' | 'mailing' | 'mailed' | 'mailError'>('idle')
  const [saveMail, setSaveMail] = useState('')
  const [saveMailError, setSaveMailError] = useState('')

  const countdown = useCampaignCountdown(campaign)
  // Angebot läuft: Code vorhanden und noch nicht abgelaufen (tickt sekündlich, endet ohne Neuladen)
  const live = !!campaign && countdown.live
  const offer = live ? campaign : null

  const prices = useMemo(() => {
    const p = PLANS[plan]
    const base = interval === 'yearly' ? p.yearly_eur : p.monthly_eur
    const off = campaignDiscount(offer, interval)
    const price = discountedTotal(base, off)
    const duration = off && offer ? promoDurationInfo(offer.duration, offer.durationInMonths, interval) : null
    // Jahresvorteil ehrlich gerechnet: Monatsabo mit Aktion über das erste Jahr gegen Jahresabo mit Aktion
    const offM = campaignDiscount(offer, 'monthly')
    const offY = campaignDiscount(offer, 'yearly')
    const discMonths = !offer || !offM ? 0 : offer.duration === 'forever' ? 12 : offer.duration === 'once' ? 1 : Math.min(12, offer.durationInMonths ?? 1)
    const monthlyYear = discMonths * discountedTotal(p.monthly_eur, offM) + (12 - discMonths) * p.monthly_eur
    const yearlyTotal = discountedTotal(p.yearly_eur, offY)
    const saving = Math.round((monthlyYear - yearlyTotal) * 100) / 100
    return { base, off, price, duration, saving, perMonth: Math.round((price / 12) * 100) / 100, monthlyList: p.monthly_eur }
  }, [plan, interval, offer])

  const altPrice = (k: PlanKey) => {
    const p = PLANS[k]
    const base = interval === 'yearly' ? p.yearly_eur : p.monthly_eur
    return `${formatEur(discountedTotal(base, campaignDiscount(offer, interval)))} €/${interval === 'yearly' ? 'Jahr' : 'Monat'}`
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/event/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: event.slug, first_name: firstName, email, plan, interval }),
      })
      const data = await res.json().catch(() => ({})) as { url?: string; error?: string; existing?: boolean }
      if (!res.ok || !data.url) {
        setError({ text: data.error ?? 'Das hat leider nicht geklappt. Bitte versuche es noch einmal.', existing: data.existing })
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setError({ text: 'Keine Verbindung. Bitte prüfe dein Internet und versuche es noch einmal.' })
      setLoading(false)
    }
  }

  async function saveForLater() {
    const url = `https://finestsites.io/${event.slug}`
    const title = `FinestSites · ${event.name}-Angebot`
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text: 'Mein Link zum FinestSites-Angebot', url })
        return
      }
    } catch { /* abgebrochen → Link kopieren */ }
    try {
      await navigator.clipboard.writeText(url)
      setSaveState('copied')
      setTimeout(() => setSaveState(s => (s === 'copied' ? 'idle' : s)), 3000)
    } catch { /* kein Zugriff → Mailfeld bleibt */ }
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault()
    setSaveMailError('')
    setSaveState('mailing')
    try {
      const res = await fetch('/api/event/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: event.slug, email: saveMail || email }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) { setSaveMailError(data.error ?? 'Das hat nicht geklappt.'); setSaveState('mailError'); return }
      setSaveState('mailed')
    } catch {
      setSaveMailError('Keine Verbindung. Bitte versuche es noch einmal.')
      setSaveState('mailError')
    }
  }

  const unit = interval === 'yearly' ? 'Jahr' : 'Monat'
  const copy = plan === event.recommendedPlan ? { title: event.planTitle, text: event.planText } : PLAN_COPY[plan]
  const parts = countdown.parts

  return (
    <>
      <p className="ev-kicker">{event.name}</p>

      {live ? (
        <>
          <div className="ev-cd" aria-live="off">
            <div><b>{parts ? parts.days : '–'}</b><span>Tage</span></div>
            <div><b>{parts ? pad(parts.hours) : '––'}</b><span>Std</span></div>
            <div><b>{parts ? pad(parts.minutes) : '––'}</b><span>Min</span></div>
            <div><b>{parts ? pad(parts.seconds) : '––'}</b><span>Sek</span></div>
          </div>
          <p className="ev-cd-label">So lange gilt dein {event.name}-Preis{campaign?.endsAt ? `, bis ${new Date(campaign.endsAt).toLocaleDateString('de-DE', { weekday: 'long', timeZone: 'Europe/Berlin' })} ${new Date(campaign.endsAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })} Uhr` : ''}</p>
        </>
      ) : (
        <div className="ev-ended">{event.endedText}</div>
      )}

      <h1 className="ev-h1">{event.headline.split('\n').map((line, i) => <span key={i}>{i > 0 && <br />}{line}</span>)}</h1>
      <p className="ev-sub">{event.subline}</p>

      {canceled && <div className="ev-ok">Die Bezahlung wurde abgebrochen. Nichts ist passiert, du kannst es jederzeit noch einmal versuchen.</div>}

      <div className="ev-seg" role="group" aria-label="Zahlweise">
        <button type="button" aria-pressed={interval === 'yearly'} onClick={() => setInterval('yearly')}>
          Jährlich{prices.saving > 0 && <em>spart {formatEur(prices.saving)} €</em>}
        </button>
        <button type="button" aria-pressed={interval === 'monthly'} onClick={() => setInterval('monthly')}>Monatlich</button>
      </div>

      <form onSubmit={submit}>
        <div className="ev-card">
          <p className="n">{PLANS[plan].name} · {PLAN_COPY[plan].title}</p>
          <div className="p">
            {prices.off && <span className="s">{formatEur(prices.base)} €</span>}
            <span className="b">{formatEur(prices.price)} €</span>
            <span className="u">/{unit}</span>
          </div>
          {interval === 'yearly'
            ? <p className="per">= {formatEur(prices.perMonth)} € im Monat{prices.off ? ` statt ${formatEur(prices.monthlyList)} €` : ''}</p>
            : <p className="per">Monatlich kündbar</p>}
          <p className="f">
            {prices.off && prices.duration && offer
              ? `${offer.percentOff ? `${offer.percentOff} %` : ''} ${event.name}-Rabatt ${prices.duration.text}, danach ${formatEur(prices.base)} €/${unit}. `
              : interval === 'yearly' ? `${formatEur(prices.base)} € pro Jahr, das sind 2 Monate geschenkt. ` : ''}
            Tarif jederzeit nach oben wechselbar.
          </p>
          <div className="sites"><b>{copy.title}</b><span>{copy.text}</span></div>
        </div>

        <label className="ev-field"><span>Dein Vorname</span>
          <input type="text" name="first_name" autoComplete="given-name" value={firstName} onChange={e => setFirstName(e.target.value)} required maxLength={60} placeholder="z. B. Sabine" />
        </label>
        <label className="ev-field"><span>Deine E-Mail-Adresse</span>
          <input type="email" name="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="name@beispiel.de" />
        </label>

        {error && (
          <div className="ev-err" role="alert">
            {error.text}{' '}
            {error.existing && <>Bitte <a href={`${APP_URL}/login`}>melde dich hier an</a>, dann gilt der {event.name}-Preis dort automatisch.</>}
          </div>
        )}

        <button type="submit" className="ev-btn" disabled={loading}>
          {loading ? 'Einen Moment …' : `${PLANS[plan].name} sichern · ${formatEur(prices.price)} €`}
        </button>
        <p className="ev-fine">Apple Pay, Karte oder SEPA-Lastschrift · Du bekommst sofort deinen Zugang</p>
      </form>

      <div className="ev-alt">
        {(['starter', 'pro', 'unlimited'] as PlanKey[]).filter(k => k !== plan).map(k => (
          <button key={k} type="button" onClick={() => setPlan(k)}>
            {k === event.recommendedPlan ? `Zurück zu ${PLANS[k].name}` : PLAN_COPY[k].alt} {altPrice(k)}
          </button>
        ))}
      </div>

      <section className="ev-save" aria-label="Für später speichern">
        <h2>Jetzt keine Zeit?</h2>
        <p>Speichere dir die Seite und entscheide in Ruhe{live ? ', solange der Countdown läuft' : ''}.</p>
        <button type="button" className="ev-btn ghost" onClick={saveForLater}>
          {saveState === 'copied' ? 'Link kopiert ✓' : 'Für später speichern'}
        </button>
        {saveState === 'mailed' ? (
          <div className="ev-ok">Die Mail mit deinem Link ist unterwegs. Schau auch im Spam-Ordner nach.</div>
        ) : (
          <form className="ev-save-row" onSubmit={sendLink} style={{ marginTop: 10 }}>
            <input type="email" inputMode="email" autoComplete="email" placeholder="Link an meine E-Mail" value={saveMail || email} onChange={e => setSaveMail(e.target.value)} required aria-label="E-Mail-Adresse für den Link" />
            <button type="submit" disabled={saveState === 'mailing'}>{saveState === 'mailing' ? '…' : 'Senden'}</button>
          </form>
        )}
        {saveMailError && <p className="ev-fine" style={{ color: '#8A2E1F', marginTop: 8 }}>{saveMailError}</p>}
      </section>

      {demoSites.length > 0 && (
        <section aria-label="Beispiele">
          <p className="ev-shots-h">So sehen fertige Seiten aus</p>
          <div className="ev-shots">
            {demoSites.map(s => (
              <a key={s.domain} className="ev-shot" href={`https://${s.domain}`} target="_blank" rel="noopener noreferrer">
                <span className="img" style={s.thumbUrl ? { backgroundImage: `url(${s.thumbUrl})` } : undefined} role="img" aria-label={`Vorschau ${s.label}`} />
                <span className="cap">{s.label}<small>{s.domain}</small></span>
              </a>
            ))}
          </div>
          <p className="ev-shots-label">Wischen für mehr · Antippen öffnet die echte Seite</p>
        </section>
      )}

      <p className="ev-fine" style={{ fontSize: 14 }}>
        Lieber erst in Ruhe ansehen? <a href="https://finestsites.io" style={{ color: 'var(--ink)', fontWeight: 600 }}>Zur Startseite</a>
        {live ? <><br />Der {event.name}-Preis gilt dort genauso, solange der Countdown läuft.</> : null}
      </p>
    </>
  )
}
