import React from 'react';
import { Section } from './MatchSection';

interface TimestampRowProps {
  firstSeen?: string; lastSeen?: string;
  lastChange?: string; listingDate?: string;
}

const fmtDate = (iso?: string) => {
  if (!iso) return null;
  try { return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  }); } catch { return iso; }
};

export const TimestampRow: React.FC<TimestampRowProps> = ({
  firstSeen, lastSeen, lastChange, listingDate,
}) => {
  const items = [
    { label: 'First Seen', value: fmtDate(firstSeen) },
    { label: 'Last Seen', value: fmtDate(lastSeen) },
    { label: 'Last Change', value: fmtDate(lastChange) },
    { label: 'Listed', value: fmtDate(listingDate) },
  ].filter(i => i.value);
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-600 dark:text-gray-400">
      {items.map(i => (
        <span key={i.label}>
          <span className="text-gray-500 dark:text-gray-400">{i.label}:</span>{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">{i.value}</span>
        </span>
      ))}
    </div>
  );
};

interface BioProps {
  match: {
    date_of_birth?: string; gender?: string;
    birthPlace?: string; birthCountry?: string;
    nationalities?: string[]; position?: string;
    pepTier?: string; schemaType?: string;
  };
}

export const BioSection: React.FC<BioProps> = ({ match }) => {
  const fields = [
    { label: 'Date of Birth', value: match.date_of_birth },
    { label: 'Gender', value: match.gender },
    { label: 'Birth Place', value: match.birthPlace },
    { label: 'Birth Country', value: match.birthCountry?.toUpperCase() },
    { label: 'Nationalities', value: match.nationalities?.join(', ') },
    { label: 'Position', value: match.position },
    { label: 'Schema Type', value: match.schemaType },
  ].filter(f => f.value);
  if (fields.length === 0) return null;

  return (
    <Section title="Biography">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
        {fields.map(f => (
          <div key={f.label}>
            <dt className="text-xs text-gray-500 dark:text-gray-400">{f.label}</dt>
            <dd className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-0.5">
              {f.value}
              {f.label === 'Position' && match.pepTier && (
                <span className="ml-2 px-1.5 py-0.5 bg-amber-50 text-amber-700
                  dark:bg-amber-900/30 dark:text-amber-400 rounded text-xs font-medium">
                  PEP {match.pepTier}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
};
