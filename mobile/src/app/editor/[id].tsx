import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Platform, StyleSheet, View, type HostInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { qk } from '@/api/queries';
import { useToast } from '@/components/ui';
import { QrSheet } from '@/features/sites/QrSheet';
import { AppWebView, type AppWebViewHandle } from '@/features/web/AppWebView';
import { publishBlockedText, type BridgeMessage } from '@/features/web/guard';
import { useAuth } from '@/lib/auth';
import { openInBrowser } from '@/lib/links';
import { shareLink } from '@/lib/share';
import { colors } from '@/theme/tokens';

/**
 * Editor im App-Rahmen (Vollbild-Fenster) – ohne eigene native Kopfzeile: Es erscheint genau die
 * Kopfzeile des Web-Editors, deren Zurück-Knopf im App-Modus {type:'close'} über die Brücke schickt.
 * Dazu: Schutz vor Kaufseiten, Rückfrage bei ungespeicherten Änderungen, native Bestätigung nach dem
 * Veröffentlichen.
 */
export default function EditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const signOut = useAuth(s => s.signOut);
  const webRef = useRef<AppWebViewHandle>(null);
  // Ankerpunkt fürs Teilen-Fenster auf dem iPad (oben rechts, wo im Web-Editor die Aktionen sitzen)
  const anchorRef = useRef<HostInstance>(null);
  const [dirty, setDirty] = useState(false);
  const [qr, setQr] = useState<{ url: string; title: string } | null>(null);

  const refreshData = useCallback(() => {
    void qc.invalidateQueries({ queryKey: qk.sites });
    void qc.invalidateQueries({ queryKey: qk.overview });
  }, [qc]);

  const close = useCallback(() => {
    const leave = () => {
      refreshData();
      router.back();
    };
    if (!dirty) return leave();
    Alert.alert('Ungespeicherte Änderungen', 'Wenn du jetzt schließt, gehen deine letzten Änderungen verloren.', [
      { text: 'Weiter bearbeiten', style: 'cancel' },
      { text: 'Verwerfen', style: 'destructive', onPress: leave },
    ]);
  }, [dirty, refreshData, router]);

  // Android: Zurück-Taste geht erst im Editor zurück, dann schließt sie (mit Rückfrage)
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (webRef.current?.canGoBack()) webRef.current.goBack();
      else close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const onBridge = (m: BridgeMessage) => {
    switch (m.type) {
      case 'close':
        close();
        break;
      case 'dirty':
        setDirty(m.value);
        break;
      case 'save-state':
        if (m.state === 'saved') setDirty(false);
        if (m.state === 'error') toast.show('Speichern hat nicht geklappt. Bitte prüfe deine Verbindung.', 'error');
        break;
      case 'published':
        setDirty(false);
        refreshData();
        router.replace({ pathname: '/published', params: { siteId: m.siteId || id, url: m.url, first: m.firstTime ? '1' : '0' } });
        break;
      case 'publish-blocked': {
        const t = publishBlockedText(m.code);
        Alert.alert(t.title, t.text, [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Hilfe öffnen',
            onPress: () => {
              router.back();
              router.navigate('/help');
            },
          },
        ]);
        break;
      }
      case 'share':
        void shareLink(m.url, anchorRef);
        break;
      case 'qr':
        setQr({ url: m.url, title: 'Meine Seite' });
        break;
      case 'open-url':
        if (/^https:\/\//.test(m.url)) void openInBrowser(m.url);
        break;
      case 'auth-required':
        toast.show('Bitte melde dich erneut an.', 'error');
        void signOut('expired');
        break;
    }
  };

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppWebView ref={webRef} next={`/sites/${id}/edit`} onBridge={onBridge} onClose={close} />
      <View ref={anchorRef} pointerEvents="none" style={[styles.anchor, { top: insets.top + 8 }]} />
      {qr && <QrSheet visible onClose={() => setQr(null)} url={qr.url} title={qr.title} />}
    </View>
  );
}

const styles = StyleSheet.create({
  // weiß wie die Kopfzeile des Web-Editors, damit beim Laden unter der Statusleiste nichts aufblitzt
  flex: { flex: 1, backgroundColor: colors.white },
  anchor: { position: 'absolute', right: 16, width: 44, height: 44 },
});
