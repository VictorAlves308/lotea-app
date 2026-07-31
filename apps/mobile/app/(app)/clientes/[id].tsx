import type { Sale } from '@lotea/shared';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { useCustomer, useCustomerStatement } from '../../../src/features/customers/hooks/useCustomer';
import { getSale } from '../../../src/features/sales/api';
import { Button, IconButton } from '../../../src/shared/components/Button';
import { Card } from '../../../src/shared/components/Card';
import { EmptyState } from '../../../src/shared/components/EmptyState';
import { Skeleton } from '../../../src/shared/components/Skeleton';
import { StatusBadge } from '../../../src/shared/components/StatusBadge';
import { Text } from '../../../src/shared/components/Text';
import { formatBRL } from '../../../src/shared/lib/currency';
import { formatRelativeDayLabel } from '../../../src/shared/lib/date-format';
import { setPendingCustomerSelection } from '../../../src/shared/lib/pending-selection';
import { saleStatusToBadge } from '../../../src/shared/lib/sale-status';
import { palette } from '../../../src/shared/theme/colors';

function BackChevron() {
  return (
    <Text variant="body" weight="bold" color="ink" style={{ fontSize: 18, lineHeight: 18 }}>
      ‹
    </Text>
  );
}

function ProfileStat({ label, value, color }: { label: string; value: string; color?: 'ink' | 'success' }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: 13, paddingHorizontal: 8 }}>
      <Text variant="caption" color="muted" style={{ fontSize: 10, marginBottom: 5 }}>
        {label}
      </Text>
      <Text variant="title" color={color ?? 'ink'} style={{ fontSize: 14 }}>
        {value}
      </Text>
    </Card>
  );
}

/** Full itemized breakdown of one sale — opened from a recent-purchase row, since that row's own summary line is truncated to one line and can't show every item. */
function SaleDetailSheet({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  const { t } = useTranslation('customers');
  const activeItems = sale?.items.filter((item) => !item.voidedAt) ?? [];

  return (
    <Modal visible={sale !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(18,16,16,0.45)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: palette.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '82%',
            paddingTop: 20,
            paddingBottom: 32,
          }}
        >
          {sale ? (
            <>
              <View style={{ paddingHorizontal: 24, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text variant="title" color="ink">
                    {t('saleDetailTitle')}
                  </Text>
                  <Text variant="caption" color="muted">
                    {formatRelativeDayLabel(new Date(sale.createdAt))}
                  </Text>
                </View>
                {sale.status ? <StatusBadge status={saleStatusToBadge(sale.status)} /> : null}
              </View>

              <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 8 }}>
                <Card>
                  {activeItems.map((item, index) => (
                    <View
                      key={item.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 12,
                        borderTopWidth: index === 0 ? 0 : 1,
                        borderTopColor: palette.dividerSoft,
                      }}
                    >
                      <Text variant="body" color="ink" numberOfLines={1} style={{ flex: 1, paddingRight: 12 }}>
                        {item.productName}
                      </Text>
                      <Text variant="body" weight="semibold" color="ink">
                        {formatBRL(item.salePrice)}
                      </Text>
                    </View>
                  ))}
                </Card>
              </ScrollView>

              <View style={{ paddingHorizontal: 24, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="body" weight="medium" color="muted">
                  {t('saleDetailTotalLabel')}
                </Text>
                <Text variant="title" color="ink">
                  {formatBRL(sale.total)}
                </Text>
              </View>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ProfileSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, padding: 24, gap: 16 }}>
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-48 w-full" />
    </View>
  );
}

export default function PerfilClienteScreen() {
  const { t } = useTranslation(['customers', 'common']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: customer, isLoading, isError } = useCustomer(id);
  const { data: statement } = useCustomerStatement(id);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['customers'] }),
      queryClient.invalidateQueries({ queryKey: ['sales'] }),
    ]);
    setRefreshing(false);
  }

  const { totalSpent, purchasesCount, recentSales } = useMemo(() => {
    const saleLines = (statement?.items ?? [])
      .filter((line) => line.type === 'SALE')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const activeSales = saleLines.filter((line) => line.saleStatus !== 'CANCELLED');
    const spent = activeSales.reduce((sum, line) => sum + Number(line.amount), 0);
    return { totalSpent: spent, purchasesCount: activeSales.length, recentSales: saleLines.slice(0, 5) };
  }, [statement]);

  // No batch "items sold" endpoint exists — each sale's own GET /sales/:id
  // already returns its item product names, so this fans out in parallel
  // rather than adding a new aggregate route for a list capped at 5 rows.
  const saleDetailQueries = useQueries({
    queries: recentSales.map((line) => ({
      queryKey: ['sales', 'detail', line.referenceId],
      queryFn: () => getSale(line.referenceId),
    })),
  });

  const { productsLabelBySaleId, saleById } = useMemo(() => {
    const labels = new Map<string, string>();
    const byId = new Map<string, Sale>();
    for (const query of saleDetailQueries) {
      const sale = query.data;
      if (!sale) continue;
      byId.set(sale.id, sale);
      const names = Array.from(new Set(sale.items.filter((item) => !item.voidedAt).map((item) => item.productName)));
      if (names.length > 0) labels.set(sale.id, names.join(', '));
    }
    return { productsLabelBySaleId: labels, saleById: byId };
  }, [saleDetailQueries]);

  const selectedSale = selectedSaleId ? (saleById.get(selectedSaleId) ?? null) : null;

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (isError || !customer) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: palette.bg, paddingHorizontal: 24 }}>
        <Text variant="body" color="ink" style={{ textAlign: 'center' }}>
          {t('customers:loadProfileError')}
        </Text>
        <Button label={t('common:back')} variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const initials = customer.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon={<BackChevron />} accessibilityLabel={t('common:back')} onPress={() => router.back()} />
        <Text variant="title" color="ink">
          {t('customers:profileTitle')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.primary} />}
      >
        <View style={{ alignItems: 'center', gap: 4, paddingVertical: 8 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: palette.primaryTint,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
            }}
          >
            <Text variant="heading1" color="primary">
              {initials}
            </Text>
          </View>
          <Text variant="heading2" color="ink">
            {customer.name}
          </Text>
          {customer.phone ? (
            <Text variant="body" color="muted">
              {customer.phone}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ProfileStat label={t('customers:totalSpent')} value={formatBRL(totalSpent.toFixed(2))} color="success" />
          <ProfileStat label={t('customers:purchasesCount')} value={String(purchasesCount)} />
          <ProfileStat
            label={t('customers:balanceLabel')}
            value={formatBRL(customer.balance)}
            color={Number(customer.balance) > 0 ? 'ink' : 'success'}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button
              label={t('customers:newSaleButton')}
              onPress={() => {
                setPendingCustomerSelection(queryClient, customer);
                router.push('/vendas/nova');
              }}
              fullWidth
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={t('customers:chargeButton')}
              variant="secondary"
              onPress={() => router.push(`/pagamentos/cobrar/${customer.id}`)}
              disabled={Number(customer.balance) <= 0}
              fullWidth
            />
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="label" color="placeholder">
            {t('customers:recentPurchasesLabel')}
          </Text>
          {recentSales.length === 0 ? (
            <EmptyState title={t('customers:noPurchases')} />
          ) : (
            <Card>
              {recentSales.map((line, index) => (
                <Pressable
                  key={line.referenceId}
                  onPress={() => setSelectedSaleId(line.referenceId)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    borderBottomWidth: index === recentSales.length - 1 ? 0 : 1,
                    borderBottomColor: palette.dividerSoft,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text variant="body" color="ink" numberOfLines={1}>
                      {productsLabelBySaleId.get(line.referenceId) ?? t('customers:saleLine')}
                    </Text>
                    <Text variant="caption" color="muted">
                      {formatRelativeDayLabel(new Date(line.date))}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text variant="body" weight="semibold" color="success">
                      +{formatBRL(line.amount)}
                    </Text>
                    {line.saleStatus ? <StatusBadge status={saleStatusToBadge(line.saleStatus)} /> : null}
                  </View>
                </Pressable>
              ))}
            </Card>
          )}
        </View>
      </ScrollView>

      <SaleDetailSheet sale={selectedSale} onClose={() => setSelectedSaleId(null)} />
    </View>
  );
}
