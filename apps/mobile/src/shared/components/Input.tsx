import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { palette } from '../theme/colors';
import { Text } from './Text';

interface InputProps extends TextInputProps {
  label: string;
  errorMessage?: string;
  /** A short, non-editable adornment inside the field's left edge — e.g. "R$" on money fields. Not for icons/chevrons; see the search/select variants for those. */
  prefix?: string;
}

/**
 * The design system's default text field: label always visible above (never
 * placeholder-only), a 1.5px divider border at rest, a 2px terracotta border
 * on focus, a 2px red border + red label/helper on error. Search and select
 * variants are separate, purpose-built components (see below) rather than
 * props on this one, since their content (a leading icon, a trailing
 * chevron) isn't optional decoration on the same field type.
 */
export function Input({ label, errorMessage, prefix, style, onFocus, onBlur, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(errorMessage);

  return (
    <View style={{ gap: 8 }}>
      <Text variant="body" weight="medium" color={hasError ? 'danger' : 'muted'} style={{ fontSize: 12 }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: palette.surface,
          borderRadius: 12,
          borderWidth: hasError || focused ? 2 : 1.5,
          borderColor: hasError ? palette.danger : focused ? palette.primary : palette.divider,
          paddingHorizontal: 16,
        }}
      >
        {prefix ? (
          <Text variant="body" weight="medium" color="muted" style={{ fontSize: 15, marginRight: 6 }}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            {
              flex: 1,
              paddingVertical: 13,
              paddingHorizontal: prefix ? 0 : undefined,
              fontSize: 15,
              fontFamily: 'DMSans_400Regular',
              color: palette.ink,
            },
            style,
          ]}
          placeholderTextColor={palette.placeholder}
          {...props}
        />
      </View>
      {errorMessage ? (
        <Text variant="caption" color="danger">
          ⚠ {errorMessage}
        </Text>
      ) : null}
    </View>
  );
}
