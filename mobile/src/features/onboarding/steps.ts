import type { Href } from 'expo-router';

import type { Me } from '@/api/types';

export const STEPS = ['username', 'consent', 'team-partner', 'photo'] as const;
export type Step = (typeof STEPS)[number];

/** Nächster offener Schritt der Ersteinrichtung (Pflicht: Benutzername, Einwilligung; freiwillig: Nummer, Foto). */
export function nextStep(me: Me, after?: Step): Href {
  const start = after ? STEPS.indexOf(after) + 1 : 0;
  // Wer gerade einen Schritt der Einrichtung abgeschlossen hat, bekommt die freiwilligen Schritte angeboten
  const offerOptional = after !== undefined;
  for (const s of STEPS.slice(start)) {
    if (s === 'username' && !me.onboarding.usernameSet) return '/onboarding/username';
    if (s === 'consent' && !me.onboarding.consentGiven) return '/onboarding/consent';
    // Freiwillige Schritte nur direkt nach der Pflicht-Einrichtung anbieten (nicht bei jedem Start)
    if (s === 'team-partner' && offerOptional && !me.user.teamPartnerNumber) return '/onboarding/team-partner';
    if (s === 'photo' && offerOptional && !me.user.profileImageUrl) return '/onboarding/photo';
  }
  return '/start';
}
