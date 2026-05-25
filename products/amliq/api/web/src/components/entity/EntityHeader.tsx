import React from 'react';

interface EntityHeaderProps {
  primaryName: string;
  entityType: string;
  listId: string;
  dataset?: string;
  schemaType?: string;
  lastSeen?: string;
  firstSeen?: string;
}

const typeBadge: Record<string, string> = {
  individual: 'bg-blue-100 text-blue-800',
  company: 'bg-purple-100 text-purple-800',
  vessel: 'bg-teal-100 text-teal-800',
  aircraft: 'bg-orange-100 text-orange-800',
};

export const EntityHeader: React.FC<EntityHeaderProps> = ({
  primaryName, entityType, listId, dataset,
  schemaType, lastSeen, firstSeen,
}) => {
  const badge = typeBadge[entityType] ?? 'bg-gray-100 text-gray-800';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{primaryName}</h1>
          <div className="mt-2 flex items-center gap-3">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${badge}`}>
              {entityType}
            </span>
            <span className="text-sm text-gray-500">{listId}</span>
            {dataset && <span className="text-sm text-gray-400">• {dataset}</span>}
          </div>
        </div>
        {schemaType && (
          <span className="text-xs bg-gray-50 px-2 py-1 rounded text-gray-500">
            {schemaType}
          </span>
        )}
      </div>
      {(firstSeen || lastSeen) && (
        <div className="mt-4 flex gap-6 text-sm text-gray-500">
          {firstSeen && <span>First seen: {new Date(firstSeen).toLocaleDateString()}</span>}
          {lastSeen && <span>Last seen: {new Date(lastSeen).toLocaleDateString()}</span>}
        </div>
      )}
    </div>
  );
};
