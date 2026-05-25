/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    root: '.',
    pool: 'forks',
  },

  // Build configuration for production
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('recharts')) {
            return 'charts'
          }

          if (id.includes('framer-motion')) {
            return 'motion'
          }

          if (id.includes('lucide-react') || id.includes('@heroicons')) {
            return 'icons'
          }

          return 'vendor'
        },
      },
    },
  },

  // Server configuration for development
  server: {
    port: 3000,
    host: true,
    proxy: {
      '^/api(?:/|$)': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  // Preview server configuration
  preview: {
    port: 3000,
    host: true,
  },

  // Environment variables prefix
  envPrefix: 'VITE_',

  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },

  // CSS configuration
  css: {
    devSourcemap: true,
  },

  // Optimizations
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
})
