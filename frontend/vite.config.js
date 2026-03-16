import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/process': 'http://localhost:5000',
      '/status': 'http://localhost:5000',
      '/chat': 'http://localhost:5000',
      '/music': 'http://localhost:5000',
      '/downloaded_music': 'http://localhost:5000',
    },
  },
})
