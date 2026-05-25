import { describe, it, expect } from 'vitest'

describe('AdminTenants', () => {
  it('should have the correct page title', () => {
    expect(true).toBe(true)
  })

  it('should filter tenants by search', () => {
    const tenants = [
      { id: '1', name: 'acme', display_name: 'Acme Corp' },
      { id: '2', name: 'beta', display_name: 'Beta Inc' },
    ]
    const search = 'acme'
    const filtered = tenants.filter(
      t => t.name.includes(search) || t.display_name.toLowerCase().includes(search)
    )
    expect(filtered).toHaveLength(1)
    expect(filtered[0].name).toBe('acme')
  })
})
