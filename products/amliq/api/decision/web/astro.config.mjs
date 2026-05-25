import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// Static output. The Investigate UI scaffold renders an initial state at
// build time with a 3-decision fixture when BRAIN_API_URL is unset. A real
// deploy will switch to `output: 'server'` with a Cloudflare adapter to
// call the live /v1/aml/decision history endpoint per request — mirrors
// the brain/web precedent. 200-line cap applies.
export default defineConfig({
  site: 'https://investigate.amliq.local',
  output: 'static',
  base: '/investigate',
  integrations: [
    tailwind({
      applyBaseStyles: true,
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
});
