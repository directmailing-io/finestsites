/**
 * Eingaben aus dem Reiter „Werbung“ prüfen und bereinigen.
 * Nutzer kopieren gern mit Leerzeichen, Anführungszeichen oder ganzen Code-Schnipseln.
 * Jede Funktion gibt den bereinigten Wert zurück oder wirft einen verständlichen Satz.
 */
export class TrackingInputError extends Error {
  constructor(public field: string, message: string) { super(message) }
}

const clean = (v: unknown) => String(v ?? '').replace(/["'\s]/g, '').trim()

export function metaPixelId(raw: unknown): string {
  const v = clean(raw)
  if (!v) return ''
  // Aus einem kopierten Pixel-Code die ID herausziehen: fbq('init', '1234567890123456')
  const m = String(raw).match(/init['"\s,]+(\d{15,16})/)
  const id = m ? m[1] : v
  if (!/^\d{15,16}$/.test(id)) {
    throw new TrackingInputError('metaPixelId', 'Die Pixel-ID (Datensatz-ID) besteht nur aus 15 bis 16 Ziffern. Du findest sie im Events Manager direkt unter dem Namen deines Datensatzes.')
  }
  return id
}

export function metaToken(raw: unknown): string {
  const v = String(raw ?? '').trim().replace(/^["']|["']$/g, '')
  if (!v) return ''
  if (!/^EAA[A-Za-z0-9_-]{40,}$/.test(v)) {
    throw new TrackingInputError('metaToken', 'Der Zugriffsschlüssel beginnt mit „EAA“ und ist sehr lang. Erzeuge ihn im Events Manager unter Einstellungen → Conversions API → „Zugriffsschlüssel generieren“.')
  }
  return v
}

export function metaTestCode(raw: unknown): string {
  const v = clean(raw).toUpperCase()
  if (!v) return ''
  if (!/^TEST\d{3,8}$/.test(v)) {
    throw new TrackingInputError('metaTestCode', 'Der Test-Code sieht so aus: TEST12345. Du findest ihn im Events Manager unter „Ereignisse testen“.')
  }
  return v
}

/** Akzeptiert „AW-123456789“, „123456789“ oder den ganzen Schnipsel „AW-123456789/AbCdEf…“. */
export function googleAdsId(raw: unknown): string {
  const v = clean(raw).toUpperCase()
  if (!v) return ''
  const m = v.match(/(?:AW-)?(\d{9,11})/)
  if (!m) throw new TrackingInputError('googleAdsId', 'Die Conversion-ID sieht so aus: AW-123456789. Du findest sie in Google Ads unter Ziele → Conversions → Tag-Einrichtung.')
  return `AW-${m[1]}`
}

export function googleLabel(raw: unknown, field = 'googleLeadLabel'): string {
  let v = clean(raw)
  if (!v) return ''
  // „AW-123456789/AbC-dEfGh“ → nur das Label
  v = v.replace(/^AW-\d+\//i, '')
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(v)) throw new TrackingInputError(field, 'Das Conversion-Label ist eine kurze Zeichenfolge wie „AbC-dEfGhIjK1LmN“. Es steht in Google Ads direkt neben der Conversion-ID.')
  return v
}

export function tiktokPixelId(raw: unknown): string {
  const v = clean(raw).toUpperCase()
  if (!v) return ''
  if (!/^[A-Z0-9]{18,22}$/.test(v)) throw new TrackingInputError('tiktokPixelId', 'Die TikTok-Pixel-ID hat etwa 20 Zeichen aus Buchstaben und Ziffern. Du findest sie im TikTok Ads Manager unter Tools → Events.')
  return v
}

export function tiktokToken(raw: unknown): string {
  const v = String(raw ?? '').trim().replace(/^["']|["']$/g, '')
  if (!v) return ''
  if (!/^[a-f0-9]{30,64}$/i.test(v)) throw new TrackingInputError('tiktokToken', 'Der TikTok-Zugriffstoken ist eine lange Folge aus Ziffern und Buchstaben a–f. Du erzeugst ihn im TikTok Ads Manager unter Events → Einstellungen.')
  return v
}
