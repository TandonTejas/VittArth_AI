import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const skipHmr = process.env.VITE_SKIP_HMR === 'true'
const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:8001'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': apiTarget
    },
    hmr: skipHmr ? false : true,
  }
})
