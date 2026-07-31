import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';

import { useRequireAuth } from '../../../src/features/auth/hooks/useRequireAuth';
import { useProducts } from '../../../src/features/products/hooks/useProducts';
import { Button, IconButton } from '../../../src/shared/components/Button';
import { Card } from '../../../src/shared/components/Card';
import { EmptyState } from '../../../src/shared/components/EmptyState';
import { Skeleton } from '../../../src/shared/components/Skeleton';
import { StatusBadge } from '../../../src/shared/components/StatusBadge';
import { Text } from '../../../src/shared/components/Text';
import { palette } from '../../../src/shared/theme/colors';

const SCROLL_BOTTOM_PADDING = 120;

function BackChevron() {
  return (
    <Text variant="body" weight="bold" color="ink" style={{ fontSize: 18, lineHeight: 18 }}>
      ‹
    </Text>
  );
}

function KpiTile({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'warning' | 'danger' }) {
  const BG = { neutral: palette.surface, warning: palette.warningTint, danger: palette.dangerTint }[tone];
  const BORDER = { neutral: palette.dividerSoft, warning: palette.warningTint, danger: palette.dangerTint }[tone];
  const LABEL_COLOR = { neutral: palette.placeholder, warning: palette.warningStrong, danger: palette.dangerStrong }[tone];
  const VALUE_COLOR = { neutral: palette.ink, warning: palette.warning, danger: palette.danger }[tone];

  return (
    <View style={{ flex: 1, backgroundColor: BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 12, paddingHorizontal: 14 }}>
      <Text variant="label" style={{ color: LABEL_COLOR, marginBottom: 5 }}>
        {label}
      </Text>
      <Text variant="title" style={{ color: VALUE_COLOR, fontSize: 16 }}>
        {value}
      </Text>
    </View>
  );
}

function StockRow({
  id,
  name,
  brand,
  category,
  inStockCount,
  stockStatus,
  minStockAlert,
  isLast,
}: {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  inStockCount: number;
  stockStatus: 'IN_STOCK' | 'LOW' | 'OUT';
  minStockAlert: number | null;
  isLast: boolean;
}) {
  const { t } = useTranslation('inventory');
  const subtitle =
    stockStatus === 'OUT'
      ? t('outOfStockDetail')
      : stockStatus === 'LOW' && minStockAlert !== null
        ? t('lowStockDetail', { count: minStockAlert })
        : [brand, category].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={() => router.push(`/produtos/${id}`)}
      accessibilityRole="button"
      accessibilityLabel={name}
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
        <Text variant="body" weight="semibold" color="ink" numberOfLines={1}>
          {name}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text variant="body" weight="bold" color={stockStatus === 'OUT' ? 'danger' : stockStatus === 'LOW' ? 'warning' : 'ink'}>
          {t('totalUnitsCount', { count: inStockCount })}
        </Text>
        <StatusBadge status={stockStatus === 'OUT' ? 'outOfStock' : stockStatus === 'LOW' ? 'lowStock' : 'inStock'} />
      </View>
    </Pressable>
  );
}

/** A single "+" corner button (see Vendas' list header) opens this sheet to
 * choose between the two stock movements — Entrada and Saída aren't the same
 * action, so a single button can't jump straight to either. */
function EstoqueActionSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation('inventory');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(18,16,16,0.45)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: palette.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 20,
            paddingBottom: 40,
            paddingHorizontal: 12,
            gap: 4,
          }}
        >
          <Text variant="title" color="ink" style={{ paddingHorizontal: 12, marginBottom: 8 }}>
            {t('actionSheetTitle')}
          </Text>

          <Pressable
            onPress={() => {
              onClose();
              router.push('/estoque/entrada');
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingVertical: 14,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: pressed ? palette.dividerFaint : 'transparent',
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: palette.successTint, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: palette.success, fontSize: 16, lineHeight: 16 }}>+</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="body" weight="medium" color="ink">
                {t('entradaButton')}
              </Text>
              <Text variant="caption" color="muted">
                {t('entradaActionDescription')}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => {
              onClose();
              router.push('/estoque/saida');
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingVertical: 14,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: pressed ? palette.dividerFaint : 'transparent',
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: palette.dangerTint, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: palette.danger, fontSize: 16, lineHeight: 16 }}>−</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="body" weight="medium" color="ink">
                {t('saidaButton')}
              </Text>
              <Text variant="caption" color="muted">
                {t('saidaActionDescription')}
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function EstoqueSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-64 w-full" />
      </ScrollView>
    </View>
  );
}

export default function EstoqueScreen() {
  const { t } = useTranslation(['inventory', 'common']);
  const { checkingAuth } = useRequireAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useProducts({ limit: 100 }, { enabled: !checkingAuth });

  async function handleRefresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['products'] });
    setRefreshing(false);
  }

  const { filtered, total, lowCount, outCount, attention, inStock } = useMemo(() => {
    const items = data?.items ?? [];
    const query = search.trim().toLowerCase();
    const matching = query ? items.filter((product) => product.name.toLowerCase().includes(query)) : items;

    return {
      filtered: matching,
      total: items.reduce((sum, product) => sum + product.inStockCount, 0),
      lowCount: items.filter((product) => product.stockStatus === 'LOW').length,
      outCount: items.filter((product) => product.stockStatus === 'OUT').length,
      attention: matching.filter((product) => product.stockStatus === 'LOW' || product.stockStatus === 'OUT'),
      inStock: matching.filter((product) => product.stockStatus === 'IN_STOCK'),
    };
  }, [data, search]);

  if (checkingAuth || isLoading) {
    return <EstoqueSkeleton />;
  }

  if (isError || !data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: palette.bg, paddingHorizontal: 24 }}>
        <Text variant="body" color="ink" style={{ textAlign: 'center' }}>
          {t('inventory:loadError')}
        </Text>
        <Button label={t('inventory:retryButton')} variant="secondary" onPress={() => refetch()} />
      </View>
    );
  }

  const isSearching = search.trim().length > 0;
  const needsAttention = lowCount + outCount;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon={<BackChevron />} accessibilityLabel={t('common:back')} onPress={() => router.back()} />
        <Text variant="title" color="ink">
          {t('inventory:listTitle')}
        </Text>
        <IconButton
          icon={<Text style={{ color: '#FFFFFF', fontSize: 18, lineHeight: 18 }}>+</Text>}
          variant="primary"
          accessibilityLabel={t('inventory:addButtonLabel')}
          onPress={() => setActionSheetOpen(true)}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: SCROLL_BOTTOM_PADDING, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.primary} />}
      >
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <KpiTile label={t('inventory:totalLabel')} value={t('inventory:totalUnitsCount', { count: total })} tone="neutral" />
          <KpiTile label={t('inventory:lowLabel')} value={t('inventory:lowCount', { count: lowCount })} tone="warning" />
          <KpiTile label={t('inventory:outLabel')} value={t('inventory:outCount', { count: outCount })} tone="danger" />
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('inventory:searchPlaceholder')}
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

        {needsAttention > 0 ? (
          <View
            style={{
              backgroundColor: palette.warningTint,
              borderRadius: 12,
              paddingVertical: 11,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 16 }}>⚠</Text>
            <Text variant="body" weight="medium" style={{ color: palette.warningStrong, fontSize: 13, flex: 1 }}>
              {t('inventory:attentionBanner', { count: needsAttention })}
            </Text>
          </View>
        ) : null}

        {filtered.length === 0 ? (
          <EmptyState title={isSearching ? t('inventory:emptySearchTitle') : t('inventory:emptyTitle')} />
        ) : (
          <>
            {attention.length > 0 ? (
              <View style={{ gap: 8 }}>
                <Text variant="label" color="placeholder">
                  {t('inventory:attentionSectionTitle')}
                </Text>
                <Card>
                  {attention.map((product, index) => (
                    <StockRow
                      key={product.id}
                      id={product.id}
                      name={product.name}
                      brand={product.brand}
                      category={product.category}
                      inStockCount={product.inStockCount}
                      stockStatus={product.stockStatus}
                      minStockAlert={null}
                      isLast={index === attention.length - 1}
                    />
                  ))}
                </Card>
              </View>
            ) : null}

            {inStock.length > 0 ? (
              <View style={{ gap: 8 }}>
                <Text variant="label" color="placeholder">
                  {t('inventory:inStockSectionTitle')}
                </Text>
                <Card>
                  {inStock.map((product, index) => (
                    <StockRow
                      key={product.id}
                      id={product.id}
                      name={product.name}
                      brand={product.brand}
                      category={product.category}
                      inStockCount={product.inStockCount}
                      stockStatus={product.stockStatus}
                      minStockAlert={null}
                      isLast={index === inStock.length - 1}
                    />
                  ))}
                </Card>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <EstoqueActionSheet visible={actionSheetOpen} onClose={() => setActionSheetOpen(false)} />
    </View>
  );
}
