import { View } from 'react-native';

import { palette } from '../theme/colors';
import { Text } from './Text';

/** The terracotta app mark + "lotea" wordmark — the header of Login/Cadastro, per the prototype. */
export function Logo({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  const isLarge = size === 'lg';
  const boxSize = isLarge ? 34 : 30;
  const dotSize = isLarge ? 10 : 9;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: isLarge ? 10 : 8 }}>
      <View
        style={{
          width: boxSize,
          height: boxSize,
          borderRadius: isLarge ? 9 : 8,
          backgroundColor: palette.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: palette.primary,
          shadowOpacity: 0.3,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }}
      >
        <View
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: isLarge ? 3 : 2,
            backgroundColor: '#FFFFFF',
          }}
        />
      </View>
      <Text
        variant="heading1"
        color="ink"
        style={{ fontSize: isLarge ? 24 : 20, letterSpacing: isLarge ? -0.7 : -0.6 }}
      >
        lotea
      </Text>
    </View>
  );
}
