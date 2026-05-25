import React from 'react';
import clsx from 'clsx';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!disabled) onChange(!checked);
    }
  };

  return (
    <label className="flex items-center gap-md cursor-pointer">
      <div
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled}
        aria-label={label}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && onChange(!checked)}
        onKeyDown={handleKeyDown}
        className={clsx(
          'relative inline-flex h-8 w-14 items-center rounded-full transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A96E]',
          checked ? 'bg-apple-green' : 'bg-apple-bg-tertiary',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span
          className={clsx(
            'inline-block h-7 w-7 transform rounded-full bg-white transition-transform',
            checked ? 'translate-x-7' : 'translate-x-0.5'
          )}
        />
      </div>
      {label && <span className="sf-body">{label}</span>}
    </label>
  );
}
