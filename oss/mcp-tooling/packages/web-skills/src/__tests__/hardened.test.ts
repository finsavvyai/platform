import { describe, it, expect } from 'vitest'
import { signSkill, skillToToolDefinitions } from '../generator/hardened.js'
import { reddit } from '../skills/index.js'
import { hardened } from '@mcpoverflow/cli'

describe('hardened mode for browse-MCPs', () => {
  it('signs a manifest that verifies against live tools', () => {
    const { manifest } = signSkill({ skill: reddit, publisher: { name: 'test' } })
    const live = skillToToolDefinitions(reddit)
    const r = hardened.verifyManifestAgainstTools(manifest, live)
    expect(r.ok).toBe(true)
  })

  it('detects drift when an action is renamed', () => {
    const { manifest } = signSkill({ skill: reddit, publisher: { name: 'test' } })
    const tampered = skillToToolDefinitions({
      ...reddit,
      actions: reddit.actions.map((a, i) => (i === 0 ? { ...a, name: 'list_subreddit_v2' } : a)),
    })
    const r = hardened.verifyManifestAgainstTools(manifest, tampered)
    expect(r.ok).toBe(false)
  })

  it('detects drift when description changes', () => {
    const { manifest } = signSkill({ skill: reddit, publisher: { name: 'test' } })
    const tampered = skillToToolDefinitions({
      ...reddit,
      actions: reddit.actions.map((a, i) =>
        i === 0 ? { ...a, description: a.description + ' (modified)' } : a
      ),
    })
    const r = hardened.verifyManifestAgainstTools(manifest, tampered)
    expect(r.ok).toBe(false)
  })

  it('manifest declares non-empty egress', () => {
    const { manifest } = signSkill({ skill: reddit, publisher: { name: 'test' } })
    expect(manifest.egress.length).toBeGreaterThan(0)
  })
})
