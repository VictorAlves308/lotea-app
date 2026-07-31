import { Stack } from 'expo-router';

import { AppProviders } from '../src/app-providers';
import '../global.css';

export default function RootLayout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}
