import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SearchField } from './SearchField'

describe('SearchField', () => {
  it('renders search input with placeholder', () => {
    render(<SearchField value="" onChange={vi.fn()} />)
    const input = screen.getByPlaceholderText('Search...')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'search')
  })

  it('renders custom placeholder', () => {
    render(<SearchField placeholder="Find entities..." value="" onChange={vi.fn()} />)
    expect(screen.getByPlaceholderText('Find entities...')).toBeInTheDocument()
  })

  it('updates input value when user types', async () => {
    const handler = vi.fn()
    render(<SearchField value="" onChange={handler} />)
    const input = screen.getByPlaceholderText('Search...')
    await userEvent.type(input, 'test')
    expect(handler).toHaveBeenCalled()
  })

  it('displays provided value', () => {
    render(<SearchField value="test value" onChange={vi.fn()} />)
    const input = screen.getByDisplayValue('test value')
    expect(input).toBeInTheDocument()
  })

  it('calls onSubmit when Enter is pressed', async () => {
    const handler = vi.fn()
    render(<SearchField value="test" onChange={vi.fn()} onSubmit={handler} />)
    const input = screen.getByPlaceholderText('Search...')
    await userEvent.click(input)
    await userEvent.keyboard('{Enter}')
    expect(handler).toHaveBeenCalledOnce()
  })

  it('does not call onSubmit for other keys', async () => {
    const handler = vi.fn()
    render(<SearchField value="" onChange={vi.fn()} onSubmit={handler} />)
    const input = screen.getByPlaceholderText('Search...')
    await userEvent.type(input, 'a')
    expect(handler).not.toHaveBeenCalled()
  })

  it('renders search icon', () => {
    const { container } = render(<SearchField value="" onChange={vi.fn()} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })
})
