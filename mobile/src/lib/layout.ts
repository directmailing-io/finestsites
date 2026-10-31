import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gutter, readableWidth } from '@/theme/tokens';

/**
 * Layout nach Fenstergröße, nicht nach Gerät: ab iOS 27 kann jedes iPad-Fenster frei
 * zwischen 320 pt und Vollbild liegen (geteilter Bildschirm, Stage Manager).
 *
 * - compact  (< 700 pt): Handy-Layout, Liste → Detail per Navigation
 * - regular  (≥ 700 pt): iPad-Layout, Liste und Detail nebeneinander, Raster für Seiten
 */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const regular = width >= 700;
  const columns = width >= 1100 ? 3 : width >= 700 ? 2 : 1;
  // Ränder wie <main> im Web-Dashboard: px-5 (20) · ab 640 px sm:px-8 (32) · ab 1024 px lg:px-12 (48)
  const pad = width >= 1024 ? gutter.wide : width >= 640 ? gutter.regular : gutter.compact;
  // Abstand oben wie <main>: pt-6 (24) · sm:pt-8 (32) · lg:pt-10 (40)
  const top = width >= 1024 ? 40 : width >= 640 ? 32 : 24;
  // Listen ohne native Kopfzeile: iOS rückt den Inhalt per contentInsetAdjustmentBehavior selbst unter die
  // Statusleiste, Android (Edge-to-Edge) nicht → dort den Statusleisten-Abstand dazurechnen (Emulator 31.10.2026:
  // „Anfragen“/„Support“ klebten in der Statusleiste).
  const insets = useSafeAreaInsets();
  const listTop = top + (Platform.OS === 'android' ? insets.top : 0);
  return {
    width,
    height,
    regular,
    columns,
    gutter: pad,
    top,
    /** Abstand oben für Listen ohne native Kopfzeile (inkl. Statusleiste auf Android) */
    listTop,
    /** Breite der Liste in geteilten Ansichten */
    listWidth: Math.min(400, Math.max(320, Math.round(width * 0.36))),
    readableWidth,
  };
}
