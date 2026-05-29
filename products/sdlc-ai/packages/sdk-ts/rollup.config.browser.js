// Rollup configuration for browser bundle

import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from '@rollup/plugin-terser';

export default defineConfig({
  input: 'src/index.ts',
  output: {
    file: 'dist/browser/index.js',
    format: 'esm',
    sourcemap: true
  },
  plugins: [
    nodeResolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      sourceMap: true,
      declaration: false
    }),
    terser({
      compress: {
        drop_console: true,
        drop_debugger: true
      },
      mangle: {
        reserved: ['SDLC', 'NodeClient', 'BrowserClient', 'AuthClient']
      }
    })
  ],
  external: [
    // Don't bundle these - expect them to be provided by the consumer
    'react',
    'react-dom',
    '@tanstack/react-query'
  ]
});
