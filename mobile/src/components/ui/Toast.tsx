import { Check, X } from 'lucide-react-native';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius, shadows } from '@/theme/tokens';

import { Text } from './Text';

type Tone = 'neutral' | 'success' | 'error';
interface ToastApi {
  show: (message: string, tone?: Tone) => void;
}

const Ctx = createContext<ToastApi>({ show: () => {} });

export const useToast = () => useContext(Ctx);

/**
 * Kurze Rückmeldung unten (dunkle Leiste wie die Auswahl-Leiste in „Anfragen“).
 * Wird auch VoiceOver vorgelesen.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; tone: Tone } | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, tone: Tone = 'neutral') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, tone });
      AccessibilityInfo.announceForAccessibility(message);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 220 }).start();
      timer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setToast(null));
      }, 2600);
    },
    [anim],
  );

  const Icon = toast?.tone === 'error' ? X : Check;
  const bg = toast?.tone === 'success' ? colors.successDot : toast?.tone === 'error' ? colors.dangerStrong : colors.foreground;

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {toast && (
        <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + 72 }]}>
          <Animated.View
            style={[
              styles.toast,
              { backgroundColor: bg },
              { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] },
            ]}>
            {toast.tone !== 'neutral' && <Icon size={16} color={colors.white} strokeWidth={2.5} />}
            <Text style={styles.text}>{toast.message}</Text>
          </Animated.View>
        </View>
      )}
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.input,
    maxWidth: 520,
    ...shadows.lg,
  },
  text: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: colors.white, flexShrink: 1 },
});
