import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { SettingsState } from './types'

const defaultSettings: Omit<SettingsState, 'updateUserSettings' | 'updateNotificationSettings' | 'updatePrivacySettings' | 'updatePreferences' | 'resetSettings' | 'loadSettings' | 'saveSettings'> = {
  user: {
    theme: 'system',
    language: 'en-US',
    timezone: 'UTC',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm',
  },
  notifications: {
    email: true,
    push: true,
    inApp: true,
    types: {
      INFO: true,
      SUCCESS: true,
      WARNING: true,
      ERROR: true,
    },
  },
  privacy: {
    profileVisibility: 'team',
    showEmail: false,
    showLastLogin: false,
  },
  preferences: {
    autoSave: true,
    compactMode: false,
    showKeyboardShortcuts: true,
    defaultPageSize: 20,
  },
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...defaultSettings,

      // Actions
      updateUserSettings: (settings) => {
        set(state => ({
          user: { ...state.user, ...settings },
        }))
      },

      updateNotificationSettings: (settings) => {
        set(state => ({
          notifications: { ...state.notifications, ...settings },
        }))
      },

      updatePrivacySettings: (settings) => {
        set(state => ({
          privacy: { ...state.privacy, ...settings },
        }))
      },

      updatePreferences: (preferences) => {
        set(state => ({
          preferences: { ...state.preferences, ...preferences },
        }))
      },

      resetSettings: () => {
        set(defaultSettings)
      },

      loadSettings: async () => {
        try {
          const response = await fetch('/api/user/settings')
          if (response.ok) {
            const settings = await response.json()
            set(settings)
          }
        } catch (error) {
          console.error('Failed to load settings:', error)
        }
      },

      saveSettings: async () => {
        try {
          const settings = get()
          const response = await fetch('/api/user/settings', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(settings),
          })

          if (!response.ok) {
            throw new Error('Failed to save settings')
          }
        } catch (error) {
          console.error('Failed to save settings:', error)
          throw error
        }
      },
    }),
    {
      name: 'settings-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
