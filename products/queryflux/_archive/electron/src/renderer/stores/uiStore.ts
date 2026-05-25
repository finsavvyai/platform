import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UISlice, UserPreferences } from './types';

const defaultPreferences: UserPreferences = {
  autoSave: true,
  autoSaveInterval: 30000, // 30 seconds
  queryTimeout: 30000, // 30 seconds
  maxConnections: 10,
  enableNotifications: true,
  enableAnalytics: false,
  language: 'en',
  fontSize: 'medium',
  keyboardShortcuts: {
    'Ctrl+Enter': 'executeQuery',
    'Ctrl+S': 'saveQuery',
    'Ctrl+N': 'newQuery',
    'Ctrl+O': 'openQuery',
    'Ctrl+Shift+C': 'newConnection',
    'F5': 'refreshSchema',
    'Ctrl+/': 'toggleComment',
    'Ctrl+Shift+F': 'formatQuery',
    'Ctrl+K': 'commandPalette',
    'Ctrl+,': 'openSettings',
  }
};

export const useUIStore = create<UISlice>()(
  persist(
    (set, get) => ({
      // Initial state
      isLoading: false,
      sidebarCollapsed: false,
      activeModal: null,
      theme: 'dark',
      preferences: defaultPreferences,

      // Actions
      setLoading: (loading: boolean) => set({ isLoading: loading }),

      setSidebarCollapsed: (collapsed: boolean) => set({ sidebarCollapsed: collapsed }),

      setActiveModal: (modal: string | null) => set({ activeModal: modal }),

      setTheme: (theme: 'dark' | 'light' | 'auto') => {
        set({ theme });
        // Apply theme to document
        document.documentElement.setAttribute('data-theme', theme);
      },

      updatePreferences: (updates: Partial<UserPreferences>) =>
        set((state) => ({
          preferences: { ...state.preferences, ...updates }
        })),

      resetPreferences: () => set({ preferences: defaultPreferences }),
    }),
    {
      name: 'queryflux-ui-store',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        preferences: state.preferences,
      }),
    }
  )
);

// Initialize theme from persisted state
const persistedTheme = useUIStore.getState().theme;
document.documentElement.setAttribute('data-theme', persistedTheme);

export default useUIStore;