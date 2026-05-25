import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { Input } from './input'

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Input component with validation, labels, and error states.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'tel', 'url'],
      description: 'Input type',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the input is disabled',
    },
    required: {
      control: 'boolean',
      description: 'Whether the input is required',
    },
    label: {
      control: 'text',
      description: 'Input label',
    },
    description: {
      control: 'text',
      description: 'Helper text description',
    },
    error: {
      control: 'text',
      description: 'Error message',
    },
  },
  args: {
    placeholder: 'Enter text...',
  },
}

export default meta
type Story = StoryObj<typeof meta>

// Default input
export const Default: Story = {
  args: {
    placeholder: 'Enter your name',
  },
}

// With label
export const WithLabel: Story = {
  args: {
    label: 'Full Name',
    placeholder: 'Enter your full name',
  },
}

// With description
export const WithDescription: Story = {
  args: {
    label: 'Email Address',
    type: 'email',
    placeholder: 'Enter your email',
    description: 'We\'ll never share your email with anyone else.',
  },
}

// With error
export const WithError: Story = {
  args: {
    label: 'Password',
    type: 'password',
    placeholder: 'Enter your password',
    error: 'Password must be at least 8 characters long',
  },
}

// Email input
export const EmailInput: Story = {
  args: {
    label: 'Email',
    type: 'email',
    placeholder: 'your.email@example.com',
    required: true,
  },
}

// Password input
export const PasswordInput: Story = {
  args: {
    label: 'Password',
    type: 'password',
    placeholder: 'Enter a strong password',
    required: true,
  },
}

// Disabled input
export const Disabled: Story = {
  args: {
    label: 'Disabled Field',
    placeholder: 'This field is disabled',
    disabled: true,
    value: 'Disabled value',
  },
}

// Number input
export const NumberInput: Story = {
  args: {
    label: 'Age',
    type: 'number',
    placeholder: 'Enter your age',
    min: 1,
    max: 120,
  },
}

// All types
export const AllTypes: Story = {
  render: () => (
    <div className="space-y-4 w-80">
      <Input label="Text" placeholder="Enter text" />
      <Input label="Email" type="email" placeholder="email@example.com" />
      <Input label="Password" type="password" placeholder="Enter password" />
      <Input label="Number" type="number" placeholder="123" />
      <Input label="Phone" type="tel" placeholder="+1 (555) 000-0000" />
      <Input label="Website" type="url" placeholder="https://example.com" />
    </div>
  ),
}

// Form example
export const FormExample: Story = {
  render: () => (
    <form className="space-y-4 w-80">
      <Input
        label="Full Name"
        placeholder="John Doe"
        required
      />
      <Input
        label="Email"
        type="email"
        placeholder="john.doe@example.com"
        description="We'll use this to contact you about your account."
        required
      />
      <Input
        label="Password"
        type="password"
        placeholder="Enter a strong password"
        error="Password must be at least 8 characters"
        required
      />
      <Input
        label="Company"
        placeholder="Acme Inc."
        description="Optional: helps us personalize your experience."
      />
    </form>
  ),
}
