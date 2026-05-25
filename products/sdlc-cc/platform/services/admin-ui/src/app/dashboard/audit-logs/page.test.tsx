/**
 * Day 13: tests for the audit-log query UI.
 *
 * Covers: initial fetch, filter application, cursor pagination,
 * CSV export (Accept: text/csv), and error rendering.
 */
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuditLogsPage from './page'

// api-client calls /api/auth/session internally for every request.
const SESSION_STUB = { accessToken: 'tok', user: { tenantId: 'tenant-1' } }

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
    blob: async () => new Blob([JSON.stringify(body)]),
    headers: new Headers({ 'Content-Type': 'application/json' }),
  } as unknown as Response
}

function blobResponse(content: string, contentType: string) {
  return {
    ok: true,
    status: 200,
    blob: async () => new Blob([content], { type: contentType }),
    headers: new Headers({ 'Content-Type': contentType }),
  } as unknown as Response
}

const fetchMock = global.fetch as jest.Mock

function setupFetch(
  handler: (url: string, init: RequestInit) => Response | Promise<Response>,
) {
  fetchMock.mockImplementation(async (url: string, init: RequestInit = {}) => {
    if (typeof url === 'string' && url.includes('/api/auth/session')) {
      return jsonResponse(SESSION_STUB)
    }
    return handler(url, init)
  })
}

const ROW_FIXTURE = {
  id: 'a1b2c3d4-0000-0000-0000-000000000001',
  tenant_id: 'tenant-1',
  actor_id: 'user-001',
  actor_type: 'user',
  action: 'auth.login',
  target_type: 'session',
  target_id: 'sess-1',
  ip_address: '127.0.0.1',
  user_agent: 'jest',
  created_at: '2026-01-15T10:00:00Z',
}

const PAGE_FIXTURE = { rows: [ROW_FIXTURE], next_cursor: undefined }

function renderPage() {
  return render(<AuditLogsPage />)
}

beforeEach(() => {
  fetchMock.mockReset()
})

describe('AuditLogsPage', () => {
  it('renders the page heading', async () => {
    setupFetch(() => jsonResponse(PAGE_FIXTURE))
    renderPage()
    expect(screen.getByText('Audit logs')).toBeInTheDocument()
  })

  it('fetches and displays a row on initial load', async () => {
    setupFetch(() => jsonResponse(PAGE_FIXTURE))
    renderPage()

    await waitFor(() =>
      expect(screen.getByText('auth.login')).toBeInTheDocument(),
    )
    expect(screen.getByText('user-001')).toBeInTheDocument()
    expect(screen.getByText('session/sess-1')).toBeInTheDocument()
    expect(screen.getByText('127.0.0.1')).toBeInTheDocument()
  })

  it('shows empty-state message when no rows', async () => {
    setupFetch(() => jsonResponse({ rows: [] }))
    renderPage()
    await waitFor(() =>
      expect(
        screen.getByText(/No rows for these filters/i),
      ).toBeInTheDocument(),
    )
  })

  it('shows error message on fetch failure', async () => {
    setupFetch(() => {
      throw new Error('network failure')
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText(/Query failed/i)).toBeInTheDocument(),
    )
  })

  it('applies action filter and re-fetches', async () => {
    const calls: string[] = []
    setupFetch((url) => {
      calls.push(url)
      return jsonResponse(PAGE_FIXTURE)
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('auth.login')).toBeInTheDocument())

    const user = userEvent.setup()
    const actionInput = screen.getByLabelText('action')
    await user.clear(actionInput)
    await user.type(actionInput, 'policy.update')

    fireEvent.submit(actionInput.closest('form')!)

    await waitFor(() => {
      const filtered = calls.filter((u) => u.includes('action=policy.update'))
      expect(filtered.length).toBeGreaterThan(0)
    })
  })

  it('shows Load more button when next_cursor is present', async () => {
    setupFetch(() =>
      jsonResponse({ rows: [ROW_FIXTURE], next_cursor: 'cursor-abc' }),
    )
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument(),
    )
  })

  it('loads next page on Load more click and appends rows', async () => {
    const PAGE_2_ROW = { ...ROW_FIXTURE, id: 'page2-row', action: 'doc.upload' }
    let callCount = 0
    setupFetch((url) => {
      callCount++
      if (url.includes('cursor=cursor-abc')) {
        return jsonResponse({ rows: [PAGE_2_ROW], next_cursor: undefined })
      }
      return jsonResponse({ rows: [ROW_FIXTURE], next_cursor: 'cursor-abc' })
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByRole('button', { name: /load more/i }))

    await waitFor(() =>
      expect(screen.getByText('doc.upload')).toBeInTheDocument(),
    )
    // Both pages rendered
    expect(screen.getByText('auth.login')).toBeInTheDocument()
  })

  it('hides Load more when next_cursor is absent', async () => {
    setupFetch(() => jsonResponse({ rows: [ROW_FIXTURE] }))
    renderPage()
    await waitFor(() => expect(screen.getByText('auth.login')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
  })

  it('CSV export sends Accept: text/csv header', async () => {
    const exportCalls: { url: string; headers: Record<string, string> }[] = []
    setupFetch((url, init) => {
      const headers = init.headers as Record<string, string>
      if (headers?.Accept === 'text/csv') {
        exportCalls.push({ url, headers })
        return blobResponse('id,action\n1,auth.login', 'text/csv')
      }
      return jsonResponse(PAGE_FIXTURE)
    })

    // URL.createObjectURL not available in jsdom — stub it
    const createObjectURL = jest.fn(() => 'blob:test')
    const revokeObjectURL = jest.fn()
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, writable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, writable: true })

    renderPage()
    await waitFor(() => expect(screen.getByText('auth.login')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /export csv/i }))

    await waitFor(() => {
      expect(exportCalls.length).toBeGreaterThan(0)
      expect(exportCalls[0]!.url).toContain('/admin/audit-logs')
    })
  })

  it('Reset clears filters and re-fetches without params', async () => {
    const calls: string[] = []
    setupFetch((url) => {
      calls.push(url)
      return jsonResponse(PAGE_FIXTURE)
    })
    renderPage()

    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByText('auth.login')).toBeInTheDocument())

    // Type a filter
    await user.type(screen.getByLabelText('action'), 'test')
    fireEvent.click(screen.getByRole('button', { name: /reset/i }))

    await waitFor(() => {
      // After reset, action param should not appear
      const lastCall = calls[calls.length - 1]
      expect(lastCall).not.toContain('action=')
    })
  })
})
