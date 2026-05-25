# AMLIQ AML Dashboard v2 - Quick Reference Card

## Project Location
```
/sessions/loving-cool-einstein/mnt/outputs/aegis-v2/web/
```

## Get Started (3 steps)

```bash
cd /sessions/loving-cool-einstein/mnt/outputs/aegis-v2/web
npm install
npm run dev
```

Then open: **http://localhost:3000**

## Key Files

| Purpose | File |
|---------|------|
| Main app | `src/App.tsx` |
| All pages | `src/pages/` (10 pages) |
| UI components | `src/components/ui/` (9 components) |
| API integration | `src/api/` (7 modules) |
| Types | `src/types/` (9 files) |
| Styles | `src/index.css` |
| Config | `tailwind.config.js` |

## Routes (10 Pages)

| URL | Page | Purpose |
|-----|------|---------|
| `/` | Dashboard | KPIs & metrics |
| `/alerts` | Alert Queue | Investigation list |
| `/alerts/:id` | Alert Detail | Full investigation |
| `/screen` | Screen Entity | Manual screening |
| `/config` | Configuration | Settings |
| `/analytics` | Analytics | Advanced metrics |
| `/audit` | Audit Trail | Activity log |
| `/monitoring` | Monitoring | System health |
| `/batch` | Batch Jobs | Bulk operations |
| `/lists` | Sanctions Lists | List management |

## Component Hierarchy

```
AppShell (layout)
├── Sidebar (navigation)
├── Toolbar (search, notifications)
└── Pages
    ├── Dashboard
    │   ├── StatCard (4x)
    │   ├── AreaChart
    │   ├── DonutChart
    │   └── BarChart
    ├── AlertQueue
    │   ├── AlertFilters
    │   └── AlertCard (list)
    ├── AlertDetailPage
    │   ├── EntityDetailsCard
    │   ├── NotesCard
    │   ├── AlertActions
    │   └── AlertDetailSidebar
    ├── ScreenEntity
    │   ├── ScreeningForm
    │   ├── ScreeningLayersList
    │   └── ScreeningResults
    ├── Configuration
    │   ├── ThresholdsCard
    │   ├── MatchingModesCard
    │   └── ScreeningLayersCard
    └── ... (other pages)
```

## Commands

```bash
# Development
npm run dev              # Start dev server (localhost:3000)
npm run build            # Create production build
npm run preview          # Preview production build

# Linting
npm run lint             # Run ESLint
```

## Environment Variables

```bash
VITE_API_URL=http://localhost:8080/api
VITE_APP_NAME=AMLIQ AML Dashboard
VITE_ENVIRONMENT=development
```

Create `.env.local` file in project root.

## API Endpoints Required

```
POST   /api/screening                 # Screen entity
GET    /api/screening/:id             # Get result
GET    /api/alerts                    # List alerts
GET    /api/alerts/:id                # Get alert
PUT    /api/alerts/:id                # Update alert
POST   /api/alerts/:id/resolve        # Resolve alert
GET    /api/config                    # Get config
PUT    /api/config                    # Update config
GET    /api/analytics/dashboard       # Dashboard metrics
GET    /api/audit                     # Audit log
```

All API methods are in `src/api/` and ready to connect.

## Component Props Examples

### Button
```tsx
<Button variant="primary" size="md" onClick={() => {}}>
  Click me
</Button>
```

### Card
```tsx
<Card hover onClick={() => {}}>
  Content here
</Card>
```

### Badge
```tsx
<Badge color="green">Status</Badge>
```

### Toggle
```tsx
<Toggle checked={true} onChange={(v) => {}} label="Enable" />
```

### SearchField
```tsx
<SearchField 
  value={search} 
  onChange={setSearch}
  onSubmit={() => {}}
/>
```

## Styling Classes

### Typography
```
.sf-title        // 34px bold
.sf-headline     // 17px semibold
.sf-body         // 17px regular
.sf-caption      // 12px regular
```

### Colors
```
text-apple-blue    text-apple-green    text-apple-red
bg-apple-bg        bg-apple-bg-secondary
```

### Spacing
```
gap-xs, gap-sm, gap-md, gap-lg, gap-xl, gap-xxl
p-xs, p-sm, p-md, p-lg, p-xl, p-xxl
```

## Responsive Breakpoints

```
sm:  640px (tablets start)
md:  1024px (desktop start)
lg:  1280px (large desktop)
```

Example:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg">
```

## Hooks Usage

### useApi
```tsx
const { data, loading, error, refetch } = useApi(
  () => api.get('/endpoint'),
  []
);
```

### useMediaQuery
```tsx
const isMobile = useMediaQuery('(max-width: 639px)');
const isDesktop = useDesktop();
const isTablet = useIsTablet();
```

### useDebounce
```tsx
const debouncedSearch = useDebounce(searchValue, 300);
```

### useSidebar
```tsx
const { isOpen, toggle, close, open } = useSidebar();
```

## Adding a New Page

1. Create file in `src/pages/YourPage.tsx`
2. Export function component
3. Add route in `src/App.tsx`
4. Add nav item in `src/components/layout/Sidebar.tsx`

Example page:
```tsx
import { PageHeader } from '../components/layout/PageHeader';

export function YourPage() {
  return (
    <div>
      <PageHeader title="Your Page" />
      {/* Content */}
    </div>
  );
}
```

## Adding a New Component

1. Create file in appropriate `src/components/` folder
2. Keep under 100 LOC
3. Use Apple HIG styling
4. Export function component
5. Use in pages/other components

Example component:
```tsx
import { Card } from '../ui/Card';

interface MyComponentProps {
  title: string;
  description?: string;
}

export function MyComponent({ title, description }: MyComponentProps) {
  return (
    <Card>
      <h3 className="sf-headline">{title}</h3>
      {description && <p className="sf-caption">{description}</p>}
    </Card>
  );
}
```

## Deployment

### Production Build
```bash
npm run build
```
Creates optimized bundle in `dist/` folder.

### Serve Locally
```bash
npm run preview
```

### Deploy to Server
1. Copy `dist/` folder to web server
2. Configure backend API URL
3. Set up SSL/TLS
4. Configure CORS
5. Monitor error rates

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 3000 in use | `npm run dev -- --port 3001` |
| Module errors | `rm -rf node_modules && npm install` |
| TypeScript errors | `npm run build -- --debug` |
| Slow build | Use `npm run build` instead of dev |
| Memory issues | Increase Node memory: `NODE_OPTIONS=--max-old-space-size=4096` |

## Performance Tips

- Use responsive images
- Lazy load routes
- Minimize bundle size
- Use React.memo for expensive components
- Debounce search and filters
- Virtualize long lists

## Browser DevTools

### Chrome DevTools
- F12 to open
- Network tab to monitor API calls
- Console for errors
- React DevTools extension

### Lighthouse
- Ctrl+Shift+P → "Lighthouse"
- Check performance, accessibility, best practices

## Key Technologies

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **React Router** - Navigation
- **Recharts** - Charts
- **Lucide React** - Icons

## Statistics

- **71 source files** - All <100 LOC
- **2,448 lines of code** - Total
- **32 lines average** - Per file
- **31 components** - UI/domain
- **10 pages** - Full features
- **6 hooks** - Custom utilities
- **7 API modules** - Backend integration
- **376KB** - Total project size

## Support

**Documentation Files**:
- README.md - Usage guide
- IMPLEMENTATION_GUIDE.md - Architecture
- DEPLOYMENT_CHECKLIST.md - Production
- FILE_MANIFEST.md - File inventory
- SUMMARY.txt - Complete overview

All files are in `/sessions/loving-cool-einstein/mnt/outputs/aegis-v2/`

---

**Version**: 2.0.0
**Status**: Production Ready ✅
**Last Updated**: 2024-03-26
