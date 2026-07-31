import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { logout as logoutRequest } from '../../features/auth/api';
import { clearAuthTokens, getRefreshToken } from '../lib/storage';
import { palette } from '../theme/colors';
import { Text } from './Text';

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  dashboard: 'home',
  lotes: 'layers',
  clientes: 'people',
};

/**
 * Minimal structural shape of expo-router's `Tabs` `tabBar` callback props
 * (its full `BottomTabBarProps` type lives under expo-router's internal,
 * unpublished `build/react-navigation/...` path — not something app code
 * should import directly). Only the fields this bar actually reads.
 */
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string } }>;
  navigation: {
    navigate: (name: string) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- structural shim for expo-router's unpublished BottomTabBarProps.navigation.emit, whose real signature is generic over an internal event map
    emit: (event: any) => any;
  };
  insets: EdgeInsets;
}

interface MoreLink {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}

/**
 * Only shortcuts backed by a real, shipped screen ever appear here — same
 * rule as the tab bar itself. Grows one line per phase of the mobile
 * rebuild (see the phased plan): Vendas lands with Fase 4, Pagamentos with
 * Fase 7, and so on.
 */
const MORE_LINKS: MoreLink[] = [
  { label: 'Vendas', icon: 'receipt', route: '/vendas' },
  { label: 'Produtos', icon: 'pricetags', route: '/produtos' },
  { label: 'Estoque', icon: 'cube', route: '/estoque' },
  { label: 'Pagamentos', icon: 'cash', route: '/pagamentos' },
  { label: 'Financeiro', icon: 'bar-chart', route: '/financeiro' },
  { label: 'Mais vendidos', icon: 'trophy', route: '/mais-vendidos' },
];

/**
 * Icon on top, label beneath, always visible — every tab (and "Mais") shares
 * this exact same `flex: 1` shape, so the bar stays symmetric regardless of
 * which one is focused. The previous side-by-side layout only showed a label
 * on the focused tab, which made that one item wider than its neighbors and
 * threw the whole bar out of alignment.
 */
function TabButton({
  focused,
  label,
  icon,
  onPress,
}: {
  focused: boolean;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        borderRadius: 999,
        paddingVertical: 8,
        backgroundColor: focused ? palette.primary : 'transparent',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name={icon} size={19} color="#FFFFFF" />
      <Text
        weight={focused ? 'semibold' : 'medium'}
        numberOfLines={1}
        style={{ color: '#FFFFFF', fontSize: 10, lineHeight: 12, letterSpacing: 0, opacity: focused ? 1 : 0.7 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MoreSheet({ visible, onClose, onLogout }: { visible: boolean; onClose: () => void; onLogout: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(18,16,16,0.45)', justifyContent: 'flex-end' }}
      >
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
          {MORE_LINKS.map((link) => (
            <Pressable
              key={link.route}
              onPress={() => {
                onClose();
                router.push(link.route);
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
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: palette.primaryTint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={link.icon} size={18} color={palette.primary} />
              </View>
              <Text variant="body" weight="medium" color="ink">
                {link.label}
              </Text>
            </Pressable>
          ))}

          <View style={{ height: 1, backgroundColor: palette.dividerSoft, marginVertical: 8 }} />

          <Pressable
            onPress={onLogout}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingVertical: 14,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: pressed ? palette.dangerSoftTint : 'transparent',
            })}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: palette.dangerTint,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="log-out-outline" size={18} color={palette.danger} />
            </View>
            <Text variant="body" weight="medium" color="danger">
              Sair da conta
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * The design system's floating dark pill bottom nav: a single, self-
 * contained bar that floats above the content with margin on all sides,
 * rather than a bar docked flush to the screen edge. Real tab screens
 * (`state.routes`) render first; a raised center FAB for "Nova venda" and a
 * trailing "Mais" button are fixed extras, not tied to any `Tabs.Screen`.
 *
 * `insets` comes in as a prop, not `useSafeAreaInsets()` — expo-router
 * invokes the `tabBar` option as a plain function call inside a render-prop
 * callback (`tabBar({ state, descriptors, navigation, insets })`), not as
 * JSX, so there's no component instance for a hook call to attach to; the
 * library hands over the already-resolved insets for exactly this reason.
 *
 * That same plain-function-call quirk means `BottomNav` itself (the value
 * passed as `tabBar=`) must never call a hook directly — React has no
 * component instance to attach the hook to, and it throws "Invalid hook
 * call" at runtime (TypeScript can't catch this). The "Mais" sheet's
 * `useState` lives on `TabBarContent` instead, a real component rendered
 * via JSX from `BottomNav`'s return value — that JSX element is what gives
 * React the instance a hook needs.
 */
function TabBarContent({ state, descriptors, navigation, insets }: TabBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const queryClient = useQueryClient();

  async function handleLogout() {
    setMoreOpen(false);
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      // Best-effort — revokes the refresh token server-side, but local logout proceeds either way.
      await logoutRequest(refreshToken).catch(() => {});
    }
    await clearAuthTokens();
    queryClient.clear();
    router.replace('/login');
  }

  const renderTab = (index: number) => {
    const route = state.routes[index];
    if (!route) return null;
    const { options } = descriptors[route.key];
    const label = (options.title ?? route.name) as string;
    const focused = state.index === index;

    return (
      <TabButton
        key={route.key}
        focused={focused}
        label={label}
        icon={ICON[route.name] ?? 'ellipse'}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }}
      />
    );
  };

  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: insets.bottom + 12,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: palette.ink,
          borderRadius: 999,
          paddingVertical: 8,
          paddingHorizontal: 8,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        {renderTab(0)}
        {renderTab(1)}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nova venda"
          onPress={() => router.push('/vendas/nova')}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            marginHorizontal: 6,
            marginTop: -6,
            backgroundColor: palette.primary,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: palette.primary,
            shadowOpacity: 0.5,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          })}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </Pressable>

        {renderTab(2)}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mais"
          onPress={() => setMoreOpen(true)}
          style={({ pressed }) => ({
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            borderRadius: 999,
            paddingVertical: 8,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name="menu" size={19} color="#FFFFFF" />
          <Text weight="medium" style={{ color: '#FFFFFF', fontSize: 10, lineHeight: 12, letterSpacing: 0, opacity: 0.7 }}>
            Mais
          </Text>
        </Pressable>
      </View>

      <MoreSheet visible={moreOpen} onClose={() => setMoreOpen(false)} onLogout={handleLogout} />
    </>
  );
}

export function BottomNav(props: TabBarProps) {
  return <TabBarContent {...props} />;
}
