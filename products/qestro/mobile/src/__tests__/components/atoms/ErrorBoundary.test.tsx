import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ErrorBoundary } from '../../../components/atoms/ErrorBoundary';

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test error');
  return <Text>All good</Text>;
}

describe('ErrorBoundary', () => {
  // Suppress console.error for expected error boundary logs
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

  afterAll(() => spy.mockRestore());

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeTruthy();
  });

  it('renders error UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Test error')).toBeTruthy();
  });

  it('renders Try Again button', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Try Again')).toBeTruthy();
  });
});
