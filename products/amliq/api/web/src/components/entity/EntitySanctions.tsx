import React from 'react';

interface SanctionEntry {
  authority?: string;
  program?: string;
  reason?: string;
  start_date?: string;
  end_date?: string;
}

interface Props {
  sanctions?: SanctionEntry[];
  programs?: string[];
  listingDate?: string;
  remarks?: string;
  sourceUrl?: string;
}

export const EntitySanctions: React.FC<Props> = ({
  sanctions, programs, listingDate, remarks, sourceUrl,
}) => {
  const hasSanctions = (sanctions && sanctions.length > 0) || (programs && programs.length > 0);
  if (!hasSanctions && !listingDate && !remarks && !sourceUrl) return null;

  return (
    <div className="bg-white rounded-xl border border-red-100 p-6">
      <h2 className="text-lg font-semibold text-red-900 mb-4">Sanctions & Programs</h2>
      {listingDate && (
        <p className="text-sm text-gray-600 mb-3">
          Listed: <span className="font-medium">{listingDate}</span>
        </p>
      )}
      {programs && programs.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {programs.map((p, i) => (
            <span key={i} className="px-2.5 py-1 bg-red-50 text-red-700 rounded text-xs font-medium">
              {p}
            </span>
          ))}
        </div>
      )}
      {sanctions && sanctions.length > 0 && (
        <div className="space-y-3">
          {sanctions.map((s, i) => (
            <div key={i} className="border-l-2 border-red-300 pl-3 text-sm">
              {s.authority && <p className="font-medium text-gray-900">{s.authority}</p>}
              {s.program && <p className="text-gray-600">{s.program}</p>}
              {s.reason && <p className="text-gray-500 mt-1">{s.reason}</p>}
              {s.start_date && (
                <p className="text-gray-400 text-xs mt-1">
                  {s.start_date}{s.end_date ? ` → ${s.end_date}` : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {remarks && (
        <p className="mt-4 text-sm text-gray-600 bg-gray-50 p-3 rounded">{remarks}</p>
      )}
      {sourceUrl && (
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
          className="mt-3 inline-block text-sm text-blue-600 hover:underline">
          View source →
        </a>
      )}
    </div>
  );
};
