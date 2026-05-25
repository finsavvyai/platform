---
name: ll-a11y
displayName: Luna Accessibility Audit
description: WCAG 2.2 AA/AAA accessibility audit — contrast, keyboard nav, ARIA, screen reader
version: 1.0.0
category: quality
agent: luna-hig
parameters:
  - name: target
    type: string
    description: File path, component, or page URL to audit
    required: true
    prompt: true
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
workflow:
  - scan_components
  - check_color_contrast
  - check_keyboard_navigation
  - check_aria_labels
  - check_screen_reader
  - check_focus_management
  - check_motion_preferences
  - generate_fixes
  - generate_a11y_report
output:
  - .luna/{current-project}/a11y-report.md
prerequisites: []
---

# Luna Accessibility Audit

Comprehensive WCAG 2.2 accessibility audit with auto-fix suggestions.

## What This Command Does

1. **Scan** — reads all components/pages for accessibility issues
2. **Contrast** — checks text/background color ratios (AA: 4.5:1, AAA: 7:1)
3. **Keyboard** — verifies tab order, focus indicators, keyboard shortcuts
4. **ARIA** — validates labels, roles, states, and properties
5. **Screen Reader** — checks alt text, live regions, announcements
6. **Focus** — validates focus trapping in modals, focus restoration
7. **Motion** — checks `prefers-reduced-motion` support
8. **Fix** — generates code fixes for each issue found
9. **Report** — WCAG compliance scorecard with severity levels

## Checks Performed

| Category | Checks |
|----------|--------|
| **Perceivable** | Alt text, captions, contrast, resize, orientation |
| **Operable** | Keyboard access, focus visible, skip links, timing |
| **Understandable** | Labels, error messages, consistent navigation |
| **Robust** | Valid HTML, ARIA usage, name/role/value |

## Usage

```
/a11y src/components/              # Audit all components
/a11y src/app/dashboard/page.tsx   # Audit specific page
/a11y http://localhost:3000        # Audit running app
```

## Severity Levels

- **Critical** — blocks users (missing alt, no keyboard access)
- **Major** — significant barrier (low contrast, missing labels)
- **Minor** — degraded experience (focus order, heading hierarchy)
