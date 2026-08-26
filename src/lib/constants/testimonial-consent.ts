/**
 * Einwilligungstext für Erfahrungsberichte.
 * WICHTIG: Text für tv1 darf NIEMALS nachträglich verändert werden.
 * Neue Version → neues Key + neuer Text unten anhängen.
 * Der SHA-256-Hash des Textes wird zusammen mit IP, User-Agent und Zeitstempel
 * gespeichert, damit beweisbar ist, was exakt bestätigt wurde (DSGVO Art. 7).
 */

export const TESTIMONIAL_CONSENT_CURRENT_VERSION = 'tv1'

export const TESTIMONIAL_CONSENT_TEXTS: Record<string, string> = {
  tv1: `Ich bin damit einverstanden, dass FinestSites meinen Erfahrungsbericht (Text, Fotos, Video, Audio) zusammen mit meinem Namen in der von mir gewählten Darstellung veröffentlicht. Konkret heißt das:

1. Veröffentlichung: Mein Bericht darf auf Websites von FinestSites (zum Beispiel auf der Fallstudien-Seite) und in Werbematerialien von FinestSites gezeigt werden.

2. Nutzung durch andere Anwender: Auch andere Nutzer von FinestSites dürfen meinen Bericht auf ihren über FinestSites erstellten Websites einbinden.

3. Kleine Anpassungen: FinestSites darf meinen Bericht minimal bearbeiten, zum Beispiel um Rechtschreibfehler zu korrigieren oder Aussagen zu entfernen, die rechtlich nicht erlaubt sind (etwa Heil- oder Wirkversprechen). Der Sinn meines Berichts wird dabei nicht verändert.

4. Widerruf: Ich kann diese Einwilligung jederzeit ohne Angabe von Gründen widerrufen. Dafür reicht eine formlose E-Mail an hello@finestsites.io. Mein Bericht wird dann zeitnah von allen FinestSites-Seiten entfernt. Die Rechtmäßigkeit der Nutzung bis zum Widerruf bleibt davon unberührt.

5. Meine Daten: Meine E-Mail-Adresse wird nur genutzt, um mich wegen meines Berichts und meiner kostenlosen Fallstudien-Seite zu kontaktieren. Sie wird nicht veröffentlicht und nicht an Dritte weitergegeben.

Diese Einwilligung gebe ich freiwillig ab. Die Inhalte stammen von mir und ich habe die Rechte an allen hochgeladenen Fotos und Videos.`,
}

export function getCurrentTestimonialConsentText(): string {
  return TESTIMONIAL_CONSENT_TEXTS[TESTIMONIAL_CONSENT_CURRENT_VERSION]
}
