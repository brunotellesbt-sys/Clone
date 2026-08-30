import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps asset URLs relative, so the same build works on a GitHub Pages
// project site (user.github.io/repo/), a user site, or opened from disk.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 1200 },
})
