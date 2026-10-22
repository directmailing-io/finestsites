import { Stack } from 'expo-router';

import { stackOptions } from '@/lib/nav';

export default function ChatsStack() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Chat' }} />
    </Stack>
  );
}
