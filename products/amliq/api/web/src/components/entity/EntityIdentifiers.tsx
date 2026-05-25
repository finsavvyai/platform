import React from 'react';

interface Identifier {
  type: string;
  value: string;
  country: string;
}

interface Props {
  identifiers: Identifier[];
  nationalities: string[];
  dateOfBirth?: string;
  birthPlace?: string;
  birthCountry?: string;
  gender?: string;
}

const idLabel: Record<string, string> = {
  passport: 'Passport',
  national_id: 'National ID',
  tax_id: 'Tax ID',
  registration: 'Registration',
  imo_number: 'IMO Number',
  mmsi: 'MMSI',
};

export const EntityIdentifiers: React.FC<Props> = ({
  identifiers, nationalities, dateOfBirth,
  birthPlace, birthCountry, gender,
}) => (
  <div className="bg-white rounded-xl border border-gray-200 p-6">
    <h2 className="text-lg font-semibold text-gray-900 mb-4">Identifiers & Bio</h2>
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
      {dateOfBirth && <Field label="Date of Birth" value={dateOfBirth} />}
      {gender && <Field label="Gender" value={gender} />}
      {birthPlace && <Field label="Birth Place" value={birthPlace} />}
      {birthCountry && <Field label="Birth Country" value={birthCountry} />}
      {nationalities.length > 0 && (
        <Field label="Nationalities" value={nationalities.join(', ')} />
      )}
    </dl>
    {identifiers.length > 0 && (
      <div className="mt-4 border-t pt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Documents</h3>
        <ul className="space-y-2">
          {identifiers.map((id, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-600">
                {idLabel[id.type] ?? id.type}
              </span>
              <span className="text-gray-900">{id.value}</span>
              {id.country && (
                <span className="text-gray-400">({id.country})</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <dt className="text-gray-500">{label}</dt>
    <dd className="font-medium text-gray-900 mt-0.5">{value}</dd>
  </div>
);
