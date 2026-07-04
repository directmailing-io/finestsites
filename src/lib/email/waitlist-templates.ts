/**
 * Waitlist-E-Mail-Templates
 * - Umgangssprachlich, "Hey [Vorname]," als Opener
 * - Echte Umlaute (UTF-8, Charset im HTML deklariert)
 * - HTML + Plain-Text-Version für bessere Zustellbarkeit
 * - Abmelde-Link in jeder Mail (DSGVO / CAN-SPAM)
 */

const MARKETING_URL = 'https://finestsites.io'
const LOGO_URL = `${MARKETING_URL}/logos/logo-black.svg`
const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`

// ── Shared ─────────────────────────────────────────────────────────────────────

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

      <!-- Logo -->
      <tr>
        <td align="center" style="padding-bottom:28px;">
          <a href="${MARKETING_URL}" style="display:inline-block;text-decoration:none;">
            <img src="${LOGO_URL}" alt="FinestSites" width="140"
              style="display:block;width:140px;height:auto;border:0;" />
          </a>
        </td>
      </tr>

      <!-- Card -->
      <tr>
        <td style="background:#ffffff;border-radius:20px;border:1px solid #E8E4DE;
          padding:44px 44px 40px;mso-padding-alt:44px 44px 40px;">
          ${body}
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding:24px 0 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#B0A89E;line-height:1.7;font-family:${FONT};">
            Du bekommst diese Mail, weil du dich im FinestSites Insider-Club eingetragen hast.<br />
            <a href="${unsubscribeUrl}" style="color:#B0A89E;text-decoration:underline;">Abmelden</a>
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
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
    <tr>
      <td style="background:#111111;border-radius:100px;padding:0;">
        <a href="${href}"
          style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:600;
          color:#ffffff;text-decoration:none;letter-spacing:-0.01em;font-family:${FONT};">
          ${label}
        </a>
      </td>
    </tr>
  </table>`
}

function divider(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
    style="margin:28px 0;">
    <tr><td style="border-top:1px solid #F0EDE8;height:1px;font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>`
}

function signoff(): string {
  return `${divider()}
  <p style="margin:0;font-size:14px;color:#6B6560;line-height:1.7;font-family:${FONT};">
    Viele Grüße,<br />
    <strong style="color:#111111;">Daniel von FinestSites</strong>
  </p>`
}

function para(text: string): string {
  return `<p style="margin:14px 0 0;font-size:15px;color:#555047;line-height:1.75;font-family:${FONT};">${text}</p>`
}

// ── Template 1: Double-Opt-in Bestätigung ──────────────────────────────────────

export function waitlistConfirmEmail({
  name,
  confirmUrl,
  unsubscribeUrl,
}: {
  name: string | null
  confirmUrl: string
  unsubscribeUrl: string
}): { subject: string; html: string; text: string } {
  const first = name ? name.split(' ')[0] : null
  const greeting = first ? `Hey ${first},` : 'Hey,'

  const body = `
    <h1 style="margin:0;font-size:24px;font-weight:700;color:#111111;
      letter-spacing:-0.025em;line-height:1.25;font-family:${FONT};">
      Kurz bestätigen, dann bist du dabei!
    </h1>
    ${para(greeting)}
    ${para(`du möchtest in den FinestSites Insider-Club. Sehr gut. Klick einmal auf den Button unten, damit wir wissen, dass die Adresse stimmt. Das dauert eine Sekunde.`)}
    ${button('Jetzt bestätigen', confirmUrl)}
    <p style="margin:20px 0 0;font-size:12px;color:#B0A89E;line-height:1.6;font-family:${FONT};">
      Der Link ist 7 Tage gültig. Hast du dich nicht angemeldet? Dann einfach ignorieren.
    </p>
    ${signoff()}
  `

  const text = `${greeting}

du möchtest in den FinestSites Insider-Club. Sehr gut.

Bitte bestätige kurz deine E-Mail-Adresse:
${confirmUrl}

Der Link ist 7 Tage gültig.

Viele Grüße,
Daniel von FinestSites

--
Abmelden: ${unsubscribeUrl}`

  return {
    subject: 'Kurz bestätigen, dann bist du Insider!',
    html: shell(body, unsubscribeUrl),
    text,
  }
}

// ── Template 2: Willkommen (nach Bestätigung) ──────────────────────────────────

export function waitlistWelcomeEmail({
  name,
  unsubscribeUrl,
}: {
  name: string | null
  unsubscribeUrl: string
}): { subject: string; html: string; text: string } {
  const first = name ? name.split(' ')[0] : null
  const greeting = first ? `Hey ${first},` : 'Hey,'

  const body = `
    <h1 style="margin:0;font-size:24px;font-weight:700;color:#111111;
      letter-spacing:-0.025em;line-height:1.25;font-family:${FONT};">
      Du bist jetzt im Insider-Club!
    </h1>
    ${para(greeting)}
    ${para(`du bist dabei. Ab jetzt gehörst du zu den Ersten, die Bescheid bekommen, wenn es bei FinestSites etwas Neues gibt.`)}
    ${para(`Das heisst konkret:`)}
    <ul style="margin:14px 0 0;padding-left:20px;font-size:15px;color:#555047;line-height:1.8;font-family:${FONT};">
      <li>Neue Vorlagen siehst du als Erster, bevor wir sie offiziell ankuendigen</li>
      <li>Rabatte und Aktionen gibt es nur fuer Insider</li>
      <li>Wir schreiben selten. Nur wenn es wirklich was zu sagen gibt.</li>
    </ul>
    ${para(`Das wars schon. Keine wochentlichen Mails, kein Spam. Nur das Wichtigste, wenn es so weit ist.`)}
    ${signoff()}
  `

  const text = `${greeting}

du bist jetzt im FinestSites Insider-Club!

Das heisst konkret:
- Neue Vorlagen siehst du als Erster, bevor wir sie offiziell ankuendigen
- Rabatte und Aktionen gibt es nur fuer Insider
- Wir schreiben selten. Nur wenn es wirklich was zu sagen gibt.

Keine woechentlichen Mails, kein Spam. Nur das Wichtigste.

Viele Gruesse,
Daniel von FinestSites

--
Abmelden: ${unsubscribeUrl}`

  return {
    subject: 'Willkommen im Insider-Club!',
    html: shell(body, unsubscribeUrl),
    text,
  }
}

// ── Template 3: Broadcast (Admin) ──────────────────────────────────────────────

export function waitlistBroadcastEmail({
  subject,
  bodyHtml,
  bodyText,
  unsubscribeUrl,
}: {
  subject: string
  bodyHtml: string
  bodyText: string
  unsubscribeUrl: string
}): { subject: string; html: string; text: string } {
  const body = `
    <div style="font-size:15px;color:#555047;line-height:1.8;font-family:${FONT};">
      ${bodyHtml}
    </div>
    ${signoff()}
  `

  const text = `${bodyText}\n\nViele Grüße,\nDaniel von FinestSites\n\n--\nAbmelden: ${unsubscribeUrl}`

  return { subject, html: shell(body, unsubscribeUrl), text }
}
