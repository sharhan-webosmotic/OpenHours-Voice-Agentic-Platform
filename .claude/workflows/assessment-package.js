export const meta = {
  name: 'assessment-package',
  description: 'Full technical assessment: 9-agent code analysis, reconciliation, synthesis, and the 4-file client deliverable package',
  whenToUse: 'A discovery or assessment engagement needs its findings produced and turned into client deliverables. Requires an explicit request: this is a large, many-agent run.',
  phases: [
    { title: 'Recon', detail: 'stack, scale, tooling, blockers, incident history' },
    { title: 'Analyse', detail: '9 specialist agents in parallel across every quality dimension' },
    { title: 'Reconcile', detail: 'reachability arbitration, then validate every total' },
    { title: 'Synthesise', detail: 'risk themes, then recommendations, then roadmap' },
    { title: 'Author', detail: 'the four client deliverables' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────
// args (all optional):
//   { repo: "<path>", client: "<name>", platform: "<name>", version: "<x.y.z>",
//     findings: "<path to an existing register>", scope: "<verbatim scope of work>" }
// Supplying `findings` skips the Analyse phase and goes straight to Reconcile.
// ─────────────────────────────────────────────────────────────────────────

const A = args || {}
const REPO = A.repo || '.'
const CLIENT = A.client || 'the client'
const PLATFORM = A.platform || 'the platform'

const METHOD = `
METHOD DISCIPLINE (blocking, applies to every claim you make):
A grep count is NOT a finding. Open every file you cite and confirm the behaviour before reporting it.
On a comparable engagement, SIX repository-wide scans produced results that per-file reading refuted:
an unguarded-route count (35, then 30, actually 13), a database connection leak (none: handles were
named per-domain, not "client"), nine unused dependencies (one: eight loaded via dynamic import),
879 loose equalities (163, and a correct idiom), "no audit entries are written" (false: called four
times inside its own module), and "no content security policy exists" (false: one was defined).
Mark anything you cannot establish as UNCONFIRMED rather than dropping or inflating it.
Report what you CLEAR as well as what you find: a reviewer needs to calibrate the list.
`

const CONTEXT = `Repository: ${REPO}. Platform: ${PLATFORM}. Client: ${CLIENT}.`

const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['dimension', 'findings'],
  properties: {
    dimension: { type: 'string' },
    blockers: { type: 'array', items: { type: 'string' } },
    cleared: {
      type: 'array',
      items: {
        type: 'object',
        required: ['item', 'reason'],
        properties: { item: { type: 'string' }, reason: { type: 'string' } },
      },
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['problem', 'file', 'expected', 'severity', 'confirmed'],
        properties: {
          problem: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'string' },
          expected: { type: 'string' },
          severity: { enum: ['Critical', 'High', 'Medium', 'Low', 'Unknown'] },
          type: { type: 'string' },
          confirmed: { enum: ['Verified', 'Indicated', 'Not Verifiable'] },
          effort: { enum: ['S', 'M', 'L'] },
        },
      },
    },
  },
}

// ── Phase 1: Recon ───────────────────────────────────────────────────────
phase('Recon')
log(`Assessment of ${PLATFORM} for ${CLIENT}`)

const recon = await agent(
  `Recon pass on the repository at ${REPO}, ahead of a full technical assessment.

Establish and report concisely:
1. Language, framework, package manager, and versions from the manifest and lockfile.
2. Scale: total lines by language, and file counts per layer (routes, pages, components, libraries).
3. Database: count distinct CREATE TABLE names in source.
4. Tests: runner, config file, test file count, and total test case count.
5. Existing quality tooling: any sonar config, any CI workflow, and what steps those workflows run.
6. Config surface: type config, lint config, framework config, container and infrastructure files.
7. Repo-supplied context: a CLAUDE.md, README, docs directory, architecture notes, and CRITICALLY any
   incident log, lessons file, or dated defect record.
8. BLOCKERS: what tooling cannot run and why. Typically absent dependencies (no typecheck, lint,
   coverage, dead-code, dependency audit), absent version-control history (no credential-history scan,
   no churn ranking), no runtime access, no database, no cloud console.

If an incident or lessons log exists, list its entries by date and title. That file is the single
highest-value artefact in the repository for this kind of assessment.

Return a compact structured summary. Numbers must be measured, not estimated.`,
  { label: 'recon', phase: 'Recon' }
)

// ── Phase 2: Analyse ─────────────────────────────────────────────────────
let raw = []
if (!A.findings) {
  phase('Analyse')
  log('Dispatching 9 specialist agents in parallel')

  const DIMENSIONS = [
    { key: 'bugs', agentType: 'cq-bugs-reliability', brief: 'Runtime failure: races, resource leaks, null handling, logic errors, incorrect API usage, exception handling, edge cases. Pay particular attention to read-modify-write sequences on money or balances that lack a transaction or lock, and to empty catches around reported business figures.' },
    { key: 'vulns', agentType: 'cq-security-vulns', brief: 'Exploitable security defects. Highest yield is broken access control: for every parameterised route and every list endpoint, check BOTH role and ownership, and always test the omit-the-parameter case on a list endpoint.' },
    { key: 'hotspots', agentType: 'cq-security-hotspots', brief: 'Security-sensitive code needing human judgement. Every hotspot needs an exploitability verdict, and "safe in context, because X" is a valuable answer worth reporting.' },
    { key: 'complexity', agentType: 'cq-complexity', brief: 'Complexity per UNIT, not per file. Include fan-in: the module the most files depend on is the highest-blast-radius code, and if it is also untested that is the key structural finding.' },
    { key: 'duplication', agentType: 'cq-duplication', brief: 'Duplication that matters. The prioritising question is whether the copies have DIVERGED. A fix applied to one copy of a fork and not the other is the highest-value finding in this category.' },
    { key: 'deadcode', agentType: 'cq-dead-code', brief: 'Dead and unused code. Your second job is reachability arbitration: when you prove a subtree unreachable, trace the full chain, because it changes the severity of defects other agents report in those files.' },
    { key: 'tests', agentType: 'cq-test-quality', brief: 'Quality of the tests that EXIST, plus honest coverage facts. Never estimate a coverage percentage. Also trace each entry in any incident log forward into current code and check whether the fix survived and whether a test locks it.' },
    { key: 'config', agentType: 'cq-configuration', brief: 'Build, type, lint, framework, platform, CI/CD, container, secrets, production config. Cross-reference configuration against the project known-issues list: a missing timeout beside a logged timeout bug is a root cause found in minutes.' },
    { key: 'deps', agentType: 'cq-dependencies', brief: 'Dependency surface. Never claim a package is vulnerable without a scan. Never call a dependency unused from a static import scan alone: check dynamic import, require, and config files as consumers.' },
  ]

  const results = await parallel(
    DIMENSIONS.map((d) => () =>
      agent(
        `${d.brief}\n\n${CONTEXT}\n\nRecon findings for context:\n${recon}\n\n${METHOD}`,
        { label: `analyse:${d.key}`, phase: 'Analyse', agentType: d.agentType, schema: FINDINGS_SCHEMA }
      )
    )
  )
  raw = results.filter(Boolean)
  log(`${raw.length} of ${DIMENSIONS.length} dimensions returned`)
} else {
  log(`Skipping analysis: using the existing register at ${A.findings}`)
}

// ── Phase 3: Reconcile ───────────────────────────────────────────────────
phase('Reconcile')

const deadCode = raw.find((r) => r && r.dimension && r.dimension.toLowerCase().includes('dead'))

const arbitration = await agent(
  `Reconciliation pass. You are the lead consultant, and agent output is INPUT, not truth.

${CONTEXT}

Specialist findings:
${JSON.stringify(raw.length ? raw : { note: `see the register at ${A.findings}` })}

Do three things:

1. REACHABILITY ARBITRATION. Where the dead-code pass proved a file or subtree unreachable, downgrade any
   defect other agents reported in it. A critical vulnerability in a component nothing imports is code to
   delete, not a live exposure. On a comparable engagement this correctly downgraded a Critical XSS
   finding. Dead-code result: ${deadCode ? 'available above' : 'not available; note this limitation'}.

2. RE-VERIFY every Critical personally by opening the cited file. Roughly one in ten agent findings does
   not survive this. Reject what does not hold and record the rejection with its reason.

3. RECONCILE any stated totals against the detailed rows. Never trust a summary block: on a comparable
   engagement a workbook's severity block summed to 132 against a stated total of 199, because the block
   was written once and never refreshed as rows were appended. Recompute severity, type, area and status
   from the detail. Check duplicate IDs, sequence gaps, and blank required fields.

Return: the validated finding set with final severities, a list of downgrades with the reachability chain
that justified each, a list of rejections with reasons, and a reconciliation register of every total
checked with stated versus computed values.`,
  { label: 'reconcile', phase: 'Reconcile', agentType: 'ap-data-reconciler' }
)

// ── Phase 4: Synthesise ──────────────────────────────────────────────────
phase('Synthesise')

const risks = await agent(
  `Synthesise risk themes from the validated findings.

${CONTEXT}

Validated findings and reconciliation:
${arbitration}

Produce 8 to 12 risk THEMES, not the top N findings. Group by shared consequence. Each theme states
technical impact and business impact separately and cites its supporting finding IDs.

RANKING RULE: anything currently causing harm WITHOUT an attacker outranks anything requiring one. A
defect silently producing incorrect financial output is a present loss; a vulnerability is a potential
one. Executives read the ordering as a statement of urgency.

Name any CHAIN relationships explicitly, where one finding supplies what another needs.`,
  { label: 'risks', phase: 'Synthesise', agentType: 'ap-risk-synthesist' }
)

const recs = await agent(
  `Convert the validated findings into 20 to 40 actionable recommendations.

${CONTEXT}

Validated findings:
${arbitration}

Risk themes:
${risks}

Severity is NOT priority: let them diverge and show at least two worked examples where they do.
Every Critical and High finding must map to a SPECIFIC recommendation, never a collective bucket.
Prefer converting an existing but unused control into an enforced one over building new capability.
Where a recommendation implies touching hundreds of files, state that it is adoption plus a lint rule for
new code with opportunistic migration, never a campaign.
Flag anything that needs a client DECISION rather than engineering work.`,
  { label: 'recommendations', phase: 'Synthesise', agentType: 'ap-recommendation-architect' }
)

const roadmap = await agent(
  `Sequence the recommendations into an implementation roadmap.

${CONTEXT}

Recommendations:
${recs}

Blockers identified during recon:
${recon}

Order by DEPENDENCY, not severity. Put client-side access grants and architectural decisions in phase
zero, because they block more than any engineering task and cost the client little. Front-load the
enforcement phase ahead of most remediation, because without gates every later fix can silently regress.

Exit criteria must be OBSERVABLE by someone who was not in the engagement.
State whether a development freeze is required, and which phases gate feature work.
Produce a dedicated blockers section ordered by value-to-cost, with the zero-cost ones first.`,
  { label: 'roadmap', phase: 'Synthesise', agentType: 'ap-roadmap-planner' }
)

// ── Phase 5: Author ──────────────────────────────────────────────────────
phase('Author')
log('Synthesis complete. Handing the four deliverables to the main session.')

return {
  platform: PLATFORM,
  client: CLIENT,
  recon,
  reconciliation: arbitration,
  risks,
  recommendations: recs,
  roadmap,
  next: [
    'Load the assessment-package skill and author the four deliverables from the synthesis above.',
    'Build the workbook PROGRAMMATICALLY so every summary is computed and cannot go stale.',
    'Run the Phase 3 validation gate before delivery: totals consistent across all documents, every',
    'Critical and High finding mapped to a specific recommendation, every cited ID resolvable.',
    'Convert to DOCX only after the gate passes.',
  ].join(' '),
}
