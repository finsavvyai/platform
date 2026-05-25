import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: './',

  build: {
    outDir: 'dist/studio',
    sourcemap: true,
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true },
      format: { comments: false },
    },
    rollupOptions: {
      input: './studio.html',
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          reactflow: ['@xyflow/react'],
        },
      },
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@lib': path.resolve(__dirname, 'src/lib'),
      '@types': path.resolve(__dirname, 'src/types'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
    },
  },

  server: {
    port: 3001,
    open: '/studio.html',
  },

  plugins: [react()],

  optimizeDeps: {
    include: ['react', 'react-dom', '@xyflow/react'],
  },
});
