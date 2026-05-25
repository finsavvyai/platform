<template>
  <div class="flex h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Sidebar -->
    <Transition name="sidebar">
      <aside
        v-if="!sidebarCollapsed"
        class="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col"
      >
        <!-- Logo Header -->
        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span class="text-white font-bold text-sm">UP</span>
            </div>
            <div>
              <h1 class="text-lg font-bold text-gray-900 dark:text-white">UPM.Plus</h1>
              <p class="text-xs text-gray-500 dark:text-gray-400">v{{ appVersion }}</p>
            </div>
          </div>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 p-4 space-y-2">
          <NavigationItem
            v-for="item in navigationItems"
            :key="item.id"
            :item="item"
            :active="activeView === item.id"
            @click="setActiveView(item.id)"
          />
        </nav>

        <!-- Quick Stats -->
        <div class="p-4 border-t border-gray-200 dark:border-gray-700">
          <div class="space-y-3">
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-600 dark:text-gray-400">Active Projects</span>
              <span class="font-medium text-gray-900 dark:text-white">{{ runningProjects.length }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-600 dark:text-gray-400">System Health</span>
              <div class="flex items-center space-x-2">
                <div
                  class="w-2 h-2 rounded-full"
                  :class="systemHealthColor"
                ></div>
                <span class="font-medium text-gray-900 dark:text-white">{{ systemHealth }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- User Profile -->
        <div class="p-4 border-t border-gray-200 dark:border-gray-700">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <UserIcon class="w-5 h-5 text-white" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                {{ currentUser?.name || 'Guest User' }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                {{ isOnline ? 'Online' : 'Offline' }}
              </p>
            </div>
            <button
              @click="toggleTheme"
              class="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <SunIcon v-if="isDarkMode" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <MoonIcon v-else class="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
      </aside>
    </Transition>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Top Bar -->
      <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <button
              @click="toggleSidebar"
              class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Bars3Icon class="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>

            <!-- Breadcrumb -->
            <nav class="flex" aria-label="Breadcrumb">
              <ol class="flex items-center space-x-2">
                <li v-for="(crumb, index) in breadcrumbs" :key="index" class="flex items-center">
                  <ChevronRightIcon v-if="index > 0" class="w-4 h-4 text-gray-400 mx-2" />
                  <span
                    class="text-sm font-medium"
                    :class="index === breadcrumbs.length - 1
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-500 dark:text-gray-400'"
                  >
                    {{ crumb }}
                  </span>
                </li>
              </ol>
            </nav>
          </div>

          <div class="flex items-center space-x-4">
            <!-- Global Search -->
            <div class="relative">
              <MagnifyingGlassIcon class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search projects, deployments..."
                class="pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                @keydown.meta.k.prevent="focusSearch"
              />
              <kbd class="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">⌘K</kbd>
            </div>

            <!-- Notifications -->
            <button
              @click="showNotifications = !showNotifications"
              class="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <BellIcon class="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span
                v-if="unreadNotifications > 0"
                class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center"
              >
                {{ unreadNotifications }}
              </span>
            </button>

            <!-- Connection Status -->
            <div class="flex items-center space-x-2">
              <div
                class="w-2 h-2 rounded-full"
                :class="isOnline ? 'bg-green-500' : 'bg-red-500'"
              ></div>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {{ isOnline ? 'Connected' : 'Offline' }}
              </span>
            </div>
          </div>
        </div>
      </header>

      <!-- Page Content -->
      <main class="flex-1 overflow-auto">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <!-- Notifications Panel -->
    <NotificationsPanel v-model:show="showNotifications" />

    <!-- Command Palette -->
    <CommandPalette v-model:show="showCommandPalette" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  Bars3Icon,
  UserIcon,
  BellIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
  SunIcon,
  MoonIcon
} from '@heroicons/vue/24/outline'

// Stores
import { useAppStore } from '../../stores/app'
import { useNotificationStore } from '../../stores/notifications'

// Components
import NavigationItem from './NavigationItem.vue'
import NotificationsPanel from '../NotificationsPanel.vue'
import CommandPalette from '../CommandPalette.vue'

const route = useRoute()
const appStore = useAppStore()
const notificationStore = useNotificationStore()

// Local state
const searchQuery = ref('')
const showNotifications = ref(false)
const showCommandPalette = ref(false)

// Computed properties
const sidebarCollapsed = computed(() => appStore.sidebarCollapsed)
const activeView = computed(() => appStore.activeView)
const appVersion = computed(() => appStore.appVersion)
const runningProjects = computed(() => appStore.runningProjects)
const systemHealth = computed(() => appStore.systemHealth)
const currentUser = computed(() => appStore.currentUser)
const isOnline = computed(() => appStore.isOnline)
const theme = computed(() => appStore.theme)
const unreadNotifications = computed(() => notificationStore.unreadCount)

const isDarkMode = computed(() => {
  if (theme.value === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return theme.value === 'dark'
})

const systemHealthColor = computed(() => {
  if (systemHealth.value >= 90) return 'bg-green-500'
  if (systemHealth.value >= 70) return 'bg-yellow-500'
  return 'bg-red-500'
})

const breadcrumbs = computed(() => {
  const segments = route.path.split('/').filter(Boolean)
  if (segments.length === 0) return ['Dashboard']

  return ['Dashboard', ...segments.map(segment =>
    segment.charAt(0).toUpperCase() + segment.slice(1)
  )]
})

const navigationItems = ref([
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: '📊',
    path: '/',
    shortcut: '⌘1'
  },
  {
    id: 'projects',
    name: 'Projects',
    icon: '📁',
    path: '/projects',
    shortcut: '⌘2'
  },
  {
    id: 'deployments',
    name: 'Deployments',
    icon: '🚀',
    path: '/deployments',
    shortcut: '⌘3'
  },
  {
    id: 'monitoring',
    name: 'Monitoring',
    icon: '📈',
    path: '/monitoring',
    shortcut: '⌘4'
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: '⚙️',
    path: '/settings',
    shortcut: '⌘5'
  }
])

// Actions
const toggleSidebar = () => {
  appStore.toggleSidebar()
}

const setActiveView = (view: string) => {
  appStore.setActiveView(view)
}

const toggleTheme = () => {
  const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
  const currentIndex = themes.indexOf(theme.value)
  const nextTheme = themes[(currentIndex + 1) % themes.length]
  appStore.setTheme(nextTheme)
}

const focusSearch = () => {
  showCommandPalette.value = true
}

// Keyboard shortcuts
const handleKeydown = (event: KeyboardEvent) => {
  // Command palette
  if (event.metaKey && event.key === 'k') {
    event.preventDefault()
    showCommandPalette.value = true
  }

  // Navigation shortcuts
  if (event.metaKey && ['1', '2', '3', '4', '5'].includes(event.key)) {
    event.preventDefault()
    const index = parseInt(event.key) - 1
    if (navigationItems.value[index]) {
      setActiveView(navigationItems.value[index].id)
    }
  }

  // Toggle sidebar
  if (event.metaKey && event.key === 'b') {
    event.preventDefault()
    toggleSidebar()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
/* Sidebar transition */
.sidebar-enter-active,
.sidebar-leave-active {
  transition: all 0.3s ease;
}

.sidebar-enter-from,
.sidebar-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

/* Page transition */
.page-enter-active,
.page-leave-active {
  transition: all 0.2s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.page-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>