import { defineConfig } from 'vite';
import viteCompression from 'vite-plugin-compression';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  // Base public path
  base: './',
  
  // Build configuration
  build: {
    // Output directory
    outDir: 'dist',
    
    // Disable sourcemaps in production for smaller output
    sourcemap: false,

    // Target modern browsers
    target: 'es2020',
    
    // Copy service worker and offline page to dist
    copyPublicDir: true,
    
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info']
      },
      format: {
        comments: false // Remove comments
      }
    },
    
    // Chunk size warnings
    chunkSizeWarningLimit: 1000,
    
    // Rollup options for code splitting
    rollupOptions: {
      input: {
        main: './index.html',
        studio: './studio.html',
      },
      output: {
        
        // Asset file naming
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return 'assets/images/[name]-[hash][extname]';
          } else if (/woff|woff2|eot|ttf|otf/i.test(ext)) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          
          return 'assets/[name]-[hash][extname]';
        },
        
        // Chunk file naming
        chunkFileNames: 'assets/js/[name]-[hash].js',
        
        // Entry file naming
        entryFileNames: 'assets/js/[name]-[hash].js'
      }
    },
    
    // Asset inline limit (smaller assets will be inlined as base64)
    assetsInlineLimit: 4096
  },
  
  // Server configuration for development
  server: {
    port: 3000,
    open: true,
    cors: true
  },
  
  // Preview server configuration
  preview: {
    port: 4173,
    open: true
  },
  
  // Plugins
  plugins: [
    // Gzip compression - for broader compatibility
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 1024, // Compress files larger than 1kb
      algorithm: 'gzip',
      ext: '.gz',
      deleteOriginFile: false
    }),
    
    // Brotli compression - better compression ratio
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 1024, // Compress files larger than 1kb
      algorithm: 'brotliCompress',
      ext: '.br',
      deleteOriginFile: false,
      compressionOptions: {
        level: 11 // Maximum compression
      }
    }),
    
    // Bundle analyzer
    visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap' // Visual representation of bundle
    })
  ],
  
  // Optimization
  optimizeDeps: {
    include: ['react', 'react-dom', '@xyflow/react']
  }
});
