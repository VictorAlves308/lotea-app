import type { AvailableInventoryItem, PaymentMethod } from '@lotea/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { useRequireAuth } from '../../../src/features/auth/hooks/useRequireAuth';
import { useCustomers } from '../../../src/features/customers/hooks/useCustomers';
import { getAvailableInventory } from '../../../src/features/products/api';
import { useProducts } from '../../../src/features/products/hooks/useProducts';
import { useCreateSale } from '../../../src/features/sales/hooks/useCreateSale';
import { Button, IconButton } from '../../../src/shared/components/Button';
import { Card } from '../../../src/shared/components/Card';
import { EmptyState } from '../../../src/shared/components/EmptyState';
import { MoneyInput } from '../../../src/shared/components/MoneyInput';
import { ProductThumbnail } from '../../../src/shared/components/ProductThumbnail';
import { StatusBadge } from '../../../src/shared/components/StatusBadge';
import { Text } from '../../../src/shared/components/Text';
import { formatBRL } from '../../../src/shared/lib/currency';
import { normalizeMoneyInput } from '../../../src/shared/lib/normalize-money-input';
import { consumePendingCustomerSelection, consumePendingProductSelection } from '../../../src/shared/lib/pending-selection';
import { palette } from '../../../src/shared/theme/colors';

interface CartLine {
  productId: string;
  name: string;
  unitPrice: string;
  availableItems: AvailableInventoryItem[];
  quantity: number;
}

type PaymentChoice = PaymentMethod | 'FIADO';

function BackChevron() {
  return (
    <Text variant="body" weight="bold" color="ink" style={{ fontSize: 18, lineHeight: 18 }}>
      ‹
    </Text>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0]![0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function SheetModal({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
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
          <View style={{ paddingHorizontal: 24, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="title" color="ink">
              {title}
            </Text>
            <IconButton
              icon={<Text style={{ color: palette.ink, fontSize: 16, lineHeight: 16 }}>✕</Text>}
              accessibilityLabel="Fechar"
              onPress={onClose}
            />
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Stepper({ quantity, max, onChange }: { quantity: number; max: number; onChange: (next: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Diminuir quantidade"
        onPress={() => onChange(quantity - 1)}
        style={({ pressed }) => ({
          width: 28,
          height: 28,
          borderRadius: 8,
          backgroundColor: palette.dividerFaint,
          borderWidth: 1,
          borderColor: palette.divider,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text variant="body" weight="bold" color="ink" style={{ fontSize: 15, lineHeight: 15 }}>
          −
        </Text>
      </Pressable>
      <Text variant="body" weight="bold" color="ink" style={{ minWidth: 18, textAlign: 'center' }}>
        {quantity}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Aumentar quantidade"
        disabled={quantity >= max}
        onPress={() => onChange(Math.min(quantity + 1, max))}
        style={({ pressed }) => ({
          width: 28,
          height: 28,
          borderRadius: 8,
          backgroundColor: palette.dividerFaint,
          borderWidth: 1,
          borderColor: palette.divider,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: quantity >= max ? 0.4 : pressed ? 0.7 : 1,
        })}
      >
        <Text variant="body" weight="bold" color="ink" style={{ fontSize: 13, lineHeight: 13 }}>
          +
        </Text>
      </Pressable>
    </View>
  );
}

export default function NovaVendaScreen() {
  const { t } = useTranslation(['sales', 'common']);
  const { checkingAuth } = useRequireAuth();

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState<PaymentChoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [customerSheetOpen, setCustomerSheetOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSheetOpen, setProductSheetOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [productSheetError, setProductSheetError] = useState<string | null>(null);
  // A product never carries a stored sale price (see products.schema.ts) —
  // the reseller always decides it here, per unit, at the moment of adding
  // it to the cart. This holds the product awaiting that price entry.
  const [pendingPriceProduct, setPendingPriceProduct] = useState<{
    id: string;
    name: string;
    defaultSalePrice: string | null;
  } | null>(null);
  const [priceInput, setPriceInput] = useState('');

  const customersQuery = useCustomers({ sort: 'name', limit: 100 }, { enabled: !checkingAuth && customerSheetOpen });
  const productsQuery = useProducts(
    { limit: 100, query: productSearch.trim() || undefined },
    { enabled: !checkingAuth && productSheetOpen },
  );
  const createSale = useCreateSale();
  const queryClient = useQueryClient();

  const filteredCustomers = useMemo(() => {
    const items = customersQuery.data?.items ?? [];
    const query = customerSearch.trim().toLowerCase();
    return query ? items.filter((customer) => customer.name.toLowerCase().includes(query)) : items;
  }, [customersQuery.data, customerSearch]);

  const total = useMemo(
    () => cart.reduce((sum, line) => sum + Number(line.unitPrice) * line.quantity, 0),
    [cart],
  );
  const itemCount = useMemo(() => cart.reduce((sum, line) => sum + line.quantity, 0), [cart]);

  // Tapping a product already in the cart just bumps its quantity (same
  // price it was already added at). Tapping a new one opens the price-entry
  // step below instead of adding it straight away — see pendingPriceProduct.
  const handleProductTap = useCallback(
    (product: { id: string; name: string; defaultSalePrice: string | null }) => {
      const existing = cart.find((line) => line.productId === product.id);
      if (existing) {
        if (existing.quantity >= existing.availableItems.length) {
          setProductSheetError(t('sales:noStockAvailable'));
          return;
        }
        setCart((current) =>
          current.map((line) => (line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line)),
        );
        setProductSheetOpen(false);
        setProductSheetError(null);
        return;
      }

      setProductSheetError(null);
      setPendingPriceProduct(product);
      // Always blank, even if this product still carries an old legacy
      // defaultSalePrice — the price is a deliberate decision made fresh at
      // sale time, never a stale value to rubber-stamp.
      setPriceInput('');
      // Also needed for the auto-add-after-"+ Cadastrar novo produto" path,
      // where this fires while the sheet is still closed (see the
      // useFocusEffect below) — opening it is what makes the price step
      // actually visible.
      setProductSheetOpen(true);
    },
    [cart, t],
  );

  const confirmAddProduct = useCallback(async () => {
    if (!pendingPriceProduct) return;
    const unitPrice = normalizeMoneyInput(priceInput);
    if (!unitPrice) {
      setProductSheetError(t('sales:noPriceSet'));
      return;
    }

    const product = pendingPriceProduct;
    setAddingProductId(product.id);
    setProductSheetError(null);
    try {
      const { items } = await getAvailableInventory(product.id, 100);
      if (items.length === 0) {
        setProductSheetError(t('sales:noStockAvailable'));
        return;
      }
      setCart((current) => [...current, { productId: product.id, name: product.name, unitPrice, availableItems: items, quantity: 1 }]);
      setPendingPriceProduct(null);
      setPriceInput('');
      setProductSheetOpen(false);
    } finally {
      setAddingProductId(null);
    }
  }, [pendingPriceProduct, priceInput, t]);

  function updateQuantity(productId: string, next: number) {
    setCart((current) => {
      if (next <= 0) return current.filter((line) => line.productId !== productId);
      return current.map((line) => (line.productId === productId ? { ...line, quantity: next } : line));
    });
  }

  // Picks up a customer/product just created via the "+ Cadastrar novo..."
  // shortcuts below, once this screen regains focus after that form pops
  // back — see shared/lib/pending-selection.ts.
  useFocusEffect(
    useCallback(() => {
      const pendingCustomer = consumePendingCustomerSelection(queryClient);
      if (pendingCustomer) {
        setCustomerId(pendingCustomer.id);
        setCustomerName(pendingCustomer.name);
      }

      const pendingProduct = consumePendingProductSelection(queryClient);
      if (pendingProduct) {
        handleProductTap(pendingProduct);
      }
    }, [queryClient, handleProductTap]),
  );

  async function handleSubmit() {
    setError(null);

    if (cart.length === 0) {
      setError(t('sales:emptyCartError'));
      return;
    }
    if (!payment) {
      setError(t('sales:paymentMethodRequired'));
      return;
    }
    if (payment === 'FIADO' && !customerId) {
      setError(t('sales:fiadoRequiresCustomer'));
      return;
    }

    const items = cart.flatMap((line) =>
      line.availableItems.slice(0, line.quantity).map((item) => ({ inventoryItemId: item.id, salePrice: line.unitPrice })),
    );
    const receivedAmount = payment === 'FIADO' ? '0.00' : total.toFixed(2);
    const paymentMethod: PaymentMethod | null = payment === 'FIADO' ? null : payment;

    try {
      await createSale.mutateAsync({ items, receivedAmount, customerId, paymentMethod });
      router.back();
    } catch {
      setError(t('sales:createError'));
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: palette.surface,
          borderBottomWidth: 1,
          borderBottomColor: palette.dividerSoft,
        }}
      >
        <IconButton icon={<BackChevron />} accessibilityLabel={t('common:back')} onPress={() => router.back()} />
        <Text variant="title" color="ink">
          {t('sales:createTitle')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 180, gap: 20 }}>
        <View style={{ gap: 8 }}>
          <Text variant="label" color="placeholder">
            {t('sales:customerLabel')}
          </Text>
          <Pressable
            onPress={() => setCustomerSheetOpen(true)}
            style={({ pressed }) => ({
              backgroundColor: palette.surface,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: palette.divider,
              paddingVertical: 14,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {customerName ? (
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: palette.primaryTint,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text variant="body" weight="bold" color="primary" style={{ fontSize: 12 }}>
                    {initialsOf(customerName)}
                  </Text>
                </View>
              ) : null}
              <Text variant="body" weight="medium" color={customerName ? 'ink' : 'placeholder'}>
                {customerName ?? t('sales:selectCustomerPlaceholder')}
              </Text>
            </View>
            <Text variant="body" color="placeholder" style={{ fontSize: 12 }}>
              ▾
            </Text>
          </Pressable>
        </View>

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="label" color="placeholder">
              {t('sales:productsLabel')}
            </Text>
            <Button label={t('sales:addProductButton')} size="sm" onPress={() => setProductSheetOpen(true)} />
          </View>

          {cart.length === 0 ? (
            <Card>
              <Text variant="body" color="muted" style={{ textAlign: 'center', paddingVertical: 8 }}>
                {t('sales:emptyCartError')}
              </Text>
            </Card>
          ) : (
            <Card>
              {cart.map((line, index) => (
                <View
                  key={line.productId}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    borderBottomWidth: index === cart.length - 1 ? 0 : 1,
                    borderBottomColor: palette.dividerSoft,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text variant="body" weight="semibold" color="ink" numberOfLines={1}>
                      {line.name}
                    </Text>
                    <Text variant="caption" color="muted">
                      {t('sales:unitPriceSuffix', { price: formatBRL(line.unitPrice) })}
                    </Text>
                  </View>
                  <Stepper
                    quantity={line.quantity}
                    max={line.availableItems.length}
                    onChange={(next) => updateQuantity(line.productId, next)}
                  />
                  <Text variant="body" weight="bold" color="ink" style={{ minWidth: 64, textAlign: 'right' }}>
                    {formatBRL((Number(line.unitPrice) * line.quantity).toFixed(2))}
                  </Text>
                </View>
              ))}
            </Card>
          )}
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="label" color="placeholder">
            {t('sales:paymentMethodLabel')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['PIX', 'CARD', 'CASH', 'FIADO'] as PaymentChoice[]).map((choice) => {
              const selected = payment === choice;
              const label = { PIX: t('sales:paymentPix'), CARD: t('sales:paymentCard'), CASH: t('sales:paymentCash'), FIADO: t('sales:paymentFiado') }[choice];
              return (
                <Pressable
                  key={choice}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setPayment(choice)}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: selected ? palette.ink : palette.surface,
                    borderWidth: selected ? 0 : 1.5,
                    borderColor: palette.divider,
                    borderRadius: 12,
                    paddingVertical: 12,
                    alignItems: 'center',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text variant="body" weight="semibold" style={{ fontSize: 12, color: selected ? '#FFFFFF' : palette.muted }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? (
          <Text variant="caption" color="danger">
            ⚠ {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.dividerSoft, padding: 24, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text variant="body" weight="medium" color="muted">
            {t('sales:totalLabel', { count: itemCount })}
          </Text>
          <Text variant="heading1" color="ink">
            {formatBRL(total.toFixed(2))}
          </Text>
        </View>
        <Button
          label={createSale.isPending ? t('sales:savingButton') : t('sales:confirmButton')}
          onPress={handleSubmit}
          disabled={createSale.isPending}
          fullWidth
        />
      </View>

      <SheetModal visible={customerSheetOpen} onClose={() => setCustomerSheetOpen(false)} title={t('sales:customerSheetTitle')}>
        <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
          <TextInput
            value={customerSearch}
            onChangeText={setCustomerSearch}
            placeholder={t('sales:customerSearchPlaceholder')}
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
        </View>
        <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
          <Button
            label={t('sales:newCustomerButton')}
            variant="secondary"
            size="sm"
            fullWidth
            onPress={() => {
              setCustomerSheetOpen(false);
              router.push({ pathname: '/clientes/novo', params: { returnTo: 'nova-venda' } });
            }}
          />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32, gap: 4 }}>
          <Pressable
            onPress={() => {
              setCustomerId(null);
              setCustomerName(null);
              setCustomerSheetOpen(false);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 12,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: palette.dividerSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 15 }}>👤</Text>
            </View>
            <Text variant="body" weight="medium" color="ink">
              {t('sales:walkInOption')}
            </Text>
          </Pressable>

          {customersQuery.isLoading ? (
            <ActivityIndicator color={palette.primary} style={{ marginTop: 16 }} />
          ) : filteredCustomers.length === 0 ? (
            <Text variant="body" color="muted" style={{ textAlign: 'center', paddingVertical: 16 }}>
              {t('sales:customerSearchEmpty')}
            </Text>
          ) : (
            filteredCustomers.map((customer) => (
              <Pressable
                key={customer.id}
                onPress={() => {
                  setCustomerId(customer.id);
                  setCustomerName(customer.name);
                  setCustomerSheetOpen(false);
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 12,
                  borderTopWidth: 1,
                  borderTopColor: palette.dividerSoft,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: palette.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Text variant="body" weight="bold" color="primary" style={{ fontSize: 12 }}>
                    {initialsOf(customer.name)}
                  </Text>
                </View>
                <Text variant="body" weight="medium" color="ink">
                  {customer.name}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </SheetModal>

      <SheetModal
        visible={productSheetOpen}
        onClose={() => {
          setProductSheetOpen(false);
          setProductSheetError(null);
          setPendingPriceProduct(null);
        }}
        title={pendingPriceProduct ? pendingPriceProduct.name : t('sales:productSheetTitle')}
      >
        {pendingPriceProduct ? (
          <View style={{ paddingHorizontal: 24, paddingBottom: 24, gap: 16 }}>
            <MoneyInput label={t('sales:unitPriceLabel')} value={priceInput} onChangeValue={setPriceInput} />
            {productSheetError ? (
              <Text variant="caption" color="danger">
                ⚠ {productSheetError}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label={t('common:back')}
                  variant="secondary"
                  fullWidth
                  onPress={() => {
                    setPendingPriceProduct(null);
                    setProductSheetError(null);
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={addingProductId === pendingPriceProduct.id ? t('sales:savingButton') : t('sales:addProductButton')}
                  disabled={addingProductId === pendingPriceProduct.id}
                  fullWidth
                  onPress={confirmAddProduct}
                />
              </View>
            </View>
          </View>
        ) : (
          <>
            <View style={{ paddingHorizontal: 24, paddingBottom: 12, gap: 8 }}>
              <TextInput
                value={productSearch}
                onChangeText={setProductSearch}
                placeholder={t('sales:productSearchPlaceholder')}
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
              {productSheetError ? (
                <Text variant="caption" color="danger">
                  ⚠ {productSheetError}
                </Text>
              ) : null}
              <Button
                label={t('sales:newProductButton')}
                variant="secondary"
                size="sm"
                fullWidth
                onPress={() => {
                  setProductSheetOpen(false);
                  setProductSheetError(null);
                  router.push({ pathname: '/produtos/novo', params: { returnTo: 'nova-venda' } });
                }}
              />
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}>
              {productsQuery.isLoading ? (
                <ActivityIndicator color={palette.primary} style={{ marginTop: 16 }} />
              ) : (productsQuery.data?.items.length ?? 0) === 0 ? (
                <EmptyState title={t('sales:productSheetEmptyTitle')} />
              ) : (
                productsQuery.data!.items.map((product, index) => {
                  const isAdding = addingProductId === product.id;
                  return (
                    <Pressable
                      key={product.id}
                      disabled={isAdding}
                      onPress={() => handleProductTap(product)}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 12,
                        borderTopWidth: index === 0 ? 0 : 1,
                        borderTopColor: palette.dividerSoft,
                        opacity: pressed || isAdding ? 0.6 : 1,
                      })}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12, gap: 12 }}>
                        <ProductThumbnail imageUrl={product.imageUrl} name={product.name} size="sm" />
                        <View style={{ flex: 1 }}>
                          <Text variant="body" weight="semibold" color="ink" numberOfLines={1}>
                            {product.name}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                            {product.stockStatus === 'OUT' ? <StatusBadge status="outOfStock" /> : null}
                          </View>
                        </View>
                      </View>
                      {isAdding ? <ActivityIndicator color={palette.primary} /> : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </>
        )}
      </SheetModal>
    </View>
  );
}
