import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Submission } from '@/api/types';
import { InitialsAvatar, Text } from '@/components/ui';
import { smartTime } from '@/lib/format';
import { colors, fonts } from '@/theme/tokens';

import { displayName, formLabel, previewText } from './helpers';

/** Zeile wie in „Anfragen“: Avatar 48, Name fett wenn ungelesen, Zeit rechts, Vorschau, Formular · Seite. */
export const SubmissionRow = memo(function SubmissionRow({
  s,
  selected,
  onPress,
}: {
  s: Submission;
  selected?: boolean;
  onPress: () => void;
}) {
  const unread = !s.read_at;
  const name = displayName(s.data);
  const preview = previewText(s.data);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Ungelesen. ' : ''}${name}, ${smartTime(s.created_at)}. ${preview}`}
      style={({ pressed }) => [styles.row, (pressed || selected) && styles.active]}>
      <View>
        <InitialsAvatar name={name} size={48} />
        {unread && <View style={styles.dot} />}
      </View>
      <View style={styles.content}>
        <View style={styles.top}>
          <Text
            numberOfLines={1}
            style={[styles.name, { fontFamily: unread ? fonts.bold : fonts.medium, color: unread ? colors.inkStrong : colors.ink }]}>
            {name}
          </Text>
          <Text style={[styles.time, { color: unread ? colors.foreground : colors.faint, fontFamily: unread ? fonts.semibold : fonts.regular }]}>
            {smartTime(s.created_at)}
          </Text>
        </View>
        {!!preview && (
          <Text numberOfLines={1} variant="callout" color={unread ? colors.body : colors.mutedForeground}>
            {preview}
          </Text>
        )}
        <Text numberOfLines={1} style={styles.meta}>
          {formLabel(s.form_name)}
          {s.site ? ` · ${s.site.title}` : ''}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 16,
    minHeight: 72,
    borderRadius: 16,
  },
  active: { backgroundColor: colors.white },
  dot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.foreground,
    borderWidth: 2,
    borderColor: colors.white,
  },
  content: { flex: 1, gap: 3 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontSize: 15, lineHeight: 20, letterSpacing: -0.1 },
  time: { fontSize: 12 },
  meta: { fontFamily: fonts.medium, fontSize: 11, color: colors.tertiary },
});
