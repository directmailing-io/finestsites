import { Check } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { newsBodyBlocks } from '@/api/contracts/news';
import { Text } from '@/components/ui';
import { colors, fonts } from '@/theme/tokens';

import { NEWS_UI, type NewsPalette } from './NewsAccent';

/**
 * Inhalt einer Neuigkeit, gerendert AUSSCHLIESSLICH über newsBodyBlocks() aus dem Vertrag
 * (Web und App lesen identisch). Erster Absatz als Vorspann (17/26, medium), weitere 15.5/24,
 * Aufzählungen als Merkmal-Zeilen: Kreis im Pastellton der Neuigkeit mit Häkchen in ihrer Tinte.
 */
export function NewsBody({ body, palette }: { body: string; palette: NewsPalette }) {
  const blocks = newsBodyBlocks(body);
  let paragraphs = 0;
  return (
    <View style={styles.body}>
      {blocks.map((b, i) => {
        if (b.type === 'paragraph') {
          const lead = paragraphs++ === 0;
          return (
            <Text key={i} style={lead ? styles.lead : styles.paragraph}>
              {b.text}
            </Text>
          );
        }
        return (
          <View key={i} style={styles.list} accessibilityRole="list">
            {b.items.map((item, j) => (
              <View key={j} style={styles.item}>
                <View style={[styles.check, { backgroundColor: palette.tint }]} accessibilityElementsHidden>
                  <Check size={13} color={palette.ink} strokeWidth={3} />
                </View>
                <Text style={styles.itemText}>{item}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16 },
  lead: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 26, letterSpacing: -0.1, color: NEWS_UI.lead },
  paragraph: { fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 24, color: colors.body },
  list: { gap: 10, paddingVertical: 2 },
  item: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  // Kreis 22 pt, mittig zur ersten Zeile (lineHeight 24)
  check: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  itemText: { flex: 1, fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 24, color: colors.body },
});
