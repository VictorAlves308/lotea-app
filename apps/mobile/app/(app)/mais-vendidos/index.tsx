import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { useRequireAuth } from '../../../src/features/auth/hooks/useRequireAuth';
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
type Period = 'month' | 'quarter' | 'year';

interface RankedProduct {
  productId: string;
  name: string;
  brand: string | null;
  quantity: number;
  revenue: string;
}

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

function rangeFor(period: Period, today: Date): { from: Date; to: Date } {
  if (period === 'year') {
    return { from: new Date(today.getFullYear(), 0, 1), to: today };
  }
  if (period === 'quarter') {
    return { from: new Date(today.getFullYear(), today.getMonth() - 2, 1), to: today };
  }
  return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: today };
}

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function PodiumTile({ product, rank }: { product: RankedProduct; rank: 1 | 2 | 3 }) {
  const isFirst = rank === 1;
  const { t } = useTranslation('topSellers');

  return (
    <View
      style={{
        flex: isFirst ? 1.2 : 1,
        backgroundColor: isFirst ? palette.ink : palette.surface,
        borderRadius: isFirst ? 16 : 14,
        borderWidth: isFirst ? 0 : 1,
        borderColor: palette.dividerSoft,
        padding: isFirst ? 16 : 12,
        marginTop: isFirst ? 0 : rank === 2 ? 14 : 22,
        alignItems: 'center',
        gap: 6,
        overflow: 'hidden',
      }}
    >
      {isFirst ? (
        <View style={{ backgroundColor: 'rgba(199,75,40,0.2)', borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8, marginBottom: 2 }}>
          <Text variant="caption" weight="bold" color="primary">
            {t('rankBadge', { rank })}
          </Text>
        </View>
      ) : (
        <Text variant="title" color="placeholder" style={{ fontSize: 16 }}>
          {rank}
        </Text>
      )}
      <View
        style={{
          width: isFirst ? 44 : 36,
          height: isFirst ? 44 : 36,
          borderRadius: isFirst ? 22 : 18,
          backgroundColor: isFirst ? palette.primary : palette.dividerSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text variant="body" weight="bold" style={{ color: isFirst ? '#FFFFFF' : palette.muted, fontSize: isFirst ? 14 : 12 }}>
          {initialOf(product.name)}
        </Text>
      </View>
      <Text
        variant="caption"
        weight="semibold"
        style={{ color: isFirst ? '#FFFFFF' : palette.ink, textAlign: 'center' }}
        numberOfLines={1}
      >
        {product.name}
      </Text>
      {product.brand ? (
        <Text
          variant="label"
          style={{ color: isFirst ? 'rgba(255,255,255,0.5)' : palette.placeholder, textAlign: 'center', textTransform: 'none' }}
          numberOfLines={1}
        >
          {product.brand}
        </Text>
      ) : null}
      <Text variant="body" weight="bold" style={{ color: isFirst ? '#FFFFFF' : palette.ink, fontSize: isFirst ? 16 : 13 }}>
        {formatBRL(product.revenue)}
      </Text>
    </View>
  );
}

function MaisVendidosSkeleton() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 24, gap: 16 }}>
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-48 w-full" />
    </ScrollView>
  );
}

export default function MaisVendidosScreen() {
  const { t } = useTranslation(['topSellers', 'common']);
  const { checkingAuth } = useRequireAuth();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>('quarter');
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    setRefreshing(false);
  }

  const range = useMemo(() => rangeFor(period, new Date()), [period]);
  const { data, isLoading, isError, refetch } = useFinancialDashboard(
    {
      from: toDateInputValue(range.from),
      to: toDateInputValue(range.to),
      granularity: 'month',
      rankingLimit: 10,
    },
    { enabled: !checkingAuth },
  );

  if (checkingAuth || isLoading) {
    return <MaisVendidosSkeleton />;
  }

  if (isError || !data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: palette.bg, paddingHorizontal: 24 }}>
        <Text variant="body" color="ink" style={{ textAlign: 'center' }}>
          {t('topSellers:loadError')}
        </Text>
        <Button label={t('topSellers:retryButton')} variant="secondary" onPress={() => refetch()} />
      </View>
    );
  }

  const products = data.topProducts;
  const topRevenue = products.length > 0 ? Number(products[0]!.revenue) : 0;
  const totalRevenue = products.reduce((sum, product) => sum + Number(product.revenue), 0);
  const periodLabel = {
    month: t('topSellers:periodMonth'),
    quarter: t('topSellers:periodQuarter'),
    year: t('topSellers:periodYear'),
  }[period];

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon={<BackChevron />} accessibilityLabel={t('common:back')} onPress={() => router.back()} />
        <Text variant="title" color="ink">
          {t('topSellers:title')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerClassName="gap-4 px-4 py-6 md:mx-auto md:w-full md:max-w-2xl md:px-8 md:py-10"
        contentContainerStyle={{ paddingBottom: SCROLL_BOTTOM_PADDING }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.primary} />}
      >
        <Text variant="body" color="muted">
          {t('topSellers:subtitle', { period: periodLabel })}
        </Text>

        <SegmentedControl
          accessibilityLabel={t('topSellers:title')}
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'month', label: t('topSellers:periodMonth') },
            { value: 'quarter', label: t('topSellers:periodQuarter') },
            { value: 'year', label: t('topSellers:periodYear') },
          ]}
        />

        {products.length === 0 ? (
          <EmptyState title={t('topSellers:emptyTitle')} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
              {products[1] ? <PodiumTile product={products[1]} rank={2} /> : <View style={{ flex: 1 }} />}
              <PodiumTile product={products[0]!} rank={1} />
              {products[2] ? <PodiumTile product={products[2]} rank={3} /> : <View style={{ flex: 1 }} />}
            </View>

            <Card>
              {products.map((product, index) => {
                const pct = totalRevenue > 0 ? Math.round((Number(product.revenue) / totalRevenue) * 100) : 0;
                const widthPct = topRevenue > 0 ? Math.max(4, Math.round((Number(product.revenue) / topRevenue) * 100)) : 0;
                return (
                  <View
                    key={product.productId}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      borderBottomWidth: index === products.length - 1 ? 0 : 1,
                      borderBottomColor: palette.dividerSoft,
                    }}
                  >
                    <Text variant="caption" weight="bold" color="placeholder" style={{ width: 16 }}>
                      {index + 1}
                    </Text>
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text variant="body" weight="semibold" color="ink" numberOfLines={1}>
                            {product.name}
                          </Text>
                          <Text variant="caption" color="muted" numberOfLines={1}>
                            {[product.brand, t('topSellers:unitsSoldCaption', { count: product.quantity })].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                        <Text variant="body" weight="semibold" color="ink">
                          {formatBRL(product.revenue)}
                        </Text>
                      </View>
                      <View style={{ height: 4, backgroundColor: palette.dividerSoft, borderRadius: 2 }}>
                        <View
                          style={{
                            height: '100%',
                            width: `${widthPct}%`,
                            backgroundColor: index === 0 ? palette.ink : index === 1 ? palette.primary : palette.placeholder,
                            borderRadius: 2,
                          }}
                        />
                      </View>
                    </View>
                    <Text variant="caption" color="muted" style={{ width: 32, textAlign: 'right' }}>
                      {pct}%
                    </Text>
                  </View>
                );
              })}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
