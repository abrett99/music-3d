import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // For GitHub Pages - change 'music-3d' to your repo name if different
  base: '/music-3d/',
  server: {
    port: 3000,
    open: true
  },
  build: {
    sourcemap: true
  }
})
