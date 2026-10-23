import { env } from "node:process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": env.VITE_API_ORIGIN ?? "http://127.0.0.1:3000"
    }
  }
});
