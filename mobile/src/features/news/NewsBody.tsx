import { Check } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { newsBodyBlocks } from '@/api/contracts/news';
import { Text } from '@/components/ui';
import { colors, fonts } from '@/theme/tokens';

import { NEWS_ON_SOLID, NEWS_UI } from './NewsAccent';

/**
 * Inhalt einer Neuigkeit, gerendert AUSSCHLIESSLICH über newsBodyBlocks() aus dem Vertrag
 * (Web und App lesen identisch). Erster Absatz als Vorspann (17/26, medium), weitere 15.5/24,
 * Aufzählungen als Merkmal-Zeilen mit neutralem Häkchen-Kreis (hellgrau, Haken in Tinte) – wie im Web.
 */
export function NewsBody({ body, onSolid = false }: { body: string; onSolid?: boolean }) {
  const blocks = newsBodyBlocks(body);
  let paragraphs = 0;
  // Auf dem Pastellverlauf der aufgeklappten Karte: Tinte über Deckkraft, weißliche Häkchen-Kreise
  const leadStyle = onSolid ? [styles.lead, { color: colors.ink }] : styles.lead;
  const textStyle = onSolid ? [styles.paragraph, { color: NEWS_ON_SOLID.body }] : styles.paragraph;
  const itemStyle = onSolid ? [styles.itemText, { color: NEWS_ON_SOLID.body }] : styles.itemText;
  const checkStyle = onSolid ? [styles.check, { backgroundColor: NEWS_ON_SOLID.check }] : styles.check;
  return (
    <View style={styles.body}>
      {blocks.map((b, i) => {
        if (b.type === 'paragraph') {
          const lead = paragraphs++ === 0;
          return (
            <Text key={i} style={lead ? leadStyle : textStyle}>
              {b.text}
            </Text>
          );
        }
        return (
          <View key={i} style={styles.list} accessibilityRole="list">
            {b.items.map((item, j) => (
              <View key={j} style={styles.item}>
                <View style={checkStyle} accessibilityElementsHidden>
                  <Check size={13} color={colors.ink} strokeWidth={2.75} />
                </View>
                <Text style={itemStyle}>{item}</Text>
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
  // Kreis 22 pt, mittig zur ersten Zeile (lineHeight 24); #F3F4F6 = gray-100 wie im Web
  check: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  itemText: { flex: 1, fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 24, color: colors.body },
});
