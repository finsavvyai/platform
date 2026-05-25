import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// Static output. The search page renders an initial state at build time
// and performs the API call from the form action (GET param) — the page
// re-renders server-side at dev time and as a no-op statically. A real
// deployment will swap to `output: 'server'` with a Cloudflare adapter,
// configured per-environment, not in the scaffold.
//
// 200-line cap applies.
export default defineConfig({
  site: 'https://brain.amliq.local',
  output: 'static',
  integrations: [
    tailwind({
      applyBaseStyles: true,
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
});
