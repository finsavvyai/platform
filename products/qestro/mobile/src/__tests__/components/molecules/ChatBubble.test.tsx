import { render, screen } from '@testing-library/react-native';
import { ChatBubble } from '../../../components/molecules/ChatBubble';

jest.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      accentPrimary: '#3b82f6',
      bgTertiary: '#333',
      textPrimary: '#fff',
      textMuted: '#888',
    },
  }),
}));

describe('ChatBubble', () => {
  it('renders message text', () => {
    render(<ChatBubble message="Hello world" isUser={false} />);
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('renders user bubble with accent color', () => {
    const { toJSON } = render(<ChatBubble message="Hi" isUser={true} />);
    const json = JSON.stringify(toJSON());
    expect(json).toContain('#3b82f6');
  });

  it('renders AI bubble with tertiary color', () => {
    const { toJSON } = render(<ChatBubble message="Hi" isUser={false} />);
    const json = JSON.stringify(toJSON());
    expect(json).toContain('#333');
  });

  it('renders timestamp when provided', () => {
    render(<ChatBubble message="Hi" isUser={false} timestamp="2026-01-15T10:30:00Z" />);
    // toLocaleTimeString with hour/minute format
    const timeRegex = /\d{1,2}:\d{2}/;
    expect(JSON.stringify(screen.toJSON())).toMatch(timeRegex);
  });
});
