import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';

import { useRequireAuth } from '../../../src/features/auth/hooks/useRequireAuth';
import { useProductBrands } from '../../../src/features/products/hooks/useProductBrands';
import { useProducts } from '../../../src/features/products/hooks/useProducts';
import { Button, IconButton } from '../../../src/shared/components/Button';
import { Card } from '../../../src/shared/components/Card';
import { EmptyState } from '../../../src/shared/components/EmptyState';
import { ProductThumbnail } from '../../../src/shared/components/ProductThumbnail';
import { Skeleton } from '../../../src/shared/components/Skeleton';
import { StatusBadge } from '../../../src/shared/components/StatusBadge';
import { Text } from '../../../src/shared/components/Text';
import { formatBRL } from '../../../src/shared/lib/currency';
import { productStockStatusToBadge } from '../../../src/shared/lib/product-stock-status';
import { palette } from '../../../src/shared/theme/colors';

const SCROLL_BOTTOM_PADDING = 120;

function BackChevron() {
  return (
    <Text variant="body" weight="bold" color="ink" style={{ fontSize: 18, lineHeight: 18 }}>
      ‹
    </Text>
  );
}

function ProductRow({
  id,
  name,
  brand,
  category,
  imageUrl,
  defaultSalePrice,
  inStockCount,
  stockStatus,
  isLast,
}: {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  defaultSalePrice: string | null;
  inStockCount: number;
  stockStatus: string;
  isLast: boolean;
}) {
  const { t } = useTranslation('products');
  const subtitle = [brand, category].filter(Boolean).join(' · ');

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
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12, gap: 12 }}>
        <ProductThumbnail imageUrl={imageUrl} name={name} />
        <View style={{ flex: 1 }}>
          <Text variant="body" weight="semibold" color="ink" numberOfLines={1}>
            {name}
          </Text>
          {subtitle ? (
            <Text variant="caption" color="muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 }}>
            {defaultSalePrice ? (
              <Text variant="body" weight="bold" color="ink" style={{ fontSize: 13 }}>
                {formatBRL(defaultSalePrice)}
              </Text>
            ) : null}
            <StatusBadge
              status={productStockStatusToBadge(stockStatus)}
              label={stockStatus === 'OUT' ? t('stockOut') : t('unitsCount', { count: inStockCount })}
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function ProdutosSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
      </ScrollView>
    </View>
  );
}

export default function ProdutosScreen() {
  const { t } = useTranslation(['products', 'common']);
  const { checkingAuth } = useRequireAuth();
  const queryClient = useQueryClient();
  const { brand: initialBrand } = useLocalSearchParams<{ brand?: string }>();
  const [search, setSearch] = useState('');
  const [brand, setBrand] = useState<string | null>(initialBrand ?? null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: brandsData } = useProductBrands({ enabled: !checkingAuth });
  const { data, isLoading, isError, refetch } = useProducts(
    { limit: 100, query: search.trim() || undefined, brand: brand ?? undefined },
    { enabled: !checkingAuth },
  );

  async function handleRefresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['products'] });
    setRefreshing(false);
  }

  const brandOptions = useMemo(() => brandsData?.brands ?? [], [brandsData]);

  if (checkingAuth || isLoading) {
    return <ProdutosSkeleton />;
  }

  if (isError || !data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: palette.bg, paddingHorizontal: 24 }}>
        <Text variant="body" color="ink" style={{ textAlign: 'center' }}>
          {t('products:loadError')}
        </Text>
        <Button label={t('products:retryButton')} variant="secondary" onPress={() => refetch()} />
      </View>
    );
  }

  const isFiltering = search.trim().length > 0 || brand !== null;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon={<BackChevron />} accessibilityLabel={t('common:back')} onPress={() => router.back()} />
        <Text variant="title" color="ink">
          {t('products:listTitle')}
        </Text>
        <IconButton
          icon={<Text style={{ color: '#FFFFFF', fontSize: 18, lineHeight: 18 }}>+</Text>}
          variant="primary"
          accessibilityLabel={t('products:newButton')}
          onPress={() => router.push('/produtos/novo')}
        />
      </View>

      <ScrollView
        contentContainerClassName="gap-4 px-6 py-4 md:mx-auto md:w-full md:max-w-2xl"
        contentContainerStyle={{ paddingBottom: SCROLL_BOTTOM_PADDING }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.primary} />}
      >
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('products:searchPlaceholder')}
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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          <Pressable
            onPress={() => setBrand(null)}
            style={{
              paddingVertical: 7,
              paddingHorizontal: 14,
              borderRadius: 999,
              backgroundColor: brand === null ? palette.ink : palette.surface,
              borderWidth: brand === null ? 0 : 1,
              borderColor: palette.divider,
            }}
          >
            <Text variant="body" weight={brand === null ? 'semibold' : 'medium'} style={{ fontSize: 12, color: brand === null ? '#FFFFFF' : palette.muted }}>
              {t('products:allBrandsFilter')}
            </Text>
          </Pressable>
          {brandOptions.map((option) => {
            const selected = option === brand;
            return (
              <Pressable
                key={option}
                onPress={() => setBrand(selected ? null : option)}
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
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text variant="caption" color="muted">
          {t('products:countLabel', { count: data.total })}
        </Text>

        {data.items.length === 0 ? (
          <Card>
            <EmptyState
              title={isFiltering ? t('products:emptySearchTitle') : t('products:emptyTitle')}
              description={isFiltering ? undefined : t('products:emptyDescription')}
              actionLabel={isFiltering ? undefined : t('products:newButton')}
              onAction={isFiltering ? undefined : () => router.push('/produtos/novo')}
            />
          </Card>
        ) : (
          <Card>
            {data.items.map((product, index) => (
              <ProductRow
                key={product.id}
                id={product.id}
                name={product.name}
                brand={product.brand}
                category={product.category}
                imageUrl={product.imageUrl}
                defaultSalePrice={product.defaultSalePrice}
                inStockCount={product.inStockCount}
                stockStatus={product.stockStatus}
                isLast={index === data.items.length - 1}
              />
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
