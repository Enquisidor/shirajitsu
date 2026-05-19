import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Multi-entrypoint Vite config for a Manifest V3 Chrome extension.
// Each entrypoint gets its own output chunk — no shared runtime between background, content, and UI.

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
  plugins: [react()],
  // root=src so HTML entrypoints output at popup/index.html and sidepanel/index.html
  // (without src/ prefix), matching the paths declared in public/manifest.json.
  // base='./' so Vite emits relative asset paths — Chrome extensions don't resolve
  // absolute paths (/foo.js) correctly; relative paths (../foo.js) are required.
  root: resolve(__dirname, 'src'),
  base: './',
  publicDir: resolve(__dirname, 'public'),
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
        popup: resolve(__dirname, 'src/popup/index.html'),
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[ext]',
      },
    },
  },
})
