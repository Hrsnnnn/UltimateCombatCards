import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@haunted/core': resolve(__dirname, '../core/dist/index.js'),
    },
  },
})
