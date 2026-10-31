import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    // Trong lúc dev, chuyển tiếp WebSocket /ws sang server realtime (port 3001)
    proxy: {
      '/ws': { target: 'ws://localhost:3001', ws: true },
    },
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
