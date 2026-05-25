import React from 'react';
import { InboxIcon } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-xxl px-lg text-center">
      <div className="mb-lg text-apple-label-tertiary">
        {icon || <InboxIcon className="w-12 h-12 mx-auto" />}
      </div>
      <h3 className="sf-headline mb-sm">{title}</h3>
      {description && <p className="sf-caption mb-lg max-w-xs">{description}</p>}
      {action}
    </div>
  );
}
