import React from 'react';
import { Section } from './MatchSection';

interface SanctionsProps {
  sanctions?: string | object[];
  programs?: string[];
  remarks?: string;
  sourceUrl?: string;
}

export const SanctionsSection: React.FC<SanctionsProps> = ({
  sanctions, programs, remarks, sourceUrl,
}) => {
  const hasSanctions = sanctions && sanctions !== '';
  if (!hasSanctions && !programs?.length && !remarks && !sourceUrl) return null;

  return (
    <Section title="Sanctions & Programs">
      {programs && programs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {programs.map((p, i) => (
            <span key={i} className="px-2 py-0.5 bg-red-50 text-red-700
              dark:bg-red-900/30 dark:text-red-400 rounded text-xs font-medium">
              {p}
            </span>
          ))}
        </div>
      )}
      {typeof sanctions === 'string' && sanctions && (
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{sanctions}</p>
      )}
      {Array.isArray(sanctions) && sanctions.map((s: any, i: number) => (
        <div key={i} className="border-l-2 border-red-200 dark:border-red-700 pl-3 mb-2
          text-sm text-gray-700 dark:text-gray-300">
          {s.authority && <p className="font-medium">{s.authority}</p>}
          {s.program && <p className="text-gray-600 dark:text-gray-400">{s.program}</p>}
          {s.reason && <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{s.reason}</p>}
        </div>
      ))}
      {remarks && (
        <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50
          dark:bg-gray-800 p-3 rounded-lg mt-2">{remarks}</p>
      )}
      {sourceUrl && (
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
          className="inline-block mt-2 text-xs text-blue-600 dark:text-blue-400
            hover:underline focus:outline-none focus-visible:ring-2
            focus-visible:ring-blue-500/40 rounded">
          View source →
        </a>
      )}
    </Section>
  );
};
