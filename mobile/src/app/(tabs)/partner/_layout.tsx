import { Stack } from 'expo-router';

import { stackOptions } from '@/lib/nav';

/** Partnerbereich als eigener Tab (Daniel 02.11.2026: in die Leiste, Support dafür unter „Mehr“). */
export default function PartnerStack() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ title: 'Partnerprogramm' }} />
      <Stack.Screen name="tax" options={{ title: 'Angaben für die Abrechnung' }} />
      <Stack.Screen name="credit-notes" options={{ title: 'Gutschriften' }} />
      <Stack.Screen name="history" options={{ title: 'Verlauf' }} />
      <Stack.Screen name="referrals" options={{ title: 'Deine Empfehlungen' }} />
    </Stack>
  );
}
