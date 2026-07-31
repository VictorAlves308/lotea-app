import type { ReactNode } from 'react';
import { View } from 'react-native';

import { palette } from '../theme/colors';
import { Button } from './Button';
import { Text } from './Text';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Icon-circle + title + description + optional CTA. Status/absence is
 * always paired with a plain-language label — never conveyed by layout
 * alone (see PRODUCT.md's accessibility rules).
 */
export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40, gap: 16 }}>
      {icon ? (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: palette.dividerSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </View>
      ) : null}
      <View style={{ gap: 4 }}>
        <Text variant="title" color="ink" style={{ textAlign: 'center' }}>
          {title}
        </Text>
        {description ? (
          <Text variant="body" color="muted" style={{ textAlign: 'center' }}>
            {description}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        // Button defaults to `alignSelf: 'flex-start'` (see Button.tsx) unless
        // `fullWidth` is passed, which would otherwise ignore this View's own
        // `alignItems: 'center'` and stick to the left edge. Wrapping it in a
        // shrink-to-fit View — which itself gets centered by the parent — sidesteps
        // that without changing Button's shared default.
        <View>
          <Button variant="secondary" size="md" label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}
