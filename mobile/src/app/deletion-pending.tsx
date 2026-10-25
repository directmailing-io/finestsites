import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { humanError } from '@/api/client';
import { cancelDeletion } from '@/api/endpoints';
import { qk, useDeletionStatus } from '@/api/queries';
import { Button, Notice, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
import { colors, radius, readableWidth } from '@/theme/tokens';

/**
 * Vorgemerkte Kontolöschung.
 *   • Weg „sofort“: Die App zeigt nach dem Anmelden nur diesen Bildschirm (Tabs leiten hierher). „Löschung
 *     abbrechen“ stellt das Konto wieder her; die Seiten bleiben offline, bis sie neu veröffentlicht werden.
 *   • Weg „zum Laufzeitende“: erreichbar über den Hinweis unter „Mehr“. Abbrechen nimmt die Kündigung zurück,
 *     das Abo läuft weiter.
 */
export default function DeletionPendingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const signOut = useAuth(s => s.signOut);
  const status = useDeletionStatus();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const date = status.data?.scheduledFor ? fmtDate(status.data.scheduledFor) : null;
  const periodEnd = status.data?.mode === 'period_end';

  async function cancel() {
    setLoading(true);
    setError('');
    try {
      await cancelDeletion();
      await queryClient.invalidateQueries();
      queryClient.setQueryData(qk.deletion, undefined);
      router.replace('/sites');
    } catch (e) {
      setError(humanError(e));
      setLoading(false);
    }
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.inner}>
        <View style={styles.icon}>
          <Clock size={28} color={colors.dangerInk} strokeWidth={1.75} />
        </View>
        <Text variant="title" align="center">
          {date ? `Konto wird gelöscht am ${date}` : 'Konto wird gelöscht'}
        </Text>
        {periodEnd ? (
          <>
            <Text variant="body" align="center" color={colors.secondary}>
              Dein Abo ist zum Laufzeitende gekündigt. Bis dahin bleiben deine Webseiten online und du kannst die App wie gewohnt nutzen.
            </Text>
            <Text variant="body" align="center" color={colors.secondary}>
              Brichst du die Löschung ab, läuft dein Abo einfach weiter wie vorher.
            </Text>
          </>
        ) : (
          <>
            <Text variant="body" align="center" color={colors.secondary}>
              Deine Webseiten sind offline. Bis zu diesem Tag kannst du die Löschung abbrechen.
            </Text>
            <Text variant="body" align="center" color={colors.secondary}>
              Danach bleiben deine Seiten zunächst offline. Du kannst sie selbst wieder veröffentlichen.
            </Text>
          </>
        )}
        {!!error && <Notice tone="danger">{error}</Notice>}
        <View style={{ gap: 10, alignSelf: 'stretch', marginTop: 8 }}>
          <Button title="Löschung abbrechen" onPress={cancel} loading={loading} fullWidth />
          {periodEnd ? (
            <Button title="Zurück" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/account'))} fullWidth />
          ) : (
            <Button title="Abmelden" variant="secondary" onPress={() => void signOut()} fullWidth />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 24 },
  inner: { width: '100%', maxWidth: readableWidth, alignSelf: 'center', alignItems: 'center', gap: 14 },
  icon: { width: 64, height: 64, borderRadius: radius.input, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
});
