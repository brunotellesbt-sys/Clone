import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Caminhos relativos permitem servir o mesmo build na raiz de um domínio ou
// numa subpasta do GitHub Pages. Localmente, use o servidor de preview.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 1200 },
})
