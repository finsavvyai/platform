'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';

interface MarketplaceSearchProps {
  onSearch: (query: string) => void;
}

export function MarketplaceSearch({ onSearch }: MarketplaceSearchProps) {
  const [query, setQuery] = useState('');

  function handleChange(value: string) {
    setQuery(value);
    onSearch(value);
  }

  return (
    <div className="relative mb-6">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search skills by name or description..."
        className="w-full rounded-xl border border-neutral-800 bg-neutral-900/50 py-3 pl-10 pr-4 text-sm text-white placeholder:text-neutral-500 focus:border-signal focus:outline-none transition"
      />
    </div>
  );
}
