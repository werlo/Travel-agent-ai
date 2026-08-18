// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The designer's tokens ship verbatim (docs/agency/playbook.md, stage 3).
 * This test extracts the first ```css block from docs/03-design.md §2 and asserts
 * src/styles/tokens.css contains it byte for byte, so a future edit that "tidies"
 * a colour or a spacing step fails here rather than in a customer's eye.
 */

function designTokensBlock(): string {
  const doc = readFileSync('docs/03-design.md', 'utf8')
  const start = doc.indexOf('```css\n')
  if (start === -1) throw new Error('no css block in docs/03-design.md')
  const bodyStart = start + '```css\n'.length
  const end = doc.indexOf('\n```', bodyStart)
  if (end === -1) throw new Error('unterminated css block in docs/03-design.md')
  return doc.slice(bodyStart, end)
}

describe('design tokens', () => {
  const block = designTokensBlock()
  const shipped = readFileSync('src/styles/tokens.css', 'utf8')

  it('ships the designer’s §2 block verbatim', () => {
    expect(shipped).toContain(block)
  })

  it('carries both themes', () => {
    expect(block).toContain(':root {')
    expect(block).toContain('@media (prefers-color-scheme: dark)')
  })

  it('adds nothing beyond a header comment', () => {
    const extra = shipped.replace(block, '').trim()
    expect(extra.startsWith('/*')).toBe(true)
    expect(extra.endsWith('*/')).toBe(true)
  })

  it('is imported by the app entry point', () => {
    expect(readFileSync('src/main.tsx', 'utf8')).toContain("import './styles/tokens.css'")
  })
})
