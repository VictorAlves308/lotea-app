import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';

import { palette } from '../theme/colors';

type Variant = 'default' | 'hero' | 'kpi';

interface CardProps extends ViewProps {
  variant?: Variant;
}

/**
 * The design system's card set. `default` is the everyday white panel
 * (16px radius, 20/24 padding, a hairline border + the barest shadow — not
 * a floating effect, just enough to lift it off the cream page background).
 * `hero` is the one dark, high-emphasis card per screen (the primary
 * headline figure only — never more than one per screen). `kpi` is a
 * compact secondary-stat card, meant to sit in a row of 2-3.
 */
export function Card({ variant = 'default', style, children, ...props }: PropsWithChildren<CardProps>) {
  if (variant === 'hero') {
    return (
      <View
        style={[
          {
            backgroundColor: palette.ink,
            borderRadius: 20,
            padding: 24,
            overflow: 'hidden',
          },
          style,
        ]}
        {...props}
      >
        {/* Decorative glow — the only "effect" this design system permits: a soft, off-canvas tinted circle, never a gradient/blur on content itself. */}
        <View
          style={{
            position: 'absolute',
            top: -28,
            right: -28,
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: 'rgba(199,75,40,0.15)',
          }}
        />
        {children}
      </View>
    );
  }

  const isKpi = variant === 'kpi';
  return (
    <View
      style={[
        {
          backgroundColor: palette.surface,
          borderRadius: 16,
          padding: isKpi ? 20 : 20,
          paddingHorizontal: isKpi ? 20 : 24,
          borderWidth: 1,
          borderColor: palette.dividerSoft,
          shadowColor: '#000',
          shadowOpacity: 0.04,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
