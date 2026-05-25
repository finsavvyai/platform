# AMLIQ AML Dashboard v2

A production-ready, Apple HIG-compliant AML (Anti-Money Laundering) platform dashboard built with React, TypeScript, and Tailwind CSS.

## Features

### Core Functionality
- **Alert Management** — Investigate sanctions match alerts with full entity details
- **Entity Screening** — Manual screening against OFAC, EU, UN, and custom lists
- **Configuration** — Threshold tuning and screening layer management
- **Analytics** — Real-time dashboards with volume trends and risk distribution
- **Audit Logging** — Complete activity trail for compliance
- **Batch Processing** — Bulk entity screening operations
- **Monitoring** — System health and task tracking

### Design Excellence
- **Apple HIG Compliance** — Native macOS/iOS look and feel with vibrancy effects
- **Fully Responsive** — Optimized for desktop, tablet, and mobile
- **Dark Mode Only** — Premium Apple-inspired dark interface
- **Smooth Animations** — 60fps transitions and interactions
- **Accessibility** — Full keyboard navigation and semantic HTML

## Quick Start

### Install Dependencies
```bash
npm install
```

### Development Server
```bash
npm run dev
```
Open http://localhost:3000

### Production Build
```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── layout/      # AppShell, Sidebar, Toolbar
│   ├── ui/          # Primitives: Button, Card, Badge, etc.
│   ├── data/        # Data display: ConfidenceScore, StatusBadge
│   ├── alerts/      # Alert cards and filters
│   ├── screening/   # Screening forms (expandable)
│   ├── config/      # Configuration UI (expandable)
│   └── charts/      # Recharts components
├── pages/           # Full page components
├── hooks/           # useApi, useMockData, useMediaQuery, etc.
├── api/             # Fetch client and API methods
├── types/           # TypeScript interfaces
├── mocks/           # Mock data for development
├── styles/          # Global CSS and design tokens
└── App.tsx          # Router configuration
```

## Apple HIG Design System

### Colors (Dark Mode)
- **Background**: #1C1C1E (systemBackground)
- **Secondary**: #2C2C2E (systemBackgroundSecondary)
- **Tertiary**: #3A3A3C (systemBackgroundTertiary)
- **Accents**: systemBlue (#0A84FF), systemGreen (#30D158), systemRed (#FF453A)

### Typography
- **SF Pro Display/Text** — System font stack
- **Title**: 34px bold
- **Headline**: 17px semibold
- **Body**: 17px regular
- **Caption**: 12px regular

### Components
All UI components follow Apple HIG guidelines:
- 44px minimum tap targets (mobile)
- Rounded corners (6px-20px)
- Vibrancy backgrounds with backdrop blur
- Subtle shadows and separators
- Smooth 0.2s transitions

## Key Pages

| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | `/` | Overview with KPIs and charts |
| Alert Queue | `/alerts` | Investigation workbench with filters |
| Alert Detail | `/alerts/:id` | Full alert investigation view |
| Screen Entity | `/screen` | Manual entity screening form |
| Configuration | `/config` | Threshold tuning UI |
| Analytics | `/analytics` | Advanced metrics and trends |
| Monitoring | `/monitoring` | System health and tasks |
| Audit Trail | `/audit` | Activity log viewer |
| Batch Jobs | `/batch` | Bulk screening operations |
| Sanctions Lists | `/lists` | List management and sync |

## Responsive Behavior

### Mobile (<640px)
- Bottom is handled by sidebar collapse
- Full-width stacked cards
- Touch-friendly (44px taps)
- Simplified layouts

### Tablet (640px-1024px)
- Collapsible sidebar with toggle
- 2-column layouts
- Medium charts

### Desktop (>1024px)
- Fixed sidebar with vibrancy
- Multi-column layouts
- Full feature set with hover states

## API Integration

The dashboard uses mock data by default. To connect to a real API:

1. Set `VITE_API_URL` environment variable
2. Mock data will be replaced with real API calls
3. All API methods are in `src/api/`

```typescript
// Example: custom backend
VITE_API_URL=http://localhost:8080/api npm run dev
```

## Customization

### Add a New Page
1. Create component in `src/pages/YourPage.tsx`
2. Add route in `src/App.tsx`
3. Add navigation item in `src/components/layout/Sidebar.tsx`

### Customize Colors
Edit `tailwind.config.js` color definitions

### Add Charts
Use Recharts components in `src/components/charts/`

## Performance

- Tree-shaken dependencies (React Router, Recharts)
- Code splitting by route
- Image optimization
- CSS minification
- Gzip compression ready

## Browser Support

- Chrome/Edge 90+
- Safari 14+
- Firefox 88+

## License

Proprietary - AMLIQ Platform
