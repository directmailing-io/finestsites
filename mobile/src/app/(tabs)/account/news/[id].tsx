import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Alte Detail-Route (Ziel der Push-Mitteilung finestsites://news/<id>, src/lib/push.ts): es gibt nur
 * noch die eine Ansicht – die Liste klappt die gewünschte Neuigkeit direkt auf (`?open=<id>`).
 */
export default function NewsDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/account/news', params: id ? { open: id } : {} }} />;
}
