import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CloudSync } from './cloud-sync'
import type { ActivityEvent } from '../logger/activity-logger'

// Prevent the real ~/.opensyber/.sync-cursor from filtering test events
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return { ...actual, existsSync: vi.fn(() => false), writeFileSync: vi.fn() }
})

const makeEvent = (timestamp: string, risk: ActivityEvent['risk'] = 'high'): ActivityEvent => ({
  id:           crypto.randomUUID(),
  timestamp,
  agent:        'Cline',
  type:         'file_read',
  risk,
  summary:      'Read: /project/package.json',
  secretsCount: 0,
})

describe('CloudSync', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('isEnabled returns false when apiKey is empty', () => {
    const sync = new CloudSync('https://api.opensyber.cloud', '')
    expect(sync.isEnabled()).toBe(false)
  })

  it('isEnabled returns false when apiUrl is empty', () => {
    const sync = new CloudSync('', 'key123')
    expect(sync.isEnabled()).toBe(false)
  })

  it('isEnabled returns true when both are set', () => {
    const sync = new CloudSync('https://api.opensyber.cloud', 'key123')
    expect(sync.isEnabled()).toBe(true)
  })

  it('returns synced:0 when disabled (no apiKey)', async () => {
    const sync = new CloudSync('https://api.opensyber.cloud', '')
    const result = await sync.sync([makeEvent(new Date().toISOString())])
    expect(result.synced).toBe(0)
    expect(result.error).toBeUndefined()
  })

  it('returns synced:0 when no events', async () => {
    const sync = new CloudSync('https://api.opensyber.cloud', 'key123')
    const result = await sync.sync([])
    expect(result.synced).toBe(0)
  })

  it('POSTs events to the correct endpoint and returns synced count', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ synced: 2 }),
      text: async () => '',
    })
    vi.stubGlobal('fetch', fetchMock)

    const sync   = new CloudSync('https://api.opensyber.cloud', 'test-key')
    const events = [makeEvent('2026-01-01T10:00:00.000Z'), makeEvent('2026-01-01T10:01:00.000Z')]
    const result = await sync.sync(events)

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.opensyber.cloud/api/agents/activity/sync')
    expect(opts.method).toBe('POST')
    expect(opts.headers['Authorization']).toBe('Bearer test-key')

    const body = JSON.parse(opts.body)
    expect(body.events).toHaveLength(2)
    expect(result.synced).toBe(2)
  })

  it('returns error string on HTTP failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    }))

    const sync   = new CloudSync('https://api.opensyber.cloud', 'bad-key')
    const result = await sync.sync([makeEvent(new Date().toISOString())])

    expect(result.synced).toBe(0)
    expect(result.error).toContain('401')
  })

  it('returns error string on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    const sync   = new CloudSync('https://api.opensyber.cloud', 'key123')
    const result = await sync.sync([makeEvent(new Date().toISOString())])

    expect(result.synced).toBe(0)
    expect(result.error).toContain('ECONNREFUSED')
  })
})
