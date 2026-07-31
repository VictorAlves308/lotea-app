import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { useLot } from '../../../src/features/lots/hooks/useLot';
import { Button, IconButton } from '../../../src/shared/components/Button';
import { Card } from '../../../src/shared/components/Card';
import { EmptyState } from '../../../src/shared/components/EmptyState';
import { Skeleton } from '../../../src/shared/components/Skeleton';
import { Text } from '../../../src/shared/components/Text';
import { formatBRL } from '../../../src/shared/lib/currency';
import { palette } from '../../../src/shared/theme/colors';

function BackChevron() {
  return (
    <Text variant="body" weight="bold" color="ink" style={{ fontSize: 18, lineHeight: 18 }}>
      ‹
    </Text>
  );
}

function StatTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: palette.dividerSoft,
        paddingVertical: 12,
        paddingHorizontal: 12,
      }}
    >
      <Text variant="label" color="placeholder" style={{ marginBottom: 5 }}>
        {label}
      </Text>
      <Text variant="title" style={{ fontSize: 16, color: color ?? palette.ink }}>
        {value}
      </Text>
    </View>
  );
}

function DetailSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, padding: 24, gap: 16 }}>
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-48 w-full" />
    </View>
  );
}

export default function LoteDetalheScreen() {
  const { t } = useTranslation(['lots', 'common']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, refetch, isRefetching } = useLot(id);

  if (isLoading) {
    return <DetailSkeleton />;
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
          {t('lots:loadDetailError')}
        </Text>
        <Button label={t('common:back')} variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const { lot, financials, customerBalances, items } = data;
  // Lucro = recebido − investido, nunca o faturado bruto — fiado em aberto
  // (vendido mas ainda não pago pelo cliente) não conta como lucro até
  // realmente entrar no bolso. Sempre um número real, mesmo antes de
  // qualquer venda (nesse caso é só −investido, não um "0,00" ambíguo).
  const profit = Number(financials.totalReceived) - Number(financials.totalCost);

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
          {t('lots:detailTitle')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, gap: 16 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={palette.primary} />}
      >
        <View>
          <Text variant="heading2" color="ink">
            {lot.name}
          </Text>
          <Text variant="caption" color="muted">
            {t(`lots:status${lot.status}`)}
            {lot.supplier ? ` · ${t('lots:supplierValueLabel', { value: lot.supplier })}` : ''}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <StatTile
            label={t('lots:investedStat')}
            value={formatBRL(financials.totalCost)}
            color={palette.primary}
          />
          <StatTile
            label={t('lots:revenueStat')}
            value={formatBRL(financials.revenue)}
            color={palette.success}
          />
          <StatTile
            label={t('lots:profitStat')}
            value={formatBRL(profit.toFixed(2))}
            color={profit >= 0 ? palette.success : palette.danger}
          />
        </View>

        {financials.itemCount > 0 ? (
          <View style={{ gap: 6 }}>
            <View style={{ height: 4, backgroundColor: palette.dividerSoft, borderRadius: 2 }}>
              <View
                style={{
                  height: '100%',
                  width: `${Math.min(100, (financials.soldCount / financials.itemCount) * 100)}%`,
                  backgroundColor: palette.primary,
                  borderRadius: 2,
                }}
              />
            </View>
            <Text variant="caption" color="muted">
              {t('lots:unitsSoldProgress', {
                sold: financials.soldCount,
                total: financials.itemCount,
                pct: Math.round((financials.soldCount / financials.itemCount) * 100),
              })}
            </Text>
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          <Text variant="label" color="placeholder">
            {t('lots:itemsSectionTitle')}
          </Text>
          {items.length === 0 ? (
            <EmptyState title={t('lots:noItemsTitle')} />
          ) : (
            <Card>
              {items.map((item, index) => (
                <View
                  key={`${item.productId}-${item.acquisitionCost}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: palette.dividerSoft,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text variant="body" weight="semibold" color="ink" numberOfLines={1}>
                      {item.productName}
                    </Text>
                    <Text variant="caption" color="muted">
                      {t('lots:unitCostCaption', {
                        quantity: item.quantity,
                        cost: item.acquisitionCost.replace('.', ','),
                      })}
                    </Text>
                  </View>
                  {item.soldCount > 0 ? (
                    <Text variant="caption" color="success">
                      {t('lots:soldCountCaption', { count: item.soldCount })}
                    </Text>
                  ) : null}
                </View>
              ))}
            </Card>
          )}
        </View>

        {customerBalances.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text variant="label" color="placeholder">
              {t('lots:customerBalancesSectionTitle')}
            </Text>
            <Card>
              {customerBalances.map((balance, index) => (
                <Pressable
                  key={balance.customerId}
                  onPress={() => router.push(`/clientes/${balance.customerId}`)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: palette.dividerSoft,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text
                    variant="body"
                    color="ink"
                    numberOfLines={1}
                    style={{ flex: 1, paddingRight: 12 }}
                  >
                    {balance.name}
                  </Text>
                  <Text variant="body" weight="semibold" color="ink">
                    {formatBRL(balance.outstanding)}
                  </Text>
                </Pressable>
              ))}
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
