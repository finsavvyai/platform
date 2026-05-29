import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';
type SidebarState = 'expanded' | 'collapsed';

interface UIState {
    // State
    theme: Theme;
    sidebarState: SidebarState;
    commandPaletteOpen: boolean;

    // Actions
    setTheme: (theme: Theme) => void;
    toggleSidebar: () => void;
    setSidebarState: (state: SidebarState) => void;
    openCommandPalette: () => void;
    closeCommandPalette: () => void;
    toggleCommandPalette: () => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            // Initial state
            theme: 'dark',
            sidebarState: 'expanded',
            commandPaletteOpen: false,

            // Actions
            setTheme: (theme) => set({ theme }),

            toggleSidebar: () =>
                set((state) => ({
                    sidebarState: state.sidebarState === 'expanded' ? 'collapsed' : 'expanded',
                })),

            setSidebarState: (sidebarState) => set({ sidebarState }),

            openCommandPalette: () => set({ commandPaletteOpen: true }),

            closeCommandPalette: () => set({ commandPaletteOpen: false }),

            toggleCommandPalette: () =>
                set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
        }),
        {
            name: 'queryflux-ui',
        }
    )
);
