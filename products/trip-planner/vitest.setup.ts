import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  // The app persists a session on every state change (R15). Without this, one
  // test's session would restore itself into the next one's first render.
  if (typeof window !== 'undefined') window.localStorage.clear()
})
