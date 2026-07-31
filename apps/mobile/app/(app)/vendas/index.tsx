import type { SaleListItem, SaleStatus } from '@lotea/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { useRequireAuth } from '../../../src/features/auth/hooks/useRequireAuth';
import { useSales } from '../../../src/features/sales/hooks/useSales';
import { Button, IconButton } from '../../../src/shared/components/Button';
import { Card } from '../../../src/shared/components/Card';
import { EmptyState } from '../../../src/shared/components/EmptyState';
import { Skeleton } from '../../../src/shared/components/Skeleton';
import { StatusBadge } from '../../../src/shared/components/StatusBadge';
import { Text } from '../../../src/shared/components/Text';
import { formatBRL } from '../../../src/shared/lib/currency';
import { formatRelativeDayLabel, isSameDay } from '../../../src/shared/lib/date-format';
import { saleStatusToBadge } from '../../../src/shared/lib/sale-status';
import { palette } from '../../../src/shared/theme/colors';

type Tab = 'all' | 'paid' | 'pending' | 'cancelled';

const TAB_STATUS: Record<Tab, SaleStatus | undefined> = {
  all: undefined,
  paid: 'PAID',
  pending: 'PENDING',
  cancelled: 'CANCELLED',
};

const SCROLL_BOTTOM_PADDING = 120;

function BackChevron() {
  return (
    <Text variant="body" weight="bold" color="ink" style={{ fontSize: 18, lineHeight: 18 }}>
      ‹
    </Text>
  );
}

function SaleRow({ sale, isLast }: { sale: SaleListItem; isLast: boolean }) {
  const { t } = useTranslation('sales');
  const isCancelled = sale.status === 'CANCELLED';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: palette.dividerSoft,
      }}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text variant="body" weight="semibold" color="ink" numberOfLines={1}>
          {sale.customerName ?? t('walkInCustomer')}
        </Text>
        <Text variant="caption" color="muted" numberOfLines={1}>
          {[t('itemsCount', { count: sale.itemCount }), sale.brand].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text
          variant="body"
          weight="semibold"
          color={isCancelled ? 'muted' : sale.status === 'PENDING' ? 'ink' : 'success'}
          style={isCancelled ? { textDecorationLine: 'line-through' } : undefined}
        >
          {formatBRL(sale.total)}
        </Text>
        <StatusBadge status={saleStatusToBadge(sale.status)} />
      </View>
    </View>
  );
}

function VendasSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-64 w-full" />
      </ScrollView>
    </View>
  );
}

export default function VendasScreen() {
  const { t } = useTranslation('sales');
  const { checkingAuth } = useRequireAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('all');
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useSales(
    { limit: 100, status: TAB_STATUS[tab] },
    { enabled: !checkingAuth },
  );

  async function handleRefresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['sales'] });
    setRefreshing(false);
  }

  const { groups, todaySold, todayCount, todayPending } = useMemo(() => {
    const items = data?.items ?? [];
    const now = new Date();
    const todayItems = items.filter((sale) => isSameDay(new Date(sale.createdAt), now));
    const sold = todayItems
      .filter((sale) => sale.status !== 'CANCELLED')
      .reduce((sum, sale) => sum + Number(sale.total), 0);
    const pending = todayItems.filter((sale) => sale.status === 'PENDING' || sale.status === 'PARTIALLY_PAID').length;

    const byDay = new Map<string, SaleListItem[]>();
    for (const sale of items) {
      const date = new Date(sale.createdAt);
      const key = date.toDateString();
      const bucket = byDay.get(key);
      if (bucket) bucket.push(sale);
      else byDay.set(key, [sale]);
    }

    return {
      groups: Array.from(byDay.entries()),
      todaySold: sold,
      todayCount: todayItems.length,
      todayPending: pending,
    };
  }, [data]);

  if (checkingAuth || isLoading) {
    return <VendasSkeleton />;
  }

  if (isError || !data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: palette.bg, paddingHorizontal: 24 }}>
        <Text variant="body" color="ink" style={{ textAlign: 'center' }}>
          {t('loadError')}
        </Text>
        <Button label={t('retryButton')} variant="secondary" onPress={() => refetch()} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon={<BackChevron />} accessibilityLabel="Voltar" onPress={() => router.back()} />
        <Text variant="title" color="ink">
          {t('listTitle')}
        </Text>
        <IconButton
          icon={<Text style={{ color: '#FFFFFF', fontSize: 18, lineHeight: 18 }}>+</Text>}
          variant="primary"
          accessibilityLabel={t('newSaleButton')}
          onPress={() => router.push('/vendas/nova')}
        />
      </View>

      <ScrollView
        contentContainerClassName="gap-4 px-6 py-4 md:mx-auto md:w-full md:max-w-2xl"
        contentContainerStyle={{ paddingBottom: SCROLL_BOTTOM_PADDING }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.primary} />}
      >
        <Card variant="hero">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text variant="label" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {t('todaySold')}
              </Text>
              <Text variant="heading1" style={{ color: '#FFFFFF', marginTop: 4 }}>
                {formatBRL(todaySold.toFixed(2))}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text variant="caption" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {t('salesCountLabel')}: {todayCount}
              </Text>
              <Text variant="caption" style={{ color: todayPending > 0 ? palette.warning : 'rgba(255,255,255,0.6)' }}>
                {t('pendingCountLabel')}: {todayPending}
              </Text>
            </View>
          </View>
        </Card>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {(['all', 'paid', 'pending', 'cancelled'] as Tab[]).map((value) => {
            const selected = value === tab;
            return (
              <Pressable
                key={value}
                onPress={() => setTab(value)}
                style={{
                  paddingVertical: 7,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: selected ? palette.ink : palette.surface,
                  borderWidth: selected ? 0 : 1,
                  borderColor: palette.divider,
                }}
              >
                <Text variant="body" weight={selected ? 'semibold' : 'medium'} style={{ fontSize: 12, color: selected ? '#FFFFFF' : palette.muted }}>
                  {t(`tab${value.charAt(0).toUpperCase()}${value.slice(1)}`)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {groups.length === 0 ? (
          <EmptyState title={tab === 'all' ? t('emptyTitle') : t('emptyFilterTitle')} description={tab === 'all' ? t('emptyDescription') : undefined} />
        ) : (
          groups.map(([key, sales]) => (
            <View key={key} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="label" color="placeholder">
                  {formatRelativeDayLabel(new Date(sales[0]!.createdAt))}
                </Text>
                <Text variant="label" color="placeholder">
                  {formatBRL(
                    sales
                      .filter((sale) => sale.status !== 'CANCELLED')
                      .reduce((sum, sale) => sum + Number(sale.total), 0)
                      .toFixed(2),
                  )}
                </Text>
              </View>
              <Card>
                {sales.map((sale, index) => (
                  <SaleRow key={sale.id} sale={sale} isLast={index === sales.length - 1} />
                ))}
              </Card>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
