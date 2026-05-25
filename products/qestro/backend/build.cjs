#!/usr/bin/env node

/**
 * Build the backend with esbuild instead of the TypeScript emitter.
 *
 * The codebase is large enough that `tsc` currently runs out of memory even in
 * `--noCheck` mode. Bundling the runtime entry points keeps the backend
 * shippable while leaving type-checking as a separate concern.
 */

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');

const entryPoints = {
  index: path.join(rootDir, 'src/index.ts'),
  'index-minimal': path.join(rootDir, 'src/index-minimal.ts'),
  'index.minimal': path.join(rootDir, 'src/index.minimal.ts'),
  'workers/testExecutor': path.join(rootDir, 'src/workers/testExecutor.ts'),
  'workers/aiProcessor': path.join(rootDir, 'src/workers/aiProcessor.ts'),
  'jobs/cleanup': path.join(rootDir, 'src/jobs/cleanup.ts'),
  'jobs/healthMonitor': path.join(rootDir, 'src/jobs/healthMonitor.ts'),
  'scripts/validateDeployment': path.join(rootDir, 'src/scripts/validateDeployment.ts'),
};

const banner = "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);";

function cleanDist() {
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });
}

function getExistingEntryPoints() {
  return Object.fromEntries(
    Object.entries(entryPoints).filter(([, filePath]) => fs.existsSync(filePath)),
  );
}

async function build() {
  console.log('🔨 Starting backend build...');
  console.log(`📍 Working directory: ${rootDir}`);
  console.log(`📍 Node version: ${process.version}`);

  cleanDist();

  const activeEntryPoints = getExistingEntryPoints();
  if (Object.keys(activeEntryPoints).length === 0) {
    throw new Error('No build entry points were found under src/');
  }

  console.log(`📦 Bundling ${Object.keys(activeEntryPoints).length} entry points with esbuild...`);

  const result = await esbuild.build({
    entryPoints: activeEntryPoints,
    outdir: distDir,
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'node',
    target: ['node18'],
    packages: 'external',
    sourcemap: true,
    chunkNames: 'chunks/[name]-[hash]',
    banner: { js: banner },
    legalComments: 'none',
    logLevel: 'info',
    metafile: true,
  });

  const indexPath = path.join(distDir, 'index.js');
  if (!fs.existsSync(indexPath)) {
    throw new Error('dist/index.js was not created');
  }

  const stats = fs.statSync(indexPath);
  const outputCount = Object.keys(result.metafile.outputs).length;

  console.log('✅ Build completed successfully');
  console.log(`✅ Main entry file created: dist/index.js (${stats.size} bytes)`);
  console.log(`✅ Generated ${outputCount} output files`);
}

build().catch((error) => {
  console.error('❌ Build failed with error:', error.message);
  if (error.errors?.length) {
    for (const buildError of error.errors) {
      console.error(buildError.text);
    }
  }
  process.exit(1);
});
