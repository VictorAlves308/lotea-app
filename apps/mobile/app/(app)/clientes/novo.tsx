import { createCustomerInputSchema, type CreateCustomerInput } from '@lotea/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useCreateCustomer } from '../../../src/features/customers/hooks/useCreateCustomer';
import { Button, IconButton } from '../../../src/shared/components/Button';
import { ConfirmDialog } from '../../../src/shared/components/ConfirmDialog';
import { Input } from '../../../src/shared/components/Input';
import { Text } from '../../../src/shared/components/Text';
import { setPendingCustomerSelection } from '../../../src/shared/lib/pending-selection';
import { zodResolver } from '../../../src/shared/lib/zod-resolver';
import { palette } from '../../../src/shared/theme/colors';

// Icon-only back chevron, matching the prototype's back-button treatment on every pushed screen.
function BackChevron() {
  return (
    <View style={{ width: 15, height: 15, alignItems: 'center', justifyContent: 'center' }}>
      <Text variant="body" weight="bold" color="ink" style={{ fontSize: 18, lineHeight: 18 }}>
        ‹
      </Text>
    </View>
  );
}

export default function NovoClienteScreen() {
  const { t } = useTranslation(['customers', 'common']);
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const queryClient = useQueryClient();
  const createCustomer = useCreateCustomer();
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<CreateCustomerInput>({
    resolver: zodResolver<CreateCustomerInput>(createCustomerInputSchema),
    defaultValues: { name: '', phone: '', notes: '', confirmDuplicate: false },
  });

  const submit = async (confirmDuplicate: boolean) => {
    const values = getValues();
    const result = await createCustomer.mutateAsync({ ...values, confirmDuplicate });
    if (result.status === 'created') {
      if (returnTo === 'nova-venda') {
        setPendingCustomerSelection(queryClient, result.customer);
      }
      router.back();
      return;
    }
    setDuplicateOpen(true);
  };

  const onSubmit = handleSubmit(() => submit(false));

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon={<BackChevron />} accessibilityLabel={t('common:back')} onPress={() => router.back()} />
        <Text variant="title" color="ink">
          {t('customers:createTitle')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Input
              label={t('customers:nameLabel')}
              placeholder={t('customers:namePlaceholder')}
              value={field.value}
              onChangeText={field.onChange}
              errorMessage={errors.name?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <Input
              label={t('customers:phoneLabel')}
              placeholder={t('customers:phonePlaceholder')}
              keyboardType="phone-pad"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              errorMessage={errors.phone?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <Input
              label={t('customers:notesLabel')}
              placeholder={t('customers:notesPlaceholder')}
              value={field.value ?? ''}
              onChangeText={field.onChange}
              multiline
              numberOfLines={3}
              style={{ height: 84, textAlignVertical: 'top', paddingTop: 13 }}
              errorMessage={errors.notes?.message}
            />
          )}
        />

        {createCustomer.isError ? (
          <Text variant="caption" color="danger">
            ⚠ {t('customers:createError')}
          </Text>
        ) : null}
      </ScrollView>

      <View style={{ padding: 24, paddingBottom: 32, borderTopWidth: 1, borderTopColor: palette.dividerSoft, backgroundColor: palette.surface }}>
        <Button
          label={createCustomer.isPending ? t('customers:savingButton') : t('customers:saveButton')}
          onPress={onSubmit}
          disabled={createCustomer.isPending}
          fullWidth
        />
      </View>

      <ConfirmDialog
        visible={duplicateOpen}
        title={t('customers:duplicateTitle')}
        description={t('customers:duplicateDescription')}
        confirmLabel={t('customers:duplicateConfirm')}
        cancelLabel={t('customers:duplicateCancel')}
        onCancel={() => setDuplicateOpen(false)}
        onConfirm={() => {
          setDuplicateOpen(false);
          void submit(true);
        }}
      />
    </View>
  );
}
