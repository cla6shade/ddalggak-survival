import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/ddalggak',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    allowedHosts: ['home.cla6sha.de'],
  },
  preview: {
    port: 4002,
    strictPort: true,
    host: true,
    allowedHosts: ['home.cla6sha.de'],
  },
  build: {
    target: 'es2022',
  },
})
