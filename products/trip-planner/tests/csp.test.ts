// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEV_CSP, SHIPPED_CSP } from '../vite.config'

/**
 * docs/02-architecture.md §8 — the Content Security Policy.
 *
 * The policy is asserted against `index.html` on disk rather than against a
 * running page, because what matters is what ships: Vite copies this file into
 * `dist/` and the dev-only relaxation in `vite.config.ts` never runs at build.
 * A dev relaxation that quietly leaked into the shipped file is exactly the
 * failure this test exists to catch.
 */

const html = readFileSync('index.html', 'utf8')

function metaContent(): string {
  const match = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(
    html.replace(/\s+/g, ' '),
  )
  if (match === null) throw new Error('no CSP meta tag in index.html')
  return match[1] ?? ''
}

describe('the shipped Content Security Policy', () => {
  it('is the policy the architecture specifies, exactly', () => {
    expect(metaContent()).toBe("default-src 'self'; connect-src 'none'; img-src 'self' data:")
    expect(metaContent()).toBe(SHIPPED_CSP)
  })

  it('forbids every outbound connection, because the app makes none', () => {
    expect(metaContent()).toContain("connect-src 'none'")
    expect(metaContent()).not.toContain('unsafe-inline')
    expect(metaContent()).not.toContain('unsafe-eval')
    expect(metaContent()).not.toContain('*')
  })

  it('loads nothing from another origin', () => {
    expect(html).not.toMatch(/https?:\/\/(?!localhost)/)
  })

  it('relaxes only what the dev server needs, and only when serving', () => {
    // The dev policy must be a strict superset in the three named directives and
    // identical everywhere else.
    expect(DEV_CSP).toContain("default-src 'self'")
    expect(DEV_CSP).toContain("img-src 'self' data:")
    expect(DEV_CSP).toContain("script-src 'self' 'unsafe-inline'")
    expect(DEV_CSP).toContain("style-src 'self' 'unsafe-inline'")
    expect(DEV_CSP).toContain('ws://localhost:*')
    // And nothing in the dev policy reaches off the machine.
    expect(DEV_CSP).not.toMatch(/https?:\/\/(?!localhost|127\.0\.0\.1)/)

    const config = readFileSync('vite.config.ts', 'utf8')
    expect(config).toContain("apply: 'serve'")
  })
})
