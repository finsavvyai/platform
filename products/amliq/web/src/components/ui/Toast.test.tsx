import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ToastProvider, useToast } from './Toast'

function TestConsumer() {
  const { toast } = useToast()
  return (
    <div>
      <button onClick={() => toast('Info message')}>Show Info</button>
      <button onClick={() => toast('Success!', 'success')}>Show Success</button>
      <button onClick={() => toast('Error!', 'error')}>Show Error</button>
    </div>
  )
}

const renderToast = () =>
  render(
    <ToastProvider>
      <TestConsumer />
    </ToastProvider>
  )

describe('ToastProvider', () => {
  it('renders children', () => {
    renderToast()
    expect(screen.getByText('Show Info')).toBeInTheDocument()
  })

  it('shows toast when triggered', async () => {
    renderToast()
    await act(async () => {
      screen.getByText('Show Info').click()
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Info message')
  })

  it('renders success toast with green accent stripe', async () => {
    renderToast()
    await act(async () => {
      screen.getByText('Show Success').click()
    })
    const alert = screen.getByRole('alert')
    const stripe = alert.querySelector('div[class*="bg-emerald-600"]')
    expect(stripe).toBeInTheDocument()
  })

  it('renders error toast with red accent stripe', async () => {
    renderToast()
    await act(async () => {
      screen.getByText('Show Error').click()
    })
    const alert = screen.getByRole('alert')
    const stripe = alert.querySelector('div[class*="bg-red-600"]')
    expect(stripe).toBeInTheDocument()
  })

  it('renders info toast with blue accent stripe', async () => {
    renderToast()
    await act(async () => {
      screen.getByText('Show Info').click()
    })
    const alert = screen.getByRole('alert')
    const stripe = alert.querySelector('div[class*="bg-[#C9A96E]"]')
    expect(stripe).toBeInTheDocument()
  })

  it('has aria-live polite region', () => {
    const { container } = renderToast()
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument()
  })

  it('shows toast and schedules removal', async () => {
    renderToast()
    await act(async () => {
      screen.getByText('Show Info').click()
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Info message')
  })
})
