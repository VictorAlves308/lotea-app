import { Modal, View } from 'react-native';

import { palette } from '../theme/colors';
import { Button } from './Button';
import { Text } from './Text';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A centered confirm/cancel dialog — used for "similar record already
 * exists, create anyway?" flows (customers, products). Built as a real
 * component (not `Alert.alert`, which no-ops on React Native Web) since the
 * web preview is how this app is actually verified during development.
 */
export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(18,16,16,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <View style={{ backgroundColor: palette.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, gap: 16 }}>
          <Text variant="heading2" color="ink">
            {title}
          </Text>
          {description ? (
            <Text variant="body" color="muted">
              {description}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Button variant="secondary" label={cancelLabel} onPress={onCancel} fullWidth />
            </View>
            <View style={{ flex: 1 }}>
              <Button variant="primary" label={confirmLabel} onPress={onConfirm} fullWidth />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
