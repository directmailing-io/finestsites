// Zentrale Copy für den Erfahrungsbericht-Wizard.
// Ton: umgangssprachlich, transparent, sympathisch. Keine Gedankenstriche.

// Der DB-Enum kennt weiterhin 'stoffwechselkur' (Altdaten), im Wizard gibt es
// aber nur noch zwei Kategorien: Produkte (inkl. Kur) und Business.
export type TestimonialCategoryKey = 'produkte' | 'stoffwechselkur' | 'business'

export const TESTIMONIAL_CATEGORIES: {
  key: TestimonialCategoryKey
  emoji: string
  title: string
  subtitle: string
}[] = [
  {
    key: 'produkte',
    emoji: '🍊',
    title: 'Produkte',
    subtitle: 'FitLine Produkte oder Stoffwechselkur',
  },
  {
    key: 'business',
    emoji: '🚀',
    title: 'Business',
    subtitle: 'Deine Geschichte als Teampartner',
  },
]

// Drei geführte Fragen statt einem leeren Textfeld: Vorher, Weg, Ergebnis.
export type GuidedQuestion = {
  key: string
  label: string
  placeholder: string
}

const PRODUKTE_QUESTIONS: GuidedQuestion[] = [
  {
    key: 'vorher',
    label: 'Wie war deine Situation vorher?',
    placeholder: 'Wie ging es dir, bevor du gestartet bist? Was wolltest du für dich verändern?',
  },
  {
    key: 'weg',
    label: 'Was genau hast du unternommen und was begeistert dich daran?',
    placeholder: 'Welche Produkte oder welche Kur? Wie sieht deine Routine aus? Was macht dir daran am meisten Spaß?',
  },
  {
    key: 'ergebnis',
    label: 'Was ist das Ergebnis? Warum empfiehlst du es weiter?',
    placeholder: 'Was hat sich für dich verändert? Und wem würdest du es empfehlen?',
  },
]

const BUSINESS_QUESTIONS: GuidedQuestion[] = [
  {
    key: 'vorher',
    label: 'Wie bist du zur Businesschance gekommen?',
    placeholder: 'Wie hast du davon erfahren? Und was waren deine ersten Gedanken dazu?',
  },
  {
    key: 'weg',
    label: 'Was hast du in der Zeit gelernt und was begeistert dich daran?',
    placeholder: 'Was hast du über dich, Menschen oder das Business gelernt? Was motiviert dich jeden Tag?',
  },
  {
    key: 'ergebnis',
    label: 'Was hat sich für dich seitdem verändert?',
    placeholder: 'Finanziell, persönlich oder im Alltag. Warum würdest du die Businesschance weiterempfehlen?',
  },
]

export function guidedQuestionsFor(category: TestimonialCategoryKey | null): GuidedQuestion[] {
  return category === 'business' ? BUSINESS_QUESTIONS : PRODUKTE_QUESTIONS
}

// Strenger Hinweis zu Heil- und Wirkaussagen, wird beim Text- UND Video-Step gezeigt.
// Rechtlicher Hintergrund: Health-Claims-VO verbietet Aussagen über Ausmaß und
// Tempo einer Gewichtsabnahme bei Lebensmitteln; LMIV verbietet Krankheitsbezug.
export const HEALTH_CLAIM_GUIDE = {
  title: 'Wichtig: Keine Heil- und Wirkaussagen',
  intro: 'Das ist gesetzlich streng geregelt. Berichte mit solchen Aussagen dürfen wir nicht veröffentlichen. Die Regel ist einfach: Erzähl, wie du dich fühlst. Versprich nichts.',
  rules: [
    'Keine Krankheiten oder Beschwerden nennen (auch nicht Migräne, Schmerzen, Blutdruck)',
    'Keine Abnehm-Zahlen oder Zeiträume nennen',
    'Keine Wirkversprechen wie "hilft gegen", "heilt" oder "stärkt das Immunsystem"',
  ],
  goodExamples: [
    'Seit ich morgens meinen PowerCocktail trinke, starte ich viel wacher und besser gelaunt in den Tag.',
    'Die Stoffwechselkur war für mich der Anstoß, meine Ernährung komplett umzustellen. Ich fühle mich heute richtig wohl in meinem Körper.',
    'Activize gehört bei mir fest vor jedes Training dazu. Damit fühle ich mich einfach fitter.',
  ],
  badExamples: [
    'Ich habe mit der Kur 8 Kilo in 3 Wochen abgenommen. (Abnehm-Zahlen sind verboten)',
    'Seit ich Restorate nehme, sind meine Gelenkschmerzen weg. (Krankheitsbezug ist verboten)',
    'Der PowerCocktail stärkt das Immunsystem und beugt Erkältungen vor. (Wirkversprechen sind verboten)',
  ],
}

export const REWARD_MESSAGE = {
  title: 'Erzähl kurz deine Geschichte.',
  text: 'Drei kurze Fragen, fertig. Als Dankeschön schalten wir dir später deine kostenlose Fallstudien-Seite mit echten Berichten aus der Community frei.',
  shareText: 'Je mehr mitmachen, desto stärker wird die Seite für alle. Schick den Link gern an deine Teampartner weiter.',
}

export const SHARE_URL = 'https://app.finestsites.io/erfahrungsbericht'

export const WHATSAPP_SHARE_TEXT = `Hey! FinestSites sammelt gerade echte Erfahrungsberichte aus der Community. Wer mitmacht, bekommt später eine kostenlose Fallstudien-Seite. Dauert nur ein paar Minuten: ${SHARE_URL}`
