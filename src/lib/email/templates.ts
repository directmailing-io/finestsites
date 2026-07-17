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
  return `<table cellpadding="0" cellspacing="0" role="presentation" width="100%">
              <tr>
                <td align="center" style="padding-bottom:28px;">
                  <img src="${APP_URL}/logos/logo-black.svg" alt="FinestSites" height="22" style="height:22px;width:auto;display:block;" />
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

export function paymentFailedEmail({ invoiceUrl }: { invoiceUrl?: string }): string {
  const billingUrl = invoiceUrl ?? `${APP_URL}/billing`
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.02em;">
      Kurze Info zu deiner Zahlung
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Deine letzte Zahlung hat leider nicht geklappt. Keine Panik, deine Seiten laufen noch ganz normal und du hast <strong>14 Tage Zeit</strong>, das zu klären.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:${base.body};line-height:1.65;">
      Schau kurz nach, ob deine Karte noch gültig ist oder genug Guthaben drauf hat. Stripe versucht die Zahlung automatisch nochmal einzuziehen.
    </p>
    ${button(billingUrl, 'Zahlung klären')}
    <p style="margin:28px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Wenn nach 14 Tagen noch nichts eingegangen ist, schalten wir dein Konto leider ab. Bei Fragen schreib uns einfach: <a href="mailto:support@finestsites.de" style="color:${base.muted};">support@finestsites.de</a>
    </p>
  `)
}

export function paymentWarningEmail({ daysLeft, invoiceUrl }: { daysLeft: number; invoiceUrl?: string }): string {
  const billingUrl = invoiceUrl ?? `${APP_URL}/billing`
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.02em;">
      Noch ${daysLeft} Tage, dann schalten wir ab
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:${base.body};line-height:1.65;">
      Die offene Zahlung konnte bisher nicht eingezogen werden. In <strong>${daysLeft} Tagen</strong> gehen deine Webseiten leider offline, wenn das nicht geklärt ist.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:${base.body};line-height:1.65;">
      Aktualisier kurz deine Zahlungsmethode oder stell sicher, dass genug auf dem Konto ist. Das reicht schon.
    </p>
    ${button(billingUrl, 'Jetzt klären')}
    <p style="margin:28px 0 0;font-size:13px;color:${base.muted};line-height:1.6;">
      Sobald die Zahlung klappt, bleibt alles wie gewohnt aktiv. Fragen? <a href="mailto:support@finestsites.de" style="color:${base.muted};">support@finestsites.de</a>
    </p>
  `)
}

/** Sent when payment failure leads to deactivation after 14-day grace period */
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
      Das Gute: Alle deine Inhalte, Texte und Bilder sind noch da. Wenn du jetzt zahlst, sind deine Seiten sofort wieder online. Du musst nichts neu aufbauen.
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
      ${greeting} herzlich Willkommen bei FinestSites.
    </h1>
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
