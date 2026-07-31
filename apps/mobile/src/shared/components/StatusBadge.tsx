import { View } from 'react-native';

import { palette } from '../theme/colors';
import { Text } from './Text';

export type Status =
  | 'paid'
  | 'partiallyPaid'
  | 'pending'
  | 'cancelled'
  | 'refunded'
  | 'draft'
  | 'inStock'
  | 'lowStock'
  | 'outOfStock';

const STATUS_LABEL: Record<Status, string> = {
  paid: 'Pago',
  partiallyPaid: 'Parcial',
  pending: 'Pendente',
  cancelled: 'Cancelada',
  refunded: 'Reembolsada',
  draft: 'Rascunho',
  inStock: 'Em estoque',
  lowStock: 'Estoque baixo',
  outOfStock: 'Sem estoque',
};

const STATUS_TINT: Record<Status, string> = {
  paid: palette.successTint,
  partiallyPaid: palette.warningTint,
  pending: palette.dividerSoft,
  cancelled: palette.dangerTint,
  refunded: palette.dangerTint,
  draft: palette.dividerSoft,
  inStock: palette.successTint,
  lowStock: palette.warningTint,
  outOfStock: palette.dangerTint,
};

const STATUS_TEXT: Record<Status, string> = {
  paid: palette.successStrong,
  partiallyPaid: palette.warningStrong,
  pending: palette.muted,
  cancelled: palette.dangerStrong,
  refunded: palette.dangerStrong,
  draft: palette.muted,
  inStock: palette.successStrong,
  lowStock: palette.warningStrong,
  outOfStock: palette.dangerStrong,
};

const STATUS_DOT: Record<Status, string> = {
  paid: palette.success,
  partiallyPaid: palette.warning,
  pending: palette.placeholder,
  cancelled: palette.danger,
  refunded: palette.danger,
  draft: palette.placeholder,
  inStock: palette.success,
  lowStock: palette.warning,
  outOfStock: palette.danger,
};

/**
 * The 7 exact status pairs from the design system. Color is always paired
 * with the plain-language label itself (never relies on color alone) — the
 * leading dot is a redundant, not the only, signal.
 */
export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        borderRadius: 999,
        paddingVertical: 4,
        paddingHorizontal: 10,
        backgroundColor: STATUS_TINT[status],
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: STATUS_DOT[status] }} />
      <Text variant="label" color="inherit" style={{ color: STATUS_TEXT[status], textTransform: 'none' }}>
        {label ?? STATUS_LABEL[status]}
      </Text>
    </View>
  );
}
