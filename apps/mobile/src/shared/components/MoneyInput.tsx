import { Input } from './Input';

const decimalFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function centsToDisplay(cents: number): string {
  return decimalFormatter.format(cents / 100);
}

function wireValueToCents(value: string): number {
  const cents = Math.round(Number.parseFloat(value || '0') * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : 0;
}

interface MoneyInputProps {
  label: string;
  errorMessage?: string;
  placeholder?: string;
  /** Wire-format value ("10.50") or "" — never a partially-typed string. */
  value: string;
  onChangeValue: (wireValue: string) => void;
}

/**
 * A cents-entry money field: digits fill in from the right as the user types
 * (e.g. "1", "10", "105" → 0,01 / 0,10 / 1,05), like a register/POS amount
 * field, instead of expecting the user to type a decimal separator
 * themselves. `number-pad` intentionally excludes "," / "." — there's never
 * a separator to type.
 */
export function MoneyInput({ label, errorMessage, placeholder, value, onChangeValue }: MoneyInputProps) {
  const cents = wireValueToCents(value);

  return (
    <Input
      label={label}
      errorMessage={errorMessage}
      prefix="R$"
      keyboardType="number-pad"
      placeholder={placeholder ?? '0,00'}
      value={value ? centsToDisplay(cents) : ''}
      onChangeText={(text) => {
        const digits = text.replace(/\D/g, '');
        onChangeValue(digits ? (Number.parseInt(digits, 10) / 100).toFixed(2) : '');
      }}
    />
  );
}
