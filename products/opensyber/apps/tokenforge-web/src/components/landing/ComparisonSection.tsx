'use client';

import { motion } from 'framer-motion';
import { Check, X, Minus } from 'lucide-react';

const ease = [0.25, 0.1, 0.25, 1] as const;

type CellValue = 'yes' | 'no' | 'partial' | 'na';

interface ComparisonRow {
  feature: string;
  tokenforge: CellValue;
  dbsc: CellValue;
  cookies: CellValue;
  fingerprinting: CellValue;
}

const rows: ComparisonRow[] = [
  { feature: 'Cross-browser', tokenforge: 'yes', dbsc: 'no', cookies: 'na', fingerprinting: 'yes' },
  { feature: 'Framework agnostic', tokenforge: 'yes', dbsc: 'no', cookies: 'yes', fingerprinting: 'yes' },
  { feature: 'Cryptographic proof', tokenforge: 'yes', dbsc: 'yes', cookies: 'no', fingerprinting: 'no' },
  { feature: 'Trust scoring', tokenforge: 'yes', dbsc: 'no', cookies: 'no', fingerprinting: 'partial' },
  { feature: 'Step-up auth', tokenforge: 'yes', dbsc: 'no', cookies: 'no', fingerprinting: 'no' },
  { feature: 'Zero dependencies', tokenforge: 'yes', dbsc: 'na', cookies: 'na', fingerprinting: 'no' },
];

const headers = ['Feature', 'TokenForge', 'Google DBSC', 'Session Cookies', 'Device Fingerprinting'];

function CellIcon({ value }: { value: CellValue }): React.ReactElement {
  switch (value) {
    case 'yes':
      return <Check className="h-4 w-4 text-ok mx-auto" />;
    case 'no':
      return <X className="h-4 w-4 text-alert mx-auto" />;
    case 'partial':
      return <Minus className="h-4 w-4 text-warn mx-auto" />;
    case 'na':
      return <span className="text-xs text-text-muted">N/A</span>;
  }
}

export function ComparisonSection(): React.ReactElement {
  return (
    <section className="py-24 md:py-32 border-t border-border/50">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease }}
          className="text-center mb-16"
        >
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-info uppercase tracking-[0.2em] mb-5 block">
            Comparison
          </span>
          <h2 className="font-bold text-3xl sm:text-5xl md:text-7xl tracking-tight mb-4">Why TokenForge?</h2>
          <p className="text-text-secondary max-w-2xl mx-auto text-lg">
            The only cross-browser, framework-agnostic solution with cryptographic device binding and trust scoring.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, delay: 0.15, ease }}
          className="overflow-x-auto gradient-border"
        >
          <div className="rounded-2xl bg-panel overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-surface/50">
                  {headers.map((h, i) => (
                    <th
                      key={h}
                      className={`px-6 py-4 text-sm font-medium ${
                        i === 1 ? 'text-info' : 'text-text-secondary'
                      } ${i === 0 ? 'text-left' : 'text-center'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {rows.map((row, i) => (
                  <motion.tr
                    key={row.feature}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05, duration: 0.3, ease }}
                    className="hover:bg-surface/30"
                  >
                    <td className="px-6 py-3 text-sm text-text-secondary font-medium">{row.feature}</td>
                    <td className="px-6 py-3 text-center"><CellIcon value={row.tokenforge} /></td>
                    <td className="px-6 py-3 text-center"><CellIcon value={row.dbsc} /></td>
                    <td className="px-6 py-3 text-center"><CellIcon value={row.cookies} /></td>
                    <td className="px-6 py-3 text-center"><CellIcon value={row.fingerprinting} /></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
