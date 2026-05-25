# luna-ui-convert - Apple HIG + Decart Modern UI Converter

## Command Overview

The `luna-ui-convert` command transforms your UI to follow Apple Human Interface Guidelines with modern Decart-inspired design aesthetics. It combines Apple's polished design principles with contemporary web design patterns for stunning, professional interfaces.

## What This Command Does

- **Apple HIG Compliance**: Converts UI to follow Apple's design standards
- **Decart Design Patterns**: Applies modern, minimalist design aesthetics
- **Automated Conversion**: Transforms existing components automatically
- **Design System Generation**: Creates comprehensive design tokens and components
- **Code Generation**: Produces implementation-ready React/Vue/Svelte components

## Usage Instructions

### Full Project Conversion
```bash
luna-ui-convert
```
Converts entire project UI to Apple HIG + Decart modern design.

### Component-Specific Conversion
```bash
luna-ui-convert component [component-name]
```
Converts specific component (e.g., buttons, cards, navigation).

### Page-Specific Conversion
```bash
luna-ui-convert page [page-name]
```
Converts specific page or view.

### Design System Only
```bash
luna-ui-convert design-system
```
Generates design system without converting components.

### Preview Mode
```bash
luna-ui-convert preview
```
Generates preview of converted design without applying changes.

## Design Philosophy

### Apple HIG Principles
1. **Clarity**: Clean typography, precise icons, ample spacing
2. **Deference**: Content-first approach, minimal UI chrome
3. **Depth**: Layering with shadows, realistic motion

### Decart Design Aesthetics
1. **Minimalism**: Clean, uncluttered interfaces
2. **Bold Typography**: Strong typographic hierarchy
3. **Generous Whitespace**: Breathing room for content
4. **Subtle Animations**: Smooth, purposeful motion
5. **Modern Color Palette**: Sophisticated, muted tones
6. **Glassmorphism**: Frosted glass effects and blur
7. **Neumorphism Elements**: Soft shadows and highlights
8. **Gradient Accents**: Subtle, tasteful gradients

## Conversion Features

### Typography Transformation
- **Font System**: San Francisco (SF Pro) or system fonts
- **Type Scale**: 11, 13, 15, 17, 20, 24, 28, 34, 48, 60pt
- **Font Weights**: Regular (400), Medium (500), Semibold (600), Bold (700)
- **Line Heights**: Optimized for readability (1.2-1.5)
- **Letter Spacing**: Tight for headings, normal for body

### Color System Conversion
- **Apple System Colors**:
  - Primary Blue: `#007AFF`
  - Success Green: `#34C759`
  - Destructive Red: `#FF3B30`
  - Warning Orange: `#FF9500`
  - Secondary Gray: `#8E8E93`

- **Decart Color Palette**:
  - Neutral Grays: `#F8F9FA`, `#E9ECEF`, `#DEE2E6`
  - Deep Backgrounds: `#1A1A1A`, `#2D2D2D`
  - Accent Colors: Subtle gradients and muted tones
  - Glassmorphism: `rgba(255, 255, 255, 0.1)` with backdrop blur

### Spacing & Layout
- **Base Unit**: 8px grid system
- **Spacing Scale**: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px
- **Container Widths**: 320px (mobile), 768px (tablet), 1280px (desktop)
- **Grid System**: 4-column (mobile), 8-column (tablet), 12-column (desktop)

### Component Transformations

#### Buttons
**Before**: Standard button
**After**: Apple HIG compliant with Decart styling
- 44pt minimum height
- 8-12pt corner radius
- Semibold text
- Smooth scale animation on press
- Glassmorphism option for secondary buttons

#### Cards
**Before**: Basic card component
**After**: Modern card with depth
- 12-16pt corner radius
- Subtle shadow elevation
- Generous padding (16-24pt)
- Hover lift animation
- Optional glassmorphism background

#### Navigation
**Before**: Standard navigation bar
**After**: Apple-style navigation
- 44pt height (compact), 96pt (large title)
- Blur background with translucency
- Smooth scroll animations
- Floating navigation option

#### Forms
**Before**: Standard form inputs
**After**: Polished input fields
- 44pt input height
- Clear focus states
- Floating labels
- Inline validation
- Smooth transitions

#### Modals & Overlays
**Before**: Basic modals
**After**: Apple-style sheets and alerts
- Centered alerts (270pt width)
- Bottom sheets with drag handle
- Backdrop blur
- Smooth slide animations

### Animation & Motion
- **Micro-interactions**: 200-300ms with ease-out
- **Page Transitions**: 400-500ms with spring physics
- **Hover Effects**: Subtle scale and shadow changes
- **Loading States**: Skeleton screens and spinners
- **Scroll Animations**: Parallax and fade effects

### Glassmorphism Effects
```css
.glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
}
```

### Neumorphism Elements
```css
.neumorphic {
  background: #e0e5ec;
  box-shadow: 
    9px 9px 16px rgba(163, 177, 198, 0.6),
    -9px -9px 16px rgba(255, 255, 255, 0.5);
  border-radius: 12px;
}
```

## Conversion Process

### Phase 1: Analysis
1. Scan existing UI components and styles
2. Identify design patterns and inconsistencies
3. Analyze color palette and typography
4. Map components to Apple HIG equivalents

### Phase 2: Design System Generation
1. Create design tokens (colors, typography, spacing)
2. Generate CSS custom properties
3. Create utility classes (Tailwind-compatible)
4. Define component specifications

### Phase 3: Component Conversion
1. Convert buttons, inputs, and controls
2. Transform cards, lists, and grids
3. Redesign navigation and headers
4. Update modals and overlays
5. Enhance forms and validation

### Phase 4: Animation & Polish
1. Add micro-interactions
2. Implement page transitions
3. Create loading states
4. Add hover and focus effects
5. Optimize performance

### Phase 5: Testing & Validation
1. Visual regression testing
2. Accessibility compliance check
3. Cross-browser testing
4. Performance optimization
5. Responsive design validation

## Generated Files

### Design System
```
.luna/{project}/design-system/
├── tokens.css              # CSS custom properties
├── utilities.css           # Utility classes
├── components.css          # Component styles
├── animations.css          # Animation definitions
└── themes/
    ├── light.css          # Light theme
    └── dark.css           # Dark theme
```

### Component Library
```
.luna/{project}/components/
├── Button.jsx             # Button component
├── Card.jsx               # Card component
├── Input.jsx              # Input component
├── Modal.jsx              # Modal component
├── Navigation.jsx         # Navigation component
└── index.js               # Component exports
```

### Documentation
```
.luna/{project}/
├── ui-conversion-report.md    # Conversion summary
├── design-system-guide.md     # Design system documentation
└── component-library.md       # Component usage guide
```

## Implementation Examples

### Button Component (React)
```jsx
const Button = ({ variant = 'primary', size = 'medium', children, ...props }) => {
  const baseStyles = `
    inline-flex items-center justify-center
    font-semibold rounded-xl
    transition-all duration-200
    active:scale-95
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
  `;
  
  const sizes = {
    small: 'px-4 py-2 text-sm min-h-[36px]',
    medium: 'px-6 py-3 text-base min-h-[44px]',
    large: 'px-8 py-4 text-lg min-h-[52px]'
  };
  
  const variants = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600 shadow-md hover:shadow-lg',
    secondary: 'bg-white/10 backdrop-blur-md text-blue-500 border border-white/20 hover:bg-white/20',
    destructive: 'bg-red-500 text-white hover:bg-red-600 shadow-md hover:shadow-lg'
  };
  
  return (
    <button 
      className={`${baseStyles} ${sizes[size]} ${variants[variant]}`}
      {...props}
    >
      {children}
    </button>
  );
};
```

### Card Component (React)
```jsx
const Card = ({ children, hoverable = false, glass = false, className = '', ...props }) => {
  const baseStyles = `
    rounded-2xl p-6
    transition-all duration-300
  `;
  
  const glassStyles = glass 
    ? 'bg-white/10 backdrop-blur-md border border-white/20 shadow-xl'
    : 'bg-white shadow-md';
    
  const hoverStyles = hoverable 
    ? 'hover:shadow-xl hover:-translate-y-1 cursor-pointer'
    : '';
  
  return (
    <div 
      className={`${baseStyles} ${glassStyles} ${hoverStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
```

### Navigation Component (React)
```jsx
const Navigation = ({ title, transparent = false, large = false }) => {
  const baseStyles = `
    fixed top-0 left-0 right-0 z-50
    transition-all duration-300
  `;
  
  const backgroundStyles = transparent
    ? 'bg-white/80 backdrop-blur-md border-b border-gray-200/50'
    : 'bg-white shadow-sm';
    
  const heightStyles = large ? 'h-24' : 'h-16';
  
  return (
    <nav className={`${baseStyles} ${backgroundStyles} ${heightStyles}`}>
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        <h1 className={large ? 'text-3xl font-bold' : 'text-xl font-semibold'}>
          {title}
        </h1>
      </div>
    </nav>
  );
};
```

## Design Tokens (CSS)

```css
:root {
  /* Typography */
  --font-family-system: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui;
  --font-size-xs: 11px;
  --font-size-sm: 13px;
  --font-size-base: 15px;
  --font-size-lg: 17px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;
  --font-size-3xl: 28px;
  --font-size-4xl: 34px;
  --font-size-5xl: 48px;
  
  /* Colors - Apple System */
  --color-blue: #007AFF;
  --color-green: #34C759;
  --color-red: #FF3B30;
  --color-orange: #FF9500;
  --color-gray: #8E8E93;
  
  /* Colors - Decart Palette */
  --color-neutral-50: #F8F9FA;
  --color-neutral-100: #E9ECEF;
  --color-neutral-200: #DEE2E6;
  --color-neutral-800: #2D2D2D;
  --color-neutral-900: #1A1A1A;
  
  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  
  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.15), 0 5px 10px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 40px rgba(0, 0, 0, 0.2), 0 10px 20px rgba(0, 0, 0, 0.15);
  
  /* Border Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
  
  /* Transitions */
  --transition-fast: 150ms cubic-bezier(0.4, 0.0, 0.2, 1);
  --transition-base: 200ms cubic-bezier(0.4, 0.0, 0.2, 1);
  --transition-slow: 300ms cubic-bezier(0.4, 0.0, 0.2, 1);
  
  /* Glassmorphism */
  --glass-bg: rgba(255, 255, 255, 0.1);
  --glass-border: rgba(255, 255, 255, 0.2);
  --glass-blur: blur(10px);
}
```

## Accessibility Features

- **WCAG AA Compliance**: All color contrasts meet standards
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader**: Proper ARIA labels and roles
- **Focus Indicators**: Clear, visible focus states
- **Touch Targets**: Minimum 44x44pt for all interactive elements
- **Reduced Motion**: Respects `prefers-reduced-motion`

## Integration with Luna Ecosystem

Works seamlessly with:
- **`luna-hig`** - HIG compliance analysis
- **`luna-ui-test`** - Automated UI testing
- **`luna-ui-fix`** - Automated UI corrections
- **`luna-design-architect`** - Design architecture
- **`luna-accessibility-auditor`** - Accessibility compliance

## Quality Checklist

- [ ] All components follow Apple HIG principles
- [ ] Decart design aesthetics applied consistently
- [ ] Typography system implemented correctly
- [ ] Color palette follows design system
- [ ] Spacing adheres to 8px grid
- [ ] Touch targets meet minimum sizes
- [ ] Animations are smooth and purposeful
- [ ] Glassmorphism effects work across browsers
- [ ] Accessibility standards met
- [ ] Responsive design implemented
- [ ] Dark mode support included
- [ ] Performance optimized

## Output Summary

After conversion, you'll receive:
- **Conversion Report**: Detailed summary of changes
- **Design System**: Complete design tokens and guidelines
- **Component Library**: Converted components with examples
- **Migration Guide**: Step-by-step implementation guide
- **Before/After**: Visual comparison of changes

Transform your UI into a polished, modern interface with Apple HIG + Decart design! 🎨✨
