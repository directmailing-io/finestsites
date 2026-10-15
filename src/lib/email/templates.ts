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

function button(url: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:32px 0 0;">
    <tr>
      <td style="background:${base.buttonBg};border-radius:12px;">
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
  planLabel,
}: {
  refereeEmail: string
  planLabel: string
}): string {
  const affiliateUrl = `${APP_URL}/affiliate`
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
          <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:${base.heading};">${refereeEmail}</p>
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
  planLabel,
  firstName,
}: {
  refereeEmail: string
  planLabel: string
  firstName?: string | null
}): string {
  const greeting = firstName ? `Hey ${firstName},` : 'Hey,'
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
          <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:${base.heading};">${refereeEmail}</p>
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
}: {
  amountCents: number
  commissionCount: number
}): string {
  const amount = (amountCents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
  const affiliateUrl = `${APP_URL}/affiliate`
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;">
      Deine Provision wurde ausgezahlt
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:${base.body};line-height:1.65;">
      Wir haben soeben eine Auszahlung an dein verknüpftes Konto vorgenommen.
    </p>
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin:0 0 24px;">
      <tr>
        <td style="background:#F0FDF4;border-radius:12px;padding:20px 24px;border:1px solid #BBF7D0;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#15803D;text-transform:uppercase;letter-spacing:0.06em;">Ausgezahlter Betrag</p>
          <p style="margin:0;font-size:28px;font-weight:800;color:#15803D;letter-spacing:-0.02em;">${amount}</p>
          <p style="margin:8px 0 0;font-size:13px;color:#16A34A;">${commissionCount} Provision${commissionCount !== 1 ? 'en' : ''}</p>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:14px;color:${base.muted};line-height:1.65;">
      Der Betrag wird in Kürze auf deinem verknüpften Bankkonto gutgeschrieben. Die genaue Dauer hängt von deiner Bank ab.
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
export function upcomingDebitEmail({ amount, date, last4 }: { amount: string; date: string; last4: string | null }): string {
  const settingsUrl = `${APP_URL}/settings`
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.02em;">
      Am ${date} buchen wir ${amount} ab
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Kurze Erinnerung: Dein FinestSites-Abo verlängert sich am ${date}. Wir ziehen ${amount} per SEPA-Lastschrift${last4 ? ` von deinem Konto •••• ${last4}` : ''} ein.
    </p>
    <p style="margin:0 0 8px;font-size:15px;color:${base.body};line-height:1.65;">
      Bitte sorg dafür, dass das Konto an dem Tag gedeckt ist. Eine geplatzte Lastschrift kostet dich bei deiner Bank Gebühren. Du musst sonst nichts tun.
    </p>
    ${button(settingsUrl, 'Zahlungsmethode prüfen')}
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
export function accountExpiredEmail(): string {
  const billingUrl = `${APP_URL}/billing`
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.02em;">
      Dein Abo ist ausgelaufen
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Deine Abonnementlaufzeit ist jetzt abgelaufen. Deine Webseiten sind offline, aber alle deine Inhalte sind noch <strong>90 Tage</strong> bei uns gespeichert.
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
export function accountCanceledEmail({ periodEnd }: { periodEnd: string }): string {
  const billingUrl = `${APP_URL}/billing`
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.02em;">
      Dein Abo wurde gekündigt
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Du hast dein FinestSites-Abo gekündigt. Bis zum <strong>${periodEnd}</strong> läuft aber alles ganz normal weiter. Deine Seiten sind online und du hast vollen Zugriff.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:${base.body};line-height:1.65;">
      Danach gehen deine Seiten offline. Deine Daten bleiben noch 90 Tage gespeichert, falls du es dir doch anders überlegst.
    </p>
    ${button(billingUrl, 'Abo weiter nutzen')}
    <p style="margin:28px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Schade, dass du gehst. Falls du Feedback hast oder wir was besser machen koennen: <a href="mailto:info@finestsites.io" style="color:${base.muted};">info@finestsites.io</a>
    </p>
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
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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
      Du kannst deine Einwilligung jederzeit widerrufen. Schreib uns dafür einfach eine E-Mail an hello@finestsites.io und wir nehmen deinen Bericht von allen Seiten runter.
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
    ? `<h2 style="margin:0 0 8px;font-size:19px;font-weight:700;color:${base.heading};letter-spacing:-0.01em;">Eine Seite ist gut. Drei sind besser.</h2>
       <p style="margin:0;font-size:15px;color:${base.body};line-height:1.65;">
         Du hast gerade eine Seite online. Mit Pro hast du drei, zum Beispiel Optimalset, Business und cellRESET. Jede Seite hat ihr eigenes Thema und spricht andere Leute an. Für 10\u202f€ mehr im Monat.
       </p>
       ${button(`${APP_URL}/settings?tab=zahlung`, 'Auf Pro wechseln')}`
    : segment === 'none'
    ? `<h2 style="margin:0 0 8px;font-size:19px;font-weight:700;color:${base.heading};letter-spacing:-0.01em;">Deine Seite in 5 Minuten online</h2>
       <p style="margin:0 0 14px;font-size:15px;color:${base.body};line-height:1.65;">
         Deine Seite wartet noch auf dich. So geht es los:
       </p>
       <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
         ${['Einloggen und deine Seite im Editor öffnen.', 'Name, Foto und Farbe eintragen.', 'Auf „Veröffentlichen“ tippen und Tarif wählen.'].map((t, i) => `
         <tr>
           <td width="30" valign="top" style="padding:0 10px 10px 0;"><div style="width:24px;height:24px;border-radius:50%;background:#F3EEF9;color:#6B4FA0;font-size:13px;font-weight:700;text-align:center;line-height:24px;">${i + 1}</div></td>
           <td valign="top" style="padding:2px 0 10px;font-size:15px;color:${base.body};line-height:1.5;">${t}</td>
         </tr>`).join('')}
       </table>
       <p style="margin:4px 0 0;font-size:14px;color:${base.muted};line-height:1.6;">Ab 17\u202f€ im Monat, jederzeit monatlich kündbar.</p>
       ${button(`${APP_URL}/sites`, 'Jetzt Seite online stellen')}`
    : null

  return layoutCards([
    `<p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8060b0;">Update</p>
     <h1 style="margin:0 0 12px;font-size:26px;font-weight:700;color:${base.heading};letter-spacing:-0.02em;line-height:1.2;">
       Es gibt wieder was Neues
     </h1>
     <p style="margin:0;font-size:15px;color:${base.body};line-height:1.65;">
       Hey ${name}, wir haben wieder an deiner Seite gebaut. Drei Sachen, die du ab sofort nutzen kannst. Kostet nichts extra.
     </p>`,
    card(1, 'Deine Business-Seite kann jetzt 8 Sprachen', 'sprachen.png', 'Business-Seite in 8 Sprachen',
      'Deutsch, Englisch, Italienisch, Russisch, Ukrainisch, Polnisch, Bulgarisch und Hindi. Kommt jemand aus Polen auf deine Seite, sieht er alles auf Polnisch. Auch deinen Über-mich-Text. Du musst dafür nichts machen.',
      'Läuft automatisch'),
    card(2, 'Deine Farbe, ganz genau', 'farben.png', 'Eigene Farbe mit Farbwähler und Farbcode',
      'Nicht mehr nur ein paar Vorgaben. Du suchst dir deine Farbe selbst aus, Punkt für Punkt im Farbwähler, oder du tippst deinen Farbcode ein (z.\u202fB. #D9468B). Danach ist die ganze Seite in deiner Farbe: Buttons, Überschriften, alles.',
      'Im Editor unter „Farbe“'),
    card(3, 'Neue Hintergrundbilder für deine Optimalset-Seite', 'hintergruende.png', 'Neue Hintergrundbilder',
      'Vier neue Bilder, vom Frühstück mit Orangensaft bis zum Sommer im Garten. Antippen, übernehmen, fertig.',
      'Im Editor unter „Hintergrundbild“'),
    ...(extra ? [extra] : []),
    // mit Zusatzkarte gibt es schon einen Button, dann nur noch der Gruß
    `${extra ? '' : `<h2 style="margin:0 0 8px;font-size:19px;font-weight:700;color:${base.heading};letter-spacing:-0.01em;">Probier es gleich aus</h2>
     <p style="margin:0;font-size:15px;color:${base.body};line-height:1.65;">
       Mach deine Seite im Editor auf, alles Neue ist schon drin.
     </p>
     ${button(`${APP_URL}/sites`, 'Zu meinen Seiten')}`}
     <p style="margin:${extra ? 0 : 28}px 0 0;font-size:15px;color:${base.body};line-height:1.65;">
       Fragen? Schreib mir einfach, ich lese alles selbst.
     </p>
     <p style="margin:14px 0 0;font-size:15px;color:${base.body};line-height:1.65;">
       Viele Grüße<br /><strong style="color:${base.heading};">Daniel von FinestSites</strong>
     </p>`,
  ], prefs)
}
