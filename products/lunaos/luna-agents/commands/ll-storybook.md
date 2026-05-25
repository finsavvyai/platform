---
name: ll-storybook
displayName: Luna Storybook
description: Generate Storybook stories for all components with variants, args, and docs
version: 1.0.0
category: documentation
agent: luna-documentation
parameters:
  - name: target
    type: string
    description: Component path or directory to generate stories for
    required: true
    prompt: true
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
workflow:
  - scan_components
  - analyze_props_and_variants
  - generate_stories
  - generate_docs_pages
  - configure_storybook
  - generate_storybook_report
output:
  - .luna/{current-project}/storybook/
  - .luna/{current-project}/storybook-report.md
prerequisites: []
---

# Luna Storybook

Generate a complete component catalog with Storybook.

## What This Command Does

1. **Scan** — finds all React/Vue/Svelte components
2. **Analyze** — extracts props, variants, states from TypeScript types
3. **Generate Stories** — creates `.stories.tsx` for each component
4. **Generate Docs** — creates MDX documentation pages
5. **Configure** — sets up Storybook config with addons
6. **Report** — lists all generated stories with coverage

## Story Structure

For each component, generates:

```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: 'primary', children: 'Click me' } };
export const Secondary: Story = { args: { variant: 'secondary', children: 'Click me' } };
export const Disabled: Story = { args: { disabled: true, children: 'Disabled' } };
export const Loading: Story = { args: { loading: true, children: 'Loading...' } };
```

## Usage

```
/storybook src/components/           # All components
/storybook src/components/Button.tsx # Specific component
```

## Features

- Auto-generates all variant combinations
- Adds accessibility addon checks
- Creates interaction tests (play functions)
- Responsive viewport stories
- Dark/light theme stories
