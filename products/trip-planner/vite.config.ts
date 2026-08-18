import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const PORT = Number(process.env.PORT ?? 4079)

export default defineConfig({
  plugins: [react()],
  server: { port: PORT, strictPort: true },
  preview: { port: PORT, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
  },
})
