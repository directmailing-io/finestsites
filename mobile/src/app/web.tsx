import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { AppWebView } from '@/features/web/AppWebView';
import { openInBrowser } from '@/lib/links';
import { colors, fonts } from '@/theme/tokens';

/** Einzelne Web-Seite des Dashboards im App-Rahmen (z. B. Werbung & Tracking). */
export default function WebScreen() {
  const { path, title } = useLocalSearchParams<{ path: string; title?: string }>();
  const router = useRouter();
  const safePath = typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? path : '/sites';
  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: title ?? '',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
              <Text style={styles.done}>Fertig</Text>
            </Pressable>
          ),
        }}
      />
      <AppWebView
        next={safePath}
        onBridge={m => {
          if (m.type === 'close') router.back();
          if (m.type === 'open-url' && /^https:\/\//.test(m.url)) void openInBrowser(m.url);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  done: { fontFamily: fonts.semibold, fontSize: 17, color: colors.accent },
});
