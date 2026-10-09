/**
 * Einheitliche Meta-/Open-Graph-Angaben für alle Kundenseiten.
 *
 * Problem: Jedes Template hatte eigene (teils kaputte) Tags — relative Bildpfade, alte
 * vercel.app-Adressen, mal mit Name, mal ohne. Beim Teilen in WhatsApp sah jede Seite anders aus.
 *
 * Lösung: Beim Rendern werden <title>, description, alle og:* und twitter:* Tags entfernt und
 * durch einen einheitlichen Block ersetzt: persönlicher Titel, einladender Satz je Template,
 * Vorschaubild aus /api/og/{siteId} (Foto + Name + Claim in Template-Farbe).
 *
 * Geteilt zwischen App (template-engine.ts) und Worker — darum ohne Abhängigkeiten.
 */

export interface OgContext {
  /** Template-Domain, z. B. dailyoptimal.de */
  templateDomain: string
  siteId: string
  /** Host, unter dem die Seite erreichbar ist (Subdomain oder eigene Domain) */
  host: string
  /** App-Basis für das Vorschaubild, Standard https://app.finestsites.io */
  appUrl?: string
}

export interface OgProfile {
  claim: string
  description: (name: string) => string
  /** Farbe des Vorschaubilds */
  accent: string
  /** Textfarbe auf accent */
  ink: string
}

export const OG_PROFILES: Record<string, OgProfile> = {
  'dailyoptimal.de': {
    claim: 'Täglich optimal versorgt',
    description: n => `${n} zeigt dir ein Nährstoff-System für morgens, tagsüber und abends, in Minuten erledigt. Schau rein und melde dich gern.`,
    accent: '#1F5138', ink: '#FFFFFF',
  },
  'wellpreneur.io': {
    claim: 'Gutes tun und dauerhaft profitieren',
    description: n => `Hochwertige Wellness-Produkte weiterempfehlen und nebenbei ein monatliches Einkommen aufbauen, in deinem Tempo. ${n} zeigt dir, wie das geht.`,
    accent: '#1D4ED8', ink: '#FFFFFF',
  },
  'cellrestart.net': {
    claim: 'Deine Stoffwechselkur',
    description: n => `In vier Phasen zu mehr Energie und einem klaren Kopf. ${n} begleitet dich persönlich, Schritt für Schritt.`,
    accent: '#0F766E', ink: '#FFFFFF',
  },
  'lnko.me': {
    claim: 'Alle meine Links',
    description: n => `Die wichtigsten Links von ${n} auf einen Blick: Webseiten, Social Media und Kontakt.`,
    accent: '#111111', ink: '#FFFFFF',
  },
  'myevnt.io': {
    claim: 'Live-Events & Termine',
    description: n => `Sei live dabei: alle Termine von ${n} auf einen Blick, Anmeldung in einer Minute.`,
    accent: '#6D28D9', ink: '#FFFFFF',
  },
  'vitalprofil.net': {
    claim: 'Welcher Vital-Typ bist du?',
    description: n => `20 kurze Aussagen, dein Ergebnis in 3 Minuten. Kostenlos und ohne Anmeldung, von ${n}.`,
    accent: '#1F9D6B', ink: '#FFFFFF',
  },
  'womenplus.io': {
    claim: 'Meine Seite',
    description: n => `Schau dir die Seite von ${n} an und melde dich gern.`,
    accent: '#BE123C', ink: '#FFFFFF',
  },
}

const DEFAULT_PROFILE: OgProfile = {
  claim: 'Meine Seite',
  description: n => `Schau dir die Seite von ${n} an und melde dich gern.`,
  accent: '#111111', ink: '#FFFFFF',
}

export function ogProfile(templateDomain: string): OgProfile {
  return OG_PROFILES[templateDomain] ?? DEFAULT_PROFILE
}

const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim()

/** Anzeigename: „Anna Krempel“, im Duo „Anna & Max“. */
export function ogName(data: Record<string, unknown>): string {
  const duo = clean(data.partner_modus) === 'duo' || clean(data.team_modus) === 'team'
  const first = clean(data.vorname), last = clean(data.nachname)
  const first2 = clean(data.vorname2) || clean(data.partner_vorname)
  if (duo && first && first2) return `${first} & ${first2}`
  return [first, last].filter(Boolean).join(' ') || 'FinestSites'
}

/** Erste Buchstaben für das Vorschaubild ohne Foto. */
export function ogInitials(data: Record<string, unknown>): string {
  const n = ogName(data).replace(' & ', ' ')
  return n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('')
}

export function ogImageUrl(ctx: OgContext, data: Record<string, unknown>): string {
  const base = (ctx.appUrl ?? 'https://app.finestsites.io').replace(/\/$/, '')
  // Versions-Parameter: ändert sich mit Name/Foto, damit WhatsApp & Co. das Bild neu holen
  const seed = `${ogName(data)}|${clean(data.profilbild)}|${clean(data.profilbild2) || clean(data.partner_profilbild)}`
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return `${base}/api/og/${ctx.siteId}.png?v=${h.toString(36)}`
}

export function ogCopy(ctx: OgContext, data: Record<string, unknown>) {
  const p = ogProfile(ctx.templateDomain)
  const name = ogName(data)
  return {
    name,
    claim: p.claim,
    title: `${name} · ${p.claim}`,
    description: p.description(name),
    url: `https://${ctx.host}/`,
    image: ogImageUrl(ctx, data),
    accent: p.accent,
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Entfernt vorhandene Title/Description/OG/Twitter-Tags und setzt den einheitlichen Block. */
export function applyOpenGraph(html: string, data: Record<string, unknown>, ctx: OgContext): string {
  if (!/<head[^>]*>/i.test(html)) return html
  const c = ogCopy(ctx, data)
  html = html
    .replace(/<title>[\s\S]*?<\/title>\s*/gi, '')
    .replace(/<meta\s+(?:name|property)="(?:description|og:[a-z:_]+|twitter:[a-z:_]+)"[^>]*>\s*/gi, '')
  const block = [
    `<title>${esc(c.title)}</title>`,
    `<meta name="description" content="${esc(c.description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:locale" content="de_DE">`,
    `<meta property="og:site_name" content="${esc(c.name)}">`,
    `<meta property="og:url" content="${esc(c.url)}">`,
    `<meta property="og:title" content="${esc(c.title)}">`,
    `<meta property="og:description" content="${esc(c.description)}">`,
    `<meta property="og:image" content="${esc(c.image)}">`,
    `<meta property="og:image:secure_url" content="${esc(c.image)}">`,
    `<meta property="og:image:type" content="image/png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(`${c.name}: ${c.claim}`)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(c.title)}">`,
    `<meta name="twitter:description" content="${esc(c.description)}">`,
    `<meta name="twitter:image" content="${esc(c.image)}">`,
    `<meta name="theme-color" content="${c.accent}">`,
  ].join('\n')
  return html.replace(/<head([^>]*)>/i, (_m, attrs: string) => `<head${attrs}>\n${block}\n`)
}
