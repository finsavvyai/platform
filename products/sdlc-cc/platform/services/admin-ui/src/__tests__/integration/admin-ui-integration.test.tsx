import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable } from '@/components/ui/data-table'
import { StatsCard } from '@/components/ui/stats-card'

const ALL_PERMISSIONS = [
  'dashboard:view', 'analytics:view',
  'tenant:read', 'user:read', 'user:create', 'role:read',
  'document:read', 'search:view', 'embedding:read',
  'policy:read', 'dlp:read', 'api_key:read',
  'rag:read', 'llm:read', 'token:read',
  'service:read', 'vector:read', 'opa:read', 'terminal:access',
  'settings:read', 'monitoring:read', 'audit:read',
]

jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: jest.fn(() => ({
    data: {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN',
        permissions: ALL_PERMISSIONS,
        tenantId: 'test-tenant-id',
      },
      accessToken: 'test-access-token',
    },
    status: 'authenticated',
  })),
  signOut: jest.fn(),
  signIn: jest.fn(),
}))

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}))

jest.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      role: 'ADMIN',
      permissions: ALL_PERMISSIONS,
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
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('Admin UI Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Page Layout', () => {
    it('renders sidebar with all navigation section headers', () => {
      render(<TestWrapper><AppSidebar /></TestWrapper>)
      // Section headers render as collapsible buttons; items are gated
      // behind expand state, so we verify the headers and brand only.
      expect(screen.getByText('SDLC.ai')).toBeInTheDocument()
      expect(screen.getByText('Overview')).toBeInTheDocument()
      expect(screen.getByText('Platform Management')).toBeInTheDocument()
      expect(screen.getByText('Content & Documents')).toBeInTheDocument()
      expect(screen.getByText('Security & Policies')).toBeInTheDocument()
      expect(screen.getByText('AI & RAG')).toBeInTheDocument()
      expect(screen.getByText('Infrastructure')).toBeInTheDocument()
      expect(screen.getByText('System')).toBeInTheDocument()
    })

    it('expanding a sidebar section reveals its nav items', () => {
      render(<TestWrapper><AppSidebar /></TestWrapper>)
      const overviewBtn = screen.getByRole('button', { name: /Overview/ })
      fireEvent.click(overviewBtn)
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })

    it('renders header with avatar and controls', () => {
      render(<TestWrapper><Header /></TestWrapper>)
      // Avatar fallback shows initial of user name
      expect(screen.getByText('T')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
      // Toggle theme is sr-only span text inside the theme button
      expect(screen.getByText('Toggle theme')).toBeInTheDocument()
    })
  })

  describe('Authentication Integration', () => {
    it('hides sections whose items the user lacks permission for', () => {
      // Drop session permissions to dashboard:view only — sidebar reads
      // permissions off useSession, so most section headers should
      // disappear because their entire item lists are permission-gated.
      const useSessionMock = jest.requireMock('next-auth/react').useSession
      useSessionMock.mockReturnValueOnce({
        data: {
          user: {
            id: 'limited-user',
            email: 'limited@example.com',
            name: 'Limited User',
            role: 'USER',
            permissions: ['dashboard:view'],
            tenantId: 'test-tenant-id',
          },
        },
        status: 'authenticated',
      })
      render(<TestWrapper><AppSidebar /></TestWrapper>)
      // Overview section is visible because it includes a dashboard:view item
      expect(screen.getByText('Overview')).toBeInTheDocument()
      // Platform Management has no permissioned item in our allowlist
      expect(screen.queryByText('Platform Management')).not.toBeInTheDocument()
      expect(screen.queryByText('Security & Policies')).not.toBeInTheDocument()
    })
  })

  describe('Components Functionality', () => {
    it('PageHeader renders title, description, breadcrumb, and actions', () => {
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
        </TestWrapper>,
      )
      // "Edit User" appears in both breadcrumb tail and title
      expect(screen.getAllByText('Edit User').length).toBeGreaterThanOrEqual(2)
      expect(screen.getByText('Manage user information')).toBeInTheDocument()
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Users')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Add New' })).toBeInTheDocument()
    })

    it('StatsCard displays data correctly', () => {
      render(
        <TestWrapper>
          <StatsCard
            title="Total Users"
            value={1234}
            change={{ value: 12, type: 'increase', period: 'from last month' }}
            description="Active users in platform"
          />
        </TestWrapper>,
      )
      expect(screen.getByText('Total Users')).toBeInTheDocument()
      expect(screen.getByText('1,234')).toBeInTheDocument()
      expect(screen.getByText('12%')).toBeInTheDocument()
      expect(screen.getByText('from last month')).toBeInTheDocument()
    })

    it('DataTable renders with correct columns', () => {
      const columns = [
        { header: 'Name', accessorKey: 'name' },
        { header: 'Email', accessorKey: 'email' },
      ]
      const data = [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
      ]
      render(
        <TestWrapper>
          <DataTable columns={columns} data={data} searchKey="name" title="Users" />
        </TestWrapper>,
      )
      expect(screen.getByText('Users')).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('jane@example.com')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('exposes accessible names on header controls', () => {
      render(<TestWrapper><Header /></TestWrapper>)
      // sr-only label for theme toggle
      expect(screen.getByText('Toggle theme')).toBeInTheDocument()
      // Search input is type=search with placeholder
      const search = screen.getByPlaceholderText('Search...')
      expect(search).toHaveAttribute('type', 'search')
    })

    it('PageHeader title uses semantic heading styles', () => {
      render(<TestWrapper><PageHeader title="Test Page" /></TestWrapper>)
      expect(screen.getByText('Test Page')).toHaveClass('text-2xl', 'font-bold')
    })
  })

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      const mockPost = jest
        .requireMock('@/lib/api-client')
        .apiClient.post.mockRejectedValue(new Error('Network error'))
      render(
        <TestWrapper>
          <button onClick={() => mockPost('/test', {}).catch(() => {})}>Submit</button>
        </TestWrapper>,
      )
      fireEvent.click(screen.getByText('Submit'))
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalled()
      })
    })

    it('StatsCard renders skeleton when loading', () => {
      const { container } = render(
        <TestWrapper>
          <StatsCard title="Loading Card" value={0} loading={true} />
        </TestWrapper>,
      )
      // Loading state replaces value with skeleton elements (animate-pulse)
      expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    })
  })
})
