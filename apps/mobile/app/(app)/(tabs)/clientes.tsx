import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';

import { useRequireAuth } from '../../../src/features/auth/hooks/useRequireAuth';
import { useCustomers } from '../../../src/features/customers/hooks/useCustomers';
import { Button } from '../../../src/shared/components/Button';
import { Card } from '../../../src/shared/components/Card';
import { EmptyState } from '../../../src/shared/components/EmptyState';
import { Skeleton } from '../../../src/shared/components/Skeleton';
import { Text } from '../../../src/shared/components/Text';
import { formatBRL } from '../../../src/shared/lib/currency';
import { formatRelativeDayLabel } from '../../../src/shared/lib/date-format';
import { palette } from '../../../src/shared/theme/colors';

type Tab = 'all' | 'pending';

const SCROLL_BOTTOM_PADDING = 120;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0]![0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function CustomerRow({ id, name, phone, balance, lastActivityAt }: {
  id: string;
  name: string;
  phone: string | null;
  balance: string;
  lastActivityAt: string | null;
}) {
  const { t } = useTranslation();
  const hasBalance = Number(balance) > 0;

  return (
    <Pressable
      onPress={() => router.push(`/clientes/${id}`)}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 12 }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: palette.primaryTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="body" weight="bold" color="primary" style={{ fontSize: 14 }}>
            {initialsOf(name)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="body" weight="semibold" color="ink" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" color="muted" numberOfLines={1}>
            {hasBalance
              ? t('customers:outstandingBalance', { amount: formatBRL(balance) })
              : t('customers:lastPurchase', {
                  when: lastActivityAt ? formatRelativeDayLabel(new Date(lastActivityAt)) : phone ?? '—',
                })}
          </Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text variant="body" weight="semibold" color={hasBalance ? 'primary' : 'success'}>
          {formatBRL(balance)}
        </Text>
        <View
          style={{
            borderRadius: 999,
            paddingVertical: 3,
            paddingHorizontal: 8,
            backgroundColor: hasBalance ? palette.warningTint : palette.successTint,
          }}
        >
          <Text variant="label" style={{ color: hasBalance ? palette.warningStrong : palette.successStrong }}>
            {hasBalance ? t('customers:statusPending') : t('customers:statusOk')}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function ClientesSkeleton() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerClassName="gap-4 px-4 py-6 md:mx-auto md:w-full md:max-w-2xl md:px-8 md:py-10"
      contentContainerStyle={{ paddingBottom: SCROLL_BOTTOM_PADDING }}
    >
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-64 w-full" />
    </ScrollView>
  );
}

export default function ClientesScreen() {
  const { t } = useTranslation();
  const { checkingAuth } = useRequireAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Both tabs' counts need to be visible at once ("Todas (34)" / "Pendentes
  // (8)"), so both lists are fetched in parallel rather than refetching a
  // single query with a flipping filter every time the tab changes.
  const allCustomers = useCustomers({ sort: 'name', limit: 100 }, { enabled: !checkingAuth });
  const pendingCustomers = useCustomers({ sort: 'name', limit: 100, hasBalance: true }, { enabled: !checkingAuth });
  const active = tab === 'all' ? allCustomers : pendingCustomers;
  const { data, isLoading, isError, refetch } = active;

  // Pull-to-refresh invalidates both tabs' queries (not just the visible
  // one), since their counts are shown together in the segmented control.
  async function handleRefresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['customers'] });
    setRefreshing(false);
  }

  const groups = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();
    const filtered = query
      ? data.items.filter((customer) => customer.name.toLowerCase().includes(query))
      : data.items;
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const byLetter = new Map<string, typeof sorted>();
    for (const customer of sorted) {
      const letter = customer.name.trim().charAt(0).toUpperCase() || '#';
      const bucket = byLetter.get(letter);
      if (bucket) {
        bucket.push(customer);
      } else {
        byLetter.set(letter, [customer]);
      }
    }
    return Array.from(byLetter.entries());
  }, [data, search]);

  if (checkingAuth || isLoading) {
    return <ClientesSkeleton />;
  }

  if (isError || !data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: palette.bg, paddingHorizontal: 24 }}>
        <Text variant="body" color="ink" style={{ textAlign: 'center' }}>
          {t('customers:loadError')}
        </Text>
        <Button label={t('customers:retryButton')} variant="secondary" onPress={() => refetch()} />
      </View>
    );
  }

  const isSearching = search.trim().length > 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerClassName="gap-4 px-4 py-6 md:mx-auto md:w-full md:max-w-2xl md:px-8 md:py-10"
      contentContainerStyle={{ paddingBottom: SCROLL_BOTTOM_PADDING }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.primary} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="heading1" color="ink">
          {t('customers:listTitle')}
        </Text>
        <Button
          label={t('customers:newButton')}
          size="sm"
          onPress={() => router.push('/clientes/novo')}
        />
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={t('customers:searchPlaceholder')}
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

      <View style={{ flexDirection: 'row', gap: 4, alignSelf: 'flex-start', backgroundColor: palette.dividerFaint, borderRadius: 12, padding: 4 }}>
        {(['all', 'pending'] as Tab[]).map((value) => {
          const selected = value === tab;
          return (
            <Pressable
              key={value}
              onPress={() => setTab(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={{
                paddingVertical: 7,
                paddingHorizontal: 16,
                borderRadius: 9,
                backgroundColor: selected ? palette.surface : 'transparent',
              }}
            >
              <Text variant="body" weight={selected ? 'semibold' : 'medium'} color={selected ? 'ink' : 'muted'} style={{ fontSize: 13 }}>
                {value === 'all'
                  ? t('customers:tabAll', { count: allCustomers.data?.total ?? 0 })
                  : t('customers:tabPending', { count: pendingCustomers.data?.total ?? 0 })}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            title={isSearching ? t('customers:emptySearchTitle') : t('customers:emptyTitle')}
            description={isSearching ? undefined : t('customers:emptyDescription')}
            actionLabel={isSearching ? undefined : t('customers:newButton')}
            onAction={isSearching ? undefined : () => router.push('/clientes/novo')}
          />
        </Card>
      ) : (
        groups.map(([letter, customers]) => (
          <View key={letter} style={{ gap: 8 }}>
            <Text variant="label" color="placeholder">
              {letter}
            </Text>
            <Card>
              {customers.map((customer, index) => (
                <View
                  key={customer.id}
                  style={{ borderBottomWidth: index === customers.length - 1 ? 0 : 1, borderBottomColor: palette.dividerSoft }}
                >
                  <CustomerRow
                    id={customer.id}
                    name={customer.name}
                    phone={customer.phone}
                    balance={customer.balance}
                    lastActivityAt={customer.lastActivityAt ? String(customer.lastActivityAt) : null}
                  />
                </View>
              ))}
            </Card>
          </View>
        ))
      )}
    </ScrollView>
  );
}
