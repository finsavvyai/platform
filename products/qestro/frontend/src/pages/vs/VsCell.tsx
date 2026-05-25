import { Check, X, Minus } from 'lucide-react';
import type { CellValue } from './vs-data';

const CELL_STYLES: Record<CellValue, { icon: typeof Check; color: string; label: string }> = {
  yes: { icon: Check, color: '#22c55e', label: 'Yes' },
  no: { icon: X, color: '#ef4444', label: 'No' },
  partial: { icon: Minus, color: '#f59e0b', label: 'Partial' },
};

/**
 * Accessible comparison-matrix cell. The visible icon is decorative; the
 * `aria-label` carries the semantic value for screen readers.
 */
export const VsCell = ({ value }: { value: CellValue }) => {
  const { icon: Icon, color, label } = CELL_STYLES[value];
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-full"
      style={{ backgroundColor: `${color}1a`, color }}
      aria-label={label}
      role="img"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
};
