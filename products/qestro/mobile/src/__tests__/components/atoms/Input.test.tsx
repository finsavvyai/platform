import { render, screen, fireEvent } from '@testing-library/react-native';
import { Input } from '../../../components/atoms/Input';

jest.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      textPrimary: '#fff', textSecondary: '#aaa', textMuted: '#666',
      bgSecondary: '#1a1a1a', bgTertiary: '#333',
      borderColor: '#444', accentPrimary: '#3b82f6', accentError: '#ef4444',
    },
  }),
}));

describe('Input', () => {
  it('renders with placeholder', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeTruthy();
  });

  it('renders label when provided', () => {
    render(<Input label="Email" placeholder="you@test.com" />);
    expect(screen.getByText('Email')).toBeTruthy();
  });

  it('calls onChangeText', () => {
    const onChange = jest.fn();
    render(<Input placeholder="Type" onChangeText={onChange} />);
    fireEvent.changeText(screen.getByPlaceholderText('Type'), 'hello');
    expect(onChange).toHaveBeenCalledWith('hello');
  });

  it('shows error message', () => {
    render(<Input error="Required field" placeholder="Name" />);
    expect(screen.getByText('Required field')).toBeTruthy();
  });

  it('renders value', () => {
    render(<Input value="test value" placeholder="Input" />);
    expect(screen.getByDisplayValue('test value')).toBeTruthy();
  });
});
