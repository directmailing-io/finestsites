/**
 * Waitlist e-mail templates — served via Resend.
 *
 * Design principles:
 *   - Off-white (#F5F3F0) outer background — matches brand aesthetic
 *   - White card, 20 px rounded, 1 px subtle border
 *   - Logo centred, 160 px wide via absolute URL (no attachment / inline base64)
 *   - System-font stack — renders natively in every client
 *   - Single accent colour: #8060b0 (brand purple)
 *   - Minimal — only what needs to be said, signed "Daniel von FinestSites"
 *   - Unsubscribe link in every outgoing e-mail (DSGVO / CAN-SPAM)
 */

const MARKETING_URL = 'https://finestsites.io'
const LOGO_URL = `${MARKETING_URL}/logos/logo-black.svg`

// ── Shared ────────────────────────────────────────────────────────────────────

function shell(body: string, unsubscribeUrl: string): string {
  return `<!DOCTYPE html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>FinestSites</title>
</head>
<body style="margin:0;padding:0;background:#F5F3F0;-webkit-text-size-adjust:100%;mso-line-height-rule:exactly;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
  style="background:#F5F3F0;padding:48px 16px 56px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" width="560"
      style="max-width:560px;width:100%;">

      <!-- Logo ---------------------------------------------------------------->
      <tr>
        <td align="center" style="padding-bottom:32px;">
          <a href="${MARKETING_URL}" style="display:inline-block;text-decoration:none;">
            <img src="${LOGO_URL}" alt="FinestSites" width="160"
              style="display:block;width:160px;height:auto;border:0;" />
          </a>
        </td>
      </tr>

      <!-- Card ---------------------------------------------------------------->
      <tr>
        <td style="background:#ffffff;border-radius:20px;border:1px solid #E8E4DE;
          padding:48px 48px 44px;mso-padding-alt:48px 48px 44px;">
          ${body}
        </td>
      </tr>

      <!-- Footer -------------------------------------------------------------->
      <tr>
        <td style="padding:28px 0 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#B0A89E;line-height:1.7;
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
            Du erhältst diese E-Mail, weil du dich auf die FinestSites-Warteliste eingetragen hast.<br />
            <a href="${unsubscribeUrl}"
              style="color:#B0A89E;text-decoration:underline;">Von der Warteliste abmelden</a>
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:32px 0 0;">
    <tr>
      <td style="background:#111111;border-radius:100px;padding:0;">
        <a href="${href}"
          style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:600;
          color:#ffffff;text-decoration:none;letter-spacing:-0.01em;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`
}

function divider(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
    style="margin:32px 0;">
    <tr><td style="border-top:1px solid #F0EDE8;height:1px;font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>`
}

function signoff(): string {
  return `${divider()}
  <p style="margin:0;font-size:14px;color:#6B6560;line-height:1.7;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    Beste Grüße,<br />
    <strong style="color:#111111;">Daniel von FinestSites</strong>
  </p>`
}

// ── Template 1 — Double-Opt-in Bestätigung ────────────────────────────────────

export function waitlistConfirmEmail({
  name,
  confirmUrl,
  unsubscribeUrl,
}: {
  name: string | null
  confirmUrl: string
  unsubscribeUrl: string
}): { subject: string; html: string } {
  const greeting = name ? `Hallo ${name.split(' ')[0]},` : 'Hallo,'

  const body = `
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#111111;
      letter-spacing:-0.03em;line-height:1.2;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      Fast geschafft ✦
    </h1>
    <p style="margin:16px 0 0;font-size:15px;color:#555047;line-height:1.75;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      ${greeting}
    </p>
    <p style="margin:12px 0 0;font-size:15px;color:#555047;line-height:1.75;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      Du hast dich für die FinestSites-Warteliste eingetragen. Bitte bestätige kurz
      deine E-Mail-Adresse — dann bist du dabei und bekommst als Erste/r Bescheid,
      wenn wir live gehen.
    </p>
    ${button('E-Mail bestätigen →', confirmUrl)}
    <p style="margin:20px 0 0;font-size:12px;color:#B0A89E;line-height:1.6;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      Der Link ist 7 Tage gültig. Falls du dich nicht angemeldet hast,
      kannst du diese E-Mail einfach ignorieren.
    </p>
    ${signoff()}
  `

  return {
    subject: 'Bestätige deine Anmeldung – FinestSites Warteliste',
    html: shell(body, unsubscribeUrl),
  }
}

// ── Template 2 — Willkommen (nach Bestätigung) ────────────────────────────────

export function waitlistWelcomeEmail({
  name,
  unsubscribeUrl,
}: {
  name: string | null
  unsubscribeUrl: string
}): { subject: string; html: string } {
  const greeting = name ? `Hallo ${name.split(' ')[0]},` : 'Hallo,'

  const body = `
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#111111;
      letter-spacing:-0.03em;line-height:1.2;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      Du bist dabei. 🎉
    </h1>
    <p style="margin:16px 0 0;font-size:15px;color:#555047;line-height:1.75;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      ${greeting}
    </p>
    <p style="margin:12px 0 0;font-size:15px;color:#555047;line-height:1.75;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      Deine E-Mail-Adresse ist bestätigt. Du stehst jetzt auf unserer Warteliste
      und wirst als eine der Ersten informiert, sobald FinestSites live geht —
      inklusive eines exklusiven Frühzugangs-Angebots.
    </p>
    <p style="margin:12px 0 0;font-size:15px;color:#555047;line-height:1.75;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      Wir melden uns bald.
    </p>
    ${signoff()}
  `

  return {
    subject: 'Du stehst auf der Liste – FinestSites',
    html: shell(body, unsubscribeUrl),
  }
}

// ── Template 3 — Broadcast (frei gestaltbar aus dem Admin-Panel) ──────────────

export function waitlistBroadcastEmail({
  subject,
  bodyHtml,
  unsubscribeUrl,
}: {
  subject: string
  bodyHtml: string   // plain text paragraphs — wrapped in <p> by the sender
  unsubscribeUrl: string
}): { subject: string; html: string } {
  const body = `
    <div style="font-size:15px;color:#555047;line-height:1.8;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      ${bodyHtml}
    </div>
    ${signoff()}
  `

  return { subject, html: shell(body, unsubscribeUrl) }
}
