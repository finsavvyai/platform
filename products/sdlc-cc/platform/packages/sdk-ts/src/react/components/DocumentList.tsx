// Document List Component for React

import { useDocuments } from '../hooks/useDocuments';
import type { Document } from '../../types';

interface DocumentListProps {
  onSelect?: (document: Document) => void;
  className?: string;
}

export function DocumentList({ onSelect, className = '' }: DocumentListProps) {
  const { documents, isLoading, error } = useDocuments({ autoLoad: true });

  if (isLoading) {
    return <div className={className}>Loading documents...</div>;
  }

  if (error) {
    return <div className={className}>Error: {error.message}</div>;
  }

  return (
    <div className={className}>
      {documents.map((doc: Document) => (
        <div
          key={doc.id}
          className="p-3 border-b cursor-pointer hover:bg-gray-50"
          onClick={() => onSelect?.(doc)}
        >
          <p className="font-medium">{doc.name}</p>
          <p className="text-sm text-gray-500">{doc.type}</p>
        </div>
      ))}
    </div>
  );
}
