import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'

const PORT = Number(process.env.PORT ?? 4079)

/**
 * The Content Security Policy that ships (docs/02-architecture.md §8). It lives in
 * index.html so that `dist/index.html` carries it without any build-time rewriting.
 */
export const SHIPPED_CSP = "default-src 'self'; connect-src 'none'; img-src 'self' data:"

/**
 * The same policy with exactly the three holes the Vite dev server needs: its HMR
 * WebSocket, the react-refresh preamble it inlines into index.html, and the styles
 * it injects as inline <style> elements. A production build emits a linked module
 * and a linked stylesheet and needs none of them.
 */
export const DEV_CSP = [
  "default-src 'self'",
  "connect-src 'self' ws://localhost:* ws://127.0.0.1:*",
  "img-src 'self' data:",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
].join('; ')

const devCsp = (): Plugin => ({
  name: 'compass-dev-csp',
  apply: 'serve',
  transformIndexHtml: {
    order: 'pre',
    handler: (html: string) => html.replace(SHIPPED_CSP, DEV_CSP),
  },
})

export default defineConfig({
  plugins: [react(), devCsp()],
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
