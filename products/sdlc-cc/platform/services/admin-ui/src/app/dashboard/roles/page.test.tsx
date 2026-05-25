import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import RolesPage from './page'
import { __resetSessionCacheForTests } from '@/lib/api'

jest.mock('@/components/ui/use-toast', () => {
  const toast = jest.fn()
  return { useToast: () => ({ toast }), toast, __toast: toast }
})
const { __toast: toastFn } = jest.requireMock('@/components/ui/use-toast') as {
  __toast: jest.Mock
}

const ROLE_FIXTURES = [
  { id: 'r1', name: 'admin', description: 'all', permissions: ['users:read'], user_count: 3 },
  { id: 'r2', name: 'auditor', description: 'read', permissions: ['audit:read:tenant'], user_count: 1 },
]

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

const fetchMock = global.fetch as jest.Mock

function setupFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  fetchMock.mockImplementation(async (url: string, init: RequestInit = {}) => {
    if (typeof url === 'string' && url.includes('/api/auth/session')) {
      return jsonResponse({ accessToken: 't', user: { tenantId: 'tenant-1' } })
    }
    return handler(url, init)
  })
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <RolesPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  fetchMock.mockReset()
  toastFn.mockClear()
  __resetSessionCacheForTests()
  // confirm() defaults true so delete proceeds
  jest.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('RolesPage', () => {
  it('shows loading skeleton then renders the role list', async () => {
    setupFetch(() => jsonResponse(ROLE_FIXTURES))
    renderPage()

    expect(screen.getByTestId('roles-loading')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('admin')).toBeInTheDocument())
    expect(screen.getByText('auditor')).toBeInTheDocument()
    expect(screen.queryByTestId('roles-loading')).not.toBeInTheDocument()
  })

  it('creates a role with the right body', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    setupFetch((url, init) => {
      calls.push({ url, init })
      if (init.method === 'POST') {
        const body = JSON.parse(init.body as string)
        return jsonResponse({ id: 'rNew', user_count: 0, ...body })
      }
      return jsonResponse(ROLE_FIXTURES)
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('admin')).toBeInTheDocument())

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new role/i }))
    await user.type(screen.getByPlaceholderText(/role name/i), 'developer')
    await user.type(screen.getByPlaceholderText(/description/i), 'API user')
    await user.click(screen.getByLabelText('permission llm:invoke'))
    await user.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      const post = calls.find((c) => c.init.method === 'POST')
      expect(post).toBeTruthy()
      expect(post?.url).toContain('/admin/roles')
      const body = JSON.parse(post!.init.body as string)
      expect(body).toEqual({
        name: 'developer',
        description: 'API user',
        permissions: ['llm:invoke'],
      })
    })
  })

  it('deletes a role via confirm + DELETE call', async () => {
    let deleteCalls = 0
    setupFetch((_url, init) => {
      if (init.method === 'DELETE') {
        deleteCalls++
        return jsonResponse(null, { status: 204 })
      }
      return jsonResponse(ROLE_FIXTURES)
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('admin')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /delete admin/i }))
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('admin'))
    await waitFor(() => expect(deleteCalls).toBe(1))
  })

  it('surfaces an error toast on fetch failure', async () => {
    setupFetch(() => jsonResponse({ message: 'boom' }, { status: 500, statusText: 'err' }))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Failed to load roles/i)).toBeInTheDocument()
    })
  })
})
