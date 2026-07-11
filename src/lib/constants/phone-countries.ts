export interface PhoneCountry {
  code: string   // dialing code e.g. '+49'
  iso: string    // ISO 3166-1 alpha-2 e.g. 'DE'
  flag: string   // emoji flag
  name: string   // display name (German)
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: '+49',  iso: 'DE', flag: '🇩🇪', name: 'Deutschland' },
  { code: '+43',  iso: 'AT', flag: '🇦🇹', name: 'Österreich' },
  { code: '+41',  iso: 'CH', flag: '🇨🇭', name: 'Schweiz' },
  { code: '+352', iso: 'LU', flag: '🇱🇺', name: 'Luxemburg' },
  { code: '+423', iso: 'LI', flag: '🇱🇮', name: 'Liechtenstein' },
  // Europe
  { code: '+44',  iso: 'GB', flag: '🇬🇧', name: 'Vereinigtes Königreich' },
  { code: '+33',  iso: 'FR', flag: '🇫🇷', name: 'Frankreich' },
  { code: '+39',  iso: 'IT', flag: '🇮🇹', name: 'Italien' },
  { code: '+34',  iso: 'ES', flag: '🇪🇸', name: 'Spanien' },
  { code: '+351', iso: 'PT', flag: '🇵🇹', name: 'Portugal' },
  { code: '+31',  iso: 'NL', flag: '🇳🇱', name: 'Niederlande' },
  { code: '+32',  iso: 'BE', flag: '🇧🇪', name: 'Belgien' },
  { code: '+45',  iso: 'DK', flag: '🇩🇰', name: 'Dänemark' },
  { code: '+46',  iso: 'SE', flag: '🇸🇪', name: 'Schweden' },
  { code: '+47',  iso: 'NO', flag: '🇳🇴', name: 'Norwegen' },
  { code: '+358', iso: 'FI', flag: '🇫🇮', name: 'Finnland' },
  { code: '+48',  iso: 'PL', flag: '🇵🇱', name: 'Polen' },
  { code: '+420', iso: 'CZ', flag: '🇨🇿', name: 'Tschechien' },
  { code: '+421', iso: 'SK', flag: '🇸🇰', name: 'Slowakei' },
  { code: '+36',  iso: 'HU', flag: '🇭🇺', name: 'Ungarn' },
  { code: '+40',  iso: 'RO', flag: '🇷🇴', name: 'Rumänien' },
  { code: '+359', iso: 'BG', flag: '🇧🇬', name: 'Bulgarien' },
  { code: '+385', iso: 'HR', flag: '🇭🇷', name: 'Kroatien' },
  { code: '+381', iso: 'RS', flag: '🇷🇸', name: 'Serbien' },
  { code: '+386', iso: 'SI', flag: '🇸🇮', name: 'Slowenien' },
  { code: '+30',  iso: 'GR', flag: '🇬🇷', name: 'Griechenland' },
  { code: '+357', iso: 'CY', flag: '🇨🇾', name: 'Zypern' },
  { code: '+356', iso: 'MT', flag: '🇲🇹', name: 'Malta' },
  { code: '+370', iso: 'LT', flag: '🇱🇹', name: 'Litauen' },
  { code: '+371', iso: 'LV', flag: '🇱🇻', name: 'Lettland' },
  { code: '+372', iso: 'EE', flag: '🇪🇪', name: 'Estland' },
  { code: '+354', iso: 'IS', flag: '🇮🇸', name: 'Island' },
  { code: '+353', iso: 'IE', flag: '🇮🇪', name: 'Irland' },
  { code: '+380', iso: 'UA', flag: '🇺🇦', name: 'Ukraine' },
  { code: '+375', iso: 'BY', flag: '🇧🇾', name: 'Belarus' },
  { code: '+373', iso: 'MD', flag: '🇲🇩', name: 'Moldau' },
  { code: '+382', iso: 'ME', flag: '🇲🇪', name: 'Montenegro' },
  { code: '+387', iso: 'BA', flag: '🇧🇦', name: 'Bosnien-Herzegowina' },
  { code: '+389', iso: 'MK', flag: '🇲🇰', name: 'Nordmazedonien' },
  { code: '+355', iso: 'AL', flag: '🇦🇱', name: 'Albanien' },
  { code: '+383', iso: 'XK', flag: '🇽🇰', name: 'Kosovo' },
  { code: '+7',   iso: 'RU', flag: '🇷🇺', name: 'Russland' },
  // Middle East & North Africa
  { code: '+971', iso: 'AE', flag: '🇦🇪', name: 'Vereinigte Arabische Emirate (Dubai)' },
  { code: '+966', iso: 'SA', flag: '🇸🇦', name: 'Saudi-Arabien' },
  { code: '+965', iso: 'KW', flag: '🇰🇼', name: 'Kuwait' },
  { code: '+974', iso: 'QA', flag: '🇶🇦', name: 'Katar' },
  { code: '+973', iso: 'BH', flag: '🇧🇭', name: 'Bahrain' },
  { code: '+968', iso: 'OM', flag: '🇴🇲', name: 'Oman' },
  { code: '+972', iso: 'IL', flag: '🇮🇱', name: 'Israel' },
  { code: '+961', iso: 'LB', flag: '🇱🇧', name: 'Libanon' },
  { code: '+962', iso: 'JO', flag: '🇯🇴', name: 'Jordanien' },
  { code: '+964', iso: 'IQ', flag: '🇮🇶', name: 'Irak' },
  { code: '+20',  iso: 'EG', flag: '🇪🇬', name: 'Ägypten' },
  { code: '+212', iso: 'MA', flag: '🇲🇦', name: 'Marokko' },
  { code: '+213', iso: 'DZ', flag: '🇩🇿', name: 'Algerien' },
  { code: '+216', iso: 'TN', flag: '🇹🇳', name: 'Tunesien' },
  { code: '+218', iso: 'LY', flag: '🇱🇾', name: 'Libyen' },
  { code: '+90',  iso: 'TR', flag: '🇹🇷', name: 'Türkei' },
  { code: '+98',  iso: 'IR', flag: '🇮🇷', name: 'Iran' },
  // Asia
  { code: '+86',  iso: 'CN', flag: '🇨🇳', name: 'China' },
  { code: '+81',  iso: 'JP', flag: '🇯🇵', name: 'Japan' },
  { code: '+82',  iso: 'KR', flag: '🇰🇷', name: 'Südkorea' },
  { code: '+91',  iso: 'IN', flag: '🇮🇳', name: 'Indien' },
  { code: '+92',  iso: 'PK', flag: '🇵🇰', name: 'Pakistan' },
  { code: '+880', iso: 'BD', flag: '🇧🇩', name: 'Bangladesch' },
  { code: '+94',  iso: 'LK', flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '+977', iso: 'NP', flag: '🇳🇵', name: 'Nepal' },
  { code: '+63',  iso: 'PH', flag: '🇵🇭', name: 'Philippinen' },
  { code: '+62',  iso: 'ID', flag: '🇮🇩', name: 'Indonesien' },
  { code: '+60',  iso: 'MY', flag: '🇲🇾', name: 'Malaysia' },
  { code: '+65',  iso: 'SG', flag: '🇸🇬', name: 'Singapur' },
  { code: '+66',  iso: 'TH', flag: '🇹🇭', name: 'Thailand' },
  { code: '+84',  iso: 'VN', flag: '🇻🇳', name: 'Vietnam' },
  // Americas
  { code: '+1',   iso: 'US', flag: '🇺🇸', name: 'USA / Kanada' },
  { code: '+52',  iso: 'MX', flag: '🇲🇽', name: 'Mexiko' },
  { code: '+55',  iso: 'BR', flag: '🇧🇷', name: 'Brasilien' },
  { code: '+54',  iso: 'AR', flag: '🇦🇷', name: 'Argentinien' },
  { code: '+56',  iso: 'CL', flag: '🇨🇱', name: 'Chile' },
  { code: '+57',  iso: 'CO', flag: '🇨🇴', name: 'Kolumbien' },
  { code: '+58',  iso: 'VE', flag: '🇻🇪', name: 'Venezuela' },
  { code: '+51',  iso: 'PE', flag: '🇵🇪', name: 'Peru' },
  // Africa
  { code: '+27',  iso: 'ZA', flag: '🇿🇦', name: 'Südafrika' },
  { code: '+234', iso: 'NG', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+254', iso: 'KE', flag: '🇰🇪', name: 'Kenia' },
  { code: '+233', iso: 'GH', flag: '🇬🇭', name: 'Ghana' },
  { code: '+255', iso: 'TZ', flag: '🇹🇿', name: 'Tansania' },
  { code: '+256', iso: 'UG', flag: '🇺🇬', name: 'Uganda' },
  { code: '+237', iso: 'CM', flag: '🇨🇲', name: 'Kamerun' },
  { code: '+251', iso: 'ET', flag: '🇪🇹', name: 'Äthiopien' },
  // Oceania
  { code: '+61',  iso: 'AU', flag: '🇦🇺', name: 'Australien' },
  { code: '+64',  iso: 'NZ', flag: '🇳🇿', name: 'Neuseeland' },
]

/** Parse a stored phone value into country code + local number */
export function parsePhoneValue(value: string, countries: PhoneCountry[] = PHONE_COUNTRIES): { country: PhoneCountry; local: string } {
  const DEFAULT = countries.find(c => c.iso === 'DE') ?? countries[0]
  if (!value) return { country: DEFAULT, local: '' }

  // Normalize: ensure it starts with +
  const normalized = value.startsWith('+') ? value : '+' + value.replace(/\D/g, '')

  // Try longest match first (e.g. +358 before +35)
  const sorted = [...countries].sort((a, b) => b.code.length - a.code.length)
  for (const c of sorted) {
    if (normalized.startsWith(c.code)) {
      return { country: c, local: normalized.slice(c.code.length).trim() }
    }
  }
  return { country: DEFAULT, local: value }
}

/** Format for WhatsApp wa.me links: digits only, no +, no spaces */
export function toWhatsAppDigits(country: PhoneCountry, local: string): string {
  const digits = local.replace(/\D/g, '')
  if (!digits) return ''
  const countryDigits = country.code.replace('+', '')
  // If local starts with 0, remove it (German convention: 0151 → 151)
  const localNormalized = digits.startsWith('0') ? digits.slice(1) : digits
  return countryDigits + localNormalized
}

/** Format for display (Telefon field): +49 151 12345678 */
export function toDisplayPhone(country: PhoneCountry, local: string): string {
  const trimmed = local.trim()
  if (!trimmed) return ''
  return `${country.code} ${trimmed}`
}
