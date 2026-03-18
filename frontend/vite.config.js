import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Optional: proxy backend API calls to avoid CORS in dev
      // '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
  },
})
