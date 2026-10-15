import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const entry = (name: string): string => fileURLToPath(new URL(name, import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: entry("./index.html"),
        stats: entry("./stats.html"),
      },
    },
  },
});
