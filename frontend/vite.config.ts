import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { consoleForwardPlugin } from 'vite-console-forward-plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    consoleForwardPlugin({
      enabled: true,
      // endpoint: "/api/debug/client-logs",
      levels: ["log", "warn", "error", "info", "debug"],
    }),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "./src/_mantine";`,
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/record': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true
      },
    }
  }
})
