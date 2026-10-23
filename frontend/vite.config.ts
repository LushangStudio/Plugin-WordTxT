import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    cssCodeSplit: false,
    // WebVPN wraps scripts in a normal function; avoid module-only syntax.
    rollupOptions: { output: { format: "iife", inlineDynamicImports: true } },
    outDir: 'dist',
    sourcemap: true,
  },
})
