import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card'

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Card component with header, content, and footer sections.',
      },
    },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Card>

// Basic card
export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card Description</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This is the content of the card. It can contain any type of content.</p>
      </CardContent>
    </Card>
  ),
}

// Card with footer
export const WithFooter: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Account Settings</CardTitle>
        <CardDescription>Manage your account preferences</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Update your profile information and security settings here.</p>
      </CardContent>
      <CardFooter>
        <Button className="w-full">Save Changes</Button>
      </CardFooter>
    </Card>
  ),
}

// Card with actions
export const WithActions: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Delete Account</CardTitle>
        <CardDescription>This action cannot be undone</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Permanently delete your account and all associated data.</p>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button variant="outline" className="flex-1">
          Cancel
        </Button>
        <Button variant="destructive" className="flex-1">
          Delete Account
        </Button>
      </CardFooter>
    </Card>
  ),
}

// Minimal card
export const Minimal: Story = {
  render: () => (
    <Card className="w-64">
      <CardContent className="pt-6">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
            <span className="text-primary-foreground font-bold text-xl">SD</span>
          </div>
          <h3 className="text-lg font-semibold mb-2">Welcome</h3>
          <p className="text-sm text-muted-foreground">Get started with your new account.</p>
        </div>
      </CardContent>
    </Card>
  ),
}

// Stats card
export const StatsCard: Story = {
  render: () => (
    <Card className="w-64">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl font-bold">1,234</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Total Users</p>
        <p className="text-xs text-green-600 mt-1">+12% from last month</p>
      </CardContent>
    </Card>
  ),
}

// Feature card
export const FeatureCard: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
          <span className="text-blue-600 text-xl">📊</span>
        </div>
        <CardTitle>Advanced Analytics</CardTitle>
        <CardDescription>
          Get insights into your usage patterns and performance metrics.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          <li>• Real-time data visualization</li>
          <li>• Custom report generation</li>
          <li>• Export to multiple formats</li>
        </ul>
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full">
          Learn More
        </Button>
      </CardFooter>
    </Card>
  ),
}

// Card grid
export const CardGrid: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>Overview of your account</CardDescription>
        </CardHeader>
        <CardContent>
          <p>View your key metrics and recent activity at a glance.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>Manage your projects</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Create, organize, and track all your projects in one place.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Configure preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Customize your experience and manage account settings.</p>
        </CardContent>
      </Card>
    </div>
  ),
}
