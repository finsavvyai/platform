import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from '../../../components/atoms/Button';

jest.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      accentPrimary: '#3b82f6', bgTertiary: '#333', borderColor: '#444',
      textPrimary: '#fff', accentError: '#ef4444', glassBg: '#fff1', glassBorder: '#fff2',
    },
  }),
}));

describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<Button onPress={onPress}>Press</Button>);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    render(<Button onPress={onPress} disabled>Press</Button>);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows loading indicator when isLoading', () => {
    render(<Button isLoading>Loading</Button>);
    // Loading state replaces text with ActivityIndicator
    expect(screen.queryByText('Loading')).toBeNull();
  });

  it('renders with different variants', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByText('Primary')).toBeTruthy();
    rerender(<Button variant="danger">Danger</Button>);
    expect(screen.getByText('Danger')).toBeTruthy();
    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByText('Ghost')).toBeTruthy();
  });

  it('renders with different sizes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByText('Small')).toBeTruthy();
    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByText('Large')).toBeTruthy();
  });
});
