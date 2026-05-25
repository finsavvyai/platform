import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  title: 'Atoms/Badge',
  component: Badge,
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'success', 'warning', 'danger', 'info', 'outline'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Success: Story = {
  args: { children: 'Passed', variant: 'success' },
};

export const Danger: Story = {
  args: { children: 'Failed', variant: 'danger' },
};

export const Warning: Story = {
  args: { children: 'Flaky', variant: 'warning' },
};

export const Info: Story = {
  args: { children: 'Running', variant: 'info' },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="success">Passed</Badge>
      <Badge variant="danger">Failed</Badge>
      <Badge variant="warning">Flaky</Badge>
      <Badge variant="info">Running</Badge>
      <Badge variant="outline">Draft</Badge>
      <Badge>Default</Badge>
    </div>
  ),
};

export const TestStatus: Story = {
  render: () => (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-white text-sm w-32">Login Flow</span>
        <Badge variant="success" size="sm">Passed</Badge>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-white text-sm w-32">Checkout</span>
        <Badge variant="danger" size="sm">Failed</Badge>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-white text-sm w-32">Dashboard</span>
        <Badge variant="warning" size="sm">72% Flaky</Badge>
      </div>
    </div>
  ),
};
