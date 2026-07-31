import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, RefreshControl, ScrollView, View, type TextStyle } from 'react-native';

import { useCurrentUser } from '../../../src/features/auth/hooks/useCurrentUser';
import { useRequireAuth } from '../../../src/features/auth/hooks/useRequireAuth';
import { LineAreaChart, type ChartSeriesPoint } from '../../../src/features/dashboard/components/LineAreaChart';
import { useFinancialDashboard } from '../../../src/features/dashboard/hooks/useFinancialDashboard';
import { Button, IconButton } from '../../../src/shared/components/Button';
import { Card } from '../../../src/shared/components/Card';
import { EmptyState } from '../../../src/shared/components/EmptyState';
import { SegmentedControl } from '../../../src/shared/components/SegmentedControl';
import { Skeleton } from '../../../src/shared/components/Skeleton';
import { Text } from '../../../src/shared/components/Text';
import { formatBRL } from '../../../src/shared/lib/currency';
import { formatRelativeTime } from '../../../src/shared/lib/relative-time';
import { palette } from '../../../src/shared/theme/colors';

type Period = '7d' | '15d' | '30d' | 'thisMonth' | 'lastMonth';
type RankingTab = 'customers' | 'products' | 'brands';

const PERIOD_DAY_COUNT: Partial<Record<Period, number>> = { '7d': 7, '15d': 15, '30d': 30 };

/** Tabular figures for money/counts — digits line up instead of jittering as they change. */
const TABULAR_NUMS: TextStyle = { fontVariant: ['tabular-nums'] };

/** Extra bottom room so content never sits under the floating bottom-nav pill. */
const SCROLL_BOTTOM_PADDING = 120;

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

/** "Julho - 2026" — the year matters here since the app spans multiple years, unlike a bare month name. */
function formatMonthYear(date: Date): string {
  return `${capitalize(date.toLocaleDateString('pt-BR', { month: 'long' }))} - ${date.getFullYear()}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, date.getDate());
}

interface PeriodRange {
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
  /** Set only for month-based periods — names the exact prior calendar month for the "vs {{month}}" comparison label. */
  previousMonthAnchor?: Date;
}

/**
 * `thisMonth`/`lastMonth` compare against the same day-count into the prior
 * calendar month (clamped to that month's real length), not the prior
 * month's full total — comparing a partial current month against a full
 * previous one would make every month look like a decline until its last
 * day. Day-window periods (7/15/30d) compare against the immediately
 * preceding window of the same length.
 */
function getPeriodRange(period: Period, today: Date): PeriodRange {
  if (period === 'thisMonth') {
    const from = startOfMonth(today);
    const previousMonthAnchor = addMonths(today, -1);
    const previousFrom = startOfMonth(previousMonthAnchor);
    const previousMonthLastDay = endOfMonth(previousMonthAnchor).getDate();
    const previousTo = new Date(
      previousFrom.getFullYear(),
      previousFrom.getMonth(),
      Math.min(today.getDate(), previousMonthLastDay),
    );
    return { from, to: today, previousFrom, previousTo, previousMonthAnchor };
  }

  if (period === 'lastMonth') {
    const anchor = addMonths(today, -1);
    const from = startOfMonth(anchor);
    const to = endOfMonth(anchor);
    const previousMonthAnchor = addMonths(today, -2);
    const previousFrom = startOfMonth(previousMonthAnchor);
    const previousTo = endOfMonth(previousMonthAnchor);
    return { from, to, previousFrom, previousTo, previousMonthAnchor };
  }

  const days = PERIOD_DAY_COUNT[period]!;
  const to = today;
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  const previousTo = new Date(from);
  previousTo.setDate(previousTo.getDate() - 1);
  const previousFrom = new Date(previousTo);
  previousFrom.setDate(previousFrom.getDate() - (days - 1));
  return { from, to, previousFrom, previousTo };
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text variant="title" color="ink">
      {children}
    </Text>
  );
}

function SecondaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 130, gap: 4 }}>
      <Text variant="caption" style={{ color: 'rgba(255,255,255,0.6)' }}>
        {label}
      </Text>
      <Text variant="title" style={[TABULAR_NUMS, { color: '#FFFFFF' }]}>
        {value}
      </Text>
    </View>
  );
}

function StatusLegendItem({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text variant="body" style={[TABULAR_NUMS, { fontSize: 13 }]}>
        <Text variant="body" weight="semibold" color="ink" style={{ fontSize: 13 }}>
          {count}
        </Text>{' '}
        <Text variant="body" color="muted" style={{ fontSize: 13 }}>
          {label}
        </Text>
      </Text>
    </View>
  );
}

function RankingRow({
  primary,
  secondary,
  amount,
  isLast,
  onPress,
}: {
  primary: string;
  secondary?: string;
  amount: string;
  isLast: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={primary}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: palette.dividerSoft,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text variant="body" color="ink" numberOfLines={1}>
          {primary}
        </Text>
        {secondary ? (
          <Text variant="caption" color="muted">
            {secondary}
          </Text>
        ) : null}
      </View>
      <Text variant="body" weight="semibold" color="ink" style={TABULAR_NUMS}>
        {amount}
      </Text>
    </Pressable>
  );
}

interface PeriodOption {
  value: Period;
  label: string;
}

/** A bottom sheet listing period presets — opened by tapping the "Faturamento" figure itself, per the approved header redesign. */
function PeriodFilterSheet({
  visible,
  period,
  options,
  title,
  onSelect,
  onClose,
}: {
  visible: boolean;
  period: Period;
  options: PeriodOption[];
  title: string;
  onSelect: (value: Period) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityLabel={title}
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
            paddingHorizontal: 12,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 8,
              marginBottom: 12,
            }}
          >
            <Text variant="title" color="ink">
              {title}
            </Text>
            <IconButton
              icon={<Ionicons name="close" size={18} color={palette.ink} />}
              accessibilityLabel={title}
              onPress={onClose}
            />
          </View>
          {options.map((option) => {
            const selected = option.value === period;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: selected ? palette.primaryTint : pressed ? palette.dividerFaint : 'transparent',
                })}
              >
                <Text variant="body" weight={selected ? 'semibold' : 'regular'} color={selected ? 'primary' : 'ink'}>
                  {option.label}
                </Text>
                {selected ? <Ionicons name="checkmark" size={18} color={palette.primary} /> : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DashboardSkeleton() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerClassName="gap-6 px-4 py-6 md:mx-auto md:w-full md:max-w-3xl md:px-8 md:py-10 lg:max-w-5xl"
      contentContainerStyle={{ paddingBottom: SCROLL_BOTTOM_PADDING }}
    >
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-44 w-full" />
      <View className="gap-6 md:flex-row">
        <Skeleton className="h-48 md:flex-1" />
        <Skeleton className="h-48 md:flex-1" />
      </View>
      <View className="gap-6 md:flex-row">
        <Skeleton className="h-72 md:flex-1" />
        <Skeleton className="h-72 md:flex-1" />
      </View>
    </ScrollView>
  );
}

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { checkingAuth } = useRequireAuth();
  const [period, setPeriod] = useState<Period>('thisMonth');
  const [rankingTab, setRankingTab] = useState<RankingTab>('customers');
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: currentUser } = useCurrentUser({ enabled: !checkingAuth });

  const range = useMemo(() => getPeriodRange(period, new Date()), [period]);
  const currentParams = useMemo(
    () => ({
      from: toDateInputValue(range.from),
      to: toDateInputValue(range.to),
      granularity: 'day' as const,
      rankingLimit: 5,
    }),
    [range],
  );
  const previousParams = useMemo(
    () => ({
      from: toDateInputValue(range.previousFrom),
      to: toDateInputValue(range.previousTo),
      granularity: 'day' as const,
      rankingLimit: 1,
    }),
    [range],
  );

  const { data, isLoading, isError, refetch, isRefetching } = useFinancialDashboard(currentParams, {
    enabled: !checkingAuth,
  });
  // A second, minimal fetch for the prior comparable window — only used for
  // the "+12% vs junho" trend figure, never rendered on its own.
  const { data: previousData } = useFinancialDashboard(previousParams, { enabled: !checkingAuth });

  if (checkingAuth || isLoading) {
    return <DashboardSkeleton />;
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
          {t('dashboard:loadError')}
        </Text>
        <Button label={t('dashboard:retryButton')} variant="secondary" onPress={() => refetch()} />
      </View>
    );
  }

  const hasAnyActivity =
    data.salesByStatus.paid +
      data.salesByStatus.partiallyPaid +
      data.salesByStatus.pending +
      data.salesByStatus.cancelled >
    0;

  const chartPoints: ChartSeriesPoint[] = data.timeline.map((bucket) => ({
    label: new Date(bucket.bucket).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    sold: Number(bucket.sold),
    received: Number(bucket.received),
  }));

  const statusTotal = Math.max(
    1,
    data.salesByStatus.paid +
      data.salesByStatus.partiallyPaid +
      data.salesByStatus.pending +
      data.salesByStatus.cancelled,
  );

  const rankingItems: { key: string; primary: string; secondary?: string; amount: string }[] =
    rankingTab === 'customers'
      ? data.topCustomersByBalance.map((customer) => ({
          key: customer.customerId,
          primary: customer.name,
          amount: formatBRL(customer.outstanding),
        }))
      : rankingTab === 'products'
        ? data.topProducts.map((product) => ({
            key: product.productId,
            primary: product.name,
            secondary: t('dashboard:quantityLabel', { count: product.quantity }),
            amount: formatBRL(product.revenue),
          }))
        : data.topBrands.map((brand) => ({
            key: brand.brand,
            primary: brand.brand,
            amount: formatBRL(brand.revenue),
          }));

  const rankingEmptyLabel =
    rankingTab === 'customers'
      ? t('dashboard:noCustomerBalances')
      : rankingTab === 'products'
        ? t('dashboard:noProductsSold')
        : t('dashboard:noBrandsSold');

  const periodOptions: PeriodOption[] = [
    { value: '7d', label: t('dashboard:period7d') },
    { value: '15d', label: t('dashboard:period15d') },
    { value: '30d', label: t('dashboard:period30d') },
    { value: 'thisMonth', label: t('dashboard:periodThisMonth') },
    { value: 'lastMonth', label: t('dashboard:periodLastMonth') },
  ];

  const periodContextLabel =
    period === 'thisMonth' || period === 'lastMonth'
      ? formatMonthYear(range.from)
      : t('dashboard:periodWindowLabel', { count: PERIOD_DAY_COUNT[period] });

  // Never divide by zero, and never claim growth "from nothing" — a
  // previous-period total of zero makes a percentage meaningless (could
  // read as +∞%), so the trend badge simply doesn't render for that case.
  const currentSold = Number(data.totalSoldInPeriod);
  const previousSold = previousData ? Number(previousData.totalSoldInPeriod) : null;
  const growthPct =
    previousSold !== null && previousSold > 0 ? Math.round(((currentSold - previousSold) / previousSold) * 100) : null;

  const comparisonLabel = range.previousMonthAnchor
    ? t('dashboard:vsMonth', { month: range.previousMonthAnchor.toLocaleDateString('pt-BR', { month: 'long' }) })
    : t('dashboard:vsPreviousWindow');

  const trendColor =
    growthPct === null || growthPct === 0
      ? 'rgba(255,255,255,0.7)'
      : growthPct > 0
        ? palette.successGlow
        : '#FF8A8A';
  const trendIcon: keyof typeof Ionicons.glyphMap =
    growthPct === null || growthPct === 0 ? 'remove-outline' : growthPct > 0 ? 'trending-up' : 'trending-down';

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: palette.bg }}
        contentContainerClassName="gap-6 px-4 py-6 md:mx-auto md:w-full md:max-w-3xl md:px-8 md:py-10 lg:max-w-5xl"
        contentContainerStyle={{ paddingBottom: SCROLL_BOTTOM_PADDING }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={palette.primary} />
        }
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ gap: 2 }}>
            <Text variant="heading1" color="ink">
              {t('dashboard:greeting', { name: currentUser?.name ?? '' })}
            </Text>
            <Text variant="body" color="muted">
              {formatMonthYear(new Date())}
            </Text>
          </View>
          <IconButton
            icon={<Ionicons name="notifications-outline" size={20} color={palette.ink} />}
            accessibilityLabel={t('dashboard:notificationsLabel')}
            onPress={() => {}}
          />
        </View>

        <Card variant="hero">
          <Pressable
            onPress={() => setFilterOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard:filterTitle')}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text variant="label" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {t('dashboard:revenueCardLabel')}
              </Text>
              <Ionicons name="chevron-down" size={13} color="rgba(255,255,255,0.6)" />
            </View>
            <Text variant="body" style={{ color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
              {periodContextLabel}
            </Text>
            {hasAnyActivity ? (
              <>
                <Text
                  variant="display"
                  style={[TABULAR_NUMS, { color: '#FFFFFF', fontSize: 36, lineHeight: 40, marginTop: 8 }]}
                  numberOfLines={1}
                >
                  {formatBRL(data.totalSoldInPeriod)}
                </Text>
                {growthPct !== null ? (
                  <View
                    style={{
                      marginTop: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      alignSelf: 'flex-start',
                      borderRadius: 999,
                      paddingVertical: 4,
                      paddingHorizontal: 10,
                      backgroundColor: 'rgba(255,255,255,0.1)',
                    }}
                  >
                    <Ionicons name={trendIcon} size={14} color={trendColor} />
                    <Text variant="caption" weight="semibold" style={{ color: trendColor }}>
                      {growthPct > 0 ? `+${growthPct}` : growthPct}% {comparisonLabel}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={{ marginTop: 16, gap: 4 }}>
                <Text variant="title" style={{ color: '#FFFFFF' }}>
                  {t('dashboard:noData')}
                </Text>
                <Text variant="body" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {t('dashboard:noDataDescription')}
                </Text>
              </View>
            )}
          </Pressable>

          {hasAnyActivity ? (
            <View
              style={{
                marginTop: 20,
                paddingTop: 16,
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 20,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255,255,255,0.12)',
              }}
            >
              <SecondaryStat label={t('dashboard:totalReceived')} value={formatBRL(data.totalReceivedInPeriod)} />
              <SecondaryStat label={t('dashboard:totalOutstanding')} value={formatBRL(data.totalOutstanding)} />
              <SecondaryStat label={t('dashboard:averageTicket')} value={formatBRL(data.averageTicket)} />
              <SecondaryStat
                label={t('dashboard:customersWithBalance')}
                value={String(data.customersWithBalanceCount)}
              />
            </View>
          ) : null}
        </Card>

        <View className="gap-6 md:flex-row">
          <Card className="md:flex-1">
            <SectionLabel>{t('dashboard:trendTitle')}</SectionLabel>
            <View style={{ marginTop: 12 }}>
              {chartPoints.length > 0 ? (
                <LineAreaChart
                  points={chartPoints}
                  soldLabel={t('dashboard:totalSold')}
                  receivedLabel={t('dashboard:totalReceived')}
                />
              ) : (
                <EmptyState title={t('dashboard:noTimelineData')} />
              )}
            </View>
          </Card>

          <Card className="md:flex-1">
            <SectionLabel>{t('dashboard:salesByStatus')}</SectionLabel>
            {/* Green marks only "Pago" — the one fully-confirmed state. Parcial
                takes warning amber (not green — a partial payment is not yet
                resolved), Pendente stays neutral, Cancelada fades to the
                faintest divider tone so a glance never reads an unresolved or
                voided sale as good news. */}
            <View
              style={{
                marginTop: 16,
                height: 10,
                flexDirection: 'row',
                overflow: 'hidden',
                borderRadius: 999,
                backgroundColor: palette.dividerFaint,
              }}
            >
              <View
                style={{
                  height: '100%',
                  backgroundColor: palette.success,
                  width: `${(data.salesByStatus.paid / statusTotal) * 100}%`,
                }}
              />
              <View
                style={{
                  height: '100%',
                  backgroundColor: palette.warning,
                  width: `${(data.salesByStatus.partiallyPaid / statusTotal) * 100}%`,
                }}
              />
              <View
                style={{
                  height: '100%',
                  backgroundColor: palette.placeholder,
                  width: `${(data.salesByStatus.pending / statusTotal) * 100}%`,
                }}
              />
              <View
                style={{
                  height: '100%',
                  backgroundColor: palette.dividerSoft,
                  width: `${(data.salesByStatus.cancelled / statusTotal) * 100}%`,
                }}
              />
            </View>
            <View style={{ marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 12 }}>
              <StatusLegendItem color={palette.success} label={t('dashboard:statusPaid')} count={data.salesByStatus.paid} />
              <StatusLegendItem
                color={palette.warning}
                label={t('dashboard:statusPartiallyPaid')}
                count={data.salesByStatus.partiallyPaid}
              />
              <StatusLegendItem
                color={palette.placeholder}
                label={t('dashboard:statusPending')}
                count={data.salesByStatus.pending}
              />
              <StatusLegendItem
                color={palette.dividerSoft}
                label={t('dashboard:statusCancelled')}
                count={data.salesByStatus.cancelled}
              />
            </View>
          </Card>
        </View>

        <View className="gap-6 md:flex-row">
          <Card className="md:flex-1">
            <SegmentedControl
              accessibilityLabel={t('dashboard:rankingTabsLabel')}
              value={rankingTab}
              onChange={setRankingTab}
              options={[
                { value: 'customers', label: t('dashboard:topCustomers') },
                { value: 'products', label: t('dashboard:topProducts') },
                { value: 'brands', label: t('dashboard:topBrands') },
              ]}
            />
            <View style={{ marginTop: 16 }}>
              {rankingItems.length > 0 ? (
                rankingItems.map((item, index) => (
                  <RankingRow
                    key={item.key}
                    primary={item.primary}
                    secondary={item.secondary}
                    amount={item.amount}
                    isLast={index === rankingItems.length - 1}
                    onPress={() => {
                      if (rankingTab === 'customers') {
                        router.push(`/clientes/${item.key}`);
                      } else if (rankingTab === 'products') {
                        router.push(`/produtos/${item.key}`);
                      } else {
                        router.push(`/produtos?brand=${encodeURIComponent(item.key)}`);
                      }
                    }}
                  />
                ))
              ) : (
                <EmptyState title={rankingEmptyLabel} />
              )}
            </View>
          </Card>

          <Card className="md:flex-1">
            <SectionLabel>{t('dashboard:recentPayments')}</SectionLabel>
            <View style={{ marginTop: 12 }}>
              {data.recentPayments.length > 0 ? (
                data.recentPayments.map((payment, index) => (
                  <Pressable
                    key={payment.paymentId}
                    disabled={!payment.customerId}
                    onPress={() => payment.customerId && router.push(`/clientes/${payment.customerId}`)}
                    accessibilityRole={payment.customerId ? 'button' : undefined}
                    accessibilityLabel={payment.customerName ?? undefined}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 12,
                      borderBottomWidth: index === data.recentPayments.length - 1 ? 0 : 1,
                      borderBottomColor: palette.dividerSoft,
                      opacity: pressed && payment.customerId ? 0.7 : 1,
                    })}
                  >
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text variant="body" color="ink" numberOfLines={1}>
                        {payment.customerName ?? t('dashboard:walkInCustomer')}
                      </Text>
                      <Text variant="caption" color="muted">
                        {formatRelativeTime(new Date(payment.createdAt), t)}
                      </Text>
                    </View>
                    <Text variant="body" weight="semibold" color="success" style={TABULAR_NUMS}>
                      {formatBRL(payment.amount)}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <EmptyState title={t('dashboard:noRecentPayments')} />
              )}
            </View>
          </Card>
        </View>
      </ScrollView>

      <PeriodFilterSheet
        visible={filterOpen}
        period={period}
        options={periodOptions}
        title={t('dashboard:filterTitle')}
        onSelect={setPeriod}
        onClose={() => setFilterOpen(false)}
      />
    </>
  );
}
