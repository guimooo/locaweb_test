import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base relativa: funciona no Vercel (raiz) e também servido de subpasta.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', sourcemap: false },
})
