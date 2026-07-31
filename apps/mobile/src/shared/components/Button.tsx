import { Pressable, View, type PressableProps } from 'react-native';

import { palette } from '../theme/colors';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
type Size = 'lg' | 'md' | 'sm';

const HEIGHT: Record<Size, number> = { lg: 48, md: 40, sm: 32 };
const RADIUS: Record<Size, number> = { lg: 12, md: 10, sm: 8 };
const PADDING_X: Record<Size, number> = { lg: 24, md: 20, sm: 14 };
const FONT_SIZE: Record<Size, number> = { lg: 15, md: 13, sm: 12 };

const VARIANT_BG: Record<Variant, string> = {
  primary: palette.primary,
  secondary: palette.surface,
  ghost: 'transparent',
  danger: palette.dangerSoftTint,
  dark: palette.ink,
};

const VARIANT_TEXT_COLOR: Record<Variant, string> = {
  primary: '#FFFFFF',
  secondary: palette.ink,
  ghost: palette.primary,
  danger: palette.danger,
  dark: '#FFFFFF',
};

interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: Variant;
  size?: Size;
  label: string;
  disabled?: boolean;
  fullWidth?: boolean;
}

/**
 * The design system's full button set: primary (terracotta, the one action
 * that matters on a screen), secondary (outlined, everything else), ghost
 * (text-only, tertiary), danger (soft red, destructive), dark (rare, high-
 * contrast emphasis). Tap feedback is an instant scale(0.97) + opacity(0.88)
 * on press — see the design system's Motion section.
 */
export function Button({
  variant = 'primary',
  size = 'lg',
  label,
  disabled,
  fullWidth,
  ...props
}: ButtonProps) {
  const isSecondary = variant === 'secondary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      style={({ pressed }) => [
        {
          height: HEIGHT[size],
          borderRadius: RADIUS[size],
          paddingHorizontal: PADDING_X[size],
          backgroundColor: VARIANT_BG[variant],
          borderWidth: isSecondary ? 1.5 : 0,
          borderColor: palette.divider,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.55 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
      {...props}
    >
      <Text
        style={{ fontSize: FONT_SIZE[size], color: VARIANT_TEXT_COLOR[variant] }}
        weight="semibold"
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface IconButtonProps extends Omit<PressableProps, 'style'> {
  icon: React.ReactNode;
  accessibilityLabel: string;
  variant?: 'default' | 'primary';
}

export function IconButton({ icon, accessibilityLabel, variant = 'default', ...props }: IconButtonProps) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: isPrimary ? palette.primary : palette.surface,
        borderWidth: isPrimary ? 0 : 1,
        borderColor: palette.divider,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
      {...props}
    >
      {icon}
    </Pressable>
  );
}

/** Floating action button — reserved for the single most important create action on a screen. */
export function FAB(props: Omit<PressableProps, 'style'> & { icon: React.ReactNode; accessibilityLabel: string }) {
  const { icon, accessibilityLabel, ...rest } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: palette.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: palette.primary,
        shadowOpacity: 0.4,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
        opacity: pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
      {...rest}
    >
      <View>{icon}</View>
    </Pressable>
  );
}
