import { VsCell } from './VsCell';
import type { FeatureRow } from './vs-types';

interface Props {
  competitor: string;
  rows: FeatureRow[];
}

/**
 * Responsive feature-matrix. On mobile the inner wrapper scrolls horizontally
 * so rows never collapse into broken vertical cells — important for tables
 * with long feature names.
 */
export const VsFeatureTable = ({ competitor, rows }: Props) => (
  <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
    <table
      data-testid="feature-comparison"
      className="w-full min-w-[640px] border-collapse text-left text-sm"
    >
      <thead>
        <tr
          style={{
            borderBottom: '1px solid color-mix(in srgb, var(--text-muted) 30%, transparent)',
          }}
        >
          <th className="py-3 pr-4 font-semibold">Feature</th>
          <th className="py-3 px-4 font-semibold" style={{ color: 'var(--brand-primary)' }}>
            Qestro
          </th>
          <th className="py-3 px-4 font-semibold">{competitor}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.feature}
            style={{
              borderBottom: '1px solid color-mix(in srgb, var(--text-muted) 15%, transparent)',
            }}
          >
            <td className="py-3 pr-4">
              <div className="font-medium">{row.feature}</div>
              {row.note && (
                <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {row.note}
                </div>
              )}
            </td>
            <td className="py-3 px-4">
              <VsCell value={row.qestro} />
            </td>
            <td className="py-3 px-4">
              <VsCell value={row.competitor} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
