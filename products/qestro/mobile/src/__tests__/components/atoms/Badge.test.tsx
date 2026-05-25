import { render, screen } from '@testing-library/react-native';
import { Badge } from '../../../components/atoms/Badge';

jest.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      accentPrimary: '#3b82f6', bgTertiary: '#333', borderColor: '#444',
      textPrimary: '#fff', textSecondary: '#aaa',
      accentSuccess: '#22c55e', accentWarning: '#f59e0b', accentError: '#ef4444',
      glassBg: '#fff1', glassBorder: '#fff2',
    },
  }),
}));

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('renders with all variants', () => {
    const variants = ['primary', 'secondary', 'success', 'warning', 'error', 'outline', 'glass'] as const;
    variants.forEach((v) => {
      const { unmount } = render(<Badge variant={v}>{v}</Badge>);
      expect(screen.getByText(v)).toBeTruthy();
      unmount();
    });
  });

  it('renders with all sizes', () => {
    const sizes = ['xs', 'sm', 'md'] as const;
    sizes.forEach((s) => {
      const { unmount } = render(<Badge size={s}>{s}</Badge>);
      expect(screen.getByText(s)).toBeTruthy();
      unmount();
    });
  });
});
