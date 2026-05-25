import { render, screen, fireEvent } from '@testing-library/react'
import { UserOnboardingWizard } from '../user-onboarding-wizard'

const tenants = [
  {
    id: 'tenant-1',
    name: 'tenant-1',
    displayName: 'Tenant One',
    domain: 'tenant1.example.com',
    logo: '',
    status: 'ACTIVE',
    plan: {
      id: 'starter',
      name: 'starter',
      displayName: 'Starter',
      features: [],
      maxUsers: 10,
      maxProjects: 5,
      storageLimit: 100,
      apiRateLimit: 1000,
      supportLevel: 'basic',
    },
    settings: {
      allowPublicSignup: false,
      requireEmailVerification: true,
      enforceMFA: false,
      sessionTimeout: 30,
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: false,
        preventReuse: 3,
        expirationDays: 90,
      },
      ipWhitelist: [],
      customBranding: {
        primaryColor: '#000',
        secondaryColor: '#fff',
      },
      integrations: {},
    },
    limits: {
      users: 10,
      projects: 5,
      storage: 100,
      apiCalls: 1000,
      embeddings: 1000,
      llmTokens: 1000,
    },
    usage: {
      users: 3,
      projects: 2,
      storage: 10,
      apiCalls: 100,
      embeddings: 50,
      llmTokens: 75,
      lastUpdated: new Date().toISOString(),
    },
    billing: {
      planId: 'starter',
      status: 'ACTIVE',
      billingEmail: 'billing@tenant1.com',
    },
    owner: {
      id: 'owner-id',
      email: 'owner@tenant1.com',
      name: 'Owner',
      role: {
        id: 'admin',
        name: 'admin',
        displayName: 'Admin',
        description: '',
        level: 100,
        permissions: [],
        isSystem: true,
        tenantId: 'tenant-1',
      },
      status: 'ACTIVE',
      tenantId: 'tenant-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      permissions: [],
      mfaEnabled: false,
      emailVerified: true,
      metadata: {},
    },
    memberCount: 3,
    isEnterprise: false,
  },
]

const roles = [
  {
    id: 'role-1',
    name: 'admin',
    displayName: 'Administrator',
    description: 'Full access',
    level: 100,
    permissions: [],
    isSystem: true,
    tenantId: 'tenant-1',
  },
]

describe('UserOnboardingWizard', () => {
  it('validates required fields before progressing', async () => {
    const onSubmit = jest.fn()
    const onClose = jest.fn()

    render(
      <UserOnboardingWizard
        open
        tenants={tenants}
        roles={roles}
        onSubmit={onSubmit}
        onClose={onClose}
      />
    )

    // Attempt to progress without filling fields
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument()
    expect(screen.getByText(/email is required/i)).toBeInTheDocument()

    // Fill account information
    fireEvent.change(screen.getByPlaceholderText(/jane doe/i), {
      target: { value: 'Jane Doe' },
    })
    fireEvent.change(screen.getByPlaceholderText(/jane.doe@company.com/i), {
      target: { value: 'jane.doe@example.com' },
    })

    // Advance to next step
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    // Tenant and role selects should be present
    expect(await screen.findByText(/tenant/i)).toBeInTheDocument()
    expect(screen.getByText(/role/i)).toBeInTheDocument()
  })
})
