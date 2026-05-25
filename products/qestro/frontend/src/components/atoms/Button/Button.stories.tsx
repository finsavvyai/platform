import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';
import { Plus, Sparkles, Play, Loader2 } from 'lucide-react';

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'outline', 'ghost', 'danger', 'neon', 'glass'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    glow: { control: 'boolean' },
    isLoading: { control: 'boolean' },
    disabled: { control: 'boolean' },
    fullWidth: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { children: 'Run Test', variant: 'primary' },
};

export const Neon: Story = {
  args: { children: 'New Test Case', variant: 'neon', glow: true, leftIcon: <Plus size={16} /> },
};

export const Glass: Story = {
  args: { children: 'Filter', variant: 'glass' },
};

export const Secondary: Story = {
  args: { children: 'Generate with AI', variant: 'secondary', leftIcon: <Sparkles size={16} /> },
};

export const Danger: Story = {
  args: { children: 'Delete', variant: 'danger' },
};

export const Loading: Story = {
  args: { children: 'Running...', isLoading: true, variant: 'primary' },
};

export const WithIcons: Story = {
  args: { children: 'Run Test', leftIcon: <Play size={16} />, variant: 'primary' },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      {(['primary', 'secondary', 'outline', 'ghost', 'danger', 'neon', 'glass'] as const).map((v) => (
        <Button key={v} variant={v}>{v}</Button>
      ))}
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      {(['sm', 'md', 'lg'] as const).map((s) => (
        <Button key={s} size={s} variant="primary">{s}</Button>
      ))}
    </div>
  ),
};
