import { useLocalSearchParams, useRouter } from 'expo-router';
import { BellRing } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { markPushPrimed, registerPushDevice, requestPushPermission } from '@/lib/push';
import { colors, radius, shadows } from '@/theme/tokens';

/**
 * Vorab-Hinweis vor der System-Abfrage. Kommt erst nach der ersten Veröffentlichung
 * oder der ersten Support-Nachricht – nie beim ersten Start. Nur einmal.
 */
export default function PushPrimingScreen() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  async function allow() {
    await markPushPrimed();
    if (await requestPushPermission()) void registerPushDevice();
    router.back();
  }
  async function later() {
    await markPushPrimed();
    router.back();
  }

  return (
    <View style={[styles.flex, { paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.icon}>
        <BellRing size={30} color={colors.accent} strokeWidth={1.75} />
      </View>
      <Text variant="title" align="center">
        {reason === 'support' ? 'Antwort sofort sehen?' : 'Neue Anfragen sofort sehen?'}
      </Text>
      <Text variant="body" align="center" color={colors.secondary} style={{ maxWidth: 380 }}>
        {reason === 'support'
          ? 'Wir sagen dir Bescheid, sobald der Support geantwortet hat.'
          : 'Wir sagen dir Bescheid, sobald jemand über deine Seite eine Anfrage schickt. Namen und Nachrichten stehen nie auf dem Sperrbildschirm.'}
      </Text>
      <View style={{ gap: 8, alignSelf: 'stretch', marginTop: 12 }}>
        <Button title="Mitteilungen erlauben" onPress={allow} fullWidth />
        <Button title="Später" variant="link" onPress={later} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, alignItems: 'center', padding: 28, paddingTop: 36, gap: 12, backgroundColor: colors.white },
  icon: {
    width: 72,
    height: 72,
    borderRadius: radius.card,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    ...shadows.soft,
  },
});
