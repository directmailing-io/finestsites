import { ScanFace } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { biometricKind, biometricLabel, useLock, type BiometricKind } from '@/lib/lock';
import { colors, radius, shadows } from '@/theme/tokens';

import { Button, Logo, Text } from './ui';

/**
 * Sperrbildschirm (Muster FrankenBERATER LockScreen): deckt die ganze App ab, fragt
 * Face ID beim Erscheinen sofort ab. Ausweg ohne Biometrie: abmelden.
 */
export function LockScreen() {
  const unlock = useLock(s => s.unlock);
  const signOut = useAuth(s => s.signOut);
  const [kind, setKind] = useState<BiometricKind>('faceid');
  const [busy, setBusy] = useState(false);

  async function tryUnlock() {
    setBusy(true);
    await unlock();
    setBusy(false);
  }

  useEffect(() => {
    void biometricKind().then(setKind);
    void tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container} accessibilityViewIsModal>
      <View style={styles.content}>
        <Logo height={24} />
        <View style={styles.icon}>
          <ScanFace size={30} color={colors.ink} strokeWidth={1.75} />
        </View>
        <Text variant="title" align="center">
          FinestSites ist gesperrt
        </Text>
        <Text variant="callout" align="center" style={{ maxWidth: 300 }}>
          Entsperre die App mit {biometricLabel(kind)}, damit nur du deine Anfragen siehst.
        </Text>
        <Button title="Entsperren" onPress={tryUnlock} loading={busy} fullWidth style={{ marginTop: 12 }} />
        <Button title="Abmelden" variant="link" onPress={() => void signOut()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: { alignItems: 'center', gap: 14, width: '100%', maxWidth: 360 },
  icon: {
    width: 72,
    height: 72,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    marginBottom: 6,
    ...shadows.soft,
  },
});
