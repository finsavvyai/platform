import React from 'react';

interface Props {
  extendedData?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  lastChange?: string;
}

export const EntityExtended: React.FC<Props> = ({
  extendedData, extra, lastChange,
}) => {
  const hasData = extendedData || extra || lastChange;
  if (!hasData) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Extended Data</h2>
      {lastChange && (
        <p className="text-sm text-gray-500 mb-3">
          Last change: {new Date(lastChange).toLocaleString()}
        </p>
      )}
      {extendedData && Object.keys(extendedData).length > 0 && (
        <div className="mb-4">
          <pre className="bg-gray-50 rounded p-4 text-xs text-gray-700 overflow-x-auto max-h-64">
            {JSON.stringify(extendedData, null, 2)}
          </pre>
        </div>
      )}
      {extra && Object.keys(extra).length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-600 mb-2">Additional Fields</h3>
          <pre className="bg-gray-50 rounded p-4 text-xs text-gray-700 overflow-x-auto max-h-64">
            {JSON.stringify(extra, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
