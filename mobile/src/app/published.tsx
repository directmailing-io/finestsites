import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ExternalLink, QrCode, Share2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type HostInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { QrSheet } from '@/features/sites/QrSheet';
import { openInBrowser } from '@/lib/links';
import { shouldPrimePush } from '@/lib/push';
import { shareLink } from '@/lib/share';
import { colors, fonts } from '@/theme/tokens';

/** Native Bestätigung nach dem Veröffentlichen (ersetzt Toast/Feier-Fenster des Webs). */
export default function PublishedScreen() {
  const { siteId, url, first } = useLocalSearchParams<{ siteId: string; url?: string; first?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const shareRef = useRef<HostInstance>(null);
  const [qr, setQr] = useState(false);
  const isFirst = first === '1';
  const display = url ? url.replace(/^https:\/\//, '') : null;

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  async function finish() {
    const prime = isFirst && (await shouldPrimePush());
    router.dismissTo({ pathname: '/sites', params: { live: siteId } });
    if (prime) setTimeout(() => router.push({ pathname: '/push-priming', params: { reason: 'publish' } }), 400);
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.content}>
        <View style={styles.check}>
          <Check size={40} color={colors.white} strokeWidth={3} />
        </View>
        <Text variant="display" align="center">
          {isFirst ? 'Deine Seite ist online!' : 'Deine Änderungen sind live'}
        </Text>
        <Text variant="bodyLarge" align="center" color={colors.secondary}>
          {isFirst
            ? 'Ab jetzt kann jeder sie sehen. In der Übersicht unter „Seiten“ findest du sie jederzeit wieder.'
            : 'Alle Besucher sehen ab sofort die neue Fassung.'}
        </Text>
        {display && (
          <View style={styles.url}>
            <Text style={styles.urlText} selectable>
              {display}
            </Text>
          </View>
        )}
        {url ? (
          <View style={{ gap: 8, alignSelf: 'stretch' }}>
            <Button title="Seite ansehen" icon={ExternalLink} variant="secondary" onPress={() => openInBrowser(url)} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button ref={shareRef} title="Link teilen" icon={Share2} variant="secondary" style={{ flex: 1 }} onPress={() => shareLink(url, shareRef)} />
              <Button title="QR-Code" icon={QrCode} variant="secondary" style={{ flex: 1 }} onPress={() => setQr(true)} />
            </View>
          </View>
        ) : null}
      </View>
      <Button title="Zur Übersicht" onPress={finish} fullWidth style={styles.bottom} />
      {url ? <QrSheet visible={qr} onClose={() => setQr(false)} url={url} title="Meine Seite" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 24, alignItems: 'center' },
  content: { flex: 1, width: '100%', maxWidth: 480, alignItems: 'center', gap: 16 },
  check: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.successDot,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: colors.successDot,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  url: { backgroundColor: colors.successSoft, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10 },
  urlText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.success },
  bottom: { width: '100%', maxWidth: 480 },
});
