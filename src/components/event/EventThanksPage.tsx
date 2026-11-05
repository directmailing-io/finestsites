import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'
import { PLANS, type PlanKey, type BillingInterval } from '@/lib/plans'
import { getEventConfig, type EventConfig } from '@/lib/event/config'
import { ensureEventSignupUser, eventPasswordPending, isEventSignupSession, sessionEmail } from '@/lib/event/signup'
import { EVENT_CSS } from './event-styles'
import { loadDemoSites, type DemoSite } from './demo-sites'
import EventPasswordForm from './EventPasswordForm'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io').replace(/\/$/, '')
const APP_STORE_URL = 'https://apps.apple.com/de/app/finestsites/id6825371773'

interface Purchase { email: string; firstName: string; plan: PlanKey; interval: BillingInterval; paidEur: number | null }

type State =
  | { kind: 'invalid' }
  | { kind: 'open' }          // Zahlung noch nicht abgeschlossen (z. B. SEPA in Bearbeitung ohne complete)
  | { kind: 'pending'; purchase: Purchase }
  | { kind: 'done'; purchase: Purchase }

function purchaseFromSession(session: Stripe.Checkout.Session): Purchase {
  const plan = (session.metadata?.plan ?? 'pro') as PlanKey
  const interval = (session.metadata?.interval ?? 'yearly') as BillingInterval
  return {
    email: sessionEmail(session) ?? '',
    firstName: session.metadata?.first_name ?? '',
    plan: PLANS[plan] ? plan : 'pro',
    interval: interval === 'monthly' ? 'monthly' : 'yearly',
    paidEur: typeof session.amount_total === 'number' ? session.amount_total / 100 : null,
  }
}

const eur = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Welche Vorlagen das gekaufte Paket umfasst, in Laiensprache (Preis gilt für alle Seiten zusammen) */
function packageLine(plan: PlanKey, event: EventConfig): string {
  const soon = event.templates.filter(t => t.soon).map(t => t.label)
  const list = soon.length > 1 ? `${soon.slice(0, -1).join(', ')} und ${soon[soon.length - 1]}` : soon[0]
  const soonText = soon.length ? ` Bald auch ${list}, und viele mehr.` : ' Weitere Vorlagen folgen.'
  if (plan === 'starter') return `Du wählst eine dieser Vorlagen. Weitere Seiten kannst du später jederzeit dazubuchen.${soonText}`
  if (plan === 'unlimited') return `Alle Vorlagen, und jede neue, die dazukommt.${soonText}`
  return `Du wählst 3 dieser Vorlagen, alle im Preis enthalten. Fertige Texte, fertiges Design, du trägst nur deine Daten ein.${soonText}`
}

/**
 * Danke-Seite nach dem Event-Kauf: Konto sicherstellen (falls der Webhook noch nicht war), Zugangsdaten
 * festlegen, dann der Weg in drei Schritten. Als Abschluss-Moment gestaltet: animierter Haken, das
 * gekaufte Paket mit den echten Vorlagen, der aktuelle Schritt im Fokus. Keine Mail nötig.
 */
export default async function EventThanksPage({ slug, sessionId, preview }: { slug: string; sessionId: string; preview?: boolean }) {
  const event = getEventConfig(slug)
  if (!event) return null

  let state: State = { kind: 'invalid' }
  // ?vorschau=1: zeigt die Seite mit Beispieldaten (Formular ohne Funktion). Keine echten Daten, darum ohne Login.
  const isPreview = !!preview
  if (isPreview) {
    state = { kind: 'pending', purchase: { email: 'sabine@beispiel.de', firstName: 'Sabine', plan: 'pro', interval: 'yearly', paidEur: 216 } }
  } else if (/^cs_(live|test)_[A-Za-z0-9]+$/.test(sessionId)) {
    try {
      const session: Stripe.Checkout.Session = await getStripe().checkout.sessions.retrieve(sessionId, { expand: ['subscription'] })
      if (isEventSignupSession(session)) {
        if (session.status !== 'complete' || !session.subscription || typeof session.subscription === 'string') {
          state = { kind: 'open' }
        } else {
          const result = await ensureEventSignupUser(session, session.subscription)
          if (result) {
            const purchase = purchaseFromSession(session)
            const pending = await eventPasswordPending(result.userId, sessionId)
            state = pending ? { kind: 'pending', purchase } : { kind: 'done', purchase }
          }
        }
      }
    } catch (e) {
      console.error('[event/danke]', e instanceof Error ? e.message : e)
    }
  }

  const demoSites = state.kind === 'pending' || state.kind === 'done' ? await loadDemoSites(event) : []

  return (
    <div className="ev ev-thanks">
      <style dangerouslySetInnerHTML={{ __html: EVENT_CSS }} />
      <div className="ev-top" aria-hidden />
      <header className="ev-head">
        <img src="/logos/logo-black.svg" alt="FinestSites" width={160} height={26} />
      </header>
      <main className="ev-main">
        {isPreview && <div className="ev-ok ev-in" style={{ textAlign: 'center' }}>Vorschau mit Beispieldaten. Das Formular ist hier ohne Funktion.</div>}

        {state.kind === 'invalid' && (
          <section className="ev-hero ev-in">
            <h1 className="ev-h1">Diesen Link können wir nicht zuordnen.</h1>
            <p className="ev-sub">Wenn du gerade bezahlt hast, ist trotzdem alles in Ordnung: Dein Konto wird angelegt. Schreib uns kurz an <a href="mailto:info@finestsites.io" className="ev-link">info@finestsites.io</a>, dann helfen wir dir beim Zugang.</p>
            <a className="ev-btn" href={`${APP_URL}/login`} style={{ textAlign: 'center', textDecoration: 'none' }}>Zur Anmeldung</a>
          </section>
        )}

        {state.kind === 'open' && (
          <section className="ev-hero ev-in">
            <h1 className="ev-h1">Deine Zahlung wird noch verarbeitet.</h1>
            <p className="ev-sub">Das dauert manchmal einen Moment. Lade diese Seite in einer Minute neu. Falls es nicht klappt, schreib uns an <a href="mailto:info@finestsites.io" className="ev-link">info@finestsites.io</a>.</p>
          </section>
        )}

        {(state.kind === 'pending' || state.kind === 'done') && (
          <ThanksBody event={event} state={state} sessionId={sessionId} demoSites={demoSites} />
        )}
      </main>
      <footer className="ev-foot">
        Fragen? <a href="mailto:info@finestsites.io">info@finestsites.io</a>
      </footer>
    </div>
  )
}

function ThanksBody({ event, state, sessionId, demoSites }: {
  event: EventConfig
  state: Extract<State, { kind: 'pending' | 'done' }>
  sessionId: string
  demoSites: DemoSite[]
}) {
  const { purchase } = state
  const done = state.kind === 'done'
  const plan = PLANS[purchase.plan]
  const greeting = purchase.firstName ? `Geschafft, ${purchase.firstName}.` : 'Geschafft.'

  return (
    <>
      <section className="ev-hero ev-in">
        <svg className="ev-check" viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="32" r="30" />
          <path d="M20 33l8 8 16-17" />
        </svg>
        <h1 className="ev-h1">{greeting}<br /><span className="c">Dein Angebot ist gesichert.</span></h1>
        <p className="ev-sub">
          {done
            ? 'Deine Zugangsdaten sind festgelegt. Melde dich an und richte deine Webseite in Ruhe ein.'
            : 'Die Bezahlung hat geklappt. Jetzt noch deine Zugangsdaten, dann kann es losgehen.'}
        </p>
      </section>

      <section className="ev-pack ev-in ev-d1" aria-label="Dein Paket">
        <div className="ev-pack-head">
          <div>
            <p className="k">Dein Paket</p>
            <b>{plan.name} · {plan.max_sites === 1 ? '1 Webseite' : plan.max_sites >= 99 ? 'Alle Webseiten' : `${plan.max_sites} Webseiten`}</b>
            <span>{purchase.interval === 'yearly' ? 'Jahresabo' : 'Monatsabo'}{purchase.paidEur !== null ? ` · heute bezahlt ${eur(purchase.paidEur)} €` : ''}</span>
          </div>
        </div>
        {demoSites.length > 0 && (
          <div className="ev-pack-sites">
            {demoSites.map(s => (
              <figure key={s.domain}>
                <span className="img" style={s.thumbUrl ? { backgroundImage: `url(${s.thumbUrl})` } : undefined} role="img" aria-label={`Vorschau ${s.label}`} />
                <figcaption>{s.label}</figcaption>
              </figure>
            ))}
          </div>
        )}
        <p className="ev-pack-text">{packageLine(purchase.plan, event)}</p>
      </section>

      <ol className="ev-journey ev-in ev-d2">
        <li className={done ? 'done' : 'active'}>
          <b>Zugangsdaten festlegen</b>
          {done ? (
            <span>Erledigt. Falls du dein Passwort vergisst, nutze bei der Anmeldung „Passwort vergessen“.</span>
          ) : (
            <>
              <span className="ev-login-as">Du meldest dich an mit <b>{purchase.email}</b></span>
              <EventPasswordForm sessionId={sessionId} email={purchase.email} firstName={purchase.firstName} />
            </>
          )}
        </li>
        <li className={done ? 'active' : 'next'}>
          <b>Anmelden</b>
          <span>
            Mit E-Mail-Adresse und Passwort im Browser unter <a href={`${APP_URL}/login`} className="ev-link">app.finestsites.io</a>, oder mit der FinestSites-App auf dem iPhone.
          </span>
          {done && (
            <a className="ev-btn" href={`${APP_URL}/login`} style={{ textAlign: 'center', textDecoration: 'none', marginTop: 14 }}>Jetzt anmelden</a>
          )}
          <a className="ev-store" href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path fill="currentColor" d="M16.7 12.6c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.8-1.7 0-3.2 1-4.1 2.5-1.8 3-.5 7.6 1.3 10.1.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.2-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.9-1.1-2.9-4.1zM14.2 5.2c.7-.8 1.2-2 1-3.2-1 0-2.3.7-3 1.5-.7.8-1.2 2-1.1 3.1 1.2.1 2.4-.6 3.1-1.4z" /></svg>
            Im App Store laden
          </a>
        </li>
        <li className="next">
          <b>Webseite einrichten</b>
          <span>Nach der Anmeldung wählst du eine Vorlage, trägst deine Daten ein und drückst auf „Veröffentlichen“. Etwa 15 Minuten, du kannst jederzeit unterbrechen und später weitermachen.</span>
        </li>
      </ol>

      <p className="ev-fine ev-in ev-d3" style={{ marginTop: 8 }}>
        Deine Rechnung findest du nach der Anmeldung unter Einstellungen → Rechnungen.
      </p>
    </>
  )
}
