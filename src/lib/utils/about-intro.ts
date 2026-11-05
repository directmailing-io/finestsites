/**
 * Persönliche Begrüßung („Hi, ich bin Anna.“) in allen Sprachen der Templates.
 * Geteilt zwischen App (template-engine.ts) und Worker — darum ohne Abhängigkeiten.
 * Eigener Text aus dem Editor: about_intro (DE) und about_intro_{lang} (übersetzt, siehe translate.ts);
 * fehlt eine Übersetzung, bleibt der deutsche Text.
 */
export const SITE_LANGS = ['de', 'en', 'it', 'ru', 'uk', 'pl', 'bg', 'hi', 'tr', 'sr', 'es', 'zh', 'ko'] as const
export type SiteLang = typeof SITE_LANGS[number]

const GREETING: Record<SiteLang, { solo: (n: string) => string; duo: (n: string) => string }> = {
  de: { solo: n => `Hi, ich bin ${n}`, duo: n => `Hi, wir sind ${n}` },
  en: { solo: n => `Hi, I'm ${n}`, duo: n => `Hi, we're ${n}` },
  it: { solo: n => `Ciao, sono ${n}`, duo: n => `Ciao, siamo ${n}` },
  ru: { solo: n => `Привет, я ${n}`, duo: n => `Привет, мы ${n}` },
  uk: { solo: n => `Привіт, я ${n}`, duo: n => `Привіт, ми ${n}` },
  pl: { solo: n => `Cześć, jestem ${n}`, duo: n => `Cześć, jesteśmy ${n}` },
  bg: { solo: n => `Здравей, аз съм ${n}`, duo: n => `Здравей, ние сме ${n}` },
  hi: { solo: n => `नमस्ते, मैं हूँ ${n}`, duo: n => `नमस्ते, हम हैं ${n}` },
  tr: { solo: n => `Merhaba, ben ${n}`, duo: n => `Merhaba, biz ${n}` },
  sr: { solo: n => `Ćao, ja sam ${n}`, duo: n => `Ćao, mi smo ${n}` },
  es: { solo: n => `Hola, soy ${n}`, duo: n => `Hola, somos ${n}` },
  zh: { solo: n => `你好，我是${n}`, duo: n => `你好，我们是${n}` },
  ko: { solo: n => `안녕하세요, ${n}입니다.`, duo: n => `안녕하세요, ${n}입니다.` },
}
/** Satzende je Sprache: steht im farbigen Namens-Span; ko: Kopula „입니다.“ folgt außerhalb (funktioniert mit jedem Namen, 이에요/예요 hängt vom Auslaut ab), zh: ideografischer Punkt. */
const PERIOD: Partial<Record<SiteLang, string>> = { ko: '', zh: '。' }
const AND: Record<SiteLang, string> = { de: '&amp;', en: '&amp;', it: '&amp;', ru: 'и', uk: 'і', pl: 'i', bg: 'и', hi: 'और', tr: 've', sr: 'i', es: 'y', zh: '和', ko: '&amp;' }

export function htmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** *Wort* im eigenen Text → farbig; ohne Marker wird das letzte Wort hervorgehoben. */
export function wrapAccentMarkers(text: string): string {
  const escaped = htmlEscape(text)
  const marked = escaped.replace(/\*([^*\s][^*]*?)\*/g, '<span class="accent">$1</span>')
  if (marked !== escaped) return marked
  const m = escaped.match(/^(.*?)(\s)(\S+)$/)
  if (!m) return `<span class="accent">${escaped}</span>`
  return `${m[1]}${m[2]}<span class="accent">${m[3]}</span>`
}

export function computeAboutIntro(data: Record<string, string>): Record<string, string> {
  const raw = (data.about_intro || '').trim()
  const isDuo = (data.partner_modus || '').trim() === 'duo' || (data.team_modus || '').trim() === 'team'
  const vorname = (data.vorname || '').trim() || 'Daniel'
  const vorname2 = ((data.vorname2 || '').trim() || (data.partner_vorname || '').trim())
  const out: Record<string, string> = {}
  for (const lang of SITE_LANGS) {
    const key = `about_intro_${lang}_html`
    if (raw) {
      const own = lang === 'de' ? raw : ((data[`about_intro_${lang}`] || '').trim() || raw)
      out[key] = wrapAccentMarkers(own)
    } else if (isDuo && vorname2) {
      const dot = PERIOD[lang] ?? '.'
      const nameHtml = `<span class="accent">${htmlEscape(vorname)} ${AND[lang]} ${htmlEscape(vorname2)}${dot}</span>`
      out[key] = GREETING[lang].duo(nameHtml)
    } else {
      out[key] = GREETING[lang].solo(`<span class="accent">${htmlEscape(vorname)}${PERIOD[lang] ?? '.'}</span>`)
    }
  }
  return out
}
