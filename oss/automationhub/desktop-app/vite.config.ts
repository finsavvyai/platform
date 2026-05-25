import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [vue()],

  // Vite options tailored for Tauri development
  clearScreen: false,

  // Tauri expects a fixed port, fail if that port is not available
  server: {
    port: 3030,
    strictPort: true,
    watch: {
      // Tell vite to ignore watching src-tauri
      ignored: ["**/src-tauri/**"],
    },
  },

  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@views': resolve(__dirname, 'src/views'),
      '@stores': resolve(__dirname, 'src/stores'),
      '@composables': resolve(__dirname, 'src/composables'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@assets': resolve(__dirname, 'src/assets'),
    },
  },

  // Build configuration
  build: {
    // Tauri supports es2021
    target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',

    // Don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,

    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,

    // Optimize dependencies
    rollupOptions: {
      external: ['@tauri-apps/api'],
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
        },
      },
    },

    // Chunk size limit
    chunkSizeWarningLimit: 1000,
  },

  // CSS configuration
  css: {
    postcss: {
      plugins: [
        tailwindcss,
        autoprefixer,
      ],
    },
  },

  // Optimize dependencies
  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      'pinia',
    ],
    exclude: ['@tauri-apps/api'],
  },

  // Development configuration
  define: {
    __VUE_OPTIONS_API__: false,
    __VUE_PROD_DEVTOOLS__: false,
  },

  // Environment variables
  envPrefix: ['VITE_', 'TAURI_'],
}))