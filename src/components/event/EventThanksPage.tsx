import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'
import { getEventConfig } from '@/lib/event/config'
import { ensureEventSignupUser, eventPasswordPending, isEventSignupSession, sessionEmail } from '@/lib/event/signup'
import { EVENT_CSS } from './event-styles'
import EventPasswordForm from './EventPasswordForm'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io').replace(/\/$/, '')
const APP_STORE_URL = 'https://apps.apple.com/de/app/finestsites/id6825371773'

type State =
  | { kind: 'invalid' }
  | { kind: 'open' }          // Zahlung noch nicht abgeschlossen (z. B. SEPA in Bearbeitung ohne complete)
  | { kind: 'pending'; email: string; firstName: string }
  | { kind: 'done'; email: string; firstName: string }

/**
 * Danke-Seite nach dem Event-Kauf: Konto sicherstellen (falls der Webhook noch nicht war), Passwort
 * festlegen, dann in drei Schritten erklären, wie es weitergeht. Keine Mail nötig.
 */
export default async function EventThanksPage({ slug, sessionId }: { slug: string; sessionId: string }) {
  const event = getEventConfig(slug)
  if (!event) return null

  let state: State = { kind: 'invalid' }
  if (/^cs_(live|test)_[A-Za-z0-9]+$/.test(sessionId)) {
    try {
      const session: Stripe.Checkout.Session = await getStripe().checkout.sessions.retrieve(sessionId, { expand: ['subscription'] })
      if (isEventSignupSession(session)) {
        if (session.status !== 'complete' || !session.subscription || typeof session.subscription === 'string') {
          state = { kind: 'open' }
        } else {
          const result = await ensureEventSignupUser(session, session.subscription)
          const email = sessionEmail(session) ?? ''
          const firstName = session.metadata?.first_name ?? ''
          if (result) {
            const pending = await eventPasswordPending(result.userId, sessionId)
            state = pending ? { kind: 'pending', email, firstName } : { kind: 'done', email, firstName }
          }
        }
      }
    } catch (e) {
      console.error('[event/danke]', e instanceof Error ? e.message : e)
    }
  }

  const greeting = (name: string) => (name ? `Vielen Dank, ${name}.` : 'Vielen Dank.')

  return (
    <div className="ev">
      <style dangerouslySetInnerHTML={{ __html: EVENT_CSS }} />
      <header className="ev-head">
        <img src="/logos/logo-black.svg" alt="FinestSites" width={160} height={26} />
      </header>
      <div className="ev-rule" />
      <main className="ev-main">
        {state.kind === 'invalid' && (
          <>
            <h1 className="ev-h1">Diesen Link können wir nicht zuordnen.</h1>
            <p className="ev-sub">Wenn du gerade bezahlt hast, ist trotzdem alles in Ordnung: Dein Konto wird angelegt. Schreib uns kurz an <a href="mailto:info@finestsites.io" style={{ color: 'var(--ink)', fontWeight: 600 }}>info@finestsites.io</a>, dann helfen wir dir beim Zugang.</p>
            <a className="ev-btn" href={`${APP_URL}/login`} style={{ textAlign: 'center', textDecoration: 'none' }}>Zur Anmeldung</a>
          </>
        )}

        {state.kind === 'open' && (
          <>
            <h1 className="ev-h1">Deine Zahlung wird noch verarbeitet.</h1>
            <p className="ev-sub">Das dauert manchmal einen Moment. Lade diese Seite in einer Minute neu. Falls es nicht klappt, schreib uns an <a href="mailto:info@finestsites.io" style={{ color: 'var(--ink)', fontWeight: 600 }}>info@finestsites.io</a>.</p>
          </>
        )}

        {(state.kind === 'pending' || state.kind === 'done') && (
          <>
            <p className="ev-kicker">{event.name} · Angebot gesichert</p>
            <h1 className="ev-h1">{greeting(state.firstName)}<br />Dein Angebot ist gesichert.</h1>
            <p className="ev-sub">Die Bezahlung hat geklappt. Jetzt nur noch dein Passwort, dann kannst du dich jederzeit anmelden und deine Webseite in Ruhe einrichten.</p>

            <div className="ev-mailbox">
              <small>Dein Benutzername ist deine E-Mail-Adresse</small>
              <b>{state.email}</b>
            </div>

            <ol className="ev-steps">
              <li className={state.kind === 'done' ? 'done' : ''}>
                <b>Passwort festlegen</b>
                {state.kind === 'pending'
                  ? <span><EventPasswordForm sessionId={sessionId} email={state.email} /></span>
                  : <span>Dein Passwort ist schon festgelegt. Falls du es vergessen hast, nutze bei der Anmeldung „Passwort vergessen“.</span>}
              </li>
              <li>
                <b>Anmelden</b>
                <span>
                  Am Computer oder Handy im Browser unter <a href={`${APP_URL}/login`}>app.finestsites.io</a>.
                  Oder mit der FinestSites-App auf dem iPhone: <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">im App Store laden</a> und mit E-Mail und Passwort anmelden.
                </span>
              </li>
              <li>
                <b>Webseite einrichten</b>
                <span>Nach der Anmeldung wählst du eine Vorlage, trägst deine Daten ein und drückst auf „Veröffentlichen“. Das dauert etwa 15 Minuten, du kannst jederzeit unterbrechen und später weitermachen.</span>
              </li>
            </ol>

            {state.kind === 'done' && (
              <a className="ev-btn" href={`${APP_URL}/login`} style={{ textAlign: 'center', textDecoration: 'none', marginTop: 20 }}>Zur Anmeldung</a>
            )}

            <p className="ev-fine" style={{ marginTop: 24 }}>
              Deine Rechnung findest du nach der Anmeldung unter Einstellungen → Rechnungen.<br />
              Fragen? <a href="mailto:info@finestsites.io" style={{ color: 'var(--ink)', fontWeight: 600 }}>info@finestsites.io</a>
            </p>
          </>
        )}
      </main>
    </div>
  )
}
