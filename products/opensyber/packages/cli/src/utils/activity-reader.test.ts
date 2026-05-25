import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'

vi.mock('fs')

const mockFs = vi.mocked(fs)

// Import after mocking
const { readEvents, summarise } = await import('./activity-reader.js')

const makeEvent = (risk: 'critical' | 'high' | 'medium' | 'low', secretsCount = 0) => JSON.stringify({
  id: 'test-id',
  timestamp: new Date().toISOString(),
  agent: 'Cline',
  type: 'file_read',
  risk,
  summary: 'Test event',
  secretsCount,
})

describe('readEvents', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns empty array when log file does not exist', () => {
    mockFs.existsSync.mockReturnValue(false)
    expect(readEvents()).toEqual([])
  })

  it('parses valid JSONL lines', () => {
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockReturnValue(`${makeEvent('critical')}\n${makeEvent('high')}` as unknown as Buffer)
    const events = readEvents()
    expect(events).toHaveLength(2)
    expect(events[0].risk).toBe('critical')
    expect(events[1].risk).toBe('high')
  })

  it('skips malformed lines silently', () => {
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockReturnValue(`${makeEvent('low')}\nnot-valid-json\n${makeEvent('medium')}` as unknown as Buffer)
    const events = readEvents()
    expect(events).toHaveLength(2)
  })

  it('respects the limit parameter', () => {
    const lines = Array.from({ length: 10 }, (_, i) => makeEvent(i % 2 === 0 ? 'low' : 'medium')).join('\n')
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockReturnValue(lines as unknown as Buffer)
    const events = readEvents(3)
    expect(events).toHaveLength(3)
  })
})

describe('summarise', () => {
  it('counts all risk levels correctly', () => {
    const events = [
      JSON.parse(makeEvent('critical', 2)),
      JSON.parse(makeEvent('high')),
      JSON.parse(makeEvent('medium')),
      JSON.parse(makeEvent('low')),
    ]
    const s = summarise(events)
    expect(s.total).toBe(4)
    expect(s.critical).toBe(1)
    expect(s.high).toBe(1)
    expect(s.medium).toBe(1)
    expect(s.low).toBe(1)
    expect(s.secretsDetected).toBe(2)
  })

  it('returns zeroed summary for empty events', () => {
    const s = summarise([])
    expect(s.total).toBe(0)
    expect(s.critical).toBe(0)
    expect(s.secretsDetected).toBe(0)
  })
})
