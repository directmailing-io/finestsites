import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, fonts, radius, shadows } from '@/theme/tokens';

import { Text } from './Text';

export interface SegmentItem<K extends string> {
  key: K;
  label: string;
  badge?: number;
}

/**
 * Segmented Control wie die Tab-Leiste der Einstellungen:
 * Spur #ECEEF1 rounded-2xl p-1, aktives Segment #111827 weiß rounded-xl mit Schatten.
 */
export function SegmentedControl<K extends string>({
  items,
  value,
  onChange,
}: {
  items: SegmentItem<K>[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {items.map(item => {
        const active = item.key === value;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (!active) void Haptics.selectionAsync().catch(() => {});
              onChange(item.key);
            }}
            style={[styles.segment, active && styles.active]}>
            <Text style={[styles.label, { color: active ? colors.white : colors.mutedForeground }]} numberOfLines={1}>
              {item.label}
            </Text>
            {!!item.badge && item.badge > 0 && (
              <View style={[styles.badge, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : colors.ink }]}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Unterstrich-Tabs wie in „Anfragen“ (Alle / Ungelesen / Archiviert).
 */
export function UnderlineTabs<K extends string>({
  items,
  value,
  onChange,
}: {
  items: SegmentItem<K>[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <View style={styles.underlineBar} accessibilityRole="tablist">
      {items.map(item => {
        const active = item.key === value;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.key)}
            style={styles.underlineTab}>
            <Text style={[styles.underlineLabel, { color: active ? colors.foreground : colors.mutedForeground }]}>
              {item.label}
            </Text>
            {!!item.badge && item.badge > 0 && (
              <View style={styles.underlineBadge}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            )}
            <View style={[styles.underline, { opacity: active ? 1 : 0 }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    padding: 4,
    borderRadius: radius.input,
    backgroundColor: colors.segmentTrack,
  },
  segment: {
    flexGrow: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: radius.buttonSmall,
  },
  active: { backgroundColor: colors.ink, ...shadows.segment },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, color: colors.white },
  underlineBar: { flexDirection: 'row', gap: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  underlineTab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, minHeight: 46 },
  underlineLabel: { fontFamily: fonts.semibold, fontSize: 14 },
  underlineBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.foreground,
  },
  underline: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, borderRadius: 1, backgroundColor: colors.foreground },
});
