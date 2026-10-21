import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { colors, fonts, type } from '@/theme/tokens';

export type TextVariant = keyof typeof type;

interface Props extends TextProps {
  variant?: TextVariant;
  color?: string;
  weight?: keyof typeof fonts;
  align?: TextStyle['textAlign'];
}

/**
 * Text mit Geist und den Typo-Stufen des Dashboards. Große Schrift (Dynamic Type) ist
 * erlaubt, aber gedeckelt, damit Layouts nicht brechen.
 */
export function Text({ variant = 'body', color, weight, align, style, maxFontSizeMultiplier = 1.6, ...rest }: Props) {
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        type[variant],
        color ? { color } : null,
        weight ? { fontFamily: fonts[weight] } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}

export const textColors = colors;
