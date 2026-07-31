import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { palette } from '../theme/colors';

/**
 * The Lotea Design System's 7 typography tokens (see the design system
 * reference: "display / heading-1 / heading-2 / title / body / caption /
 * label"). React Native cannot synthesize bold/semibold from a single
 * regular-weight custom font file the way it can with system fonts — each
 * weight needs its own explicitly-loaded font family name — so this
 * component, not a generic `font-bold` className, is the only correct way
 * to set text weight anywhere in the app. Every screen imports `Text` from
 * here instead of `react-native`.
 */
type Variant = 'display' | 'heading1' | 'heading2' | 'title' | 'body' | 'caption' | 'label';
type Color = 'ink' | 'muted' | 'placeholder' | 'primary' | 'success' | 'danger' | 'warning' | 'white' | 'inherit';

interface VariantStyle {
  fontSize: number;
  fontFamily: string;
  letterSpacing: number;
  lineHeight: number;
  textTransform?: 'uppercase';
}

const VARIANT_STYLE: Record<Variant, VariantStyle> = {
  display: { fontSize: 36, fontFamily: 'DMSans_700Bold', letterSpacing: -1.2, lineHeight: 40 },
  heading1: { fontSize: 24, fontFamily: 'DMSans_700Bold', letterSpacing: -0.5, lineHeight: 30 },
  heading2: { fontSize: 20, fontFamily: 'DMSans_600SemiBold', letterSpacing: -0.3, lineHeight: 26 },
  title: { fontSize: 17, fontFamily: 'DMSans_600SemiBold', letterSpacing: -0.2, lineHeight: 22 },
  body: { fontSize: 15, fontFamily: 'DMSans_400Regular', letterSpacing: 0, lineHeight: 22 },
  caption: { fontSize: 13, fontFamily: 'DMSans_400Regular', letterSpacing: 0, lineHeight: 18 },
  label: {
    fontSize: 11,
    fontFamily: 'DMSans_500Medium',
    letterSpacing: 0.88, // .08em at 11px
    lineHeight: 14,
    textTransform: 'uppercase',
  },
};

const DEFAULT_COLOR: Record<Variant, Color> = {
  display: 'ink',
  heading1: 'ink',
  heading2: 'ink',
  title: 'ink',
  body: 'ink',
  caption: 'muted',
  label: 'placeholder',
};

const COLOR_VALUE: Record<Exclude<Color, 'inherit'>, string> = {
  ink: palette.ink,
  muted: palette.muted,
  placeholder: palette.placeholder,
  primary: palette.primary,
  success: palette.success,
  danger: palette.danger,
  warning: palette.warning,
  white: '#FFFFFF',
};

interface TextProps extends RNTextProps {
  variant?: Variant;
  /** 'inherit' skips setting a color at all — for text nested inside another Text that already colored itself (e.g. a differently-colored inline span). */
  color?: Color;
  /** Weight override for cases that need a heavier/lighter weight than the variant's default (e.g. a `body` line that should read `medium`). */
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
}

const WEIGHT_FAMILY: Record<NonNullable<TextProps['weight']>, string> = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
};

export function Text({ variant = 'body', color, weight, style, ...props }: TextProps) {
  const variantStyle = VARIANT_STYLE[variant];
  const resolvedColor = color ?? DEFAULT_COLOR[variant];

  return (
    <RNText
      style={[
        variantStyle,
        weight ? { fontFamily: WEIGHT_FAMILY[weight] } : null,
        resolvedColor === 'inherit' ? null : { color: COLOR_VALUE[resolvedColor] },
        style,
      ]}
      {...props}
    />
  );
}
