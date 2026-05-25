import { useAuthStore, useUIStore, useAgentsStore, useNotificationStore } from './index';
import { act } from '@testing-library/react';

// Reset all zustand stores between tests
beforeEach(() => {
    // Reset auth store
    useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        isLoading: true,
    });

    // Reset UI store
    useUIStore.setState({
        sidebarOpen: true,
        theme: 'dark',
        commandPaletteOpen: false,
    });

    // Reset agents store
    useAgentsStore.setState({
        agents: [],
        selectedAgentId: null,
        isLoading: false,
    });

    // Reset notification store
    useNotificationStore.setState({
        notifications: [],
    });
});

// ============================================================================
// AUTH STORE
// ============================================================================

describe('useAuthStore', () => {
    it('has correct initial state', () => {
        const state = useAuthStore.getState();
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.isLoading).toBe(true);
    });

    describe('setUser', () => {
        it('sets user and marks as authenticated', () => {
            const mockUser = { id: '1', email: 'test@example.com', name: 'Test User', tier: 'free' as const };

            act(() => {
                useAuthStore.getState().setUser(mockUser);
            });

            const state = useAuthStore.getState();
            expect(state.user).toEqual(mockUser);
            expect(state.isAuthenticated).toBe(true);
            expect(state.isLoading).toBe(false);
        });

        it('sets user to null and marks as not authenticated', () => {
            // First set a user
            act(() => {
                useAuthStore.getState().setUser({ id: '1', email: 'a@b.com', name: 'A', tier: 'pro' });
            });

            // Then clear it
            act(() => {
                useAuthStore.getState().setUser(null);
            });

            const state = useAuthStore.getState();
            expect(state.user).toBeNull();
            expect(state.isAuthenticated).toBe(false);
            expect(state.isLoading).toBe(false);
        });
    });

    describe('setLoading', () => {
        it('sets isLoading to true', () => {
            act(() => {
                useAuthStore.getState().setLoading(true);
            });
            expect(useAuthStore.getState().isLoading).toBe(true);
        });

        it('sets isLoading to false', () => {
            act(() => {
                useAuthStore.getState().setLoading(false);
            });
            expect(useAuthStore.getState().isLoading).toBe(false);
        });
    });

    describe('logout', () => {
        it('clears user and auth state', () => {
            // Set up authenticated state
            act(() => {
                useAuthStore.getState().setUser({ id: '1', email: 'a@b.com', name: 'A', tier: 'team' });
            });

            act(() => {
                useAuthStore.getState().logout();
            });

            const state = useAuthStore.getState();
            expect(state.user).toBeNull();
            expect(state.isAuthenticated).toBe(false);
        });

        it('removes auth tokens from localStorage', () => {
            act(() => {
                useAuthStore.getState().logout();
            });

            expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
            expect(localStorage.removeItem).toHaveBeenCalledWith('refresh_token');
        });
    });
});

// ============================================================================
// UI STORE
// ============================================================================

describe('useUIStore', () => {
    it('has correct initial state', () => {
        const state = useUIStore.getState();
        expect(state.sidebarOpen).toBe(true);
        expect(state.theme).toBe('dark');
        expect(state.commandPaletteOpen).toBe(false);
    });

    describe('toggleSidebar', () => {
        it('toggles sidebar from open to closed', () => {
            act(() => {
                useUIStore.getState().toggleSidebar();
            });
            expect(useUIStore.getState().sidebarOpen).toBe(false);
        });

        it('toggles sidebar from closed to open', () => {
            act(() => {
                useUIStore.getState().setSidebarOpen(false);
            });
            act(() => {
                useUIStore.getState().toggleSidebar();
            });
            expect(useUIStore.getState().sidebarOpen).toBe(true);
        });

        it('toggles back and forth correctly', () => {
            act(() => {
                useUIStore.getState().toggleSidebar();
            });
            expect(useUIStore.getState().sidebarOpen).toBe(false);

            act(() => {
                useUIStore.getState().toggleSidebar();
            });
            expect(useUIStore.getState().sidebarOpen).toBe(true);
        });
    });

    describe('setSidebarOpen', () => {
        it('sets sidebar to open', () => {
            act(() => {
                useUIStore.getState().setSidebarOpen(true);
            });
            expect(useUIStore.getState().sidebarOpen).toBe(true);
        });

        it('sets sidebar to closed', () => {
            act(() => {
                useUIStore.getState().setSidebarOpen(false);
            });
            expect(useUIStore.getState().sidebarOpen).toBe(false);
        });
    });

    describe('setTheme', () => {
        it('sets theme to light', () => {
            act(() => {
                useUIStore.getState().setTheme('light');
            });
            expect(useUIStore.getState().theme).toBe('light');
        });

        it('sets theme to dark', () => {
            act(() => {
                useUIStore.getState().setTheme('dark');
            });
            expect(useUIStore.getState().theme).toBe('dark');
        });

        it('sets theme to system', () => {
            act(() => {
                useUIStore.getState().setTheme('system');
            });
            expect(useUIStore.getState().theme).toBe('system');
        });
    });

    describe('toggleCommandPalette', () => {
        it('toggles command palette from closed to open', () => {
            act(() => {
                useUIStore.getState().toggleCommandPalette();
            });
            expect(useUIStore.getState().commandPaletteOpen).toBe(true);
        });

        it('toggles command palette from open to closed', () => {
            act(() => {
                useUIStore.getState().setCommandPaletteOpen(true);
            });
            act(() => {
                useUIStore.getState().toggleCommandPalette();
            });
            expect(useUIStore.getState().commandPaletteOpen).toBe(false);
        });
    });

    describe('setCommandPaletteOpen', () => {
        it('sets command palette open', () => {
            act(() => {
                useUIStore.getState().setCommandPaletteOpen(true);
            });
            expect(useUIStore.getState().commandPaletteOpen).toBe(true);
        });

        it('sets command palette closed', () => {
            act(() => {
                useUIStore.getState().setCommandPaletteOpen(false);
            });
            expect(useUIStore.getState().commandPaletteOpen).toBe(false);
        });
    });
});

// ============================================================================
// AGENTS STORE
// ============================================================================

describe('useAgentsStore', () => {
    const mockAgents = [
        { id: '1', name: 'Agent Alpha', status: 'active' as const, type: 'code-review' },
        { id: '2', name: 'Agent Beta', status: 'inactive' as const, type: 'testing' },
        { id: '3', name: 'Agent Gamma', status: 'running' as const, type: 'deploy' },
    ];

    it('has correct initial state', () => {
        const state = useAgentsStore.getState();
        expect(state.agents).toEqual([]);
        expect(state.selectedAgentId).toBeNull();
        expect(state.isLoading).toBe(false);
    });

    describe('setAgents', () => {
        it('sets the agents array', () => {
            act(() => {
                useAgentsStore.getState().setAgents(mockAgents);
            });
            expect(useAgentsStore.getState().agents).toEqual(mockAgents);
        });

        it('replaces existing agents', () => {
            act(() => {
                useAgentsStore.getState().setAgents(mockAgents);
            });
            const newAgents = [{ id: '4', name: 'Agent Delta', status: 'active' as const, type: 'chat' }];
            act(() => {
                useAgentsStore.getState().setAgents(newAgents);
            });
            expect(useAgentsStore.getState().agents).toEqual(newAgents);
            expect(useAgentsStore.getState().agents).toHaveLength(1);
        });

        it('can set empty array', () => {
            act(() => {
                useAgentsStore.getState().setAgents(mockAgents);
            });
            act(() => {
                useAgentsStore.getState().setAgents([]);
            });
            expect(useAgentsStore.getState().agents).toEqual([]);
        });
    });

    describe('selectAgent', () => {
        it('selects an agent by id', () => {
            act(() => {
                useAgentsStore.getState().selectAgent('2');
            });
            expect(useAgentsStore.getState().selectedAgentId).toBe('2');
        });

        it('deselects agent by setting null', () => {
            act(() => {
                useAgentsStore.getState().selectAgent('1');
            });
            act(() => {
                useAgentsStore.getState().selectAgent(null);
            });
            expect(useAgentsStore.getState().selectedAgentId).toBeNull();
        });

        it('can change selection', () => {
            act(() => {
                useAgentsStore.getState().selectAgent('1');
            });
            act(() => {
                useAgentsStore.getState().selectAgent('3');
            });
            expect(useAgentsStore.getState().selectedAgentId).toBe('3');
        });
    });

    describe('updateAgent', () => {
        beforeEach(() => {
            act(() => {
                useAgentsStore.getState().setAgents(mockAgents);
            });
        });

        it('updates a specific agent by id', () => {
            act(() => {
                useAgentsStore.getState().updateAgent('1', { status: 'running' });
            });
            const agent = useAgentsStore.getState().agents.find((a) => a.id === '1');
            expect(agent?.status).toBe('running');
        });

        it('does not modify other agents', () => {
            act(() => {
                useAgentsStore.getState().updateAgent('1', { name: 'Updated' });
            });
            const agent2 = useAgentsStore.getState().agents.find((a) => a.id === '2');
            expect(agent2?.name).toBe('Agent Beta');
        });

        it('handles update for non-existent id gracefully', () => {
            act(() => {
                useAgentsStore.getState().updateAgent('nonexistent', { name: 'Ghost' });
            });
            // Agents should remain unchanged
            expect(useAgentsStore.getState().agents).toHaveLength(3);
            expect(useAgentsStore.getState().agents).toEqual(mockAgents);
        });

        it('can update multiple properties at once', () => {
            act(() => {
                useAgentsStore.getState().updateAgent('2', { name: 'Renamed', status: 'active', type: 'security' });
            });
            const agent = useAgentsStore.getState().agents.find((a) => a.id === '2');
            expect(agent).toEqual({ id: '2', name: 'Renamed', status: 'active', type: 'security' });
        });
    });

    describe('setLoading', () => {
        it('sets loading to true', () => {
            act(() => {
                useAgentsStore.getState().setLoading(true);
            });
            expect(useAgentsStore.getState().isLoading).toBe(true);
        });

        it('sets loading to false', () => {
            act(() => {
                useAgentsStore.getState().setLoading(true);
            });
            act(() => {
                useAgentsStore.getState().setLoading(false);
            });
            expect(useAgentsStore.getState().isLoading).toBe(false);
        });
    });
});

// ============================================================================
// NOTIFICATION STORE
// ============================================================================

describe('useNotificationStore', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('has correct initial state', () => {
        const state = useNotificationStore.getState();
        expect(state.notifications).toEqual([]);
    });

    describe('addNotification', () => {
        it('adds a notification with auto-generated id', () => {
            act(() => {
                useNotificationStore.getState().addNotification({
                    type: 'success',
                    title: 'Done!',
                    message: 'Operation completed',
                });
            });

            const notifications = useNotificationStore.getState().notifications;
            expect(notifications).toHaveLength(1);
            expect(notifications[0].type).toBe('success');
            expect(notifications[0].title).toBe('Done!');
            expect(notifications[0].message).toBe('Operation completed');
            expect(notifications[0].id).toBeDefined();
        });

        it('adds multiple notifications', () => {
            act(() => {
                useNotificationStore.getState().addNotification({ type: 'info', title: 'Info 1' });
                useNotificationStore.getState().addNotification({ type: 'warning', title: 'Warning 1' });
                useNotificationStore.getState().addNotification({ type: 'error', title: 'Error 1' });
            });

            expect(useNotificationStore.getState().notifications).toHaveLength(3);
        });

        it('generates unique ids for each notification', () => {
            act(() => {
                useNotificationStore.getState().addNotification({ type: 'info', title: 'A' });
                useNotificationStore.getState().addNotification({ type: 'info', title: 'B' });
            });

            const [first, second] = useNotificationStore.getState().notifications;
            expect(first.id).not.toBe(second.id);
        });

        it('auto-removes notification after default duration (5000ms)', () => {
            act(() => {
                useNotificationStore.getState().addNotification({ type: 'info', title: 'Auto-remove' });
            });

            expect(useNotificationStore.getState().notifications).toHaveLength(1);

            act(() => {
                jest.advanceTimersByTime(5000);
            });

            expect(useNotificationStore.getState().notifications).toHaveLength(0);
        });

        it('auto-removes notification after custom duration', () => {
            act(() => {
                useNotificationStore.getState().addNotification({
                    type: 'success',
                    title: 'Quick',
                    duration: 1000,
                });
            });

            act(() => {
                jest.advanceTimersByTime(999);
            });
            expect(useNotificationStore.getState().notifications).toHaveLength(1);

            act(() => {
                jest.advanceTimersByTime(1);
            });
            expect(useNotificationStore.getState().notifications).toHaveLength(0);
        });

        it('does not auto-remove when duration is 0', () => {
            act(() => {
                useNotificationStore.getState().addNotification({
                    type: 'error',
                    title: 'Persistent',
                    duration: 0,
                });
            });

            act(() => {
                jest.advanceTimersByTime(60000);
            });

            expect(useNotificationStore.getState().notifications).toHaveLength(1);
        });

        it('does not auto-remove when duration is negative', () => {
            act(() => {
                useNotificationStore.getState().addNotification({
                    type: 'warning',
                    title: 'Sticky',
                    duration: -1,
                });
            });

            act(() => {
                jest.advanceTimersByTime(60000);
            });

            // duration -1 is not > 0, so no auto-remove
            expect(useNotificationStore.getState().notifications).toHaveLength(1);
        });
    });

    describe('removeNotification', () => {
        it('removes a specific notification by id', () => {
            act(() => {
                useNotificationStore.getState().addNotification({ type: 'info', title: 'A', duration: 0 });
                useNotificationStore.getState().addNotification({ type: 'info', title: 'B', duration: 0 });
            });

            const [first] = useNotificationStore.getState().notifications;

            act(() => {
                useNotificationStore.getState().removeNotification(first.id);
            });

            const remaining = useNotificationStore.getState().notifications;
            expect(remaining).toHaveLength(1);
            expect(remaining[0].title).toBe('B');
        });

        it('handles removing non-existent id gracefully', () => {
            act(() => {
                useNotificationStore.getState().addNotification({ type: 'info', title: 'X', duration: 0 });
            });

            act(() => {
                useNotificationStore.getState().removeNotification('nonexistent-id');
            });

            expect(useNotificationStore.getState().notifications).toHaveLength(1);
        });
    });

    describe('clearAll', () => {
        it('removes all notifications', () => {
            act(() => {
                useNotificationStore.getState().addNotification({ type: 'info', title: 'A', duration: 0 });
                useNotificationStore.getState().addNotification({ type: 'error', title: 'B', duration: 0 });
                useNotificationStore.getState().addNotification({ type: 'warning', title: 'C', duration: 0 });
            });

            expect(useNotificationStore.getState().notifications).toHaveLength(3);

            act(() => {
                useNotificationStore.getState().clearAll();
            });

            expect(useNotificationStore.getState().notifications).toEqual([]);
        });

        it('works when already empty', () => {
            act(() => {
                useNotificationStore.getState().clearAll();
            });

            expect(useNotificationStore.getState().notifications).toEqual([]);
        });
    });
});
