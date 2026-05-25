import React from 'react';
import { User, Building2, Ship, Plane, FileText } from 'lucide-react';

const typeColors: Record<string, string> = {
  Individual: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Company: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Vessel: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  Aircraft: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Individual: User, Company: Building2, Vessel: Ship, Aircraft: Plane,
};

export const TypeBadge: React.FC<{ type?: string }> = ({ type }) => {
  const t = type ?? 'Individual';
  const color = typeColors[t] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  const Icon = typeIcons[t] ?? FileText;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full
      text-xs font-medium ${color}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {t}
    </span>
  );
};

const listColors: Record<string, string> = {
  OFAC: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  EU: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  UN: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  UKOFSI: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

export const ListBadge: React.FC<{ listId: string }> = ({ listId }) => {
  const upper = listId.toUpperCase();
  let color = 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  for (const [prefix, c] of Object.entries(listColors)) {
    if (upper.startsWith(prefix)) { color = c; break; }
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {listId}
    </span>
  );
};
