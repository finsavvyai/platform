import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const mockLogin = vi.fn()
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}))

vi.mock('../components/auth/SignInButtons', () => ({
  default: () => <div data-testid="sign-in-buttons" />,
}))

vi.mock('../components/auth/AuthDivider', () => ({
  default: () => <div data-testid="auth-divider" />,
}))

import { Login } from './Login'

const renderLogin = (initialEntries = ['/login']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Login />
    </MemoryRouter>
  )

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders email and password fields', () => {
    renderLogin()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('renders submit button', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('submits form with email and password', async () => {
    mockLogin.mockResolvedValue(undefined)
    renderLogin()
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password'), 'pass1234')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(mockLogin).toHaveBeenCalledWith('a@b.com', 'pass1234')
  })

  it('navigates to dashboard on success', async () => {
    mockLogin.mockResolvedValue(undefined)
    renderLogin()
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password'), 'pass1234')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'))
  })

  it('displays error on login failure', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'))
    renderLogin()
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials')
    })
  })

  it('shows loading state during submission', async () => {
    mockLogin.mockImplementation(() => new Promise(() => {}))
    renderLogin()
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password'), 'pass')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
  })

  it('renders forgot password and signup links', () => {
    renderLogin()
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument()
    expect(screen.getByText(/start free trial/i)).toBeInTheDocument()
  })

  it('renders OAuth buttons and divider', () => {
    renderLogin()
    expect(screen.getByTestId('sign-in-buttons')).toBeInTheDocument()
    expect(screen.getByTestId('auth-divider')).toBeInTheDocument()
  })
})
