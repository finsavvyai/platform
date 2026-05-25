import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/renderer"),
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  root: ".",
  build: {
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, "src/renderer/index.html"),
      },
    },
  },
  server: {
    port: 5175,
    strictPort: true,
  },
  base: "./",
});
