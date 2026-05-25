import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ForgotPassword from './ForgotPassword'

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: {} }),
    })
  ) as any
})

const renderForgot = () =>
  render(
    <MemoryRouter>
      <ForgotPassword />
    </MemoryRouter>
  )

describe('ForgotPassword', () => {
  it('renders title and description', () => {
    renderForgot()
    expect(screen.getByText(/reset your password/i)).toBeInTheDocument()
  })

  it('renders email input', () => {
    renderForgot()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
  })

  it('renders submit button', () => {
    renderForgot()
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
  })

  it('renders back to login link', () => {
    renderForgot()
    expect(screen.getByText(/back to login/i)).toBeInTheDocument()
  })

  it('shows success message after submission', async () => {
    renderForgot()
    await userEvent.type(screen.getByLabelText(/email address/i), 'user@test.com')
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }))
    await waitFor(() => {
      expect(screen.getByText(/check your inbox/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /send reset link/i })).not.toBeInTheDocument()
  })

  it('hides form after submission', async () => {
    renderForgot()
    await userEvent.type(screen.getByLabelText(/email address/i), 'user@test.com')
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }))
    await waitFor(() => {
      expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument()
    })
  })
})
