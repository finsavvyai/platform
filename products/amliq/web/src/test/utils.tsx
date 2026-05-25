import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter as Router } from 'react-router-dom'
import type { Alert, Entity } from '../types'

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <Router>{children}</Router>
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

export function createMockAlert(overrides?: Partial<Alert>): Alert {
  return {
    id: 'alert-1',
    entity: createMockEntity(),
    screeningId: 'screening-1',
    matchedCount: 3,
    riskLevel: 'high',
    status: 'open',
    priority: 'critical',
    notes: 'Suspicious activity detected',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    evidenceCount: 5,
    ...overrides,
  }
}

export function createMockEntity(overrides?: Partial<Entity>): Entity {
  return {
    id: 'entity-1',
    type: 'individual',
    name: {
      firstName: 'John',
      lastName: 'Doe',
      aliases: [],
    },
    identifiers: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}
