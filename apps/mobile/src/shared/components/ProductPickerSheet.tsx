import type { ProductListItem } from '@lotea/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { useProducts } from '../../features/products/hooks/useProducts';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { ProductThumbnail } from './ProductThumbnail';
import { StatusBadge } from './StatusBadge';
import { Text } from './Text';
import { formatBRL } from '../lib/currency';
import { palette } from '../theme/colors';

/** Search-and-pick sheet for any flow that needs one product (Entrada/Saída de estoque, Novo Lote) — Nova Venda's cart-aware picker stays local to that screen since it also claims specific inventory units. */
export function ProductPickerSheet({
  visible,
  title,
  returnTo,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  /** Distinct per caller (e.g. 'estoque-entrada', 'novo-lote') — only used to mark the create-product form as reachable from a picker; see produtos/novo.tsx. */
  returnTo: string;
  onSelect: (product: ProductListItem) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('products');
  const [search, setSearch] = useState('');
  const productsQuery = useProducts({ limit: 100, query: search.trim() || undefined }, { enabled: visible });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(18,16,16,0.45)', justifyContent: 'flex-end' }}>
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
          <View style={{ paddingHorizontal: 24, paddingBottom: 12, gap: 8 }}>
            <Text variant="title" color="ink" style={{ marginBottom: 4 }}>
              {title}
            </Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('searchPlaceholder')}
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
            <Button
              label={t('newProductShortcut')}
              variant="secondary"
              size="sm"
              fullWidth
              onPress={() => {
                onClose();
                router.push({ pathname: '/produtos/novo', params: { returnTo } });
              }}
            />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}>
            {productsQuery.isLoading ? (
              <ActivityIndicator color={palette.primary} style={{ marginTop: 16 }} />
            ) : (productsQuery.data?.items.length ?? 0) === 0 ? (
              <EmptyState title={t('emptySearchTitle')} />
            ) : (
              productsQuery.data!.items.map((product, index) => (
                <Pressable
                  key={product.id}
                  onPress={() => onSelect(product)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: palette.dividerSoft,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12, gap: 12 }}>
                    <ProductThumbnail imageUrl={product.imageUrl} name={product.name} size="sm" />
                    <View style={{ flex: 1 }}>
                      <Text variant="body" weight="semibold" color="ink" numberOfLines={1}>
                        {product.name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                        {product.defaultSalePrice ? (
                          <Text variant="caption" weight="bold" color="ink">
                            {formatBRL(product.defaultSalePrice)}
                          </Text>
                        ) : null}
                        <StatusBadge
                          status={product.stockStatus === 'OUT' ? 'outOfStock' : product.stockStatus === 'LOW' ? 'lowStock' : 'inStock'}
                          label={t('unitsCount', { count: product.inStockCount })}
                        />
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
