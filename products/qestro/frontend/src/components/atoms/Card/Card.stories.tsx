import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';

const meta: Meta<typeof Card> = {
  title: 'Atoms/Card',
  component: Card,
  argTypes: {
    variant: { control: 'select', options: ['default', 'glass', 'elevated', 'bordered'] },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    children: (
      <div className="p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Test Results</h3>
        <p className="text-gray-400">24 passed, 3 failed, 1 skipped</p>
      </div>
    ),
  },
};

export const Glass: Story = {
  args: {
    variant: 'glass',
    children: (
      <div className="p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Analytics</h3>
        <p className="text-gray-400">89% pass rate this week</p>
      </div>
    ),
  },
};

export const WithBorder: Story = {
  args: {
    className: 'p-6 border border-slate-700',
    children: (
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Visual Regression</h3>
        <p className="text-gray-400">3 baselines, 1 diff detected</p>
      </div>
    ),
  },
};
