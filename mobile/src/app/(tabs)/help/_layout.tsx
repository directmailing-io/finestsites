import { Stack } from 'expo-router';

import { stackOptions } from '@/lib/nav';

export default function HelpStack() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Support' }} />
    </Stack>
  );
}
