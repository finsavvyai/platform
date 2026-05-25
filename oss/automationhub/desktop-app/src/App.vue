<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
    <!-- Simple layout for now -->
    <div class="flex h-screen">
      <!-- Sidebar -->
      <aside class="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <!-- Logo Header -->
        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span class="text-white font-bold text-sm">UP</span>
            </div>
            <div>
              <h1 class="text-lg font-bold text-gray-900 dark:text-white">UPM.Plus</h1>
              <p class="text-xs text-gray-500 dark:text-gray-400">v0.1.0</p>
            </div>
          </div>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 p-4 space-y-2">
          <RouterLink
            v-for="item in navigationItems"
            :key="item.name"
            :to="item.path"
            class="nav-item"
            :class="$route.path === item.path ? 'nav-item-active' : 'nav-item-inactive'"
          >
            <span class="mr-3">{{ item.icon }}</span>
            {{ item.name }}
          </RouterLink>
        </nav>

        <!-- Status -->
        <div class="p-4 border-t border-gray-200 dark:border-gray-700">
          <div class="flex items-center space-x-2 text-sm">
            <div class="w-2 h-2 bg-green-500 rounded-full"></div>
            <span class="text-gray-600 dark:text-gray-400">All systems operational</span>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- Top Bar -->
        <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
                {{ currentPageTitle }}
              </h2>
            </div>
            <div class="flex items-center space-x-4">
              <button
                @click="toggleTheme"
                class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <span v-if="isDark">☀️</span>
                <span v-else>🌙</span>
              </button>
            </div>
          </div>
        </header>

        <!-- Page Content -->
        <main class="flex-1 overflow-auto">
          <RouterView />
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const isDark = ref(false)

const navigationItems = ref([
  { name: 'Dashboard', icon: '📊', path: '/' },
  { name: 'Builder', icon: '🔨', path: '/builder' },
  { name: 'Projects', icon: '📁', path: '/projects' },
  { name: 'Deployments', icon: '🚀', path: '/deployments' },
  { name: 'Monitoring', icon: '📈', path: '/monitoring' },
  { name: 'Settings', icon: '⚙️', path: '/settings' },
])

const currentPageTitle = computed(() => {
  const currentItem = navigationItems.value.find(item => item.path === route.path)
  return currentItem ? currentItem.name : 'Dashboard'
})

const toggleTheme = () => {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

onMounted(() => {
  // Check system preference and saved preference
  const savedTheme = localStorage.getItem('theme')
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

  isDark.value = savedTheme === 'dark' || (savedTheme === null && systemPrefersDark)
  document.documentElement.classList.toggle('dark', isDark.value)
})
</script>

<style scoped>
.nav-item {
  @apply flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors;
}

.nav-item-active {
  @apply bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300;
}

.nav-item-inactive {
  @apply text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100;
}
</style>