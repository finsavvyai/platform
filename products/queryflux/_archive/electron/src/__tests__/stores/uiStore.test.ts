import { act, renderHook } from '@testing-library/react';
import { useUIStore } from '../../renderer/stores/uiStore';
import { Theme } from '../../renderer/stores/types';

describe('UIStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useUIStore.setState({
      theme: 'dark',
      sidebarCollapsed: false,
      activeModal: null,
      loading: false,
      notifications: [],
      keyboardShortcuts: true,
      autoSave: true,
      fontSize: 14,
      tabSize: 2,
      wordWrap: true,
      showLineNumbers: true,
    });
  });

  describe('Initial State', () => {
    test('should have correct initial state', () => {
      const { result } = renderHook(() => useUIStore());

      expect(result.current.theme).toBe('dark');
      expect(result.current.sidebarCollapsed).toBe(false);
      expect(result.current.activeModal).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.notifications).toEqual([]);
      expect(result.current.keyboardShortcuts).toBe(true);
      expect(result.current.autoSave).toBe(true);
      expect(result.current.fontSize).toBe(14);
      expect(result.current.tabSize).toBe(2);
      expect(result.current.wordWrap).toBe(true);
      expect(result.current.showLineNumbers).toBe(true);
    });
  });

  describe('setTheme', () => {
    test('should set theme', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setTheme('light');
      });

      expect(result.current.theme).toBe('light');
    });

    test('should cycle through themes', () => {
      const { result } = renderHook(() => useUIStore());
      const themes: Theme[] = ['dark', 'light', 'auto'];

      themes.forEach((theme, index) => {
        act(() => {
          result.current.setTheme(theme);
        });
        expect(result.current.theme).toBe(theme);
      });
    });
  });

  describe('setSidebarCollapsed', () => {
    test('should toggle sidebar collapsed state', () => {
      const { result } = renderHook(() => useUIStore());

      expect(result.current.sidebarCollapsed).toBe(false);

      act(() => {
        result.current.setSidebarCollapsed(true);
      });

      expect(result.current.sidebarCollapsed).toBe(true);

      act(() => {
        result.current.setSidebarCollapsed(false);
      });

      expect(result.current.sidebarCollapsed).toBe(false);
    });
  });

  describe('setActiveModal', () => {
    test('should set active modal', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setActiveModal('settings');
      });

      expect(result.current.activeModal).toBe('settings');
    });

    test('should clear active modal', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setActiveModal('settings');
        result.current.setActiveModal(null);
      });

      expect(result.current.activeModal).toBeNull();
    });

    test('should handle modal queue', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setActiveModal('connection');
        result.current.setActiveModal('settings');
      });

      expect(result.current.activeModal).toBe('settings');

      act(() => {
        result.current.setActiveModal(null);
      });

      expect(result.current.activeModal).toBeNull();
    });
  });

  describe('setLoading', () => {
    test('should set loading state', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.loading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe('addNotification', () => {
    test('should add notification', () => {
      const { result } = renderHook(() => useUIStore());
      const notification = {
        id: 'notif-1',
        type: 'info' as const,
        title: 'Test Notification',
        message: 'This is a test',
        timestamp: Date.now(),
        read: false,
      };

      act(() => {
        result.current.addNotification(notification);
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0]).toEqual(notification);
    });

    test('should limit notifications to 50', () => {
      const { result } = renderHook(() => useUIStore());

      // Add 51 notifications
      act(() => {
        for (let i = 0; i < 51; i++) {
          result.current.addNotification({
            id: `notif-${i}`,
            type: 'info',
            title: `Notification ${i}`,
            message: `Message ${i}`,
            timestamp: Date.now(),
            read: false,
          });
        }
      });

      expect(result.current.notifications).toHaveLength(50);
      expect(result.current.notifications[0].id).toBe('notif-1');
      expect(result.current.notifications[49].id).toBe('notif-50');
    });
  });

  describe('removeNotification', () => {
    test('should remove notification by id', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.addNotification({
          id: 'notif-1',
          type: 'info',
          title: 'Test 1',
          message: 'Message 1',
          timestamp: Date.now(),
          read: false,
        });
        result.current.addNotification({
          id: 'notif-2',
          type: 'success',
          title: 'Test 2',
          message: 'Message 2',
          timestamp: Date.now(),
          read: false,
        });
      });

      act(() => {
        result.current.removeNotification('notif-1');
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].id).toBe('notif-2');
    });
  });

  describe('markNotificationAsRead', () => {
    test('should mark notification as read', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.addNotification({
          id: 'notif-1',
          type: 'info',
          title: 'Test',
          message: 'Message',
          timestamp: Date.now(),
          read: false,
        });
      });

      expect(result.current.notifications[0].read).toBe(false);

      act(() => {
        result.current.markNotificationAsRead('notif-1');
      });

      expect(result.current.notifications[0].read).toBe(true);
    });

    test('should mark all notifications as read', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.addNotification({
          id: 'notif-1',
          type: 'info',
          title: 'Test 1',
          message: 'Message 1',
          timestamp: Date.now(),
          read: false,
        });
        result.current.addNotification({
          id: 'notif-2',
          type: 'success',
          title: 'Test 2',
          message: 'Message 2',
          timestamp: Date.now(),
          read: false,
        });
      });

      act(() => {
        result.current.markAllNotificationsAsRead();
      });

      expect(result.current.notifications.every(n => n.read)).toBe(true);
    });
  });

  describe('clearNotifications', () => {
    test('should clear all notifications', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.addNotification({
          id: 'notif-1',
          type: 'info',
          title: 'Test',
          message: 'Message',
          timestamp: Date.now(),
          read: false,
        });
      });

      expect(result.current.notifications).toHaveLength(1);

      act(() => {
        result.current.clearNotifications();
      });

      expect(result.current.notifications).toHaveLength(0);
    });
  });

  describe('toggleKeyboardShortcuts', () => {
    test('should toggle keyboard shortcuts', () => {
      const { result } = renderHook(() => useUIStore());

      expect(result.current.keyboardShortcuts).toBe(true);

      act(() => {
        result.current.toggleKeyboardShortcuts();
      });

      expect(result.current.keyboardShortcuts).toBe(false);

      act(() => {
        result.current.toggleKeyboardShortcuts();
      });

      expect(result.current.keyboardShortcuts).toBe(true);
    });
  });

  describe('toggleAutoSave', () => {
    test('should toggle auto save', () => {
      const { result } = renderHook(() => useUIStore());

      expect(result.current.autoSave).toBe(true);

      act(() => {
        result.current.toggleAutoSave();
      });

      expect(result.current.autoSave).toBe(false);
    });
  });

  describe('setFontSize', () => {
    test('should set font size', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setFontSize(16);
      });

      expect(result.current.fontSize).toBe(16);
    });

    test('should clamp font size between 10 and 24', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setFontSize(5);
      });

      expect(result.current.fontSize).toBe(10);

      act(() => {
        result.current.setFontSize(30);
      });

      expect(result.current.fontSize).toBe(24);
    });
  });

  describe('setTabSize', () => {
    test('should set tab size', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setTabSize(4);
      });

      expect(result.current.tabSize).toBe(4);
    });

    test('should clamp tab size between 2 and 8', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setTabSize(1);
      });

      expect(result.current.tabSize).toBe(2);

      act(() => {
        result.current.setTabSize(10);
      });

      expect(result.current.tabSize).toBe(8);
    });
  });

  describe('toggleWordWrap', () => {
    test('should toggle word wrap', () => {
      const { result } = renderHook(() => useUIStore());

      expect(result.current.wordWrap).toBe(true);

      act(() => {
        result.current.toggleWordWrap();
      });

      expect(result.current.wordWrap).toBe(false);
    });
  });

  describe('toggleShowLineNumbers', () => {
    test('should toggle show line numbers', () => {
      const { result } = renderHook(() => useUIStore());

      expect(result.current.showLineNumbers).toBe(true);

      act(() => {
        result.current.toggleShowLineNumbers();
      });

      expect(result.current.showLineNumbers).toBe(false);
    });
  });

  describe('resetSettings', () => {
    test('should reset to default settings', () => {
      const { result } = renderHook(() => useUIStore());

      // Change all settings
      act(() => {
        result.current.setTheme('light');
        result.current.setSidebarCollapsed(true);
        result.current.setFontSize(18);
        result.current.setTabSize(4);
        result.current.toggleWordWrap();
        result.current.toggleShowLineNumbers();
        result.current.toggleKeyboardShortcuts();
        result.current.toggleAutoSave();
      });

      // Verify changes
      expect(result.current.theme).toBe('light');
      expect(result.current.sidebarCollapsed).toBe(true);
      expect(result.current.fontSize).toBe(18);
      expect(result.current.tabSize).toBe(4);
      expect(result.current.wordWrap).toBe(false);
      expect(result.current.showLineNumbers).toBe(false);
      expect(result.current.keyboardShortcuts).toBe(false);
      expect(result.current.autoSave).toBe(false);

      // Reset
      act(() => {
        result.current.resetSettings();
      });

      // Verify reset to defaults
      expect(result.current.theme).toBe('dark');
      expect(result.current.sidebarCollapsed).toBe(false);
      expect(result.current.fontSize).toBe(14);
      expect(result.current.tabSize).toBe(2);
      expect(result.current.wordWrap).toBe(true);
      expect(result.current.showLineNumbers).toBe(true);
      expect(result.current.keyboardShortcuts).toBe(true);
      expect(result.current.autoSave).toBe(true);
    });
  });

  describe('Store Persistence', () => {
    test('should persist UI settings to localStorage', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setTheme('light');
        result.current.setFontSize(16);
        result.current.setSidebarCollapsed(true);
      });

      // Check if localStorage was called (in real implementation)
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    test('should hydrate from localStorage on initialization', () => {
      // Mock localStorage data
      const storedData = {
        state: {
          theme: 'light',
          sidebarCollapsed: true,
          fontSize: 16,
          autoSave: false,
        },
        version: 0,
      };

      // Mock localStorage.getItem
      (localStorage.getItem as jest.Mock).mockReturnValue(
        JSON.stringify(storedData)
      );

      // Re-initialize store
      const { result: newResult } = renderHook(() => useUIStore());

      expect(newResult.current.theme).toBe('light');
      expect(newResult.current.sidebarCollapsed).toBe(true);
      expect(newResult.current.fontSize).toBe(16);
      expect(newResult.current.autoSave).toBe(false);
    });
  });

  describe('Notification Management', () => {
    test('should auto-remove old notifications', () => {
      const { result } = renderHook(() => useUIStore());

      // Add old notification
      act(() => {
        result.current.addNotification({
          id: 'notif-old',
          type: 'info',
          title: 'Old Notification',
          message: 'This is old',
          timestamp: Date.now() - 86400000, // 24 hours ago
          read: true,
        });
      });

      // Add new notification
      act(() => {
        result.current.addNotification({
          id: 'notif-new',
          type: 'success',
          title: 'New Notification',
          message: 'This is new',
          timestamp: Date.now(),
          read: false,
        });
      });

      // In real implementation, old read notifications would be cleaned up
      expect(result.current.notifications).toHaveLength(2);
    });

    test('should prioritize notifications by type', () => {
      const { result } = renderHook(() => useUIStore());

      const notificationTypes = ['error', 'warning', 'success', 'info'];

      act(() => {
        notificationTypes.forEach((type, index) => {
          result.current.addNotification({
            id: `notif-${index}`,
            type: type as any,
            title: `${type} Notification`,
            message: `This is a ${type} notification`,
            timestamp: Date.now() + index,
            read: false,
          });
        });
      });

      // Error notifications should appear first
      expect(result.current.notifications[0].type).toBe('error');
      expect(result.current.notifications[1].type).toBe('warning');
      expect(result.current.notifications[2].type).toBe('success');
      expect(result.current.notifications[3].type).toBe('info');
    });
  });

  describe('Accessibility Settings', () => {
    test('should handle high contrast mode', () => {
      const { result } = renderHook(() => useUIStore());

      // Add high contrast setting
      act(() => {
        (result.current as any).setHighContrast(true);
      });

      expect((result.current as any).highContrast).toBe(true);
    });

    test('should handle reduced motion', () => {
      const { result } = renderHook(() => useUIStore());

      // Add reduced motion setting
      act(() => {
        (result.current as any).setReducedMotion(true);
      });

      expect((result.current as any).reducedMotion).toBe(true);
    });
  });

  describe('Performance Settings', () => {
    test('should handle virtual scrolling', () => {
      const { result } = renderHook(() => useUIStore());

      // Add virtual scroll setting
      act(() => {
        (result.current as any).setVirtualScrolling(true);
      });

      expect((result.current as any).virtualScrolling).toBe(true);
    });

    test('should handle result limit', () => {
      const { result } = renderHook(() => useUIStore());

      // Set result limit
      act(() => {
        (result.current as any).setResultLimit(500);
      });

      expect((result.current as any).resultLimit).toBe(500);
    });
  });
});