import type { IconName } from '../appTypes';

export function Icon({ name }: { name: IconName }) {
  const commonProps = {
    'aria-hidden': true,
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.85,
    viewBox: '0 0 24 24',
  };

  switch (name) {
    case 'backup':
      return (
        <svg {...commonProps}>
          <path d="M12 3v10" />
          <path d="m8 9 4 4 4-4" />
          <path d="M4 15v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3" />
        </svg>
      );
    case 'chevron':
      return (
        <svg {...commonProps}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
    case 'close':
      return (
        <svg {...commonProps}>
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      );
    case 'connections':
      return (
        <svg {...commonProps}>
          <path d="M7 7h10" />
          <path d="M7 17h10" />
          <circle cx="5" cy="7" r="2" />
          <circle cx="19" cy="7" r="2" />
          <circle cx="5" cy="17" r="2" />
          <circle cx="19" cy="17" r="2" />
          <path d="M7 7c3 0 2 10 5 10s2-10 5-10" />
        </svg>
      );
    case 'database':
      return (
        <svg {...commonProps}>
          <ellipse cx="12" cy="5" rx="7" ry="3" />
          <path d="M5 5v6c0 1.66 3.13 3 7 3s7-1.34 7-3V5" />
          <path d="M5 11v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" />
        </svg>
      );
    case 'history':
      return (
        <svg {...commonProps}>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'monitor':
      return (
        <svg {...commonProps}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="m7 15 3-4 3 2 4-7" />
        </svg>
      );
    case 'plug':
      return (
        <svg {...commonProps}>
          <path d="M9 7V3" />
          <path d="M15 7V3" />
          <path d="M7 7h10v5a5 5 0 0 1-10 0Z" />
          <path d="M12 17v4" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...commonProps}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case 'query':
      return (
        <svg {...commonProps}>
          <path d="M8 8h8" />
          <path d="M8 12h5" />
          <path d="m14 17 2 2 4-5" />
          <rect height="16" rx="3" width="16" x="4" y="4" />
        </svg>
      );
    case 'run':
      return (
        <svg {...commonProps}>
          <path d="M8 5v14l11-7Z" />
        </svg>
      );
    case 'search':
      return (
        <svg {...commonProps}>
          <circle cx="11" cy="11" r="7" />
          <path d="m16.5 16.5 3.5 3.5" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...commonProps}>
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05a2 2 0 0 1-2.83 2.83l-.05-.05a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 0 1-4 0v-.07A1.7 1.7 0 0 0 8.97 19.4a1.7 1.7 0 0 0-1.88.34l-.05.05a2 2 0 0 1-2.83-2.83l.05-.05A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 0 1 0-4h.07A1.7 1.7 0 0 0 4.6 8.97a1.7 1.7 0 0 0-.34-1.88l-.05-.05a2 2 0 0 1 2.83-2.83l.05.05A1.7 1.7 0 0 0 8.97 4.6 1.7 1.7 0 0 0 10 3.07V3a2 2 0 0 1 4 0v.07a1.7 1.7 0 0 0 1.03 1.53 1.7 1.7 0 0 0 1.88-.34l.05-.05a2 2 0 0 1 2.83 2.83l-.05.05a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 0 1 0 4h-.07A1.7 1.7 0 0 0 19.4 15Z" />
        </svg>
      );
    case 'spark':
      return (
        <svg {...commonProps}>
          <path d="M13 3 8 14h4l-1 7 5-11h-4l1-7Z" />
        </svg>
      );
    case 'table':
      return (
        <svg {...commonProps}>
          <rect height="16" rx="2" width="16" x="4" y="4" />
          <path d="M4 10h16" />
          <path d="M4 16h16" />
          <path d="M10 4v16" />
          <path d="M16 4v16" />
        </svg>
      );
  }
}
