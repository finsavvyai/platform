import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// Marketing-first Astro config. Cloudflare Pages target (per round-3 infra).
// SSG-only — no server runtime needed at this scaffold stage.
export default defineConfig({
  site: 'https://finsavvyai.com',
  output: 'static',
  integrations: [
    tailwind({
      applyBaseStyles: true,
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      assetsInlineLimit: 4096,
    },
  },
});
