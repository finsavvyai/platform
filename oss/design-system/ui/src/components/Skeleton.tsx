import React from 'react';
import { colors } from '../tokens/colors';
import { useTheme } from '../theme/useTheme';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
}

const pulseKeyframes = `
  @keyframes pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
`;

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '16px',
  circle = false,
}) => {
  const { theme } = useTheme();
  const colorScheme = colors[theme];

  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    backgroundColor:
      theme === 'light' ? colorScheme.gray1 : colorScheme.gray2,
    borderRadius: circle ? '50%' : '8px',
    animation: 'pulse 1.5s ease-in-out infinite',
  };

  return (
    <>
      <style>{pulseKeyframes}</style>
      <div style={style} />
    </>
  );
};

Skeleton.displayName = 'Skeleton';
