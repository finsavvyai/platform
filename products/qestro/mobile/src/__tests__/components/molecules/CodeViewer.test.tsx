import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { CodeViewer } from '../../../components/molecules/CodeViewer';

jest.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: { borderColor: '#333' },
  }),
}));

describe('CodeViewer', () => {
  const code = 'const x = 1;\nconsole.log(x);';

  it('renders code content', () => {
    render(<CodeViewer code={code} />);
    expect(screen.getByText(code)).toBeTruthy();
  });

  it('renders language label when provided', () => {
    render(<CodeViewer code={code} language="typescript" />);
    expect(screen.getByText('typescript')).toBeTruthy();
  });

  it('renders copy button', () => {
    render(<CodeViewer code={code} />);
    expect(screen.getByLabelText('Copy code')).toBeTruthy();
  });

  it('shows Copied text after pressing copy', async () => {
    render(<CodeViewer code={code} />);
    fireEvent.press(screen.getByLabelText('Copy code'));
    await waitFor(() => {
      expect(screen.getByText('Copied')).toBeTruthy();
    });
  });
});
