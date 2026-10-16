/**
 * PDF für Gutschrift / Provisionsabrechnung (serverseitig, Node-Runtime, pdf-lib).
 * Schrift: Helvetica (Standard-14, WinAnsi) – kann ä ö ü ß € § – und …; alles andere
 * (z. B. polnische oder kyrillische Buchstaben in Namen) wird vorher entschärft.
 *
 * Inhalte nach § 14 Abs. 4 UStG: Name/Anschrift beider Seiten, Steuernummer/USt-IdNr. des
 * leistenden Partners (bei Unternehmern), USt-IdNr. des Ausstellers, Datum, fortlaufende
 * Nummer, Art der Leistung, Leistungszeitraum, Netto, Steuersatz/-betrag bzw. Befreiungshinweis.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { formatEuro, formatDateDE, VAT_RATE_PERCENT, type TaxStatus } from './tax'
import { LOGO_PATHS, LOGO_RECTS, LOGO_VIEWBOX } from './logo-vector'

/** Leistungsempfänger und Aussteller (exakt wie im Impressum, src/app/impressum/page.tsx). */
export const CREDIT_NOTE_ISSUER = {
  name: 'FinestSites Daniel Kurzeja',
  street: 'Herrleinstr. 39',
  zipCity: '97437 Haßfurt',
  country: 'Deutschland',
  vatId: 'DE369220308',
  email: 'hello@finestsites.io',
  web: 'finestsites.io',
} as const

export const CREDIT_NOTE_SERVICE = 'Vermittlungsprovision für Kundenempfehlungen (FinestSites Partnerprogramm)'

export interface CreditNoteLine {
  /** ISO-Datum der Provision */
  date: string
  /** gekürzte Stripe-Rechnungsnummer, z. B. „…AbC123“ */
  invoiceRef: string
  /** maskiert, z. B. „Kunde #1234“ – nie Name oder E-Mail */
  customerRef: string
  /** Netto-Rechnungsbetrag des Kunden (Basis), falls bekannt */
  baseNetCents: number | null
  /** Provisionssatz, z. B. 0.1 */
  rate: number
  /** Provision netto (negativ bei Rückbuchung) */
  commissionCents: number
  kind: 'commission' | 'chargeback'
}

export interface CreditNoteRecipient {
  taxStatus: TaxStatus
  fullName: string
  street: string
  zip: string
  city: string
  country: string
  taxNumber: string | null
  vatId: string | null
}

export interface CreditNoteData {
  number: string
  issueDate: string // ISO
  periodStart: string // ISO-Datum
  periodEnd: string
  paidAt: string // ISO
  recipient: CreditNoteRecipient
  lines: CreditNoteLine[]
  netCents: number
  vatCents: number
  grossCents: number
  vatRate: number
  stripeTransferId?: string | null
}

const A4: [number, number] = [595.28, 841.89]
const M = 56 // Rand
const INK = rgb(0.07, 0.09, 0.15)
const BODY = rgb(0.22, 0.25, 0.32)
const MUTED = rgb(0.42, 0.45, 0.5)
const LINE = rgb(0.86, 0.87, 0.89)
const SOFT = rgb(0.965, 0.97, 0.975)

export const DOCUMENT_TITLE = 'Gutschrift'

export function taxNoteFor(status: TaxStatus): string | null {
  if (status === 'kleinunternehmer') {
    return 'Kein Ausweis von Umsatzsteuer, da der leistende Unternehmer Kleinunternehmer im Sinne von § 19 UStG ist.'
  }
  return null
}

/** Zeichen, die Helvetica/WinAnsi nicht kann, ersetzen (Akzente entfernen, Rest → „?“). */
function makeSanitizer(font: PDFFont): (s: string) => string {
  const supported = new Set(font.getCharacterSet())
  const replacements: Record<string, string> = {
    'ł': 'l', 'Ł': 'L', 'đ': 'd', 'Đ': 'D', 'ı': 'i', 'ø': 'o', 'Ø': 'O',
    ' ': ' ', ' ': ' ', ' ': ' ', '‑': '-', '−': '-',
  }
  return (s: string) => {
    let out = ''
    for (const ch of s.replace(/[\r\n\t]+/g, ' ')) {
      const cp = ch.codePointAt(0)!
      if (supported.has(cp)) { out += ch; continue }
      if (replacements[ch]) { out += replacements[ch]; continue }
      const stripped = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
      out += stripped && [...stripped].every(c => supported.has(c.codePointAt(0)!)) ? stripped : '?'
    }
    return out
  }
}

export async function generateCreditNotePdf(data: CreditNoteData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const title = DOCUMENT_TITLE
  doc.setTitle(`${title} ${data.number}`)
  doc.setAuthor(CREDIT_NOTE_ISSUER.name)
  doc.setSubject(CREDIT_NOTE_SERVICE)
  doc.setCreator('FinestSites')
  doc.setProducer('FinestSites')
  doc.setCreationDate(new Date(data.issueDate))
  doc.setModificationDate(new Date(data.issueDate))

  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const clean = makeSanitizer(regular)

  const pages: PDFPage[] = []
  let page = doc.addPage(A4)
  pages.push(page)
  const width = A4[0]
  const right = width - M

  const text = (p: PDFPage, s: string, x: number, y: number, size = 9.5, font: PDFFont = regular, color = BODY) => {
    p.drawText(clean(s), { x, y, size, font, color })
  }
  const textRight = (p: PDFPage, s: string, xRight: number, y: number, size = 9.5, font: PDFFont = regular, color = BODY) => {
    const t = clean(s)
    p.drawText(t, { x: xRight - font.widthOfTextAtSize(t, size), y, size, font, color })
  }
  /**
   * Zeilenumbruch an Wortgrenzen; überlange Wörter (z. B. Firmenname ohne Leerzeichen)
   * werden hart getrennt. Es wird nie etwas abgeschnitten.
   */
  const wrapLines = (s: string, maxWidth: number, size: number, font: PDFFont): string[] => {
    const lines: string[] = []
    let line = ''
    for (const word of clean(s).split(' ').filter(Boolean)) {
      let w = word
      // Wort passt allein nicht in die Zeile → in Stücke teilen
      while (font.widthOfTextAtSize(w, size) > maxWidth && w.length > 1) {
        if (line) { lines.push(line); line = '' }
        let cut = w.length - 1
        while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxWidth) cut--
        lines.push(w.slice(0, cut))
        w = w.slice(cut)
      }
      const test = line ? `${line} ${w}` : w
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        lines.push(line)
        line = w
      } else line = test
    }
    if (line) lines.push(line)
    return lines
  }
  /** Fließtext mit Umbruch; gibt die neue y-Position zurück. */
  const paragraph = (p: PDFPage, s: string, x: number, y: number, maxWidth: number, size = 9, font: PDFFont = regular, color = BODY, leading = 1.45) => {
    for (const l of wrapLines(s, maxWidth, size, font)) {
      p.drawText(l, { x, y, size, font, color })
      y -= size * leading
    }
    return y
  }
  const fit = (s: string, font: PDFFont, size: number, maxWidth: number) => {
    let t = clean(s)
    if (font.widthOfTextAtSize(t, size) <= maxWidth) return t
    while (t.length > 1 && font.widthOfTextAtSize(t + '…', size) > maxWidth) t = t.slice(0, -1)
    return t + '…'
  }

  // ── Kopf: Absender rechts ────────────────────────────────────────────────────
  let y = A4[1] - M
  // Wortmarke als Vektor (rechtsbündig, Oberkante = y + 14)
  {
    const LOGO_H = 20
    const scale = LOGO_H / LOGO_VIEWBOX.height
    const lx = right - LOGO_VIEWBOX.width * scale
    const top = y + 14
    const logoColor = rgb(0x1a / 255, 0x1a / 255, 0x1a / 255)
    for (const d of LOGO_PATHS) page.drawSvgPath(d, { x: lx, y: top, scale, color: logoColor })
    for (const rc of LOGO_RECTS) {
      page.drawRectangle({ x: lx + rc.x * scale, y: top - (rc.y + rc.h) * scale, width: rc.w * scale, height: rc.h * scale, color: logoColor })
    }
  }
  y -= 26
  // Name/Anschrift des Ausstellers vollständig (§ 14 Abs. 4 Nr. 1 UStG) – umbrechen, nie kürzen
  for (const l of [CREDIT_NOTE_ISSUER.name, CREDIT_NOTE_ISSUER.street, CREDIT_NOTE_ISSUER.zipCity, CREDIT_NOTE_ISSUER.country, `USt-IdNr.: ${CREDIT_NOTE_ISSUER.vatId}`]) {
    for (const part of wrapLines(l, 220, 8.5, regular)) {
      textRight(page, part, right, y, 8.5, regular, MUTED)
      y -= 12
    }
  }

  // ── Empfänger (leistender Partner) links ─────────────────────────────────────
  let ay = A4[1] - M - 92
  text(page, `${CREDIT_NOTE_ISSUER.name} · ${CREDIT_NOTE_ISSUER.street} · ${CREDIT_NOTE_ISSUER.zipCity}`, M, ay, 7, regular, MUTED)
  ay -= 18
  const r = data.recipient
  const addr = [r.fullName, r.street, `${r.zip} ${r.city}`, r.country === 'DE' ? 'Deutschland' : r.country]
  // Vollständiger Name und vollständige Anschrift (§ 14 Abs. 4 Nr. 1 UStG): lange Angaben
  // werden umgebrochen (Folgezeilen enger gesetzt), nie mit „…“ gekürzt.
  const ADDR_WIDTH = 260 // bis kurz vor die Belegdaten (metaX)
  for (const [i, l] of addr.entries()) {
    const font = i === 0 ? bold : regular
    const parts = wrapLines(l, ADDR_WIDTH, 10.5, font)
    for (const [j, part] of parts.entries()) {
      text(page, part, M, ay, 10.5, font, INK)
      ay -= j < parts.length - 1 ? 12.5 : 14.5
    }
  }
  ay -= 4
  if (r.vatId) { text(page, `USt-IdNr.: ${r.vatId}`, M, ay, 9, regular, BODY); ay -= 12.5 }
  if (r.taxNumber) { text(page, `Steuernummer: ${r.taxNumber}`, M, ay, 9, regular, BODY); ay -= 12.5 }

  // ── Belegdaten rechts neben der Anschrift ────────────────────────────────────
  const metaX = 340
  let my = A4[1] - M - 110
  const meta: [string, string][] = [
    [`${title}-Nr.`, data.number],
    ['Datum', formatDateDE(data.issueDate)],
    ['Leistungszeitraum', `${formatDateDE(data.periodStart)} – ${formatDateDE(data.periodEnd)}`],
  ]
  for (const [k, v] of meta) {
    text(page, k, metaX, my, 8.5, regular, MUTED)
    textRight(page, v, right, my, 9.5, bold, INK)
    my -= 15
  }

  // ── Titel ────────────────────────────────────────────────────────────────────
  y = Math.min(ay, my) - 34
  text(page, title, M, y, 22, bold, INK)
  y -= 20
  text(page, CREDIT_NOTE_SERVICE, M, y, 10.5, regular, BODY)
  y -= 16
  y = paragraph(page,
    'Wir rechnen die folgenden Provisionen für deine Empfehlungen per Gutschrift ab. Grundlage ist jeweils der Nettobetrag der Kundenzahlung.',
    M, y, right - M, 9, regular, MUTED)
  y -= 12

  // ── Tabelle ──────────────────────────────────────────────────────────────────
  const cols = { date: M + 8, invoice: M + 72, customer: M + 160, base: M + 345, rate: M + 390, amount: right - 8 }
  const drawHeader = (p: PDFPage, yy: number) => {
    p.drawRectangle({ x: M, y: yy - 7, width: right - M, height: 22, color: SOFT })
    const hs = 8
    text(p, 'Datum', cols.date, yy, hs, bold, MUTED)
    text(p, 'Rechnung', cols.invoice, yy, hs, bold, MUTED)
    text(p, 'Kunde', cols.customer, yy, hs, bold, MUTED)
    textRight(p, 'Umsatz netto', cols.base, yy, hs, bold, MUTED)
    textRight(p, 'Satz', cols.rate, yy, hs, bold, MUTED)
    textRight(p, 'Provision netto', cols.amount, yy, hs, bold, MUTED)
    return yy - 24
  }
  y = drawHeader(page, y)

  const ROW = 18
  const bottomLimit = M + 60
  for (const line of data.lines) {
    if (y < bottomLimit) {
      page = doc.addPage(A4)
      pages.push(page)
      y = A4[1] - M - 10
      text(page, `${title} ${data.number} (Fortsetzung)`, M, y, 9, bold, INK)
      y = drawHeader(page, y - 24)
    }
    const isCb = line.kind === 'chargeback' || line.commissionCents < 0
    text(page, formatDateDE(line.date), cols.date, y, 9, regular, BODY)
    text(page, fit(line.invoiceRef, regular, 9, 82), cols.invoice, y, 9, regular, BODY)
    text(page, fit(isCb ? `${line.customerRef} (Rückbuchung)` : line.customerRef, regular, 9, 128), cols.customer, y, 9, regular, BODY)
    textRight(page, line.baseNetCents == null ? '–' : formatEuro(line.baseNetCents), cols.base, y, 9, regular, BODY)
    textRight(page, `${Math.round(line.rate * 100)} %`, cols.rate, y, 9, regular, BODY)
    textRight(page, formatEuro(line.commissionCents), cols.amount, y, 9, isCb ? bold : regular, isCb ? rgb(0.6, 0.1, 0.1) : INK)
    page.drawLine({ start: { x: M, y: y - 6 }, end: { x: right, y: y - 6 }, thickness: 0.5, color: LINE })
    y -= ROW
  }

  // ── Summen ───────────────────────────────────────────────────────────────────
  if (y < bottomLimit + 150) {
    page = doc.addPage(A4)
    pages.push(page)
    y = A4[1] - M - 10
  }
  y -= 10
  const sumLabelX = M + 270
  const sumRow = (label: string, value: string, strong = false) => {
    text(page, label, sumLabelX, y, strong ? 10.5 : 9.5, strong ? bold : regular, strong ? INK : BODY)
    textRight(page, value, cols.amount, y, strong ? 10.5 : 9.5, strong ? bold : regular, INK)
    y -= strong ? 18 : 15
  }
  if (r.taxStatus === 'regelbesteuert') {
    sumRow('Summe netto', formatEuro(data.netCents))
    sumRow(`Umsatzsteuer ${Math.round(data.vatRate * 100) || VAT_RATE_PERCENT} %`, formatEuro(data.vatCents))
    page.drawLine({ start: { x: sumLabelX, y: y + 8 }, end: { x: right, y: y + 8 }, thickness: 0.8, color: INK })
    y -= 4
    sumRow('Gesamtbetrag (brutto)', formatEuro(data.grossCents), true)
  } else {
    sumRow('Summe netto', formatEuro(data.netCents))
    sumRow('Umsatzsteuer', formatEuro(0))
    page.drawLine({ start: { x: sumLabelX, y: y + 8 }, end: { x: right, y: y + 8 }, thickness: 0.8, color: INK })
    y -= 4
    sumRow('Auszahlungsbetrag', formatEuro(data.grossCents), true)
  }

  // ── Hinweise ─────────────────────────────────────────────────────────────────
  y -= 14
  const notes: string[] = []
  const taxNote = taxNoteFor(r.taxStatus)
  if (taxNote) notes.push(taxNote)
  notes.push(`Ausgezahlt per Überweisung über Stripe am ${formatDateDE(data.paidAt)}.`)
  notes.push('Diese Gutschrift wurde mit deinem Einverständnis erstellt (§ 14 Abs. 2 Satz 2 UStG). Bitte prüfe sie und melde dich sofort, wenn etwas nicht stimmt.')
  for (const n of notes) {
    y = paragraph(page, n, M, y, right - M, 9, regular, BODY)
    y -= 4
  }

  // ── Fußzeile auf allen Seiten ────────────────────────────────────────────────
  const footer = `${CREDIT_NOTE_ISSUER.name} · ${CREDIT_NOTE_ISSUER.street} · ${CREDIT_NOTE_ISSUER.zipCity} · USt-IdNr. ${CREDIT_NOTE_ISSUER.vatId} · ${CREDIT_NOTE_ISSUER.email}`
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: M - 8 }, end: { x: right, y: M - 8 }, thickness: 0.5, color: LINE })
    text(p, footer, M, M - 22, 7, regular, MUTED)
    textRight(p, `Seite ${i + 1} von ${pages.length}`, right, M - 22, 7, regular, MUTED)
  })

  return doc.save({ useObjectStreams: false })
}
