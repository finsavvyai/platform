import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Card } from '../../../components/atoms/Card';

jest.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({
    isDark: true,
    colors: {
      bgSecondary: '#1a1a1a', borderColor: '#333', cardBg: '#111',
      glassBg: '#fff1', glassBorder: '#fff2',
    },
  }),
}));

describe('Card', () => {
  it('renders children', () => {
    render(<Card><Text>Card content</Text></Card>);
    expect(screen.getByText('Card content')).toBeTruthy();
  });

  it('renders with glass variant', () => {
    render(<Card variant="glass"><Text>Glass</Text></Card>);
    expect(screen.getByText('Glass')).toBeTruthy();
  });

  it('renders with different padding sizes', () => {
    const { rerender } = render(<Card padding="sm"><Text>Small</Text></Card>);
    expect(screen.getByText('Small')).toBeTruthy();
    rerender(<Card padding="lg"><Text>Large</Text></Card>);
    expect(screen.getByText('Large')).toBeTruthy();
  });
});
