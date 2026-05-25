export const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
} as const;

export type SpacingKey = keyof typeof spacing;

export const spacingValue = (key: SpacingKey | number): string => {
  if (typeof key === 'number' && key in spacing) {
    return spacing[key as SpacingKey];
  }
  return '0px';
};
