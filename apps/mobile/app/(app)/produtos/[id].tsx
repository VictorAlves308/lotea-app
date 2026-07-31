import type { Product } from '@lotea/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useProduct } from '../../../src/features/products/hooks/useProduct';
import { useProductBrands } from '../../../src/features/products/hooks/useProductBrands';
import { useUpdateProduct } from '../../../src/features/products/hooks/useUpdateProduct';
import { BrandPickerRow, BrandPickerSheet } from '../../../src/shared/components/BrandPickerSheet';
import { Button, IconButton } from '../../../src/shared/components/Button';
import { Input } from '../../../src/shared/components/Input';
import { Skeleton } from '../../../src/shared/components/Skeleton';
import { Text } from '../../../src/shared/components/Text';
import { palette } from '../../../src/shared/theme/colors';

function BackChevron() {
  return (
    <Text variant="body" weight="bold" color="ink" style={{ fontSize: 18, lineHeight: 18 }}>
      ‹
    </Text>
  );
}

interface EditProductFormValues {
  name: string;
  brand: string;
  category: string;
  minStockAlert: string;
}

function EditProdutoForm({ product, brands }: { product: Product; brands: string[] }) {
  const { t } = useTranslation(['products', 'common']);
  const updateProduct = useUpdateProduct();
  const [brandSheetOpen, setBrandSheetOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<EditProductFormValues>({
    defaultValues: {
      name: product.name,
      brand: product.brand ?? '',
      category: product.category ?? '',
      minStockAlert: product.minStockAlert !== null ? String(product.minStockAlert) : '',
    },
  });

  const brandValue = useWatch({ control, name: 'brand' });

  const onSubmit = handleSubmit(async (values) => {
    // Blank is valid here — it just means "no alert threshold set", never
    // asked at creation (see produtos/novo.tsx); only reject a non-empty
    // value that isn't actually a usable number.
    const trimmedMinStock = values.minStockAlert.trim();
    let minStockAlert: number | undefined;
    if (trimmedMinStock) {
      minStockAlert = Number.parseInt(trimmedMinStock, 10);
      if (!Number.isFinite(minStockAlert) || minStockAlert < 0) {
        setError('minStockAlert', { message: t('products:minStockRequired') });
        return;
      }
    }

    setSubmitError(null);
    try {
      await updateProduct.mutateAsync({
        id: product.id,
        input: {
          name: values.name.trim(),
          brand: values.brand.trim() || null,
          category: values.category.trim() || null,
          minStockAlert,
        },
      });
      router.back();
    } catch {
      setSubmitError(t('products:editError'));
    }
  });

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon={<BackChevron />} accessibilityLabel={t('common:back')} onPress={() => router.back()} />
        <Text variant="title" color="ink">
          {t('products:editTitle')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Input
              label={t('products:nameLabel')}
              placeholder={t('products:namePlaceholder')}
              value={field.value}
              onChangeText={field.onChange}
              errorMessage={errors.name?.message}
            />
          )}
        />

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

        <Controller
          control={control}
          name="minStockAlert"
          render={({ field }) => (
            <Input
              label={`${t('products:minStockLabel')} ${t('products:minStockOptional')}`}
              placeholder={t('products:minStockPlaceholder')}
              keyboardType="number-pad"
              value={field.value}
              onChangeText={field.onChange}
              errorMessage={errors.minStockAlert?.message}
            />
          )}
        />

        {submitError ? (
          <Text variant="caption" color="danger">
            ⚠ {submitError}
          </Text>
        ) : null}
      </ScrollView>

      <View style={{ padding: 24, paddingBottom: 32, borderTopWidth: 1, borderTopColor: palette.dividerSoft, backgroundColor: palette.surface }}>
        <Button
          label={updateProduct.isPending ? t('products:editSavingButton') : t('products:editSaveButton')}
          onPress={onSubmit}
          disabled={updateProduct.isPending}
          fullWidth
        />
      </View>

      <BrandPickerSheet
        visible={brandSheetOpen}
        brands={brands}
        title={t('products:brandSheetTitle')}
        onSelect={(value) => {
          setValue('brand', value);
          setBrandSheetOpen(false);
        }}
        onClose={() => setBrandSheetOpen(false)}
      />
    </View>
  );
}

function EditProdutoSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, padding: 24, gap: 16 }}>
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </View>
  );
}

export default function EditarProdutoScreen() {
  const { t } = useTranslation(['products', 'common']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: product, isLoading, isError } = useProduct(id);
  const { data: brandsData } = useProductBrands();

  if (isLoading) {
    return <EditProdutoSkeleton />;
  }

  if (isError || !product) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: palette.bg, paddingHorizontal: 24 }}>
        <Text variant="body" color="ink" style={{ textAlign: 'center' }}>
          {t('products:loadProductError')}
        </Text>
        <Button label={t('common:back')} variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  return <EditProdutoForm product={product} brands={brandsData?.brands ?? []} />;
}
