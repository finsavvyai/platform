import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        build: {
            outDir: 'dist/main',
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'src/main/index.ts')
                },
                output: {
                    format: 'cjs',
                    entryFileNames: '[name].js',
                    interop: 'auto'
                }
            }
        },
        resolve: {
            alias: {
                '@shared': resolve(__dirname, 'src/shared')
            }
        }
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
        build: {
            outDir: 'dist/preload',
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'src/preload/index.ts')
                },
                output: {
                    format: 'cjs',
                    entryFileNames: '[name].js',
                    interop: 'auto'
                }
            }
        }
    },
    renderer: {
        root: resolve(__dirname, 'src/renderer'),
        build: {
            outDir: resolve(__dirname, 'dist/renderer'),
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'src/renderer/index.html')
                }
            }
        },
        plugins: [react()],
        resolve: {
            alias: {
                '@': resolve(__dirname, 'src/renderer/src'),
                '@shared': resolve(__dirname, 'src/shared'),
                '@components': resolve(__dirname, 'src/renderer/src/components'),
                '@hooks': resolve(__dirname, 'src/renderer/src/hooks'),
                '@utils': resolve(__dirname, 'src/renderer/src/utils'),
                '@services': resolve(__dirname, 'src/renderer/src/services')
            }
        },
        css: {
            postcss: {
                plugins: [tailwindcss, autoprefixer]
            }
        }
    }
});
