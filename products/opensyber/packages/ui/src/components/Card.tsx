import { type ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
}

export function Card({ children, className, title, description }: CardProps) {
  return (
    <div
      className={twMerge(
        'rounded-xl border border-neutral-800 bg-neutral-900/30 p-6',
        className,
      )}
    >
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {description && (
            <p className="text-sm text-neutral-400 mt-1">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
