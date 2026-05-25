import React from 'react';
import { Section } from './MatchSection';

export { TimestampRow, BioSection } from './MatchBio';

interface NamesProps {
  aliases?: string[]; givenName?: string; familyName?: string;
}

export const NamesSection: React.FC<NamesProps> = ({ aliases, givenName, familyName }) => {
  if (!aliases?.length && !givenName && !familyName) return null;
  return (
    <Section title="Names & Aliases">
      {(givenName || familyName) && (
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
          <span className="text-gray-500 dark:text-gray-400 text-xs mr-2">Primary:</span>
          {[givenName, familyName].filter(Boolean).join(' ')}
        </p>
      )}
      {aliases && aliases.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {aliases.map((a, i) => (
            <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700
              text-gray-700 dark:text-gray-300 rounded text-xs">{a}</span>
          ))}
        </div>
      )}
    </Section>
  );
};

interface IdentifiersSectionProps {
  identifiers?: { type: string; value: string; country: string }[];
}

const idLabels: Record<string, string> = {
  passport: 'Passport', national_id: 'National ID',
  tax_id: 'Tax ID', registration: 'Registration',
  imo_number: 'IMO', mmsi: 'MMSI',
};

export const IdentifiersSection: React.FC<IdentifiersSectionProps> = ({ identifiers }) => {
  if (!identifiers?.length) return null;
  return (
    <Section title="Identifiers">
      <div className="space-y-1.5">
        {identifiers.map((id, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-24">
              {idLabels[id.type] ?? id.type}
            </span>
            <span className="font-mono text-gray-800 dark:text-gray-200">{id.value}</span>
            {id.country && (
              <span className="text-xs text-gray-500 dark:text-gray-400">({id.country})</span>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
};
