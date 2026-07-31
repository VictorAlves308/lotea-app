import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { BottomNav } from '../../../src/shared/components/BottomNav';

// Only tabs backed by a real, shipped screen appear here — see BottomNav's
// own comment. Lotes replaced Produtos as the third tab (Produtos moved into
// the "Mais" sheet) since lots — not individual products — are meant to be
// the app's primary registration flow; see lots.json.
export default function TabsLayout() {
  const { t } = useTranslation(['dashboard', 'customers', 'lots']);

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={BottomNav}>
      <Tabs.Screen name="dashboard" options={{ title: t('dashboard:tabLabel') }} />
      <Tabs.Screen name="lotes" options={{ title: t('lots:listTitle') }} />
      <Tabs.Screen name="clientes" options={{ title: t('customers:listTitle') }} />
    </Tabs>
  );
}
