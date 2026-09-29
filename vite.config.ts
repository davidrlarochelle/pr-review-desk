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
      "/api": `http://localhost:${process.env.PORT || 3100}`,
    },
  },
  build: {
    outDir: "dist",
  },
});
