import React from 'react';
import clsx from 'clsx';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  id,
  className,
}) => {
  const checkboxId = id || `checkbox-${label?.toLowerCase().replace(/\s+/g, '-') || 'default'}`;

  return (
    <label
      htmlFor={checkboxId}
      className={clsx(
        'inline-flex items-center gap-3 min-h-[44px] cursor-pointer select-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      <input
        id={checkboxId}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        aria-label={label}
        className={clsx(
          'h-5 w-5 rounded border-2 transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:ring-offset-0',
          'cursor-pointer disabled:cursor-not-allowed',
        )}
        style={{ accentColor: '#7c3aed' }}
      />
      {label && (
        <span
          className="text-sm"
          style={{ color: 'var(--text-primary, #e5e7eb)' }}
        >
          {label}
        </span>
      )}
    </label>
  );
};

export default Checkbox;
