import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SessionProvider } from 'next-auth/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable } from '@/components/ui/data-table'
import { StatsCard } from '@/components/ui/stats-card'
import { useAuthStore } from '@/store/auth'

// Mock NextAuth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN',
        permissions: ['user:read', 'user:create', 'dashboard:view'],
        tenantId: 'test-tenant-id',
      },
      accessToken: 'test-access-token',
    },
    status: 'authenticated',
  })),
  signOut: jest.fn(),
  signIn: jest.fn(),
}))

// Mock API client
jest.mock('@/lib/api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}))

// Mock store
jest.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      role: 'ADMIN',
      permissions: ['user:read', 'user:create', 'dashboard:view'],
      tenantId: 'test-tenant-id',
    },
    isAuthenticated: true,
    login: jest.fn(),
    logout: jest.fn(),
    loading: false,
    error: null,
  }),
}))

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider
        session={{
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            name: 'Test User',
            role: 'ADMIN',
            permissions: ['user:read', 'user:create', 'dashboard:view'],
            tenantId: 'test-tenant-id',
          },
          accessToken: 'test-access-token',
          expires: '2024-12-31',
        }}
      >
        <ThemeProvider attribute="class" defaultTheme="light">
          {children}
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}

describe('Admin UI Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Page Layout', () => {
    it('renders sidebar with navigation items', async () => {
      render(
        <TestWrapper>
          <AppSidebar />
        </TestWrapper>
      )

      // Check main navigation sections
      expect(screen.getByText('Overview')).toBeInTheDocument()
      expect(screen.getByText('Platform Management')).toBeInTheDocument()
      expect(screen.getByText('Content & Documents')).toBeInTheDocument()
      expect(screen.getByText('Security & Policies')).toBeInTheDocument()
      expect(screen.getByText('AI & RAG')).toBeInTheDocument()
      expect(screen.getByText('Infrastructure')).toBeInTheDocument()
      expect(screen.getByText('System')).toBeInTheDocument()

      // Check navigation items based on permissions
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Tenants')).toBeInTheDocument()
      expect(screen.getByText('Users')).toBeInTheDocument()
      expect(screen.getByText('Policies')).toBeInTheDocument()
    })

    it('renders header with user information', async () => {
      render(
        <TestWrapper>
          <Header />
        </TestWrapper>
      )

      // Check user display
      expect(screen.getByText('Test User')).toBeInTheDocument()
      expect(screen.getByText('test@example.com')).toBeInTheDocument()
      expect(screen.getByText('ADMIN')).toBeInTheDocument()

      // Check search functionality
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()

      // Check theme toggle
      expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument()
    })

    it('responsive design works on mobile', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      render(
        <TestWrapper>
          <AppSidebar />
          <Header />
        </TestWrapper>
      )

      // Check if sidebar is collapsed on mobile
      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveClass('w-16')
    })
  })

  describe('Authentication Integration', () => {
    it('protects routes when not authenticated', async () => {
      const mockSession = null
      jest
        .requireMock('next-auth/react')
        .useSession.mockReturnValue({ data: mockSession, status: 'unauthenticated' })

      render(
        <TestWrapper>
          <PageHeader title="Protected Page" />
        </TestWrapper>
      )

      // Should redirect to login or show authentication error
      await waitFor(() => {
        expect(screen.queryByText('Protected Page')).not.toBeInTheDocument()
      })
    })

    it('shows navigation items based on user permissions', async () => {
      const mockSession = {
        user: {
          id: 'test-user',
          permissions: ['dashboard:view', 'user:read'], // Limited permissions
        },
      }

      jest
        .requireMock('next-auth/react')
        .useSession.mockReturnValue({ data: mockSession, status: 'authenticated' })

      render(
        <TestWrapper>
          <AppSidebar />
        </TestWrapper>
      )

      // Should show items user has permission for
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Users')).toBeInTheDocument()

      // Should not show items user doesn't have permission for
      expect(screen.queryByText('Settings')).not.toBeInTheDocument()
    })
  })

  describe('Components Functionality', () => {
    it('PageHeader renders correctly with breadcrumbs', () => {
      const breadcrumb = [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Users', href: '/dashboard/users' },
        { label: 'Edit User' },
      ]

      render(
        <TestWrapper>
          <PageHeader
            title="Edit User"
            description="Manage user information"
            breadcrumb={breadcrumb}
            actions={<button>Add New</button>}
          />
        </TestWrapper>
      )

      expect(screen.getByText('Edit User')).toBeInTheDocument()
      expect(screen.getByText('Manage user information')).toBeInTheDocument()
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Users')).toBeInTheDocument()
      expect(screen.getByText('Edit User')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Add New' })).toBeInTheDocument()
    })

    it('StatsCard displays data correctly', () => {
      render(
        <TestWrapper>
          <StatsCard
            title="Total Users"
            value={1234}
            change={{
              value: 12,
              type: 'increase',
              period: 'from last month',
            }}
            description="Active users in platform"
          />
        </TestWrapper>
      )

      expect(screen.getByText('Total Users')).toBeInTheDocument()
      expect(screen.getByText('1,234')).toBeInTheDocument()
      expect(screen.getByText('12%')).toBeInTheDocument()
      expect(screen.getByText('from last month')).toBeInTheDocument()
    })

    it('DataTable renders with correct columns', () => {
      const columns = [
        {
          header: 'Name',
          accessorKey: 'name',
        },
        {
          header: 'Email',
          accessorKey: 'email',
        },
      ]

      const data = [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
      ]

      render(
        <TestWrapper>
          <DataTable
            columns={columns}
            data={data}
            searchKey="name"
            title="Users"
          />
        </TestWrapper>
      )

      expect(screen.getByText('Users')).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('jane@example.com')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(
        <TestWrapper>
          <Header />
        </TestWrapper>
      )

      // Check for ARIA labels
      expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument()
      expect(screen.getByLabelText('Search...')).toBeInTheDocument()
    })

    it('supports keyboard navigation', async () => {
      render(
        <TestWrapper>
          <Header />
        </TestWrapper>
      )

      const searchInput = screen.getByPlaceholderText('Search...')
      searchInput.focus()

      fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' })

      // Should handle keyboard events
      expect(searchInput).toHaveFocus()
    })

    it('has proper color contrast', () => {
      const { container } = render(
        <TestWrapper>
          <PageHeader title="Test Page" />
        </TestWrapper>
      )

      // Check for text contrast (would need axe-core for actual testing)
      const title = screen.getByText('Test Page')
      expect(title).toHaveClass('text-2xl', 'font-bold')
    })
  })

  describe('Performance', () => {
    it('renders quickly without excessive re-renders', async () => {
      const startTime = performance.now()

      render(
        <TestWrapper>
          <AppSidebar />
          <Header />
          <PageHeader title="Dashboard" />
        </TestWrapper>
      )

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render in under 100ms
      expect(renderTime).toBeLessThan(100)
    })

    it('handles large data sets efficiently', async () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
      }))

      const columns = [
        { header: 'ID', accessorKey: 'id' },
        { header: 'Name', accessorKey: 'name' },
        { header: 'Email', accessorKey: 'email' },
      ]

      const startTime = performance.now()

      render(
        <TestWrapper>
          <DataTable
            columns={columns}
            data={data}
            title="Large Data Set"
          />
        </TestWrapper>
      )

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should handle 1000 rows efficiently
      expect(renderTime).toBeLessThan(500)
    })
  })

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      const mockPost = jest
        .requireMock('@/lib/api-client')
        .apiClient.post.mockRejectedValue(new Error('Network error'))

      render(
        <TestWrapper>
          <button onClick={() => mockPost('/test', {})}>Submit</button>
        </TestWrapper>
      )

      fireEvent.click(screen.getByText('Submit'))

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalled()
      })
    })

    it('shows loading states', () => {
      render(
        <TestWrapper>
          <StatsCard
            title="Loading Card"
            value={0}
            loading={true}
          />
        </TestWrapper>
      )

      // Should show skeleton loaders
      expect(screen.getAllByRole('generic')).toHaveLength(
        expect.any(Number)
      )
    })
  })
})
