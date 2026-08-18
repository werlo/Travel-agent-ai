export const meta = {
  name: 'ship-product',
  description: 'Run the full software-agency pipeline on one idea: PRD, architecture + design, build, QA, customer panel, refinement, sign-off',
  whenToUse: 'When the founder gives a product idea via /ship and wants it taken end to end by the agency staff.',
  phases: [
    { title: 'Discovery', detail: 'PM turns the brief into a testable MVP definition' },
    { title: 'Architecture & Design', detail: 'Tech Lead and Designer, in parallel' },
    { title: 'Build', detail: 'Developer implements the architecture slices in order' },
    { title: 'QA', detail: 'E2E against every acceptance criterion, then fix rounds' },
    { title: 'Customer Panel', detail: 'Persona judges drive the live app blind' },
    { title: 'Refinement', detail: 'Triage, fix, regress, re-judge' },
    { title: 'Sign-off', detail: 'Architecture review, then the founder report' },
  ],
}

// ---------------------------------------------------------------- config

const cfg = Object.assign(
  {
    judges: 3,
    maxSlices: 4,
    maxFixRounds: 2,
    maxRefineRounds: 1,
    minScore: 8,
  },
  args || {}
)

if (!cfg.slug) throw new Error('ship-product needs args.slug (see .claude/skills/ship)')

// Reasoning effort per stage. Cheap where the work is mechanical and the spec
// already decided everything; expensive where judgement is what determines whether
// the product is any good. Wiring up a build config is not the same kind of work as
// deciding what to cut from the scope, and paying the same rate for both is waste.
// Override any single key via args.effort, e.g. { effort: { judge: 'high' } }.
const EFFORT = Object.assign(
  {
    prd: 'high',          // scope decisions are the most expensive thing to get wrong
    architecture: 'high', // as is the shape everything else is built on
    design: 'medium',
    scaffold: 'low',      // slice 1 is boilerplate the house stack already specifies
    build: 'medium',
    fix: 'medium',
    qa: 'medium',
    judge: 'medium',
    triage: 'low',        // ranking a short list against stated criteria
    review: 'high',       // the last chance to catch what everyone else missed
    release: 'medium',
  },
  cfg.effort || {}
)

const DIR = cfg.dir || `products/${cfg.slug}`
const DOCS = `${DIR}/docs`
const URL = cfg.url || `see ${DIR}/.agency/state.json`

const CONTEXT = [
  `Product slug:      ${cfg.slug}`,
  `Product directory: ${DIR}  (run npm commands from here)`,
  `Local URL:         ${URL}`,
  `Start the app:     ./scripts/serve-product.sh ${cfg.slug}   (idempotent; reuses a running server)`,
  ``,
  `Reference, from the repo root:`,
  `  docs/agency/playbook.md      — the stage you are in, and its gate`,
  `  docs/agency/house-stack.md   — required npm scripts and environment facts`,
  `  docs/agency/templates/       — the shape of the document you are writing`,
].join('\n')

// ---------------------------------------------------------------- schemas

const S_PRD = {
  type: 'object',
  required: ['productName', 'oneJob', 'requirements', 'screens', 'personas'],
  properties: {
    productName: { type: 'string' },
    oneJob: { type: 'string', description: 'The single job the MVP does' },
    requirements: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'acceptance'],
        properties: {
          id: { type: 'string', description: 'R1, R2, ...' },
          title: { type: 'string' },
          acceptance: { type: 'string', description: 'Given / When / Then' },
        },
      },
    },
    screens: { type: 'array', items: { type: 'string' } },
    personas: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'identity', 'goal', 'input', 'abandonTrigger'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          identity: { type: 'string' },
          goal: { type: 'string', description: "The outcome, in the persona's own words" },
          input: { type: 'string', description: 'The real, messy data they arrive with' },
          abandonTrigger: { type: 'string' },
        },
      },
    },
    outOfScope: { type: 'array', items: { type: 'string' } },
    assumptions: { type: 'array', items: { type: 'string' } },
    escalations: {
      type: 'array',
      items: { type: 'string' },
      description: 'Only the three cases the playbook allows; empty otherwise',
    },
  },
}

const S_ARCH = {
  type: 'object',
  required: ['stack', 'slices'],
  properties: {
    stack: { type: 'string' },
    slices: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'requirements', 'doneWhen'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          requirements: { type: 'array', items: { type: 'string' } },
          doneWhen: { type: 'string' },
        },
      },
    },
    bottleneck: { type: 'string' },
    risks: { type: 'array', items: { type: 'string' } },
  },
}

const S_DESIGN = {
  type: 'object',
  required: ['principles', 'screensSpecced', 'uxChecks'],
  properties: {
    principles: { type: 'array', items: { type: 'string' } },
    screensSpecced: { type: 'array', items: { type: 'string' } },
    uxChecks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'check'],
        properties: {
          id: { type: 'string', description: 'UX1, UX2, ...' },
          check: { type: 'string' },
          screen: { type: 'string' },
        },
      },
    },
    accessibilityNotes: { type: 'array', items: { type: 'string' } },
  },
}

const S_BUILD = {
  type: 'object',
  required: ['sliceId', 'implemented', 'checks'],
  properties: {
    sliceId: { type: 'string' },
    implemented: { type: 'array', items: { type: 'string' } },
    filesTouched: { type: 'array', items: { type: 'string' } },
    testsAdded: { type: 'number' },
    checks: {
      type: 'object',
      required: ['lint', 'build', 'test'],
      properties: {
        lint: { type: 'string', description: 'PASS / FAIL / SKIPPED + the real result line' },
        build: { type: 'string' },
        test: { type: 'string' },
      },
    },
    deviations: { type: 'array', items: { type: 'string' } },
    incomplete: { type: 'array', items: { type: 'string' }, description: 'Honest list of what is not finished' },
    notes: { type: 'string' },
  },
}

const S_QA = {
  type: 'object',
  required: ['verdict', 'criteriaTotal', 'criteriaPassed', 'bugs'],
  properties: {
    verdict: { type: 'string', enum: ['PASS', 'FAIL'] },
    criteriaTotal: { type: 'number' },
    criteriaPassed: { type: 'number' },
    untested: { type: 'array', items: { type: 'string' } },
    bugs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'severity', 'title'],
        properties: {
          id: { type: 'string' },
          severity: { type: 'string', enum: ['S1', 'S2', 'S3', 'S4'] },
          title: { type: 'string' },
          repro: { type: 'string' },
          requirement: { type: 'string' },
        },
      },
    },
    commands: { type: 'string', description: 'Real output summary of lint/build/test/e2e' },
  },
}

const S_JUDGE = {
  type: 'object',
  required: ['personaId', 'personaName', 'goalMet', 'scores', 'overallScore', 'blockers', 'topFixes'],
  properties: {
    personaId: { type: 'string' },
    personaName: { type: 'string' },
    goalMet: { type: 'string', enum: ['yes', 'partly', 'no'] },
    timeToGoal: { type: 'string' },
    scores: {
      type: 'object',
      required: ['clarity', 'taskSuccess', 'speed', 'visual', 'trust'],
      properties: {
        clarity: { type: 'number' },
        taskSuccess: { type: 'number' },
        speed: { type: 'number' },
        visual: { type: 'number' },
        trust: { type: 'number' },
      },
    },
    overallScore: { type: 'number', description: '1-10, a judgement not an average' },
    blockers: { type: 'array', items: { type: 'string' } },
    topFixes: { type: 'array', items: { type: 'string' } },
    quotes: { type: 'array', items: { type: 'string' } },
    wouldUseAgain: { type: 'boolean' },
    wouldPay: { type: 'string' },
  },
}

const S_TRIAGE = {
  type: 'object',
  required: ['accepted'],
  properties: {
    accepted: {
      type: 'array',
      items: {
        type: 'object',
        required: ['rank', 'fix', 'fixedMeans'],
        properties: {
          rank: { type: 'number' },
          fix: { type: 'string' },
          requirement: { type: 'string' },
          citedBy: { type: 'string' },
          fixedMeans: { type: 'string' },
        },
      },
    },
    rejected: {
      type: 'array',
      items: {
        type: 'object',
        required: ['fix', 'reason'],
        properties: { fix: { type: 'string' }, reason: { type: 'string' } },
      },
    },
  },
}

const S_REVIEW = {
  type: 'object',
  required: ['verdict', 'bottleneck', 'scale'],
  properties: {
    verdict: { type: 'string', enum: ['GO', 'GO_WITH_RISK', 'NO_GO'] },
    justification: { type: 'string' },
    drift: { type: 'array', items: { type: 'string' } },
    bottleneck: { type: 'string', description: 'The real one, with a number' },
    scale: {
      type: 'object',
      properties: { x10: { type: 'string' }, x100: { type: 'string' }, x1000: { type: 'string' } },
    },
    security: { type: 'array', items: { type: 'string' } },
    nextSteps: { type: 'array', items: { type: 'string' } },
  },
}

const S_RELEASE = {
  type: 'object',
  required: ['verdict', 'headline', 'howToRun', 'proven', 'gaps'],
  properties: {
    verdict: { type: 'string', enum: ['READY', 'READY_WITH_CAVEATS', 'NOT_READY'] },
    headline: { type: 'string', description: 'One honest line for the founder' },
    whatItDoes: { type: 'string' },
    howToRun: { type: 'string' },
    proven: { type: 'array', items: { type: 'string' }, description: 'Each cites a command actually run' },
    gaps: { type: 'array', items: { type: 'string' } },
    nextMoves: { type: 'array', items: { type: 'string' } },
  },
}

// ---------------------------------------------------------------- helpers

function mean(nums) {
  const ok = nums.filter(function (n) { return typeof n === 'number' && !isNaN(n) })
  if (!ok.length) return 0
  return Math.round((ok.reduce(function (a, b) { return a + b }, 0) / ok.length) * 10) / 10
}

function blockersOf(panel) {
  return panel.reduce(function (acc, j) { return acc.concat(j.blockers || []) }, [])
}

function severe(bugs) {
  return (bugs || []).filter(function (b) { return b.severity === 'S1' || b.severity === 'S2' })
}

function bullets(items, fmt) {
  return (items || []).map(fmt).join('\n')
}

// ---------------------------------------------------------------- 1. Discovery

phase('Discovery')
log(`Brief received for "${cfg.slug}". Staffing the run: PM, Tech Lead, Designer, Developer, QA, ${cfg.judges} customer judges, Release Manager.`)

const prd = await agent(
  `You are the Product Manager. Turn the founder's brief into the MVP definition.

${CONTEXT}

Read ${DOCS}/00-brief.md — that is the founder's idea, verbatim.

Write ${DOCS}/01-prd.md following docs/agency/templates/01-prd.md. Cut to one job.
Give every requirement an id (R1, R2, ...) and a Given/When/Then acceptance criterion
that a Playwright test could fail. Staff ${cfg.judges} customer personas who would
genuinely disagree with each other; each needs a goal in their own words and the real
messy input they arrive with — those personas become the customer panel that judges
this product, so thin personas produce a useless panel.

Decide every ambiguity yourself and record it under Assumptions. Do not ask the founder.`,
  { agentType: 'product-manager', label: 'pm:prd', phase: 'Discovery', schema: S_PRD, effort: EFFORT.prd }
)

if (!prd) throw new Error('Discovery failed: no PRD produced. Nothing downstream can proceed.')

log(`PRD: "${prd.productName}" — ${prd.requirements.length} requirements, ${prd.screens.length} screens, ${prd.personas.length} personas.`)
if (prd.escalations && prd.escalations.length) {
  log(`ESCALATION for the founder: ${prd.escalations.join(' | ')}`)
}

const reqList = bullets(prd.requirements, function (r) { return `  ${r.id}: ${r.title} — ${r.acceptance}` })

// ---------------------------------------------------------------- 2. Architecture & Design
// Barrier is deliberate: the developer cannot start until both documents exist.

phase('Architecture & Design')

const pair = await parallel([
  function () {
    return agent(
      `You are the Tech Lead. Design the system for "${prd.productName}".

${CONTEXT}

Read ${DOCS}/01-prd.md first. The requirements you must satisfy:
${reqList}

Write ${DOCS}/02-architecture.md following docs/agency/templates/02-architecture.md.

Two parts matter most. The scalability plan must name what breaks first with an actual
number, not "add caching" — say whether the number is measured or reasoned. And the work
breakdown must be an ordered build plan of at most ${cfg.maxSlices} slices where slice 1
is the scaffold (project, tooling, the five npm scripts from docs/agency/house-stack.md,
test harness, one real screen rendering) and every later slice names the requirements it
satisfies and leaves the app runnable.

Nothing that needs an external service, API key or paid dependency.`,
      { agentType: 'tech-lead', label: 'techlead:architecture', phase: 'Architecture & Design', schema: S_ARCH, effort: EFFORT.architecture }
    )
  },
  function () {
    return agent(
      `You are the Designer. Specify the interface for "${prd.productName}".

${CONTEXT}

Read ${DOCS}/01-prd.md first. Screens to specify: ${prd.screens.join(', ')}.
The requirements the interface must serve:
${reqList}

Write ${DOCS}/03-design.md following docs/agency/templates/03-design.md.

Emit literal CSS custom properties the developer can paste — real colour values for light
and dark, with the WCAG contrast ratios stated. Specify every state of every screen
including empty, loading and error, with the real copy written out. Then produce the
numbered UX acceptance checklist (UX1..UXn) that QA will test — each check must be
observable in the running UI by someone who never read your document.`,
      { agentType: 'designer', label: 'designer:spec', phase: 'Architecture & Design', schema: S_DESIGN, effort: EFFORT.design }
    )
  },
])

const arch = pair[0]
const design = pair[1]

if (!arch) throw new Error('Architecture stage failed: no work breakdown, so the build cannot be dispatched.')
if (!design) log('WARNING: the design spec failed to produce a summary — the build will proceed against the PRD alone and UX checks will be thin.')

const slices = (arch.slices || []).slice(0, cfg.maxSlices)
const uxList = design ? bullets(design.uxChecks, function (u) { return `  ${u.id}: ${u.check}` }) : '  (no UX checklist produced)'
log(`Architecture: ${arch.stack}. ${slices.length} build slices. Design: ${design ? design.uxChecks.length : 0} UX checks.`)

// ---------------------------------------------------------------- 3. Build
// Sequential on purpose: slices share a working tree and each builds on the last.

phase('Build')

const builds = []
for (let i = 0; i < slices.length; i++) {
  const s = slices[i]
  const prior = builds.length
    ? `Slices already done: ${builds.map(function (b) { return b && b.sliceId }).filter(Boolean).join(', ')}. Read the existing code before adding to it — do not re-create what is already there.`
    : `This is the first slice. The product directory contains only docs/ — you are scaffolding from scratch.`

  const result = await agent(
    `You are the Developer. Implement slice ${s.id}: ${s.title}.

${CONTEXT}

${prior}

Read ${DOCS}/01-prd.md, ${DOCS}/02-architecture.md (your slice, the module map and the
contracts) and ${DOCS}/03-design.md (tokens, screens, copy) before writing code.

This slice covers: ${(s.requirements || []).join(', ') || 'scaffold only'}
Done when: ${s.doneWhen}

Implement only this slice. Use the designer's tokens and copy exactly as written. No
stubs or placeholder content on any path the PRD covers.

Before returning, from ${DIR}: run \`npm run lint && npm run build && npm test\` and put
the real result in your summary. All must pass. Then commit: feat(${cfg.slug}): ${s.id} — <one line>.`,
    { agentType: 'developer', label: `dev:${s.id}`, phase: 'Build', schema: S_BUILD, effort: i === 0 ? EFFORT.scaffold : EFFORT.build }
  )

  builds.push(result)
  if (result) {
    log(`${s.id} done — lint ${result.checks.lint}, build ${result.checks.build}, test ${result.checks.test}${result.incomplete && result.incomplete.length ? ` — UNFINISHED: ${result.incomplete.join('; ')}` : ''}`)
  } else {
    log(`${s.id} FAILED to report. Continuing; QA will find what is missing.`)
  }
}

// ---------------------------------------------------------------- 4. QA + fix rounds

phase('QA')

let qa = null
let fixRounds = 0

function qaPrompt(what, appendNote) {
  return `You are the QA Engineer. ${what}.

${CONTEXT}

Read ${DOCS}/01-prd.md for the acceptance criteria and ${DOCS}/03-design.md for the UX
checklist. Every one of these gets a test — not a sample:
${reqList}
${uxList}

Write Playwright specs under ${DIR}/e2e/ and run, from ${DIR}:
\`npm run lint && npm run build && npm test && npm run e2e\`

Then do the sweeps in docs/agency/playbook.md Stage 4: responsive at 360/768/1280,
keyboard-only through the primary flow, console errors, reload mid-flow, hostile input,
double-submit.

You may create and edit files under ${DIR}/tests/ and ${DIR}/e2e/ ONLY. Never modify
product source to make a test pass — file a bug instead.

Write ${DOCS}/04-qa-report.md${appendNote ? ' — append a new round section, do not overwrite the previous rounds' : ''} with the real command output. PASS requires zero open S1/S2. Mark anything you could not test as UNTESTED rather than passing it.`
}

// Drive S1/S2 bugs to zero, whoever found them and whenever. Called after the first
// QA pass AND after the refinement regression — a blocker introduced by a customer
// fix is exactly as serious as one that was there all along, and the run that
// exposed this had two fix rounds unspent while two S2s went to the founder.
async function clearBlockers(current, phaseName, tag) {
  let result = current

  while (result && severe(result.bugs).length > 0) {
    const blocking = severe(result.bugs)

    if (fixRounds >= cfg.maxFixRounds) {
      log(`Fix rounds exhausted (${cfg.maxFixRounds} used) with ${blocking.length} S1/S2 still open. Reported to the founder as a failed gate, not rounded up.`)
      break
    }

    fixRounds++
    const n = fixRounds

    await agent(
      `You are the Developer. Fix the blocking bugs QA filed.

${CONTEXT}

Read ${DOCS}/04-qa-report.md for the full repro steps. Fix these, in this order:
${bullets(blocking, function (b) { return `  ${b.id} [${b.severity}] ${b.title}${b.requirement ? ` (${b.requirement})` : ''}` })}

Reproduce each one before fixing it; if you cannot reproduce it, say so explicitly rather
than changing code you never saw fail. Fix causes, not the assertions. Do not refactor
anything outside these fixes — QA's regression baseline depends on it.

Before returning, from ${DIR}: \`npm run lint && npm run build && npm test\` all pass, and
commit: fix(${cfg.slug}): ${tag} fix round ${n}.`,
      { agentType: 'developer', label: `dev:${tag}-fixes-${n}`, phase: phaseName, schema: S_BUILD, effort: EFFORT.fix }
    )

    const recheck = await agent(
      qaPrompt(`Re-verification after developer fix round ${n}. Confirm each bug you filed is actually gone, and that nothing which passed before fails now`, true),
      { agentType: 'qa-engineer', label: `qa:${tag}-verify-${n}`, phase: phaseName, schema: S_QA, effort: EFFORT.qa }
    )

    if (!recheck) {
      log(`Re-verification after fix round ${n} produced no report. Keeping the previous QA result.`)
      break
    }

    result = recheck
    log(`After fix round ${n}: ${result.verdict} — ${result.criteriaPassed}/${result.criteriaTotal} criteria, ${severe(result.bugs).length} S1/S2 open.`)
  }

  return result
}

qa = await agent(qaPrompt('Full verification pass', false), {
  agentType: 'qa-engineer',
  label: 'qa:round-1',
  phase: 'QA',
  schema: S_QA,
  effort: EFFORT.qa,
})

if (qa) {
  log(`QA: ${qa.verdict} — ${qa.criteriaPassed}/${qa.criteriaTotal} criteria, ${severe(qa.bugs).length} S1/S2, ${(qa.bugs || []).length} bugs total.`)
  qa = await clearBlockers(qa, 'QA', 'qa')
} else {
  log('QA produced no report. The customer panel will see whatever was built.')
}

// ---------------------------------------------------------------- 5. Customer panel

phase('Customer Panel')

const personas = (prd.personas || []).slice(0, cfg.judges)

function judgePrompt(p, round) {
  return `You are ${p.name} — ${p.identity}. ${round > 1 ? `You tried this product before and it did not work for you; you have agreed to try the updated version. Do not assume anything was fixed.` : `Someone has handed you a URL and said "try this".`}

Your goal, in your words: ${p.goal}
What you are bringing with you: ${p.input}
What makes you close the tab: ${p.abandonTrigger}

The app: ${URL}
If it is not responding, start it with: ./scripts/serve-product.sh ${cfg.slug}
Work from ${DIR} when running node so Playwright resolves.

You have not read the requirements, the design or the code, and you must not. Do not open
anything under ${DOCS}/ or ${DIR}/src/ or ${DIR}/e2e/. If you get stuck, that is the most
valuable finding you can report — not a reason to look at the implementation.

Drive the real UI in short cycles: script an action, screenshot, look at it, react as
yourself, decide what to do next. Use the actual input you brought. Give up at the point
this persona would genuinely give up, and report that you gave up.

Then append your section to ${DOCS}/05-customer-feedback.md under the heading
"${p.name}${round > 1 ? ` — round ${round}` : ''}" (append; other judges are writing to the same file) and return your
scores. Score against the tool you use today, not against "impressive for an AI build".`
}

let panel = (await parallel(
  personas.map(function (p, i) {
    return function () {
      return agent(judgePrompt(p, 1), {
        agentType: 'customer-judge',
        label: `judge:${p.name}`,
        phase: 'Customer Panel',
        schema: S_JUDGE,
        effort: EFFORT.judge,
      })
    }
  })
)).filter(Boolean)

let score = mean(panel.map(function (j) { return j.overallScore }))
let blockers = blockersOf(panel)
log(`Panel: mean ${score}/10 across ${panel.length} judges, ${blockers.length} blockers. Goal met: ${panel.filter(function (j) { return j.goalMet === 'yes' }).length}/${panel.length}.`)

// ---------------------------------------------------------------- 6. Refinement

phase('Refinement')

let refineRounds = 0

while (refineRounds < cfg.maxRefineRounds && (score < cfg.minScore || blockers.length > 0)) {
  refineRounds++
  log(`Refinement round ${refineRounds}: score ${score} vs target ${cfg.minScore}, ${blockers.length} blockers.`)

  const feedbackDigest = bullets(panel, function (j) {
    return `  ${j.personaName} (${j.overallScore}/10, goal ${j.goalMet}): blockers [${(j.blockers || []).join('; ') || 'none'}] fixes [${(j.topFixes || []).join('; ')}]`
  })

  const triage = await agent(
    `You are the Product Manager. Triage the customer panel's feedback into a ranked change list.

${CONTEXT}

Read ${DOCS}/05-customer-feedback.md in full — the verbatim reactions matter more than the
scores. Summary:
${feedbackDigest}

Rank by (judges affected x severity) / effort. Frequency beats intensity. Fix causes, not
symptoms — if a judge asked for a tooltip, ask why the interface needed explaining. Reject
in writing anything that asks for a different product, with the reason. Every accepted item
states what observable change means it is fixed, so QA can verify it and the judge can
re-run their goal.

Keep it small — this is one round. Append the Ranked fixes table to
${DOCS}/05-customer-feedback.md.`,
    { agentType: 'product-manager', label: `pm:triage-${refineRounds}`, phase: 'Refinement', schema: S_TRIAGE, effort: EFFORT.triage }
  )

  const accepted = (triage && triage.accepted) || []
  if (!accepted.length) {
    log('Triage accepted nothing actionable. Ending refinement.')
    break
  }

  await agent(
    `You are the Developer. Implement the PM's ranked customer fixes, round ${refineRounds}.

${CONTEXT}

Full context in ${DOCS}/05-customer-feedback.md. Implement these, in rank order:
${bullets(accepted, function (a) { return `  ${a.rank}. ${a.fix}\n     fixed means: ${a.fixedMeans}` })}

Stay inside this list — an unasked-for refactor here invalidates QA's regression baseline.
Keep the designer's tokens and the architecture's boundaries intact.

Before returning, from ${DIR}: \`npm run lint && npm run build && npm test\` all pass, and
commit: fix(${cfg.slug}): customer feedback round ${refineRounds}.`,
    { agentType: 'developer', label: `dev:refine-${refineRounds}`, phase: 'Refinement', schema: S_BUILD, effort: EFFORT.fix }
  )

  const regression = await agent(
    `You are the QA Engineer. Regression pass after customer-feedback round ${refineRounds}.

${CONTEXT}

Run the full suite from ${DIR}: \`npm run lint && npm run build && npm test && npm run e2e\`.
Nothing that passed before may fail now — that is the point of this pass.

Then verify each change actually landed as specified, using the "fixed means" wording in
${DOCS}/05-customer-feedback.md:
${bullets(accepted, function (a) { return `  ${a.fix} — fixed means: ${a.fixedMeans}` })}

Append a round section to ${DOCS}/04-qa-report.md. Tests only — never product source.`,
    { agentType: 'qa-engineer', label: `qa:regression-${refineRounds}`, phase: 'Refinement', schema: S_QA, effort: EFFORT.qa }
  )

  if (regression) {
    log(`Regression: ${regression.verdict} — ${severe(regression.bugs).length} S1/S2 open.`)
    // A blocker a customer fix introduced is as serious as one that was always there.
    qa = await clearBlockers(regression, 'Refinement', `refine-${refineRounds}`)
  }

  // Re-judge only the judges who were not satisfied. The rest already voted.
  const unhappy = panel.filter(function (j) { return j.overallScore < cfg.minScore || (j.blockers || []).length > 0 })
  const happy = panel.filter(function (j) { return unhappy.indexOf(j) === -1 })

  const rejudged = (await parallel(
    unhappy.map(function (j) {
      const p = personas.filter(function (x) { return x.id === j.personaId || x.name === j.personaName })[0] || personas[0]
      return function () {
        return agent(judgePrompt(p, refineRounds + 1), {
          agentType: 'customer-judge',
          label: `judge:${p.name}:r${refineRounds + 1}`,
          phase: 'Refinement',
          schema: S_JUDGE,
          effort: EFFORT.judge,
        })
      }
    })
  )).filter(Boolean)

  panel = happy.concat(rejudged)
  score = mean(panel.map(function (j) { return j.overallScore }))
  blockers = blockersOf(panel)
  log(`After round ${refineRounds}: mean ${score}/10, ${blockers.length} blockers.`)
}

const panelGateMet = score >= cfg.minScore && blockers.length === 0
if (!panelGateMet) {
  log(`Panel gate NOT met (${score}/10, ${blockers.length} blockers) after ${refineRounds} refinement round(s). Reported, not hidden.`)
}

// ---------------------------------------------------------------- 7. Sign-off

phase('Sign-off')

const review = await agent(
  `You are the Tech Lead. Review what was actually built against what you designed.

${CONTEXT}

Read the code in ${DIR}/src (and everywhere else it landed) — actually read it, do not
re-read your own architecture document and call that a review. Run the build and tests
yourself from ${DIR}.

Compare against ${DOCS}/02-architecture.md and list every drift, including improvements.
Then find the real bottleneck by looking at the code, with a number attached — it is often
not the one you predicted, and saying so is the most useful thing in this document. Assess
coupling, duplication, swallowed errors, \`any\` escapes, tests that assert nothing, dead
code. Review security: input handling, stored data, injection and XSS surface, dependencies.

Also read ${DOCS}/04-qa-report.md and ${DOCS}/05-customer-feedback.md — what broke and what
confused people tells you where the code is fragile.

Write ${DOCS}/07-architecture-review.md with a GO / GO_WITH_RISK / NO_GO verdict. A GO on
something you would not deploy is a failure of your job.`,
  { agentType: 'tech-lead', label: 'techlead:review', phase: 'Sign-off', schema: S_REVIEW, effort: EFFORT.review }
)

const release = await agent(
  `You are the Release Manager. Write the founder's readiness report.

${CONTEXT}

Read every document in ${DOCS}/. Then verify rather than compile: run
\`npm run lint && npm run build && npm test && npm run e2e\` from ${DIR} yourself and start
the app. If your run disagrees with the QA report, your run is the truth and the
disagreement goes in the report.

Facts of this run, to be reported honestly:
  QA verdict: ${qa ? qa.verdict : 'NO REPORT'}${qa ? ` (${qa.criteriaPassed}/${qa.criteriaTotal} criteria, ${severe(qa.bugs).length} S1/S2 open)` : ''}
  Customer panel: mean ${score}/10 over ${panel.length} judges, ${blockers.length} blockers — gate ${panelGateMet ? 'MET' : 'NOT MET'}
  Fix rounds used: ${fixRounds}/${cfg.maxFixRounds} · Refinement rounds used: ${refineRounds}/${cfg.maxRefineRounds}
  Tech Lead verdict: ${review ? review.verdict : 'NO REVIEW'}
${prd.escalations && prd.escalations.length ? `  Escalations raised at Discovery: ${prd.escalations.join(' | ')}` : ''}

Write ${DOCS}/06-readiness-report.md following docs/agency/templates/06-readiness-report.md.
Lead with how to try it — the command, the URL, and the three steps that show the point of
the product. Every "proven" row cites a command you ran and its real result. Every gap is
specific enough to act on. Do not round the verdict up: an exhausted gate is caveats at best,
and a READY the founder cannot trust costs more than a NOT READY.`,
  { agentType: 'release-manager', label: 'release:report', phase: 'Sign-off', schema: S_RELEASE, effort: EFFORT.release }
)

// ---------------------------------------------------------------- return

log(`Run complete: ${release ? release.verdict : 'NO REPORT'} — ${release ? release.headline : 'the release manager produced no summary'}`)

return {
  slug: cfg.slug,
  dir: DIR,
  url: URL,
  productName: prd.productName,
  oneJob: prd.oneJob,
  verdict: release ? release.verdict : 'NOT_READY',
  headline: release ? release.headline : 'Release report missing — treat as not ready.',
  howToRun: release ? release.howToRun : `./scripts/serve-product.sh ${cfg.slug}`,
  proven: release ? release.proven : [],
  gaps: release ? release.gaps : [],
  nextMoves: release ? release.nextMoves : [],
  qa: qa
    ? { verdict: qa.verdict, criteria: `${qa.criteriaPassed}/${qa.criteriaTotal}`, openSevere: severe(qa.bugs).length, untested: qa.untested || [] }
    : null,
  panel: { meanScore: score, judges: panel.length, blockers: blockers, gateMet: panelGateMet },
  architecture: review ? { verdict: review.verdict, bottleneck: review.bottleneck, scale: review.scale, nextSteps: review.nextSteps } : null,
  rounds: { fix: fixRounds, refine: refineRounds },
  escalations: prd.escalations || [],
  docs: {
    brief: `${DOCS}/00-brief.md`,
    prd: `${DOCS}/01-prd.md`,
    architecture: `${DOCS}/02-architecture.md`,
    design: `${DOCS}/03-design.md`,
    qa: `${DOCS}/04-qa-report.md`,
    feedback: `${DOCS}/05-customer-feedback.md`,
    readiness: `${DOCS}/06-readiness-report.md`,
    review: `${DOCS}/07-architecture-review.md`,
  },
}
