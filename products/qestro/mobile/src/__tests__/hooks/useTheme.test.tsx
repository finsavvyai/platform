import { renderHook, act } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '../../hooks/useTheme';

jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>();
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      getString: (key: string) => store.get(key),
      set: (key: string, value: string) => store.set(key, value),
      remove: (key: string) => store.delete(key),
    })),
    createMMKV: jest.fn().mockImplementation(() => ({
      getString: (key: string) => store.get(key),
      set: (key: string, value: string) => store.set(key, value),
      remove: (key: string) => store.delete(key),
    })),
  };
});

// Mock only useColorScheme to avoid loading full react-native (DevMenu native module fails in Jest)
jest.mock('react-native', () => {
  const useColorScheme = jest.fn(() => 'dark' as const);
  return {
    useColorScheme,
    View: 'View',
    Text: 'Text',
    StyleSheet: { create: (s: object) => s },
    Platform: { OS: 'ios' },
  };
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('useTheme', () => {
  it('throws when used outside ThemeProvider', () => {
    expect(() => renderHook(() => useTheme())).toThrow('useTheme must be used within ThemeProvider');
  });

  it('returns dark theme by default when system is dark', () => {
    const rn = jest.requireMock('react-native');
    (rn.useColorScheme as jest.Mock).mockReturnValue('dark');
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.isDark).toBe(true);
    expect(result.current.theme).toBe('dark');
    expect(result.current.colors).toBeDefined();
  });

  it('toggleTheme switches from dark to light', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => { result.current.toggleTheme(); });
    expect(result.current.isDark).toBe(false);
    expect(result.current.theme).toBe('light');
  });

  it('setTheme sets a specific theme', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => { result.current.setTheme('light'); });
    expect(result.current.theme).toBe('light');
    act(() => { result.current.setTheme('dark'); });
    expect(result.current.theme).toBe('dark');
  });

  it('returns colors object with expected keys', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.colors.bgPrimary).toBeDefined();
    expect(result.current.colors.textPrimary).toBeDefined();
    expect(result.current.colors.accentPrimary).toBeDefined();
  });
});
