import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProjectsPage from './page'
import { __resetSessionCacheForTests } from '@/lib/api'

jest.mock('@/components/ui/use-toast', () => {
  const toast = jest.fn()
  return { useToast: () => ({ toast }), toast, __toast: toast }
})
const { __toast: toastFn } = jest.requireMock('@/components/ui/use-toast') as {
  __toast: jest.Mock
}

const PROJECT_FIXTURES = [
  {
    id: 'p1',
    tenant_id: 'tenant-1',
    name: 'Compliance Audit',
    description: 'Q2 evidence',
    system_prompt: 'be helpful',
    members: [{ user_id: 'u1', role: 'admin' }],
    updated_at: '2026-04-25T00:00:00Z',
  },
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
      <ProjectsPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  fetchMock.mockReset()
  toastFn.mockClear()
  __resetSessionCacheForTests()
  jest.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('ProjectsPage', () => {
  it('shows loading skeleton then renders the project list', async () => {
    setupFetch(() => jsonResponse(PROJECT_FIXTURES))
    renderPage()

    expect(screen.getByTestId('projects-loading')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Compliance Audit')).toBeInTheDocument())
    expect(screen.queryByTestId('projects-loading')).not.toBeInTheDocument()
  })

  it('creates a project with the right body', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    setupFetch((url, init) => {
      calls.push({ url, init })
      if (init.method === 'POST') {
        const body = JSON.parse(init.body as string)
        return jsonResponse({ id: 'p2', tenant_id: 'tenant-1', members: [], ...body })
      }
      return jsonResponse(PROJECT_FIXTURES)
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Compliance Audit')).toBeInTheDocument())

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new project/i }))
    await user.type(screen.getByPlaceholderText(/project name/i), 'Roadmap Review')
    await user.type(screen.getByPlaceholderText(/^description$/i), 'team planning')
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    await waitFor(() => {
      const post = calls.find((c) => c.init.method === 'POST')
      expect(post).toBeTruthy()
      expect(post?.url).toContain('/v1/projects')
      const body = JSON.parse(post!.init.body as string)
      expect(body.name).toBe('Roadmap Review')
      expect(body.description).toBe('team planning')
      expect(body.connector_ids).toEqual([])
    })
  })

  it('deletes a project via confirm + DELETE call', async () => {
    let deleteCalls: string[] = []
    setupFetch((url, init) => {
      if (init.method === 'DELETE') {
        deleteCalls.push(url)
        return jsonResponse(null, { status: 204 })
      }
      return jsonResponse(PROJECT_FIXTURES)
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Compliance Audit')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /delete compliance audit/i }))
    expect(window.confirm).toHaveBeenCalled()
    await waitFor(() => expect(deleteCalls.length).toBe(1))
    expect(deleteCalls[0]).toContain('/v1/projects/p1')
  })

  it('surfaces an error on fetch failure', async () => {
    setupFetch(() => jsonResponse({ message: 'no' }, { status: 500 }))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Failed to load projects/i)).toBeInTheDocument()
    })
  })
})
