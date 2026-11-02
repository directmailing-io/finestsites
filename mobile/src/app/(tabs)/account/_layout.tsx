import { Stack } from 'expo-router';

import { stackOptions } from '@/lib/nav';

export default function AccountStack() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: '' }} />
      <Stack.Screen name="messages" options={{ title: 'Mitteilungen' }} />
      <Stack.Screen name="news/index" options={{ title: 'Neuigkeiten' }} />
      <Stack.Screen name="news/[id]" options={{ title: 'Neuigkeit' }} />
      <Stack.Screen name="profile" options={{ title: 'Mein Profil' }} />
      <Stack.Screen name="notifications" options={{ title: 'Push-Mitteilungen' }} />
      <Stack.Screen name="emails" options={{ title: 'E-Mails' }} />
      <Stack.Screen name="password" options={{ title: 'Passwort ändern' }} />
      <Stack.Screen name="delete" options={{ title: 'Konto löschen' }} />
    </Stack>
  );
}
