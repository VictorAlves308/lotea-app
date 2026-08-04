import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Button } from '../src/shared/components/Button';
import { Text } from '../src/shared/components/Text';
import { palette } from '../src/shared/theme/colors';

export default function HomeScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        paddingHorizontal: 24,
        paddingVertical: 24,
      }}
      style={{ flex: 1, backgroundColor: palette.bg }}
    >
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text variant="display" color="ink">
          {t('common:appName')}
        </Text>
        <Text variant="body" color="muted" style={{ textAlign: 'center' }}>
          {t('common:tagline')}
        </Text>
      </View>
      <Button label={t('common:enterButton')} onPress={() => router.push('/login')} fullWidth />
    </ScrollView>
  );
}
