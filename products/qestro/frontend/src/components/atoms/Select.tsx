import React from 'react';
import clsx from 'clsx';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  error?: string;
  id?: string;
  className?: string;
}

const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  label,
  error,
  id,
  className,
}) => {
  const selectId = id || `select-${label?.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      {label && (
        <label
          htmlFor={selectId}
          className="text-sm font-medium"
          style={{ color: 'var(--text-secondary, #9ca3af)' }}
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `${selectId}-error` : undefined}
        className={clsx(
          'h-11 px-3 rounded-xl text-sm transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-purple-500/50',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'ring-2 ring-red-500/50',
        )}
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: value ? 'var(--text-primary, #fff)' : 'var(--text-muted, #6b7280)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && (
        <span id={`${selectId}-error`} className="text-xs text-red-400" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

export default Select;
