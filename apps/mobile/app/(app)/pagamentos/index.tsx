import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';

import { useRequireAuth } from '../../../src/features/auth/hooks/useRequireAuth';
import { useCustomers } from '../../../src/features/customers/hooks/useCustomers';
import { useReceivablesSummary } from '../../../src/features/customers/hooks/useReceivablesSummary';
import { useFinancialDashboard } from '../../../src/features/dashboard/hooks/useFinancialDashboard';
import { Button, IconButton } from '../../../src/shared/components/Button';
import { Card } from '../../../src/shared/components/Card';
import { EmptyState } from '../../../src/shared/components/EmptyState';
import { Skeleton } from '../../../src/shared/components/Skeleton';
import { Text } from '../../../src/shared/components/Text';
import { formatBRL } from '../../../src/shared/lib/currency';
import { formatRelativeTime } from '../../../src/shared/lib/relative-time';
import { palette } from '../../../src/shared/theme/colors';

const SCROLL_BOTTOM_PADDING = 120;

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

function todayRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return { from, to };
}

function CustomerPickerSheet({
  visible,
  onSelect,
  onClose,
}: {
  visible: boolean;
  onSelect: (customerId: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('payments');
  const [search, setSearch] = useState('');
  const { data } = useCustomers(
    { sort: 'name', limit: 100, hasBalance: true },
    { enabled: visible },
  );

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    const query = search.trim().toLowerCase();
    return query ? items.filter((customer) => customer.name.toLowerCase().includes(query)) : items;
  }, [data, search]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(18,16,16,0.45)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: palette.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '82%',
            paddingTop: 16,
          }}
        >
          <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
            <Text variant="title" color="ink" style={{ marginBottom: 12 }}>
              {t('selectCustomerTitle')}
            </Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar cliente…"
              placeholderTextColor={palette.placeholder}
              style={{
                height: 44,
                borderRadius: 12,
                backgroundColor: palette.dividerFaint,
                paddingHorizontal: 16,
                fontSize: 14,
                fontFamily: 'DMSans_400Regular',
                color: palette.ink,
              }}
            />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}>
            {filtered.length === 0 ? (
              <EmptyState title={t('emptyPendingTitle')} />
            ) : (
              filtered.map((customer, index) => (
                <Pressable
                  key={customer.id}
                  onPress={() => onSelect(customer.id)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 12,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: palette.dividerSoft,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: palette.primaryTint,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text variant="body" weight="bold" color="primary" style={{ fontSize: 12 }}>
                      {initialsOf(customer.name)}
                    </Text>
                  </View>
                  <Text variant="body" weight="medium" color="ink" style={{ flex: 1 }}>
                    {customer.name}
                  </Text>
                  <Text variant="body" weight="semibold" color="primary">
                    {formatBRL(customer.balance)}
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PagamentosSkeleton() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ padding: 24, gap: 16 }}
    >
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-48 w-full" />
    </ScrollView>
  );
}

export default function PagamentosScreen() {
  const { t } = useTranslation(['payments', 'common']);
  const { checkingAuth } = useRequireAuth();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['customers'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
    setRefreshing(false);
  }

  const {
    data: summary,
    isLoading: isSummaryLoading,
    isError,
    refetch,
  } = useReceivablesSummary({ enabled: !checkingAuth });
  const { data: pending, isLoading: isPendingLoading } = useCustomers(
    { sort: 'balance', limit: 100, hasBalance: true },
    { enabled: !checkingAuth },
  );

  const { from, to } = useMemo(() => todayRange(), []);
  const { data: todayDashboard } = useFinancialDashboard(
    { from: from.toISOString(), to: to.toISOString(), granularity: 'day', rankingLimit: 20 },
    { enabled: !checkingAuth },
  );

  if (checkingAuth || isSummaryLoading || isPendingLoading) {
    return <PagamentosSkeleton />;
  }

  if (isError || !summary) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          backgroundColor: palette.bg,
          paddingHorizontal: 24,
        }}
      >
        <Text variant="body" color="ink" style={{ textAlign: 'center' }}>
          {t('payments:loadError')}
        </Text>
        <Button label={t('payments:retryButton')} variant="secondary" onPress={() => refetch()} />
      </View>
    );
  }

  const pendingItems = pending?.items ?? [];
  const receivedToday = todayDashboard?.recentPayments ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <IconButton
          icon={<BackChevron />}
          accessibilityLabel={t('common:back')}
          onPress={() => router.back()}
        />
        <Text variant="title" color="ink">
          {t('payments:listTitle')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerClassName="gap-4 px-4 py-6 md:mx-auto md:w-full md:max-w-2xl md:px-8 md:py-10"
        contentContainerStyle={{ paddingBottom: SCROLL_BOTTOM_PADDING }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.primary} />}
      >
        <Button
          label={t('payments:registerButton')}
          size="sm"
          onPress={() => setPickerOpen(true)}
        />

        <View style={{ backgroundColor: palette.ink, borderRadius: 16, padding: 18 }}>
          <Text variant="label" style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
            {t('payments:totalReceivableLabel')}
          </Text>
          <Text variant="display" style={{ color: '#FFFFFF', fontSize: 28, marginBottom: 6 }}>
            {formatBRL(summary.totalOutstanding)}
          </Text>
          <Text variant="caption" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {t('payments:pendingCountLabel', { count: summary.customersWithBalanceCount })}
          </Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="label" color="placeholder">
            {t('payments:pendingSectionTitle')}
          </Text>
          {pendingItems.length === 0 ? (
            <EmptyState title={t('payments:emptyPendingTitle')} />
          ) : (
            <Card>
              {pendingItems.map((customer, index) => (
                <View
                  key={customer.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    borderBottomWidth: index === pendingItems.length - 1 ? 0 : 1,
                    borderBottomColor: palette.dividerSoft,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 11,
                      flex: 1,
                      paddingRight: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: palette.primaryTint,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text variant="body" weight="bold" color="primary" style={{ fontSize: 13 }}>
                        {initialsOf(customer.name)}
                      </Text>
                    </View>
                    <Text
                      variant="body"
                      weight="semibold"
                      color="ink"
                      numberOfLines={1}
                      style={{ flex: 1 }}
                    >
                      {customer.name}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text variant="body" weight="bold" color="ink">
                      {formatBRL(customer.balance)}
                    </Text>
                    <Button
                      label={t('payments:collectButton')}
                      size="sm"
                      onPress={() => router.push(`/pagamentos/cobrar/${customer.id}`)}
                    />
                  </View>
                </View>
              ))}
            </Card>
          )}
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="label" color="placeholder">
            {t('payments:receivedTodaySectionTitle')}
          </Text>
          {receivedToday.length === 0 ? (
            <EmptyState title={t('payments:emptyReceivedTitle')} />
          ) : (
            <Card>
              {receivedToday.map((payment, index) => (
                <View
                  key={payment.paymentId}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    borderBottomWidth: index === receivedToday.length - 1 ? 0 : 1,
                    borderBottomColor: palette.dividerSoft,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 11,
                      flex: 1,
                      paddingRight: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: palette.successTint,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 14, color: palette.success }}>✓</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="body" weight="semibold" color="ink" numberOfLines={1}>
                        {payment.customerName ?? t('payments:walkInPaymentLabel')}
                      </Text>
                      <Text variant="caption" color="muted">
                        {formatRelativeTime(new Date(payment.createdAt), t)}
                      </Text>
                    </View>
                  </View>
                  <Text variant="body" weight="semibold" color="success">
                    +{formatBRL(payment.amount)}
                  </Text>
                </View>
              ))}
            </Card>
          )}
        </View>

        <CustomerPickerSheet
          visible={pickerOpen}
          onSelect={(customerId) => {
            setPickerOpen(false);
            router.push(`/pagamentos/cobrar/${customerId}`);
          }}
          onClose={() => setPickerOpen(false)}
        />
      </ScrollView>
    </View>
  );
}
