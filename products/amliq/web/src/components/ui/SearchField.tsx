import React from 'react';
import { Search } from 'lucide-react';

interface SearchFieldProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
}

export function SearchField({
  placeholder = 'Search...',
  value,
  onChange,
  onSubmit,
}: SearchFieldProps) {
  return (
    <div className="relative">
      <Search className="absolute left-md top-1/2 transform -translate-y-1/2 w-4 h-4 text-apple-label-tertiary" aria-hidden="true" />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit?.()}
        className="input-field pl-10 w-full"
      />
    </div>
  );
}
