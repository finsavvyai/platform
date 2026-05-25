import React from 'react';
import clsx from 'clsx';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const sizes = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  return (
    <div
      className={clsx(
        'rounded-full flex items-center justify-center font-semibold',
        sizes[size],
        className
      )}
      style={{ background: '#C9A96E', color: '#1A1814', border: '1.5px solid rgba(201,169,110,0.6)', fontWeight: 700 }}
    >
      {initials}
    </div>
  );
}
