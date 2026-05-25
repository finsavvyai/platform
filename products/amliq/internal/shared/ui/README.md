# FinSavvy AI UI Components

A revolutionary AI-powered FinTech UI component library with Apple Human Interface Guidelines-inspired design system.

## Features

- 🎨 **Apple HIG-Inspired Design** - Beautiful, intuitive interface following Apple's design principles
- 🧠 **AI-Powered Components** - Built-in intelligence for enhanced user experience
- 🌙 **Glass Morphism Theme** - Modern glass effect with dark theme optimized
- 📊 **Advanced Data Visualization** - Financial charts with AI insights
- 🔐 **Authentication Integration** - Complete auth system with multi-tenant support
- 📱 **Responsive Design** - Mobile-first approach with breakpoint awareness
- ⚡ **Performance Optimized** - Highly optimized with lazy loading and animations
- 🎯 **TypeScript First** - Full type safety and IntelliSense support
- ♿ **Accessibility Compliant** - WCAG 2.1 AA compliant components

## Installation

```bash
npm install @finsavvy/ui-components
```

### Peer Dependencies

```bash
npm install react react-dom
```

## Quick Start

```tsx
import { Button, Card, FinancialChart } from '@finsavvy/ui-components';

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Card variant="glass" className="p-6">
        <h1 className="text-2xl font-bold mb-4">Financial Dashboard</h1>
        <Button variant="primary" className="mb-4">
          Get Started
        </Button>
        <FinancialChart
          data={chartData}
          type="line"
          showAIInsights
          title="Revenue Trends"
        />
      </Card>
    </div>
  );
}
```

## Components

### UI Components

#### Button
Interactive button with multiple variants, loading states, and ripple effects.

```tsx
import { Button } from '@finsavvy/ui-components';

<Button variant="primary" size="md" loading={isLoading} ripple>
  Click me
</Button>
```

**Props:**
- `variant`: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive'
- `size`: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
- `loading`: boolean
- `ripple`: boolean
- `icon`: ReactNode

#### Card
Versatile container component with glass morphism effects and multiple variants.

```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@finsavvy/ui-components';

<Card variant="glass" interactive>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    Card content goes here
  </CardContent>
</Card>
```

**Variants:**
- `default`: Standard card with hover effects
- `glass`: Glass morphism with backdrop blur
- `elevated`: Higher elevation with shadow
- `flat`: Minimal styling
- `outline`: Border only
- `gradient`: Gradient background
- `interactive`: Clickable with scale effects

### Data Visualization

#### FinancialChart
Advanced financial chart component with AI-powered insights.

```tsx
import { FinancialChart } from '@finsavvy/ui-components';

<FinancialChart
  data={data}
  type="line"
  title="Revenue Overview"
  showAIInsights
  showForecast
  showComparison
  timeRange="30d"
  metrics={{
    total: 125000,
    growth: 12.5,
    average: 4167,
  }}
/>
```

**Features:**
- Multiple chart types: line, area, bar, pie, mixed
- AI-powered trend analysis and anomaly detection
- Real-time data updates
- Forecast and comparison views
- Interactive tooltips and legends
- Responsive design with custom breakpoints

#### AnalyticsChart
Multi-series analytics dashboard with comprehensive insights.

```tsx
import { AnalyticsChart } from '@finsavvy/ui-components';

<AnalyticsChart
  series={analyticsSeries}
  title="Performance Metrics"
  showAIInsights
  showBrush
  showAnnotations
/>
```

#### Dashboard
Comprehensive analytics dashboard with configurable sections.

```tsx
import { Dashboard } from '@finsavvy/ui-components';

<Dashboard
  title="Executive Dashboard"
  sections={dashboardSections}
  timeRange="7d"
  autoRefresh
  showAIInsights
/>
```

### Hooks

#### useAuth
Complete authentication system with multi-tenant support.

```tsx
import { useAuth, AuthProvider } from '@finsavvy/ui-components';

function App() {
  return (
    <AuthProvider apiBase="https://api.example.com">
      <Dashboard />
    </AuthProvider>
  );
}

function Dashboard() {
  const { user, login, logout, hasPermission } = useAuth();

  return (
    <div>
      {user ? (
        <div>
          <h1>Welcome, {user.name}</h1>
          {hasPermission('billing.read') && <BillingData />}
          <Button onClick={logout}>Logout</Button>
        </div>
      ) : (
        <Button onClick={() => login('user@example.com', 'password')}>
          Login
        </Button>
      )}
    </div>
  );
}
```

**Features:**
- JWT token management with automatic refresh
- Role-based access control (RBAC)
- Cross-subdomain SSO
- Session management with idle detection
- Multi-tenant organization support

#### useAIQuery
AI-powered data fetching with caching and optimistic updates.

```tsx
import { useAIQuery } from '@finsavvy/ui-components';

function DataComponent() {
  const { data, isLoading, error, refetch } = useAIQuery({
    apiEndpoint: '/api/analytics',
    aiEnhanced: true,
    aiInsights: true,
    staleWhileRevalidate: true,
    revalidateOnFocus: true,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{JSON.stringify(data)}</div>;
}
```

**Features:**
- Intelligent caching with TTL
- Optimistic updates with rollback
- Background refetching
- Rate limiting and retry logic
- AI-enhanced responses with insights

### Utilities

#### Formatting Functions
```tsx
import { formatCurrency, formatPercentage, formatRelativeTime } from '@finsavvy/ui-components';

formatCurrency(1234.56); // $1,234.56
formatPercentage(25.5); // 25.5%
formatRelativeTime(new Date()); // "2 hours ago"
```

#### Chart Utilities
```tsx
import {
  generateForecast,
  calculateCorrelation,
  detectOutliers,
  aggregateDataByTimeRange
} from '@finsavvy/ui-components';

const forecast = generateForecast(data, 7); // 7-day forecast
const correlation = calculateCorrelation(xValues, yValues);
const outliers = detectOutliers(values, 2.5); // 2.5 sigma threshold
const aggregated = aggregateDataByTimeRange(data, '1d', 'average');
```

## Styling

### Tailwind CSS Configuration

Include the component library's Tailwind config in your project:

```javascript
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@finsavvy/ui-components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Your custom theme extensions
    },
  },
  presets: [
    require('@finsavvy/ui-components/tailwind.config.js'),
  ],
};
```

### CSS Variables

Include the CSS variables in your global stylesheet:

```css
/* globals.css */
@import '@finsavvy/ui-components/styles/globals.css';

:root {
  /* Override theme colors if needed */
  --brand-cyan-500: #06b6d4;
  --brand-blue-500: #3b82f6;
  --brand-indigo-500: #6366f1;
}
```

## Development

### Storybook

Explore components in Storybook:

```bash
npm run storybook
```

### Testing

Run the test suite:

```bash
npm run test          # Run tests
npm run test:ui       # Run tests with UI
npm run test:coverage # Run tests with coverage
```

### Building

Build the library for distribution:

```bash
npm run build         # Build library
npm run build:types   # Build type definitions
```

## Architecture

### Design System

- **Colors**: Cyan, blue, and indigo gradients on dark background
- **Typography**: System font stack with clear hierarchy
- **Spacing**: Consistent 8px grid system
- **Animations**: GPU-accelerated, performant transitions
- **Glass Effects**: Backdrop blur with transparency layers

### Component Structure

```
src/
├── components/
│   ├── ui/              # Basic UI components
│   └── charts/          # Data visualization components
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions
└── styles/              # Global styles and themes
```

### TypeScript Support

Full TypeScript support with comprehensive type definitions:

```tsx
import type {
  ButtonProps,
  CardProps,
  ChartDataPoint,
  AnalyticsSeries
} from '@finsavvy/ui-components';
```

## Performance

### Bundle Size

The library is optimized for size:

- **Core Components**: ~45KB gzipped
- **Chart Components**: ~25KB gzipped
- **Hooks**: ~15KB gzipped
- **Utilities**: ~10KB gzipped

### Tree Shaking

ESM modules with full tree-shaking support:

```tsx
import { Button } from '@finsavvy/ui-components'; // Only Button bundled
```

### Lazy Loading

Components support lazy loading:

```tsx
import { lazy } from 'react';

const FinancialChart = lazy(() => import('@finsavvy/ui-components/FinancialChart'));
```

## Accessibility

All components follow WCAG 2.1 AA guidelines:

- ✅ Keyboard navigation
- ✅ Screen reader support
- ✅ High contrast mode
- ✅ Focus management
- ✅ ARIA labels and descriptions

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/finsavvy/ui-components.git
cd ui-components
npm install
npm run storybook
```

## License

MIT © [FinSavvy AI](https://finsavvyai.com)

## Support

- 📖 [Documentation](https://docs.finsavvyai.com)
- 🐛 [Issue Tracker](https://github.com/finsavvy/ui-components/issues)
- 💬 [Discord Community](https://discord.gg/finsavvy)
- 📧 [Email Support](mailto:support@finsavvyai.com)

---

Built with ❤️ by the FinSavvy AI team