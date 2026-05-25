import { describe, it, expect } from 'vitest'
import { runAction, renderTemplate, isEgressAllowed } from '../runtime/cf-browser.js'
import { reddit, genericWebPage } from '../skills/index.js'

describe('runAction failure paths', () => {
  it('returns UNKNOWN_ACTION when action not in skill', async () => {
    const r = await runAction({
      browser: {},
      skill: reddit,
      actionName: 'does_not_exist',
      input: {},
      allowedEgress: ['www.reddit.com'],
    })
    expect(r.ok).toBe(false)
    expect(r.error?.code).toBe('UNKNOWN_ACTION')
    expect(r.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('returns INPUT_INVALID when required field missing', async () => {
    const r = await runAction({
      browser: {},
      skill: reddit,
      actionName: 'list_subreddit',
      input: {},
      allowedEgress: ['www.reddit.com'],
    })
    expect(r.ok).toBe(false)
    expect(r.error?.code).toBe('INPUT_INVALID')
    expect(r.error?.message).toContain('subreddit')
  })

  it('returns INPUT_INVALID when required field is empty string', async () => {
    const r = await runAction({
      browser: {},
      skill: reddit,
      actionName: 'list_subreddit',
      input: { subreddit: '' },
      allowedEgress: ['www.reddit.com'],
    })
    expect(r.error?.code).toBe('INPUT_INVALID')
  })

  it('returns EGRESS_DENIED when target not in allowed list', async () => {
    const r = await runAction({
      browser: {},
      skill: reddit,
      actionName: 'list_subreddit',
      input: { subreddit: 'rust' },
      allowedEgress: ['example.com'],
    })
    expect(r.ok).toBe(false)
    expect(r.error?.code).toBe('EGRESS_DENIED')
    expect(r.error?.message).toMatch(/not in allowed egress/)
  })

  it('returns RUNTIME_ERROR when @cloudflare/puppeteer unavailable', async () => {
    const r = await runAction({
      browser: {},
      skill: genericWebPage,
      actionName: 'fetch_readable',
      input: { url: 'https://example.com/page' },
      allowedEgress: ['example.com'],
    })
    expect(r.ok).toBe(false)
    expect(r.error?.code).toBe('RUNTIME_ERROR')
    expect(r.error?.message).toMatch(/puppeteer/i)
  })
})

describe('renderTemplate edge cases', () => {
  it('leaves missing keys as empty', () => {
    expect(renderTemplate('/x/{{a}}/{{b}}', { a: 'one' })).toBe('/x/one/')
  })
  it('coerces non-strings', () => {
    expect(renderTemplate('/n={{n}}', { n: 42 })).toBe('/n=42')
  })
  it('handles null/undefined safely', () => {
    expect(renderTemplate('/x={{a}}', { a: null })).toBe('/x=')
  })
})

describe('isEgressAllowed edge cases', () => {
  it('rejects malformed URLs', () => {
    expect(isEgressAllowed('not-a-url', ['example.com'])).toBe(false)
  })
  it('exact-host match', () => {
    expect(isEgressAllowed('https://example.com/x', ['example.com'])).toBe(true)
  })
  it('subdomain match', () => {
    expect(isEgressAllowed('https://api.example.com/x', ['example.com'])).toBe(true)
  })
  it('non-matching host', () => {
    expect(isEgressAllowed('https://evil.com', ['example.com'])).toBe(false)
  })
})
