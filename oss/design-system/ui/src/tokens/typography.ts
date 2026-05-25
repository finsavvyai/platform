export const typography = {
  fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
  heading1: {
    fontSize: '32px',
    fontWeight: 700,
    lineHeight: '1.2',
  },
  heading2: {
    fontSize: '28px',
    fontWeight: 700,
    lineHeight: '1.3',
  },
  heading3: {
    fontSize: '24px',
    fontWeight: 600,
    lineHeight: '1.3',
  },
  heading4: {
    fontSize: '20px',
    fontWeight: 600,
    lineHeight: '1.4',
  },
  heading5: {
    fontSize: '18px',
    fontWeight: 600,
    lineHeight: '1.4',
  },
  heading6: {
    fontSize: '16px',
    fontWeight: 600,
    lineHeight: '1.5',
  },
  body: {
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: '1.5',
  },
  bodySmall: {
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: '1.43',
  },
  caption: {
    fontSize: '12px',
    fontWeight: 500,
    lineHeight: '1.33',
  },
};

export type TypographyKey = keyof typeof typography;
