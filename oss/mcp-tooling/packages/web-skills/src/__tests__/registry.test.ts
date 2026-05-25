import { describe, it, expect } from 'vitest'
import { createRegistry, validateSkill } from '../registry.js'
import type { WebSkill } from '../types.js'

const validSkill: WebSkill = {
  id: 'test-site',
  site: 'test.com',
  version: '0.0.1',
  description: 'x',
  baseUrl: 'https://test.com',
  auth: { type: 'none' },
  actions: [
    {
      name: 'read',
      description: 'read it',
      inputSchema: { type: 'object', properties: {} },
      handler: 'return 1;',
    },
  ],
}

describe('registry', () => {
  it('registers and retrieves', () => {
    const r = createRegistry()
    r.register(validSkill)
    expect(r.get('test-site')).toBeDefined()
  })

  it('rejects duplicates', () => {
    const r = createRegistry([validSkill])
    expect(() => r.register(validSkill)).toThrow(/duplicate/)
  })

  it('rejects invalid id', () => {
    expect(() => validateSkill({ ...validSkill, id: 'Bad Id' })).toThrow(/invalid skill id/)
  })

  it('rejects bad baseUrl', () => {
    expect(() => validateSkill({ ...validSkill, baseUrl: 'not a url' })).toThrow(/baseUrl/)
  })

  it('rejects empty actions', () => {
    expect(() => validateSkill({ ...validSkill, actions: [] })).toThrow(/no actions/)
  })

  it('rejects bad action name', () => {
    expect(() =>
      validateSkill({ ...validSkill, actions: [{ ...validSkill.actions[0], name: 'Bad-Name' }] })
    ).toThrow(/invalid action name/)
  })

  it('rejects duplicate action names', () => {
    expect(() =>
      validateSkill({
        ...validSkill,
        actions: [validSkill.actions[0], validSkill.actions[0]],
      })
    ).toThrow(/duplicate action/)
  })
})
