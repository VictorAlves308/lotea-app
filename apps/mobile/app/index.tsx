import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '../src/shared/components/Button';
import { Text } from '../src/shared/components/Text';
import { palette } from '../src/shared/theme/colors';

export default function HomeScreen() {
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, backgroundColor: palette.bg, paddingHorizontal: 24 }}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text variant="display" color="ink">
          {t('common:appName')}
        </Text>
        <Text variant="body" color="muted" style={{ textAlign: 'center' }}>
          {t('common:tagline')}
        </Text>
      </View>
      <Button label={t('common:enterButton')} onPress={() => router.push('/login')} fullWidth />
    </View>
  );
}
