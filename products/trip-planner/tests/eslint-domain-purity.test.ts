// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ESLint } from 'eslint'

/**
 * Guard the guard (docs/02-architecture.md §2, §11).
 *
 * The purity of src/domain/ is what makes R13 (determinism) true, and it is enforced
 * by an ESLint override rather than by trust. An override that has quietly stopped
 * matching is worse than no override, so these tests lint deliberately impure code
 * *as if* it lived in src/domain/ and fail if ESLint lets it through — and lint the
 * identical code as if it lived in src/app/ to prove the block is what caught it,
 * not some project-wide rule.
 *
 * ESLint#lintText resolves config from the given filePath; no probe file is ever
 * written to disk, so `npm run lint` itself stays clean.
 */

const DOMAIN_PATH = 'src/domain/__purity_probe__.ts'
const APP_PATH = 'src/app/__purity_probe__.ts'

async function ruleIdsFor(filePath: string, code: string): Promise<string[]> {
  const eslint = new ESLint({ cwd: process.cwd() })
  const results = await eslint.lintText(code, { filePath })
  const first = results[0]
  if (first === undefined) throw new Error(`ESLint returned no result for ${filePath}`)
  return first.messages.map((m) => m.ruleId ?? 'fatal')
}

interface Probe {
  name: string
  code: string
  rule: string
}

const PROBES: readonly Probe[] = [
  {
    name: 'a window reference',
    code: 'export function widthOfTheWorld(): number {\n  return window.innerWidth\n}\n',
    rule: 'no-restricted-globals',
  },
  {
    name: 'a document reference',
    code: 'export function title(): string {\n  return document.title\n}\n',
    rule: 'no-restricted-globals',
  },
  {
    name: 'a localStorage reference',
    code: "export function read(): string | null {\n  return localStorage.getItem('x')\n}\n",
    rule: 'no-restricted-globals',
  },
  {
    name: 'an Intl reference',
    code: "export function fmt(): string {\n  return new Intl.NumberFormat('en-IN').format(1)\n}\n",
    rule: 'no-restricted-globals',
  },
  {
    name: 'Date.now()',
    code: 'export function stamp(): number {\n  return Date.now()\n}\n',
    rule: 'no-restricted-properties',
  },
  {
    name: 'Math.random()',
    code: 'export function pick(): number {\n  return Math.random()\n}\n',
    rule: 'no-restricted-properties',
  },
  {
    name: 'new Date()',
    code: 'export function today(): unknown {\n  return new Date()\n}\n',
    rule: 'no-restricted-syntax',
  },
  {
    name: 'an import from data/',
    code: "import { localCatalogue } from '../data/localCatalogue'\nexport const c = localCatalogue\n",
    rule: 'no-restricted-imports',
  },
  {
    name: 'an import from ui/',
    code: "import { VibeCard } from '../ui/components/VibeCard'\nexport const c = VibeCard\n",
    rule: 'no-restricted-imports',
  },
  {
    name: 'an import of react',
    code: "import { useState } from 'react'\nexport const s = useState\n",
    rule: 'no-restricted-imports',
  },
]

describe('the src/domain/** purity override', () => {
  for (const probe of PROBES) {
    it(`rejects ${probe.name} inside src/domain`, async () => {
      const rules = await ruleIdsFor(DOMAIN_PATH, probe.code)
      expect(rules).toContain(probe.rule)
    })

    it(`allows ${probe.name} outside src/domain`, async () => {
      const rules = await ruleIdsFor(APP_PATH, probe.code)
      expect(rules).not.toContain(probe.rule)
    })
  }

  it('leaves pure domain code alone', async () => {
    const pure = 'export function add(a: number, b: number): number {\n  return a + b\n}\n'
    const rules = await ruleIdsFor(DOMAIN_PATH, pure)
    expect(rules).toEqual([])
  })

  it('lints the real src/domain sources with zero problems', async () => {
    const eslint = new ESLint({ cwd: process.cwd() })
    const results = await eslint.lintFiles(['src/domain'])
    expect(results.length).toBeGreaterThan(0)
    const problems = results.flatMap((r) =>
      r.messages.map((m) => `${r.filePath}: ${m.ruleId ?? 'fatal'} ${m.message}`),
    )
    expect(problems).toEqual([])
  })
})
