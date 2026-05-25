import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface UIState {
    sidebarOpen: boolean;
    theme: Theme;
    commandPaletteOpen: boolean;

    toggleSidebar: () => void;
    setSidebarOpen: (isOpen: boolean) => void;
    setTheme: (theme: Theme) => void;
    setCommandPaletteOpen: (isOpen: boolean) => void;
    toggleCommandPalette: () => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            sidebarOpen: true,
            theme: 'dark', // Default to Qestro's dark aesthetic
            commandPaletteOpen: false,

            toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
            setSidebarOpen: (isOpen) => set({ sidebarOpen: isOpen }),

            setTheme: (theme) => set({ theme }),

            setCommandPaletteOpen: (isOpen) => set({ commandPaletteOpen: isOpen }),
            toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
        }),
        {
            name: 'qestro-ui-settings',
            partialize: (state) => ({
                sidebarOpen: state.sidebarOpen,
                theme: state.theme
            })
        }
    )
);
