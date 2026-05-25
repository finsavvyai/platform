import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@/lib/api';

// ========================================
// AUTH STORE
// ========================================

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    setUser: (user: User | null) => void;
    setLoading: (loading: boolean) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            isLoading: true,
            setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
            setLoading: (isLoading) => set({ isLoading }),
            logout: () => {
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('refresh_token');
                }
                set({ user: null, isAuthenticated: false });
            },
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
        }
    )
);

// ========================================
// UI STORE
// ========================================

interface UIState {
    sidebarOpen: boolean;
    theme: 'light' | 'dark' | 'system';
    commandPaletteOpen: boolean;
    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    toggleCommandPalette: () => void;
    setCommandPaletteOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            sidebarOpen: true,
            theme: 'dark',
            commandPaletteOpen: false,
            toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
            setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
            setTheme: (theme) => set({ theme }),
            toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
            setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
        }),
        {
            name: 'ui-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ sidebarOpen: state.sidebarOpen, theme: state.theme }),
        }
    )
);

// ========================================
// AGENTS STORE
// ========================================

interface Agent {
    id: string;
    name: string;
    status: 'active' | 'inactive' | 'running';
    type: string;
}

interface AgentsState {
    agents: Agent[];
    selectedAgentId: string | null;
    isLoading: boolean;
    setAgents: (agents: Agent[]) => void;
    selectAgent: (id: string | null) => void;
    updateAgent: (id: string, updates: Partial<Agent>) => void;
    setLoading: (loading: boolean) => void;
}

export const useAgentsStore = create<AgentsState>()((set) => ({
    agents: [],
    selectedAgentId: null,
    isLoading: false,
    setAgents: (agents) => set({ agents }),
    selectAgent: (selectedAgentId) => set({ selectedAgentId }),
    updateAgent: (id, updates) =>
        set((state) => ({
            agents: state.agents.map((agent) =>
                agent.id === id ? { ...agent, ...updates } : agent
            ),
        })),
    setLoading: (isLoading) => set({ isLoading }),
}));

// ========================================
// NOTIFICATION STORE
// ========================================

interface Notification {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
    duration?: number;
}

interface NotificationState {
    notifications: Notification[];
    addNotification: (notification: Omit<Notification, 'id'>) => void;
    removeNotification: (id: string) => void;
    clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
    notifications: [],
    addNotification: (notification) => {
        const id = Math.random().toString(36).substr(2, 9);
        set((state) => ({
            notifications: [...state.notifications, { ...notification, id }],
        }));

        // Auto remove after duration
        const duration = notification.duration ?? 5000;
        if (duration > 0) {
            setTimeout(() => {
                set((state) => ({
                    notifications: state.notifications.filter((n) => n.id !== id),
                }));
            }, duration);
        }
    },
    removeNotification: (id) =>
        set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
        })),
    clearAll: () => set({ notifications: [] }),
}));
