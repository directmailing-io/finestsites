import { Stack } from 'expo-router';

import { stackOptions } from '@/lib/nav';

export default function StartStack() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ title: 'Mitteilungen' }} />
    </Stack>
  );
}
