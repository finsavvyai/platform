# Frontend Component Tests

This directory contains comprehensive unit tests for React components, hooks, and pages in the Questro frontend application.

## Test Structure

```
tests/frontend/
├── components/
│   ├── atoms/           # Basic UI components (Button, Input, etc.)
│   ├── molecules/       # Composite components (TestCard, etc.)
│   ├── organisms/        # Complex components (Dashboard, etc.)
│   └── pages/           # Page-level components (LoginPage, etc.)
├── hooks/                # Custom React hooks
├── utils/                # Utility functions
├── services/             # Service layer tests
└── setup.ts              # Test configuration
```

## Testing Framework

- **Vitest** - Fast unit test framework
- **React Testing Library** - Testing utilities for React
- **User Event** - Advanced user interaction simulation
- **Jest DOM** - Custom DOM matchers

## Component Testing Coverage

### Atoms (Basic UI Components)

#### Button Component (`components/atoms/Button.test.tsx`)
- ✅ Rendering with different variants, sizes, and states
- ✅ Interaction handling (click, keyboard, accessibility)
- ✅ Loading states and disabled states
- ✅ Icon integration and positioning
- ✅ CSS classes and styling
- ✅ Form integration and ref forwarding
- ✅ Performance and edge cases

#### Input Component (`components/atoms/Input.test.tsx`)
- ✅ Basic rendering with labels, icons, and helpers
- ✅ Input interaction (typing, focus, blur)
- ✅ Password visibility toggle
- ✅ Error states and validation
- ✅ Accessibility and ARIA attributes
- ✅ Form integration
- ✅ Edge cases and performance

### Organisms (Complex Components)

#### Dashboard Component (`components/organisms/Dashboard.test.tsx`)
- ✅ Metrics display and change indicators
- ✅ Recent activity feed
- ✅ Loading and empty states
- ✅ User interactions (refresh, navigation)
- ✅ Data updates and state management
- ✅ Responsive design and accessibility
- ✅ Error handling and performance
- ✅ Component composition

### Pages

#### LoginPage (`pages/LoginPage.test.tsx`)
- ✅ Form rendering and validation
- ✅ User input handling
- ✅ Password visibility toggle
- ✅ Loading states during submission
- ✅ Error display and handling
- ✅ Navigation after successful login
- ✅ Accessibility and keyboard navigation
- ✅ Security features and edge cases

### Custom Hooks

#### useWebSocket Hook (`hooks/useWebSocket.test.tsx`)
- ✅ Connection lifecycle management
- ✅ Message sending and receiving
- ✅ Reconnection logic with exponential backoff
- ✅ Manual connection control
- ✅ Cleanup and memory management
- ✅ Error handling and performance
- ✅ Integration scenarios and edge cases

## Test Categories

### 1. Rendering Tests
- Verify components render correctly with different props
- Test conditional rendering and state changes
- Validate DOM structure and semantic HTML

### 2. Interaction Tests
- Simulate user interactions (click, type, focus)
- Test event handlers and callback functions
- Validate state changes and side effects

### 3. Accessibility Tests
- Check ARIA attributes and roles
- Test keyboard navigation
- Validate screen reader compatibility
- Test focus management

### 4. Form Integration Tests
- Test form submission and validation
- Validate controlled vs uncontrolled inputs
- Test error states and helper text

### 5. Performance Tests
- Measure render performance
- Test memory cleanup
- Validate re-render optimization

### 6. Error Handling Tests
- Test graceful error handling
- Validate error boundaries
- Test network and async errors

### 7. Edge Cases Tests
- Test with invalid/missing props
- Test boundary conditions
- Validate unusual user inputs

## Test Configuration

### Setup (`setup.ts`)
- Mock framer-motion for animations
- Mock lucide-react icons
- Mock react-router-dom
- Mock react-helmet-async
- Global test utilities (ResizeObserver, IntersectionObserver, WebSocket)

### Vitest Configuration (`vitest.config.ts`)
- jsdom environment for DOM testing
- TypeScript support with tsx files
- Coverage reporting and thresholds
- Path aliases for clean imports

## Running Tests

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run specific test categories
npm run test:components
npm run test:pages
npm run test:hooks
npm run test:services
npm run test:utils

# Run tests in watch mode
npm run test:ui

# Run tests in CI mode
npm run test:ci
```

## Test Best Practices

### 1. Test Structure
```typescript
describe('ComponentName', () => {
  beforeEach(() => {
    // Setup before each test
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    // Rendering tests
  });

  describe('Interaction', () => {
    // User interaction tests
  });

  describe('Accessibility', () => {
    // Accessibility tests
  });
});
```

### 2. Test Naming
- Use descriptive test names
- Follow "should [do something]" pattern
- Group related tests in describe blocks

### 3. Mocking Strategy
- Mock external dependencies (APIs, routing)
- Use vitest mocks for consistent behavior
- Mock UI libraries that don't work in test environment

### 4. Assertions
- Use specific assertions over generic ones
- Test both positive and negative cases
- Verify behavior, not implementation

### 5. Cleanup
- Clean up timers and intervals
- Unmount components properly
- Reset mocks between tests

## Coverage Goals

- **Global**: 80% lines, functions, branches, statements
- **Components**: 90% coverage
- **Hooks**: 90% coverage
- **Pages**: 85% coverage

## Current Status

### ✅ Completed Tests
- Button component (74 test cases)
- Input component (85 test cases)
- Dashboard component (65 test cases)
- LoginPage component (60 test cases)
- useWebSocket hook (70 test cases)

### 🚧 In Progress
- Additional molecule components
- Service layer tests
- Utility function tests

### 📋 Planned
- Integration tests between components
- End-to-end tests for user workflows
- Visual regression tests
- Performance benchmarks

## Test Utilities

### Custom Render Functions
```typescript
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const customRender = (ui, options = {}) =>
  render(ui, {
    wrapper: ({ children }) => (
      <BrowserRouter>
        {children}
      </BrowserRouter>
    ),
    ...options,
  });

export * from '@testing-library/react';
export { customRender as render };
```

### Test Data Factories
```typescript
export const createMockProps = (overrides = {}) => ({
  // Default props
  ...overrides,
});

export const createMockUser = (overrides = {}) => ({
  id: 'test-user-1',
  email: 'test@example.com',
  ...overrides,
});
```

### Mock Helpers
```typescript
export const mockWebSocket = () => {
  // Mock WebSocket implementation
};

export const mockApiResponse = (data) => {
  // Mock API response
};
```

## Debugging Tests

### Common Issues
1. **Framer Motion Warnings**: Mocked components pass through unknown props
2. **WebSocket Timeouts**: Use fake timers and advance them manually
3. **Async Test Timeouts**: Use `waitFor` for async assertions
4. **Memory Leaks**: Ensure proper cleanup in `afterEach`

### Debugging Tips
```typescript
// Use screen.debug() to inspect DOM
screen.debug();

// Use logRole to see available roles
import { logRoles } from '@testing-library/dom';
logRoles(container);

// Use act() for state updates
await act(async () => {
  // State-changing code
});
```

## Future Improvements

1. **Visual Testing**: Add visual regression tests
2. **Performance Testing**: Add render performance benchmarks
3. **Accessibility Testing**: Add automated a11y testing
4. **Integration Testing**: Add component integration tests
5. **E2E Testing**: Add Playwright end-to-end tests

## Contributing

When adding new tests:

1. Follow the established test structure
2. Write descriptive test names
3. Test both happy paths and edge cases
4. Include accessibility tests where applicable
5. Add performance tests for complex components
6. Update this README with new test categories

## Resources

- [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro)
- [Vitest Docs](https://vitest.dev/)
- [User Event Docs](https://testing-library.com/docs/user-event/intro)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)