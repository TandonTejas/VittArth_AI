import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const skipHmr = process.env.VITE_SKIP_HMR === 'true'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000'
    },
    hmr: skipHmr ? false : true,
  }
})
