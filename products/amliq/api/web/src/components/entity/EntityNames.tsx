import React from 'react';

interface Name {
  full: string;
  given: string;
  family: string;
  original_script: string;
}

interface Props {
  names: Name[];
  position?: string;
  pepTier?: string;
}

export const EntityNames: React.FC<Props> = ({ names, position, pepTier }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-6">
    <h2 className="text-lg font-semibold text-gray-900 mb-4">Names & Aliases</h2>
    {(position || pepTier) && (
      <div className="mb-4 flex gap-3 text-sm">
        {position && (
          <span className="text-gray-700">
            <span className="text-gray-500">Position:</span> {position}
          </span>
        )}
        {pepTier && (
          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium">
            PEP {pepTier}
          </span>
        )}
      </div>
    )}
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500 border-b">
          <th className="pb-2 font-medium">Full Name</th>
          <th className="pb-2 font-medium">Given</th>
          <th className="pb-2 font-medium">Family</th>
          <th className="pb-2 font-medium">Script</th>
        </tr>
      </thead>
      <tbody>
        {names.map((n, i) => (
          <tr key={i} className="border-b border-gray-50">
            <td className="py-2 text-gray-900 font-medium">{n.full}</td>
            <td className="py-2 text-gray-600">{n.given || '—'}</td>
            <td className="py-2 text-gray-600">{n.family || '—'}</td>
            <td className="py-2 text-gray-400">{n.original_script || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
