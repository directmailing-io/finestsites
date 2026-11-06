import { refereeDisplayName } from '@/lib/affiliate/mask'

// ─── Shared styles ─────────────────────────────────────────────────────────────

const base = {
  bg: '#F4F4F5',
  card: '#FFFFFF',
  heading: '#111827',
  body: '#374151',
  muted: '#6B7280',
  border: '#E5E7EB',
  buttonBg: '#111827',
  buttonText: '#FFFFFF',
  footer: '#9CA3AF',
}

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io').replace(/\/$/, '')

function logoHeader(): string {
  // SVG wordmark — renders in Apple Mail, Gmail, and most modern clients.
  // Displayed above the card on the gray background, no wrapper/pill.
  return `<table cellpadding="0" cellspacing="0" role="presentation" width="100%">
              <tr>
                <td align="center" style="padding-bottom:24px;">
                  <img src="https://app.finestsites.io/logos/logo-black.svg" alt="FinestSites" height="28" style="height:28px;width:auto;display:block;" />
                </td>
              </tr>
            </table>`
}

/** Footer-Angaben für abbestellbare Kategorien (updates | tips | offers) */
export interface PrefsFooter { categoryLabel: string; unsubscribeUrl: string; settingsUrl: string }

function layout(content: string, prefs?: PrefsFooter): string {
  return layoutCards([content], prefs)
}

/** Wie layout(), aber jede Karte einzeln (klar getrennte Abschnitte, z. B. Produkt-Updates) */
function layoutCards(cards: string[], prefs?: PrefsFooter): string {
  const footer = prefs
    ? `<p style="margin:0 0 6px;font-size:12px;color:${base.footer};line-height:1.6;">
              Du bekommst diese Mail, weil du ein FinestSites-Konto hast und „${prefs.categoryLabel}“ erhalten möchtest.
            </p>
            <p style="margin:0;font-size:12px;color:${base.footer};line-height:1.6;">
              <a href="${prefs.unsubscribeUrl}" style="color:${base.footer};text-decoration:underline;">Diese Mails abbestellen</a>
              &nbsp;·&nbsp;
              <a href="${prefs.settingsUrl}" style="color:${base.footer};text-decoration:underline;">E-Mail-Einstellungen</a>
              &nbsp;·&nbsp;
              <a href="mailto:info@finestsites.io" style="color:${base.footer};text-decoration:underline;">Support</a>
            </p>`
    : `<p style="margin:0;font-size:12px;color:${base.footer};line-height:1.6;">
              © ${new Date().getFullYear()} FinestSites &nbsp;·&nbsp;
              <a href="mailto:info@finestsites.io" style="color:${base.footer};text-decoration:underline;">Support</a>
            </p>`
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>FinestSites</title>
</head>
<body style="margin:0;padding:0;background:${base.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${base.bg};padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;">

        <!-- Logo header -->
        <tr>
          <td>
            ${logoHeader()}
          </td>
        </tr>

        <!-- Cards -->
        ${cards.map((content, i) => `<tr>
          <td style="background:${base.card};border-radius:20px;padding:36px 36px 32px;border:1px solid ${base.border};${i > 0 ? 'border-top:0;' : ''}">
            ${content}
          </td>
        </tr>${i < cards.length - 1 ? '<tr><td style="height:14px;font-size:0;line-height:0;">&nbsp;</td></tr>' : ''}`).join('')}

        <!-- Footer -->
        <tr>
          <td style="padding:24px 0 0;text-align:center;">
            ${footer}
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function button(url: string, label: string, bg: string = base.buttonBg): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:32px 0 0;">
    <tr>
      <td style="background:${bg};border-radius:12px;">
        <a href="${url}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:${base.buttonText};text-decoration:none;border-radius:12px;">${label}</a>
      </td>
    </tr>
  </table>`
}

function fallbackLink(url: string): string {
  return `<p style="margin:24px 0 0;font-size:12px;color:${base.muted};word-break:break-all;">
    Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br />
    <a href="${url}" style="color:${base.muted};">${url}</a>
  </p>`
}

// ─── Templates ─────────────────────────────────────────────────────────────────

export function verificationEmail({ url }: { url: string }): string {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      E-Mail-Adresse bestätigen
    </h1>
    <p style="margin:0 0 0;font-size:15px;color:${base.body};line-height:1.65;">
      Willkommen bei FinestSites! Klicke auf den Button, um deine E-Mail-Adresse zu bestätigen und loszulegen.
    </p>
    ${button(url, 'E-Mail bestätigen')}
    <p style="margin:28px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Dieser Link ist 24 Stunden gültig. Falls du dich nicht registriert hast, kannst du diese E-Mail ignorieren.
    </p>
    ${fallbackLink(url)}
  `)
}

export function passwordResetEmail({ url }: { url: string }): string {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      Passwort zurücksetzen
    </h1>
    <p style="margin:0 0 0;font-size:15px;color:${base.body};line-height:1.65;">
      Du hast ein neues Passwort angefordert. Klicke auf den Button, um ein neues Passwort zu vergeben.
    </p>
    ${button(url, 'Neues Passwort festlegen')}
    <p style="margin:28px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Dieser Link ist 1 Stunde gültig. Falls du kein neues Passwort angefordert hast, kannst du diese E-Mail einfach ignorieren. Dein Passwort bleibt unverändert.
    </p>
    ${fallbackLink(url)}
  `)
}

/**
 * Newsletter-Rahmen. Bei abbestellbaren Kategorien (updates | tips | offers) kommt `prefs` mit:
 * der Footer sagt dann, warum der Nutzer die Mail bekommt, und verlinkt Abbestellen + Einstellungen.
 */
/**
 * Persönliche Mail im Look einer von Hand geschriebenen Mail: kein Logo, keine Karte, keine Buttons.
 * Bewusste Ausnahme von layout() – nur für Mails, die wie eine private Nachricht von Daniel wirken
 * sollen. Abbestellen-Link bleibt Pflicht (klein, grau, unten).
 * Body im einfachen Mail-Markup: Leerzeile = Absatz, [Text](URL) = Link.
 */
export function personalEmail({ body, prefs }: { body: string; prefs?: PrefsFooter }): string {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const paragraphs = body.split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin:0 0 14px;">${esc(p).replace(/\n/g, '<br>').replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')}</p>`,
  ).join('')
  const footer = prefs
    ? `<p style="margin:32px 0 0;font-size:11px;color:#9a9a9a;">Du bekommst diese Mail, weil du ein FinestSites-Konto hast. <a href="${prefs.unsubscribeUrl}" style="color:#9a9a9a;">Abbestellen</a></p>`
    : ''
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"></head><body style="margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222;">${paragraphs}${footer}</body></html>`
}

/** Textfassung zu personalEmail (Links als „Text (URL)“) */
export function personalEmailText({ body, prefs }: { body: string; prefs?: PrefsFooter }): string {
  const text = body.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, t: string, url: string) => (t === url ? url : `${t} (${url})`)).trim()
  return prefs ? `${text}\n\n--\nDu bekommst diese Mail, weil du ein FinestSites-Konto hast. Abbestellen: ${prefs.unsubscribeUrl}` : text
}

export function newsletterEmail({
  subject,
  bodyHtml,
  unsubscribeUrl,
  prefs,
}: {
  subject: string
  bodyHtml: string
  /** @deprecated nur noch für alte Aufrufer; neue Aufrufer geben `prefs` */
  unsubscribeUrl?: string
  prefs?: { categoryLabel: string; unsubscribeUrl: string; settingsUrl: string }
}): string {
  const footer = prefs
    ? `<tr><td style="padding:24px 0 0;text-align:center;">
        <p style="margin:0 0 6px;font-size:12px;color:${base.footer};line-height:1.6;">
          Du bekommst diese Mail, weil du ein FinestSites-Konto hast und „${prefs.categoryLabel}“ erhalten möchtest.
        </p>
        <p style="margin:0;font-size:12px;color:${base.footer};line-height:1.6;">
          <a href="${prefs.unsubscribeUrl}" style="color:${base.footer};text-decoration:underline;">Diese Mails abbestellen</a>
          &nbsp;·&nbsp;
          <a href="${prefs.settingsUrl}" style="color:${base.footer};text-decoration:underline;">E-Mail-Einstellungen</a>
          &nbsp;·&nbsp;
          <a href="mailto:info@finestsites.io" style="color:${base.footer};text-decoration:underline;">Support</a>
        </p>
      </td></tr>`
    : unsubscribeUrl
    ? `<tr><td style="padding:24px 0 0;text-align:center;">
        <p style="margin:0;font-size:12px;color:${base.footer};line-height:1.6;">
          © ${new Date().getFullYear()} FinestSites &nbsp;·&nbsp;
          <a href="${unsubscribeUrl}" style="color:${base.footer};text-decoration:underline;">Abmelden</a>
          &nbsp;·&nbsp;
          <a href="mailto:info@finestsites.io" style="color:${base.footer};text-decoration:underline;">Support</a>
        </p>
      </td></tr>`
    : `<tr><td style="padding:24px 0 0;text-align:center;">
        <p style="margin:0;font-size:12px;color:${base.footer};line-height:1.6;">
          © ${new Date().getFullYear()} FinestSites &nbsp;·&nbsp;
          <a href="mailto:info@finestsites.io" style="color:${base.footer};text-decoration:underline;">Support</a>
        </p>
      </td></tr>`

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:${base.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${base.bg};padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:580px;width:100%;">
        <tr>
          <td>
            ${logoHeader()}
          </td>
        </tr>
        <tr>
          <td style="background:${base.card};border-radius:20px;padding:40px;border:1px solid ${base.border};">
            ${bodyHtml}
          </td>
        </tr>
        ${footer}
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function domainActiveEmail({ domain, siteUrl }: { domain: string; siteUrl?: string }): string {
  const url = siteUrl ?? `https://${domain}`
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      Deine Domain ist live! 🎉
    </h1>
    <p style="margin:0;font-size:15px;color:${base.body};line-height:1.65;">
      <strong>${domain}</strong> ist jetzt mit deiner Website verbunden und vollständig eingerichtet. Das SSL-Zertifikat ist aktiv und deine Seite ist über HTTPS erreichbar.
    </p>
    ${button(url, 'Website aufrufen')}
    <p style="margin:28px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Falls du Fragen hast oder etwas nicht funktioniert, melde dich gerne bei unserem Support.
    </p>
  `)
}

export function trackingFirstLeadEmail({ firstName }: { firstName: string }): string {
  const hi = firstName ? `Hallo ${firstName}` : 'Hallo'
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      Dein Tracking funktioniert ✅
    </h1>
    <p style="margin:0;font-size:15px;color:${base.body};line-height:1.65;">
      ${hi}, gerade ist die erste echte Beratungsanfrage über deine Webseite als <strong>Lead</strong> an Meta übertragen worden. Ab jetzt sieht Meta, welche Anzeige Anfragen bringt, und kann deine Kampagnen darauf optimieren.
    </p>
    <p style="margin:16px 0 0;font-size:15px;color:${base.body};line-height:1.65;">
      Unter <strong>Einstellungen → Werbung</strong> siehst du jederzeit, wie viele Anfragen und Kontakte aus welcher Kampagne kommen.
    </p>
    ${button('https://app.finestsites.io/settings?tab=werbung', 'Auswertung ansehen')}
  `)
}

export function subscriptionConfirmationEmail({
  plan,
  interval,
}: {
  plan: string
  interval: 'monthly' | 'yearly'
}): string {
  const planLabel: Record<string, string> = { starter: 'Starter', pro: 'Pro', unlimited: 'Unlimited' }
  const intervalLabel = interval === 'yearly' ? 'jährlich' : 'monatlich'
  const dashboardUrl = `${APP_URL}/sites`

  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      Danke für dein Vertrauen! 🎉
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:${base.body};line-height:1.65;">
      Deine Buchung war erfolgreich. Du hast jetzt Zugang zum <strong>${planLabel[plan] ?? plan}-Plan</strong> (${intervalLabel}) und kannst sofort loslegen.
    </p>
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin:0 0 24px;">
      <tr>
        <td style="background:#F9FAFB;border-radius:12px;padding:16px 20px;border:1px solid ${base.border};">
          <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${base.muted};text-transform:uppercase;letter-spacing:0.06em;">Gebuchter Plan</p>
          <p style="margin:0;font-size:16px;font-weight:700;color:${base.heading};">${planLabel[plan] ?? plan} &nbsp;·&nbsp; <span style="font-weight:400;color:${base.muted};">${intervalLabel}</span></p>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 0;font-size:14px;color:${base.muted};line-height:1.65;">
      Du kannst dein Abo jederzeit in den Einstellungen verwalten oder kündigen.
    </p>
    ${button(dashboardUrl, 'Zu meiner Webseite')}
    <p style="margin:28px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Bei Fragen erreichst du uns jederzeit unter <a href="mailto:info@finestsites.io" style="color:${base.muted};">info@finestsites.io</a>.
    </p>
  `)
}

export function affiliateNewReferralEmail({
  refereeEmail,
  refereeFirstName,
  planLabel,
}: {
  /** wird NIE im Klartext gezeigt – nur maskiert, falls kein Vorname da ist */
  refereeEmail: string
  refereeFirstName?: string | null
  planLabel: string
}): string {
  const affiliateUrl = `${APP_URL}/affiliate`
  const referee = escapeHtml(refereeDisplayName(refereeFirstName, refereeEmail))
  planLabel = escapeHtml(planLabel)
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      Neuer Partner registriert
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:${base.body};line-height:1.65;">
      Jemand hat sich über deinen Empfehlungslink bei FinestSites registriert und ein Abo gebucht. Du erhältst dafür eine Provision.
    </p>
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin:0 0 24px;">
      <tr>
        <td style="background:#F9FAFB;border-radius:12px;padding:16px 20px;border:1px solid ${base.border};">
          <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${base.muted};text-transform:uppercase;letter-spacing:0.06em;">Neuer Partner</p>
          <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:${base.heading};">${referee}</p>
          <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${base.muted};text-transform:uppercase;letter-spacing:0.06em;">Gebuchter Plan</p>
          <p style="margin:0;font-size:15px;font-weight:600;color:${base.heading};">${planLabel}</p>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:14px;color:${base.muted};line-height:1.65;">
      Deine Provision wird nach der 14-tägigen Wartefrist (Rückbuchungsschutz) automatisch freigegeben und monatlich ausgezahlt.
    </p>
    ${button(affiliateUrl, 'Zur Partnerplattform')}
  `)
}

export function affiliateAdminAssignEmail({
  refereeEmail,
  refereeFirstName,
  planLabel,
  firstName,
}: {
  /** wird NIE im Klartext gezeigt – nur maskiert, falls kein Vorname da ist */
  refereeEmail: string
  refereeFirstName?: string | null
  planLabel: string
  firstName?: string | null
}): string {
  const greeting = firstName?.trim() ? `Hey ${escapeHtml(firstName.trim())},` : 'Hey,'
  const referee = escapeHtml(refereeDisplayName(refereeFirstName, refereeEmail))
  planLabel = escapeHtml(planLabel)
  const affiliateUrl = `${APP_URL}/affiliate`
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      Neuer Partner zugeordnet
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:${base.body};line-height:1.65;">
      ${greeting} ein bestehender FinestSites-Nutzer wurde dir als Partner zugeordnet. Du erhältst ab sofort Provision auf alle zukünftigen Zahlungen dieses Nutzers.
    </p>
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin:0 0 24px;">
      <tr>
        <td style="background:#F9FAFB;border-radius:12px;padding:16px 20px;border:1px solid ${base.border};">
          <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${base.muted};text-transform:uppercase;letter-spacing:0.06em;">Zugeordneter Nutzer</p>
          <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:${base.heading};">${referee}</p>
          <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${base.muted};text-transform:uppercase;letter-spacing:0.06em;">Aktueller Plan</p>
          <p style="margin:0;font-size:15px;font-weight:600;color:${base.heading};">${planLabel}</p>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:14px;color:${base.muted};line-height:1.65;">
      Provision wird nach der 14-tägigen Wartefrist freigegeben und monatlich ausgezahlt. Bereits geleistete Zahlungen vor dieser Zuordnung sind nicht enthalten.
    </p>
    ${button(affiliateUrl, 'Zur Partnerplattform')}
  `)
}

export function affiliatePayoutEmail({
  amountCents,
  commissionCount,
  method = 'transfer',
}: {
  amountCents: number
  commissionCount: number
  /** 'credit' = mit dem eigenen Abo verrechnet (Kundenguthaben) */
  method?: 'transfer' | 'credit'
}): string {
  const amount = (amountCents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
  const affiliateUrl = `${APP_URL}/affiliate`
  const credit = method === 'credit'
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      ${credit ? 'Deine Provision wurde verrechnet' : 'Deine Provision wurde ausgezahlt'}
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:${base.body};line-height:1.65;">
      ${credit
        ? 'Wir haben deine Provision deinem FinestSites-Konto gutgeschrieben.'
        : 'Wir haben soeben eine Auszahlung an dein verknüpftes Konto vorgenommen.'}
    </p>
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin:0 0 24px;">
      <tr>
        <td style="background:#F0FDF4;border-radius:12px;padding:20px 24px;border:1px solid #BBF7D0;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#15803D;text-transform:uppercase;letter-spacing:0.06em;">${credit ? 'Gutgeschriebener Betrag' : 'Ausgezahlter Betrag'}</p>
          <p style="margin:0;font-size:28px;font-weight:800;color:#15803D;letter-spacing:-0.02em;">${amount}</p>
          <p style="margin:8px 0 0;font-size:13px;color:#16A34A;">${commissionCount} Provision${commissionCount !== 1 ? 'en' : ''}</p>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:14px;color:${base.muted};line-height:1.65;">
      ${credit
        ? 'Der Betrag wird automatisch von deinen nächsten FinestSites-Rechnungen abgezogen. Du musst nichts tun. Die Gutschrift findest du in deinem Partnerbereich.'
        : 'Der Betrag wird in Kürze auf deinem verknüpften Bankkonto gutgeschrieben. Die genaue Dauer hängt von deiner Bank ab.'}
    </p>
    ${button(affiliateUrl, 'Zur Partnerplattform')}
    <p style="margin:28px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Bei Fragen erreichst du uns unter <a href="mailto:info@finestsites.io" style="color:${base.muted};">info@finestsites.io</a>.
    </p>
  `)
}

// ─── Billing lifecycle emails ──────────────────────────────────────────────────

type RecoveryMailParams = {
  /** Stripe hosted invoice page — pays by card in seconds, or by SEPA */
  payUrl: string | null
  /** Date until which the sites stay online (formatted dd.mm.yyyy) */
  graceUntil: string
  amount: string
}

function payButtons(payUrl: string | null): string {
  const portalUrl = `${APP_URL}/api/billing/portal`
  return `
    ${button(payUrl ?? portalUrl, 'Jetzt bezahlen')}
    <p style="margin:16px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Oder <a href="${portalUrl}" style="color:${base.body};">Zahlungsmethode ändern</a>, zum Beispiel eine Karte hinterlegen. Dann holen wir die Zahlung automatisch darüber nach.
    </p>`
}

/** Day 0 of an arrears episode — the sites are still online. */
export function paymentFailedEmail({ payUrl, graceUntil, amount }: RecoveryMailParams): string {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.02em;">
      Deine Zahlung hat nicht geklappt
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Wir konnten ${amount} nicht einziehen. Das passiert, kein Stress. Deine Seite bleibt erst einmal online.
    </p>
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin:0 0 24px;">
      <tr>
        <td style="background:#FFF7ED;border-radius:12px;padding:16px 20px;border:1px solid #FED7AA;">
          <p style="margin:0;font-size:14px;color:#9A3412;line-height:1.6;">
            <strong>Bis ${graceUntil} hast du Zeit.</strong> Danach geht deine Seite offline, bis die Zahlung da ist.
          </p>
        </td>
      </tr>
    </table>
    ${payButtons(payUrl)}
    <p style="margin:28px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      <strong style="color:${base.body};">Gut zu wissen:</strong> Mit Karte ist die Zahlung sofort bestätigt. Per SEPA dauert die Bestätigung ein bis zwei Wochen. Solange sie läuft, bleibt deine Seite online.
    </p>
    <p style="margin:12px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Fragen? <a href="mailto:info@finestsites.io" style="color:${base.muted};">info@finestsites.io</a>
    </p>
  `)
}

/** Day 3 — reminder while the sites are still online. */
export function paymentReminderEmail({ payUrl, graceUntil, amount, daysLeft }: RecoveryMailParams & { daysLeft: number }): string {
  const days = daysLeft === 1 ? 'einem Tag' : `${daysLeft} Tagen`
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.02em;">
      Noch ${days}, dann geht deine Seite offline
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Die offene Zahlung über ${amount} ist noch nicht bei uns angekommen. Am ${graceUntil} nehmen wir deine Seite vom Netz, bis sie bezahlt ist.
    </p>
    <p style="margin:0 0 8px;font-size:15px;color:${base.body};line-height:1.65;">
      Ein Klick reicht. Mit Karte ist alles sofort erledigt.
    </p>
    ${payButtons(payUrl)}
    <p style="margin:28px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Schon bezahlt? Dann ignorier diese Mail. Bei SEPA dauert die Bestätigung ein paar Tage, deine Seite bleibt so lange online. Fragen? <a href="mailto:info@finestsites.io" style="color:${base.muted};">info@finestsites.io</a>
    </p>
  `)
}

/** Grace over (or the second attempt failed) — the sites are offline now. */
export function sitesOfflineEmail({ payUrl, amount, deadline }: { payUrl: string | null; amount: string; deadline: string }): string {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.02em;">
      Deine Seite ist jetzt offline
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Die Zahlung über ${amount} ist leider immer noch offen. Deshalb können deine Besucher deine Seite im Moment nicht aufrufen.
    </p>
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin:0 0 24px;">
      <tr>
        <td style="background:#FEF2F2;border-radius:12px;padding:16px 20px;border:1px solid #FECACA;">
          <p style="margin:0;font-size:14px;color:#7F1D1D;line-height:1.6;">
            <strong>Sobald die Zahlung da ist, geht deine Seite automatisch wieder online.</strong> Alle Inhalte sind noch da, du musst nichts neu aufbauen.
          </p>
        </td>
      </tr>
    </table>
    ${payButtons(payUrl)}
    <p style="margin:28px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Bleibt die Zahlung bis zum ${deadline} aus, pausieren wir dein Konto und beenden das Abo. Deine Daten bleiben danach noch 90 Tage gespeichert. Fragen? <a href="mailto:info@finestsites.io" style="color:${base.muted};">info@finestsites.io</a>
    </p>
  `)
}

/** The default method failed, we charged the backup card instead. */
export function paymentFallbackUsedEmail({ amount, methodLabel, pending }: { amount: string; methodLabel: string; pending: boolean }): string {
  const settingsUrl = `${APP_URL}/settings`
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.02em;">
      ${pending ? 'Wir versuchen es über deine zweite Zahlungsmethode' : 'Wir haben deine Karte verwendet'}
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Der Einzug über deine Standard-Zahlungsmethode hat nicht geklappt. ${pending
        ? `Deshalb haben wir ${amount} über <strong>${methodLabel}</strong> angestoßen. Die Bestätigung dauert ein bis zwei Wochen, deine Seite bleibt so lange online.`
        : `Deshalb haben wir ${amount} über <strong>${methodLabel}</strong> abgebucht. Deine Seite war keine Sekunde offline.`}
    </p>
    <p style="margin:0 0 8px;font-size:15px;color:${base.body};line-height:1.65;">
      Soll diese Zahlungsmethode künftig der Standard sein? Das stellst du in den Einstellungen um.
    </p>
    ${button(settingsUrl, 'Zahlungsmethoden ansehen')}
    <p style="margin:28px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Fragen? <a href="mailto:info@finestsites.io" style="color:${base.muted};">info@finestsites.io</a>
    </p>
  `)
}

/** 7 days before a SEPA renewal — so the account is covered on the day. */
/** Nur bei Jahresabo-Verlängerung oder höherem Betrag (src/lib/billing/upcoming-notice.ts) – nüchtern, kein Rabatt-/Kündigungshinweis */
export function upcomingDebitEmail({ amount, date, method, isSepa }: { amount: string; date: string; method: string | null; isSepa: boolean }): string {
  const settingsUrl = `${APP_URL}/settings`
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.02em;">
      Am ${date} buchen wir ${amount} ab
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Dein FinestSites-Abo verlängert sich am ${date}. Wir buchen ${amount}${method ? ` über ${method}` : ''} ab.
    </p>
    ${isSepa ? `<p style="margin:0 0 8px;font-size:15px;color:${base.body};line-height:1.65;">
      Bitte sorg dafür, dass das Konto an dem Tag gedeckt ist. Eine geplatzte Lastschrift kostet dich bei deiner Bank Gebühren.
    </p>` : ''}
    <p style="margin:0 0 8px;font-size:15px;color:${base.body};line-height:1.65;">Du musst nichts tun.</p>
    ${button(settingsUrl, 'Abo ansehen')}
    <p style="margin:28px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Fragen? <a href="mailto:info@finestsites.io" style="color:${base.muted};">info@finestsites.io</a>
    </p>
  `)
}

/** Day 21 of an arrears episode: account paused, Stripe subscription cancelled */
export function accountDeactivatedEmail(): string {
  const billingUrl = `${APP_URL}/billing`
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.02em;">
      Dein Konto wurde pausiert
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Die offene Zahlung ist leider nicht eingegangen, deshalb sind deine Webseiten jetzt offline. Deine Besucher sehen im Moment eine Fehlerseite.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:${base.body};line-height:1.65;">
      Das Gute: Alle deine Inhalte, Texte und Bilder sind noch da. Buch einfach wieder einen Tarif, dann sind deine Seiten sofort wieder online. Du musst nichts neu aufbauen.
    </p>
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin:0 0 28px;">
      <tr>
        <td style="background:#FEF2F2;border-radius:12px;padding:16px 20px;border:1px solid #FECACA;">
          <p style="margin:0;font-size:13px;color:#7F1D1D;line-height:1.6;">
            Deine Daten werden in <strong>90 Tagen</strong> endgültig gelöscht. Danach gibt es kein Zurück mehr.
          </p>
        </td>
      </tr>
    </table>
    ${button(billingUrl, 'Jetzt reaktivieren')}
    <p style="margin:28px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Hast du ein Problem mit der Zahlung? Schreib uns einfach direkt: <a href="mailto:info@finestsites.io" style="color:${base.muted};">info@finestsites.io</a>. Wir finden eine Lösung.
    </p>
  `)
}

/** Sent when a voluntarily canceled subscription period ends (sites go offline) */
export function accountExpiredEmail({ deleteDate }: { deleteDate?: string | null } = {}): string {
  const billingUrl = `${APP_URL}/billing`
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.02em;">
      Dein Abo ist ausgelaufen
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Deine Abonnementlaufzeit ist jetzt abgelaufen. Deine Premium-Webseiten sind offline, deine kostenlose Linkseite bleibt online. Alle deine Inhalte sind noch <strong>90 Tage</strong> bei uns gespeichert${deleteDate ? ` (bis zum <strong>${deleteDate}</strong>)` : ''}.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:${base.body};line-height:1.65;">
      Falls du es dir anders überlegst: Ein Klick und alles ist sofort wieder da. Kein Neuanfang, keine Datenverluste.
    </p>
    ${button(billingUrl, 'Jetzt wieder loslegen')}
    <p style="margin:28px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      War etwas nicht in Ordnung? Wir sind ehrlich interessiert, was wir besser machen können: <a href="mailto:info@finestsites.io" style="color:${base.muted};">info@finestsites.io</a>
    </p>
  `)
}

/** Sent when user schedules cancellation (cancel_at_period_end = true), sites still running */
export function accountCanceledEmail({ periodEnd, pauseAvailable = true }: { periodEnd: string; pauseAvailable?: boolean }): string {
  const billingUrl = `${APP_URL}/settings?tab=zahlung`
  const pauseUrl = `${APP_URL}/settings?tab=zahlung&pause=1`
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.02em;">
      Dein Abo wurde gekündigt
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Du hast dein FinestSites-Abo gekündigt. Bis zum <strong>${periodEnd}</strong> läuft aber alles ganz normal weiter. Deine Seiten sind online und du hast vollen Zugriff.
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Danach gehen deine Premium-Webseiten offline. Deine kostenlose Linkseite bleibt online, und deine Inhalte bleiben noch 90 Tage gespeichert, falls du es dir doch anders überlegst.
    </p>
    ${pauseAvailable ? `<p style="margin:0 0 24px;font-size:15px;color:${base.body};line-height:1.65;">
      Du brauchst nur eine Auszeit? Dann <a href="${pauseUrl}" style="color:#111827;font-weight:600;">pausiere dein Abo</a> für 1 bis 3 Monate statt zu kündigen. Du zahlst in der Zeit nichts, und danach geht es automatisch weiter.
    </p>` : ''}
    ${button(billingUrl, 'Abo weiterlaufen lassen')}
    <p style="margin:24px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Übrigens: Für jede Empfehlung bekommst du dauerhaft 10 % der Rechnung des Geworbenen als Guthaben auf dein Abo. Ein Pro-Kunde sind rund 2,30 € im Monat.
    </p>
    <p style="margin:12px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Schade, dass du gehst. Falls du Feedback hast oder wir etwas besser machen können: <a href="mailto:info@finestsites.io" style="color:${base.muted};">info@finestsites.io</a>
    </p>
  `)
}

// ─── Kündigungsprozess (03.11.2026, docs/kuendigung/konzept.html) ─────────────
// Alles Systemmails (Vertragsinformation, nicht abbestellbar). Keine Mail an Daniel (Admin sieht es im Dashboard),
// keine „Rabatt endet“-Erinnerung (Daniels Entscheidung).

function euro(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

/** 3 Tage vor dem Laufzeitende nach einer Kündigung – die einzige Erinnerung, nur an Gekündigte. */
export function cancelEndingSoonEmail({ periodEnd, pauseAvailable }: { periodEnd: string; pauseAvailable: boolean }): string {
  const billingUrl = `${APP_URL}/settings?tab=zahlung`
  const pauseUrl = `${APP_URL}/settings?tab=zahlung&pause=1`
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      In 3 Tagen gehen deine Seiten offline
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Am <strong>${periodEnd}</strong> endet dein gekündigtes FinestSites-Abo. Ab dann sind deine Premium-Webseiten nicht mehr erreichbar. Deine kostenlose Linkseite bleibt online, deine Inhalte bleiben 90 Tage gespeichert.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:${base.body};line-height:1.65;">
      Wenn du es dir anders überlegt hast: Ein Klick, und alles läuft weiter wie bisher. Nichts muss neu eingerichtet werden.
    </p>
    ${button(billingUrl, 'Abo weiterlaufen lassen')}
    ${pauseAvailable ? `<p style="margin:20px 0 0;font-size:14px;color:${base.body};line-height:1.6;">
      Oder <a href="${pauseUrl}" style="color:#111827;font-weight:600;">stattdessen pausieren</a>: 1 bis 3 Monate nichts zahlen, danach geht es automatisch weiter.
    </p>` : ''}
    <p style="margin:24px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Wenn du bei der Kündigung bleibst, musst du nichts tun. Diese Mail kommt nur einmal.
    </p>
  `)
}

/** 14 Tage vor der endgültigen Löschung (90 Tage nach dem Abo-Ende) – eine Pflichtinformation, kein Angebot. */
export function deletionWarningEmail({ deleteDate }: { deleteDate: string }): string {
  const billingUrl = `${APP_URL}/settings?tab=zahlung`
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      Deine Inhalte werden am ${deleteDate} gelöscht
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Dein FinestSites-Abo ist seit gut 2 Monaten beendet. Deine Webseiten mit allen Texten, Bildern und Einstellungen sind noch gespeichert, werden aber am <strong>${deleteDate}</strong> endgültig gelöscht.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:${base.body};line-height:1.65;">
      Falls du zurückkommen möchtest: Buch einfach wieder einen Tarif, dann ist alles sofort wieder online, genau so, wie du es verlassen hast.
    </p>
    ${button(billingUrl, 'Jetzt wieder loslegen')}
    <p style="margin:24px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Wenn du nichts tust, löschen wir deine Inhalte wie angekündigt. Dein Konto und deine kostenlose Linkseite bleiben bestehen.
    </p>
  `)
}

/** Pause eingeplant: von wann bis wann, was offline geht, Preis danach, wie man sie beendet. */
export function pauseScheduledEmail({ from, until, months, planName, price, unit }: {
  from: string; until: string; months: number; planName: string; price: number; unit: 'Monat' | 'Jahr'
}): string {
  const settingsUrl = `${APP_URL}/settings?tab=zahlung`
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      Deine Pause ist eingeplant
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Vom <strong>${from}</strong> bis zum <strong>${until}</strong> macht dein FinestSites-Abo Pause (${months === 1 ? '1 Monat' : `${months} Monate`}). Bis zum ${from} bleibt alles wie bisher.
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      In der Pause zahlst du nichts. Deine Premium-Webseiten sind in der Zeit offline, deine kostenlose Linkseite bleibt online. Alle Inhalte, Einstellungen und deine Domain bleiben genau so gespeichert. Bearbeiten kannst du weiterhin.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:${base.body};line-height:1.65;">
      Ab dem <strong>${until}</strong> geht es automatisch weiter mit <strong>${planName}</strong> für <strong>${euro(price)} pro ${unit}</strong>. Eine Woche vorher erinnern wir dich.
    </p>
    ${button(settingsUrl, 'Zu den Einstellungen')}
    <p style="margin:24px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Du kannst die Pause in den Einstellungen jederzeit beenden oder, falls du dich anders entscheidest, dein Abo auch während der Pause kündigen.
    </p>
  `)
}

/** 7 Tage vor dem Pausenende: Datum, Preis, Zahlungsmethode – niemand wird überrascht abgebucht. */
export function pauseEndingSoonEmail({ until, planName, price, unit, paymentMethod }: {
  until: string; planName: string; price: number; unit: 'Monat' | 'Jahr'; paymentMethod: string | null
}): string {
  const settingsUrl = `${APP_URL}/settings?tab=zahlung`
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      Deine Pause endet in 7 Tagen
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Am <strong>${until}</strong> geht es mit deiner FinestSites-Seite weiter. Deine Premium-Webseiten gehen automatisch wieder online, und wir buchen wie vorher <strong>${euro(price)} pro ${unit}</strong> für ${planName}${paymentMethod ? ` über ${paymentMethod}` : ''} ab.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:${base.body};line-height:1.65;">
      Du musst nichts tun. Falls du noch nicht so weit bist, kannst du in den Einstellungen die Pause beenden, verlängern oder dein Abo kündigen.
    </p>
    ${button(settingsUrl, 'Zu den Einstellungen')}
  `)
}

/** Pause vorbei: alles wieder online. */
export function pauseResumedEmail({ nextBilling }: { nextBilling: string | null }): string {
  const dashboardUrl = `${APP_URL}/sites`
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#15803D;letter-spacing:-0.02em;">
      Willkommen zurück, alles ist wieder online!
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Deine Pause ist vorbei. Deine Webseiten sind ab sofort wieder erreichbar, genau so, wie du sie verlassen hast.${nextBilling ? ` Die nächste Abrechnung kommt am <strong>${nextBilling}</strong>.` : ''}
    </p>
    ${button(dashboardUrl, 'Zu meinen Webseiten')}
  `)
}

/** Treue-Rabatt angenommen: sofort oder vorgemerkt ab dem Ende des laufenden Rabatts. */
export function retentionDiscountEmail({ priceAfter, unit, startsAfter }: { priceAfter: number; unit: 'Monat' | 'Jahr'; startsAfter: string | null }): string {
  const settingsUrl = `${APP_URL}/settings?tab=zahlung`
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      ${startsAfter ? 'Dein Treue-Rabatt ist vorgemerkt' : 'Dein Treue-Rabatt ist aktiv'}
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Schön, dass du bleibst! ${startsAfter
        ? `Dein aktueller Rabatt läuft noch bis zum <strong>${startsAfter}</strong>. Direkt danach gelten dauerhaft 10 % Treue-Rabatt: Du zahlst dann <strong>${euro(priceAfter)} pro ${unit}</strong>, ohne Ende, ohne Bedingungen.`
        : `Ab deiner nächsten Rechnung zahlst du dauerhaft <strong>${euro(priceAfter)} pro ${unit}</strong>, 10 % weniger, ohne Ende, ohne Bedingungen.`}
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:${base.body};line-height:1.65;">
      An deinem Abo ändert sich sonst nichts. Du kannst weiterhin jederzeit kündigen.
    </p>
    ${button(settingsUrl, 'Zu den Einstellungen')}
  `)
}

/** Jahresabo: bestellte Erinnerung 14 Tage vor der Verlängerung, mit Ein-Klick-Kündigung (Variante E). */
export function renewalReminderEmail({ date, amount, planName, paymentMethod, cancelUrl }: {
  date: string; amount: number; planName: string; paymentMethod: string | null; cancelUrl: string
}): string {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      Deine Verlängerung am ${date}
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Wie versprochen die Erinnerung: Am <strong>${date}</strong> verlängert sich dein Jahresabo <strong>${planName}</strong> für <strong>${euro(amount)}</strong>${paymentMethod ? ` über ${paymentMethod}` : ''}. Deine Seiten bleiben online, du musst nichts tun.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:${base.body};line-height:1.65;">
      Falls du nicht weitermachen möchtest, kündigst du hier mit einem Klick zum ${date}. Bis dahin bleibt alles online.
    </p>
    ${button(cancelUrl, `Zum ${date} kündigen`)}
    <p style="margin:24px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Der Link gilt nur für dein Konto und nur bis zur Verlängerung. Wenn du weitermachen willst, ignoriere diese Mail einfach.
    </p>
  `)
}

/** Tarifwechsel nach unten eingeplant: bis zum Datum bleibt alles, danach kleinerer Tarif (plan-change.ts). */
export function planChangeScheduledEmail({ plan, interval, date, offlineSites }: {
  plan: 'starter' | 'pro' | 'unlimited'; interval: 'monthly' | 'yearly'; date: string; offlineSites: string[]
}): string {
  const planLabel: Record<string, string> = { starter: 'Starter', pro: 'Pro', unlimited: 'Unlimited' }
  const settingsUrl = `${APP_URL}/settings?tab=zahlung`
  const offline = offlineSites.length
    ? `<p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
        Ab dann ${offlineSites.length === 1 ? 'geht diese Webseite offline' : 'gehen diese Webseiten offline'}, bleibt aber als Entwurf gespeichert: <strong>${offlineSites.map(escapeHtml).join('</strong>, <strong>')}</strong>. Du kannst ${offlineSites.length === 1 ? 'sie' : 'sie'} jederzeit wieder veröffentlichen, sobald dein Tarif es erlaubt.
      </p>`
    : ''
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      Dein Wechsel zu ${planLabel[plan] ?? plan} ist eingeplant
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Bis zum <strong>${date}</strong> bleibt alles wie bisher. Ab dann läuft dein Abo im <strong>${planLabel[plan] ?? plan}-Tarif</strong> (${interval === 'yearly' ? 'jährlich' : 'monatlich'}) weiter – ohne Kündigung, ohne neue Buchung.
    </p>
    ${offline}
    <p style="margin:0 0 24px;font-size:15px;color:${base.body};line-height:1.65;">
      Überlegst du es dir anders? Bis zum ${date} kannst du den Wechsel in den Einstellungen mit einem Klick zurückziehen.
    </p>
    ${button(settingsUrl, 'Zu den Einstellungen')}
  `)
}

/** Tarifwechsel nach unten vollzogen (Webhook am Laufzeitende). */
export function planChangeDoneEmail({ plan, interval, offlineSites }: {
  plan: 'starter' | 'pro' | 'unlimited'; interval: 'monthly' | 'yearly'; offlineSites: string[]
}): string {
  const planLabel: Record<string, string> = { starter: 'Starter', pro: 'Pro', unlimited: 'Unlimited' }
  const dashboardUrl = `${APP_URL}/sites`
  const offline = offlineSites.length
    ? `<p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
        Wie von dir gewählt ${offlineSites.length === 1 ? 'ist diese Webseite jetzt offline' : 'sind diese Webseiten jetzt offline'} und als Entwurf gespeichert: <strong>${offlineSites.map(escapeHtml).join('</strong>, <strong>')}</strong>.
      </p>`
    : ''
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      Dein Tarif ist jetzt ${planLabel[plan] ?? plan}
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Dein Abo läuft ab heute im <strong>${planLabel[plan] ?? plan}-Tarif</strong> (${interval === 'yearly' ? 'jährlich' : 'monatlich'}) weiter. Die nächste Rechnung kommt wie gewohnt automatisch.
    </p>
    ${offline}
    ${button(dashboardUrl, 'Zu meinen Webseiten')}
  `)
}

export function accountReactivatedEmail(): string {
  const dashboardUrl = `${APP_URL}/sites`
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#15803D;letter-spacing:-0.02em;">
      Alles wieder online!
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Deine Zahlung hat geklappt, alles ist wieder da. Deine Webseiten sind ab sofort wieder erreichbar und dein Abo läuft ganz normal weiter.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:${base.body};line-height:1.65;">
      Du musst nichts weiter tun, das war alles automatisch.
    </p>
    ${button(dashboardUrl, 'Zum Dashboard')}
  `)
}

export function welcomeEmail({ firstName }: { firstName?: string }): string {
  const greeting = firstName ? `Hey ${firstName},` : 'Hey,'
  const dashboardUrl = `${APP_URL}/sites`
  return layout(`
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      Willkommen bei FinestSites!
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:${base.body};line-height:1.65;">
      ${greeting} herzlich Willkommen bei FinestSites.
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:${base.body};line-height:1.65;">
      Dein Account ist freigeschaltet. Du kannst jetzt deine erste Website erstellen und sie in nur wenigen Minuten live schalten. Bei Fragen schreib uns jederzeit <a href="mailto:info@finestsites.io" style="color:${base.body};">info@finestsites.io</a>
    </p>
    <p style="margin:0 0 0;font-size:15px;color:${base.body};line-height:1.65;">
      PS: Wer aus deinem Team sollte auch FinestSites nutzen?
    </p>
    ${button(dashboardUrl, 'Website erstellen')}
  `)
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Convert plain text with line breaks to email-safe HTML paragraphs */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function testimonialThanksEmail({ firstName }: { firstName?: string }): string {
  firstName = firstName ? escapeHtml(firstName) : firstName
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      Danke für deinen Erfahrungsbericht${firstName ? `, ${firstName}` : ''}!
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Dein Bericht ist bei uns angekommen. Richtig stark, dass du deine Geschichte teilst!
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      So geht es jetzt weiter: Wir schauen uns deinen Bericht an und bereiten ihn für die Fallstudien-Seite vor. Sobald genug Berichte aus der Community zusammen sind, melden wir uns bei dir. Dann kannst du deine kostenlose Fallstudien-Seite freischalten.
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Kennst du Teampartner, die auch eine Geschichte zu erzählen haben? Schick ihnen gern den Link weiter: <a href="https://app.finestsites.io/erfahrungsbericht" style="color:${base.heading};">app.finestsites.io/erfahrungsbericht</a>
    </p>
    <p style="margin:28px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Du kannst deine Einwilligung jederzeit widerrufen. Schreib uns dafür einfach eine E-Mail an info@finestsites.io und wir nehmen deinen Bericht von allen Seiten runter.
    </p>
  `)
}

export function testimonialAdminNotifyEmail({ name, category, assetCount }: {
  name: string; category: string; assetCount: number
}): string {
  name = escapeHtml(name)
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      Neuer Erfahrungsbericht
    </h1>
    <p style="margin:0 0 0;font-size:15px;color:${base.body};line-height:1.65;">
      ${name} hat einen Bericht in der Kategorie ${category} eingereicht (${assetCount} Datei${assetCount === 1 ? '' : 'en'}).
    </p>
    ${button('https://app.finestsites.io/admin/erfahrungsberichte', 'Im Admin ansehen')}
  `)
}

export function textToHtml(text: string): string {
  return text
    .split('\n\n')
    .map(para => para.trim())
    .filter(Boolean)
    .map(para => {
      const html = para
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br />')
      return `<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">${html}</p>`
    })
    .join('\n')
}

// ─── Campaign: INNERVISIONDAY reminder ────────────────────────────────────────
// For people who signed up but haven't booked yet. Personal, casual tone.
export function campaignReminderEmail({ firstName }: { firstName?: string }): string {
  const hi = firstName?.trim() ? `Hey ${escapeHtml(firstName.trim())},` : 'Hey,'
  const loginUrl = `${APP_URL}/login`
  const step = (n: number, title: string, text: string) => `
    <tr>
      <td width="40" valign="top" style="padding:0 0 16px;">
        <div style="width:28px;height:28px;border-radius:14px;background:${base.heading};color:#FFFFFF;font-size:14px;font-weight:700;line-height:28px;text-align:center;">${n}</div>
      </td>
      <td valign="top" style="padding:3px 0 16px;">
        <p style="margin:0;font-size:15px;font-weight:700;color:${base.heading};">${title}</p>
        <p style="margin:2px 0 0;font-size:14px;color:${base.body};line-height:1.55;">${text}</p>
      </td>
    </tr>`
  return layout(`
    <p style="margin:0 0 16px;font-size:16px;color:${base.body};line-height:1.65;">${hi}</p>
    <p style="margin:0 0 16px;font-size:16px;color:${base.body};line-height:1.65;">
      schön, dass du dir ein Konto bei FinestSites angelegt hast! 🙌 Ich wollte dir nur kurz Bescheid geben, bevor's zu spät ist:
      <strong style="color:${base.heading};">Die INNERVISIONDAY-Aktion läuft nur noch bis heute Nacht um 24 Uhr.</strong>
    </p>

    <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin:8px 0 28px;">
      <tr>
        <td style="background:#6D28D9;border-radius:16px;padding:22px 24px;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#DDD6FE;">Aktion INNERVISIONDAY</p>
          <p style="margin:0 0 12px;font-size:24px;font-weight:800;color:#FFFFFF;letter-spacing:-0.02em;">20&nbsp;% Rabatt für dich</p>
          <p style="margin:0;font-size:15px;color:#FFFFFF;line-height:1.7;">
            ✓ Monatlich: 20&nbsp;% auf die ersten 3 Monate<br />
            ✓ Jährlich: 20&nbsp;% aufs ganze erste Jahr<br />
            ✓ Kein Code nötig, der Rabatt ist automatisch drin
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 16px;font-size:17px;font-weight:700;color:${base.heading};">So geht's, dauert nur ein paar Minuten:</p>
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
      ${step(1, 'Einloggen', 'Mit deiner E-Mail und deinem Passwort.')}
      ${step(2, 'Webseite aussuchen', 'Such dir die Vorlage aus, die zu dir passt.')}
      ${step(3, 'Infos eintragen', 'Du musst nicht alles ausfüllen. Den Rest kannst du jederzeit später ergänzen.')}
      ${step(4, 'Veröffentlichen', 'Dabei wählst du deinen Tarif. Die 20&nbsp;% sind schon abgezogen.')}
    </table>

    ${button(loginUrl, 'Jetzt einloggen und Rabatt sichern')}

    <p style="margin:28px 0 0;font-size:15px;color:${base.body};line-height:1.65;">
      Wenn irgendwo was hakt: Schreib mir einfach im Chat auf FinestSites oder antworte auf diese Mail. Ich helf dir gern!
    </p>
    <p style="margin:20px 0 0;font-size:15px;color:${base.body};line-height:1.65;">
      Liebe Grüße<br />
      <strong style="color:${base.heading};">Daniel</strong> von FinestSites
    </p>
  `)
}

// ─── Campaign: INNERVISIONDAY last hour ───────────────────────────────────────
// Sent in the final hour of the campaign to fresh sign-ups without a plan.
export function campaignLastHourEmail({ firstName }: { firstName?: string }): string {
  const hi = firstName?.trim() ? `Hey ${escapeHtml(firstName.trim())},` : 'Hey,'
  const loginUrl = `${APP_URL}/login`
  const waUrl = 'https://wa.me/4915151005561'
  const step = (n: number, title: string, text: string) => `
    <tr>
      <td width="40" valign="top" style="padding:0 0 16px;">
        <div style="width:28px;height:28px;border-radius:14px;background:${base.heading};color:#FFFFFF;font-size:14px;font-weight:700;line-height:28px;text-align:center;">${n}</div>
      </td>
      <td valign="top" style="padding:3px 0 16px;">
        <p style="margin:0;font-size:15px;font-weight:700;color:${base.heading};">${title}</p>
        <p style="margin:2px 0 0;font-size:14px;color:${base.body};line-height:1.55;">${text}</p>
      </td>
    </tr>`
  return layout(`
    <p style="margin:0 0 16px;font-size:16px;color:${base.body};line-height:1.65;">${hi}</p>
    <p style="margin:0 0 16px;font-size:16px;color:${base.body};line-height:1.65;">
      schön, dass du heute noch bei FinestSites vorbeigeschaut hast! ⏰ Kurze Info: <strong style="color:${base.heading};">Die letzte Stunde der INNERVISIONDAY-Aktion hat gerade angefangen.</strong> Um 24 Uhr ist sie vorbei.
    </p>
    <p style="margin:0 0 16px;font-size:16px;color:${base.body};line-height:1.65;">
      Ich würde mich riesig freuen, wenn ich dich mit deiner eigenen FinestSites-Seite begeistern kann. Und ich unterstütze dich gern dabei, damit alles klappt.
    </p>

    <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin:8px 0 28px;">
      <tr>
        <td style="background:#6D28D9;border-radius:16px;padding:22px 24px;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#DDD6FE;">Nur noch bis 24 Uhr</p>
          <p style="margin:0 0 12px;font-size:24px;font-weight:800;color:#FFFFFF;letter-spacing:-0.02em;">20&nbsp;% Rabatt für dich</p>
          <p style="margin:0;font-size:15px;color:#FFFFFF;line-height:1.7;">
            ✓ Monatlich: 20&nbsp;% auf die ersten 3 Monate<br />
            ✓ Jährlich: 20&nbsp;% aufs ganze erste Jahr<br />
            ✓ Kein Code nötig, der Rabatt ist automatisch drin
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 16px;font-size:17px;font-weight:700;color:${base.heading};">Deine nächsten Schritte:</p>
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
      ${step(1, 'Einloggen', 'Mit deiner E-Mail und deinem Passwort.')}
      ${step(2, 'Webseite aussuchen', 'Such dir die Vorlage aus, die zu dir passt.')}
      ${step(3, 'Nur das Nötigste eintragen', 'Du musst die Seite jetzt nicht fertig machen. Um den Rest kümmerst du dich ganz entspannt morgen.')}
      ${step(4, 'Veröffentlichen', 'Dabei wählst du deinen Tarif. Die 20&nbsp;% sind schon abgezogen.')}
    </table>

    ${button(loginUrl, 'Jetzt einloggen und Rabatt sichern')}

    <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin:28px 0 0;">
      <tr>
        <td style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:14px;padding:16px 18px;">
          <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:${base.heading};">Fragen? Schreib mir einfach!</p>
          <p style="margin:0;font-size:14px;color:${base.body};line-height:1.6;">
            Im Chat auf FinestSites oder direkt per WhatsApp:<br />
            <a href="${waUrl}" style="color:#15803D;font-weight:700;text-decoration:none;">💬 +49 151 51005561 – jetzt per WhatsApp schreiben</a>
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 0;font-size:15px;color:${base.body};line-height:1.65;">
      Liebe Grüße<br />
      <strong style="color:${base.heading};">Daniel</strong> von FinestSites
    </p>

    <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${base.border};font-size:14px;color:${base.body};line-height:1.65;">
      <strong style="color:${base.heading};">PS: Am meisten sparst du mit jährlicher Zahlung.</strong>
      Da bekommst du 2 Monate geschenkt, und die 20&nbsp;% gelten fürs komplette erste Jahr statt nur für 3 Monate.
      Beim Pro-Tarif zahlst du so zum Beispiel <strong style="color:${base.heading};">216&nbsp;€ fürs ganze Jahr</strong> statt 307,80&nbsp;€ bei monatlicher Zahlung. Viele haben das erst hinterher erfahren, deshalb wollte ich es dir direkt sagen. 😊
    </p>
  `)
}

// ─── Produkt-Update: Partner-Kontaktdaten ─────────────────────────────────────
// Geht einmalig an alle Nutzer mit aktiver Partnerseite (lnko, Business, cellRESET,
// Dailyoptimal). Zielgruppe ist älter – deshalb große Schritte, kein Fachjargon,
// ein einziger Button.
export function partnerContactsUpdateEmail({ firstName, partnerName }: { firstName?: string; partnerName?: string }): string {
  // Nutzer tragen den Vornamen teils als „Janin und Thomas“ ein oder beide Felder
  // gleich – dann lieber neutral „ihr beide“ als „du und Thomas“
  const fn = (firstName ?? '').trim()
  const pn = (partnerName ?? '').trim()
  const hi = fn ? `Hallo ${fn}` : 'Hallo'
  const pairInFirst = /\bund\b|&|,/.test(fn)
  const wir = pn && !pairInFirst && pn.toLowerCase() !== fn.toLowerCase() ? `du und ${pn}` : 'ihr beide'
  const step = (n: number, text: string) => `
    <tr>
      <td valign="top" style="padding:0 14px 16px 0;">
        <span style="display:inline-block;width:32px;height:32px;line-height:32px;border-radius:50%;background:#111827;color:#fff;font-size:15px;font-weight:700;text-align:center;">${n}</span>
      </td>
      <td valign="top" style="padding:5px 0 16px;font-size:16px;line-height:1.55;color:${base.body};">${text}</td>
    </tr>`
  return layout(`
    <h1 style="margin:0 0 18px;font-size:23px;font-weight:700;color:${base.heading};line-height:1.3;">
      Neu: Jeder von euch kann eigene Kontaktdaten zeigen
    </h1>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${base.body};">
      ${hi},
    </p>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${base.body};">
      eine kleine Neuigkeit für eure Partnerseite: Ab sofort könnt ${wir} auf der Webseite <strong>jeweils eigene Kontaktdaten</strong> zeigen – zum Beispiel jede Person ihre eigene WhatsApp-Nummer oder ihr eigenes Instagram-Profil.
    </p>
    <p style="margin:0 0 10px;font-size:16px;line-height:1.6;color:${base.body};">
      Ihr habt die Wahl:
    </p>
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin:0 0 24px;">
      <tr>
        <td style="padding:14px 16px;background:#F5F3FF;border-radius:12px;font-size:15px;line-height:1.55;color:${base.body};">
          <strong style="color:${base.heading};">Gemeinsam</strong> – eine WhatsApp-Nummer, ein Instagram für euch beide.<br />
          <span style="color:${base.muted};">So ist es jetzt eingestellt. Wenn euch das passt, müsst ihr nichts tun.</span>
        </td>
      </tr>
      <tr><td style="height:10px;"></td></tr>
      <tr>
        <td style="padding:14px 16px;background:#EEF4FF;border-radius:12px;font-size:15px;line-height:1.55;color:${base.body};">
          <strong style="color:${base.heading};">Jeder für sich</strong> – jede Person trägt ihre eigenen Daten ein.<br />
          <span style="color:${base.muted};">Besucher sehen dann beide nebeneinander, jeweils mit Namen.</span>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:${base.heading};">
      So stellt ihr auf „Jeder für sich“ um – dauert 2 Minuten:
    </p>
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin:0 0 8px;">
      ${step(1, 'Unten auf den schwarzen Button klicken und einloggen.')}
      ${step(2, 'Bei eurer Webseite auf <strong>„Bearbeiten“</strong> klicken.')}
      ${step(3, 'Links den Bereich <strong>„Kontakt“</strong> öffnen (bei der lnko- und der Business-Seite heißt er „Social Media“).')}
      ${step(4, 'Bei <strong>„Wie sollen Besucher euch erreichen?“</strong> auf <strong>„Jeder für sich“</strong> tippen. Darunter erscheinen jetzt grün markierte Felder für die zweite Person.')}
      ${step(5, 'Die Felder ausfüllen und oben auf <strong>„Speichern“</strong> klicken. Fertig – die Webseite zeigt sofort beide.')}
    </table>
    ${button(`${APP_URL}/sites`, 'Zu meiner Webseite')}
    <p style="margin:28px 0 0;font-size:15px;line-height:1.6;color:${base.body};">
      Wenn etwas nicht klappt: Einfach auf diese E-Mail antworten, ich helfe euch persönlich weiter.
    </p>
    <p style="margin:22px 0 0;font-size:15px;line-height:1.6;color:${base.body};">
      Liebe Grüße<br />
      <strong style="color:${base.heading};">Daniel</strong><br />
      <span style="color:${base.muted};">FinestSites</span>
    </p>
  `)
}

// ─── Launch-Mail: Vitalcheck-Seite (Dein Vitalprofil) ───────────────────────
// Vier Varianten nach Tarif: none (kein aktives Abo) → Tarif wählen, starter → Pro,
// pro → Unlimited, unlimited → direkt anlegen. Video als Poster-Bild mit Link
// (E-Mail-Clients spielen kein eingebettetes Video ab).
export type VitalcheckSegment = 'none' | 'starter' | 'pro' | 'unlimited'

export const VITALCHECK_SUBJECTS: Record<VitalcheckSegment, string> = {
  none: 'Neu: Deine Vitalcheck-Seite',
  starter: 'Neu: Deine Vitalcheck-Seite (lohnt sich mit Pro)',
  pro: 'Neu: Deine Vitalcheck-Seite, jetzt 4 PM-Vorlagen',
  unlimited: 'Neu für dich: Deine Vitalcheck-Seite ist freigeschaltet',
}

// Zielgruppe: ältere Frauen, wenig Technik-Erfahrung. Kurze Sätze, keine Fachwörter,
// keine Gedankenstriche, ein Gedanke pro Absatz. Kern: Der Check lädt zum Mitmachen ein,
// das Ergebnis wird geteilt, Freundinnen machen den Check auch (Weiterempfehlung von allein).
export function vitalcheckLaunchEmail({ firstName, segment }: { firstName?: string; segment: VitalcheckSegment }): string {
  const fn = (firstName ?? '').trim()
  const hi = fn ? `Hallo ${fn}` : 'Hallo'
  const VIDEO = 'https://screen.studio/share/5Krw9gKt'
  const DEMO = 'https://demo.vitalprofil.net'
  const p = (t: string, extra = '') => `<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:${base.body};${extra}">${t}</p>`
  const fact = (t: string) => `<tr><td valign="top" style="padding:0 10px 10px 0;width:20px;"><span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:#DCFCE7;color:#15803D;font-size:12px;line-height:20px;text-align:center;font-weight:700;">✓</span></td><td style="padding:1px 0 10px;font-size:16px;line-height:1.5;color:${base.body};">${t}</td></tr>`
  const step = (n: number, t: string) => `<tr><td valign="top" style="padding:0 12px 10px 0;"><span style="display:inline-block;width:28px;height:28px;line-height:28px;border-radius:50%;background:#111827;color:#fff;font-size:14px;font-weight:700;text-align:center;">${n}</span></td><td valign="top" style="padding:4px 0 10px;font-size:16px;line-height:1.5;color:${base.body};">${t}</td></tr>`
  const box = (title: string, inner: string, bg = '#F5F3FF') => `
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin:26px 0 0;">
      <tr><td style="padding:20px 20px 16px;background:${bg};border-radius:14px;">
        <p style="margin:0 0 10px;font-size:18px;font-weight:700;color:${base.heading};">${title}</p>
        ${inner}
      </td></tr>
    </table>`

  const segmentBlock: Record<VitalcheckSegment, string> = {
    none: box('So bekommst du die Seite',
      p('Dafür brauchst du nur einen Tarif. Mit <strong>Starter</strong> (17 € im Monat) ist deine erste Seite online, gern gleich die Vitalcheck-Seite. Du kannst jeden Monat kündigen, ganz ohne Haken.', 'margin-bottom:6px;')
      + button(`${APP_URL}/billing`, 'Tarif wählen')),
    starter: box('Warum Pro für dich passt',
      p('Im Starter-Tarif hast du eine Seite. Mit <strong>Pro</strong> hast du drei Seiten für 27 € im Monat, also 10 € mehr. Ehrlich gesagt lohnt sich das hier richtig: Die Vitalcheck-Seite bringt die Gespräche, deine jetzige Seite erklärt dann den Rest.')
      + `<p style="margin:0 0 10px;font-size:16px;font-weight:700;color:${base.heading};">So geht es:</p>
        <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
          ${step(1, 'Klick unten auf den Button.')}
          ${step(2, 'Wähle <strong>Pro</strong> und bestätige.')}
          ${step(3, 'Gehe auf <strong>Meine Seiten</strong>, klicke auf <strong>Neue Seite</strong> und wähle die Vitalcheck-Seite.')}
        </table>`
      + p('Den Unterschied zahlst du nur für die restlichen Tage des Monats.', 'margin-bottom:6px;font-size:14px;color:' + base.muted + ';')
      + button(`${APP_URL}/billing`, 'Jetzt auf Pro wechseln')),
    pro: box('Vielleicht passt Unlimited jetzt besser',
      p('Im Pro-Tarif hast du drei Seiten. Von PM-International gibt es jetzt aber vier: Optimalset, cellRESET, Business und Vitalcheck. Und ich verrate dir: Die nächsten Seiten sind schon in Arbeit.')
      + p('Mit <strong>Unlimited</strong> (37 € im Monat) hast du einfach alle, auch die neuen. Dann musst du nie wieder überlegen, welche Seite du dafür abschaltest.')
      + `<table cellpadding="0" cellspacing="0" role="presentation" width="100%">
          ${step(1, 'Klick unten auf den Button.')}
          ${step(2, 'Wähle <strong>Unlimited</strong> und bestätige.')}
        </table>`
      + p('Den Unterschied zahlst du nur für die restlichen Tage des Monats.', 'margin-bottom:6px;font-size:14px;color:' + base.muted + ';')
      + button(`${APP_URL}/billing`, 'Auf Unlimited wechseln')),
    unlimited: box('Für dich ist die Seite schon freigeschaltet',
      p('Du musst nichts weiter tun. Gehe auf <strong>Meine Seiten</strong>, klicke auf <strong>Neue Seite</strong> und wähle <strong>Dein Vitalprofil (Vitalcheck)</strong>. Dein Foto und deine Texte sind schon drin, in zehn Minuten ist die Seite online.', 'margin-bottom:6px;')
      + button(`${APP_URL}/sites/new`, 'Vitalcheck-Seite anlegen'), '#ECFDF5'),
  }

  return layout(`
    <h1 style="margin:0 0 18px;font-size:23px;font-weight:700;color:${base.heading};line-height:1.3;">
      Neu: Deine Vitalcheck-Seite
    </h1>
    ${p(`${hi},`)}
    ${p('ich hab was Neues für dich: deine eigene <strong>Vitalcheck-Seite</strong>.')}
    ${p('Stell dir das so vor: Jemand kommt auf deine Seite, beantwortet 20 kurze Fragen zu seinem Alltag (dauert drei Minuten) und bekommt am Ende seinen <strong>Vital-Typ</strong>. Den kann er als Bild in seiner Story teilen.')}
    ${p('Und jetzt kommt der schöne Teil: Die Freundin sieht das Bild, denkt sich „das mach ich auch“, macht den Check und teilt ihr Ergebnis. So wandert deine Seite ganz von allein weiter, von einer zur nächsten.')}
    ${p('Und wer danach mit dir sprechen möchte, klickt auf <strong>„Beratung anfragen“</strong>. Dann bekommst du eine E-Mail mit allen Antworten und weißt schon vor dem ersten Gespräch, worum es geht.')}

    <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin:20px 0 6px;">
      ${fact('20 Fragen, drei Minuten, ohne Anmeldung')}
      ${fact('Das Ergebnis gibt es als Bild zum Teilen')}
      ${fact('Wer Beratung möchte, schickt dir seine Antworten mit einem Klick')}
      ${fact('Oben dein Foto, dein Text und deine anderen Seiten')}
    </table>

    <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin:22px 0 0;">
      <tr><td style="padding:0;">
        <p style="margin:0 0 12px;font-size:16px;line-height:1.65;color:${base.body};">Ich hab dir ein kleines Video gemacht, fünf Minuten. Da zeig ich dir die Seite und wie du sie anlegst. Klick einfach aufs Bild:</p>
        <a href="${VIDEO}" style="display:block;border-radius:14px;overflow:hidden;line-height:0;">
          <img src="${APP_URL}/mail/vitalcheck-video.png" alt="Video: Deine Vitalcheck-Seite (5 Minuten)" width="480" style="width:100%;max-width:480px;height:auto;display:block;border-radius:14px;border:1px solid ${base.border};" />
        </a>
        <p style="margin:10px 0 0;font-size:13px;color:${base.muted};">Falls das Bild nicht lädt: <a href="${VIDEO}" style="color:${base.muted};">${VIDEO.replace('https://', '')}</a><br />Die Seite ansehen: <a href="${DEMO}" style="color:${base.muted};">demo.vitalprofil.net</a></p>
      </td></tr>
    </table>

    ${segmentBlock[segment]}

    <p style="margin:28px 0 0;font-size:16px;line-height:1.65;color:${base.body};">
      Wenn irgendwas unklar ist, antworte einfach auf diese E-Mail. Ich bin da und helfe dir gern.
    </p>
    <p style="margin:22px 0 0;font-size:16px;line-height:1.65;color:${base.body};">
      Liebe Grüße<br />
      <strong style="color:${base.heading};">Daniel</strong><br />
      <span style="color:${base.muted};">FinestSites</span>
    </p>
  `)
}

// ─── Bitte um Austausch eines Vorher-Nachher-Bilds (12.10.2026) ─────────────
// Persönlich von Daniel, locker und wertschätzend. Das betroffene Bild wird gezeigt, damit
// klar ist, welches gemeint ist. Keine Gedankenstriche, kurze Sätze, Schritte zum Austausch.
export const ABOUT_IMAGE_SUBJECT = 'Kurze Bitte zu einem Foto auf deiner Optimalset-Seite'

export function aboutImageGuidelineEmail({ firstName, imageUrl, pair = false, labelOnly = false, praise }: {
  firstName?: string; imageUrl: string; pair?: boolean
  /** Persönliches, ehrliches Lob zum Bild (je Person individuell) */
  praise?: string
  /** Foto selbst ok, nur die Beschriftung „Vorher/Nachher“ ist das Problem */
  labelOnly?: boolean
}): string {
  const fn = (firstName ?? '').trim()
  // Du- oder Ihr-Form (Partnerseiten wie „Janin und Thomas“)
  const w = pair
    ? { hi: fn ? `Hallo ${fn}` : 'Hallo ihr beiden', deinem: 'eurem', euch: 'euch', ihr: 'ihr', habt: 'habt', tausch: 'Tauscht', nimm: 'nehmt', mag: 'mögt', antworte: 'Antwortet', dein: 'euer', seite: 'eurer', danke: 'Danke euch', bild: 'ein Bild von euch', brauchst: 'braucht ihr', kannst: 'könnt ihr', deine: 'eure', bekommst: 'ihr am Ende Ärger bekommt' }
    : { hi: fn ? `Hallo ${fn}` : 'Hallo', deinem: 'deinem', euch: 'dich', ihr: 'du', habt: 'hast', tausch: 'Tausch', nimm: 'nimmst du', mag: 'magst', antworte: 'Antworte', dein: 'dein', seite: 'meiner', danke: 'Danke dir', bild: 'ein Bild von dir', brauchst: 'brauchst du', kannst: 'kannst du', deine: 'deine', bekommst: 'du am Ende Ärger bekommst' }
  const P = (html: string, extra = '') =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${base.body};${extra}">${html}</p>`
  const step = (n: number, text: string) => `
    <tr>
      <td valign="top" style="padding:0 12px 12px 0;">
        <span style="display:inline-block;width:26px;height:26px;line-height:26px;border-radius:50%;background:#111827;color:#fff;font-size:13px;font-weight:700;text-align:center;">${n}</span>
      </td>
      <td valign="top" style="padding:3px 0 12px;font-size:15px;line-height:1.55;color:${base.body};">${text}</td>
    </tr>`
  const ask = labelOnly
    ? `Das Foto selbst ist völlig in Ordnung. Problematisch ist nur die Beschriftung „Vorher / Nachher“. Am einfachsten ${w.nimm} eins der beiden Fotos ohne Schrift, dann passt alles.`
    : `Deshalb meine Bitte: ${w.tausch} das Foto gegen ${w.bild} von heute, z. B. ein schönes Porträt oder ein Foto mit den Produkten im Alltag.`
  return layout(`
    <h1 style="margin:0 0 18px;font-size:22px;font-weight:700;color:${base.heading};line-height:1.3;">
      Eine kleine Bitte zu ${w.deinem} Foto
    </h1>
    ${P(`${w.hi},`)}
    ${P(`ich gehe gerade alle Optimalset-Seiten durch und bin dabei auf dieses Foto in ${w.deinem} „Über mich“-Bereich gestoßen:`)}
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:4px 0 20px;">
      <tr><td style="border-radius:14px;overflow:hidden;border:1px solid ${base.border};">
        <img src="${imageUrl}" alt="Foto im Über-mich-Bereich" width="260" style="display:block;width:260px;max-width:100%;height:auto;border-radius:14px;" />
      </td></tr>
    </table>
    ${P(`Ganz ehrlich: ${praise ?? (labelOnly
      ? `Ich finde das Foto richtig schön, und es passt super auf ${w.deinem === 'eurem' ? 'eure' : 'deine'} Seite.`
      : `Man sieht sofort, was ${w.ihr} geschafft ${w.habt}. Das ist echt klasse.`)}`)}
    ${P(`Leider gibt es für Nahrungsergänzung sehr strenge Regeln, die ich selbst nicht immer nachvollziehen kann. Ein Vorher-Nachher-Bild auf einer Webseite wird rechtlich so gewertet, als würden wir jedem versprechen, mit den Produkten das gleiche Ergebnis zu bekommen. Dafür werden Seiten abgemahnt, auch wenn alles echt ist, und auch PM-International schaut da sehr genau hin. Da sind mir leider die Hände gebunden, und ich möchte nicht, dass ${w.bekommst}.`)}
    ${P(ask)}
    ${labelOnly ? '' : P(`Und keine Sorge, für Termine ${w.brauchst} das Bild auf der Seite gar nicht. Die meisten teilen ihre Vorher-Nachher-Bilder auf Social Media und verlinken ihr Profil auf der Seite. Interessenten schauen dort sowieso vorbei, sehen die Bilder und überzeugen sich selbst. Und im persönlichen Gespräch ${w.kannst} ${w.deine} Vorher-Nachher-Bilder natürlich jederzeit zeigen.`)}
    <p style="margin:6px 0 12px;font-size:16px;font-weight:700;color:${base.heading};">So geht's:</p>
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin:0 0 4px;">
      ${step(1, 'Unten auf den Button tippen und einloggen.')}
      ${step(2, 'Bei der Optimalset-Seite auf <strong>„Bearbeiten“</strong> tippen.')}
      ${step(3, 'Im Bereich <strong>„Profil“</strong> beim <strong>„Über mich“-Bild</strong> auf <strong>„Ersetzen“</strong> tippen.')}
      ${step(4, 'Oben auf <strong>„Änderungen veröffentlichen“</strong> tippen. Fertig.')}
    </table>
    ${button(`${APP_URL}/sites`, `Zu ${w.seite} Seite`)}
    ${P(`Wenn ${w.ihr} ${w.mag}, übernehme ich das auch für ${w.euch}: ${w.antworte} einfach kurz, dann setze ich ${w.dein} Profilbild ein.`, 'margin-top:28px;')}
    <p style="margin:22px 0 0;font-size:15px;line-height:1.6;color:${base.body};">
      ${w.danke} fürs Verständnis und liebe Grüße<br />
      <strong style="color:${base.heading};">Daniel</strong><br />
      <span style="color:${base.muted};">FinestSites</span>
    </p>
  `)
}

// ─── Produkt-Update 15.10.2026 ──────────────────────────────────────────────────

const MAIL_ASSETS = 'https://app.finestsites.io/mail/update-2026-10'
const VIOLET = '#8060b0'

export const PRODUCT_UPDATE_2026_10_SUBJECT = 'Update bei FinestSites: 8 Sprachen, deine eigene Farbe und neue Hintergrundbilder'

/** pro = Pro/Unlimited mit Abo, starter = Starter mit Abo, none = noch kein Abo */
export type ProductUpdateSegment = 'pro' | 'starter' | 'none'

/**
 * Jede Neuigkeit ist eine eigene Karte: Nummer + Titel, Bild, zwei kurze Sätze, wo man es findet.
 * Bilder liegen in public/mail/update-2026-10 (PNG @2x, 560 px breit, alle gleich aufgebaut).
 * Kategorie "updates", der Footer kommt über `prefs` aus sendCategoryMail.
 */
export function productUpdate202610Email({ firstName, segment = 'pro', prefs }: { firstName?: string; segment?: ProductUpdateSegment; prefs?: PrefsFooter }): string {
  const name = firstName?.trim() || 'du'
  const card = (n: number, title: string, img: string, alt: string, text: string, where: string) => `
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
      <tr>
        <td width="34" valign="top" style="padding:0 12px 0 0;">
          <div style="width:30px;height:30px;border-radius:50%;background:#8060b0;color:#fff;font-size:14px;font-weight:700;text-align:center;line-height:30px;">${n}</div>
        </td>
        <td valign="middle">
          <h2 style="margin:0;font-size:19px;font-weight:700;color:${base.heading};letter-spacing:-0.01em;line-height:1.3;">${title}</h2>
        </td>
      </tr>
    </table>
    <img src="${MAIL_ASSETS}/${img}" alt="${alt}" width="488" style="display:block;width:100%;height:auto;border:0;border-radius:16px;margin:18px 0 0;" />
    <p style="margin:18px 0 0;font-size:15px;color:${base.body};line-height:1.65;">${text}</p>
    <p style="margin:12px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      <span style="display:inline-block;background:#F3EEF9;color:#6B4FA0;border-radius:999px;padding:4px 10px;font-weight:600;">${where}</span>
    </p>`

  // Zusatzkarte je nach Abo-Stand: Starter → mehr Seiten lohnen sich, kein Abo → Anleitung zum Aktivieren
  const extra = segment === 'starter'
    ? `<h2 style="margin:0 0 8px;font-size:19px;font-weight:700;color:${base.heading};letter-spacing:-0.01em;">Mit Pro hast du drei Seiten statt einer</h2>
       <p style="margin:0;font-size:15px;color:${base.body};line-height:1.65;">
         Gerade hast du eine Seite online. Mit Pro kannst du drei laufen lassen, zum Beispiel Optimalset, Business und cellRESET. Jede hat ihr eigenes Thema und holt andere Leute ab. Kostet 10\u202f€ mehr im Monat.
       </p>
       ${button(`${APP_URL}/settings?tab=zahlung`, 'Auf Pro wechseln', VIOLET)}`
    : segment === 'none'
    ? `<h2 style="margin:0 0 8px;font-size:19px;font-weight:700;color:${base.heading};letter-spacing:-0.01em;">In 5 Minuten ist deine Seite online</h2>
       <p style="margin:0 0 14px;font-size:15px;color:${base.body};line-height:1.65;">
         Deine Seite wartet noch auf dich. So geht's:
       </p>
       <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
         ${['Einloggen und deine Seite im Editor öffnen.', 'Name, Foto und Farbe eintragen.', 'Auf „Veröffentlichen“ tippen und Tarif wählen.'].map((t, i) => `
         <tr>
           <td width="30" valign="top" style="padding:0 10px 10px 0;"><div style="width:24px;height:24px;border-radius:50%;background:#F3EEF9;color:#6B4FA0;font-size:13px;font-weight:700;text-align:center;line-height:24px;">${i + 1}</div></td>
           <td valign="top" style="padding:2px 0 10px;font-size:15px;color:${base.body};line-height:1.5;">${t}</td>
         </tr>`).join('')}
       </table>
       <p style="margin:4px 0 0;font-size:14px;color:${base.muted};line-height:1.6;">Ab 17\u202f€ im Monat, jederzeit monatlich kündbar.</p>
       ${button(`${APP_URL}/sites`, 'Jetzt Seite online stellen', VIOLET)}`
    : null

  return layoutCards([
    `<p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8060b0;">Update</p>
     <h1 style="margin:0 0 12px;font-size:26px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;line-height:1.2;">
       Es gibt wieder was Neues
     </h1>
     <p style="margin:0;font-size:15px;color:${base.body};line-height:1.65;">
       Hey ${name}, wir haben wieder an deiner Seite gebaut. Drei Sachen, die du ab sofort nutzen kannst. Kostet nichts extra.
     </p>`,
    card(1, 'Deine Business-Seite gibt\'s jetzt in 8 Sprachen', 'sprachen-v2.png', 'Business-Seite in 8 Sprachen',
      'Deutsch, Englisch, Italienisch, Russisch, Ukrainisch, Polnisch, Bulgarisch und Hindi. Kommt jemand aus Polen auf deine Seite, sieht er alles auf Polnisch. Auch deinen Über-mich-Text. Du musst dafür nichts machen.',
      'Läuft automatisch'),
    card(2, 'Such dir deine eigene Farbe aus', 'farben-v2.png', 'Eigene Farbe mit Farbwähler und Farbcode',
      'Bis jetzt gab\'s ein paar Farben zur Auswahl. Ab jetzt nimmst du genau die Farbe, die du willst: im Farbwähler einstellen oder deinen Farbcode eintippen (z.\u202fB. #D9468B). Dann ist die ganze Seite in deiner Farbe, Buttons, Überschriften, alles.',
      'Im Editor unter „Farbe“'),
    card(3, 'Neue Bilder für deine Optimalset-Seite', 'hintergruende-v2.png', 'Neue Hintergrundbilder',
      'Vier neue Hintergrundbilder, vom Frühstück mit Orangensaft bis zum Sommer im Garten. Antippen, übernehmen, fertig.',
      'Im Editor unter „Hintergrundbild“'),
    ...(extra ? [extra] : []),
    // mit Zusatzkarte gibt es schon einen Button, dann nur noch der Gruß
    `${extra ? '' : `<h2 style="margin:0 0 8px;font-size:19px;font-weight:700;color:${base.heading};letter-spacing:-0.01em;">Probier's gleich aus</h2>
     <p style="margin:0;font-size:15px;color:${base.body};line-height:1.65;">
       Mach deine Seite im Editor auf, alles Neue ist schon drin.
     </p>
     ${button(`${APP_URL}/sites`, 'Zu meinen Seiten', VIOLET)}`}
     <p style="margin:${extra ? 0 : 28}px 0 0;font-size:15px;color:${base.body};line-height:1.65;">
       Fragen? Schreib mir einfach, ich lese alles selbst.
     </p>
     <p style="margin:14px 0 0;font-size:15px;color:${base.body};line-height:1.65;">
       Viele Grüße<br /><strong style="color:${base.heading};">Daniel von FinestSites</strong>
     </p>`,
  ], prefs)
}

// ─── Ankündigung App + Besucher-Chat (November 2026) ─────────────────────────
// Kategorie "updates", Versand nur über scripts/send-app-launch-2026-11.ts. Bilder in public/mail/app-2026-11/.

const APP_LAUNCH_ASSETS = 'https://app.finestsites.io/mail/app-2026-11'
const APP_STORE_URL = 'https://apps.apple.com/de/app/finestsites/id6825371773'

const ANDROID_TESTER_MAILTO = `mailto:info@finestsites.io?subject=${encodeURIComponent('Android-Tester')}&body=${encodeURIComponent('Hallo Daniel, ich möchte die Android-App testen.\n\nMeine Google-Mailadresse (Play Store): ')}`
export const APP_LAUNCH_2026_11_SUBJECT = 'Update: Die FinestSites-App ist da'

/** Vorname für die Anrede: erstes Wort, erster Buchstabe groß; leer/unbrauchbar → keine Anrede */
function launchFirstName(firstName?: string): string {
  const w = (firstName ?? '').trim().split(/\s+/)[0] ?? ''
  if (w.length < 2 || /[@\d]/.test(w)) return ''
  return w.charAt(0).toUpperCase() + w.slice(1)
}

/**
 * Dunkles Premium-Layout, nur für diese Ankündigung (Daniels Wunsch 02.11.2026, Ausnahme von layout()).
 * Zwei Neuheiten auf einen Blick (App + Chat), persönliche Anrede nur mit echtem Vornamen, sofort sichtbar
 * welche Geräte schon können (iPhone/iPad) und welche noch warten (Android).
 * Robust für gängige Postfächer: Farben doppelt (bgcolor + CSS), feste 560er-Tabelle für Outlook (MSO),
 * Webfont nur in @media screen (Outlook fiele sonst auf Times zurück), Knopf mit Innenabstand am <td>,
 * drei kleine Bilder (~14 KB) mit Alt-Text, Textfassung appLaunch202611Text für den multipart-Versand.
 */
export function appLaunch202611Email({ firstName, hasPlan = true, prefs }: { firstName?: string; hasPlan?: boolean; prefs?: PrefsFooter }): string {
  const name = launchFirstName(firstName)
  const included = hasPlan ? 'in deinem Tarif inklusive' : 'in jedem Tarif inklusive'
  const C = { bg: '#000000', card: '#141416', line: '#26262B', white: '#F5F5F7', body: '#A1A1A6', muted: '#8E8E93', accent: '#B79CFF', violet: '#7C4DFF', green: '#30D158', amber: '#FFB340' }
  const font = `'Plus Jakarta Sans','Helvetica Neue',Helvetica,Arial,sans-serif`
  const row = (html: string, pad = '0 28px') => `<tr><td style="padding:${pad};">${html}</td></tr>`
  const space = (h: number) => `<tr><td height="${h}" style="height:${h}px;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr>`
  const text = (html: string, style = '') =>
    `<p style="margin:0;font-family:${font};font-size:16px;line-height:1.55;color:${C.body};text-align:center;${style}">${html}</p>`
  const line = `border-bottom:1px solid ${C.line};`
  const card = (inner: string) =>
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" bgcolor="${C.card}" style="background:${C.card};border-radius:20px;">${inner}</table>`
  const update = (n: number, title: string, benefit: string, last = false) => `
    <tr>
      <td width="56" valign="top" style="padding:20px 0 20px 22px;${last ? '' : line}">
        <table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>
          <td width="30" height="30" align="center" valign="middle" bgcolor="${C.violet}" style="width:30px;height:30px;border-radius:15px;background:${C.violet};font-family:${font};font-size:15px;font-weight:700;color:#FFFFFF;line-height:30px;">${n}</td>
        </tr></table>
      </td>
      <td valign="top" style="padding:20px 22px 20px 0;${last ? '' : line}">
        <p style="margin:0;font-family:${font};font-size:17px;font-weight:700;color:${C.white};">${title}</p>
        <p style="margin:4px 0 0;font-family:${font};font-size:15px;line-height:1.5;color:${C.body};">${benefit}</p>
      </td>
    </tr>`
  const platform = (o: { label: string; status?: string; color: string; border: string; body: string; cta: string; href: string; btnBg: string; btnColor: string }) => `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" bgcolor="${C.card}" style="background:${C.card};border-radius:20px;border:1px solid ${o.border};">
      <tr>
        <td${o.status ? '' : ' colspan="2"'} style="padding:20px 22px 0;font-family:${font};font-size:18px;line-height:1.35;font-weight:700;color:${o.status ? C.white : o.color};">${o.label}</td>
        ${o.status ? `<td align="right" style="padding:20px 22px 0;font-family:${font};font-size:14px;font-weight:700;color:${o.color};white-space:nowrap;">&#9679;&nbsp;${o.status}</td>` : ''}
      </tr>
      <tr><td colspan="2" style="padding:8px 22px 0;font-family:${font};font-size:15px;line-height:1.5;color:${C.body};">${o.body}</td></tr>
      <tr><td colspan="2" align="center" style="padding:18px 22px 22px;">
        <table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center" style="margin:0 auto;">
          <tr><td align="center" bgcolor="${o.btnBg}" style="background:${o.btnBg};border-radius:999px;mso-padding-alt:14px 28px;">
            <a href="${o.href}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${font};font-size:16px;font-weight:700;color:${o.btnColor};text-decoration:none;border-radius:999px;mso-padding-alt:0;">${o.cta}</a>
          </td></tr>
        </table>
      </td></tr>
    </table>`
  const tile = (file: string, alt: string, bg: string, glow: string) => `
    <td width="88" height="88" align="center" valign="middle" bgcolor="${bg}" style="width:88px;height:88px;border-radius:20px;background:${bg};box-shadow:0 0 40px ${glow};">
      <img src="${APP_LAUNCH_ASSETS}/${file}" alt="${alt}" width="88" height="88" style="display:block;width:88px;height:88px;border:0;outline:none;border-radius:20px;color:${bg === '#FFFFFF' ? '#000000' : '#FFFFFF'};font-family:${font};font-size:16px;font-weight:700;text-align:center;line-height:88px;" />
    </td>`

  const footer = prefs
    ? `Du bekommst diese Mail, weil du ein FinestSites-Konto hast und „${prefs.categoryLabel}“ erhalten möchtest.<br />
       <a href="${prefs.unsubscribeUrl}" style="color:${C.muted};text-decoration:underline;">Diese Mails abbestellen</a> &nbsp;·&nbsp;
       <a href="${prefs.settingsUrl}" style="color:${C.muted};text-decoration:underline;">E-Mail-Einstellungen</a> &nbsp;·&nbsp;
       <a href="mailto:info@finestsites.io" style="color:${C.muted};text-decoration:underline;">Support</a><br />
       FinestSites · Daniel Kurzeja · <a href="https://finestsites.io/impressum" style="color:${C.muted};text-decoration:underline;">Impressum</a>`
    : `© ${new Date().getFullYear()} FinestSites &nbsp;·&nbsp; <a href="mailto:info@finestsites.io" style="color:${C.muted};text-decoration:underline;">Support</a>`

  return `<!DOCTYPE html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>Update: Die FinestSites-App ist da</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <style>* { font-family: Arial, Helvetica, sans-serif !important; }</style><![endif]-->
  <style>
    @media screen {
      @font-face { font-family: 'Plus Jakarta Sans'; font-weight: 400 700; font-style: normal;
        src: url('${APP_URL}/fonts/PlusJakartaSans-latin.woff2') format('woff2'); }
    }
    :root { color-scheme: dark; supported-color-schemes: dark; }
    body { margin:0 !important; padding:0 !important; width:100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    u + #body a { color: inherit; text-decoration: none; }
    @media screen and (max-width: 480px) { .fs-h1 { font-size: 30px !important; } }
  </style>
</head>
<body id="body" bgcolor="${C.bg}" style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:${C.bg};">Deine Webseiten immer dabei, und Besucher chatten direkt mit dir. Plus: Android-Tester gesucht.${'&#847;&zwnj;&nbsp;'.repeat(60)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" bgcolor="${C.bg}" style="background:${C.bg};">
    <tr><td align="center" style="padding:40px 0 48px;">
      <!--[if mso]><table width="560" cellpadding="0" cellspacing="0" border="0" role="presentation" align="center"><tr><td><![endif]-->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:560px;width:100%;">

        ${row(`<img src="${APP_LAUNCH_ASSETS}/logo-white.png" alt="FinestSites" width="120" height="25" style="display:block;margin:0 auto;width:120px;height:auto;border:0;outline:none;color:${C.white};font-family:${font};font-size:20px;font-weight:700;text-align:center;" />`)}
        ${space(40)}

        ${row(`<table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center" style="margin:0 auto;"><tr>
                 ${tile('icon-144.png', 'App', '#FFFFFF', 'rgba(183,156,255,0.45)')}
                 <td width="64" align="center" valign="middle" style="font-family:${font};font-size:40px;font-weight:700;color:${C.white};">+</td>
                 ${tile('chat-144.png', 'Chat', C.violet, 'rgba(124,77,255,0.6)')}
               </tr></table>`)}
        ${space(28)}

        ${row(`<p style="margin:0;font-family:${font};font-size:13px;font-weight:700;color:${C.accent};text-align:center;letter-spacing:1px;">EIN GIGAAAAANTISCHES UPDATE!</p>
               <h1 class="fs-h1" style="margin:14px 0 0;font-family:${font};font-size:36px;line-height:1.12;font-weight:700;color:${C.white};text-align:center;letter-spacing:-1px;">Deine <span style="white-space:nowrap;">FinestSites-App</span> ist da.<br /><span style="color:${C.accent};">Und jetzt wird gechattet!</span></h1>
               ${text(`${name ? `Hey ${name}, ab` : 'Ab'} sofort hast du deine Webseiten immer dabei! Bearbeite deine Seiten bequem vom Handy aus, verpasse keine Anfragen mehr und chatte direkt mit deinen Besuchern. Einfacher geht's kaum.`, 'margin-top:18px;font-size:17px;')}`)}
        ${space(32)}

        ${row(card(`
          ${update(1, 'Update: Die App', 'Mal eben einen Text ändern, ein Bild austauschen oder eine Anfrage beantworten? Geht jetzt alles direkt über die FinestSites-App. Und bei neuen Anfragen bekommst du sofort eine Push-Nachricht.')}
          ${update(2, 'Update: Der Chat', "Nicht jeder hat Lust, ein Kontaktformular auszufüllen. Deshalb gibt's jetzt den Chat! Deine Besucher können dir direkt auf deiner Webseite schreiben und du antwortest ganz bequem über die App. So einfach kann der erste Kontakt sein.", true)}
        `))}
        ${space(32)}

        ${row(platform({
          label: 'Android-Nutzer aufgepasst! Wir suchen Tester!', color: C.amber, border: C.amber,
          body: `Auch für Android steht die App schon in den Startlöchern! Bevor sie offiziell im Play Store erscheint, brauchen wir noch ein paar Freiwillige, die sie vorab installieren.<br /><br />Du möchtest dabei sein? <strong style="color:${C.white};">Schick mir einfach deine Google-Mailadresse, mit der du im Play Store angemeldet bist.</strong> Ich schalte dich dann frei. Dauert nur eine Minute und hilft uns <span style="white-space:nowrap;">riesig! &#128591;</span>`,
          cta: 'Ich möchte Android-Tester werden', href: ANDROID_TESTER_MAILTO, btnBg: C.amber, btnColor: '#000000',
        }))}
        ${space(12)}
        ${row(text('Oder einfach auf diese Mail antworten.', `font-size:13px;color:${C.muted};`))}
        ${space(24)}
        ${row(platform({
          label: 'iPhone und iPad', status: 'Jetzt verfügbar', color: C.green, border: C.line,
          body: 'Lade dir die App und leg direkt los.',
          cta: 'Jetzt die App laden', href: APP_STORE_URL, btnBg: C.white, btnColor: '#000000',
        }))}
        ${space(18)}
        ${row(text(`<span style="color:${C.green};font-weight:700;">&#10003;</span>&nbsp; Ohne Aufpreis: App und Chat sind ${included}.`, 'font-size:14px;'))}
        ${space(40)}

        ${row(text('Chat einschalten: In der App deine Seite öffnen → Kontakt → <span style="white-space:nowrap;">Besucher-Chat</span>.', 'font-size:15px;'))}
        ${space(40)}

        ${row(`${text(`Ich bin mega gespannt, was du sagst${name ? `, ${name}` : ''}. Fragen oder Feedback? Antworte einfach auf diese Mail.`)}
               ${text('Daniel von FinestSites', `margin-top:10px;color:${C.white};font-weight:700;`)}`)}
        ${space(40)}
        ${row(`<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td style="padding-top:24px;border-top:1px solid ${C.line};font-family:${font};font-size:12px;line-height:1.7;color:${C.muted};text-align:center;">${footer}</td></tr></table>`)}

      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`
}

/** Reine Textfassung zur App-Ankündigung (multipart/alternative, gut für Zustellbarkeit) */
export function appLaunch202611Text({ firstName, hasPlan = true, prefs }: { firstName?: string; hasPlan?: boolean; prefs?: PrefsFooter }): string {
  const name = launchFirstName(firstName)
  return [
    'EIN GIGAAAAANTISCHES UPDATE!',
    'Deine FinestSites-App ist da. Und jetzt wird gechattet!',
    '',
    `${name ? `Hey ${name}, ab` : 'Ab'} sofort hast du deine Webseiten immer dabei! Bearbeite deine Seiten bequem vom Handy aus, verpasse keine Anfragen mehr und chatte direkt mit deinen Besuchern. Einfacher geht's kaum.`,
    '',
    '1. Update: Die App',
    'Mal eben einen Text ändern, ein Bild austauschen oder eine Anfrage beantworten? Geht jetzt alles direkt über die FinestSites-App. Und bei neuen Anfragen bekommst du sofort eine Push-Nachricht.',
    '',
    '2. Update: Der Chat',
    "Nicht jeder hat Lust, ein Kontaktformular auszufüllen. Deshalb gibt's jetzt den Chat! Deine Besucher können dir direkt auf deiner Webseite schreiben und du antwortest ganz bequem über die App. So einfach kann der erste Kontakt sein.",
    '',
    'ANDROID-NUTZER AUFGEPASST! WIR SUCHEN TESTER!',
    'Auch für Android steht die App schon in den Startlöchern! Bevor sie offiziell im Play Store erscheint, brauchen wir noch ein paar Freiwillige, die sie vorab installieren.',
    'Du möchtest dabei sein? Schick mir einfach deine Google-Mailadresse, mit der du im Play Store angemeldet bist. Ich schalte dich dann frei. Dauert nur eine Minute und hilft uns riesig! Antworte dazu einfach auf diese Mail.',
    '',
    'IPHONE UND IPAD: JETZT VERFÜGBAR',
    `Jetzt die App laden: ${APP_STORE_URL}`,
    '',
    `Ohne Aufpreis: App und Chat sind ${hasPlan ? 'in deinem Tarif inklusive' : 'in jedem Tarif inklusive'}.`,
    '',
    'Chat einschalten: In der App deine Seite öffnen → Kontakt → Besucher-Chat.',
    '',
    `Ich bin mega gespannt, was du sagst${name ? `, ${name}` : ''}. Fragen oder Feedback? Antworte einfach auf diese Mail.`,
    'Daniel von FinestSites',
    '',
    '---',
    ...(prefs ? [`Diese Mails abbestellen: ${prefs.unsubscribeUrl}`, `E-Mail-Einstellungen: ${prefs.settingsUrl}`] : []),
    'Impressum: https://finestsites.io/impressum',
  ].join('\n')
}

// ─── Update November 2026: 13 Sprachen + Weiterempfehlen + P.S. Android ──────
// Kategorie "updates", Versand nur über scripts/send-update-2026-11.ts (Test an Daniel, Rest nur mit Freigabe).
// Bewusst ohne große Bilder (Spam-Filter mögen ein ausgewogenes Text-Bild-Verhältnis), Textfassung für multipart.

export const UPDATE_2026_11_SUBJECT = 'Wieder mal ein Update!'
export const UPDATE_2026_11_PREHEADER = 'Deine Seiten sprechen jetzt 13 Sprachen. Und mit deinem Empfehlungslink zahlt sich dein Abo selbst.'

const U11_NEW_LANGS = ['Türkisch', 'Serbisch', 'Spanisch', 'Chinesisch', 'Koreanisch']
const U11_OLD_LANGS = ['Deutsch', 'Englisch', 'Italienisch', 'Russisch', 'Ukrainisch', 'Polnisch', 'Bulgarisch', 'Hindi']

/** Partner-Rechenbeispiel: Pro im Monatsabo, 10 % vom Nettobetrag (19 % MwSt. herausgerechnet) */
function u11Commission(count: number): string {
  const perCustomer = (27 / 1.19) * 0.1
  return (Math.round(perCustomer * count * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Persönlicher Empfehlungslink (gleiches Format wie /affiliate) */
function u11RefLink(username?: string | null): string | null {
  const u = (username ?? '').trim()
  return /^[a-z][a-z-]{1,29}$/.test(u) ? `https://finestsites.io/?ref=${u}` : null
}

/**
 * Update November 2026 im dunklen Premium-Layout der App-Mail (Daniel: helle Fassung „sehr langweilig“).
 * Ohne Bilder außer dem Logo (Flaggen als Emoji, Balken als Tabellen), damit Spamfilter zufrieden sind.
 * Jede Mail enthält den persönlichen Empfehlungslink des Empfängers (username), ohne Benutzernamen den Weg zu /affiliate.
 * Mobil zuerst: feste Umbrüche in den Überschriften, Vorlagennamen und Fachwörter mit nowrap, kleinere Flaggen-Beschriftung unter 400 px.
 */
export function update202611Email({ firstName, username, prefs }: { firstName?: string; username?: string | null; prefs?: PrefsFooter }): string {
  const name = launchFirstName(firstName)
  const link = u11RefLink(username)
  const C = { bg: '#000000', card: '#141416', card2: '#1C1C20', line: '#26262B', white: '#F5F5F7', body: '#A1A1A6', muted: '#8E8E93', accent: '#B79CFF', violet: '#7C4DFF', green: '#30D158', amber: '#FFB340' }
  const font = `'Plus Jakarta Sans','Helvetica Neue',Helvetica,Arial,sans-serif`
  const row = (html: string, pad = '0 28px') => `<tr><td class="fs-pad" style="padding:${pad};">${html}</td></tr>`
  const space = (h: number) => `<tr><td height="${h}" style="height:${h}px;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr>`
  const text = (html: string, style = '', cls = '') => `<p${cls ? ` class="${cls}"` : ''} style="margin:0;font-family:${font};font-size:16px;line-height:1.55;color:${C.body};text-align:center;${style}">${html}</p>`
  const nw = (t: string) => `<span style="white-space:nowrap;">${t}</span>`
  const kicker = (t: string, color = C.accent) => `<p style="margin:0;font-family:${font};font-size:13px;font-weight:700;color:${color};text-align:center;letter-spacing:1.5px;">${t}</p>`
  const h1 = (html: string) => `<h1 class="fs-h1" style="margin:14px 0 0;font-family:${font};font-size:36px;line-height:1.12;font-weight:700;color:${C.white};text-align:center;letter-spacing:-1px;">${html}</h1>`
  const card = (inner: string, border = C.line, bg = C.card) => `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" bgcolor="${bg}" style="background:${bg};border-radius:22px;border:1px solid ${border};">${inner}</table>`
  const button = (href: string, label: string, bg: string, color: string) => `<table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center" style="margin:0 auto;"><tr>
      <td align="center" bgcolor="${bg}" style="background:${bg};border-radius:999px;mso-padding-alt:15px 30px;">
        <a href="${href}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${font};font-size:16px;font-weight:700;color:${color};text-decoration:none;border-radius:999px;mso-padding-alt:0;">${label}</a>
      </td></tr></table>`
  const flags: [string, string][] = [['&#127481;&#127479;', 'Türkisch'], ['&#127479;&#127480;', 'Serbisch'], ['&#127466;&#127480;', 'Spanisch'], ['&#127464;&#127475;', 'Chinesisch'], ['&#127472;&#127479;', 'Koreanisch']]
  const flagCell = ([f, l]: [string, string]) => `<td width="20%" align="center" valign="top" style="padding:14px 2px 16px;">
      <div style="font-size:34px;line-height:40px;">${f}</div>
      <div class="fs-flag" style="margin-top:6px;font-family:${font};font-size:12.5px;font-weight:700;color:${C.white};">${l}</div></td>`
  const bar = (n: number, pct: number, amount: string, top = false) => `<tr>
      <td width="92" valign="middle" style="padding:${top ? 0 : 12}px 10px 0 0;font-family:${font};font-size:14px;color:${C.body};white-space:nowrap;">${n} Kunden</td>
      <td valign="middle" style="padding:${top ? 0 : 12}px 0 0;">
        <table width="${pct}%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td height="12" bgcolor="${pct === 100 ? C.green : C.violet}" style="height:12px;font-size:0;line-height:0;border-radius:6px;background:${pct === 100 ? C.green : C.violet};">&nbsp;</td></tr></table>
      </td>
      <td width="86" align="right" valign="middle" style="padding:${top ? 0 : 12}px 0 0 10px;font-family:${font};font-size:14px;font-weight:700;color:${pct === 100 ? C.green : C.white};white-space:nowrap;">${amount}&nbsp;€</td></tr>`
  const half = (title: string, body: string) => `<td width="50%" valign="top" bgcolor="${C.card2}" style="padding:16px 16px 18px;background:${C.card2};border-radius:16px;">
      <p style="margin:0;font-family:${font};font-size:11.5px;font-weight:700;letter-spacing:1px;color:${C.muted};">${title}</p>
      <p style="margin:6px 0 0;font-family:${font};font-size:15px;line-height:1.4;font-weight:700;color:${C.white};">${body}</p></td>`

  const footer = prefs
    ? `Du bekommst diese Mail, weil du ein FinestSites-Konto hast und „${prefs.categoryLabel}“ erhalten möchtest.<br />
       <a href="${prefs.unsubscribeUrl}" style="color:${C.muted};text-decoration:underline;">Diese Mails abbestellen</a> &nbsp;·&nbsp;
       <a href="${prefs.settingsUrl}" style="color:${C.muted};text-decoration:underline;">E-Mail-Einstellungen</a> &nbsp;·&nbsp;
       <a href="mailto:info@finestsites.io" style="color:${C.muted};text-decoration:underline;">Support</a><br />
       FinestSites · Daniel Kurzeja · <a href="https://finestsites.io/impressum" style="color:${C.muted};text-decoration:underline;">Impressum</a>`
    : `© ${new Date().getFullYear()} FinestSites &nbsp;·&nbsp; <a href="mailto:info@finestsites.io" style="color:${C.muted};text-decoration:underline;">Support</a>`

  const linkBlock = link
    ? `${text('Dein persönlicher Empfehlungslink', `font-size:13px;font-weight:700;letter-spacing:1px;color:${C.muted};`)}
       <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:10px 0 0;"><tr>
         <td align="center" bgcolor="${C.card2}" style="padding:16px 12px;background:${C.card2};border-radius:14px;border:1px dashed #4A3A80;font-family:${font};font-size:17px;font-weight:700;color:${C.accent};word-break:break-all;">
           <a href="${link}" target="_blank" style="color:${C.accent};text-decoration:none;">${link.replace('https://', '')}</a>
         </td></tr></table>
       ${text('Einfach kopieren und an deine Kontakte schicken.', `margin-top:12px;font-size:14px;color:${C.muted};`)}
       <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td height="22" style="height:22px;font-size:0;line-height:0;">&nbsp;</td></tr></table>
       ${button(`${APP_URL}/affiliate`, 'Gutschriften und alle Infos', C.white, '#000000')}`
    : `${button(`${APP_URL}/affiliate`, 'Meinen Empfehlungslink holen', C.white, '#000000')}`

  return `<!DOCTYPE html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${UPDATE_2026_11_SUBJECT}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <style>* { font-family: Arial, Helvetica, sans-serif !important; }</style><![endif]-->
  <style>
    @media screen {
      @font-face { font-family: 'Plus Jakarta Sans'; font-weight: 400 700; font-style: normal;
        src: url('${APP_URL}/fonts/PlusJakartaSans-latin.woff2') format('woff2'); }
    }
    :root { color-scheme: dark; supported-color-schemes: dark; }
    body { margin:0 !important; padding:0 !important; width:100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    u + #body a { color: inherit; text-decoration: none; }
    @media screen and (max-width: 480px) { .fs-h1 { font-size: 30px !important; letter-spacing: -0.6px !important; } .fs-big { font-size: 64px !important; } .fs-lead { font-size: 16px !important; } }
    @media screen and (max-width: 360px) { .fs-h1 { font-size: 26px !important; } }
    @media screen and (max-width: 400px) { .fs-flag { font-size: 11px !important; } .fs-pad { padding-left: 20px !important; padding-right: 20px !important; } }
  </style>
</head>
<body id="body" bgcolor="${C.bg}" style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:${C.bg};">${UPDATE_2026_11_PREHEADER}${'&#847;&zwnj;&nbsp;'.repeat(60)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" bgcolor="${C.bg}" style="background:${C.bg};">
    <tr><td align="center" style="padding:40px 0 48px;">
      <!--[if mso]><table width="560" cellpadding="0" cellspacing="0" border="0" role="presentation" align="center"><tr><td><![endif]-->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:560px;width:100%;">

        ${row(`<img src="${APP_LAUNCH_ASSETS}/logo-white.png" alt="FinestSites" width="120" height="25" style="display:block;margin:0 auto;width:120px;height:auto;border:0;outline:none;color:${C.white};font-family:${font};font-size:20px;font-weight:700;text-align:center;" />`)}
        ${space(40)}

        ${row(`${kicker('UPDATE 1 VON 2')}
               ${h1(`Deine Seiten sprechen<br />jetzt <span style="color:${C.accent};white-space:nowrap;">13 Sprachen.</span>`)}
               ${text(`${name ? `Hey ${name}, deine` : 'Deine'} ${nw('Optimalset-Seite')}, ${nw('PM-Business-Seite')} und ${nw('cellRESET-Seite')} gibt es ab sofort in 13 Sprachen. Genau dort, wo gerade besonders viele neue Teampartner dazukommen.`, 'margin-top:18px;font-size:17px;', 'fs-lead')}`)}
        ${space(28)}
        ${row(card(`<tr><td colspan="5" style="padding:18px 18px 0;font-family:${font};font-size:11.5px;font-weight:700;letter-spacing:1.5px;color:${C.muted};text-align:center;">NEU DAZUGEKOMMEN</td></tr>
          <tr>${flags.map(flagCell).join('')}</tr>
          <tr><td colspan="5" style="padding:0 18px 18px;font-family:${font};font-size:13px;line-height:1.55;color:${C.muted};text-align:center;">Außerdem: Deutsch, Englisch, Italienisch, Russisch, Ukrainisch, Polnisch, Bulgarisch und Hindi</td></tr>`))}
        ${space(18)}
        ${row(text(`<span style="color:${C.green};font-weight:700;">&#10003;</span>&nbsp;Läuft automatisch, inklusive Video und ${nw('Über-mich-Text')}.<br /><strong style="color:${C.white};">Du musst nichts tun.</strong>`, 'font-size:15px;'))}
        ${space(56)}

        ${row(`${kicker('UPDATE 2 VON 2')}
               ${h1(`Empfiehl FinestSites.<br /><span style="color:${C.accent};">Dein Abo zahlt<br />sich selbst.</span>`)}
               ${text('Immer mehr von euch fragen mich danach.<br />So einfach geht es:', 'margin-top:18px;font-size:17px;', 'fs-lead')}`)}
        ${space(28)}
        ${row(card(`<tr><td style="padding:26px 22px 8px;" align="center">
            <p class="fs-big" style="margin:0;font-family:${font};font-size:72px;line-height:1;font-weight:700;color:${C.green};letter-spacing:-2px;">0&nbsp;€</p>
            <p style="margin:10px 0 0;font-family:${font};font-size:16px;line-height:1.45;color:${C.white};font-weight:700;">kostet dich dein ${nw('Pro-Abo')}<br />ab 12 empfohlenen ${nw('Pro-Kunden')}</p>
          </td></tr>
          <tr><td style="padding:22px 22px 6px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
              ${bar(3, 25, u11Commission(3), true)}
              ${bar(6, 50, u11Commission(6))}
              ${bar(12, 100, u11Commission(12))}
            </table>
            <p style="margin:12px 0 0;font-family:${font};font-size:12.5px;line-height:1.5;color:${C.muted};">Gutschrift pro Monat, gerechnet mit Pro im Monatsabo (27&nbsp;€). Du bekommst 10&nbsp;% vom Nettobetrag, automatisch mit deinem Abo verrechnet.</p>
          </td></tr>
          <tr><td style="padding:16px 14px 14px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>
              ${half('DU BEKOMMST', `10&nbsp;% von jeder Zahlung, solange sie Kunde sind`)}
              <td width="10" style="width:10px;font-size:0;">&nbsp;</td>
              ${half('DEINE KONTAKTE', `20&nbsp;% auf den ersten Monat oder 10&nbsp;% im ${nw('Jahresabo')}`)}
            </tr></table>
          </td></tr>`))}
        ${space(28)}
        ${row(linkBlock)}
        ${space(56)}

        ${row(card(`<tr><td style="padding:22px 22px 24px;">
            <p style="margin:0;font-family:${font};font-size:17px;font-weight:700;color:${C.amber};">P.S. an alle Android-Tester &#128591;</p>
            <p style="margin:8px 0 0;font-family:${font};font-size:15px;line-height:1.55;color:${C.body};">Danke für die vielen Rückmeldungen! Wir setzen gerade alles technisch um, und Google macht es uns dabei nicht ganz leicht. Ich melde mich selbstverständlich bei jedem von euch persönlich. <strong style="color:${C.white};">Bitte habt noch ein bisschen Geduld.</strong></p>
          </td></tr>`, '#5C4520'))}
        ${space(40)}

        ${row(`${text(`Fragen? Antworte einfach auf diese Mail,<br />ich lese alles selbst.`)}
               ${text('Daniel von FinestSites', `margin-top:10px;color:${C.white};font-weight:700;`)}`)}
        ${space(40)}
        ${row(`<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td style="padding-top:24px;border-top:1px solid ${C.line};font-family:${font};font-size:12px;line-height:1.7;color:${C.muted};text-align:center;">${footer}</td></tr></table>`)}

      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`
}

export function update202611Text({ firstName, username, prefs }: { firstName?: string; username?: string | null; prefs?: PrefsFooter }): string {
  const name = launchFirstName(firstName)
  const link = u11RefLink(username)
  return [
    'Wieder mal ein Update!',
    '',
    'UPDATE 1 VON 2: Deine Seiten sprechen jetzt 13 Sprachen',
    '',
    `${name ? `Hey ${name}, deine` : 'Deine'} Optimalset-Seite, PM-Business-Seite und cellRESET-Seite gibt es ab sofort in 13 Sprachen. Genau dort, wo gerade besonders viele neue Teampartner dazukommen.`,
    '',
    `Neu dazugekommen: ${U11_NEW_LANGS.join(', ')}`,
    `Außerdem: ${U11_OLD_LANGS.join(', ')}`,
    '',
    'Besucher sehen deine Seite automatisch in ihrer Sprache, inklusive Video und deinem Über-mich-Text. Du musst nichts tun.',
    '',
    'UPDATE 2 VON 2: Empfiehl FinestSites. Dein Abo zahlt sich selbst.',
    '',
    'Du bekommst: 10 % von jeder Zahlung, solange die Person Kunde ist.',
    'Deine Empfehlung bekommt: 20 % auf den ersten Monat oder 10 % dauerhaft im Jahresabo.',
    '',
    'Ein Rechenbeispiel (Pro im Monatsabo, 10 % vom Nettobetrag):',
    `3 Empfehlungen mit Pro: ${u11Commission(3)} € im Monat`,
    `6 Empfehlungen mit Pro: ${u11Commission(6)} € im Monat`,
    `12 Empfehlungen mit Pro: ${u11Commission(12)} € im Monat`,
    'Bei 12 Empfehlungen ist dein eigenes Pro-Abo (27 € im Monat) komplett bezahlt. Die Gutschrift wird automatisch mit deinem Abo verrechnet.',
    '',
    link ? `Dein persönlicher Empfehlungslink: ${link}` : `Deinen Empfehlungslink findest du hier: ${APP_URL}/affiliate`,
    `Gutschriften und alle Infos: ${APP_URL}/affiliate`,
    '',
    'Fragen? Antworte einfach auf diese Mail, ich lese alles selbst.',
    'Viele Grüße',
    'Daniel von FinestSites',
    '',
    'P.S. an alle Android-Tester: Danke für die vielen Rückmeldungen! Wir setzen gerade alles technisch um, und Google macht es uns dabei nicht ganz leicht. Ich melde mich selbstverständlich bei jedem von euch persönlich. Bitte habt noch ein bisschen Geduld.',
    '',
    '---',
    ...(prefs ? [`Diese Mails abbestellen: ${prefs.unsubscribeUrl}`, `E-Mail-Einstellungen: ${prefs.settingsUrl}`] : []),
    'Impressum: https://finestsites.io/impressum',
  ].join('\n')
}

// ─── Partner-Auszahlungen: Sammelhinweis an den Admin (seit 16.10.2026) ───────
// Eine Mail pro Lauf (Cron/Admin/Wartung), nie pro Partner. Nur an ADMIN_EMAIL.
export function affiliatePayoutAdminAlertEmail({ context, paidCount, items }: {
  context: string
  paidCount: number
  items: { partner: string; problem: string; detail?: string }[]
}): string {
  const rows = items.map(i => `
    <tr>
      <td style="padding:10px 0;border-top:1px solid ${base.border};font-size:14px;color:${base.heading};font-weight:600;vertical-align:top;">${escapeHtml(i.partner)}</td>
      <td style="padding:10px 0 10px 16px;border-top:1px solid ${base.border};font-size:14px;color:${base.body};line-height:1.5;vertical-align:top;">
        ${escapeHtml(i.problem)}${i.detail ? `<br /><span style="font-size:12px;color:${base.muted};">${escapeHtml(i.detail)}</span>` : ''}
      </td>
    </tr>`).join('')
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      Partner-Auszahlungen: bitte kurz ansehen
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:${base.body};line-height:1.65;">
      Lauf: ${escapeHtml(context)}. Ausgezahlt oder verrechnet: ${paidCount}. Hinweise: ${items.length}.
    </p>
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%">${rows}</table>
    ${button(`${APP_URL}/admin/gutschriften`, 'Gutschriften im Admin ansehen')}
  `)
}

// ─── Konto löschen (Kategorie system) ─────────────────────────────────────────

function deletionPara(html: string, last = false): string {
  return `<p style="margin:0 0 ${last ? 24 : 16}px;font-size:15px;color:${base.body};line-height:1.65;">${html}</p>`
}

/** Bestätigung der Lösch-Anfrage: Datum, was sofort passiert ist, wie man abbricht. */
export function accountDeletionRequestedEmail({ scheduledFor, balanceNote, mode = 'now' }: { scheduledFor: string; balanceNote?: string | null; mode?: 'now' | 'period_end' }): string {
  const periodEnd = mode === 'period_end'
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      Dein Konto wird am ${scheduledFor} gelöscht
    </h1>
    ${periodEnd
      ? deletionPara('Du hast die Löschung deines FinestSites-Kontos zum Ende deiner Laufzeit angefragt. Das bedeutet:')
      : deletionPara('Du hast die Löschung deines FinestSites-Kontos angefragt. Das haben wir sofort erledigt:')}
    <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;color:${base.body};line-height:1.65;">
      ${periodEnd ? `
      <li>Dein Abo ist zum <strong>${scheduledFor}</strong> gekündigt. Es wird nichts mehr abgebucht; bereits bezahlte Zeit wird nicht erstattet.</li>
      <li>Deine Webseiten bleiben bis dahin online, dein Konto kannst du bis dahin wie gewohnt nutzen.</li>
      <li>Du bleibst angemeldet.</li>` : `
      <li>Deine Webseiten sind offline.</li>
      <li>Dein Abo ist beendet. Es wird nichts mehr abgebucht; bereits bezahlte Zeit wird nicht erstattet.</li>
      <li>Du bist auf allen Geräten abgemeldet.</li>`}
    </ul>
    ${deletionPara(`Am <strong>${scheduledFor}</strong> löschen wir dein Konto, deine Seiten, Anfragen und Bilder endgültig. Deinen Benutzernamen vergeben wir nicht neu.`)}
    ${balanceNote ? deletionPara(balanceNote) : ''}
    ${periodEnd
      ? deletionPara('Du hast es dir anders überlegt? Klicke bis dahin im Dashboard oder in der App auf „Löschung abbrechen“ – dann läuft dein Abo einfach weiter wie vorher.', true)
      : deletionPara('Du hast es dir anders überlegt? Melde dich bis dahin einfach wieder an und klicke auf „Löschung abbrechen“. Deine Seiten kannst du danach wieder veröffentlichen. Ein beendetes Abo musst du neu abschließen.', true)}
    ${button(periodEnd ? `${APP_URL}/sites` : `${APP_URL}/login`, periodEnd ? 'Zum Dashboard' : 'Anmelden und Löschung abbrechen')}
    <p style="margin:28px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Das warst nicht du? Dann melde dich bitte sofort unter <a href="mailto:info@finestsites.io" style="color:${base.muted};">info@finestsites.io</a>.
    </p>
  `)
}

/** Bestätigung, dass die Löschung abgebrochen wurde. */
export function accountDeletionCancelledEmail({ subscriptionContinues = false, sitesOffline = true }: { subscriptionContinues?: boolean; sitesOffline?: boolean } = {}): string {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      Dein Konto bleibt bestehen
    </h1>
    ${deletionPara('Du hast die Löschung deines FinestSites-Kontos abgebrochen. Deine Daten bleiben erhalten.')}
    ${subscriptionContinues
      ? deletionPara('Die Kündigung deines Abos haben wir zurückgenommen – es läuft weiter wie vorher, deine Webseiten bleiben online.', true)
      : deletionPara(`${sitesOffline ? 'Deine Webseiten sind noch offline. Du kannst sie im Dashboard jederzeit wieder veröffentlichen. ' : ''}Dein früheres Abo ist beendet und läuft nicht von selbst weiter.`, true)}
    ${button(`${APP_URL}/sites`, 'Zu meinen Seiten')}
    <p style="margin:28px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Das warst nicht du? Dann melde dich bitte sofort unter <a href="mailto:info@finestsites.io" style="color:${base.muted};">info@finestsites.io</a>.
    </p>
  `)
}

/** Interner Hinweis an den Admin (Stripe-Fehler, Schlussauszahlung, Guthaben auf Anfrage). */
export function accountDeletionAdminEmail({ title, text }: { title: string; text: string }): string {
  const esc = text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!)).replace(/\n/g, '<br>')
  return layout(`
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">${title}</h1>
    ${deletionPara(esc, true)}
    ${button(`${APP_URL}/admin/users`, 'Nutzer im Admin ansehen')}
  `)
}

/** Letzte Mail nach der Löschung (geht noch an die alte Adresse, danach ist sie aus dem Konto gelöscht). */
// ─── Besucher-Chat (docs/chat/konzept.md) ──────────────────────────────────────

/** Antwort-Mail an den Besucher: Betreiber hat geantwortet, Knopf „Chat öffnen“ (Resume-Link). Kategorie system. */
export function chatReplyEmail({ ownerName, preview, openUrl, unsubscribeUrl, siteHost }: {
  ownerName: string; preview: string; openUrl: string; unsubscribeUrl: string; siteHost: string
}): string {
  const name = escapeHtml(ownerName)
  const text = escapeHtml(preview)
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      ${name} hat dir geantwortet
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:${base.body};line-height:1.65;">
      Du hast auf ${escapeHtml(siteHost)} eine Nachricht geschrieben. Hier ist die Antwort:
    </p>
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
      <tr>
        <td style="background:${base.bg};border-radius:14px;padding:16px 18px;font-size:15px;color:${base.heading};line-height:1.6;">
          ${text}
        </td>
      </tr>
    </table>
    ${button(openUrl, 'Chat öffnen')}
    ${fallbackLink(openUrl)}
    <p style="margin:28px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Du bekommst diese E-Mail, weil du im Chat „Antworten per E-Mail erhalten“ eingeschaltet hast.
      <a href="${unsubscribeUrl}" style="color:${base.muted};text-decoration:underline;">Keine E-Mails mehr zu diesem Chat</a>
    </p>
  `)
}

/** Vom Besucher angeforderter Link, um das Gespräch in einem anderen Browser/Gerät fortzusetzen. */
export function chatHandoffEmail({ ownerName, openUrl, siteHost, validDays }: {
  ownerName: string; openUrl: string; siteHost: string; validDays: number
}): string {
  const name = escapeHtml(ownerName)
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      Dein Chat mit ${name}
    </h1>
    <p style="margin:0 0 0;font-size:15px;color:${base.body};line-height:1.65;">
      Du hast dir im Chat auf ${escapeHtml(siteHost)} diesen Link schicken lassen. Damit kommst du auf jedem Gerät
      und in jedem Browser wieder in euer Gespräch.
    </p>
    ${button(openUrl, 'Chat fortsetzen')}
    ${fallbackLink(openUrl)}
    <p style="margin:28px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Der Link ist ${validDays} Tage gültig und kann einmal benutzt werden. Wer ihn hat, kann das Gespräch lesen – gib ihn
      deshalb nicht weiter. Du bekommst diese E-Mail, weil du im Chat auf „Chat-Link per E-Mail schicken“ getippt hast.
    </p>
  `)
}

/** Meldung eines Gesprächs an FinestSites (info@finestsites.io): Konto, Seite, Grund, letzte Nachrichten. */
export function chatReportEmail({ reasonLabel, note, accountLabel, siteLabel, conversationId, blocked, adminUrl, messages }: {
  reasonLabel: string
  note: string | null
  accountLabel: string
  siteLabel: string
  conversationId: string
  blocked: boolean
  adminUrl: string
  messages: { sender: string; body: string; at: string }[]
}): string {
  const rows = messages.length === 0
    ? `<tr><td style="font-size:14px;color:${base.muted};">Keine Nachrichten.</td></tr>`
    : messages.map(m => `
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid ${base.border};vertical-align:top;font-size:12px;color:${base.muted};white-space:nowrap;">${escapeHtml(m.at)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid ${base.border};vertical-align:top;font-size:12px;font-weight:600;color:${base.heading};white-space:nowrap;">${escapeHtml(m.sender)}</td>
        <td style="padding:6px 0;border-bottom:1px solid ${base.border};vertical-align:top;font-size:14px;color:${base.body};line-height:1.5;">${escapeHtml(m.body).replace(/\n/g, '<br />')}</td>
      </tr>`).join('')
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      Chat gemeldet: ${escapeHtml(reasonLabel)}
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      <strong>Konto:</strong> ${escapeHtml(accountLabel)}<br />
      <strong>Seite:</strong> ${escapeHtml(siteLabel)}<br />
      <strong>Gespräch:</strong> ${escapeHtml(conversationId)}<br />
      <strong>Besucher gesperrt:</strong> ${blocked ? 'ja' : 'nein'}
      ${note ? `<br /><strong>Hinweis:</strong> ${escapeHtml(note)}` : ''}
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:${base.muted};">Letzte Nachrichten (älteste zuerst):</p>
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%">${rows}</table>
    ${button(adminUrl, 'Im Admin ansehen')}
  `)
}

export function accountDeletionCompletedEmail({ keptNote, balanceNote }: { keptNote: string; balanceNote?: string | null }): string {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      Dein Konto ist gelöscht
    </h1>
    ${deletionPara('Wir haben dein FinestSites-Konto, deine Webseiten, Anfragen, Bilder und Support-Nachrichten gelöscht. Eigene Domains sind von FinestSites getrennt.')}
    ${deletionPara(keptNote, !balanceNote)}
    ${balanceNote ? deletionPara(balanceNote, true) : ''}
    <p style="margin:28px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Danke, dass du FinestSites genutzt hast. Fragen? <a href="mailto:info@finestsites.io" style="color:${base.muted};">info@finestsites.io</a>
    </p>
  `)
}
