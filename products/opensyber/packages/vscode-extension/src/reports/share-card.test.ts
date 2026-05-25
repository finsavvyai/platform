import { describe, it, expect } from 'vitest'
import {
  buildShareText, buildLinkedInUrl, buildScoreCardSvg,
  buildTwitterText, buildTwitterUrl, buildFacebookUrl, buildRedditUrl,
} from './share-card'
import type { ActivitySummary } from '../logger/activity-logger'

const base: ActivitySummary = { total: 0, critical: 0, high: 0, medium: 0, low: 0, secretsDetected: 0 }

describe('buildShareText', () => {
  it('mentions agent name when provided', () => {
    const text = buildShareText({ ...base, total: 5 }, ['Cline'])
    expect(text).toContain('Cline')
  })

  it('falls back to generic label when no agents', () => {
    const text = buildShareText(base, [])
    expect(text).toContain('my AI coding agent')
  })

  it('includes CRITICAL line when critical > 0', () => {
    const text = buildShareText({ ...base, critical: 3 }, [])
    expect(text).toContain('🔴 CRITICAL')
    expect(text).toContain('3 sensitive file')
  })

  it('includes HIGH line when high > 0', () => {
    const text = buildShareText({ ...base, high: 2 }, [])
    expect(text).toContain('🟠 HIGH')
    expect(text).toContain('2 elevated operation')
  })

  it('includes secrets line when secretsDetected > 0', () => {
    const text = buildShareText({ ...base, secretsDetected: 4 }, [])
    expect(text).toContain('🔑 4 live secret pattern')
  })

  it('shows clean message when no risks', () => {
    const text = buildShareText(base, [])
    expect(text).toContain('nothing alarming')
  })

  it('always includes opensyber.cloud link', () => {
    const text = buildShareText(base, [])
    expect(text).toContain('opensyber.cloud')
  })

  it('always includes #AISecurity hashtag', () => {
    const text = buildShareText(base, [])
    expect(text).toContain('#AISecurity')
  })
})

describe('buildLinkedInUrl', () => {
  it('returns a LinkedIn share URL', () => {
    const url = buildLinkedInUrl()
    expect(url).toContain('linkedin.com/sharing/share-offsite')
  })

  it('includes opensyber.cloud reference', () => {
    const url = buildLinkedInUrl()
    expect(url).toContain('opensyber.cloud')
  })
})

describe('buildTwitterText', () => {
  it('is within Twitter 280 char limit for worst-case input', () => {
    const summary = { ...base, critical: 5, high: 5, secretsDetected: 3 }
    const text = buildTwitterText(summary, ['Claude Code'])
    expect(text.length).toBeLessThanOrEqual(280)
  })

  it('includes agent name', () => {
    expect(buildTwitterText(base, ['Cursor'])).toContain('Cursor')
  })

  it('mentions credentials access when critical events present', () => {
    expect(buildTwitterText({ ...base, critical: 3 }, [])).toContain('credentials')
  })

  it('shows clean message when no risks', () => {
    expect(buildTwitterText(base, [])).toContain('Nothing critical')
  })
})

describe('buildTwitterUrl', () => {
  it('targets x.com intent/tweet', () => {
    const url = buildTwitterUrl(base, [])
    expect(url).toContain('x.com/intent/tweet')
  })

  it('encodes text in query param', () => {
    const url = buildTwitterUrl({ ...base, critical: 1 }, ['Cline'])
    expect(url).toContain('text=')
  })
})

describe('buildFacebookUrl', () => {
  it('uses facebook sharer endpoint', () => {
    expect(buildFacebookUrl()).toContain('facebook.com/sharer')
  })

  it('includes opensyber.cloud URL', () => {
    expect(buildFacebookUrl()).toContain('opensyber.cloud')
  })
})

describe('buildRedditUrl', () => {
  it('uses reddit submit endpoint', () => {
    expect(buildRedditUrl(base, [])).toContain('reddit.com/submit')
  })

  it('pre-fills title with agent name', () => {
    const url = buildRedditUrl(base, ['Cline'])
    expect(decodeURIComponent(url)).toContain('Cline')
  })

  it('mentions credentials in title when critical events exist', () => {
    const url = buildRedditUrl({ ...base, critical: 2 }, ['Devin'])
    expect(decodeURIComponent(url)).toContain('credentials')
  })
})

describe('buildScoreCardSvg', () => {
  const summary: ActivitySummary = { ...base, critical: 1, high: 2, total: 10 }

  it('returns valid SVG with correct viewBox', () => {
    const svg = buildScoreCardSvg(summary, ['Cline'], 60, '#eab308')
    expect(svg).toContain('<svg')
    expect(svg).toContain('viewBox="0 0 600 315"')
  })

  it('embeds the score number', () => {
    const svg = buildScoreCardSvg(summary, ['Cline'], 60, '#eab308')
    expect(svg).toContain('>60<')
  })

  it('embeds the score color', () => {
    const svg = buildScoreCardSvg(summary, ['Cline'], 60, '#eab308')
    expect(svg).toContain('#eab308')
  })

  it('shows CRITICAL badge when critical > 0', () => {
    const svg = buildScoreCardSvg(summary, ['Cline'], 60, '#eab308')
    expect(svg).toContain('CRITICAL')
  })

  it('shows clean badge when all zero', () => {
    const svg = buildScoreCardSvg(base, [], 100, '#22c55e')
    expect(svg).toContain('CLEAN SESSION')
  })

  it('escapes XML special chars in agent name', () => {
    const svg = buildScoreCardSvg(base, ['Agent <X> & "Y"'], 100, '#22c55e')
    expect(svg).toContain('Agent &lt;X&gt; &amp; &quot;Y&quot;')
    expect(svg).not.toContain('<X>')
  })
})
