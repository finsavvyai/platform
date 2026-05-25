/**
 * LunaOS Zustand Stores — Unit Tests
 */

import { useAuthStore, useUIStore, useAgentsStore, useNotificationStore } from '../index';
import { act } from '@testing-library/react';

describe('useAuthStore', () => {
    beforeEach(() => {
        // Reset store state
        act(() => {
            useAuthStore.setState({
                user: null,
                isAuthenticated: false,
                isLoading: true,
            });
        });
    });

    test('initial state is unauthenticated and loading', () => {
        const state = useAuthStore.getState();
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.isLoading).toBe(true);
    });

    test('setUser updates user and marks as authenticated', () => {
        act(() => {
            useAuthStore.getState().setUser({
                id: '1',
                email: 'luna@test.ai',
                name: 'Luna',
                tier: 'pro',
            });
        });

        const state = useAuthStore.getState();
        expect(state.user?.name).toBe('Luna');
        expect(state.isAuthenticated).toBe(true);
        expect(state.isLoading).toBe(false);
    });

    test('setUser(null) marks as unauthenticated', () => {
        act(() => {
            useAuthStore.getState().setUser(null);
        });

        const state = useAuthStore.getState();
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
    });

    test('logout clears user and removes localStorage tokens', () => {
        act(() => {
            useAuthStore.getState().setUser({
                id: '1',
                email: 'test@luna.ai',
                name: 'Test',
                tier: 'free',
            });
        });

        act(() => {
            useAuthStore.getState().logout();
        });

        const state = useAuthStore.getState();
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
        expect(localStorage.removeItem).toHaveBeenCalledWith('refresh_token');
    });

    test('setLoading updates loading state', () => {
        act(() => {
            useAuthStore.getState().setLoading(false);
        });

        expect(useAuthStore.getState().isLoading).toBe(false);
    });
});

describe('useUIStore', () => {
    beforeEach(() => {
        act(() => {
            useUIStore.setState({
                sidebarOpen: true,
                theme: 'dark',
                commandPaletteOpen: false,
            });
        });
    });

    test('initial state has sidebar open and dark theme', () => {
        const state = useUIStore.getState();
        expect(state.sidebarOpen).toBe(true);
        expect(state.theme).toBe('dark');
        expect(state.commandPaletteOpen).toBe(false);
    });

    test('toggleSidebar flips sidebar state', () => {
        act(() => {
            useUIStore.getState().toggleSidebar();
        });
        expect(useUIStore.getState().sidebarOpen).toBe(false);

        act(() => {
            useUIStore.getState().toggleSidebar();
        });
        expect(useUIStore.getState().sidebarOpen).toBe(true);
    });

    test('setSidebarOpen sets explicit value', () => {
        act(() => {
            useUIStore.getState().setSidebarOpen(false);
        });
        expect(useUIStore.getState().sidebarOpen).toBe(false);
    });

    test('setTheme changes theme', () => {
        act(() => {
            useUIStore.getState().setTheme('light');
        });
        expect(useUIStore.getState().theme).toBe('light');

        act(() => {
            useUIStore.getState().setTheme('system');
        });
        expect(useUIStore.getState().theme).toBe('system');
    });

    test('toggleCommandPalette flips command palette state', () => {
        act(() => {
            useUIStore.getState().toggleCommandPalette();
        });
        expect(useUIStore.getState().commandPaletteOpen).toBe(true);
    });

    test('setCommandPaletteOpen sets explicit value', () => {
        act(() => {
            useUIStore.getState().setCommandPaletteOpen(true);
        });
        expect(useUIStore.getState().commandPaletteOpen).toBe(true);

        act(() => {
            useUIStore.getState().setCommandPaletteOpen(false);
        });
        expect(useUIStore.getState().commandPaletteOpen).toBe(false);
    });
});

describe('useAgentsStore', () => {
    beforeEach(() => {
        act(() => {
            useAgentsStore.setState({
                agents: [],
                selectedAgentId: null,
                isLoading: false,
            });
        });
    });

    test('initial state has empty agents', () => {
        const state = useAgentsStore.getState();
        expect(state.agents).toEqual([]);
        expect(state.selectedAgentId).toBeNull();
    });

    test('setAgents populates agent list', () => {
        const agents = [
            { id: '1', name: 'Code Review', status: 'active' as const, type: 'review' },
            { id: '2', name: 'Security Scan', status: 'inactive' as const, type: 'security' },
        ];

        act(() => {
            useAgentsStore.getState().setAgents(agents);
        });

        expect(useAgentsStore.getState().agents).toHaveLength(2);
    });

    test('selectAgent sets selected agent ID', () => {
        act(() => {
            useAgentsStore.getState().selectAgent('agent-123');
        });
        expect(useAgentsStore.getState().selectedAgentId).toBe('agent-123');
    });

    test('updateAgent modifies a specific agent', () => {
        act(() => {
            useAgentsStore.getState().setAgents([
                { id: '1', name: 'Agent A', status: 'active', type: 'review' },
                { id: '2', name: 'Agent B', status: 'inactive', type: 'security' },
            ]);
        });

        act(() => {
            useAgentsStore.getState().updateAgent('1', { status: 'running' });
        });

        const agents = useAgentsStore.getState().agents;
        expect(agents[0].status).toBe('running');
        expect(agents[1].status).toBe('inactive'); // Unchanged
    });

    test('setLoading updates loading flag', () => {
        act(() => {
            useAgentsStore.getState().setLoading(true);
        });
        expect(useAgentsStore.getState().isLoading).toBe(true);
    });
});

describe('useNotificationStore', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        act(() => {
            useNotificationStore.getState().clearAll();
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('initial state has no notifications', () => {
        expect(useNotificationStore.getState().notifications).toEqual([]);
    });

    test('addNotification adds a notification with generated ID', () => {
        act(() => {
            useNotificationStore.getState().addNotification({
                type: 'success',
                title: 'Agent executed',
                message: 'Code review completed in 3.2s',
            });
        });

        const notifications = useNotificationStore.getState().notifications;
        expect(notifications).toHaveLength(1);
        expect(notifications[0].type).toBe('success');
        expect(notifications[0].title).toBe('Agent executed');
        expect(notifications[0].id).toBeDefined();
    });

    test('auto-removes notification after duration', () => {
        act(() => {
            useNotificationStore.getState().addNotification({
                type: 'info',
                title: 'Loading...',
                duration: 3000,
            });
        });

        expect(useNotificationStore.getState().notifications).toHaveLength(1);

        act(() => {
            jest.advanceTimersByTime(3000);
        });

        expect(useNotificationStore.getState().notifications).toHaveLength(0);
    });

    test('removeNotification removes by ID', () => {
        act(() => {
            useNotificationStore.getState().addNotification({
                type: 'error',
                title: 'Error',
                duration: 0, // Don't auto-remove
            });
        });

        const id = useNotificationStore.getState().notifications[0].id;

        act(() => {
            useNotificationStore.getState().removeNotification(id);
        });

        expect(useNotificationStore.getState().notifications).toHaveLength(0);
    });

    test('clearAll removes all notifications', () => {
        act(() => {
            useNotificationStore.getState().addNotification({ type: 'info', title: 'A', duration: 0 });
            useNotificationStore.getState().addNotification({ type: 'info', title: 'B', duration: 0 });
            useNotificationStore.getState().addNotification({ type: 'info', title: 'C', duration: 0 });
        });

        expect(useNotificationStore.getState().notifications).toHaveLength(3);

        act(() => {
            useNotificationStore.getState().clearAll();
        });

        expect(useNotificationStore.getState().notifications).toHaveLength(0);
    });
});
