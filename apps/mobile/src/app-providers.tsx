import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  useFonts,
} from '@expo-google-fonts/dm-sans';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as SplashScreen from 'expo-splash-screen';
import { type PropsWithChildren, useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import './shared/i18n';
import { asyncStoragePersister } from './shared/lib/persister';
import { queryClient } from './shared/lib/query-client';
import { palette } from './shared/theme/colors';

// Keep the splash screen up until DM Sans is ready — the design system's
// `Text` component hard-codes these exact family names, so rendering before
// they're loaded would show the OS's fallback font for a flash.
void SplashScreen.preventAutoHideAsync();

export function AppProviders({ children }: PropsWithChildren) {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: palette.bg }} />;
  }

  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: asyncStoragePersister }}
      >
        {children}
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}
