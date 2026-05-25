import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { Register } from '../../pages/Register'
import { AuthProvider } from '../../contexts/AuthContext'

// Mock the useAuth hook
const mockSignUp = vi.fn()
vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext')
  return {
    ...actual,
    useAuth: () => ({
      signUp: mockSignUp,
      resendVerification: vi.fn(),
    }),
  }
})

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>{ui}</AuthProvider>
    </BrowserRouter>
  )
}

describe('Register Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the registration form', () => {
    renderWithProviders(<Register />)

    expect(screen.getByText('Create account')).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('shows password strength indicator when typing', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Register />)

    const passwordInput = screen.getByLabelText(/^password$/i)

    await user.type(passwordInput, 'weak')

    expect(screen.getByText('WEAK')).toBeInTheDocument()
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument()
  })

  it('shows strong password indicator for complex passwords', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Register />)

    const passwordInput = screen.getByLabelText(/^password$/i)

    await user.type(passwordInput, 'StrongPass123!')

    expect(screen.getByText('STRONG')).toBeInTheDocument()
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Register />)

    const passwordInput = screen.getByLabelText(/^password$/i)
    const toggleButton = screen.getByRole('button', { name: '' }) // Eye icon button

    expect(passwordInput).toHaveAttribute('type', 'password')

    await user.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'text')

    await user.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('validates password match', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Register />)

    const passwordInput = screen.getByLabelText(/^password$/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)

    await user.type(passwordInput, 'password123')
    await user.type(confirmPasswordInput, 'different')

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
  })

  it('disables submit button for weak passwords', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Register />)

    const passwordInput = screen.getByLabelText(/^password$/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const emailInput = screen.getByLabelText(/email address/i)
    const submitButton = screen.getByRole('button', { name: /create account/i })

    // Fill form with weak password
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'weak')
    await user.type(confirmPasswordInput, 'weak')

    expect(submitButton).toBeDisabled()
  })

  it('enables submit button for strong passwords', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Register />)

    const passwordInput = screen.getByLabelText(/^password$/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const emailInput = screen.getByLabelText(/email address/i)
    const submitButton = screen.getByRole('button', { name: /create account/i })

    // Fill form with strong password
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'StrongPass123!')
    await user.type(confirmPasswordInput, 'StrongPass123!')

    expect(submitButton).not.toBeDisabled()
  })

  it('calls signUp with correct data', async () => {
    const user = userEvent.setup()
    mockSignUp.mockResolvedValue({
      success: true,
      message: 'Account created successfully!',
    })

    renderWithProviders(<Register />)

    const emailInput = screen.getByLabelText(/email address/i)
    const displayNameInput = screen.getByLabelText(/display name/i)
    const passwordInput = screen.getByLabelText(/^password$/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const submitButton = screen.getByRole('button', { name: /create account/i })

    await user.type(emailInput, 'test@example.com')
    await user.type(displayNameInput, 'Test User')
    await user.type(passwordInput, 'StrongPass123!')
    await user.type(confirmPasswordInput, 'StrongPass123!')
    await user.click(submitButton)

    expect(mockSignUp).toHaveBeenCalledWith('test@example.com', 'StrongPass123!', 'Test User')
  })

  it('shows success message for email verification required', async () => {
    const user = userEvent.setup()
    mockSignUp.mockResolvedValue({
      success: true,
      message: 'Please check your email to verify your account',
      needsVerification: true,
    })

    renderWithProviders(<Register />)

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/^password$/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const submitButton = screen.getByRole('button', { name: /create account/i })

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'StrongPass123!')
    await user.type(confirmPasswordInput, 'StrongPass123!')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Check your email!')).toBeInTheDocument()
      expect(screen.getByText(/We've sent a verification email/)).toBeInTheDocument()
    })
  })

  it('shows error message on registration failure', async () => {
    const user = userEvent.setup()
    mockSignUp.mockResolvedValue({
      success: false,
      message: 'Email already exists',
    })

    renderWithProviders(<Register />)

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/^password$/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const submitButton = screen.getByRole('button', { name: /create account/i })

    await user.type(emailInput, 'existing@example.com')
    await user.type(passwordInput, 'StrongPass123!')
    await user.type(confirmPasswordInput, 'StrongPass123!')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Email already exists')).toBeInTheDocument()
    })
  })

  it('validates email format', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Register />)

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/^password$/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const submitButton = screen.getByRole('button', { name: /create account/i })

    await user.type(emailInput, 'invalid-email')
    await user.type(passwordInput, 'StrongPass123!')
    await user.type(confirmPasswordInput, 'StrongPass123!')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
    })
  })

  it('validates password strength requirements', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Register />)

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/^password$/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const submitButton = screen.getByRole('button', { name: /create account/i })

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'weak') // Only meets length requirement
    await user.type(confirmPasswordInput, 'weak')
    await user.click(submitButton)

    await waitFor(() => {
      expect(
        screen.getByText('Password must meet at least 3 of the 5 security requirements')
      ).toBeInTheDocument()
    })
  })
})
