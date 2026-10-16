import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: ".",
  server: {
    port: 5173,
    proxy: {
      // The dev server from `npm run dev:server`, not the Docker container.
      // Host stays the page's own (the string shorthand would rewrite it), so local-only sees Origin and Host agree.
      "/api": { target: `http://localhost:${process.env.PORT || 3100}`, changeOrigin: false },
    },
  },
  build: {
    outDir: "dist",
  },
});
