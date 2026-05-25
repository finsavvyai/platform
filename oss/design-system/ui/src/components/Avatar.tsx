import React from 'react';
import { colors } from '../tokens/colors';
import { useTheme } from '../theme/useTheme';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  src?: string;
  initials?: string;
  alt?: string;
  size?: AvatarSize;
}

const sizeMap: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 56,
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  initials = 'AV',
  alt = 'Avatar',
  size = 'md',
}) => {
  const { theme } = useTheme();
  const colorScheme = colors[theme];
  const dimension = sizeMap[size];

  const containerStyle: React.CSSProperties = {
    width: `${dimension}px`,
    height: `${dimension}px`,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colorScheme.primary,
    color: '#FFFFFF',
    fontWeight: 600,
    fontSize: `${dimension * 0.4}px`,
    fontFamily: 'SF Pro Display, -apple-system, sans-serif',
  };

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        style={containerStyle}
      />
    );
  }

  return <div style={containerStyle}>{initials}</div>;
};

Avatar.displayName = 'Avatar';
