import { describe, it, expect } from 'vitest'
import { refineSkillWithLlm, type LlmClient } from '../site-generator/llm.js'
import { generateSkillFromSite } from '../site-generator/index.js'
import { validateSkill } from '../registry.js'

function fakeLlm(response: string): LlmClient {
  return { complete: async () => response }
}

describe('refineSkillWithLlm', () => {
  const base = generateSkillFromSite({
    url: 'https://shop.example.com/',
    sample: {
      url: 'https://shop.example.com/',
      forms: [{ action: '/search', method: 'GET', inputs: ['q'] }],
    },
  })

  it('rewrites description and action descriptions from LLM JSON', async () => {
    const refined = await refineSkillWithLlm(base, {
      llm: fakeLlm(
        JSON.stringify({
          description: 'Shop search and reader.',
          actions: [
            { name: 'read_page', description: 'Read any product page.' },
            { name: 'search', description: 'Search the shop catalog.' },
          ],
        })
      ),
    })
    expect(refined.description).toBe('Shop search and reader.')
    expect(refined.actions[0].description).toBe('Read any product page.')
    expect(() => validateSkill(refined)).not.toThrow()
  })

  it('falls back to original skill on malformed LLM output', async () => {
    const refined = await refineSkillWithLlm(base, { llm: fakeLlm('not json') })
    expect(refined).toBe(base)
  })

  it('strips ```json``` fences', async () => {
    const refined = await refineSkillWithLlm(base, {
      llm: fakeLlm('```json\n{"actions":[{"name":"read_page","description":"x"}]}\n```'),
    })
    expect(refined.actions[0].description).toBe('x')
  })

  it('drops actions with invalid names', async () => {
    const refined = await refineSkillWithLlm(base, {
      llm: fakeLlm(
        JSON.stringify({
          actions: [
            { name: 'Bad Name', description: 'bad' },
            { name: 'read_page', description: 'good' },
          ],
        })
      ),
    })
    expect(refined.actions.length).toBe(1)
    expect(refined.actions[0].name).toBe('read_page')
  })

  it('matches original action via snake-strip when name reordering occurs', async () => {
    const refined = await refineSkillWithLlm(base, {
      llm: fakeLlm(
        JSON.stringify({
          actions: [{ name: 'readpage', description: 'matched without underscore' }],
        })
      ),
    })
    expect(refined.actions[0].description).toBe('matched without underscore')
  })

  it('returns original when LLM output has zero valid actions', async () => {
    const refined = await refineSkillWithLlm(base, {
      llm: fakeLlm(JSON.stringify({ actions: [{ name: 'BAD' }] })),
    })
    expect(refined).toBe(base)
  })
})
