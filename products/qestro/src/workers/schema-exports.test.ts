import { describe, expect, it } from 'vitest'
import * as schema from '../db/schema'

describe('Workers schema exports', () => {
  it('exports test execution tables used by workers runtime code', () => {
    expect(schema.testExecutions).toBeDefined()
    expect(schema.testExecutionResults).toBeDefined()
    expect(schema.testArtifacts).toBeDefined()
    expect(schema.testExecutionMetrics).toBeDefined()
  })
})
