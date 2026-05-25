import { render, screen, fireEvent } from '@testing-library/react-native';
import { EmptyState } from '../../../components/atoms/EmptyState';

jest.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      textPrimary: '#fff', textSecondary: '#aaa', textMuted: '#666',
      accentPrimary: '#3b82f6',
    },
  }),
}));

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="No data" description="Nothing here yet" />);
    expect(screen.getByText('No data')).toBeTruthy();
    expect(screen.getByText('Nothing here yet')).toBeTruthy();
  });

  it('renders action button when provided', () => {
    const onAction = jest.fn();
    render(<EmptyState title="Empty" description="Add items" actionLabel="Add" onAction={onAction} />);
    const btn = screen.getByText('Add');
    expect(btn).toBeTruthy();
    fireEvent.press(btn);
    expect(onAction).toHaveBeenCalled();
  });

  it('renders without action button when no actionLabel', () => {
    render(<EmptyState title="Empty" description="No items" />);
    expect(screen.queryByText('Add')).toBeNull();
  });
});
