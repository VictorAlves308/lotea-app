import type { ProductListItem } from '@lotea/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { useLots } from '../../../src/features/lots/hooks/useLots';
import { Button, IconButton } from '../../../src/shared/components/Button';
import { Card } from '../../../src/shared/components/Card';
import { Input } from '../../../src/shared/components/Input';
import { MoneyInput } from '../../../src/shared/components/MoneyInput';
import { ProductPickerSheet } from '../../../src/shared/components/ProductPickerSheet';
import { Text } from '../../../src/shared/components/Text';
import { normalizeMoneyInput } from '../../../src/shared/lib/normalize-money-input';
import { consumePendingProductSelection } from '../../../src/shared/lib/pending-selection';
import { palette } from '../../../src/shared/theme/colors';

function BackChevron() {
  return (
    <Text variant="body" weight="bold" color="ink" style={{ fontSize: 18, lineHeight: 18 }}>
      ‹
    </Text>
  );
}

interface ProductLine {
  key: string;
  product: ProductListItem;
  quantity: string;
  cost: string;
}

export default function NovoLoteScreen() {
  const { t } = useTranslation(['lots', 'common']);
  const queryClient = useQueryClient();
  const { createLot, createPurchaseEntry } = useLots();

  const [name, setName] = useState('');
  const [supplier, setSupplier] = useState('');
  const [lines, setLines] = useState<ProductLine[]>([]);
  const [productSheetOpen, setProductSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Picking the same product twice bumps the existing line's quantity
  // instead of adding a second line for it — quantity for a given product is
  // always edited via that one line's "Quantidade" field, never by re-adding
  // it from the picker.
  const addLine = useCallback((product: ProductListItem) => {
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id
            ? { ...line, quantity: String((Number.parseInt(line.quantity, 10) || 0) + 1) }
            : line,
        );
      }
      return [...current, { key: `${product.id}-${current.length}`, product, quantity: '1', cost: '' }];
    });
    setProductSheetOpen(false);
  }, []);

  // Picks up a product just created via the picker's "+ Cadastrar novo
  // produto" shortcut, once this screen regains focus — see
  // shared/lib/pending-selection.ts.
  useFocusEffect(
    useCallback(() => {
      const pendingProduct = consumePendingProductSelection(queryClient);
      if (pendingProduct) {
        addLine(pendingProduct);
      }
    }, [queryClient, addLine]),
  );

  function updateLine(key: string, patch: Partial<ProductLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  async function handleSubmit() {
    setError(null);

    if (!name.trim()) {
      setError(t('lots:nameRequired'));
      return;
    }
    if (lines.length === 0) {
      setError(t('lots:atLeastOneProductError'));
      return;
    }

    const normalizedLines = lines.map((line) => ({
      productId: line.product.id,
      quantity: Number.parseInt(line.quantity, 10),
      acquisitionCost: normalizeMoneyInput(line.cost),
    }));
    const hasIncompleteLine = normalizedLines.some(
      (line) => !Number.isFinite(line.quantity) || line.quantity <= 0 || !line.acquisitionCost,
    );
    if (hasIncompleteLine) {
      setError(t('lots:lineIncompleteError'));
      return;
    }

    try {
      const lot = await createLot.mutateAsync({ name: name.trim(), supplier: supplier.trim() || null });
      for (const line of normalizedLines) {
        await createPurchaseEntry.mutateAsync({
          lotId: lot.id,
          input: { productId: line.productId, quantity: line.quantity, acquisitionCost: line.acquisitionCost! },
        });
      }
      router.back();
    } catch {
      setError(t('lots:createError'));
    }
  }

  const isSaving = createLot.isPending || createPurchaseEntry.isPending;
  const hasIncompleteCost = lines.length === 0 || lines.some((line) => !normalizeMoneyInput(line.cost));

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon={<BackChevron />} accessibilityLabel={t('common:back')} onPress={() => router.back()} />
        <Text variant="title" color="ink">
          {t('lots:novoLoteTitle')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <Input label={t('lots:nameLabel')} placeholder={t('lots:namePlaceholder')} value={name} onChangeText={setName} />
        <Input
          label={`${t('lots:supplierLabel')} ${t('lots:supplierOptional')}`}
          placeholder={t('lots:supplierPlaceholder')}
          value={supplier}
          onChangeText={setSupplier}
        />

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="body" weight="medium" color="muted" style={{ fontSize: 12 }}>
              {t('lots:productsLabel')}
            </Text>
            <Button label={t('lots:addProductButton')} size="sm" variant="secondary" onPress={() => setProductSheetOpen(true)} />
          </View>

          {lines.map((line) => (
            <Card key={line.key}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text variant="body" weight="semibold" color="ink" numberOfLines={1} style={{ flex: 1, paddingRight: 8 }}>
                  {line.product.name}
                </Text>
                <Pressable onPress={() => removeLine(line.key)}>
                  <Text variant="caption" color="danger">
                    {t('lots:removeLineButton')}
                  </Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label={t('lots:quantityLabel')}
                    placeholder="0"
                    keyboardType="number-pad"
                    value={line.quantity}
                    onChangeText={(value) => updateLine(line.key, { quantity: value })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <MoneyInput
                    label={t('lots:costLabel')}
                    value={line.cost}
                    onChangeValue={(value) => updateLine(line.key, { cost: value })}
                  />
                </View>
              </View>
            </Card>
          ))}
        </View>

        {error ? (
          <Text variant="caption" color="danger">
            ⚠ {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={{ padding: 24, paddingBottom: 32, borderTopWidth: 1, borderTopColor: palette.dividerSoft, backgroundColor: palette.surface }}>
        <Button
          label={isSaving ? t('lots:savingButton') : t('lots:saveButton')}
          onPress={handleSubmit}
          disabled={isSaving || hasIncompleteCost}
          fullWidth
        />
      </View>

      <ProductPickerSheet
        visible={productSheetOpen}
        title={t('lots:selectProductPlaceholder')}
        returnTo="novo-lote"
        onSelect={addLine}
        onClose={() => setProductSheetOpen(false)}
      />
    </View>
  );
}
