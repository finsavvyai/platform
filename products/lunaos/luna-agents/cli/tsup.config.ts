import { defineConfig } from 'tsup';
import { builtinModules } from 'node:module';

const nodeBuiltins = builtinModules.flatMap((m) => [m, `node:${m}`]);

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs'],
    platform: 'node',
    target: 'node18',
    outDir: 'dist',
    clean: true,
    splitting: false,
    sourcemap: true,
    dts: false,
    banner: {
        js: '#!/usr/bin/env node',
    },
    noExternal: [/.*/],
    external: [...nodeBuiltins, 'fsevents', 'playwright-core', 'playwright'],
});
