import { Image } from 'expo-image';
import { User } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { avatarColor, initials } from '@/features/inbox/helpers';
import { colors, fonts } from '@/theme/tokens';

import { Text } from './Text';

/** Initialen-Avatar mit fester Farbe je Name (wie in „Anfragen“). */
export function InitialsAvatar({ name, size = 48 }: { name: string; size?: number }) {
  const c = avatarColor(name);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.bg }]}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: size * 0.36, color: c.fg, letterSpacing: -0.2 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

/** Profilfoto oder Platzhalter (wie im Profil: grauer Kreis mit Personen-Symbol). */
export function ProfilePhoto({ url, size = 80 }: { url: string | null | undefined; size?: number }) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceSoft, borderWidth: 2, borderColor: colors.border },
      ]}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: size - 4, height: size - 4, borderRadius: size / 2 }} contentFit="cover" />
      ) : (
        <User size={size * 0.32} color={colors.hairline} strokeWidth={1.5} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
