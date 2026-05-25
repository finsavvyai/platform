# Apple Human Interface Guidelines (HIG) Theme System

This document explains how Qestro's theme system follows Apple's Human Interface Guidelines for professional, accessible, and beautiful design.

## Overview

Qestro now includes **14 professional themes**, including 6 themes specifically designed following Apple's Human Interface Guidelines for iOS and macOS.

## Apple HIG Principles Applied

### 1. **Clarity**
- High contrast ratios between text and backgrounds (WCAG AAA compliance)
- Clear visual hierarchy with primary, secondary, and tertiary text colors
- Distinct interactive states (hover, focus, active)

### 2. **Deference**
- Content-first design with subtle UI elements
- Backgrounds recede to highlight user content
- Minimal use of decorative elements

### 3. **Depth**
- Layered backgrounds (primary → secondary → tertiary)
- Elevation through subtle shadows and borders
- Visual depth without relying on skeuomorphism

## Apple HIG-Compliant Themes

### 1. **Apple System Blue** (`appleSystemBlue`)
**Colors from:** iOS Design Resources
**Use case:** iOS-style applications, mobile-first interfaces

- **Brand Primary:** `#007AFF` - iOS system blue
- **Backgrounds:** Black (`#000000`) with elevated layers (`#1C1C1E`, `#2C2C2E`)
- **Text:** Pure white with opacity-based secondary colors
- **Status Colors:** iOS semantic colors (green `#34C759`, red `#FF3B30`, etc.)

**HIG Alignment:**
- ✅ Uses exact iOS system colors
- ✅ Follows iOS dark mode specifications
- ✅ 60% and 30% opacity for label hierarchy
- ✅ iOS separator color `#38383A`

### 2. **macOS Graphite** (`macOSGraphite`)
**Colors from:** macOS Appearance Preferences
**Use case:** Professional desktop applications, productivity tools

- **Brand Primary:** `#8E8E93` - macOS graphite accent
- **Backgrounds:** macOS dark window colors (`#1E1E1E`, `#252525`)
- **Sidebar:** Distinct sidebar background (`#191919`)
- **Status Colors:** macOS Big Sur/Monterey/Ventura semantic colors

**HIG Alignment:**
- ✅ Follows macOS graphite appearance option
- ✅ Uses macOS dark mode window backgrounds
- ✅ Distinct sidebar treatment per macOS conventions
- ✅ macOS vibrant semantic colors

### 3. **Apple Mint** (`appleMint`)
**Colors from:** iOS/macOS mint accent color
**Use case:** Fresh, modern applications, health/wellness apps

- **Brand Primary:** `#00C7BE` - iOS mint
- **Accent:** `#30D158` - iOS green
- **Backgrounds:** Deep teal with mint undertones
- **Visual Feel:** Fresh, calm, professional

**HIG Alignment:**
- ✅ Uses iOS mint system color
- ✅ Maintains high contrast ratios
- ✅ Follows semantic color conventions

### 4. **Apple Indigo Night** (`appleIndigoNight`)
**Colors from:** iOS indigo system color
**Use case:** Sophisticated, premium applications

- **Brand Primary:** `#5E5CE6` - iOS indigo
- **Accent:** `#BF5AF2` - iOS purple
- **Backgrounds:** Deep indigo night palette
- **Visual Feel:** Sophisticated, modern, premium

**HIG Alignment:**
- ✅ iOS indigo color as primary
- ✅ Complementary purple accent
- ✅ Deep, professional backgrounds

### 5. **Apple Teal Pro** (`appleTealPro`)
**Colors from:** iOS teal system color
**Use case:** Medical, scientific, professional applications

- **Brand Primary:** `#5AC8FA` - iOS teal
- **Backgrounds:** Deep ocean blues with teal accents
- **Visual Feel:** Clinical, professional, trustworthy

**HIG Alignment:**
- ✅ iOS teal as primary brand color
- ✅ Professional color temperature
- ✅ High contrast for data visualization

### 6. **Apple Orange Warm** (`appleOrangeWarm`)
**Colors from:** iOS orange system color
**Use case:** Creative, media, energetic applications

- **Brand Primary:** `#FF9500` - iOS orange
- **Accent:** `#FF3B30` - iOS red
- **Backgrounds:** Warm earth tones
- **Visual Feel:** Energetic, creative, warm

**HIG Alignment:**
- ✅ iOS orange as primary
- ✅ Warm color palette
- ✅ Energy and creativity emphasis

## Additional Professional Themes

### 7. **TestQuality Dark** (Default)
Professional dark theme inspired by testing platforms

### 8. **Professional Light**
Clean, bright theme for traditional applications

### 9-14. **Color Themes**
Blue Ocean, Emerald Green, Purple Haze, Rose Pink, Amber Sunset, High Contrast Dark

## Color System Structure

All themes follow this consistent structure:

```typescript
interface Theme {
  name: string;
  id: string;
  colors: {
    // Brand Colors
    brandPrimary: string;        // Primary brand color
    brandPrimaryHover: string;   // Hover state
    brandPrimaryLight: string;   // Light variant
    brandAccent: string;         // Accent color

    // Backgrounds (Layered)
    bgPrimary: string;           // Main background
    bgSecondary: string;         // Cards, elevated content
    bgTertiary: string;          // Further elevated
    bgHover: string;             // Hover states
    bgSidebar: string;           // Sidebar background
    bgSidebarHover: string;      // Sidebar hover

    // Text (Hierarchical)
    textPrimary: string;         // Primary content
    textSecondary: string;       // Secondary content
    textMuted: string;           // Tertiary/muted content
    textInverse: string;         // Inverse (for buttons)

    // Status (Semantic)
    statusSuccess: string;       // Success states
    statusError: string;         // Error states
    statusWarning: string;       // Warning states
    statusInfo: string;          // Info states
    statusPending: string;       // Pending states

    // Borders
    borderColor: string;         // Default borders
    borderLight: string;         // Light borders
    borderSecondary: string;     // Secondary borders
    borderFocus: string;         // Focus rings
  };
}
```

## Accessibility Standards

All themes meet or exceed:

- **WCAG 2.1 Level AA** for contrast ratios
- **4.5:1** minimum for normal text
- **3:1** minimum for large text
- **3:1** minimum for UI components

Apple HIG themes specifically target:
- **7:1+** contrast for critical text (Level AAA)
- Support for increased contrast mode
- Color-blind friendly palettes

## Usage

### Applying a Theme

```typescript
import { applyTheme, themes } from './styles/themes';

// Apply Apple System Blue
applyTheme(themes.appleSystemBlue);

// Apply macOS Graphite
applyTheme(themes.macOSGraphite);
```

### Using the Theme Hook

```typescript
import { useTheme } from './hooks/useTheme';

function MyComponent() {
  const { currentTheme, changeTheme, availableThemes } = useTheme();

  return (
    <button onClick={() => changeTheme('appleSystemBlue')}>
      Switch to iOS Blue
    </button>
  );
}
```

### CSS Variables

All themes inject CSS variables that can be used throughout your styles:

```css
.my-component {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.my-button {
  background-color: var(--brand-primary);
  color: var(--text-inverse);
}

.my-button:hover {
  background-color: var(--brand-primary-hover);
}
```

## Apple HIG Design Resources

These themes reference official Apple design resources:

- [iOS Design Resources](https://developer.apple.com/design/resources/)
- [macOS Design Resources](https://developer.apple.com/design/resources/)
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [SF Symbols](https://developer.apple.com/sf-symbols/)

## Best Practices

### 1. **Maintain Consistency**
- Use theme variables instead of hardcoded colors
- Follow the established color hierarchy
- Use semantic status colors appropriately

### 2. **Respect User Preferences**
- Save theme selection to localStorage
- Consider system dark mode preferences
- Provide easy theme switching

### 3. **Test Across Themes**
- Verify all UI components work with all themes
- Check contrast ratios for custom components
- Ensure focus states are visible in all themes

### 4. **Follow Apple Guidelines**
- Use SF Pro or Inter for typography
- Maintain 8pt grid system
- Follow iOS/macOS spacing conventions
- Use appropriate corner radius (8px, 12px, 16px)

## Theme Switching Performance

- **Instant switching:** CSS variables update in real-time
- **No page reload:** Themes change without disruption
- **Persistent:** Preferences saved to localStorage
- **SSR-friendly:** Theme loads before first paint

## Future Enhancements

Potential additions following Apple HIG:

1. **Auto Dark/Light:** Respect system preferences
2. **Custom Accent Colors:** Allow user-defined brand colors
3. **Accessibility Overrides:** Increased contrast mode
4. **Animation Preferences:** Respect reduced motion
5. **Dynamic Type:** Scale with user font size preferences

## Resources

- Apple HIG: https://developer.apple.com/design/human-interface-guidelines/
- WCAG Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
- Color Contrast Checker: https://webaim.org/resources/contrastchecker/
