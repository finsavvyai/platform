# Tests Directory

This directory contains all test files organized by component and test type.

## Directory Structure

```
tests/
├── backend/           # Backend test files
├── frontend/          # Frontend test files
├── agent/            # Agent service test files
└── README.md         # This file
```

## Test Organization

### Backend Tests (`backend/`)
Contains all backend-related test files moved from `backend/src/__tests__/`:

- **Unit Tests**: Individual component and service tests
- **Integration Tests**: API and database integration tests
- **Functional Tests**: End-to-end functionality tests
- **Model Tests**: Data model validation tests
- **Service Tests**: Business logic service tests
- **Route Tests**: API endpoint tests

### Frontend Tests (`frontend/`)
Contains all frontend-related test files moved from `frontend/src/__tests__/`:

- **Component Tests**: React component testing
- **Page Tests**: Full page component testing
- **Hook Tests**: Custom React hooks testing
- **Utility Tests**: Frontend utility function tests

### Agent Tests (`agent/`)
Contains agent service test files:

- **Service Tests**: Agent service functionality tests
- **Integration Tests**: Agent-to-backend communication tests

## Running Tests

### All Tests
```bash
# Using automation scripts
./scripts/testing/run-tests.sh

# Using npm from project root
npm test
```

### Backend Tests
```bash
# From project root
cd backend && npm test

# Specific test files
cd backend && npm test -- tests/backend/services/WebRecordingService.test.ts
```

### Frontend Tests
```bash
# From project root
cd frontend && npm test

# Specific test files
cd frontend && npm test -- tests/frontend/components/RecordingStudio.test.tsx
```

### Agent Tests
```bash
# From project root
cd agent && npm test
```

## Test Configuration

### Backend Test Configuration
- **Jest Configuration**: `backend/jest.config.js`
- **Test Environment**: Node.js with database mocking
- **Setup Files**: `tests/backend/setup.ts`, `tests/backend/globalSetup.ts`
- **Database Setup**: `tests/backend/db-setup.ts`

### Frontend Test Configuration
- **Vitest Configuration**: `frontend/vitest.config.ts`
- **Test Environment**: jsdom for React component testing
- **Testing Library**: React Testing Library for component tests

### Test Database
- **Environment**: `.env.test` configuration
- **Database**: Separate test database instance
- **Cleanup**: Automatic cleanup between tests

## Test Patterns

### Backend Test Example
```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { WebRecordingService } from '../../src/services/WebRecordingService';

describe('WebRecordingService', () => {
  let service: WebRecordingService;

  beforeEach(() => {
    service = new WebRecordingService();
  });

  it('should create a new recording session', async () => {
    const session = await service.createSession();
    expect(session.id).toBeDefined();
    expect(session.status).toBe('active');
  });
});
```

### Frontend Test Example
```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RecordingStudio } from '../../src/components/RecordingStudio';

describe('RecordingStudio', () => {
  it('renders recording controls', () => {
    render(<RecordingStudio />);
    expect(screen.getByText('Start Recording')).toBeInTheDocument();
  });
});
```

## Test Data and Mocks

### Mock Data
- **Database Mocks**: `tests/backend/mocks/database.ts`
- **API Mocks**: Service-specific mock implementations
- **Test Fixtures**: Predefined test data sets

### Test Utilities
- **Setup Helpers**: Common test setup functions
- **Assertion Helpers**: Custom assertion utilities
- **Mock Factories**: Factory functions for creating test data

## Coverage Reports

Test coverage reports are generated in:
- **Backend**: `backend/coverage/`
- **Frontend**: `frontend/coverage/`

### Coverage Thresholds
- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%

## Continuous Integration

Tests are automatically run in CI/CD pipeline:
- **Pre-commit**: Basic linting and unit tests
- **Pull Request**: Full test suite
- **Deployment**: Integration and E2E tests

## Troubleshooting

### Common Issues
- **Database Connection**: Ensure test database is running
- **Environment Variables**: Check `.env.test` configuration
- **Port Conflicts**: Verify test ports are available
- **Mock Issues**: Check mock implementations and data

### Debug Mode
```bash
# Backend tests with debug
DEBUG=test npm test

# Frontend tests with debug
npm test -- --reporter=verbose
```

### Test Isolation
- Each test should be independent
- Clean up test data after each test
- Use proper setup and teardown hooks
- Avoid shared state between tests

---

For more information about testing strategies and best practices, see the [Testing Documentation](../docs/testing/).