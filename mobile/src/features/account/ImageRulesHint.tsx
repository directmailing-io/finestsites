import { ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { fonts } from '@/theme/tokens';

/**
 * Hinweis bei jedem Bild-Upload wie ImageRulesHint im Web (src/components/editor/ImageRulesHint.tsx):
 * keine Vorher-Nachher-Bilder, Details erst auf Tippen.
 */
export function ImageRulesHint() {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <ShieldCheck size={15} color="#64748B" strokeWidth={2} style={{ marginTop: 1.5 }} />
        <Text style={styles.text}>
          Bitte keine Vorher-Nachher-Bilder und keine Körper-, Haut- oder Gewichtsvergleiche.{' '}
          <Text style={styles.link} onPress={() => setOpen(o => !o)} accessibilityRole="button">
            {open ? 'Weniger' : 'Warum?'}
          </Text>
        </Text>
      </View>
      {open && (
        <Text style={[styles.text, styles.more]}>
          Solche Bilder gelten rechtlich als Wirkversprechen für die Produkte und können abgemahnt werden, auch wenn sie echt sind und
          die Person zugestimmt hat. Am besten wirkt ein freundliches Porträt von dir oder ein Foto, auf dem du die Produkte im Alltag
          nutzt.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#EEF2F6' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  text: { flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 19, color: '#475569' },
  link: { fontFamily: fonts.semibold, color: '#334155' },
  more: { color: '#64748B', marginTop: 6, marginLeft: 25 },
});
