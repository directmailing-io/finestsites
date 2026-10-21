import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout } from '@/lib/layout';
import { colors, radius, shadows } from '@/theme/tokens';

import { Text } from './Text';

/**
 * Sheet wie das Anfrage-Fenster im Web: auf dem Handy von unten (rounded-t-3xl, Griff),
 * auf dem iPad als zentrierte Karte (max. 560 pt). Schließt per Hintergrund-Tippen.
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { regular, height } = useLayout();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={regular ? 'fade' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape', 'portrait-upside-down', 'landscape-left', 'landscape-right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={[styles.backdrop, regular ? styles.center : styles.bottom]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Schließen" />
          <View
            accessibilityViewIsModal
            style={[
              styles.panel,
              regular ? styles.panelRegular : styles.panelCompact,
              { maxHeight: height * (regular ? 0.88 : 0.92) },
              !regular && { paddingBottom: Math.max(insets.bottom, 16) },
            ]}>
            {!regular && <View style={styles.handle} />}
            {(title || subtitle) && (
              <View style={styles.header}>
                <View style={{ flex: 1, gap: 4 }}>
                  {title && (
                    <Text variant="title" accessibilityRole="header">
                      {title}
                    </Text>
                  )}
                  {subtitle && <Text variant="callout">{subtitle}</Text>}
                </View>
                <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Schließen">
                  <X size={14} color={colors.body} strokeWidth={2.5} />
                </Pressable>
              </View>
            )}
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" bounces={false}>
              {children}
            </ScrollView>
            {footer && <View style={styles.footer}>{footer}</View>}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  bottom: { justifyContent: 'flex-end' },
  center: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  panel: { backgroundColor: colors.white, overflow: 'hidden', ...shadows.sheet },
  panelCompact: { borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  panelRegular: { borderRadius: radius.sheet, width: '100%', maxWidth: 560 },
  handle: { alignSelf: 'center', width: 48, height: 6, borderRadius: 3, backgroundColor: '#D1D5DB', marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 24, paddingBottom: 20, gap: 12 },
  footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: '#FCFCFD' },
});
