/**
 * ToolbarIcon — small inline SVG icons for toolbar buttons.
 */

import React from 'react';

export function ToolbarIcon({ name }: { name: string }) {
  const size = 14;
  const style: React.CSSProperties = { width: size, height: size, flexShrink: 0 };

  switch (name) {
  case 'play':
    return (
      <svg style={style} viewBox="0 0 16 16" fill="currentColor">
        <path d="M4 2.5v11l10-5.5L4 2.5z" />
      </svg>
    );
  case 'loading':
    return (
      <svg style={{ ...style, animation: 'spin 1s linear infinite' }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="8" cy="8" r="6" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
      </svg>
    );
  case 'grid':
    return (
      <svg style={style} viewBox="0 0 16 16" fill="currentColor">
        <rect x="1" y="1" width="6" height="6" rx="1" />
        <rect x="9" y="1" width="6" height="6" rx="1" />
        <rect x="1" y="9" width="6" height="6" rx="1" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
      </svg>
    );
  case 'import':
    return (
      <svg style={style} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 1v8M8 9L5 6M8 9l3-3M2 12v2h12v-2" />
      </svg>
    );
  case 'export':
    return (
      <svg style={style} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 10V2M8 2L5 5M8 2l3 3M2 12v2h12v-2" />
      </svg>
    );
  case 'clear':
    return (
      <svg style={style} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M4 4l8 8M12 4L4 12" />
      </svg>
    );
  default:
    return null;
  }
}
