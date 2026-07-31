import type { Lot } from '@lotea/shared';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { useRequireAuth } from '../../../src/features/auth/hooks/useRequireAuth';
import { getLot } from '../../../src/features/lots/api';
import { useLotsList } from '../../../src/features/lots/hooks/useLotsList';
import { Button } from '../../../src/shared/components/Button';
import { Card } from '../../../src/shared/components/Card';
import { EmptyState } from '../../../src/shared/components/EmptyState';
import { Skeleton } from '../../../src/shared/components/Skeleton';
import { Text } from '../../../src/shared/components/Text';
import { formatBRL } from '../../../src/shared/lib/currency';
import { palette } from '../../../src/shared/theme/colors';

const SCROLL_BOTTOM_PADDING = 120;

function KpiTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.surface,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: palette.dividerSoft,
        padding: 11,
      }}
    >
      <Text variant="caption" color="placeholder" style={{ fontSize: 10, marginBottom: 4 }}>
        {label}
      </Text>
      <Text variant="title" style={{ fontSize: 15, color: color ?? palette.ink }}>
        {value}
      </Text>
    </View>
  );
}

function LotesSkeleton() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 24, gap: 16 }}>
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-48 w-full" />
    </ScrollView>
  );
}

export default function LotesScreen() {
  const { t } = useTranslation('lots');
  const { checkingAuth } = useRequireAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useLotsList({ limit: 50 }, { enabled: !checkingAuth });

  async function handleRefresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['lots'] });
    setRefreshing(false);
  }
  const lots: Lot[] = useMemo(() => data?.items ?? [], [data]);

  // No batch "financials for every lot" endpoint exists — each lot's own
  // GET /lots/:id already returns them, so this fans out in parallel rather
  // than adding a new aggregate backend route for a screen that, per the
  // phased plan, only needs to read what's already there.
  const detailQueries = useQueries({
    queries: lots.map((lot) => ({
      queryKey: ['lots', 'detail', lot.id],
      queryFn: () => getLot(lot.id),
      enabled: !checkingAuth && lots.length > 0,
    })),
  });

  const { activeCount, totalInvested, marginPct, featured, previous } = useMemo(() => {
    const detailsByLotId = new Map(
      detailQueries
        .map((query) => query.data)
        .filter((detail): detail is NonNullable<typeof detail> => Boolean(detail))
        .map((detail) => [detail.lot.id, detail]),
    );

    const activeLots = lots.filter((lot) => lot.status === 'ACTIVE');
    const activeDetails = activeLots
      .map((lot) => detailsByLotId.get(lot.id))
      .filter((detail): detail is NonNullable<typeof detail> => Boolean(detail));

    const invested = activeDetails.reduce((sum, detail) => sum + Number(detail.financials.totalCost), 0);
    const revenue = activeDetails.reduce((sum, detail) => sum + Number(detail.financials.revenue), 0);
    const received = activeDetails.reduce((sum, detail) => sum + Number(detail.financials.totalReceived), 0);
    // Lucro = recebido menos investido, nunca o faturado bruto — fiado em
    // aberto (vendido mas ainda não pago) não conta como lucro até realmente
    // entrar no bolso. E nunca só a margem das unidades já vendidas: isso
    // fazia parecer que um lote quase todo parado já tinha "dado lucro"
    // quando na real ainda faltava recuperar boa parte do investido.
    const profit = received - invested;
    const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

    const featuredLot = activeLots[0];
    const featuredDetail = featuredLot ? detailsByLotId.get(featuredLot.id) : undefined;

    const previousLots = lots
      .filter((lot) => lot.id !== featuredLot?.id)
      .map((lot) => ({ lot, detail: detailsByLotId.get(lot.id) }));

    return {
      activeCount: activeLots.length,
      totalInvested: invested,
      marginPct: margin,
      featured: featuredLot ? { lot: featuredLot, detail: featuredDetail } : null,
      previous: previousLots,
    };
  }, [lots, detailQueries]);

  if (checkingAuth || isLoading) {
    return <LotesSkeleton />;
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
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerClassName="gap-4 px-4 py-6 md:mx-auto md:w-full md:max-w-2xl md:px-8 md:py-10"
      contentContainerStyle={{ paddingBottom: SCROLL_BOTTOM_PADDING }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.primary} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="heading1" color="ink">
          {t('listTitle')}
        </Text>
        <Button label={t('newButton')} size="sm" onPress={() => router.push('/lotes/novo')} />
      </View>

      <View style={{ flexDirection: 'row', gap: 7 }}>
        <KpiTile label={t('activeLotsLabel')} value={String(activeCount)} />
        <KpiTile label={t('investedLabel')} value={formatBRL(totalInvested.toFixed(2))} color={palette.primary} />
        <KpiTile label={t('marginLabel')} value={`${marginPct}%`} color={palette.success} />
      </View>

      {lots.length === 0 ? (
        <Card>
          <EmptyState
            title={t('emptyTitle')}
            description={t('emptyDescription')}
            actionLabel={t('newButton')}
            onAction={() => router.push('/lotes/novo')}
          />
        </Card>
      ) : (
        <>
          {featured ? (
            <Pressable
              onPress={() => router.push(`/lotes/${featured.lot.id}`)}
              style={({ pressed }) => ({
                backgroundColor: palette.ink,
                borderRadius: 18,
                padding: 18,
                overflow: 'hidden',
                position: 'relative',
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <View
                style={{
                  position: 'absolute',
                  top: -20,
                  right: -20,
                  width: 90,
                  height: 90,
                  borderRadius: 45,
                  backgroundColor: 'rgba(199,75,40,0.15)',
                }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <View>
                  <Text variant="label" style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                    {featured.lot.name} · {t('currentLotLabel')}
                  </Text>
                </View>
                <View style={{ backgroundColor: 'rgba(39,138,73,0.25)', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 9 }}>
                  <Text variant="label" style={{ color: palette.successGlow, textTransform: 'none' }}>
                    {t(`status${featured.lot.status}`)}
                  </Text>
                </View>
              </View>
              {featured.detail ? (
                <>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="label" style={{ color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>
                        {t('investedStat')}
                      </Text>
                      <Text variant="body" weight="semibold" style={{ color: '#FFFFFF', fontSize: 13 }}>
                        {formatBRL(featured.detail.financials.totalCost)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="label" style={{ color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>
                        {t('revenueStat')}
                      </Text>
                      <Text variant="body" weight="semibold" style={{ color: palette.successGlow, fontSize: 13 }}>
                        {formatBRL(featured.detail.financials.revenue)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="label" style={{ color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>
                        {t('profitStat')}
                      </Text>
                      <Text
                        variant="body"
                        weight="semibold"
                        style={{
                          color: Number(featured.detail.financials.totalReceived) - Number(featured.detail.financials.totalCost) >= 0
                            ? palette.successGlow
                            : '#FFB4B4',
                          fontSize: 13,
                        }}
                      >
                        {formatBRL((Number(featured.detail.financials.totalReceived) - Number(featured.detail.financials.totalCost)).toFixed(2))}
                      </Text>
                    </View>
                  </View>
                  {featured.detail.financials.itemCount > 0 ? (
                    <>
                      <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                        <View
                          style={{
                            height: '100%',
                            width: `${Math.min(100, (featured.detail.financials.soldCount / featured.detail.financials.itemCount) * 100)}%`,
                            backgroundColor: palette.primary,
                            borderRadius: 2,
                          }}
                        />
                      </View>
                      <Text variant="label" style={{ color: 'rgba(255,255,255,0.35)', marginTop: 5, textTransform: 'none' }}>
                        {t('unitsSoldProgress', {
                          sold: featured.detail.financials.soldCount,
                          total: featured.detail.financials.itemCount,
                          pct: Math.round((featured.detail.financials.soldCount / featured.detail.financials.itemCount) * 100),
                        })}
                      </Text>
                    </>
                  ) : null}
                </>
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
            </Pressable>
          ) : null}

          {previous.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text variant="label" color="placeholder">
                {t('previousSectionTitle')}
              </Text>
              <Card>
                {previous.map(({ lot, detail }, index) => {
                  // Lucro = recebido − investido, nunca o faturado bruto —
                  // fiado em aberto não conta até ser pago. Mesmo lote sem
                  // nenhuma venda mostra o número real (negativo, igual ao
                  // investido) em vez de "nenhuma venda ainda".
                  const profit = detail ? Number(detail.financials.totalReceived) - Number(detail.financials.totalCost) : null;

                  return (
                    <Pressable
                      key={lot.id}
                      onPress={() => router.push(`/lotes/${lot.id}`)}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 12,
                        borderBottomWidth: index === previous.length - 1 ? 0 : 1,
                        borderBottomColor: palette.dividerSoft,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text variant="body" weight="semibold" color="ink" numberOfLines={1}>
                          {lot.name}
                        </Text>
                        <Text variant="caption" color="muted">
                          {t(`status${lot.status}`)}
                          {detail ? ` · ${t('productsCount', { count: detail.financials.itemCount })}` : ''}
                        </Text>
                      </View>
                      {detail ? (
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text variant="body" weight="semibold" color={profit! >= 0 ? 'success' : 'danger'}>
                            {profit! >= 0 ? '+' : ''}
                            {formatBRL(profit!.toFixed(2))}
                          </Text>
                        </View>
                      ) : (
                        <Skeleton className="h-4 w-16" />
                      )}
                    </Pressable>
                  );
                })}
              </Card>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
