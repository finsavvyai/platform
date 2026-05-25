import { describe, it, expect, vi } from 'vitest'
import { colorRisk, printScore, printSummary } from './format.js'
import type { ActivitySummary } from './activity-reader.js'

const base: ActivitySummary = { total: 0, critical: 0, high: 0, medium: 0, low: 0, secretsDetected: 0 }

describe('colorRisk', () => {
  it('includes risk level uppercased', () => {
    expect(colorRisk('critical')).toContain('CRITICAL')
    expect(colorRisk('high')).toContain('HIGH')
    expect(colorRisk('medium')).toContain('MEDIUM')
    expect(colorRisk('low')).toContain('LOW')
  })

  it('returns a string with ANSI codes', () => {
    const result = colorRisk('critical')
    expect(result).toContain('\x1b[')
  })
})

describe('printScore', () => {
  it('prints without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    expect(() => printScore({ ...base, critical: 1 })).not.toThrow()
    spy.mockRestore()
  })
})

describe('printSummary', () => {
  it('prints without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    expect(() => printSummary({ ...base, total: 5, critical: 2, secretsDetected: 3 })).not.toThrow()
    spy.mockRestore()
  })
})
