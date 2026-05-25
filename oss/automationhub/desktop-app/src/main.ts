import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'

// Import views
import Dashboard from './views/Dashboard.vue'

// Create router
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Dashboard',
      component: Dashboard,
      meta: {
        title: 'Dashboard',
        transition: 'slide'
      }
    },
    // Placeholder routes for future implementation
    {
      path: '/projects',
      name: 'Projects',
      component: () => import('./views/Projects.vue'),
      meta: {
        title: 'Projects',
        transition: 'slide'
      }
    },
    {
      path: '/builder',
      name: 'Builder',
      component: () => import('./views/Builder.vue'),
      meta: {
        title: 'Builder',
        transition: 'slide'
      }
    },
    {
      path: '/monitoring',
      name: 'Monitoring',
      component: () => import('./views/Monitoring.vue'),
      meta: {
        title: 'Monitoring',
        transition: 'slide'
      }
    },
    {
      path: '/deployments',
      name: 'Deployments',
      component: () => import('./views/Deployments.vue'),
      meta: {
        title: 'Deployments',
        transition: 'slide'
      }
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('./views/Settings.vue'),
      meta: {
        title: 'Settings',
        transition: 'slide'
      }
    }
  ]
})

// Create Pinia store
const pinia = createPinia()

// Create Vue app
const app = createApp(App)

// Use plugins
app.use(router)
app.use(pinia)

// Global error handler
app.config.errorHandler = (error, instance, info) => {
  console.error('Vue error:', error)
  console.error('Component:', instance)
  console.error('Info:', info)
}

// Mount app
app.mount('#app')

// Mark app as loaded (removes loading spinner)
document.body.classList.add('app-loaded')

// Debug info in development
if (import.meta.env.DEV) {
  console.log('🚀 UPM.Plus Desktop - Development Mode')
  console.log('Vue version:', app.version)
  console.log('Environment:', import.meta.env)
}