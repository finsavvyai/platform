import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist-main",
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "src/main/index.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name]-[hash].js",
        assetFileNames: "[ext]/[name]-[hash].[ext]",
      },
    },
  },
  server: false,
  clearOutDir: true,
});
