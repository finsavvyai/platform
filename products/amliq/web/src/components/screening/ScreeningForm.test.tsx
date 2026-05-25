import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ScreeningForm } from './ScreeningForm'

describe('ScreeningForm', () => {
  it('renders entity type selection', () => {
    render(<ScreeningForm onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Individual' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Company' })).toBeInTheDocument()
  })

  it('renders individual fields by default', () => {
    render(<ScreeningForm onSubmit={vi.fn()} />)
    expect(screen.getByPlaceholderText('First Name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Last Name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Nationality')).toBeInTheDocument()
  })

  it('switches to company fields when company type selected', async () => {
    render(<ScreeningForm onSubmit={vi.fn()} />)
    const companyTab = screen.getByRole('button', { name: 'Company' })
    await userEvent.click(companyTab)
    expect(screen.getByPlaceholderText('Company Name')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('First Name')).not.toBeInTheDocument()
  })

  it('submits individual form data', async () => {
    const handler = vi.fn()
    render(<ScreeningForm onSubmit={handler} />)

    await userEvent.type(screen.getByPlaceholderText('First Name'), 'John')
    await userEvent.type(screen.getByPlaceholderText('Last Name'), 'Doe')
    await userEvent.type(screen.getByPlaceholderText('Nationality'), 'US')

    await userEvent.click(screen.getByRole('button', { name: /screen entity/i }))

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'John',
        lastName: 'Doe',
        nationality: 'US',
      }),
      'individual'
    )
  })

  it('submits company form data', async () => {
    const handler = vi.fn()
    render(<ScreeningForm onSubmit={handler} />)

    const companyTab = screen.getByRole('button', { name: 'Company' })
    await userEvent.click(companyTab)

    await userEvent.type(screen.getByPlaceholderText('Company Name'), 'Acme Corp')
    await userEvent.click(screen.getByRole('button', { name: /screen entity/i }))

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: 'Acme Corp',
      }),
      'company'
    )
  })

  it('disables submit button when loading', () => {
    render(<ScreeningForm onSubmit={vi.fn()} loading={true} />)
    expect(screen.getByRole('button', { name: /screening/i })).toBeDisabled()
  })

  it('shows loading text when loading', () => {
    render(<ScreeningForm onSubmit={vi.fn()} loading={true} />)
    expect(screen.getByText('Screening...')).toBeInTheDocument()
  })

  it('prevents form submission with Enter key', async () => {
    const handler = vi.fn()
    render(<ScreeningForm onSubmit={handler} />)
    const form = screen.getByPlaceholderText('First Name').closest('form')
    await userEvent.type(form!, '{Enter}')
    expect(handler).not.toHaveBeenCalled()
  })
})
