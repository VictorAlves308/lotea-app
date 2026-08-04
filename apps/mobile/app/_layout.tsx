import { Stack } from 'expo-router';

import { AppProviders } from '../src/app-providers';
import { ErrorBoundary } from '../src/shared/components/ErrorBoundary';
import '../global.css';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
    </ErrorBoundary>
  );
}
