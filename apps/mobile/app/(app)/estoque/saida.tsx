import type { ProductListItem, StockWriteOffReason } from '@lotea/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { useCreateWriteOff } from '../../../src/features/inventory/hooks/useCreateWriteOff';
import { Button, IconButton } from '../../../src/shared/components/Button';
import { Input } from '../../../src/shared/components/Input';
import { ProductPickerSheet } from '../../../src/shared/components/ProductPickerSheet';
import { Text } from '../../../src/shared/components/Text';
import { ApiError } from '../../../src/shared/lib/api-client';
import { consumePendingProductSelection } from '../../../src/shared/lib/pending-selection';
import { palette } from '../../../src/shared/theme/colors';

const REASONS: StockWriteOffReason[] = ['DEVOLUCAO', 'PERDA', 'AJUSTE'];

function BackChevron() {
  return (
    <Text variant="body" weight="bold" color="ink" style={{ fontSize: 18, lineHeight: 18 }}>
      ‹
    </Text>
  );
}

export default function SaidaEstoqueScreen() {
  const { t } = useTranslation(['inventory', 'common']);
  const queryClient = useQueryClient();
  const createWriteOff = useCreateWriteOff();

  const [product, setProduct] = useState<ProductListItem | null>(null);
  const [productSheetOpen, setProductSheetOpen] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState<StockWriteOffReason | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Picks up a product just created via the picker's "+ Cadastrar novo
  // produto" shortcut, once this screen regains focus — see
  // shared/lib/pending-selection.ts.
  useFocusEffect(
    useCallback(() => {
      const pendingProduct = consumePendingProductSelection(queryClient);
      if (pendingProduct) {
        setProduct(pendingProduct);
      }
    }, [queryClient]),
  );

  async function handleSubmit() {
    setError(null);

    if (!product) {
      setError(t('inventory:productRequired'));
      return;
    }
    const quantityNumber = Number.parseInt(quantity, 10);
    if (!Number.isFinite(quantityNumber) || quantityNumber <= 0) {
      setError(t('inventory:quantityRequired'));
      return;
    }
    if (!reason) {
      setError(t('inventory:reasonRequired'));
      return;
    }

    try {
      await createWriteOff.mutateAsync({
        productId: product.id,
        quantity: quantityNumber,
        reason,
        notes: notes.trim() || null,
      });
      router.back();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INSUFFICIENT_STOCK') {
        setError(t('inventory:insufficientStock'));
      } else {
        setError(t('inventory:saidaError'));
      }
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon={<BackChevron />} accessibilityLabel={t('common:back')} onPress={() => router.back()} />
        <Text variant="title" color="ink">
          {t('inventory:saidaTitle')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <View
          style={{
            backgroundColor: palette.warningTint,
            borderRadius: 14,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: palette.warning, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, lineHeight: 16 }}>−</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="body" weight="semibold" style={{ color: palette.warningStrong, fontSize: 13 }}>
              {t('inventory:saidaBannerTitle')}
            </Text>
            <Text variant="caption" style={{ color: palette.warning }}>
              {t('inventory:saidaBannerDescription')}
            </Text>
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="body" weight="medium" color="muted" style={{ fontSize: 12 }}>
            {t('inventory:productLabel')}
          </Text>
          <Pressable
            onPress={() => setProductSheetOpen(true)}
            style={{
              backgroundColor: palette.surface,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: palette.divider,
              paddingHorizontal: 16,
              paddingVertical: 13,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text variant="body" color={product ? 'ink' : 'placeholder'} numberOfLines={1} style={{ flex: 1 }}>
              {product?.name ?? t('inventory:selectProductPlaceholder')}
            </Text>
            <Text variant="body" color="muted">
              ⌄
            </Text>
          </Pressable>
          {product ? (
            <Text variant="caption" color="muted">
              {t('inventory:totalUnitsCount', { count: product.inStockCount })}
            </Text>
          ) : null}
        </View>

        <Input
          label={t('inventory:quantityLabel')}
          placeholder="0"
          keyboardType="number-pad"
          value={quantity}
          onChangeText={setQuantity}
        />

        <View style={{ gap: 8 }}>
          <Text variant="body" weight="medium" color="muted" style={{ fontSize: 12 }}>
            {t('inventory:reasonLabel')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {REASONS.map((value) => {
              const selected = reason === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setReason(value)}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: selected ? palette.ink : palette.surface,
                    borderWidth: selected ? 0 : 1.5,
                    borderColor: palette.divider,
                    borderRadius: 11,
                    paddingVertical: 11,
                    alignItems: 'center',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text variant="body" weight="semibold" style={{ fontSize: 13, color: selected ? '#FFFFFF' : palette.muted }}>
                    {t(`inventory:reason${value}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Input
          label={`${t('inventory:notesLabel')} ${t('inventory:notesOptional')}`}
          placeholder={t('inventory:notesPlaceholder')}
          value={notes}
          onChangeText={setNotes}
        />

        {error ? (
          <Text variant="caption" color="danger">
            ⚠ {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={{ padding: 24, paddingBottom: 32, borderTopWidth: 1, borderTopColor: palette.dividerSoft, backgroundColor: palette.surface }}>
        <Button
          label={createWriteOff.isPending ? t('inventory:saidaSavingButton') : t('inventory:saidaConfirmButton')}
          onPress={handleSubmit}
          disabled={createWriteOff.isPending}
          variant="primary"
          fullWidth
        />
      </View>

      <ProductPickerSheet
        visible={productSheetOpen}
        title={t('inventory:selectProductPlaceholder')}
        returnTo="estoque-saida"
        onSelect={(selected) => {
          setProduct(selected);
          setProductSheetOpen(false);
        }}
        onClose={() => setProductSheetOpen(false)}
      />
    </View>
  );
}
