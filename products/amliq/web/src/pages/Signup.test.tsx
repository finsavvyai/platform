import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const mockSignup = vi.fn()
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ signup: mockSignup }),
}))

vi.mock('../components/auth/SignInButtons', () => ({
  default: () => <div data-testid="sign-in-buttons" />,
}))

vi.mock('../components/auth/AuthDivider', () => ({
  default: () => <div data-testid="auth-divider" />,
}))

import { Signup } from './Signup'

const renderSignup = () =>
  render(
    <MemoryRouter>
      <Signup />
    </MemoryRouter>
  )

describe('Signup', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders all form fields', () => {
    renderSignup()
    expect(screen.getByLabelText('Organization name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Country')).toBeInTheDocument()
  })

  it('renders submit button', () => {
    renderSignup()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('submits form data correctly', async () => {
    mockSignup.mockResolvedValue(undefined)
    renderSignup()
    await userEvent.type(screen.getByLabelText('Organization name'), 'Acme')
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(mockSignup).toHaveBeenCalledWith('a@b.com', 'password123', 'Acme', 'US')
  })

  it('navigates to onboarding on success', async () => {
    mockSignup.mockResolvedValue(undefined)
    renderSignup()
    await userEvent.type(screen.getByLabelText('Organization name'), 'Acme')
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/onboarding'))
  })

  it('displays error on signup failure', async () => {
    mockSignup.mockRejectedValue(new Error('Server unavailable'))
    renderSignup()
    await userEvent.type(screen.getByLabelText('Organization name'), 'Acme')
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server unavailable')
    })
  })

  it('shows "already have account" banner for duplicate email', async () => {
    mockSignup.mockRejectedValue(new Error('Email already exists'))
    renderSignup()
    await userEvent.type(screen.getByLabelText('Organization name'), 'Acme')
    await userEvent.type(screen.getByLabelText('Email'), 'dup@b.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/already have an account/i)
    })
  })

  it('shows loading state during submission', async () => {
    mockSignup.mockImplementation(() => new Promise(() => {}))
    renderSignup()
    await userEvent.type(screen.getByLabelText('Organization name'), 'Acme')
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password'), 'pass1234')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled()
  })

  it('renders terms and privacy links', () => {
    renderSignup()
    expect(screen.getByText(/terms/i)).toBeInTheDocument()
    expect(screen.getByText(/privacy policy/i)).toBeInTheDocument()
  })
})
