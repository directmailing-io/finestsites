import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Copy, Download, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type HostInstance } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { Confetti } from '@/features/celebration/Confetti';
import { QrSheet } from '@/features/sites/QrSheet';
import { copyText } from '@/lib/clipboard';
import { openInBrowser } from '@/lib/links';
import { shouldPrimePush } from '@/lib/push';
import { shareLink } from '@/lib/share';
import { colors, fonts, radius } from '@/theme/tokens';

/**
 * Nach dem Veröffentlichen: dasselbe Feierfenster wie im Web (PublishCelebrationModal in
 * sites/[id]/edit/page.tsx) – Konfetti, grüner Haken, Adresse mit Kopieren-Knopf, QR-Code,
 * „Webseite öffnen →“, „Teilen ↗“, „Schließen“. Danach zur Übersicht mit grün leuchtender Karte.
 */
export default function PublishedScreen() {
  const { siteId, url, first } = useLocalSearchParams<{ siteId: string; url?: string; first?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const shareRef = useRef<HostInstance>(null);
  const [qr, setQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const isFirst = first === '1';

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  async function finish() {
    const prime = isFirst && (await shouldPrimePush());
    router.dismissTo({ pathname: '/sites', params: { live: siteId, at: String(Date.now()) } });
    if (prime) setTimeout(() => router.push({ pathname: '/push-priming', params: { reason: 'publish' } }), 400);
  }

  async function copy() {
    if (!url) return;
    if (await copyText(url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <View style={styles.backdrop}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {/* Tippen neben das Fenster schließt es (wie im Web) */}
        <Pressable
          onPress={finish}
          accessible={false}
          style={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: Math.max(16, insets.bottom) }]}>
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <Pressable onPress={finish} style={styles.close} accessibilityRole="button" accessibilityLabel="Schließen" hitSlop={8}>
            <X size={12} color={colors.faint} strokeWidth={2.4} />
          </Pressable>

          <View style={styles.check}>
            <Check size={28} color={colors.white} strokeWidth={3} />
          </View>

          <Text style={styles.headline} accessibilityRole="header">
            {isFirst ? 'Deine Webseite ist live! 🎉' : 'Änderungen sind live! 🎉'}
          </Text>
          <Text style={styles.sub}>Teile deine Seite mit der Welt.</Text>

          {url ? (
            <>
              {/* Adresse mit Kopieren-Knopf – ein Tipp kopiert den Link */}
              <Pressable onPress={copy} style={styles.urlBox} accessibilityRole="button" accessibilityLabel={`Link kopieren: ${url}`}>
                <Text style={styles.urlText} selectable>
                  {url}
                </Text>
                <View style={[styles.copyBtn, copied && { backgroundColor: colors.successDot }]}>
                  {copied ? <Check size={14} color={colors.white} strokeWidth={2.5} /> : <Copy size={14} color={colors.mutedForeground} strokeWidth={2} />}
                </View>
              </Pressable>

              <View style={styles.qr} accessible accessibilityLabel={`QR-Code für ${url}`}>
                <QRCode value={url} size={110} quietZone={8} />
              </View>
              <Pressable onPress={() => setQr(true)} style={styles.qrLink} accessibilityRole="button" hitSlop={6}>
                <Download size={13} color="#6B46C1" strokeWidth={2.25} />
                <Text style={styles.qrLinkText}>QR-Code als Bild herunterladen</Text>
              </Pressable>

              <View style={{ alignSelf: 'stretch', gap: 8 }}>
                <Pressable onPress={() => openInBrowser(url)} style={({ pressed }) => [styles.open, pressed && { opacity: 0.88 }]} accessibilityRole="button">
                  <Text style={styles.openText}>Webseite öffnen →</Text>
                </Pressable>
                <Pressable
                  ref={shareRef}
                  onPress={() => shareLink(url, shareRef, 'Meine Website')}
                  style={({ pressed }) => [styles.share, pressed && { backgroundColor: colors.mutedPressed }]}
                  accessibilityRole="button">
                  <Text style={styles.shareText}>Teilen ↗</Text>
                </Pressable>
                <Pressable onPress={finish} style={styles.closeText} accessibilityRole="button">
                  <Text style={styles.closeTextLabel}>Schließen</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable onPress={finish} style={styles.closeText} accessibilityRole="button">
              <Text style={styles.closeTextLabel}>Schließen</Text>
            </Pressable>
          )}
        </View>
        </Pressable>
      </ScrollView>
      <Confetti />
      {/* Eigene kurze Rückmeldung: der App-Toast liegt unter diesem Fenster */}
      {copied && (
        <View pointerEvents="none" style={[styles.toastHost, { bottom: insets.bottom + 24 }]} accessibilityLiveRegion="polite">
          <View style={styles.toast}>
            <Check size={16} color={colors.white} strokeWidth={2.5} />
            <Text style={styles.toastText}>Link kopiert</Text>
          </View>
        </View>
      )}
      {url ? <QrSheet visible={qr} onClose={() => setQr(false)} url={url} title="Meine Seite" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  toastHost: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.input,
    backgroundColor: colors.successDot,
  },
  toastText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.white },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: 28,
    paddingTop: 36,
    paddingHorizontal: 28,
    paddingBottom: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 32 },
  },
  close: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1FB356',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#22c55e',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  headline: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 26, color: '#111111', textAlign: 'center', marginBottom: 4 },
  sub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.mutedForeground, textAlign: 'center', marginBottom: 20 },
  urlBox: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.muted,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  urlText: { flex: 1, fontFamily: 'Menlo', fontSize: 12, lineHeight: 17, color: colors.body },
  copyBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  qr: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 8, marginBottom: 8, backgroundColor: colors.white },
  qrLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 8, marginBottom: 16, minHeight: 32 },
  qrLinkText: { fontFamily: fonts.semibold, fontSize: 12, color: '#6B46C1' },
  open: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 99,
    backgroundColor: '#111111',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  openText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  share: { alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 99, backgroundColor: colors.muted },
  shareText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.body },
  closeText: { alignItems: 'center', justifyContent: 'center', paddingVertical: 11, minHeight: 44 },
  closeTextLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.faint },
});
