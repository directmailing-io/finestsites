// Zentrale Copy für den Erfahrungsbericht-Wizard.
// Ton: umgangssprachlich, transparent, sympathisch. Keine Gedankenstriche.

export const TESTIMONIAL_CATEGORIES = [
  {
    key: 'produkte',
    emoji: '💊',
    title: 'Produkte',
    subtitle: 'Deine Erfahrung mit FitLine Produkten im Alltag',
  },
  {
    key: 'stoffwechselkur',
    emoji: '🔄',
    title: 'Stoffwechselkur',
    subtitle: 'Dein Weg mit der Kur, gern mit Vorher-Nachher-Fotos',
  },
  {
    key: 'business',
    emoji: '🚀',
    title: 'Business',
    subtitle: 'Deine Geschichte als Teampartner',
  },
] as const

export type TestimonialCategoryKey = (typeof TESTIMONIAL_CATEGORIES)[number]['key']

// Hinweis vor Video-Aufnahme/-Upload: was gesagt werden darf und was nicht.
// Rechtlicher Hintergrund: Health-Claims-VO verbietet Aussagen über Ausmaß und
// Tempo einer Gewichtsabnahme bei Lebensmitteln; LMIV verbietet Krankheitsbezug.
export const HEALTH_CLAIM_GUIDE = {
  intro: 'Kurz bevor du loslegst: Bei Nahrungsergänzungsmitteln gibt es klare Regeln, was man öffentlich sagen darf. Damit dein Video verwendet werden kann, halt dich einfach an diese Faustregel: Erzähl von dir und deinem Gefühl, versprich nichts.',
  goodExamples: [
    'Seit ich morgens den PowerCocktail nehme, fühle ich mich fitter und starte besser in den Tag.',
    'Mit dem Optimalset habe ich für mich eine Routine gefunden, die ich easy durchhalte.',
    'Activize gehört bei mir vor dem Sport einfach dazu, ich fühle mich damit wacher.',
  ],
  badExamples: [
    'Mit dem PowerCocktail habe ich 5 Kilo in 2 Wochen abgenommen.',
    'Das Optimalset hat meine Migräne geheilt.',
    'Activize hilft gegen Diabetes und senkt den Blutdruck.',
  ],
  outro: 'Also: keine Zahlen zum Abnehmen, keine Krankheiten, keine Heilversprechen. Deine ehrliche, persönliche Erfahrung reicht völlig. Die ist eh am überzeugendsten.',
}

export const REWARD_MESSAGE = {
  title: 'Deine Geschichte. Deine kostenlose Fallstudien-Seite.',
  text: 'Wir sammeln gerade echte Erfahrungen aus der Community. Sobald genug zusammenkommen, bauen wir daraus eine Fallstudien-Seite mit vielen Berichten, sortiert nach Kategorien. Und die kannst du dann kostenlos für dich freischalten. Wir melden uns dazu in den nächsten Tagen und Wochen per E-Mail bei dir.',
  shareText: 'Je mehr mitmachen, desto stärker wird die Seite für alle. Schick den Link gern an deine Teampartner weiter.',
}

export const SHARE_URL = 'https://app.finestsites.io/erfahrungsbericht'

export const WHATSAPP_SHARE_TEXT = `Hey! FinestSites sammelt gerade echte Erfahrungsberichte aus der Community. Wer mitmacht, bekommt später eine kostenlose Fallstudien-Seite. Dauert nur ein paar Minuten: ${SHARE_URL}`
