import { Pressable, View } from 'react-native';

import { palette } from '../theme/colors';
import { Text } from './Text';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

/**
 * A track with an inset, raised selected pill — not loose separate pills.
 * Used for both the period switcher and the ranking tabs. The visual pill
 * stays compact (~38px) for a refined look; `hitSlop` extends the real tap
 * target to comfortably clear the 44px minimum without inflating the shape.
 * No shadow on the selected pill — a resting, always-visible control isn't
 * a floating overlay; the surface-vs-track fill contrast alone reads as
 * selected.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        gap: 4,
        borderRadius: 999,
        backgroundColor: palette.dividerSoft,
        padding: 4,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={{
              minHeight: 38,
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              paddingHorizontal: 16,
              backgroundColor: selected ? palette.surface : 'transparent',
            }}
          >
            <Text
              variant="body"
              weight={selected ? 'semibold' : 'medium'}
              color={selected ? 'ink' : 'muted'}
              style={{ fontSize: 13 }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
