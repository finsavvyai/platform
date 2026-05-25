# Apple HIG Implementation Guide for Questro

## Quick Start

### 1. Import the Apple HIG Styles

Add to your main CSS file:
```css
@import './styles/apple-hig.css';
```

Or in your main entry point:
```tsx
import './styles/apple-hig.css';
```

### 2. Update Tailwind Configuration

Extend your `tailwind.config.js` with Apple's design tokens:

```javascript
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Apple system colors
        'system-blue': '#007AFF',
        'system-green': '#34C759',
        'system-yellow': '#FFCC00',
        'system-orange': '#FF9500',
        'system-red': '#FF3B30',
        'system-purple': '#AF52DE',
        'system-pink': '#FF2D55',
        'system-teal': '#5AC8FA',
        'system-indigo': '#5856D6',

        // Gray scale
        'system-gray': '#8E8E93',
        'system-gray2': '#AEAEB2',
        'system-gray3': '#C7C7CC',
        'system-gray4': '#D1D1D6',
        'system-gray5': '#E5E5EA',
        'system-gray6': '#F2F2F7',

        // Semantic colors
        'label': {
          primary: 'rgba(0, 0, 0, 0.92)',
          secondary: 'rgba(0, 0, 0, 0.6)',
          tertiary: 'rgba(0, 0, 0, 0.38)',
          quaternary: 'rgba(0, 0, 0, 0.12)',
        },

        // Background colors
        'background': {
          primary: '#FFFFFF',
          secondary: '#F2F2F7',
          tertiary: '#FFFFFF',
        },
      },

      fontFamily: {
        'sf-pro': ['SF Pro Display', 'SF Pro Text', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        'sf-mono': ['SF Mono', 'Consolas', 'Monaco', 'monospace'],
      },

      fontSize: {
        // Apple's type scale
        'title1': ['28px', { lineHeight: '34px', letterSpacing: '0.37px', fontWeight: '400' }],
        'title2': ['22px', { lineHeight: '28px', letterSpacing: '0.35px', fontWeight: '400' }],
        'title3': ['20px', { lineHeight: '25px', letterSpacing: '0.38px', fontWeight: '400' }],
        'headline': ['17px', { lineHeight: '22px', letterSpacing: '-0.43px', fontWeight: '600' }],
        'body': ['17px', { lineHeight: '22px', letterSpacing: '-0.43px', fontWeight: '400' }],
        'callout': ['16px', { lineHeight: '21px', letterSpacing: '-0.32px', fontWeight: '400' }],
        'subhead': ['15px', { lineHeight: '20px', letterSpacing: '-0.24px', fontWeight: '400' }],
        'footnote': ['13px', { lineHeight: '18px', letterSpacing: '-0.08px', fontWeight: '400' }],
        'caption1': ['12px', { lineHeight: '16px', letterSpacing: '0', fontWeight: '400' }],
        'caption2': ['11px', { lineHeight: '13px', letterSpacing: '0.07px', fontWeight: '400' }],
      },

      spacing: {
        // 8pt grid system
        '18': '4.5rem',  // 36px
        '20': '5rem',    // 40px
        '22': '5.5rem',  // 44px
        '24': '6rem',    // 48px
        '28': '7rem',    // 56px
        '32': '8rem',    // 64px
        '36': '9rem',    // 72px
        '40': '10rem',   // 80px
        '44': '11rem',   // 88px
        '48': '12rem',   // 96px
      },

      borderRadius: {
        // Apple's corner radius values
        'apple': '10px',
        'apple-xl': '14px',
        'apple-2xl': '16px',
      },

      boxShadow: {
        'apple-sm': '0 1px 3px rgba(0, 0, 0, 0.12)',
        'apple': '0 4px 16px rgba(0, 0, 0, 0.1)',
        'apple-lg': '0 8px 32px rgba(0, 0, 0, 0.12)',
      },

      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out-quad',
        'scale-in': 'scaleIn 0.2s ease-out',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
  darkMode: 'media', // Enable dark mode
}
```

## Component Usage Examples

### AppleButton Component

```tsx
import AppleButton from '@/components/atoms/Button/AppleButton';

// Primary action
<AppleButton variant="primary" size="medium">
  Continue
</AppleButton>

// Secondary action
<AppleButton variant="secondary" size="medium" leftIcon={<PlusIcon />}>
  Add Item
</AppleButton>

// Destructive action
<AppleButton variant="destructive" size="small">
  Delete
</AppleButton>

// Loading state
<AppleButton isLoading size="medium">
  Processing...
</AppleButton>

// With icon
<AppleButton
  variant="primary"
  size="large"
  leftIcon={<DownloadIcon />}
  rightIcon={<ArrowRightIcon />}
>
  Download Report
</AppleButton>
```

### AppleInput Component

```tsx
import AppleInput from '@/components/atoms/Input/AppleInput';

// Standard input
<AppleInput
  label="Email Address"
  type="email"
  placeholder="john@example.com"
  required
/>

// With validation
<AppleInput
  label="Password"
  type="password"
  isPassword
  error="Password must be at least 8 characters"
  showSuccessIndicator
  isValid={isValidPassword}
/>

// Search input
<AppleInput
  variant="search"
  placeholder="Search tests..."
  size="large"
/>

// With helper text
<AppleInput
  label="API Key"
  helperText="Find your API key in account settings"
  leftIcon={<KeyIcon />}
/>
```

### AppleCard Component

```tsx
import AppleCard from '@/components/molecules/AppleCard/AppleCard';

// Basic card
<AppleCard title="Test Suite" subtitle="Last run 2 hours ago">
  <p>23 tests passed, 2 failed</p>
</AppleCard>

// Interactive card with actions
<AppleCard
  title="Performance Test"
  badge={<span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Active</span>}
  elevated
  onClick={() => navigate('/test/123')}
  actions={
    <div className="flex space-x-2">
      <AppleButton variant="plain" size="small">View</AppleButton>
      <AppleButton variant="plain" size="small">Edit</AppleButton>
    </div>
  }
>
  <p className="text-gray-600">Load test for production environment</p>
</AppleCard>
```

## Layout Patterns

### Apple-style Navigation

```tsx
// Tab navigation
<nav className="nav-apple">
  <div className="container mx-auto px-6">
    <div className="flex space-x-8">
      <button className="nav-apple-tab active">Overview</button>
      <button className="nav-apple-tab">Tests</button>
      <button className="nav-apple-tab">Reports</button>
      <button className="nav-apple-tab">Settings</button>
    </div>
  </div>
</nav>

// Segmented control
<div className="inline-flex bg-gray-100 rounded-apple p-1">
  <button className="px-4 py-2 rounded-md bg-white shadow-sm text-sm font-medium">Day</button>
  <button className="px-4 py-2 rounded-md text-sm font-medium text-gray-600">Week</button>
  <button className="px-4 py-2 rounded-md text-sm font-medium text-gray-600">Month</button>
</div>
```

### List and Table Styles

```tsx
// Apple-style list
<div className="bg-white rounded-apple-2xl border border-gray-200 overflow-hidden">
  {items.map((item, index) => (
    <div
      key={item.id}
      className={clsx(
        'px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer',
        index !== items.length - 1 && 'border-b border-gray-100'
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-body font-medium">{item.title}</h3>
          <p className="text-footnote text-gray-500 mt-1">{item.description}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>
    </div>
  ))}
</div>

// Apple-style table
<div className="overflow-hidden rounded-apple-2xl border border-gray-200">
  <table className="w-full">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-6 py-3 text-left text-footnote font-semibold text-gray-900">Name</th>
        <th className="px-6 py-3 text-left text-footnote font-semibold text-gray-900">Status</th>
        <th className="px-6 py-3 text-left text-footnote font-semibold text-gray-900">Last Run</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-100">
      {rows.map(row => (
        <tr key={row.id} className="hover:bg-gray-50">
          <td className="px-6 py-4 text-body">{row.name}</td>
          <td className="px-6 py-4">{row.status}</td>
          <td className="px-6 py-4 text-footnote text-gray-500">{row.lastRun}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

## Dark Mode Implementation

### Enable Dark Mode in Components

```tsx
// Use CSS variables that adapt to dark mode
const DarkModeCard = () => {
  return (
    <div className="bg-background-primary border border-separator-non-opaque">
      <h3 className="text-label-primary">Title</h3>
      <p className="text-label-secondary">Description</p>
    </div>
  );
};

// Or use Tailwind's dark mode classes
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  Content that adapts to dark mode
</div>
```

### Dark Mode Toggle

```tsx
const DarkModeToggle = () => {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
    >
      {theme === 'light' ? <MoonIcon /> : <SunIcon />}
    </button>
  );
};
```

## Accessibility Best Practices

### Focus Management

```tsx
// Custom focus ring
<button className="focus-ring">
  Button with custom focus indicator
</button>

// Skip link for keyboard navigation
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4">
  Skip to main content
</a>
```

### ARIA Labels

```tsx
<button
  aria-label="Close dialog"
  aria-expanded={isOpen}
  aria-controls="dialog-content"
>
  <XIcon />
</button>

<div role="status" aria-live="polite">
  {statusMessage}
</div>
```

### Reduced Motion

```css
/* Already included in apple-hig.css */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Migration Checklist

### Phase 1: Typography & Colors
- [ ] Import apple-hig.css
- [ ] Update font stack to SF Pro
- [ ] Replace font sizes with Apple's type scale
- [ ] Update color usage to semantic colors
- [ ] Test contrast ratios

### Phase 2: Component Updates
- [ ] Replace Button with AppleButton
- [ ] Replace Input with AppleInput
- [ ] Update Card components to AppleCard
- [ ] Update navigation styles
- [ ] Update form layouts

### Phase 3: Layout & Spacing
- [ ] Implement 8pt grid system
- [ ] Update all spacing to use 8pt multiples
- [ ] Ensure 44pt minimum touch targets
- [ ] Update border radius to Apple values

### Phase 4: Polish & Refinement
- [ ] Add micro-interactions
- [ ] Implement proper transitions
- [ ] Test accessibility
- [ ] Optimize for dark mode
- [ ] Test on various devices

## Testing Your Implementation

### Visual Regression Testing
```bash
# Install Chromatic for visual testing
npm install --save-dev chromatic

# Run visual tests
chromatic --project-token=your-token
```

### Accessibility Testing
```bash
# Install axe-core for accessibility testing
npm install --save-dev @axe-core/react

# Run accessibility audit
npm run test:a11y
```

### Performance Testing
Ensure the new design doesn't impact performance:
- Monitor bundle size
- Test animations on low-end devices
- Check for layout shifts

## Resources

- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [SF Pro Fonts](https://developer.apple.com/fonts/)
- [Apple Color System](https://developer.apple.com/design/human-interface-guidelines/color/)
- [Accessibility Guidelines](https://developer.apple.com/design/human-interface-guidelines/accessibility/)

## Support

For questions about implementing Apple HIG in Questro:
1. Check the component examples in this guide
2. Review the Apple HIG documentation
3. Test on actual Apple devices when possible
4. Get feedback from users familiar with Apple's design language