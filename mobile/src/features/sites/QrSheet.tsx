import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import { Copy, Share2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, View, type HostInstance } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button, Sheet, Text, useToast } from '@/components/ui';
import { shareFile } from '@/lib/share';
import { colors, radius } from '@/theme/tokens';

interface QrRef {
  toDataURL: (cb: (data: string) => void) => void;
}

/**
 * QR-Code zur Seite (Ersatz für „QR-Code speichern“ im Web): groß anzeigen, als Bild teilen
 * (darüber auch „Bild sichern“), Link kopieren.
 */
export function QrSheet({ visible, onClose, url, title }: { visible: boolean; onClose: () => void; url: string; title: string }) {
  const toast = useToast();
  const qrRef = useRef<QrRef | null>(null);
  const shareRef = useRef<HostInstance>(null);
  const [busy, setBusy] = useState(false);

  async function shareImage() {
    if (!qrRef.current || busy) return;
    setBusy(true);
    try {
      const base64 = await new Promise<string>(resolve => qrRef.current!.toDataURL(resolve));
      const file = new File(Paths.cache, `qr-${Date.now()}.png`);
      await file.write(base64, { encoding: 'base64' });
      await shareFile(file.uri, shareRef, { mimeType: 'image/png', UTI: 'public.png', title: 'QR-Code teilen' });
    } catch {
      toast.show('QR-Code konnte nicht erstellt werden.', 'error');
    }
    setBusy(false);
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="QR-Code" subtitle={`Scannen öffnet „${title}“.`}>
      <View style={styles.qrWrap} accessible accessibilityLabel={`QR-Code für ${url}`}>
        <QRCode value={url} size={220} quietZone={12} getRef={(c: QrRef) => (qrRef.current = c)} />
      </View>
      <Text variant="callout" align="center" selectable>
        {url.replace(/^https:\/\//, '')}
      </Text>
      <View style={{ gap: 8, marginTop: 8 }}>
        <Button ref={shareRef} title="Als Bild teilen oder sichern" icon={Share2} onPress={shareImage} loading={busy} fullWidth />
        <Button
          title="Link kopieren"
          icon={Copy}
          variant="secondary"
          fullWidth
          onPress={async () => {
            await Clipboard.setStringAsync(url);
            toast.show('Link kopiert', 'success');
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  qrWrap: {
    alignSelf: 'center',
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.borderCard,
    marginVertical: 8,
  },
});
