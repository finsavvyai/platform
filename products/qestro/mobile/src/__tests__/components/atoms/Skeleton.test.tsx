import { render } from '@testing-library/react-native';
import { Skeleton } from '../../../components/atoms/Skeleton';

jest.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: { bgTertiary: '#333' },
  }),
}));

describe('Skeleton', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<Skeleton height={40} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with custom width', () => {
    const { toJSON } = render(<Skeleton height={20} width={100} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with custom style', () => {
    const { toJSON } = render(<Skeleton height={30} style={{ marginTop: 10 }} />);
    expect(toJSON()).toBeTruthy();
  });
});
