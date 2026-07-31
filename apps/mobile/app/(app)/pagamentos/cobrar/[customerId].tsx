import type { CustomerDetail, PaymentMethod } from '@lotea/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { useCustomer } from '../../../../src/features/customers/hooks/useCustomer';
import { useRegisterPayment } from '../../../../src/features/customers/hooks/useRegisterPayment';
import { Button, IconButton } from '../../../../src/shared/components/Button';
import { Input } from '../../../../src/shared/components/Input';
import { MoneyInput } from '../../../../src/shared/components/MoneyInput';
import { Skeleton } from '../../../../src/shared/components/Skeleton';
import { Text } from '../../../../src/shared/components/Text';
import { formatBRL } from '../../../../src/shared/lib/currency';
import { normalizeMoneyInput } from '../../../../src/shared/lib/normalize-money-input';
import { palette } from '../../../../src/shared/theme/colors';

function BackChevron() {
  return (
    <Text variant="body" weight="bold" color="ink" style={{ fontSize: 18, lineHeight: 18 }}>
      ‹
    </Text>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0]![0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function CobrarForm({ customer }: { customer: CustomerDetail }) {
  const { t } = useTranslation(['payments', 'common']);
  const registerPayment = useRegisterPayment();

  const [amount, setAmount] = useState(() => Number(customer.balance).toFixed(2));
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);

    const normalized = normalizeMoneyInput(amount);
    if (!normalized || Number(normalized) <= 0) {
      setError(t('payments:amountRequired'));
      return;
    }
    if (Number(normalized) > Number(customer.balance)) {
      setError(t('payments:amountExceedsBalance'));
      return;
    }

    try {
      await registerPayment.mutateAsync({
        customerId: customer.id,
        input: { amount: normalized, paymentMethod: payment, notes: notes.trim() || null },
      });
      router.back();
    } catch {
      setError(t('payments:createError'));
    }
  }

  const total = normalizeMoneyInput(amount) ?? '0.00';

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon={<BackChevron />} accessibilityLabel={t('common:back')} onPress={() => router.back()} />
        <Text variant="title" color="ink">
          {t('payments:cobrarTitle')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <View
          style={{
            backgroundColor: palette.dividerFaint,
            borderRadius: 16,
            paddingVertical: 16,
            paddingHorizontal: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: palette.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="body" weight="bold" color="primary" style={{ fontSize: 14 }}>
                {initialsOf(customer.name)}
              </Text>
            </View>
            <Text variant="body" weight="semibold" color="ink">
              {customer.name}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="caption" color="muted">
              {t('payments:outstandingLabel')}
            </Text>
            <Text variant="title" color="primary">
              {formatBRL(customer.balance)}
            </Text>
          </View>
        </View>

        <MoneyInput label={t('payments:amountLabel')} value={amount} onChangeValue={setAmount} />

        <View style={{ gap: 8 }}>
          <Text variant="body" weight="medium" color="muted" style={{ fontSize: 12 }}>
            {t('payments:paymentMethodLabel')}
          </Text>
          <View style={{ gap: 8 }}>
            {(['PIX', 'CARD', 'CASH'] as PaymentMethod[]).map((value) => {
              const selected = payment === value;
              const label = { PIX: t('payments:paymentPix'), CARD: t('payments:paymentCard'), CASH: t('payments:paymentCash') }[value];
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setPayment(value)}
                  style={({ pressed }) => ({
                    backgroundColor: selected ? palette.ink : palette.surface,
                    borderWidth: selected ? 0 : 1.5,
                    borderColor: palette.divider,
                    borderRadius: 13,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text variant="body" weight="semibold" style={{ color: selected ? '#FFFFFF' : palette.muted }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Input
          label={`${t('payments:notesLabel')} ${t('payments:notesOptional')}`}
          placeholder={t('payments:notesPlaceholder')}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          style={{ height: 84, textAlignVertical: 'top', paddingTop: 13 }}
        />

        {error ? (
          <Text variant="caption" color="danger">
            ⚠ {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={{ padding: 24, paddingBottom: 32, borderTopWidth: 1, borderTopColor: palette.dividerSoft, backgroundColor: palette.surface }}>
        <Button
          label={
            registerPayment.isPending
              ? t('payments:savingButton')
              : t('payments:confirmButton', { amount: formatBRL(total) })
          }
          onPress={handleSubmit}
          disabled={registerPayment.isPending}
          fullWidth
        />
      </View>
    </View>
  );
}

export default function CobrarScreen() {
  const { t } = useTranslation(['payments', 'common']);
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const { data: customer, isLoading, isError } = useCustomer(customerId);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, padding: 24, gap: 16 }}>
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </View>
    );
  }

  if (isError || !customer) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: palette.bg, paddingHorizontal: 24 }}>
        <Text variant="body" color="ink" style={{ textAlign: 'center' }}>
          {t('payments:loadCustomerError')}
        </Text>
        <Button label={t('common:back')} variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  return <CobrarForm customer={customer} />;
}
