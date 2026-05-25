# luna-hig - Apple Human Interface Guidelines Designer

## Command Overview

The `luna-hig` command provides comprehensive Apple Human Interface Guidelines (HIG) compliance analysis and implementation guidance for your projects. It helps ensure your applications follow Apple's design principles for creating polished, professional user experiences on Apple platforms.

## What This Command Does

- **HIG Compliance Analysis**: Analyzes your UI components and layouts against Apple HIG standards
- **Design System Recommendations**: Provides specific guidance for typography, colors, spacing, and motion
- **Accessibility Compliance**: Ensures your design meets Apple's accessibility requirements
- **Component Library**: Generates Apple HIG-compliant components and patterns
- **Code Generation**: Creates implementation-ready CSS/Tailwind and React components

## Usage Instructions

### Basic HIG Analysis
```bash
luna-hig
```
Analyzes the current project for HIG compliance and provides recommendations.

### Component-Specific Analysis
```bash
luna-hig component [component-name]
```
Provides detailed HIG guidance for specific UI components (buttons, cards, navigation, etc.).

### Design System Implementation
```bash
luna-hig design-system
```
Generates a complete Apple HIG-compliant design system for your project.

### Accessibility Review
```bash
luna-hig accessibility
```
Performs comprehensive accessibility analysis based on Apple's guidelines.

### Color Palette Analysis
```bash
luna-hig colors
```
Analyzes and suggests color improvements following Apple's semantic color system.

### Typography Guidelines
```bash
luna-hig typography
```
Provides typography recommendations using Apple's San Francisco font scale.

### Layout and Spacing
```bash
luna-hig layout
```
Analyzes layouts and provides spacing recommendations based on Apple's grid system.

### Motion and Animation
```bash
luna-hig motion
```
Provides guidance for animations and transitions following Apple's motion principles.

## Apple HIG Core Principles

### 1. Clarity
- **Typography**: Text is legible at all sizes, use system fonts
- **Icons**: Precise, simple, and immediately recognizable  
- **Negative Space**: Ample padding makes content breathable
- **Contrast**: Sufficient contrast for readability (WCAG AA minimum)

### 2. Deference
- **Content First**: UI should never compete with content
- **Translucency**: Blur effects provide context without distraction
- **Minimal Chrome**: Reduce UI elements to essentials
- **Full-Screen**: Content fills the entire screen

### 3. Depth
- **Layering**: Use shadows and elevation to show hierarchy
- **Motion**: Realistic animations convey spatial relationships
- **Transitions**: Maintain context during navigation
- **Z-axis**: Stack elements naturally

## Design System Elements

### Typography
- **Font Family**: San Francisco (SF Pro), system fonts
- **Scale**: 11, 13, 15, 17, 20, 24, 28, 34, 48, 60pt
- **Weights**: Regular (400), Medium (500), Semibold (600), Bold (700)
- **Line Height**: 1.2–1.5 for body text
- **Letter Spacing**: Tight for large headings, normal for body

### Color Palette
- **System Colors:**
  - Blue: `#007AFF` (Primary action)
  - Green: `#34C759` (Success)
  - Red: `#FF3B30` (Destructive)
  - Orange: `#FF9500` (Warning)
  - Gray: `#8E8E93` (Secondary text)
- **Semantic Usage:**
  - Primary buttons: Blue
  - Success states: Green
  - Destructive actions: Red
  - Disabled states: Gray with reduced opacity

### Spacing System
- **Base Unit**: 4px or 8px
- **Common Spacings**: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px
- **Padding**: 16px standard, 20-24px for comfortable spacing
- **Margins**: 8-16px between related elements

### Layout Grid
- **Mobile**: 4-column grid, 16px margins
- **Tablet**: 8-column grid, 20px margins
- **Desktop**: 12-column grid, 24px margins
- **Gutters**: 16-20px between columns

### Advanced Layout Patterns

#### Navigation Layouts
- **Tab Bar**: 49pt height, 5-7 items max, icons with labels
- **Navigation Bar**: 44pt compact, 96pt large title
- **Sidebar Navigation**: 280pt minimum width, hierarchical structure
- **Floating Navigation**: 44pt touch targets, glassmorphism effect

#### Content Layouts
- **List Views**: 44pt row height, leading edge icons, trailing chevrons
- **Grid Layouts**: Flexible item sizing, 8pt spacing, 2-4 columns
- **Card Grids**: 16pt gutters, consistent aspect ratios
- **Masonry Layouts**: Variable heights, 4pt spacing baseline

#### Forms Layouts
- **Input Fields**: 44pt height, 16pt labels, clear button on right
- **Form Sections**: 16pt spacing between sections, 8pt within
- **Toggle Switches**: 51pt width, 31pt height, animated thumb
- **Picker Views**: 216pt height, wheel-style selection

#### Modal Layouts
- **Alert Controllers**: Centered, 270pt minimum width
- **Action Sheets**: Bottom sheet, 44pt button height
- **Popover Controllers**: Arrow pointing, content padding
- **Full Screen Modals**: Edge-to-edge content, navigation bar

#### Collection Layouts
- **Table View**: Grouped vs Plain sections, headers/footers
- **Collection View**: Flexible layouts, compositional layout
- **Stack Views**: Horizontal/vertical, spacing and alignment
- **Split Views**: Master-detail, sidebar detail, triple column

#### Floating UI Patterns
- **Floating Panels**: 12pt corner radius, drop shadows, drag handles
- **Context Menus**: 44pt menu items, icons with labels
- **Tooltips**: 12pt padding, 8pt corner radius, arrows
- **Callouts**: Pointing arrows, dismissible content

#### Adaptive Layouts
- **Dynamic Type**: Support 200-300% text scaling
- **Size Classes**: Compact vs Regular layouts
- **Orientation Changes**: Seamless transitions
- **Multi-window**: iPad split view, slide over

### Touch Targets
- **Minimum Size**: 44x44pt (iOS), 48x48dp (Android)
- **Comfortable Size**: 48x48pt or larger
- **Spacing**: 8px minimum between interactive elements

### Elevation & Shadows
```css
/* Light elevation */
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12),
            0 1px 2px rgba(0, 0, 0, 0.24);

/* Medium elevation */
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1),
            0 2px 4px rgba(0, 0, 0, 0.06);

/* High elevation */
box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15),
            0 5px 10px rgba(0, 0, 0, 0.1);
```

### Motion & Animation
- **Duration**: 200-300ms for micro-interactions, 400-500ms for transitions
- **Easing**: `cubic-bezier(0.4, 0.0, 0.2, 1)` for natural motion
- **Spring Animations**: For playful, responsive interactions
- **Fade + Scale**: Entrance animations (fade from 0.95 to 1)

```css
.button {
  transition: all 200ms cubic-bezier(0.4, 0.0, 0.2, 1);
}

.button:hover {
  transform: scale(1.02);
}

.button:active {
  transform: scale(0.98);
}
```

## Accessibility Requirements

### Visual Accessibility
- **Color Contrast**: WCAG AA minimum (4.5:1 for normal text)
- **Touch Targets**: Minimum 44x44pt for all interactive elements
- **Text Scaling**: Support Dynamic Type up to 300%
- **Focus Indicators**: Clear, visible focus states

### Motion Accessibility
- **Reduce Motion**: Respect `prefers-reduced-motion` setting
- **Alternative Text**: Provide descriptions for visual content
- **Screen Reader**: Support VoiceOver navigation

## Component Patterns

### Primary Button
- Background: System blue (`#007AFF`)
- Text: White, Semibold weight
- Height: 44pt minimum
- Corner radius: 8-12pt
- Touch feedback: Scale animation

### Secondary Button  
- Background: Transparent or light gray
- Text: System blue
- Border: 1pt system blue
- Same dimensions as primary button

### Card Component
- Background: White or system background
- Corner radius: 12-16pt
- Shadow: Light elevation
- Padding: 16-20pt
- Border: None (subtle)

### Navigation Bar
- Height: 44pt (compact), 96pt (large)
- Background: System background with blur
- Title: Large title or navigation title
- Button height: 44pt

### Tab Bar
- Height: 49pt (iPhone), 50pt (iPad)
- Background: Blur effect with translucency
- Items: 5 maximum, icons with labels
- Active state: Blue tint with scale animation

### List Item
- Height: 44pt minimum
- Structure: Leading icon, title, subtitle, trailing accessory
- Separators: 1pt hairline, 16pt inset
- Selection: Highlight with disclosure indicators

### Card Component
- Background: White or system background
- Corner radius: 12-16pt
- Shadow: Light elevation with blur
- Padding: 16-20pt
- Border: None (subtle) or minimal stroke

### Modal Components
- Alert: Centered, 270pt minimum width
- Action Sheet: Bottom sheet, 44pt buttons
- Popover: Arrow pointing, rounded corners
- Full Screen: Edge-to-edge with navigation

### Floating Components
- Panel: 12pt corner radius, shadow, drag handle
- Button: 56pt circular (FAB), drop shadow
- Search Bar: 44pt height, rounded corners
- Context Menu: 8pt corner radius, blur background

## Implementation Guidelines

### CSS/Tailwind Implementation
```css
/* Typography scale */
.text-xs { font-size: 11px; }
.text-sm { font-size: 13px; }
.text-base { font-size: 15px; }
.text-lg { font-size: 17px; }
.text-xl { font-size: 20px; }
.text-2xl { font-size: 24px; }
.text-3xl { font-size: 28px; }
.text-4xl { font-size: 34px; }
.text-5xl { font-size: 48px; }

/* Spacing scale */
.p-1 { padding: 4px; }
.p-2 { padding: 8px; }
.p-3 { padding: 12px; }
.p-4 { padding: 16px; }
.p-5 { padding: 20px; }
.p-6 { padding: 24px; }
.p-8 { padding: 32px; }
.p-10 { padding: 40px; }
.p-12 { padding: 48px; }

/* System colors */
.text-blue { color: #007AFF; }
.text-green { color: #34C759; }
.text-red { color: #FF3B30; }
.text-orange { color: #FF9500; }
.text-gray { color: #8E8E93; }

/* Elevations */
.shadow-sm { /* Light elevation */ }
.shadow-md { /* Medium elevation */ }
.shadow-lg { /* High elevation */ }
```

### React Component Examples
```jsx
// HIG Compliant Button
const Button = ({ variant = 'primary', size = 'medium', children, ...props }) => {
  const baseClasses = 'font-semibold rounded-lg transition-all duration-200';
  const sizeClasses = {
    small: 'px-3 py-2 text-sm',
    medium: 'px-4 py-3 text-base',
    large: 'px-6 py-4 text-lg'
  };
  
  const variantClasses = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    secondary: 'border border-blue-500 text-blue-500 hover:bg-blue-50',
    destructive: 'bg-red-500 text-white hover:bg-red-600'
  };
  
  return (
    <button 
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]}`}
      style={{ minHeight: '44px' }}
      {...props}
    >
      {children}
    </button>
  );
};

// HIG Compliant Card
const Card = ({ children, className = '', ...props }) => (
  <div 
    className={`bg-white rounded-xl shadow-md p-4 ${className}`}
    {...props}
  >
    {children}
  </div>
);
```

## Testing and Validation

### Automated Checks
- Color contrast validation
- Touch target size verification
- Typography scale consistency
- Spacing system adherence
- Accessibility compliance

### Manual Review
- Visual hierarchy assessment
- Motion animation quality
- User flow navigation
- Context and depth evaluation
- Platform-specific considerations

## Luna Agent Integration

When you run `luna-hig`, the agent will:

1. **Prompt for scope**: Ask whether to analyze entire project or specific component
2. **Prompt for analysis type**: Choose from 8 analysis types
3. **Scan project**: Analyze existing UI components and styles
4. **Generate reports**: Create comprehensive HIG analysis documentation
5. **Provide examples**: Offer implementation-ready code and guidelines

### Output Files
- `.luna/{project}/hig-analysis.md` - Comprehensive compliance reports
- `.luna/{project}/design-system/hig-tokens.md` - Design tokens and specifications
- `.luna/{project}/design-system/components.md` - HIG-compliant component library
- `.luna/{project}/{component}/hig-analysis.md` - Component-specific analysis

## Resources

- **Official Apple HIG**: https://developer.apple.com/design/human-interface-guidelines
- **San Francisco Font**: https://developer.apple.com/fonts/
- **Color System**: https://developer.apple.com/design/human-interface-guidelines/color
- **Accessibility**: https://developer.apple.com/accessibility/

## Examples and Templates

The `luna-hig` command can generate:
- Complete component libraries
- Design system documentation
- CSS/Tailwind configuration
- React/Vue/Svelte components
- Storybook documentation
- Accessibility test suites

Use `luna-hig help [topic]` for specific guidance on any of these areas.

## Recommended Luna Agents for UI/UX Design

### Core Design Agents
- **`luna-requirements`** - Analyze user requirements for design decisions
- **`luna-design-architect`** - Create comprehensive technical design specifications
- **`luna-hig`** - Ensure Apple HIG compliance and design system implementation

### Specialized UI Agents

#### **`luna-layout-designer`** - Layout Architecture Specialist
**Capabilities**:
- Grid system design and responsive layouts
- Information architecture and content hierarchy
- Navigation flow and user journey mapping
- Multi-device layout optimization

**Use Cases**:
- Complex dashboard layouts
- Multi-step form flows
- Content-heavy applications
- Data visualization interfaces

#### **`luna-component-designer`** - Component System Architect
**Capabilities**:
- Atomic design system creation
- Component library architecture
- Design token system implementation
- Component variant and state management

**Use Cases**:
- Design system implementation
- Component library development
- UI consistency across applications
- Design token management

#### **`luna-interaction-designer`** - Animation and Motion Specialist
**Capabilities**:
- Micro-interaction design and implementation
- Gesture-based interface patterns
- Loading states and transition animations
- Spatial interface design

**Use Cases**:
- Mobile app animations
- Gesture-based interactions
- Loading and state transitions
- Spatial user interfaces

#### **`luna-accessibility-auditor`** - Accessibility Compliance Expert
**Capabilities**:
- WCAG and Apple accessibility compliance
- Screen reader optimization
- Voice Control and Switch Control support
- Reduced motion and high contrast modes

**Use Cases**:
- Accessibility compliance audits
- Screen reader optimization
- Alternative input method support
- Inclusive design implementation

#### **`luna-responsive-designer`** - Multi-Device Layout Specialist
**Capabilities**:
- Responsive design strategy and implementation
- Device-specific layout optimization
- Touch vs mouse interaction patterns
- Cross-platform consistency

**Use Cases**:
- Responsive web applications
- Cross-platform mobile apps
- Adaptive interface design
- Multi-device user experiences

#### **`luna-visual-designer`** - Visual Identity and Branding
**Capabilities**:
- Visual design system creation
- Brand guideline implementation
- Icon and illustration design
- Visual hierarchy and composition

**Use Cases**:
- Brand identity implementation
- Visual design systems
- Icon library creation
- Marketing material design

### Workflow Integration

#### **Design Phase Workflow**:
1. `luna-requirements` - Define user needs and requirements
2. `luna-design-architect` - Create technical specifications
3. `luna-layout-designer` - Design information architecture
4. `luna-hig` - Ensure Apple HIG compliance
5. `luna-component-designer` - Build component system

#### **Implementation Phase Workflow**:
1. `luna-interaction-designer` - Design animations and transitions
2. `luna-accessibility-auditor` - Ensure accessibility compliance
3. `luna-responsive-designer` - Optimize for multiple devices
4. `luna-visual-designer` - Finalize visual design

#### **Quality Assurance Workflow**:
1. `luna-accessibility-auditor` - Accessibility testing
2. `luna-testing-validation` - UI testing and validation
3. `luna-monitoring-observability` - Performance monitoring
4. `luna-post-launch-review` - Post-launch analysis

### Agent Combinations for Different Project Types

#### **Mobile App Development**:
```bash
luna-requirements
luna-design-architect
luna-hig
luna-interaction-designer
luna-accessibility-auditor
```

#### **Web Application Development**:
```bash
luna-requirements
luna-design-architect
luna-responsive-designer
luna-component-designer
luna-accessibility-auditor
```

#### **Design System Implementation**:
```bash
luna-hig
luna-component-designer
luna-visual-designer
luna-accessibility-auditor
luna-testing-validation
```

#### **Complex Dashboard Development**:
```bash
luna-requirements
luna-layout-designer
luna-hig
luna-responsive-designer
luna-interaction-designer
```

## Integration with Luna Ecosystem

The `luna-hig` agent works seamlessly with other Luna agents:
- Use after `luna-requirements` for design phase
- Complements `luna-design-architect` with UI-specific guidance
- Supports `luna-testing-validation` for accessibility testing
- Integrates with `luna-deployment` for design system assets

### Specialized Agent Features

#### **Layout Analysis Types**:
- `luna-hig layout navigation` - Navigation and information architecture
- `luna-hig layout forms` - Form layouts and input patterns
- `luna-hig layout content` - Content display and hierarchy
- `luna-hig layout floating` - Floating UI elements and overlays

#### **Component Analysis Types**:
- `luna-hig components navigation` - Navigation bars, tabs, sidebars
- `luna-hig components lists` - Table views, collection views
- `luna-hig components controls` - Buttons, inputs, controls
- `luna-hig components modals` - Alerts, sheets, popovers

#### **Platform-Specific Analysis**:
- `luna-hig platform ios` - iOS-specific HIG guidelines
- `luna-hig platform macos` - macOS-specific patterns
- `luna-hig platform ipados` - iPadOS multi-window patterns
- `luna-hig platform web` - Web adaptation of HIG principles

Transform your project's UI to meet Apple's world-class design standards with `luna-hig` and the complete Luna design ecosystem! 🌙🎨