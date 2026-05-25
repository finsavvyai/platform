import { render, screen } from '@testing-library/react-native';
import { ConfidenceMeter } from '../../../components/molecules/ConfidenceMeter';

jest.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      textMuted: '#888',
      bgTertiary: '#333',
      accentSuccess: '#22c55e',
      accentWarning: '#f59e0b',
      accentError: '#ef4444',
    },
  }),
}));

describe('ConfidenceMeter', () => {
  it('renders value percentage', () => {
    render(<ConfidenceMeter value={85} />);
    expect(screen.getByText('85%')).toBeTruthy();
  });

  it('clamps value to 0-100', () => {
    render(<ConfidenceMeter value={150} />);
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('renders label when provided', () => {
    render(<ConfidenceMeter value={50} label="confidence" />);
    expect(screen.getByText('confidence')).toBeTruthy();
  });

  it('uses success color for values >= 80', () => {
    const { toJSON } = render(<ConfidenceMeter value={90} />);
    const json = JSON.stringify(toJSON());
    expect(json).toContain('#22c55e');
  });

  it('uses warning color for values 50-79', () => {
    const { toJSON } = render(<ConfidenceMeter value={60} />);
    const json = JSON.stringify(toJSON());
    expect(json).toContain('#f59e0b');
  });

  it('uses error color for values < 50', () => {
    const { toJSON } = render(<ConfidenceMeter value={20} />);
    const json = JSON.stringify(toJSON());
    expect(json).toContain('#ef4444');
  });
});
