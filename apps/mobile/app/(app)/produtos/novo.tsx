import type { CatalogProductSuggestion } from '@lotea/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { z } from 'zod';

import { useCatalogSearch } from '../../../src/features/catalog/hooks/useCatalogSearch';
import { useLots } from '../../../src/features/lots/hooks/useLots';
import { useProductBrands } from '../../../src/features/products/hooks/useProductBrands';
import { useCreateProduct } from '../../../src/features/products/hooks/useCreateProduct';
import { BrandPickerRow, BrandPickerSheet } from '../../../src/shared/components/BrandPickerSheet';
import { Button, IconButton } from '../../../src/shared/components/Button';
import { ConfirmDialog } from '../../../src/shared/components/ConfirmDialog';
import { Input } from '../../../src/shared/components/Input';
import { MoneyInput } from '../../../src/shared/components/MoneyInput';
import { ProductThumbnail } from '../../../src/shared/components/ProductThumbnail';
import { Text } from '../../../src/shared/components/Text';
import { normalizeMoneyInput } from '../../../src/shared/lib/normalize-money-input';
import { setPendingProductSelection } from '../../../src/shared/lib/pending-selection';
import { zodResolver } from '../../../src/shared/lib/zod-resolver';
import { palette } from '../../../src/shared/theme/colors';

function BackChevron() {
  return (
    <Text variant="body" weight="bold" color="ink" style={{ fontSize: 18, lineHeight: 18 }}>
      ‹
    </Text>
  );
}

const productFormSchema = z.object({
  name: z.string().min(1),
  brand: z.string(),
  category: z.string(),
  /** Required only when creating a standalone product (see NovoProdutoScreen's submit) — omitted entirely from the form when opened via a picker's "+ Cadastrar novo produto", since that caller already asks for its own acquisition cost. */
  costPrice: z.string(),
  initialStock: z.string(),
});
type ProductFormValues = z.infer<typeof productFormSchema>;

export default function NovoProdutoScreen() {
  const { t } = useTranslation(['products', 'common']);
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const queryClient = useQueryClient();
  const createProduct = useCreateProduct();
  const { createLot, createPurchaseEntry } = useLots();
  const { data: brandsData } = useProductBrands();
  const [brandSheetOpen, setBrandSheetOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [suggestionsHidden, setSuggestionsHidden] = useState(false);

  // Opened from a picker (Entrada/Novo Lote/Saída/Nova Venda) mid-flow — that
  // caller already asks for its own acquisition cost right after this form
  // closes, so asking again here would just be the same number twice. Only a
  // product created standalone from the Produtos tab needs its own initial
  // stock + cost, to seed a starting "Estoque inicial" lot.
  const asksForInitialStock = !returnTo;

  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    setError,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver<ProductFormValues>(productFormSchema),
    defaultValues: { name: '', brand: '', category: '', costPrice: '', initialStock: '0' },
  });

  const brandValue = useWatch({ control, name: 'brand' });
  const nameValue = useWatch({ control, name: 'name' });
  const catalogQuery = useCatalogSearch(suggestionsHidden ? '' : nameValue);
  const suggestions = catalogQuery.data?.items ?? [];
  const trimmedName = nameValue.trim();
  // Always available, regardless of how many catalog matches came back — a
  // search returning a bunch of loosely-related results (for a product that
  // genuinely isn't in the catalog yet) must never block "não é nenhum
  // desses, é produto novo mesmo" from being one tap away.
  const showCreateOption = !suggestionsHidden && trimmedName.length >= 2;

  function applySuggestion(suggestion: CatalogProductSuggestion) {
    setValue('name', suggestion.name);
    setValue('brand', suggestion.brand);
    setValue('category', suggestion.category ?? '');
    setSuggestionsHidden(true);
  }

  const submit = async (confirmDuplicate: boolean) => {
    const values = getValues();

    let costPrice: string | null = null;
    let initialStock = 0;
    if (asksForInitialStock) {
      costPrice = normalizeMoneyInput(values.costPrice);
      if (!costPrice) {
        setError('costPrice', { message: t('products:costPriceRequired') });
        return;
      }
      initialStock = Number.parseInt(values.initialStock, 10) || 0;
    }

    setSubmitError(null);
    try {
      const result = await createProduct.mutateAsync({
        name: values.name.trim(),
        brand: values.brand.trim() || null,
        category: values.category.trim() || null,
        confirmDuplicate,
      });

      if (result.status === 'duplicates') {
        setDuplicateOpen(true);
        return;
      }

      if (initialStock > 0 && costPrice) {
        const lot = await createLot.mutateAsync({ name: `Estoque inicial · ${result.product.name}` });
        await createPurchaseEntry.mutateAsync({
          lotId: lot.id,
          input: { productId: result.product.id, quantity: initialStock, acquisitionCost: costPrice },
        });
      }

      // Any picker that opened this form (Nova Venda, Entrada de Estoque,
      // Saída de Estoque, Novo Lote) sets its own `returnTo` value just to
      // prove it came from a picker flow — the pending-selection slot itself
      // is a single shared channel, so the value doesn't need to match
      // anything on read.
      if (returnTo) {
        // The picker's onSelect always hands back a ProductListItem (identity
        // + derived stock status), not the raw Product this form just
        // created — reconstruct that shape here using the same rule the API
        // applies (see products.service.ts's deriveStockStatus): with no
        // minStockAlert set (never asked at creation — see schema.prisma's
        // comment), a product only ever reads OUT or IN_STOCK, never LOW.
        setPendingProductSelection(queryClient, {
          id: result.product.id,
          name: result.product.name,
          brand: result.product.brand,
          category: result.product.category,
          volume: result.product.volume,
          defaultSalePrice: result.product.defaultSalePrice,
          imageUrl: result.product.imageUrl,
          inStockCount: initialStock,
          stockStatus: initialStock <= 0 ? 'OUT' : 'IN_STOCK',
        });
      }

      router.back();
    } catch {
      setSubmitError(t('products:createError'));
    }
  };

  const onSubmit = handleSubmit(() => submit(false));
  const isSaving = createProduct.isPending || createLot.isPending || createPurchaseEntry.isPending;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon={<BackChevron />} accessibilityLabel={t('common:back')} onPress={() => router.back()} />
        <Text variant="title" color="ink">
          {t('products:createTitle')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 8 }}>
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <Input
                label={t('products:nameLabel')}
                placeholder={t('products:namePlaceholder')}
                value={field.value}
                onChangeText={(text) => {
                  field.onChange(text);
                  setSuggestionsHidden(false);
                }}
                errorMessage={errors.name?.message}
              />
            )}
          />

          {!suggestionsHidden && (suggestions.length > 0 || showCreateOption) ? (
            <View style={{ backgroundColor: palette.surface, borderRadius: 12, borderWidth: 1.5, borderColor: palette.divider, overflow: 'hidden' }}>
              {suggestions.map((suggestion, index) => (
                <Pressable
                  key={suggestion.id}
                  onPress={() => applySuggestion(suggestion)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: palette.dividerSoft,
                    backgroundColor: pressed ? palette.dividerFaint : 'transparent',
                  })}
                >
                  <ProductThumbnail imageUrl={suggestion.imageUrl} name={suggestion.name} size="sm" />
                  <View style={{ flex: 1 }}>
                    <Text variant="body" weight="medium" color="ink" numberOfLines={1}>
                      {suggestion.name}
                    </Text>
                    <Text variant="caption" color="muted" numberOfLines={1}>
                      {[suggestion.brand, suggestion.category].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </Pressable>
              ))}
              {showCreateOption ? (
                <Pressable
                  onPress={() => setSuggestionsHidden(true)}
                  style={({ pressed }) => ({
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderTopWidth: suggestions.length === 0 ? 0 : 1,
                    borderTopColor: palette.dividerSoft,
                    backgroundColor: pressed ? palette.dividerFaint : 'transparent',
                  })}
                >
                  <Text variant="body" weight="medium" color="primary" numberOfLines={1}>
                    {trimmedName}
                  </Text>
                  <Text variant="caption" color="muted" numberOfLines={1}>
                    {t('products:nameNewOptionCaption')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        <BrandPickerRow
          label={t('products:brandLabel')}
          value={brandValue}
          placeholder={t('products:brandPlaceholder')}
          onPress={() => setBrandSheetOpen(true)}
        />

        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <Input
              label={t('products:categoryLabel')}
              placeholder={t('products:categoryPlaceholder')}
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />

        {asksForInitialStock ? (
          <>
            <Controller
              control={control}
              name="costPrice"
              render={({ field }) => (
                <MoneyInput
                  label={t('products:costPriceLabel')}
                  value={field.value}
                  onChangeValue={field.onChange}
                  errorMessage={errors.costPrice?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="initialStock"
              render={({ field }) => (
                <Input
                  label={t('products:initialStockLabel')}
                  placeholder={t('products:initialStockPlaceholder')}
                  keyboardType="number-pad"
                  value={field.value}
                  onChangeText={field.onChange}
                  errorMessage={errors.initialStock?.message}
                />
              )}
            />
          </>
        ) : null}

        {submitError ? (
          <Text variant="caption" color="danger">
            ⚠ {submitError}
          </Text>
        ) : null}
      </ScrollView>

      <View style={{ padding: 24, paddingBottom: 32, borderTopWidth: 1, borderTopColor: palette.dividerSoft, backgroundColor: palette.surface }}>
        <Button
          label={isSaving ? t('products:savingButton') : t('products:saveButton')}
          onPress={onSubmit}
          disabled={isSaving}
          fullWidth
        />
      </View>

      <BrandPickerSheet
        visible={brandSheetOpen}
        brands={brandsData?.brands ?? []}
        title={t('products:brandSheetTitle')}
        onSelect={(value) => {
          setValue('brand', value);
          setBrandSheetOpen(false);
        }}
        onClose={() => setBrandSheetOpen(false)}
      />

      <ConfirmDialog
        visible={duplicateOpen}
        title={t('products:duplicateTitle')}
        description={t('products:duplicateDescription')}
        confirmLabel={t('products:duplicateConfirm')}
        cancelLabel={t('products:duplicateCancel')}
        onCancel={() => setDuplicateOpen(false)}
        onConfirm={() => {
          setDuplicateOpen(false);
          void submit(true);
        }}
      />
    </View>
  );
}
