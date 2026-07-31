import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { palette } from '../theme/colors';
import { Button } from './Button';
import { Input } from './Input';
import { Text } from './Text';

/** Shared by every product form (create + edit) that needs a "pick or type a new brand" sheet. */
export function BrandPickerSheet({
  visible,
  brands,
  onSelect,
  onClose,
  title,
}: {
  visible: boolean;
  brands: string[];
  onSelect: (brand: string) => void;
  onClose: () => void;
  title: string;
}) {
  const { t } = useTranslation('products');
  const [draft, setDraft] = useState('');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(18,16,16,0.45)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: palette.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 20,
            paddingBottom: 32,
            paddingHorizontal: 20,
            gap: 12,
            maxHeight: '75%',
          }}
        >
          <Text variant="title" color="ink">
            {title}
          </Text>
          <Input label="" placeholder={t('brandPlaceholder')} value={draft} onChangeText={setDraft} />
          <Button
            variant="secondary"
            label={draft.trim().length > 0 ? t('brandNewOption', { value: draft.trim() }) : t('brandNewOptionPlaceholder')}
            disabled={draft.trim().length === 0}
            onPress={() => {
              onSelect(draft.trim());
              setDraft('');
            }}
            fullWidth
          />
          <ScrollView style={{ maxHeight: 260 }}>
            {brands.map((option) => (
              <Pressable
                key={option}
                onPress={() => onSelect(option)}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  paddingHorizontal: 8,
                  backgroundColor: pressed ? palette.dividerFaint : 'transparent',
                  borderRadius: 10,
                })}
              >
                <Text variant="body" color="ink">
                  {option}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function BrandPickerRow({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text variant="body" weight="medium" color="muted" style={{ fontSize: 12 }}>
        {label}
      </Text>
      <Pressable
        onPress={onPress}
        style={{
          backgroundColor: palette.surface,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: palette.divider,
          paddingHorizontal: 16,
          paddingVertical: 13,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text variant="body" color={value ? 'ink' : 'placeholder'}>
          {value || placeholder}
        </Text>
        <Text variant="body" color="muted">
          ⌄
        </Text>
      </Pressable>
    </View>
  );
}
