import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import clsx from 'clsx';

interface SearchInputProps {
  placeholder?: string;
  value?: string;
  onChange: (value: string) => void;
  className?: string;
  debounceMs?: number;
}

const SearchInput: React.FC<SearchInputProps> = ({
  placeholder = 'Search...',
  value: externalValue,
  onChange,
  className,
  debounceMs = 300,
}) => {
  const [internal, setInternal] = useState(externalValue || '');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (externalValue !== undefined) {
      const timer = setTimeout(() => {
        setInternal(externalValue);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [externalValue]);

  const handleChange = (val: string) => {
    setInternal(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(val), debounceMs);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className={clsx('relative', className)}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-4 w-4" style={{ color: 'var(--text-muted, #6b7280)' }} />
      </div>
      <input
        type="text"
        value={internal}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={clsx(
          'w-full h-11 pl-10 pr-4 rounded-xl text-sm transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-purple-500/50',
        )}
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: 'var(--text-primary, #fff)',
          backdropFilter: 'blur(12px)',
        }}
      />
    </div>
  );
};

export default SearchInput;
