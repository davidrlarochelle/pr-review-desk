import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: ".",
  server: {
    port: 5173,
    proxy: {
      "/api": `http://localhost:${process.env.PORT || 37703}`,
    },
  },
  build: {
    outDir: "dist",
  },
});
