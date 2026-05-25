# Apple Human Interface Guidelines Implementation

This document describes the Apple HIG design system implemented in QueryFlux.

## Overview

QueryFlux now includes a comprehensive Apple Human Interface Guidelines (HIG) design system that provides a native Apple user experience while maintaining powerful database management capabilities.

## Design System

### Typography
- SF Pro font family with proper hierarchy
- Responsive text sizing with clamp()
- Support for display, title, body, label, and caption styles

### Colors
- Semantic color system with light/dark mode support
- Apple accent colors (blue, purple, pink, red, etc.)
- System indicators (success, warning, error, info)

### Spacing
- 4px grid-based spacing system
- Component-specific padding and gaps
- Consistent layout patterns

### Animations
- Apple-style easing curves (standard, decelerate, accelerate, spring)
- Proper durations (instant, fast, standard, slow, slower)
- Hardware-accelerated transforms

### Glass Morphism
- Modern backdrop-filter blur effects
- Transparency layers with proper borders
- Light and dark glass variants

## Components

### AppleButton
```typescript
import { AppleButton } from './components/apple-ui';

// Primary action
<AppleButton variant="primary" size="medium">
  Save Changes
</AppleButton>

// Secondary action with icon
<AppleButton variant="secondary" icon={<Save />}>
  Save
</AppleButton>

// Text-only button
<AppleButton variant="tertiary">
  Learn More
</AppleButton>
```

### AppleInput
```typescript
import { AppleInput } from './components/apple-ui';

<AppleInput
  label="Email Address"
  placeholder="john@example.com"
  type="email"
  state="default"
  clearable
/>
```

### AppleCard
```typescript
import { AppleCard } from './components/apple-ui';

// Glass card with hover effect
<AppleCard variant="glass" interactive>
  <h3>Card Title</h3>
  <p>Card content with glass morphism effect</p>
</AppleCard>

// Elevated card
<AppleCard variant="elevated">
  <h3>Card Title</h3>
  <p>Standard elevated card</p>
</AppleCard>
```

## CSS Variables

All design tokens are available as CSS custom properties:

```css
/* Typography */
--font-display-large: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
--font-display-large-size: clamp(2.5rem, 5vw, 4rem);

/* Colors */
--color-background-primary: #ffffff;
--color-accent-blue: #007aff;

/* Spacing */
--spacing-md: 16px;
--spacing-lg: 24px;

/* Animations */
--ease-standard: cubic-bezier(0.4, 0.0, 0.2, 1);
--duration-standard: 250ms;
```

## Dark Mode

The system automatically detects and respects system preference:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-background-primary: #000000;
    --color-label-primary: #ffffff;
  }
}
```

Manual override:
```html
<div data-theme="dark">
  <!-- Dark mode content -->
</div>
```

## Glass Effects

Apply glass morphism effects:

```css
.glass-medium {
  backdrop-filter: blur(40px) saturate(180%);
  background-color: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.15);
}
```

## Accessibility

- Full WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- Focus management
- ARIA labels and roles

## Responsive Design

Apple device-specific breakpoints:
- iPhone SE: 375px
- iPhone Pro Max: 414px
- iPad: 768px
- Desktop: 1024px+

## Usage

1. Import the CSS variables:
```css
@import '../styles/apple-hig.css';
```

2. Use components:
```typescript
import { AppleButton, AppleInput, AppleCard } from './components/apple-ui';
```

3. Apply design tokens:
```typescript
import { COLORS, SPACING, TYPOGRAPHY } from '../design-system/tokens';
```

## Files Structure

```
src/
├── design-system/
│   └── tokens.ts              # Design tokens
├── components/apple-ui/
│   ├── AppleButton.tsx        # Button component
│   ├── AppleInput.tsx         # Input component
│   ├── AppleCard.tsx          # Card component
│   ├── AppleModal.tsx         # Modal component
│   ├── AppleSidebar.tsx       # Sidebar component
│   ├── AppleTabs.tsx          # Tabs component
│   └── index.ts               # Exports
├── styles/
│   └── apple-hig.css          # CSS variables
└── docs/
    └── APPLE_HIG.md           # This documentation
```

## Apple HIG Principles

### Hierarchy
- Clear visual organization with proper typography scale
- Important elements are prominent
- Consistent size and weight relationships

### Harmony
- Unified design language across all components
- Consistent use of colors, spacing, and typography
- Cohesive interaction patterns

### Consistency
- Predictable interactions following Apple conventions
- Familiar patterns for Apple users
- Standard behaviors for buttons, inputs, and controls

## Browser Support

- Chrome 90+
- Safari 14+
- Firefox 88+
- Edge 90+

## Performance

- Hardware-accelerated animations
- Optimized CSS transforms
- Minimal repaints and reflows
- Efficient component rendering

## Contributing

When adding new components or features:

1. Follow Apple HIG guidelines
2. Use design tokens from `tokens.ts`
3. Implement proper accessibility
4. Add keyboard navigation
5. Test in both light and dark modes
6. Ensure responsive behavior

## Resources

- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Apple Design Resources](https://developer.apple.com/design/resources/)
- [SF Pro Font](https://developer.apple.com/fonts/)