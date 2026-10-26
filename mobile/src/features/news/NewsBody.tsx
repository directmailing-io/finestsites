import { StyleSheet, View } from 'react-native';

import { newsBodyBlocks } from '@/api/contracts/news';
import { Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

/**
 * Inhalt einer Neuigkeit, gerendert AUSSCHLIESSLICH über newsBodyBlocks() aus dem Vertrag
 * (Web und App lesen identisch): Absätze in typography.body, Aufzählung mit Punkt in Akzentfarbe.
 */
export function NewsBody({ body }: { body: string }) {
  const blocks = newsBodyBlocks(body);
  return (
    <View style={styles.body}>
      {blocks.map((b, i) =>
        b.type === 'paragraph' ? (
          <Text key={i} variant="body">
            {b.text}
          </Text>
        ) : (
          <View key={i} style={styles.list} accessibilityRole="list">
            {b.items.map((item, j) => (
              <View key={j} style={styles.item}>
                <View style={styles.dot} />
                <Text variant="body" style={{ flex: 1 }}>
                  {item}
                </Text>
              </View>
            ))}
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14 },
  list: { gap: 8 },
  item: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  // Punkt mittig zur ersten Zeile (lineHeight 22)
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent, marginTop: 8, marginLeft: 2 },
});
