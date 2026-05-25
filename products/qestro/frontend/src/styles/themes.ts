/**
 * Qestro Multi-Theme System
 * Supports multiple professional themes including TestQuality-inspired dark theme
 */

export interface Theme {
  name: string;
  id: string;
  colors: {
    // Brand Colors
    brandPrimary: string;
    brandPrimaryHover: string;
    brandPrimaryLight: string;
    brandAccent: string;

    // Background Colors
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
    bgHover: string;
    bgSidebar: string;
    bgSidebarHover: string;

    // Text Colors
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textInverse: string;

    // Status Colors
    statusSuccess: string;
    statusError: string;
    statusWarning: string;
    statusInfo: string;
    statusPending: string;

    // Border Colors
    borderColor: string;
    borderLight: string;
    borderSecondary: string;
    borderFocus: string;
  };
}

export const themes: Record<string, Theme> = {
  // TestQuality Dark Theme (Current Default)
  testQualityDark: {
    name: 'TestQuality Dark',
    id: 'testQualityDark',
    colors: {
      brandPrimary: '#4f46e5',
      brandPrimaryHover: '#4338ca',
      brandPrimaryLight: '#818cf8',
      brandAccent: '#7c3aed',

      bgPrimary: '#0f172a',      // slate-900
      bgSecondary: '#1e293b',    // slate-800
      bgTertiary: '#334155',     // slate-700
      bgHover: '#475569',        // slate-600
      bgSidebar: '#0a0f1e',      // darker slate
      bgSidebarHover: '#1e293b', // slate-800

      textPrimary: '#f8fafc',    // slate-50
      textSecondary: '#cbd5e1',  // slate-300
      textMuted: '#94a3b8',      // slate-400
      textInverse: '#0f172a',    // slate-900

      statusSuccess: '#10b981',  // emerald-500
      statusError: '#ef4444',    // red-500
      statusWarning: '#f59e0b',  // amber-500
      statusInfo: '#3b82f6',     // blue-500
      statusPending: '#8b5cf6',  // purple-600

      borderColor: '#334155',    // slate-700
      borderLight: '#475569',    // slate-600
      borderSecondary: '#475569', // slate-600
      borderFocus: '#4f46e5',    // indigo-600
    },
  },

  // Light Professional Theme
  professionalLight: {
    name: 'Professional Light',
    id: 'professionalLight',
    colors: {
      brandPrimary: '#4f46e5',
      brandPrimaryHover: '#4338ca',
      brandPrimaryLight: '#eef2ff',
      brandAccent: '#7c3aed',

      bgPrimary: '#ffffff',
      bgSecondary: '#f8fafc',    // slate-50
      bgTertiary: '#f1f5f9',     // slate-100
      bgHover: '#e2e8f0',        // slate-200
      bgSidebar: '#0f172a',      // slate-900 (dark sidebar)
      bgSidebarHover: '#1e293b', // slate-800

      textPrimary: '#0f172a',    // slate-900
      textSecondary: '#475569',  // slate-600
      textMuted: '#94a3b8',      // slate-400
      textInverse: '#ffffff',

      statusSuccess: '#10b981',
      statusError: '#ef4444',
      statusWarning: '#f59e0b',
      statusInfo: '#3b82f6',
      statusPending: '#8b5cf6',

      borderColor: '#e2e8f0',    // slate-200
      borderLight: '#f1f5f9',    // slate-100
      borderSecondary: '#cbd5e1', // slate-300
      borderFocus: '#4f46e5',
    },
  },

  // Blue Ocean Theme
  blueOcean: {
    name: 'Blue Ocean',
    id: 'blueOcean',
    colors: {
      brandPrimary: '#0ea5e9',   // sky-500
      brandPrimaryHover: '#0284c7', // sky-600
      brandPrimaryLight: '#7dd3fc', // sky-300
      brandAccent: '#06b6d4',    // cyan-500

      bgPrimary: '#0c4a6e',      // sky-900
      bgSecondary: '#075985',    // sky-800
      bgTertiary: '#0369a1',     // sky-700
      bgHover: '#0284c7',        // sky-600
      bgSidebar: '#082f49',      // sky-950
      bgSidebarHover: '#075985', // sky-800

      textPrimary: '#f0f9ff',    // sky-50
      textSecondary: '#bae6fd',  // sky-200
      textMuted: '#7dd3fc',      // sky-300
      textInverse: '#0c4a6e',

      statusSuccess: '#10b981',
      statusError: '#ef4444',
      statusWarning: '#f59e0b',
      statusInfo: '#38bdf8',     // sky-400
      statusPending: '#a78bfa',

      borderColor: '#0369a1',    // sky-700
      borderLight: '#0284c7',    // sky-600
      borderSecondary: '#0284c7',
      borderFocus: '#0ea5e9',
    },
  },

  // Emerald Green Theme
  emeraldGreen: {
    name: 'Emerald Green',
    id: 'emeraldGreen',
    colors: {
      brandPrimary: '#10b981',   // emerald-500
      brandPrimaryHover: '#059669', // emerald-600
      brandPrimaryLight: '#6ee7b7', // emerald-300
      brandAccent: '#14b8a6',    // teal-500

      bgPrimary: '#064e3b',      // emerald-900
      bgSecondary: '#065f46',    // emerald-800
      bgTertiary: '#047857',     // emerald-700
      bgHover: '#059669',        // emerald-600
      bgSidebar: '#022c22',      // emerald-950
      bgSidebarHover: '#065f46', // emerald-800

      textPrimary: '#ecfdf5',    // emerald-50
      textSecondary: '#a7f3d0',  // emerald-200
      textMuted: '#6ee7b7',      // emerald-300
      textInverse: '#064e3b',

      statusSuccess: '#10b981',
      statusError: '#ef4444',
      statusWarning: '#f59e0b',
      statusInfo: '#3b82f6',
      statusPending: '#8b5cf6',

      borderColor: '#047857',    // emerald-700
      borderLight: '#059669',    // emerald-600
      borderSecondary: '#059669',
      borderFocus: '#10b981',
    },
  },

  // Purple Haze Theme
  purpleHaze: {
    name: 'Purple Haze',
    id: 'purpleHaze',
    colors: {
      brandPrimary: '#a855f7',   // purple-500
      brandPrimaryHover: '#9333ea', // purple-600
      brandPrimaryLight: '#c084fc', // purple-400
      brandAccent: '#d946ef',    // fuchsia-500

      bgPrimary: '#581c87',      // purple-900
      bgSecondary: '#6b21a8',    // purple-800
      bgTertiary: '#7e22ce',     // purple-700
      bgHover: '#9333ea',        // purple-600
      bgSidebar: '#3b0764',      // purple-950
      bgSidebarHover: '#6b21a8', // purple-800

      textPrimary: '#faf5ff',    // purple-50
      textSecondary: '#e9d5ff',  // purple-200
      textMuted: '#d8b4fe',      // purple-300
      textInverse: '#581c87',

      statusSuccess: '#10b981',
      statusError: '#ef4444',
      statusWarning: '#f59e0b',
      statusInfo: '#3b82f6',
      statusPending: '#a855f7',

      borderColor: '#7e22ce',    // purple-700
      borderLight: '#9333ea',    // purple-600
      borderSecondary: '#9333ea',
      borderFocus: '#a855f7',
    },
  },

  // Rose Pink Theme
  rosePink: {
    name: 'Rose Pink',
    id: 'rosePink',
    colors: {
      brandPrimary: '#f43f5e',   // rose-500
      brandPrimaryHover: '#e11d48', // rose-600
      brandPrimaryLight: '#fb7185', // rose-400
      brandAccent: '#ec4899',    // pink-500

      bgPrimary: '#881337',      // rose-900
      bgSecondary: '#9f1239',    // rose-800
      bgTertiary: '#be123c',     // rose-700
      bgHover: '#e11d48',        // rose-600
      bgSidebar: '#4c0519',      // rose-950
      bgSidebarHover: '#9f1239', // rose-800

      textPrimary: '#fff1f2',    // rose-50
      textSecondary: '#fecdd3',  // rose-200
      textMuted: '#fda4af',      // rose-300
      textInverse: '#881337',

      statusSuccess: '#10b981',
      statusError: '#ef4444',
      statusWarning: '#f59e0b',
      statusInfo: '#3b82f6',
      statusPending: '#ec4899',

      borderColor: '#be123c',    // rose-700
      borderLight: '#e11d48',    // rose-600
      borderSecondary: '#e11d48',
      borderFocus: '#f43f5e',
    },
  },

  // Amber Sunset Theme
  amberSunset: {
    name: 'Amber Sunset',
    id: 'amberSunset',
    colors: {
      brandPrimary: '#f59e0b',   // amber-500
      brandPrimaryHover: '#d97706', // amber-600
      brandPrimaryLight: '#fbbf24', // amber-400
      brandAccent: '#f97316',    // orange-500

      bgPrimary: '#78350f',      // amber-900
      bgSecondary: '#92400e',    // amber-800
      bgTertiary: '#b45309',     // amber-700
      bgHover: '#d97706',        // amber-600
      bgSidebar: '#451a03',      // amber-950
      bgSidebarHover: '#92400e', // amber-800

      textPrimary: '#fffbeb',    // amber-50
      textSecondary: '#fde68a',  // amber-200
      textMuted: '#fcd34d',      // amber-300
      textInverse: '#78350f',

      statusSuccess: '#10b981',
      statusError: '#ef4444',
      statusWarning: '#f59e0b',
      statusInfo: '#3b82f6',
      statusPending: '#8b5cf6',

      borderColor: '#b45309',    // amber-700
      borderLight: '#d97706',    // amber-600
      borderSecondary: '#d97706',
      borderFocus: '#f59e0b',
    },
  },

  // High Contrast Dark
  highContrastDark: {
    name: 'High Contrast Dark',
    id: 'highContrastDark',
    colors: {
      brandPrimary: '#60a5fa',   // blue-400
      brandPrimaryHover: '#3b82f6', // blue-500
      brandPrimaryLight: '#93c5fd', // blue-300
      brandAccent: '#a78bfa',    // violet-400

      bgPrimary: '#000000',      // pure black
      bgSecondary: '#171717',    // neutral-900
      bgTertiary: '#262626',     // neutral-800
      bgHover: '#404040',        // neutral-700
      bgSidebar: '#000000',
      bgSidebarHover: '#171717',

      textPrimary: '#ffffff',    // pure white
      textSecondary: '#e5e5e5',  // neutral-200
      textMuted: '#a3a3a3',      // neutral-400
      textInverse: '#000000',

      statusSuccess: '#22c55e',  // green-500
      statusError: '#ef4444',    // red-500
      statusWarning: '#eab308',  // yellow-500
      statusInfo: '#60a5fa',     // blue-400
      statusPending: '#a78bfa',  // violet-400

      borderColor: '#404040',    // neutral-700
      borderLight: '#525252',    // neutral-600
      borderSecondary: '#525252',
      borderFocus: '#60a5fa',
    },
  },

  // Apple HIG-Inspired Themes

  // iOS System Blue (Apple HIG)
  appleSystemBlue: {
    name: 'Apple System Blue',
    id: 'appleSystemBlue',
    colors: {
      brandPrimary: '#007AFF',   // iOS system blue
      brandPrimaryHover: '#0051D5',
      brandPrimaryLight: '#5AC8FA', // iOS light blue
      brandAccent: '#5856D6',    // iOS purple

      bgPrimary: '#000000',      // iOS dark mode background
      bgSecondary: '#1C1C1E',    // iOS elevated background
      bgTertiary: '#2C2C2E',     // iOS grouped background
      bgHover: '#3A3A3C',        // iOS tertiary background
      bgSidebar: '#000000',
      bgSidebarHover: '#1C1C1E',

      textPrimary: '#FFFFFF',    // iOS primary label
      textSecondary: '#EBEBF5',  // iOS secondary label (60% opacity)
      textMuted: '#EBEBF599',    // iOS tertiary label (30% opacity)
      textInverse: '#000000',

      statusSuccess: '#34C759',  // iOS green
      statusError: '#FF3B30',    // iOS red
      statusWarning: '#FF9500',  // iOS orange
      statusInfo: '#007AFF',     // iOS blue
      statusPending: '#AF52DE',  // iOS purple

      borderColor: '#38383A',    // iOS separator
      borderLight: '#48484A',
      borderSecondary: '#48484A',
      borderFocus: '#007AFF',
    },
  },

  // macOS Graphite (Apple HIG)
  macOSGraphite: {
    name: 'macOS Graphite',
    id: 'macOSGraphite',
    colors: {
      brandPrimary: '#8E8E93',   // macOS accent (graphite)
      brandPrimaryHover: '#636366',
      brandPrimaryLight: '#AEAEB2',
      brandAccent: '#007AFF',    // macOS blue accent

      bgPrimary: '#1E1E1E',      // macOS dark background
      bgSecondary: '#252525',    // macOS window background
      bgTertiary: '#2D2D2D',
      bgHover: '#3A3A3A',
      bgSidebar: '#191919',      // macOS sidebar
      bgSidebarHover: '#252525',

      textPrimary: '#FFFFFF',
      textSecondary: '#D1D1D6',  // macOS secondary text
      textMuted: '#8E8E93',      // macOS tertiary text
      textInverse: '#1E1E1E',

      statusSuccess: '#32D74B',  // macOS green
      statusError: '#FF453A',    // macOS red
      statusWarning: '#FF9F0A',  // macOS orange
      statusInfo: '#0A84FF',     // macOS blue
      statusPending: '#BF5AF2',  // macOS purple

      borderColor: '#383838',
      borderLight: '#484848',
      borderSecondary: '#484848',
      borderFocus: '#007AFF',
    },
  },

  // Apple Mint (Fresh & Modern HIG)
  appleMint: {
    name: 'Apple Mint',
    id: 'appleMint',
    colors: {
      brandPrimary: '#00C7BE',   // iOS mint
      brandPrimaryHover: '#00A9A1',
      brandPrimaryLight: '#63E6E2',
      brandAccent: '#30D158',    // iOS green

      bgPrimary: '#0A1F1E',
      bgSecondary: '#0F2726',
      bgTertiary: '#143634',
      bgHover: '#1A4442',
      bgSidebar: '#061615',
      bgSidebarHover: '#0F2726',

      textPrimary: '#FFFFFF',
      textSecondary: '#D1F5F3',
      textMuted: '#8ED9D6',
      textInverse: '#0A1F1E',

      statusSuccess: '#30D158',
      statusError: '#FF453A',
      statusWarning: '#FFD60A',
      statusInfo: '#64D2FF',
      statusPending: '#BF5AF2',

      borderColor: '#1A4442',
      borderLight: '#235856',
      borderSecondary: '#235856',
      borderFocus: '#00C7BE',
    },
  },

  // Apple Indigo Night (Deep & Sophisticated HIG)
  appleIndigoNight: {
    name: 'Apple Indigo Night',
    id: 'appleIndigoNight',
    colors: {
      brandPrimary: '#5E5CE6',   // iOS indigo
      brandPrimaryHover: '#4C4AD6',
      brandPrimaryLight: '#7D7AFF',
      brandAccent: '#BF5AF2',    // iOS purple

      bgPrimary: '#0F0E1C',
      bgSecondary: '#1A1827',
      bgTertiary: '#252338',
      bgHover: '#312E49',
      bgSidebar: '#0A0914',
      bgSidebarHover: '#1A1827',

      textPrimary: '#FFFFFF',
      textSecondary: '#E5E4FF',
      textMuted: '#B3B0FF',
      textInverse: '#0F0E1C',

      statusSuccess: '#32D74B',
      statusError: '#FF453A',
      statusWarning: '#FFD60A',
      statusInfo: '#64D2FF',
      statusPending: '#BF5AF2',

      borderColor: '#312E49',
      borderLight: '#3D3A5A',
      borderSecondary: '#3D3A5A',
      borderFocus: '#5E5CE6',
    },
  },

  // Apple Teal Professional (HIG Medical/Science)
  appleTealPro: {
    name: 'Apple Teal Pro',
    id: 'appleTealPro',
    colors: {
      brandPrimary: '#5AC8FA',   // iOS teal
      brandPrimaryHover: '#48A8D0',
      brandPrimaryLight: '#6FD4FF',
      brandAccent: '#40C8E0',

      bgPrimary: '#0C1821',
      bgSecondary: '#132530',
      bgTertiary: '#1A333F',
      bgHover: '#21414E',
      bgSidebar: '#070E14',
      bgSidebarHover: '#132530',

      textPrimary: '#FFFFFF',
      textSecondary: '#D1EFFF',
      textMuted: '#8DD4F0',
      textInverse: '#0C1821',

      statusSuccess: '#32D74B',
      statusError: '#FF453A',
      statusWarning: '#FFD60A',
      statusInfo: '#5AC8FA',
      statusPending: '#BF5AF2',

      borderColor: '#21414E',
      borderLight: '#2A525D',
      borderSecondary: '#2A525D',
      borderFocus: '#5AC8FA',
    },
  },

  // Apple Orange Warm (HIG Creative/Media)
  appleOrangeWarm: {
    name: 'Apple Orange Warm',
    id: 'appleOrangeWarm',
    colors: {
      brandPrimary: '#FF9500',   // iOS orange
      brandPrimaryHover: '#D97C00',
      brandPrimaryLight: '#FFB340',
      brandAccent: '#FF3B30',    // iOS red

      bgPrimary: '#1C1308',
      bgSecondary: '#2A1E0F',
      bgTertiary: '#382916',
      bgHover: '#46341D',
      bgSidebar: '#120D05',
      bgSidebarHover: '#2A1E0F',

      textPrimary: '#FFFFFF',
      textSecondary: '#FFE4CC',
      textMuted: '#FFCF99',
      textInverse: '#1C1308',

      statusSuccess: '#32D74B',
      statusError: '#FF453A',
      statusWarning: '#FF9500',
      statusInfo: '#64D2FF',
      statusPending: '#BF5AF2',

      borderColor: '#46341D',
      borderLight: '#544024',
      borderSecondary: '#544024',
      borderFocus: '#FF9500',
    },
  },

  // Floating Liquid Gradient Themes - Apple HIG Inspired

  // Aurora Dream (Liquid Pink-Purple-Blue)
  auroraDream: {
    name: 'Aurora Dream',
    id: 'auroraDream',
    colors: {
      brandPrimary: '#E879F9',   // fuchsia-400
      brandPrimaryHover: '#D946EF', // fuchsia-500
      brandPrimaryLight: '#F0ABFC', // fuchsia-300
      brandAccent: '#A78BFA',    // violet-400

      bgPrimary: '#0A0118',      // deep purple-black
      bgSecondary: '#1A0B2E',    // purple-900 variant
      bgTertiary: '#2D1B4E',     // lighter purple
      bgHover: '#3D2B5E',
      bgSidebar: '#050008',
      bgSidebarHover: '#1A0B2E',

      textPrimary: '#FFFFFF',
      textSecondary: '#F0ABFC',  // fuchsia-300
      textMuted: '#C084FC',      // purple-400
      textInverse: '#0A0118',

      statusSuccess: '#34D399',  // emerald-400
      statusError: '#F87171',    // red-400
      statusWarning: '#FBBF24',  // amber-400
      statusInfo: '#60A5FA',     // blue-400
      statusPending: '#A78BFA',  // violet-400

      borderColor: '#3D2B5E',
      borderLight: '#4D3B6E',
      borderSecondary: '#4D3B6E',
      borderFocus: '#E879F9',
    },
  },

  // Liquid Rose Gold (Pink-Black Luxury)
  liquidRoseGold: {
    name: 'Liquid Rose Gold',
    id: 'liquidRoseGold',
    colors: {
      brandPrimary: '#FB7185',   // rose-400
      brandPrimaryHover: '#F43F5E', // rose-500
      brandPrimaryLight: '#FDA4AF', // rose-300
      brandAccent: '#FCD34D',    // amber-300 (gold)

      bgPrimary: '#000000',      // pure black
      bgSecondary: '#18181B',    // zinc-900
      bgTertiary: '#27272A',     // zinc-800
      bgHover: '#3F3F46',        // zinc-700
      bgSidebar: '#000000',
      bgSidebarHover: '#18181B',

      textPrimary: '#FFFFFF',
      textSecondary: '#FDA4AF',  // rose-300
      textMuted: '#F87171',      // red-400
      textInverse: '#000000',

      statusSuccess: '#34D399',
      statusError: '#FB7185',
      statusWarning: '#FCD34D',
      statusInfo: '#60A5FA',
      statusPending: '#C084FC',

      borderColor: '#3F3F46',    // zinc-700
      borderLight: '#52525B',    // zinc-600
      borderSecondary: '#52525B',
      borderFocus: '#FB7185',
    },
  },

  // Midnight Sakura (Pink-Purple-Black)
  midnightSakura: {
    name: 'Midnight Sakura',
    id: 'midnightSakura',
    colors: {
      brandPrimary: '#EC4899',   // pink-500
      brandPrimaryHover: '#DB2777', // pink-600
      brandPrimaryLight: '#F472B6', // pink-400
      brandAccent: '#D946EF',    // fuchsia-500

      bgPrimary: '#050505',      // near black
      bgSecondary: '#1A0B1A',    // pink-black
      bgTertiary: '#2D1A2D',     // deeper pink
      bgHover: '#3D2A3D',
      bgSidebar: '#000000',
      bgSidebarHover: '#1A0B1A',

      textPrimary: '#FFFFFF',
      textSecondary: '#F9A8D4',  // pink-300
      textMuted: '#F472B6',      // pink-400
      textInverse: '#050505',

      statusSuccess: '#34D399',
      statusError: '#F87171',
      statusWarning: '#FBBF24',
      statusInfo: '#818CF8',     // indigo-400
      statusPending: '#E879F9',  // fuchsia-400

      borderColor: '#3D2A3D',
      borderLight: '#4D3A4D',
      borderSecondary: '#4D3A4D',
      borderFocus: '#EC4899',
    },
  },

  // Notion-Inspired (Liquid Beige-Brown)
  notionFluid: {
    name: 'Notion Fluid',
    id: 'notionFluid',
    colors: {
      brandPrimary: '#000000',   // black
      brandPrimaryHover: '#1A1A1A',
      brandPrimaryLight: '#404040',
      brandAccent: '#E8B4B8',    // dusty rose

      bgPrimary: '#FFFFFF',      // white background
      bgSecondary: '#F7F6F3',    // off-white
      bgTertiary: '#EFEDE8',     // warm gray
      bgHover: '#E3E2DD',
      bgSidebar: '#FBFBFA',      // light sidebar
      bgSidebarHover: '#F7F6F3',

      textPrimary: '#000000',
      textSecondary: '#65645E',  // warm gray text
      textMuted: '#9B9A97',
      textInverse: '#FFFFFF',

      statusSuccess: '#0F7B6C',  // teal
      statusError: '#E03E3E',    // red
      statusWarning: '#D9730D',  // orange
      statusInfo: '#0B6E99',     // blue
      statusPending: '#9065B0',  // purple

      borderColor: '#E3E2DD',
      borderLight: '#EFEDE8',
      borderSecondary: '#E3E2DD',
      borderFocus: '#000000',
    },
  },

  // Linear-Inspired (Gradient Purple-Blue)
  linearGradient: {
    name: 'Linear Gradient',
    id: 'linearGradient',
    colors: {
      brandPrimary: '#5E6AD2',   // linear purple
      brandPrimaryHover: '#4C5AC1',
      brandPrimaryLight: '#7075DB',
      brandAccent: '#26B5CE',    // linear blue

      bgPrimary: '#16161A',      // dark gray
      bgSecondary: '#1C1C21',    // lighter dark
      bgTertiary: '#242429',
      bgHover: '#2C2C31',
      bgSidebar: '#0F0F12',
      bgSidebarHover: '#1C1C21',

      textPrimary: '#FFFFFF',
      textSecondary: '#C4C4CC',  // light gray
      textMuted: '#72727D',      // medium gray
      textInverse: '#16161A',

      statusSuccess: '#00D084',  // linear green
      statusError: '#E5484D',    // linear red
      statusWarning: '#F76B15',  // linear orange
      statusInfo: '#26B5CE',     // linear blue
      statusPending: '#AB4ABA',  // linear purple

      borderColor: '#2C2C31',
      borderLight: '#35353A',
      borderSecondary: '#35353A',
      borderFocus: '#5E6AD2',
    },
  },

  // Vercel-Inspired (Pure Black-White)
  vercelPure: {
    name: 'Vercel Pure',
    id: 'vercelPure',
    colors: {
      brandPrimary: '#000000',   // pure black
      brandPrimaryHover: '#1A1A1A',
      brandPrimaryLight: '#404040',
      brandAccent: '#0070F3',    // vercel blue

      bgPrimary: '#000000',      // pure black
      bgSecondary: '#111111',    // near black
      bgTertiary: '#1A1A1A',
      bgHover: '#262626',
      bgSidebar: '#000000',
      bgSidebarHover: '#111111',

      textPrimary: '#FFFFFF',
      textSecondary: '#888888',  // gray
      textMuted: '#666666',
      textInverse: '#000000',

      statusSuccess: '#0070F3',  // vercel blue
      statusError: '#E00',       // vercel red
      statusWarning: '#F5A623',
      statusInfo: '#0070F3',
      statusPending: '#7928CA',  // vercel purple

      borderColor: '#333333',
      borderLight: '#444444',
      borderSecondary: '#444444',
      borderFocus: '#0070F3',
    },
  },

  // Cosmic Violet (Deep Purple Gradient)
  cosmicViolet: {
    name: 'Cosmic Violet',
    id: 'cosmicViolet',
    colors: {
      brandPrimary: '#8B5CF6',   // violet-500
      brandPrimaryHover: '#7C3AED', // violet-600
      brandPrimaryLight: '#A78BFA', // violet-400
      brandAccent: '#EC4899',    // pink-500

      bgPrimary: '#0F0A1F',      // deep violet-black
      bgSecondary: '#1A0F2E',    // violet-900
      bgTertiary: '#2A1F3E',
      bgHover: '#3A2F4E',
      bgSidebar: '#0A0515',
      bgSidebarHover: '#1A0F2E',

      textPrimary: '#FFFFFF',
      textSecondary: '#C4B5FD',  // violet-300
      textMuted: '#A78BFA',      // violet-400
      textInverse: '#0F0A1F',

      statusSuccess: '#34D399',
      statusError: '#F472B6',    // pink-400
      statusWarning: '#FBBF24',
      statusInfo: '#60A5FA',
      statusPending: '#A78BFA',

      borderColor: '#3A2F4E',
      borderLight: '#4A3F5E',
      borderSecondary: '#4A3F5E',
      borderFocus: '#8B5CF6',
    },
  },

  // Ocean Depths (Cyan-Navy Gradient)
  oceanDepths: {
    name: 'Ocean Depths',
    id: 'oceanDepths',
    colors: {
      brandPrimary: '#06B6D4',   // cyan-500
      brandPrimaryHover: '#0891B2', // cyan-600
      brandPrimaryLight: '#22D3EE', // cyan-400
      brandAccent: '#3B82F6',    // blue-500

      bgPrimary: '#021020',      // deep navy
      bgSecondary: '#032035',    // navy-900
      bgTertiary: '#04304A',
      bgHover: '#054060',
      bgSidebar: '#010810',
      bgSidebarHover: '#032035',

      textPrimary: '#FFFFFF',
      textSecondary: '#67E8F9',  // cyan-300
      textMuted: '#22D3EE',      // cyan-400
      textInverse: '#021020',

      statusSuccess: '#10B981',
      statusError: '#F43F5E',
      statusWarning: '#F59E0B',
      statusInfo: '#06B6D4',
      statusPending: '#8B5CF6',

      borderColor: '#054060',
      borderLight: '#065075',
      borderSecondary: '#065075',
      borderFocus: '#06B6D4',
    },
  },

  // Sunset Blaze (Orange-Red Gradient)
  sunsetBlaze: {
    name: 'Sunset Blaze',
    id: 'sunsetBlaze',
    colors: {
      brandPrimary: '#F97316',   // orange-500
      brandPrimaryHover: '#EA580C', // orange-600
      brandPrimaryLight: '#FB923C', // orange-400
      brandAccent: '#EF4444',    // red-500

      bgPrimary: '#1F0A00',      // deep orange-black
      bgSecondary: '#2F1500',    // burnt orange
      bgTertiary: '#3F2000',
      bgHover: '#4F3010',
      bgSidebar: '#150500',
      bgSidebarHover: '#2F1500',

      textPrimary: '#FFFFFF',
      textSecondary: '#FDBA74',  // orange-300
      textMuted: '#FB923C',      // orange-400
      textInverse: '#1F0A00',

      statusSuccess: '#34D399',
      statusError: '#EF4444',
      statusWarning: '#F59E0B',
      statusInfo: '#3B82F6',
      statusPending: '#8B5CF6',

      borderColor: '#4F3010',
      borderLight: '#5F4020',
      borderSecondary: '#5F4020',
      borderFocus: '#F97316',
    },
  },

  // Neon Nights (Vibrant Cyan-Magenta)
  neonNights: {
    name: 'Neon Nights',
    id: 'neonNights',
    colors: {
      brandPrimary: '#14B8A6',   // teal-500
      brandPrimaryHover: '#0D9488', // teal-600
      brandPrimaryLight: '#2DD4BF', // teal-400
      brandAccent: '#EC4899',    // pink-500

      bgPrimary: '#000000',      // pure black
      bgSecondary: '#0A0A0A',
      bgTertiary: '#141414',
      bgHover: '#1F1F1F',
      bgSidebar: '#000000',
      bgSidebarHover: '#0A0A0A',

      textPrimary: '#FFFFFF',
      textSecondary: '#5EEAD4',  // teal-300
      textMuted: '#2DD4BF',      // teal-400
      textInverse: '#000000',

      statusSuccess: '#14B8A6',
      statusError: '#EC4899',
      statusWarning: '#FBBF24',
      statusInfo: '#06B6D4',
      statusPending: '#A855F7',

      borderColor: '#1F1F1F',
      borderLight: '#2A2A2A',
      borderSecondary: '#2A2A2A',
      borderFocus: '#14B8A6',
    },
  },

  // Lavender Mist (Soft Purple-Pink)
  lavenderMist: {
    name: 'Lavender Mist',
    id: 'lavenderMist',
    colors: {
      brandPrimary: '#C084FC',   // purple-400
      brandPrimaryHover: '#A855F7', // purple-500
      brandPrimaryLight: '#D8B4FE', // purple-300
      brandAccent: '#F472B6',    // pink-400

      bgPrimary: '#1C1525',      // dark lavender
      bgSecondary: '#2A2035',    // purple-gray
      bgTertiary: '#382B45',
      bgHover: '#463655',
      bgSidebar: '#15101D',
      bgSidebarHover: '#2A2035',

      textPrimary: '#FFFFFF',
      textSecondary: '#E9D5FF',  // purple-200
      textMuted: '#D8B4FE',      // purple-300
      textInverse: '#1C1525',

      statusSuccess: '#34D399',
      statusError: '#FB7185',
      statusWarning: '#FBBF24',
      statusInfo: '#818CF8',
      statusPending: '#C084FC',

      borderColor: '#463655',
      borderLight: '#544165',
      borderSecondary: '#544165',
      borderFocus: '#C084FC',
    },
  },

  // Forest Emerald (Deep Green)
  forestEmerald: {
    name: 'Forest Emerald',
    id: 'forestEmerald',
    colors: {
      brandPrimary: '#10B981',   // emerald-500
      brandPrimaryHover: '#059669', // emerald-600
      brandPrimaryLight: '#34D399', // emerald-400
      brandAccent: '#14B8A6',    // teal-500

      bgPrimary: '#051F0F',      // deep forest
      bgSecondary: '#0A301A',    // dark green
      bgTertiary: '#0F4025',
      bgHover: '#145030',
      bgSidebar: '#031508',
      bgSidebarHover: '#0A301A',

      textPrimary: '#FFFFFF',
      textSecondary: '#6EE7B7',  // emerald-300
      textMuted: '#34D399',      // emerald-400
      textInverse: '#051F0F',

      statusSuccess: '#10B981',
      statusError: '#F43F5E',
      statusWarning: '#F59E0B',
      statusInfo: '#06B6D4',
      statusPending: '#8B5CF6',

      borderColor: '#145030',
      borderLight: '#196040',
      borderSecondary: '#196040',
      borderFocus: '#10B981',
    },
  },
};

export const defaultTheme = themes.testQualityDark;

// Helper function to apply theme
export function applyTheme(theme: Theme) {
  const root = document.documentElement;

  // Apply CSS variables
  root.style.setProperty('--brand-primary', theme.colors.brandPrimary);
  root.style.setProperty('--brand-primary-hover', theme.colors.brandPrimaryHover);
  root.style.setProperty('--brand-primary-light', theme.colors.brandPrimaryLight);
  root.style.setProperty('--brand-accent', theme.colors.brandAccent);

  root.style.setProperty('--bg-primary', theme.colors.bgPrimary);
  root.style.setProperty('--bg-secondary', theme.colors.bgSecondary);
  root.style.setProperty('--bg-tertiary', theme.colors.bgTertiary);
  root.style.setProperty('--bg-hover', theme.colors.bgHover);
  root.style.setProperty('--bg-sidebar', theme.colors.bgSidebar);
  root.style.setProperty('--bg-sidebar-hover', theme.colors.bgSidebarHover);

  root.style.setProperty('--text-primary', theme.colors.textPrimary);
  root.style.setProperty('--text-secondary', theme.colors.textSecondary);
  root.style.setProperty('--text-muted', theme.colors.textMuted);
  root.style.setProperty('--text-inverse', theme.colors.textInverse);

  root.style.setProperty('--status-success', theme.colors.statusSuccess);
  root.style.setProperty('--status-error', theme.colors.statusError);
  root.style.setProperty('--status-warning', theme.colors.statusWarning);
  root.style.setProperty('--status-info', theme.colors.statusInfo);
  root.style.setProperty('--status-pending', theme.colors.statusPending);

  root.style.setProperty('--border-color', theme.colors.borderColor);
  root.style.setProperty('--border-light', theme.colors.borderLight);
  root.style.setProperty('--border-secondary', theme.colors.borderSecondary);
  root.style.setProperty('--border-focus', theme.colors.borderFocus);

  // Store theme preference
  localStorage.setItem('qestro-theme', theme.id);
}

// Load saved theme or use default
export function loadTheme() {
  const savedThemeId = localStorage.getItem('qestro-theme');
  const theme = savedThemeId && themes[savedThemeId] ? themes[savedThemeId] : defaultTheme;
  applyTheme(theme);
  return theme;
}
