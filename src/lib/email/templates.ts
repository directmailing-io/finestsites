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

function layout(content: string): string {
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

        <!-- Card -->
        <tr>
          <td style="background:${base.card};border-radius:20px;padding:40px 40px 36px;border:1px solid ${base.border};">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 0 0;text-align:center;">
            <p style="margin:0;font-size:12px;color:${base.footer};line-height:1.6;">
              © ${new Date().getFullYear()} FinestSites &nbsp;·&nbsp;
              <a href="mailto:support@finestsites.de" style="color:${base.footer};text-decoration:underline;">Support</a>
            </p>
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

export function newsletterEmail({
  subject,
  bodyHtml,
  unsubscribeUrl,
}: {
  subject: string
  bodyHtml: string
  unsubscribeUrl?: string
}): string {
  const footer = unsubscribeUrl
    ? `<tr><td style="padding:24px 0 0;text-align:center;">
        <p style="margin:0;font-size:12px;color:${base.footer};line-height:1.6;">
          © ${new Date().getFullYear()} FinestSites &nbsp;·&nbsp;
          <a href="${unsubscribeUrl}" style="color:${base.footer};text-decoration:underline;">Abmelden</a>
          &nbsp;·&nbsp;
          <a href="mailto:support@finestsites.de" style="color:${base.footer};text-decoration:underline;">Support</a>
        </p>
      </td></tr>`
    : `<tr><td style="padding:24px 0 0;text-align:center;">
        <p style="margin:0;font-size:12px;color:${base.footer};line-height:1.6;">
          © ${new Date().getFullYear()} FinestSites &nbsp;·&nbsp;
          <a href="mailto:support@finestsites.de" style="color:${base.footer};text-decoration:underline;">Support</a>
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
      Bei Fragen erreichst du uns jederzeit unter <a href="mailto:support@finestsites.de" style="color:${base.muted};">support@finestsites.de</a>.
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
      Bei Fragen erreichst du uns unter <a href="mailto:support@finestsites.de" style="color:${base.muted};">support@finestsites.de</a>.
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
      Fragen? <a href="mailto:support@finestsites.de" style="color:${base.muted};">support@finestsites.de</a>
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
      Schon bezahlt? Dann ignorier diese Mail. Bei SEPA dauert die Bestätigung ein paar Tage, deine Seite bleibt so lange online. Fragen? <a href="mailto:support@finestsites.de" style="color:${base.muted};">support@finestsites.de</a>
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
      Bleibt die Zahlung bis zum ${deadline} aus, pausieren wir dein Konto und beenden das Abo. Deine Daten bleiben danach noch 90 Tage gespeichert. Fragen? <a href="mailto:support@finestsites.de" style="color:${base.muted};">support@finestsites.de</a>
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
      Fragen? <a href="mailto:support@finestsites.de" style="color:${base.muted};">support@finestsites.de</a>
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
      Fragen? <a href="mailto:support@finestsites.de" style="color:${base.muted};">support@finestsites.de</a>
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
      Hast du ein Problem mit der Zahlung? Schreib uns einfach direkt: <a href="mailto:support@finestsites.de" style="color:${base.muted};">support@finestsites.de</a>. Wir finden eine Lösung.
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
      War etwas nicht in Ordnung? Wir sind ehrlich interessiert, was wir besser machen können: <a href="mailto:support@finestsites.de" style="color:${base.muted};">support@finestsites.de</a>
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
      Schade, dass du gehst. Falls du Feedback hast oder wir was besser machen koennen: <a href="mailto:support@finestsites.de" style="color:${base.muted};">support@finestsites.de</a>
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
      Dein Account ist freigeschaltet. Du kannst jetzt deine erste Website erstellen und sie in nur wenigen Minuten live schalten. Bei Fragen schreib uns jederzeit <a href="mailto:support@finestsites.de" style="color:${base.body};">support@finestsites.de</a>
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
