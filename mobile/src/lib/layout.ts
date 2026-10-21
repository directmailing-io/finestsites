import { useWindowDimensions } from 'react-native';

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
  const pad = regular ? gutter.regular : gutter.compact;
  return {
    width,
    height,
    regular,
    columns,
    gutter: pad,
    /** Breite der Liste in geteilten Ansichten */
    listWidth: Math.min(400, Math.max(320, Math.round(width * 0.36))),
    readableWidth,
  };
}
