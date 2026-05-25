# Qestro Design System & Theme Guide

## Overview
Qestro uses a "Liquid Glass" futuristic design system characterized by deep space backgrounds, neon accents, and extensive use of glassmorphism (backdrop blur, translucent layers). It is built on Tailwind CSS.

## Color Palette

### Background Colors
- **Space Black (Primary)**: `#030712` (`bg-bg-primary`) - Main page background
- **Deep Navy (Secondary)**: `#0B1121` (`bg-bg-secondary`) - Card backgrounds, specialized areas
- **Glass**: `rgba(11, 17, 33, 0.7)` (`bg-bg-glass`) - Overlay elements, standard cards

### Accent Colors (Neon)
- **Cyber Cyan (Primary)**: `#00F0FF` (`text-primary`, `border-primary`) - Primary actions, active states, glows
- **Electric Purple (Secondary)**: `#7000FF` (`text-secondary`) - Gradients, secondary highlights
- **Matrix Green**: `#00FF94` (`text-accent-green`) - Success states
- **Plasma Orange**: `#FF5E00` (`text-accent-orange`) - Warning/Attention
- **Hot Pink**: `#FF0099` (`text-accent-pink`) - Special alerts or highlights

### Text Colors
- **White**: `#FFFFFF` (`text-text-primary`) - Primary headings and body
- **Slate-400**: `#94A3B8` (`text-text-secondary`) - Secondary text, labels
- **Slate-500**: `#64748B` (`text-text-muted`) - Muted info, placeholders

### Borders
- **Glass Border**: `rgba(255, 255, 255, 0.08)` (`border-border`) - Default container borders
- **Light Border**: `rgba(255, 255, 255, 0.15)` (`border-border-light`) - Hover states or inputs
- **Neon Glow**: `rgba(0, 240, 255, 0.3)` (`border-border-glow`) - Focused states, active elements

## Core Components

### Glass Card
```tsx
<div className="card-glass p-6">
  <h2 className="text-xl font-bold text-white">Title</h2>
</div>
// Uses: bg-bg-glass, backdrop-blur-xl, border-white/5
```

### Neon Button
```tsx
<Button variant="neon" glow>
  Action
</Button>
// Uses: linear-gradient backgrounds, text-shadows, box-shadows
```

### Inputs
```tsx
<input className="input-glass" placeholder="Type here..." />
// Uses: bg-black/20, border-white/10, focus:border-primary/50
```

## CSS Variables
Defined in `frontend/src/index.css`, these map to the semantic names above.

## Tailwind Configuration
Colors are extended in `frontend/tailwind.config.js` under `colors.bg`, `colors.primary`, etc.

## Best Practices
1. **Avoid Hardcoded Hex**: Use `bg-bg-primary`, `text-primary`, `border-border` etc.
2. **Use Glass Classes**: Use `.card-glass`, `.input-glass` utility classes when possible.
3. **Animations**: Leverage `framer-motion` for entrances and interactions, or standard tailwind `animate-pulse` / `animate-glow`.

