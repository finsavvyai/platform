'use client';

import { FileText, Shield, CreditCard, Key, Code, FileStack } from 'lucide-react';
import { type DataClassification, EXPOSURE_COLORS } from './types';

interface Props {
  classifications: DataClassification[];
  onRemediate: (id: string) => void;
}

const TYPE_ICONS: Record<string, typeof FileText> = {
  PII: FileText,
  PHI: Shield,
  Financial: CreditCard,
  Credentials: Key,
  'Source Code': Code,
  'Internal Docs': FileStack,
};

export function ClassificationGrid({
  classifications,
  onRemediate,
}: Props): React.ReactElement {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Data Classification</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {classifications.map((c) => {
          const Icon = TYPE_ICONS[c.type] ?? FileText;
          return (
            <div
              key={c.id}
              className={`rounded-xl border ${c.riskColor} bg-neutral-900/30 p-6`}
            >
              <div className="flex items-center gap-3 mb-3">
                <Icon className="h-5 w-5 text-neutral-400" />
                <h3 className="font-medium">{c.type}</h3>
              </div>
              <p className="text-2xl font-bold">
                {c.count.toLocaleString()}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                instances found
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${EXPOSURE_COLORS[c.exposure]}`}
                >
                  {c.exposure}
                </span>
                <button
                  onClick={() => onRemediate(c.id)}
                  className="rounded-lg border border-info/30 px-3 py-1 text-xs text-info hover:bg-info/10 transition"
                >
                  Remediate
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
