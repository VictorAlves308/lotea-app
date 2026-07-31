import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { useRequireAuth } from '../../../src/features/auth/hooks/useRequireAuth';
import { useCustomers } from '../../../src/features/customers/hooks/useCustomers';
import {
  LineAreaChart,
  type ChartSeriesPoint,
} from '../../../src/features/dashboard/components/LineAreaChart';
import { useFinancialDashboard } from '../../../src/features/dashboard/hooks/useFinancialDashboard';
import { Button, IconButton } from '../../../src/shared/components/Button';
import { Card } from '../../../src/shared/components/Card';
import { EmptyState } from '../../../src/shared/components/EmptyState';
import { SegmentedControl } from '../../../src/shared/components/SegmentedControl';
import { Skeleton } from '../../../src/shared/components/Skeleton';
import { Text } from '../../../src/shared/components/Text';
import { formatBRL } from '../../../src/shared/lib/currency';
import { palette } from '../../../src/shared/theme/colors';

const SCROLL_BOTTOM_PADDING = 120;
type Tab = 'overview' | 'flow' | 'receivable';

function BackChevron() {
  return (
    <Text variant="body" weight="bold" color="ink" style={{ fontSize: 18, lineHeight: 18 }}>
      ‹
    </Text>
  );
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0]![0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function FinanceiroSkeleton() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ padding: 24, gap: 16 }}
    >
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-48 w-full" />
    </ScrollView>
  );
}

export default function FinanceiroScreen() {
  const { t } = useTranslation(['finance', 'dashboard', 'payments', 'common']);
  const { checkingAuth } = useRequireAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['customers'] }),
    ]);
    setRefreshing(false);
  }

  const range = useMemo(() => {
    const now = new Date();
    return { from: startOfMonth(now), to: now };
  }, []);

  const { data, isLoading, isError, refetch } = useFinancialDashboard(
    {
      from: toDateInputValue(range.from),
      to: toDateInputValue(range.to),
      granularity: 'day',
      rankingLimit: 5,
    },
    { enabled: !checkingAuth },
  );

  const { data: pending, isLoading: isPendingLoading } = useCustomers(
    { sort: 'balance', limit: 100, hasBalance: true },
    { enabled: !checkingAuth && tab === 'receivable' },
  );

  if (checkingAuth || isLoading) {
    return <FinanceiroSkeleton />;
  }

  if (isError || !data) {
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
          {t('finance:loadError')}
        </Text>
        <Button label={t('finance:retryButton')} variant="secondary" onPress={() => refetch()} />
      </View>
    );
  }

  const chartPoints: ChartSeriesPoint[] = data.timeline.map((bucket) => ({
    label: new Date(bucket.bucket).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    }),
    sold: Number(bucket.sold),
    received: Number(bucket.received),
  }));

  const margin =
    Number(data.totalSoldInPeriod) > 0
      ? Math.round((Number(data.netProfitInPeriod) / Number(data.totalSoldInPeriod)) * 100)
      : 0;
  const pendingItems = pending?.items ?? [];

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
          {t('finance:title')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerClassName="gap-4 px-4 py-6 md:mx-auto md:w-full md:max-w-2xl md:px-8 md:py-10"
        contentContainerStyle={{ paddingBottom: SCROLL_BOTTOM_PADDING }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.primary} />}
      >
        <SegmentedControl
          accessibilityLabel={t('finance:title')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'overview', label: t('finance:tabOverview') },
            { value: 'flow', label: t('finance:tabFlow') },
            { value: 'receivable', label: t('finance:tabReceivable') },
          ]}
        />

        {tab === 'overview' ? (
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Card style={{ flex: 1 }}>
                <Text variant="caption" color="muted" style={{ marginBottom: 5 }}>
                  {t('finance:revenueLabel')}
                </Text>
                <Text variant="title" color="success" style={{ fontSize: 18 }}>
                  {formatBRL(data.totalSoldInPeriod)}
                </Text>
              </Card>
              <Card style={{ flex: 1 }}>
                <Text variant="caption" color="muted" style={{ marginBottom: 5 }}>
                  {t('finance:costsLabel')}
                </Text>
                <Text variant="title" color="primary" style={{ fontSize: 18 }}>
                  {formatBRL(data.totalCostInPeriod)}
                </Text>
              </Card>
            </View>

            <View style={{ backgroundColor: palette.success, borderRadius: 14, padding: 16 }}>
              <Text variant="caption" style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 5 }}>
                {t('finance:netProfitLabel')}
              </Text>
              <Text variant="heading1" style={{ color: '#FFFFFF', marginBottom: 4 }}>
                {formatBRL(data.netProfitInPeriod)}
              </Text>
              <Text variant="caption" style={{ color: 'rgba(255,255,255,0.75)' }}>
                {t('finance:marginLabel', { pct: margin })}
              </Text>
            </View>

            <Card>
              <Text variant="title" color="ink" style={{ marginBottom: 12 }}>
                {t('finance:flowSectionTitle')}
              </Text>
              {chartPoints.length > 0 ? (
                <LineAreaChart
                  points={chartPoints}
                  soldLabel={t('dashboard:totalSold')}
                  receivedLabel={t('dashboard:totalReceived')}
                />
              ) : (
                <EmptyState title={t('finance:emptyChartTitle')} />
              )}
            </Card>

            <Card>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <Text variant="title" color="ink">
                  {t('finance:receivablesSectionTitle')}
                </Text>
                <Text variant="caption" color="primary" onPress={() => router.push('/pagamentos')}>
                  {t('finance:viewAllButton')}
                </Text>
              </View>
              <Text variant="heading1" color="ink" style={{ marginTop: 8 }}>
                {formatBRL(data.totalOutstanding)}
              </Text>
              <Text variant="caption" color="muted">
                {t('payments:pendingCountLabel', { count: data.customersWithBalanceCount })}
              </Text>
            </Card>
          </>
        ) : null}

        {tab === 'flow' ? (
          <Card>
            <Text variant="title" color="ink" style={{ marginBottom: 12 }}>
              {t('finance:flowSectionTitle')}
            </Text>
            {chartPoints.length > 0 ? (
              <LineAreaChart
                points={chartPoints}
                soldLabel={t('dashboard:totalSold')}
                receivedLabel={t('dashboard:totalReceived')}
                height={240}
              />
            ) : (
              <EmptyState title={t('finance:emptyChartTitle')} />
            )}
          </Card>
        ) : null}

        {tab === 'receivable' ? (
          isPendingLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : pendingItems.length === 0 ? (
            <EmptyState title={t('finance:emptyReceivablesTitle')} />
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
          )
        ) : null}
      </ScrollView>
    </View>
  );
}
