import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ConnectorsMarketplacePage from './page'
import { __resetSessionCacheForTests, API_BASE } from '@/lib/api'

jest.mock('@/components/ui/use-toast', () => {
  const toast = jest.fn()
  return { useToast: () => ({ toast }), toast, __toast: toast }
})
const { __toast: toastFn } = jest.requireMock('@/components/ui/use-toast') as {
  __toast: jest.Mock
}

const CONNECTOR_FIXTURES = [
  { name: 'slack', status: 'connected' },
  { name: 'github', status: 'available' },
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
      <ConnectorsMarketplacePage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  fetchMock.mockReset()
  toastFn.mockClear()
  __resetSessionCacheForTests()
})

describe('ConnectorsMarketplacePage', () => {
  it('shows loading skeleton then renders the marketplace', async () => {
    setupFetch(() => jsonResponse(CONNECTOR_FIXTURES))
    renderPage()

    expect(screen.getByTestId('connectors-loading')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Slack')).toBeInTheDocument())
    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.queryByTestId('connectors-loading')).not.toBeInTheDocument()
  })

  it('Connect button is an anchor pointing at the gateway oauth/start', async () => {
    setupFetch(() => jsonResponse(CONNECTOR_FIXTURES))
    renderPage()
    await waitFor(() => expect(screen.getByText('GitHub')).toBeInTheDocument())

    const link = screen.getByTestId('connect-github') as HTMLAnchorElement
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe(`${API_BASE}/v1/connectors/github/oauth/start`)
  })

  it('Uninstall flow: confirm dialog → DELETE mutation', async () => {
    let deleteCalls: string[] = []
    setupFetch((url, init) => {
      if (init.method === 'DELETE') {
        deleteCalls.push(url)
        return jsonResponse(null, { status: 204 })
      }
      return jsonResponse(CONNECTOR_FIXTURES)
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Slack')).toBeInTheDocument())

    const user = userEvent.setup()
    await user.click(screen.getByTestId('uninstall-slack'))
    // Radix Dialog renders the action button
    const confirmBtn = await screen.findByRole('button', { name: /^Uninstall$/i })
    await user.click(confirmBtn)

    await waitFor(() => expect(deleteCalls.length).toBe(1))
    expect(deleteCalls[0]).toContain('/v1/connectors/slack')
  })

  it('surfaces an error message on fetch failure', async () => {
    setupFetch(() => jsonResponse({ message: 'gateway down' }, { status: 503 }))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Failed to load connectors/i)).toBeInTheDocument()
    })
  })

  it('search filter narrows the list', async () => {
    setupFetch(() => jsonResponse(CONNECTOR_FIXTURES))
    renderPage()
    await waitFor(() => expect(screen.getByText('Slack')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText(/search connectors/i), { target: { value: 'slack' } })
    expect(screen.getByText('Slack')).toBeInTheDocument()
    expect(screen.queryByText('GitHub')).not.toBeInTheDocument()
  })
})
