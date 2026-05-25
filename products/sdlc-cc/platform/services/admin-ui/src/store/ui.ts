import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { UIState, BreadcrumbItem } from './types'

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // State
      theme: {
        mode: 'system',
        colors: {},
      },
      sidebar: {
        isOpen: true,
        isCollapsed: false,
        activeItem: 'dashboard',
      },
      modal: {
        isOpen: false,
        title: '',
        content: null,
        size: 'md',
      },
      notifications: [],
      loading: {},
      breadcrumbs: [],

      // Actions
      setTheme: (themeUpdate) => {
        set(state => ({
          theme: { ...state.theme, ...themeUpdate },
        }))
      },

      toggleSidebar: () => {
        set(state => ({
          sidebar: { ...state.sidebar, isOpen: !state.sidebar.isOpen },
        }))
      },

      setSidebarOpen: (open) => {
        set(state => ({
          sidebar: { ...state.sidebar, isOpen: open },
        }))
      },

      setSidebarCollapsed: (collapsed) => {
        set(state => ({
          sidebar: { ...state.sidebar, isCollapsed: collapsed },
        }))
      },

      setActiveSidebarItem: (item) => {
        set(state => ({
          sidebar: { ...state.sidebar, activeItem: item },
        }))
      },

      openModal: (modalState) => {
        set(state => ({
          modal: { ...state.modal, ...modalState, isOpen: true },
        }))
      },

      closeModal: () => {
        set(state => ({
          modal: { ...state.modal, isOpen: false, content: null },
        }))
      },

      addNotification: (notification) => {
        const id = Math.random().toString(36).substr(2, 9)
        const newNotification = {
          ...notification,
          id,
          timestamp: new Date(),
          read: notification.read ?? false,
        }

        set(state => ({
          notifications: [newNotification, ...state.notifications],
        }))

        // Auto-remove notification after 5 seconds (for success/info notifications)
        if (notification.type === 'SUCCESS' || notification.type === 'INFO') {
          setTimeout(() => {
            get().removeNotification(id)
          }, 5000)
        }
      },

      removeNotification: (id) => {
        set(state => ({
          notifications: state.notifications.filter(n => n.id !== id),
        }))
      },

      markNotificationAsRead: (id) => {
        set(state => ({
          notifications: state.notifications.map(n =>
            n.id === id ? { ...n, read: true } : n
          ),
        }))
      },

      setLoading: (key, loading) => {
        set(state => ({
          loading: { ...state.loading, [key]: loading },
        }))
      },

      setBreadcrumbs: (breadcrumbs) => {
        set({ breadcrumbs })
      },
    }),
    {
      name: 'ui-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        sidebar: state.sidebar,
      }),
    }
  )
)
