/**
 * Direkt-Registrierung als Teampartner bei PM-International (PM-Business-Template).
 *
 * Der Link wird NUR hier gebaut, nie im Template zusammengesetzt: Die Sponsor-Nummer
 * entscheidet, bei wem der Interessent landet. Falsche Nummer = Umsatz beim falschen
 * Sponsor. Deshalb: nur Ziffern, nur aus dem Konto, sonst gar kein Link.
 *
 * Schema (von PM vorgegeben, geprüft am 15.10.2026):
 *   https://registration.pm-international.com/?TP={Nummer}&lang={de|en}&country={ISO-2}
 * Die Seite kennt nur Deutsch und Englisch; das Land ist nur vorbelegt, der
 * Interessent kann es dort ändern.
 */

export const PM_REGISTRATION_BASE = 'https://registration.pm-international.com/'

/** Länder im Editor-Dropdown (Anzeigename → ISO-2, so wie PM den Parameter erwartet). */
export const PM_REG_COUNTRIES: ReadonlyArray<readonly [label: string, iso: string]> = [
  ['Deutschland', 'DE'], ['Österreich', 'AT'], ['Schweiz', 'CH'], ['Italien', 'IT'], ['Polen', 'PL'],
  ['Frankreich', 'FR'], ['Spanien', 'ES'], ['Portugal', 'PT'], ['Niederlande', 'NL'], ['Belgien', 'BE'],
  ['Luxemburg', 'LU'], ['Tschechien', 'CZ'], ['Slowakei', 'SK'], ['Ungarn', 'HU'], ['Rumänien', 'RO'],
  ['Bulgarien', 'BG'], ['Griechenland', 'GR'], ['Kroatien', 'HR'], ['Slowenien', 'SI'], ['Großbritannien', 'GB'],
  ['Irland', 'IE'], ['Dänemark', 'DK'], ['Schweden', 'SE'], ['Norwegen', 'NO'], ['Finnland', 'FI'],
  ['Ukraine', 'UA'], ['Türkei', 'TR'], ['USA', 'US'], ['Kanada', 'CA'], ['Australien', 'AU'], ['Indien', 'IN'],
]

export const PM_REG_DEFAULT_COUNTRY = 'Deutschland'

/**
 * Pilot (seit 15.10.2026, Daniels Vorgabe): Die Direkt-Registrierung gibt es NUR für diese Konten.
 * Gilt im Editor (Felder mit `pilot_only`) UND serverseitig (ohne Pilot nie ein Link, egal was in
 * den Seitendaten steht). Für den Rollout an alle: Liste leeren und `pilot_only` im Schema entfernen.
 */
export const PM_REG_PILOT_USERNAMES: ReadonlyArray<string> = ['demo', 'siegfried-hartmann', 'katharinaschwarz']

export function isPmRegistrationPilot(username: string | null | undefined): boolean {
  return PM_REG_PILOT_USERNAMES.includes((username ?? '').trim().toLowerCase())
}

/** Schlüssel, unter denen die Teampartner-Nummer in Seitendaten liegen kann (Profil-Prefill-Aliase im Editor). */
export const TEAM_PARTNER_KEYS = ['team_partner_number', 'teampartner_nummer', 'teampartnernummer'] as const

/** Nur Ziffern (PM-Nummern sind rein numerisch), sonst leer — Buchstaben/Zeichen = kein Link. */
export function normalizePartnerNumber(raw: string | null | undefined): string {
  const s = (raw ?? '').trim()
  return /^\d{3,12}$/.test(s) ? s : ''
}

/** Teampartner-Nummer: Seitenwert (Template mit eigenem Feld, z. B. FitLine) vor Profilwert. */
export function resolvePartnerNumber(siteValues: Record<string, string | null | undefined>, profileValue: string | null | undefined): string {
  for (const k of TEAM_PARTNER_KEYS) {
    const n = normalizePartnerNumber(siteValues[k])
    if (n) return n
  }
  return normalizePartnerNumber(profileValue)
}

export function pmRegCountryIso(label: string | null | undefined): string {
  const hit = PM_REG_COUNTRIES.find(([l]) => l === (label ?? '').trim())
  return hit ? hit[1] : 'DE'
}

/**
 * Fertiger Link oder '' (dann blendet das Template alle Einstiege aus).
 * `lang` ist nur der Startwert; das Template setzt ihn beim Klick auf die aktive Seitensprache.
 */
export function buildPmRegistrationUrl(partnerNumber: string, countryLabel: string | null | undefined, lang: 'de' | 'en' = 'de'): string {
  const tp = normalizePartnerNumber(partnerNumber)
  if (!tp) return ''
  const u = new URL(PM_REGISTRATION_BASE)
  u.searchParams.set('TP', tp)
  u.searchParams.set('lang', lang)
  u.searchParams.set('country', pmRegCountryIso(countryLabel))
  return u.toString()
}

/** Hosts, auf denen ein eigener Link ohne Sponsor-Parameter die Nummer automatisch bekommt. */
const PM_HOSTS = /(^|\.)(pm-international\.com|pmebusiness\.com)$/i

/**
 * Eigener Link des Nutzers (Feld `pm_reg_link`): nur https, sonst ''. Auf PM-Hosts wird
 * ein fehlender TP-Parameter ergänzt, damit ein kopierter PM-Link nie ohne Sponsor bleibt.
 */
export function normalizeCustomPmRegLink(raw: string | null | undefined, partnerNumber: string): string {
  const s = (raw ?? '').trim()
  if (!s) return ''
  let u: URL
  try { u = new URL(s) } catch { return '' }
  if (u.protocol !== 'https:') return ''
  if (PM_HOSTS.test(u.hostname) && !u.searchParams.get('TP') && partnerNumber) u.searchParams.set('TP', partnerNumber)
  return u.toString()
}

/**
 * Was das Template bekommt: nur wenn der Nutzer die Sektion eingeschaltet hat UND eine
 * gültige Nummer vorliegt. Beides fehlt → '' → Template zeigt nichts (fail-closed).
 * Ein eigener Link (`pm_reg_link`) ersetzt den generierten, braucht aber ebenfalls die Nummer.
 */
export function pmRegistrationUrlFor(siteValues: Record<string, string | null | undefined>, profilePartnerNumber: string | null | undefined, username?: string | null): string {
  // Pilot-Sperre: außerhalb der Allowlist nie ein Link (username undefined = Aufruf ohne Kontext, z. B. Editor-Karte)
  if (username !== undefined && !isPmRegistrationPilot(username)) return ''
  if ((siteValues['pm_registrierung'] ?? '').trim() !== 'zeigen') return ''
  const tp = resolvePartnerNumber(siteValues, profilePartnerNumber)
  if (!tp) return ''
  return normalizeCustomPmRegLink(siteValues['pm_reg_link'], tp) || buildPmRegistrationUrl(tp, siteValues['pm_reg_land'])
}
