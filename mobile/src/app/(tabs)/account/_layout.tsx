import { Stack } from 'expo-router';

import { stackOptions } from '@/lib/nav';

export default function AccountStack() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ title: 'Mein Profil' }} />
      <Stack.Screen name="notifications" options={{ title: 'Mitteilungen' }} />
      <Stack.Screen name="emails" options={{ title: 'E-Mails' }} />
      <Stack.Screen name="password" options={{ title: 'Passwort ändern' }} />
      <Stack.Screen name="delete" options={{ title: 'Konto löschen' }} />
      <Stack.Screen name="partner/index" options={{ title: 'Partnerprogramm' }} />
      <Stack.Screen name="partner/tax" options={{ title: 'Angaben für die Abrechnung' }} />
      <Stack.Screen name="partner/credit-notes" options={{ title: 'Gutschriften' }} />
      <Stack.Screen name="partner/history" options={{ title: 'Verlauf' }} />
      <Stack.Screen name="partner/referrals" options={{ title: 'Deine Empfehlungen' }} />
    </Stack>
  );
}
