import { Check, X, Minus } from 'lucide-react';

type Cell = 'yes' | 'no' | 'partial' | string;

interface Row {
  label: string;
  opensyber: Cell;
  wiz: Cell;
  snyk: Cell;
  gha: Cell;
}

const ROWS: readonly Row[] = [
  { label: 'Starts free (real free, not trial)', opensyber: 'yes', wiz: 'no', snyk: 'partial', gha: 'partial' },
  { label: 'Deploy in < 60 seconds', opensyber: 'yes', wiz: 'no', snyk: 'partial', gha: 'yes' },
  { label: 'AI agent security runtime', opensyber: 'yes', wiz: 'no', snyk: 'no', gha: 'no' },
  { label: 'Device-bound sessions (TokenForge)', opensyber: 'yes', wiz: 'no', snyk: 'no', gha: 'no' },
  { label: 'Attack path analysis', opensyber: 'yes', wiz: 'yes', snyk: 'no', gha: 'no' },
  { label: 'Skill marketplace (custom detectors)', opensyber: 'yes', wiz: 'no', snyk: 'no', gha: 'no' },
  { label: 'SOC 2 / ISO 27001 evidence auto-gen', opensyber: 'yes', wiz: 'partial', snyk: 'no', gha: 'no' },
  { label: 'Transparent pricing (no "call us")', opensyber: 'yes', wiz: 'no', snyk: 'partial', gha: 'yes' },
  { label: 'Entry price (team tier)', opensyber: '$299/mo', wiz: '$3,000+/mo', snyk: '$98/user', gha: '$49/user' },
];

const COLS: readonly { key: 'opensyber' | 'wiz' | 'snyk' | 'gha'; label: string; highlight: boolean }[] = [
  { key: 'opensyber', label: 'OpenSyber', highlight: true },
  { key: 'wiz', label: 'Wiz', highlight: false },
  { key: 'snyk', label: 'Snyk', highlight: false },
  { key: 'gha', label: 'GitHub Advanced Security', highlight: false },
];

function renderCell(value: Cell, highlight: boolean): React.ReactNode {
  if (value === 'yes') {
    return (
      <Check
        className={`h-5 w-5 inline-block ${highlight ? 'text-signal' : 'text-ok'}`}
        aria-label="yes"
      />
    );
  }
  if (value === 'no') {
    return <X className="h-5 w-5 inline-block text-alert/70" aria-label="no" />;
  }
  if (value === 'partial') {
    return <Minus className="h-5 w-5 inline-block text-warn" aria-label="partial" />;
  }
  return (
    <span
      className={`text-sm ${highlight ? 'text-signal font-semibold' : 'text-text-primary'}`}
    >
      {value}
    </span>
  );
}

/** Comparison table — OpenSyber vs Wiz, Snyk, GitHub Advanced Security. */
export function ComparisonTable() {
  return (
    <section className="mt-20" aria-labelledby="comparison-heading">
      <div className="text-center mb-10">
        <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-3">
          Honest comparison
        </p>
        <h2
          id="comparison-heading"
          className="font-[family-name:var(--font-display)] text-3xl md:text-5xl tracking-wide"
        >
          WHY NOT JUST USE WIZ?
        </h2>
        <p className="mt-3 text-text-secondary max-w-2xl mx-auto">
          Because Wiz starts at $3K/mo and doesn&apos;t cover AI agents. We&apos;ll wait.
        </p>
      </div>

      <div className="overflow-x-auto rounded border border-border bg-panel/30">
        <table className="w-full border-collapse text-left min-w-[720px]">
          <thead>
            <tr className="border-b border-border">
              <th className="p-4 text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider text-text-dim">
                Capability
              </th>
              {COLS.map((col) => (
                <th
                  key={col.key}
                  className={`p-4 text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider text-center ${
                    col.highlight ? 'text-signal' : 'text-text-secondary'
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => (
              <tr
                key={row.label}
                className={i < ROWS.length - 1 ? 'border-b border-border/60' : ''}
              >
                <td className="p-4 text-sm text-text-primary">{row.label}</td>
                {COLS.map((col) => (
                  <td
                    key={col.key}
                    className={`p-4 text-center ${col.highlight ? 'bg-signal/[0.03]' : ''}`}
                  >
                    {renderCell(row[col.key], col.highlight)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
