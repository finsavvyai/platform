import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { Button } from './button'

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Button component with multiple variants and sizes.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      description: 'Button visual style variant',
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
      description: 'Button size',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the button is disabled',
    },
    loading: {
      control: 'boolean',
      description: 'Whether the button is in loading state',
    },
    children: {
      control: 'text',
      description: 'Button content',
    },
  },
  args: {
    onClick: fn(),
    children: 'Button',
  },
}

export default meta
type Story = StoryObj<typeof meta>

// Default button
export const Default: Story = {
  args: {
    variant: 'default',
    children: 'Default Button',
  },
}

// Primary button
export const Primary: Story = {
  args: {
    variant: 'default',
    children: 'Primary Button',
  },
}

// Destructive button
export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Delete',
  },
}

// Outline button
export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline Button',
  },
}

// Ghost button
export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost Button',
  },
}

// Link button
export const Link: Story = {
  args: {
    variant: 'link',
    children: 'Link Button',
  },
}

// Small button
export const Small: Story = {
  args: {
    size: 'sm',
    children: 'Small Button',
  },
}

// Large button
export const Large: Story = {
  args: {
    size: 'lg',
    children: 'Large Button',
  },
}

// Icon button
export const Icon: Story = {
  args: {
    size: 'icon',
    children: '🚀',
  },
}

// Disabled button
export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Disabled Button',
  },
}

// Loading button
export const Loading: Story = {
  args: {
    loading: true,
    children: 'Loading...',
  },
}

// All variants
export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-2 flex-wrap">
      <Button variant="default">Default</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
}

// All sizes
export const AllSizes: Story = {
  render: () => (
    <div className="flex gap-2 items-center flex-wrap">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon">🚀</Button>
    </div>
  ),
}

// With icons
export const WithIcons: Story = {
  render: () => (
    <div className="flex gap-2 flex-wrap">
      <Button>
        <span className="mr-2">📝</span>
        Edit
      </Button>
      <Button variant="destructive">
        <span className="mr-2">🗑️</span>
        Delete
      </Button>
      <Button variant="outline">
        <span className="mr-2">📋</span>
        Copy
      </Button>
      <Button variant="ghost">
        <span className="mr-2">⚙️</span>
        Settings
      </Button>
    </div>
  ),
}
