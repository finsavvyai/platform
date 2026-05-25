# Build System Documentation

## Overview

LunaOS Studio uses Vite as its build system for fast development and optimized production builds.

## Prerequisites

- Node.js 18+ 
- npm 9+

## Installation

```bash
npm install
```

## Development

Start the development server with hot module replacement:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Production Build

Build optimized assets for production:

```bash
npm run build
```

This will:
- Bundle and minify JavaScript
- Split code into optimized chunks
- Generate source maps for debugging
- Compress assets with Gzip and Brotli
- Optimize images and fonts
- Remove console.log statements
- Generate bundle analysis report

Build output will be in the `dist/` directory.

## Preview Production Build

Preview the production build locally:

```bash
npm run preview
```

## Code Quality

Run ESLint to check code quality:

```bash
npm run lint
```

Auto-fix linting issues:

```bash
npm run lint:fix
```

## Build Optimization Features

### Code Splitting

The build system automatically splits code into optimized chunks:

- **vendor-konva**: Konva library
- **vendor-three**: Three.js library
- **workflow**: Workflow engine and node system
- **editor**: Canvas editor components
- **features**: AI assistant, collaboration, gamification
- **three-background**: 3D background rendering

### Asset Optimization

- **Minification**: JavaScript and CSS are minified using Terser
- **Compression**: Assets are compressed with Gzip and Brotli
- **Inlining**: Small assets (<4KB) are inlined as base64
- **Hashing**: Files include content hashes for cache busting

### Source Maps

Source maps are generated for production builds to enable debugging while keeping code minified.

### Browser Compatibility

The build includes polyfills for older browsers:
- ES2015+ features
- Promise support
- Array iterators
- Object.assign
- String.includes

Target browsers:
- Chrome/Edge: Last 2 versions
- Firefox: Last 2 versions
- Safari: Last 2 versions

### Performance Budgets

The build warns if chunk sizes exceed 1000KB.

## Bundle Analysis

After building, open `dist/stats.html` to visualize:
- Bundle composition
- Chunk sizes
- Gzip/Brotli compressed sizes
- Module dependencies

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Available variables:
- `NODE_ENV`: Environment (development/production)
- `VITE_API_URL`: Backend API URL
- `VITE_SENTRY_DSN`: Sentry error tracking DSN
- `VITE_ENABLE_*`: Feature flags

## Deployment

### Netlify

The project is configured for Netlify deployment:

1. Build command: `npm run build`
2. Publish directory: `dist`
3. Headers and caching are configured in `netlify.toml`

### Manual Deployment

1. Build the project: `npm run build`
2. Upload the `dist/` directory to your hosting provider
3. Configure your server to:
   - Serve `index.html` for all routes (SPA routing)
   - Set appropriate cache headers
   - Enable Gzip/Brotli compression

## Troubleshooting

### Build Fails

- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Clear Vite cache: `rm -rf .vite`
- Check Node.js version: `node --version` (should be 18+)

### Large Bundle Size

- Check bundle analysis: Open `dist/stats.html`
- Review manual chunks in `vite.config.js`
- Consider lazy loading for large features

### Source Maps Not Working

- Ensure `sourcemap: true` in `vite.config.js`
- Check browser DevTools settings
- Verify source maps are deployed with assets

## Performance Tips

1. **Lazy Loading**: Import large modules dynamically
2. **Tree Shaking**: Use ES modules and avoid side effects
3. **Code Splitting**: Keep chunks under 500KB
4. **Asset Optimization**: Compress images before adding to project
5. **CDN**: Use CDN for static assets in production
