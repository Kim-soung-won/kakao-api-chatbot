import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /skill, /echo, /health 는 로컬 스킬 서버(apps/server, 3000)로 프록시.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/skill": "http://localhost:3000",
      "/echo": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
});
