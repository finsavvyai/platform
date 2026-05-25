import { describe, it, expect } from 'vitest'
import { defaultRegistry, validateSkill } from '../index.js'

describe('built-in skills', () => {
  for (const skill of defaultRegistry.list()) {
    describe(skill.id, () => {
      it('passes validateSkill', () => {
        expect(() => validateSkill(skill)).not.toThrow()
      })
      it('has at least one action', () => {
        expect(skill.actions.length).toBeGreaterThan(0)
      })
      it('each action handler is parseable JS body', () => {
        for (const a of skill.actions) {
          const fn = `(function(input){\n${a.handler}\n})`
          expect(() => new Function('return ' + fn)).not.toThrow()
        }
      })
      it('each action declares JSON-schema-ish inputSchema', () => {
        for (const a of skill.actions) {
          expect(a.inputSchema).toHaveProperty('type', 'object')
        }
      })
    })
  }

  it('registry list is sorted by id', () => {
    const ids = defaultRegistry.list().map(s => s.id)
    expect([...ids].sort()).toEqual(ids)
  })

  it('lookup by id returns the skill', () => {
    expect(defaultRegistry.get('reddit')?.id).toBe('reddit')
    expect(defaultRegistry.get('does-not-exist')).toBeUndefined()
  })
})
