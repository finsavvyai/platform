# AMLIQ Dashboard Testing Guide

## Quick Start

### Installation
```bash
cd /sessions/loving-cool-einstein/mnt/outputs/aegis-v2/web
npm install
```

### Run Tests
```bash
# Run all tests
npm test

# Run in watch mode
npm test -- --watch

# Run specific test file
npm test AlertCard

# Run with UI dashboard
npm run test:ui

# Generate coverage report
npm test -- --coverage
```

## Test Suite Overview

**28 total test files** covering:
- 9 UI component tests
- 3 data display component tests
- 3 alert component tests
- 3 configuration component tests
- 2 layout component tests
- 1 screening component test
- 4 page/integration tests
- 3 custom hook tests

**All files are under 100 lines** for maintainability.

## Writing New Tests

### Use the Custom Render Function
```typescript
import { render, screen } from '@test/utils'  // Already has Router wrapper
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

describe('MyComponent', () => {
  it('does something', async () => {
    render(<MyComponent prop="value" />)
    expect(screen.getByText('expected')).toBeInTheDocument()
  })
})
```

### Mock Alert Data
```typescript
import { createMockAlert } from '@test/utils'

const alert = createMockAlert({
  status: 'open',
  priority: 'critical',
})
```

### Mock Entity Data
```typescript
import { createMockEntity } from '@test/utils'

const entity = createMockEntity({
  type: 'company',
  name: { firstName: 'Acme', lastName: 'Corp' },
})
```

### Test User Interactions
```typescript
import userEvent from '@testing-library/user-event'

it('clicks button', async () => {
  render(<Button onClick={handler}>Click</Button>)
  await userEvent.click(screen.getByRole('button'))
  expect(handler).toHaveBeenCalled()
})

it('types in input', async () => {
  render(<SearchField value="" onChange={handler} />)
  await userEvent.type(screen.getByPlaceholderText('Search'), 'term')
  expect(handler).toHaveBeenCalled()
})
```

### Test Async Operations
```typescript
import { waitFor } from '@testing-library/react'

it('loads data', async () => {
  render(<Dashboard />)
  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument()
  })
})
```

### Mock Window APIs
```typescript
it('checks media query', () => {
  const spy = vi.spyOn(window, 'matchMedia')
  render(<Component />)
  expect(spy).toHaveBeenCalledWith('(max-width: 639px)')
})
```

## Test Patterns Used

### Pattern: Component Variants
```typescript
it('renders different variants', () => {
  const { rerender } = render(<Button variant="primary">Button</Button>)
  expect(screen.getByRole('button')).toHaveClass('bg-apple-blue')

  rerender(<Button variant="secondary">Button</Button>)
  expect(screen.getByRole('button')).toHaveClass('bg-apple-bg-tertiary')
})
```

### Pattern: Event Handlers
```typescript
it('calls handler on click', async () => {
  const handler = vi.fn()
  render(<Button onClick={handler}>Click</Button>)
  await userEvent.click(screen.getByRole('button'))
  expect(handler).toHaveBeenCalledOnce()
})
```

### Pattern: Form Submission
```typescript
it('submits form data', async () => {
  const handler = vi.fn()
  render(<Form onSubmit={handler} />)
  await userEvent.type(screen.getByPlaceholderText('Name'), 'John')
  await userEvent.click(screen.getByRole('button', { name: /submit/i }))
  expect(handler).toHaveBeenCalledWith(expect.objectContaining({ name: 'John' }))
})
```

### Pattern: Conditional Rendering
```typescript
it('shows loading state', () => {
  const { rerender } = render(<Component loading={false} />)
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()

  rerender(<Component loading={true} />)
  expect(screen.getByRole('progressbar')).toBeInTheDocument()
})
```

### Pattern: List Rendering
```typescript
it('renders list items', () => {
  const items = [
    createMockAlert({ id: '1' }),
    createMockAlert({ id: '2' }),
  ]
  render(<AlertList alerts={items} />)
  expect(screen.getAllByRole('button')).toHaveLength(2)
})
```

## Testing Philosophy

### 1. Test Behavior, Not Implementation
```typescript
// ✓ Good - tests what user sees
expect(screen.getByText('Submit')).toBeInTheDocument()
await userEvent.click(screen.getByRole('button'))

// ✗ Bad - tests internal state
expect(component.state.isLoading).toBe(false)
```

### 2. Use Accessible Queries
```typescript
// ✓ Good - accessible
screen.getByRole('button', { name: /submit/i })
screen.getByLabelText('Email')
screen.getByPlaceholderText('Name')

// ✗ Bad - brittle selectors
screen.getByTestId('btn-1')
container.querySelector('.my-btn')
```

### 3. Async Handling
```typescript
// ✓ Good - waits for element
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument()
})

// ✗ Bad - no waiting
expect(screen.getByText('Loaded')).toBeInTheDocument()
```

## Common Issues & Solutions

### Issue: "Unable to find element"
**Solution**: Use `waitFor` if element appears after async operation
```typescript
await waitFor(() => {
  expect(screen.getByText('Expected text')).toBeInTheDocument()
})
```

### Issue: "Cannot read property of null"
**Solution**: Check element exists before accessing properties
```typescript
const element = screen.queryByText('Text')  // Returns null if not found
expect(element).toBeInTheDocument()  // Will fail with helpful message
```

### Issue: Act warning
**Solution**: Wrap state updates in act (handled by userEvent automatically)
```typescript
await userEvent.click(button)  // Automatically wrapped in act
```

### Issue: Component not re-rendering
**Solution**: Use `rerender` from render result
```typescript
const { rerender } = render(<Component prop={1} />)
rerender(<Component prop={2} />)
```

## File Organization

### Adding Tests for a New Component
```
src/components/newfeature/
├── NewComponent.tsx
└── NewComponent.test.tsx    ← Add test file here
```

### Test File Template
```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { NewComponent } from './NewComponent'

describe('NewComponent', () => {
  it('renders correctly', () => {
    render(<NewComponent />)
    expect(screen.getByText('expected')).toBeInTheDocument()
  })

  it('handles user interaction', async () => {
    const handler = vi.fn()
    render(<NewComponent onClick={handler} />)
    await userEvent.click(screen.getByRole('button'))
    expect(handler).toHaveBeenCalledOnce()
  })
})
```

## Debugging Tests

### Print DOM Structure
```typescript
const { debug } = render(<Component />)
debug()  // Prints HTML to console
```

### Screen Debug
```typescript
screen.debug()  // Prints current screen state
screen.debug(screen.getByRole('button'))  // Prints specific element
```

### Inspect Mock Calls
```typescript
const mock = vi.fn()
render(<Component onClick={mock} />)
console.log(mock.mock.calls)  // See all calls
console.log(mock.mock.results)  // See return values
```

## Performance Tips

1. **Minimal Mocks**: Only mock what's necessary
2. **Reuse Factories**: Use createMockAlert/Entity to reduce setup code
3. **Test Focused Behaviors**: Don't test parent/child components together unless needed
4. **Group Related Tests**: Organize tests logically in describe blocks

## Resources

- [Vitest Documentation](https://vitest.dev)
- [React Testing Library Docs](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [User Event API](https://testing-library.com/user-event)

## Test Coverage Goals

Current coverage by category:
- UI Components: 100% (9/9)
- Data Display: 100% (3/3)
- Alerts: 100% (3/3)
- Configuration: 100% (3/3)
- Layout: 100% (2/2)
- Screening: 100% (1/1)
- Pages: 100% (4/4)
- Hooks: 100% (3/3)

**Total: 28/28 components tested** ✓

## Contact & Support

For questions about the test suite or adding new tests, refer to TEST_SUMMARY.md for detailed coverage information.
