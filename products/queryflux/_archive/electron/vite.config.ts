import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, "src/main/index.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, "src/preload.ts"),
        },
      },
    },
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src/renderer"),
        "@shared": path.resolve(__dirname, "src/shared"),
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, "src/renderer/index.html"),
        },
      },
    },
    server: {
      port: 5174,
      strictPort: true,
    },
  },
});
