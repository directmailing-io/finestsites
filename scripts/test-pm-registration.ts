/**
 * Unit-Checks für den PM-Registrierungslink (Sponsor-Nummer, Land, Fail-closed).
 * Aufruf: npx tsx scripts/test-pm-registration.ts
 */
import assert from 'node:assert/strict'
import {
  buildPmRegistrationUrl, normalizePartnerNumber, resolvePartnerNumber, pmRegCountryIso, pmRegistrationUrlFor, normalizeCustomPmRegLink, isPmRegistrationPilot,
} from '../src/lib/utils/pm-registration'

// Nummer: nur Ziffern
assert.equal(normalizePartnerNumber(' 40237198 '), '40237198')
assert.equal(normalizePartnerNumber('4023 7198'), '')
assert.equal(normalizePartnerNumber('TP40237198'), '')
assert.equal(normalizePartnerNumber(''), '')
assert.equal(normalizePartnerNumber(null), '')

// Seitenwert (auch Alias) schlägt Profil; sonst Profil
assert.equal(resolvePartnerNumber({ teampartner_nummer: '111' }, '222'), '111')
assert.equal(resolvePartnerNumber({ team_partner_number: 'abc' }, '222'), '222')
assert.equal(resolvePartnerNumber({}, '222'), '222')
assert.equal(resolvePartnerNumber({}, null), '')

// Land: Anzeigename → ISO, Unbekanntes → DE
assert.equal(pmRegCountryIso('Schweiz'), 'CH')
assert.equal(pmRegCountryIso('USA'), 'US')
assert.equal(pmRegCountryIso('Mars'), 'DE')
assert.equal(pmRegCountryIso(''), 'DE')

// Link exakt im PM-Schema
assert.equal(buildPmRegistrationUrl('40237198', 'Deutschland'), 'https://registration.pm-international.com/?TP=40237198&lang=de&country=DE')
assert.equal(buildPmRegistrationUrl('40237198', 'Italien', 'en'), 'https://registration.pm-international.com/?TP=40237198&lang=en&country=IT')
assert.equal(buildPmRegistrationUrl('', 'Deutschland'), '')
assert.equal(buildPmRegistrationUrl('4023<script>', 'Deutschland'), '')

// Fail-closed: Schalter aus ODER keine Nummer → kein Link
assert.equal(pmRegistrationUrlFor({ pm_registrierung: 'ausblenden' }, '40237198'), '')
assert.equal(pmRegistrationUrlFor({ pm_registrierung: 'zeigen' }, ''), '')
assert.equal(pmRegistrationUrlFor({}, '40237198'), '')
assert.equal(pmRegistrationUrlFor({ pm_registrierung: 'zeigen', pm_reg_land: 'Österreich' }, '40237198'),
  'https://registration.pm-international.com/?TP=40237198&lang=de&country=AT')
// Demo-Fall: Nummer liegt als Alias in den Seitendaten
assert.equal(pmRegistrationUrlFor({ pm_registrierung: 'zeigen', teampartner_nummer: '40237198' }, null),
  'https://registration.pm-international.com/?TP=40237198&lang=de&country=DE')

// Eigener Link: nur https; PM-Link ohne TP bekommt die Nummer; fremder Link bleibt wie er ist
assert.equal(normalizeCustomPmRegLink('http://registration.pm-international.com/?lang=de', '40237198'), '')
assert.equal(normalizeCustomPmRegLink('javascript:alert(1)', '40237198'), '')
assert.equal(normalizeCustomPmRegLink('nicht-mal-eine-url', '40237198'), '')
assert.equal(normalizeCustomPmRegLink('https://www.pmebusiness.com/registrationv2/?country=de&lang=de', '40237198'),
  'https://www.pmebusiness.com/registrationv2/?country=de&lang=de&TP=40237198')
assert.equal(normalizeCustomPmRegLink('https://registration.pm-international.com/?TP=111&lang=en&country=AT', '40237198'),
  'https://registration.pm-international.com/?TP=111&lang=en&country=AT')
assert.equal(normalizeCustomPmRegLink('https://example.com/mein-funnel', '40237198'), 'https://example.com/mein-funnel')
// Eigener Link gewinnt, aber nie ohne Nummer; ungültiger eigener Link → generierter Link
assert.equal(pmRegistrationUrlFor({ pm_registrierung: 'zeigen', pm_reg_link: 'https://example.com/x' }, '40237198'), 'https://example.com/x')
assert.equal(pmRegistrationUrlFor({ pm_registrierung: 'zeigen', pm_reg_link: 'https://example.com/x' }, ''), '')
assert.equal(pmRegistrationUrlFor({ pm_registrierung: 'zeigen', pm_reg_link: 'kaputt' }, '40237198'),
  'https://registration.pm-international.com/?TP=40237198&lang=de&country=DE')

// Pilot: nur Allowlist-Konten bekommen einen Link, egal was in den Seitendaten steht
assert.equal(isPmRegistrationPilot('demo'), true)
assert.equal(isPmRegistrationPilot('Siegfried-Hartmann'), true)
assert.equal(isPmRegistrationPilot('katharinaschwarz'), true)
assert.equal(isPmRegistrationPilot('rebecca-schneider'), false)
assert.equal(isPmRegistrationPilot(''), false)
assert.equal(pmRegistrationUrlFor({ pm_registrierung: 'zeigen' }, '40237198', 'rebecca-schneider'), '')
assert.equal(pmRegistrationUrlFor({ pm_registrierung: 'zeigen' }, '40237198', 'demo'), 'https://registration.pm-international.com/?TP=40237198&lang=de&country=DE')

console.log('pm-registration: all checks passed')
