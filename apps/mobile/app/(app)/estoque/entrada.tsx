import type { Lot, ProductListItem } from '@lotea/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { useLots } from '../../../src/features/lots/hooks/useLots';
import { useLotsList } from '../../../src/features/lots/hooks/useLotsList';
import { Button, IconButton } from '../../../src/shared/components/Button';
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

/** Accepts "DD/MM/AAAA" only — this is a plain input, not a native date picker. Returns null if unparseable or not a real calendar date. */
function parseBrDate(raw: string): Date | null {
  const match = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match.map(Number) as unknown as [string, number, number, number];
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function LotPickerSheet({
  visible,
  lots,
  onSelectExisting,
  onCreateNew,
  onClose,
}: {
  visible: boolean;
  lots: Lot[];
  onSelectExisting: (lot: Lot) => void;
  onCreateNew: (name: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('inventory');
  const [draft, setDraft] = useState('');

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
            paddingBottom: 32,
            paddingHorizontal: 20,
            gap: 12,
            maxHeight: '75%',
          }}
        >
          <Text variant="title" color="ink">
            {t('lotSheetTitle')}
          </Text>
          <Input label="" placeholder={t('newLotNamePlaceholder')} value={draft} onChangeText={setDraft} />
          {draft.trim().length > 0 ? (
            <Button
              variant="secondary"
              label={t('newLotCreateButton', { value: draft.trim() })}
              onPress={() => {
                onCreateNew(draft.trim());
                setDraft('');
              }}
              fullWidth
            />
          ) : null}
          <ScrollView style={{ maxHeight: 260 }}>
            {lots.map((lot) => (
              <Pressable
                key={lot.id}
                onPress={() => onSelectExisting(lot)}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  paddingHorizontal: 8,
                  backgroundColor: pressed ? palette.dividerFaint : 'transparent',
                  borderRadius: 10,
                })}
              >
                <Text variant="body" color="ink">
                  {lot.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function EntradaEstoqueScreen() {
  const { t } = useTranslation(['inventory', 'common']);
  const queryClient = useQueryClient();
  const { createLot, createPurchaseEntry } = useLots();
  const lotsQuery = useLotsList({ limit: 100 });

  const [product, setProduct] = useState<ProductListItem | null>(null);
  const [productSheetOpen, setProductSheetOpen] = useState(false);
  const [quantity, setQuantity] = useState('10');
  const [cost, setCost] = useState('');
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [newLotName, setNewLotName] = useState<string | null>(null);
  const [lotSheetOpen, setLotSheetOpen] = useState(false);
  const [expiry, setExpiry] = useState('');
  const [error, setError] = useState<string | null>(null);

  const lotDisplayValue = selectedLot?.name ?? newLotName ?? '';

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
    const acquisitionCost = normalizeMoneyInput(cost);
    if (!acquisitionCost) {
      setError(t('inventory:costRequired'));
      return;
    }
    let expiresAt: Date | null = null;
    if (expiry.trim()) {
      expiresAt = parseBrDate(expiry);
      if (!expiresAt) {
        setError(t('inventory:expiryInvalid'));
        return;
      }
    }

    try {
      let lotId = selectedLot?.id;
      if (!lotId) {
        const name = newLotName?.trim() || `Entrada · ${new Date().toLocaleDateString('pt-BR')}`;
        const lot = await createLot.mutateAsync({ name });
        lotId = lot.id;
      }

      await createPurchaseEntry.mutateAsync({
        lotId,
        input: { productId: product.id, quantity: quantityNumber, acquisitionCost, expiresAt },
      });
      router.back();
    } catch {
      setError(t('inventory:entradaError'));
    }
  }

  const isSaving = createLot.isPending || createPurchaseEntry.isPending;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon={<BackChevron />} accessibilityLabel={t('common:back')} onPress={() => router.back()} />
        <Text variant="title" color="ink">
          {t('inventory:entradaTitle')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <View
          style={{
            backgroundColor: palette.successTint,
            borderRadius: 14,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: palette.success, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, lineHeight: 16 }}>+</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="body" weight="semibold" style={{ color: palette.successStrong, fontSize: 13 }}>
              {t('inventory:entradaBannerTitle')}
            </Text>
            <Text variant="caption" style={{ color: palette.success }}>
              {t('inventory:entradaBannerDescription')}
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
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Input
              label={t('inventory:quantityLabel')}
              placeholder="0"
              keyboardType="number-pad"
              value={quantity}
              onChangeText={setQuantity}
            />
          </View>
          <View style={{ flex: 1 }}>
            <MoneyInput label={t('inventory:costLabel')} value={cost} onChangeValue={setCost} />
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="body" weight="medium" color="muted" style={{ fontSize: 12 }}>
            {t('inventory:lotLabel')} <Text variant="caption" color="placeholder">{t('inventory:lotOptional')}</Text>
          </Text>
          <Pressable
            onPress={() => setLotSheetOpen(true)}
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
            <Text variant="body" color={lotDisplayValue ? 'ink' : 'placeholder'} numberOfLines={1} style={{ flex: 1 }}>
              {lotDisplayValue || t('inventory:selectLotPlaceholder')}
            </Text>
            <Text variant="body" color="muted">
              ⌄
            </Text>
          </Pressable>
        </View>

        <Input
          label={t('inventory:expiryLabel')}
          placeholder={t('inventory:expiryPlaceholder')}
          keyboardType="number-pad"
          value={expiry}
          onChangeText={setExpiry}
        />

        {error ? (
          <Text variant="caption" color="danger">
            ⚠ {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={{ padding: 24, paddingBottom: 32, borderTopWidth: 1, borderTopColor: palette.dividerSoft, backgroundColor: palette.surface }}>
        <Button
          label={isSaving ? t('inventory:entradaSavingButton') : t('inventory:entradaConfirmButton')}
          onPress={handleSubmit}
          disabled={isSaving}
          fullWidth
        />
      </View>

      <ProductPickerSheet
        visible={productSheetOpen}
        title={t('inventory:selectProductPlaceholder')}
        returnTo="estoque-entrada"
        onSelect={(selected) => {
          setProduct(selected);
          setProductSheetOpen(false);
        }}
        onClose={() => setProductSheetOpen(false)}
      />

      <LotPickerSheet
        visible={lotSheetOpen}
        lots={lotsQuery.data?.items ?? []}
        onSelectExisting={(lot) => {
          setSelectedLot(lot);
          setNewLotName(null);
          setLotSheetOpen(false);
        }}
        onCreateNew={(name) => {
          setNewLotName(name);
          setSelectedLot(null);
          setLotSheetOpen(false);
        }}
        onClose={() => setLotSheetOpen(false)}
      />
    </View>
  );
}
