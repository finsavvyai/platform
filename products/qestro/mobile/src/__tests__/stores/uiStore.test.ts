import { useUIStore } from '../../stores/uiStore';

jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>();
  const instance = {
    getString: (key: string) => store.get(key),
    set: (key: string, value: string) => store.set(key, value),
    delete: (key: string) => store.delete(key),
    remove: (key: string) => store.delete(key),
  };
  return {
    MMKV: jest.fn().mockImplementation(() => instance),
    createMMKV: jest.fn().mockImplementation(() => instance),
  };
});

beforeEach(() => {
  useUIStore.setState({
    themeName: null,
    isOffline: false,
  });
});

describe('uiStore', () => {
  it('should have initial state', () => {
    const state = useUIStore.getState();
    expect(state.themeName).toBeNull();
    expect(state.isOffline).toBe(false);
  });

  it('should set theme name', () => {
    useUIStore.getState().setThemeName('dark');
    expect(useUIStore.getState().themeName).toBe('dark');

    useUIStore.getState().setThemeName('light');
    expect(useUIStore.getState().themeName).toBe('light');
  });

  it('should set offline status', () => {
    useUIStore.getState().setIsOffline(true);
    expect(useUIStore.getState().isOffline).toBe(true);

    useUIStore.getState().setIsOffline(false);
    expect(useUIStore.getState().isOffline).toBe(false);
  });
});
