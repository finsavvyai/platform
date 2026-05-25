import { describe, it, expect } from 'vitest'
import { generateFromSkill, deriveSkillEgress } from '../generator/index.js'
import { renderTemplate, isEgressAllowed } from '../runtime/cf-browser.js'
import { reddit, amazon, genericWebPage } from '../skills/index.js'

describe('generator', () => {
  it('emits expected file set for a built-in skill', () => {
    const out = generateFromSkill(reddit, { hardened: false })
    const paths = out.files.map(f => f.path).sort()
    expect(paths).toEqual([
      '.env.example',
      'package.json',
      'src/index.ts',
      'src/runtime.ts',
      'src/skill.ts',
      'tsconfig.json',
      'wrangler.toml',
    ])
  })

  it('lists tool names matching skill actions', () => {
    const out = generateFromSkill(amazon)
    expect(out.toolNames).toEqual(amazon.actions.map(a => a.name))
  })

  it('declares egress from baseUrl + navigate', () => {
    const out = generateFromSkill(reddit)
    expect(out.egress).toContain('www.reddit.com')
  })

  it('hardened flag wires verifyManifestAgainstTools into server', () => {
    const out = generateFromSkill(reddit, { hardened: true })
    const index = out.files.find(f => f.path === 'src/index.ts')!
    expect(index.contents).toContain('verifyManifestAgainstTools')
    expect(index.contents).toContain('manifest drift')
  })

  it('non-hardened does not import manifest', () => {
    const out = generateFromSkill(reddit, { hardened: false })
    const index = out.files.find(f => f.path === 'src/index.ts')!
    expect(index.contents).not.toContain('manifest.json')
  })

  it('embeds skill JSON', () => {
    const out = generateFromSkill(genericWebPage)
    const skillFile = out.files.find(f => f.path === 'src/skill.ts')!
    expect(skillFile.contents).toContain('"generic-web-page"')
  })
})

describe('deriveSkillEgress', () => {
  it('captures multiple domains from handlers', () => {
    const egress = deriveSkillEgress({
      id: 'multi',
      site: 'x.com',
      version: '1',
      description: '',
      baseUrl: 'https://x.com',
      auth: { type: 'none' },
      actions: [
        {
          name: 'a',
          description: '',
          inputSchema: { type: 'object' },
          handler: 'fetch("https://api.example.com/x")',
        },
      ],
    })
    expect(egress).toContain('x.com')
    expect(egress).toContain('api.example.com')
  })
})

describe('runtime helpers', () => {
  it('renderTemplate substitutes and URL-encodes', () => {
    expect(renderTemplate('/s?q={{query}}', { query: 'hello world' })).toBe('/s?q=hello%20world')
    expect(renderTemplate('{{url}}', { url: 'https://example.com/x' })).toBe(
      'https://example.com/x'
    )
  })

  it('isEgressAllowed accepts subdomain matches', () => {
    expect(isEgressAllowed('https://api.reddit.com/x', ['reddit.com'])).toBe(true)
    expect(isEgressAllowed('https://evil.com', ['reddit.com'])).toBe(false)
  })
})
