/**
 * Design-Werte 1:1 aus der Webapp übernommen.
 *
 * Quellen: src/app/globals.css (@theme radii + shadows, :root Farben),
 * src/app/(dashboard)/sites/page.tsx (Karten, Buttons, Status-Pills),
 * submissions/page.tsx (Liste, Avatare, Unterstrich-Tabs), settings/page.tsx
 * (Segmented Control, Felder, Schalter), support/SupportChat.tsx (Chat-Blasen).
 *
 * Tailwind-Grautöne, die im Dashboard benutzt werden, stehen als eigene Namen hier,
 * damit kein Bildschirm Hex-Werte erfindet.
 */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  // :root in globals.css
  background: '#FAFAFA',
  foreground: '#1a1a1a',
  card: '#FFFFFF',
  border: '#E5E7EB', // gray-200, Rahmen von Feldern und Karten in den Einstellungen
  borderCard: '#E2E8F0', // slate-200, Rahmen der Seiten-Karten
  divider: '#F1F5F9', // slate-100, Trennlinien in Listen
  muted: '#F3F4F6', // gray-100, sekundäre Buttons
  mutedPressed: '#E5E7EB',
  mutedForeground: '#6B7280', // gray-500

  // Text (Tailwind gray/slate wie im Dashboard)
  ink: '#111827', // gray-900, Überschriften + Hauptbutton
  inkStrong: '#0F172A', // slate-900, ungelesene Anfragen
  body: '#374151', // gray-700
  label: '#374151',
  secondary: '#64748B', // slate-500, Untertitel
  tertiary: '#94A3B8', // slate-400, Hinweise
  faint: '#9CA3AF', // gray-400
  placeholder: '#9CA3AF',
  hairline: '#CBD5E1', // slate-300

  // Flächen
  surfaceSubtle: '#F8FAFC', // Feldkacheln in der Anfrage-Ansicht
  surfaceSoft: '#F1F5F9', // sekundäre Buttons in Seiten-Karten
  segmentTrack: '#ECEEF1',
  chatBackground: '#F8F8F8',
  chatAdminBubble: '#F0F0F0',

  // Akzent (Violett aus „Neue Webseite erstellen“)
  accent: '#7C3AED',
  accentSoft: '#F5F0FB',
  accentSoftBorder: '#E4D7F5',
  accentDeep: '#6D28D9',
  accentDashed: '#C4B5FD',
  accentWash: '#FAF7FF',

  // Status (Pills aus STATUS_META)
  success: '#15803D',
  successSoft: '#DCFCE7',
  successDot: '#16A34A',
  successBorder: '#86EFAC',
  successInk: '#14532D',
  danger: '#B91C1C',
  dangerStrong: '#DC2626',
  dangerSoft: '#FEF2F2',
  dangerBorder: '#FECACA',
  dangerInk: '#991B1B',
  warning: '#9A3412',
  warningSoft: '#FFF7ED',
  warningDot: '#D97706',
  warningBorder: '#FDE68A',
  warningInk: '#92400E',
  warningWash: '#FFFBEB',
  info: '#1D4ED8',
  infoSoft: '#EFF6FF',
  infoBorder: '#BFDBFE',
  neutralPill: '#475569',
  neutralDot: '#94A3B8',
  unreadBadge: '#EF4444',

  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(15, 23, 42, 0.45)',
} as const;

/** globals.css @theme: --radius-sm 8 · md 16 · lg 24 · xl 32. Buttons wie Dashboard = 16 (rounded-2xl). */
export const radius = {
  xs: 6,
  sm: 8,
  input: 16, // rounded-2xl
  button: 16, // rounded-2xl (Entscheidung Daniel: wie im Dashboard)
  buttonSmall: 12, // rounded-xl (kleine Aktionen in Einstellungen)
  card: 24, // rounded-3xl
  sheet: 24,
  xl: 32,
  full: 9999,
} as const;

/** 4er-Raster wie Tailwind (1 = 4px). */
export const space = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
} as const;

/** Bildschirmränder wie <main> im Dashboard: px-5 (20), sm:px-8 (32), lg:px-12 (48). */
export const gutter = { compact: 20, regular: 32, wide: 48 } as const;

/** Maximale Inhaltsbreite auf dem iPad für Formular- und Lese-Bildschirme. */
export const readableWidth = 720;

const fontFamilies = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
} as const;

export const fonts = fontFamilies;

/**
 * Typo-Stufen = Tailwind-Klassen im Dashboard. Gewicht über eigene Schriftdatei
 * (Geist hat pro Gewicht eine Datei, fontWeight allein reicht auf Android nicht).
 */
export const type = {
  // h1: text-2xl sm:text-3xl font-bold tracking-tight
  display: { fontFamily: fontFamilies.bold, fontSize: 24, lineHeight: 32, letterSpacing: -0.6, color: colors.ink },
  // h2 Abschnitt: text-xl font-bold
  title: { fontFamily: fontFamilies.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3, color: colors.ink },
  // h3 Karte: text-lg font-bold leading-snug
  headline: { fontFamily: fontFamilies.bold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2, color: colors.ink },
  // text-base
  bodyLarge: { fontFamily: fontFamilies.regular, fontSize: 16, lineHeight: 24, color: colors.body },
  // text-[15px]
  body: { fontFamily: fontFamilies.regular, fontSize: 15, lineHeight: 22, color: colors.body },
  bodyStrong: { fontFamily: fontFamilies.semibold, fontSize: 15, lineHeight: 22, color: colors.ink },
  // text-sm
  callout: { fontFamily: fontFamilies.regular, fontSize: 14, lineHeight: 20, color: colors.secondary },
  calloutStrong: { fontFamily: fontFamilies.semibold, fontSize: 14, lineHeight: 20, color: colors.label },
  // text-xs
  footnote: { fontFamily: fontFamilies.regular, fontSize: 12, lineHeight: 16, color: colors.tertiary },
  // text-[11px] font-bold Pills
  pill: { fontFamily: fontFamilies.bold, fontSize: 12, lineHeight: 16 },
  // text-[10px] uppercase tracking Feld-Label in Anfragen
  overline: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.tertiary,
  },
} satisfies Record<string, TextStyle>;

function shadow(y: number, blur: number, opacity: number, color = '#000'): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: { shadowColor: color, shadowOffset: { width: 0, height: y }, shadowOpacity: opacity, shadowRadius: blur / 2 },
    default: { elevation: Math.max(1, Math.round(y * 1.2)) },
  });
}

/** globals.css --shadow-*, plus die Karten- und Button-Schatten aus sites/page.tsx. */
export const shadows = {
  soft: shadow(2, 12, 0.06), // --shadow-soft
  card: shadow(4, 20, 0.08), // --shadow-card
  lg: shadow(8, 40, 0.1), // --shadow-lg
  siteCard: shadow(2, 12, 0.06, '#0F172A'), // 0 2px 12px rgba(15,23,42,0.06)
  accentButton: shadow(6, 20, 0.28, colors.accent), // 0 6px 20px rgba(124,58,237,0.28)
  inkButton: shadow(4, 14, 0.2, colors.ink), // Login-Button
  segment: shadow(1, 6, 0.18), // aktiver Tab im Segmented Control
  sheet: shadow(24, 64, 0.2, '#0F172A'),
} as const;

/** Mindest-Tippfläche (Apple HIG 44 pt; Dashboard nutzt min-h-12 = 48 für Hauptaktionen). */
export const hit = { min: 44, primary: 48, large: 56 } as const;
