import React from 'react';
import clsx from 'clsx';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
};

function getInitials(name?: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name[0].toUpperCase();
}

const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  className,
}) => {
  const initials = getInitials(name);

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        className={clsx(
          'rounded-full object-cover flex-shrink-0',
          sizeMap[size],
          className,
        )}
      />
    );
  }

  return (
    <div
      className={clsx(
        'rounded-full flex items-center justify-center flex-shrink-0 font-semibold',
        sizeMap[size],
        className,
      )}
      style={{
        background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
        color: '#ffffff',
      }}
      role="img"
      aria-label={name || 'Avatar'}
    >
      {initials}
    </div>
  );
};

export default Avatar;
