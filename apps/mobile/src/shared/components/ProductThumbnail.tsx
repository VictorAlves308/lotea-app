import { Image, View } from 'react-native';

import { palette } from '../theme/colors';
import { Text } from './Text';

const SIZE_PX = { sm: 36, md: 44, lg: 64 } as const;

/**
 * Product photo — falls back to an initial-letter tile when `imageUrl` is
 * null (most products, until the catalog is populated from an affiliate
 * product feed; see catalog-product.schema.ts's imageUrl comment). Never a
 * broken-image icon: absence of a photo is just as valid a state as having
 * one.
 */
export function ProductThumbnail({
  imageUrl,
  name,
  size = 'md',
}: {
  imageUrl: string | null | undefined;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const px = SIZE_PX[size];
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: px, height: px, borderRadius: 10, backgroundColor: palette.dividerFaint }}
        resizeMode="cover"
        accessibilityLabel={name}
      />
    );
  }

  return (
    <View
      style={{
        width: px,
        height: px,
        borderRadius: 10,
        backgroundColor: palette.dividerSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="body" weight="bold" color="muted" style={{ fontSize: size === 'lg' ? 20 : 14 }}>
        {initial}
      </Text>
    </View>
  );
}
