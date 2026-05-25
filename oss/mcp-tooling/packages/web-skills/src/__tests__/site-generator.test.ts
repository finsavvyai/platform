import { describe, it, expect } from 'vitest'
import { generateSkillFromSite } from '../site-generator/index.js'
import { validateSkill } from '../registry.js'

describe('site-generator', () => {
  it('produces a valid skill from bare URL', () => {
    const skill = generateSkillFromSite({ url: 'https://news.example.com/' })
    expect(() => validateSkill(skill)).not.toThrow()
    expect(skill.id).toBe('news-generated')
    expect(skill.baseUrl).toBe('https://news.example.com')
    expect(skill.actions.some(a => a.name === 'read_page')).toBe(true)
  })

  it('emits a search action when sample has a search form', () => {
    const skill = generateSkillFromSite({
      url: 'https://shop.example.com/',
      sample: {
        url: 'https://shop.example.com/',
        forms: [{ action: '/search', method: 'GET', inputs: ['q'] }],
      },
    })
    expect(skill.actions.some(a => a.name === 'search')).toBe(true)
  })

  it('emits structured_data action when JSON-LD present', () => {
    const skill = generateSkillFromSite({
      url: 'https://blog.example.com/',
      sample: { url: 'https://blog.example.com/', jsonLd: [{ '@type': 'Article' }] },
    })
    expect(skill.actions.some(a => a.name === 'structured_data')).toBe(true)
  })
})
