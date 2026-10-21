import type { Href } from 'expo-router';

import type { Me } from '@/api/types';

export const STEPS = ['username', 'consent', 'team-partner', 'photo'] as const;
export type Step = (typeof STEPS)[number];

/** Nächster offener Schritt der Ersteinrichtung (Pflicht: Benutzername, Einwilligung; freiwillig: Nummer, Foto). */
export function nextStep(me: Me, after?: Step): Href {
  const start = after ? STEPS.indexOf(after) + 1 : 0;
  for (const s of STEPS.slice(start)) {
    if (s === 'username' && me.onboarding.needs_username) return '/onboarding/username';
    if (s === 'consent' && me.onboarding.needs_consent) return '/onboarding/consent';
    if (s === 'team-partner' && me.onboarding.offer_team_partner && !me.team_partner_number) return '/onboarding/team-partner';
    if (s === 'photo' && me.onboarding.offer_photo && !me.profile_image_url) return '/onboarding/photo';
  }
  return '/start';
}
