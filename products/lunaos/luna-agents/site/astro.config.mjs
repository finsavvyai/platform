import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://agents.lunaos.ai",
  integrations: [mdx(), sitemap()],
  build: {
    inlineStylesheets: "auto",
  },
  vite: {
    css: { devSourcemap: true },
  },
});
