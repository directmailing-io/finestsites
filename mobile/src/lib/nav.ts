import { colors, fonts } from '@/theme/tokens';

/**
 * Kopfzeilen-Optionen für die Stapel in den Tabs.
 * Wurzel-Bildschirme zeigen eigene große Überschriften wie das Dashboard (h1),
 * Unterseiten bekommen eine native Kopfzeile mit „Zurück“.
 */
export const stackOptions = {
  contentStyle: { backgroundColor: colors.background },
  headerTransparent: false,
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.ink,
  headerTitleStyle: { fontFamily: fonts.semibold, color: colors.ink, fontSize: 17 },
  headerBackButtonDisplayMode: 'minimal' as const,
};

export const rootScreenOptions = { headerShown: false };
