# Upgrading claude-skills

## v4.32.0 - Pruning, questions with context, and open what you generate (2026-10-22)

**Pruning (approved removal list, every item verified to have no reader or caller).**
- Hooks removed: `instructions-loaded-log.sh` (log nobody read), `subagent-bookkeeping.sh` (queue nothing drained), `milestone-e2e-gate.sh` (shim to `mavs-gate.sh`), `fast-validate.sh` (advisory JSON nobody read). `log-agent.sh` now handles both SubagentStart and SubagentStop (`log-agent-stop.sh` removed, same log format). The two PostToolUse formatter hooks are one entry that runs Prettier, ESLint, `stylelint --fix` on CSS and `ruff check --fix` on Python, each only when the tool is present, so the per-edit autofix `fast-validate.sh` provided is kept.
- Skills retired: `team-feature`, `team-design` and `team-release` (their gates now run inside `/do`: the multi-layer feature lane in Phase 1 runs PD-SCOPE, SA-ARCH, EL-FEASIBILITY and QA-TEST-COVERAGE once per feature, and Phase 3 runs `engineering-lead` readiness plus `gate-enforcement` Gate 5 on a production release), `list-plugins` (now `install-plugin list`), `import-conventions` (now `share-decision import`), `project-kickoff` (its triage table lives in `session-management`). 101 skills become 95. `upgrade.sh` and `sync-global-skills.sh` retire them in deployed projects and the global mirror.
- Rules merged: `code-rules.md` into `development-rules.md` 1.8.0 (unique sections kept as rules 53 to 83, duplicates of security, testing and ai-safety rules replaced by pointers, component files stay kebab-case), `compliance/secrets.md` into `secrets-patterns.md` 1.1.0 (a Compliance controls section). Eleven skills, three agents and the rule index repointed.
- Docs removed: `docs/skill-relation-map.md` and seven unused `docs/templates/` files. `report-editor` is now dispatched by `assessment-package` 1.2.0 (it existed but nothing called it).

**Questions carry their context.** `/ask` 2.0.0 replaces the bare question with: `Read:` the file and exact place, `Wording:` quoted verbatim, `Conflict:` the baseline requirement or SOW line it collides with and why, one `Question:`, and the recommended answer first with its reason. Never "item 5, keep or replace?". `/do` 6.30.0 uses it for every inline question, `requirement-finalization` 1.3.0 for its Q-NN clarification log, `workscope` 3.1.0 for operator questions and review-note recommendations.

**Recommendations are checked against scope.** `advisor-stance-rules.md` 1.2.0 Rule 9: before recommending an addition, change or removal, check the requirements baseline and say `In scope: R-NNN` with the reason, `Out of scope: not in the baseline. Important because <need>. Goes through /change-request if accepted.`, or `No baseline yet`. `change-request` 2.2.0 takes that label as intake and the client addendum quotes it. Operator-facing only, never in client deliverables.

**Open what you generate.** `document-generation-rules.md` 1.2.0: a DOCX, PDF, PPTX, XLSX or image is not done until the producing skill rendered and looked at it, and the handoff ends with `Opened:` (what was rendered and confirmed), `Found and fixed:` and `Please verify (about N min):` three to five items only the operator can judge. Wired into `docx` 1.10.0, `docx-from-markdown` 3.14.0, `pptx` 1.4.0 (PowerPoint COM slide export), `xlsx` 1.3.0 (Excel COM recalculation and error-cell scan), `pdf` 1.4.0, `markdown-creator` 1.6.0, `image-assets` 1.2.0, `image-generation` 1.2.0, `estimation` 6.2.0 and `workscope` 3.1.0. The Excel and PowerPoint snippets were run on this machine before shipping.

**Migration:** `git pull` inside `.claude/` (verified on a simulated 4.28.0 project before release). `upgrade.sh` moves any retired skill directory left in `skills/` to `AI_DOCS/.temp/retired-skills/` and reports project notes that still name `rules/code-rules.md` or `rules/compliance/secrets.md`. hooks-sync rewrites each project's `hooks` object from the template, so the removed hooks drop out and the merged formatter and `log-agent.sh start|stop` wiring take over. A project that referenced `/team-feature`, `/team-release`, `/list-plugins`, `/import-conventions` or `/project-kickoff` in its own notes should use `/do`, `install-plugin list`, `share-decision import` and `session-management`. `rules/code-rules.md` references become `development-rules.md`.

## v4.31.1 - Model policy: Opus default, Fable only for R&D and security verification (2026-10-22)

`context-efficiency-rules.md` 1.4.0 replaces "Never Fable". Opus is the session default. Fable is allowed for two things, each only after the operator says yes: an R&D-class problem the operator names, and the `deep-security-audit` verifiers (1.1.0 asks before Phase 3, defaulting to Fable on `standard` and `deep`, Opus on `quick`). Fable is passed at dispatch time, never pinned in an agent file, and a refused dispatch falls back to Opus. Context window is not a routing reason: every current model has a 1M window, so Haiku and Sonnet are chosen for price and judgment, not size. Also small wording fixes (`do` 6.29.1, `build` 2.25.1, `skill-test` 1.2.1).

## v4.31.0 - Design knowledge from ui-ux-pro-max, as data that seeds and never decides (2026-10-22)

**Why:** ADF's design skills chose palettes and fonts by hand and had a thin mobile layer. The ui-ux-pro-max dataset (MIT) covers 192 product rules with contrast-checked palettes, 74 font pairings, 119 UX guidelines with good and bad code, 34 landing patterns, 25 chart types and 22 stack guides (Flutter, React Native, SwiftUI, Compose and others). It is not installed as a plugin: its 7 broad triggers would compete with `/do` and the design skills and cost about 700 tokens every session.

**What ships.**
- `vendor/ui-ux-pro-max/` at `623a9a9`: the data plus the four offline search scripts (stdlib only, checked for network and exec calls). The logo, banner and background scripts that call paid image APIs are left out. Font and icon license notices are kept.
- `scripts/design-lookup.sh`: the only entry point. It runs `python -I` from a neutral directory and refuses `--persist`, which would write a `MASTER.md` competing with `design-system/tokens.json`. Tests: `scripts/tests/test-design-lookup.sh` (8 of 8).
- `design-direction` 1.6.0 seeds each mockup's palette, font and style from the dataset and records the seed rows. `design-discovery` 2.8.0 adds a font-pairing step. `landing-page` 1.3.0 and `rules/design/landing-conversion.md` 1.1.0 use pattern IDs. `ui-review` 1.3.0 and `ux-advisor` 1.2.0 may cite UX guideline rows as evidence. `rules/mobile-rules.md` 1.2.0 adds a mobile pre-delivery checklist and per-stack lookups, which `component-inspector` 1.6.0 runs.
- `rules/design-rules.md` 1.9.0 guard rule: the dataset seeds options and never decides. Its generic defaults (glassmorphism, purple "AI" gradients, flat SaaS) need a product reason recorded in `design-dna.md`, and `principal-designer` still gates.

**Updates:** reviewed only, via `bash .claude/scripts/sync-vendor.sh ui-ux-pro-max`. Upstream changes almost daily.

## v4.30.0 - Execution discipline ideas from obra/superpowers (2026-10-22)

**Why:** superpowers (MIT) encodes several disciplines ADF lacked. The plugin itself is not installed: its session-start hook injects a "use a skill before every reply" rule that competes with `/do` and adds about 1.6k tokens per session. Five ideas were ported into ADF's own skills instead.

- **Fix-loop escalation and rulings** (`do` 6.29.0, `build` 2.25.0): the same-builder rounds continue that builder through SendMessage. Exactly one escalated attempt then dispatches a fresh builder one model tier up, with the failure report as a file. After that, the orchestrator writes `Ruling: <decision>, <why>, <cost if wrong>` to the milestone `decisions.md`. Fix diffs get a scoped re-review.
- **Debugging discipline** (`debugger` 1.3.0): one stated hypothesis at a time, the smallest test of it, a failing reproduction test before any fix, and a stop after 3 failed fixes that routes to `solutions-architect` or `/ask`.
- **Review Focus** (`task-planner` 3.3.0, `plan` 2.3.4): up to 5 inputs the spec does not cover that are most likely to break the task, each pinned by a test. Feeds the edge battery.
- **Handoff by file, verified against the diff** (`builder` 1.5.0, `quality-lead` 1.2.0, `context-efficiency-rules` 1.3.0, `testing-rules` 1.13.0): briefs and reports travel as files under `AI_DOCS/.temp/handoff/<task-id>/`. An agent's success claim counts only after the orchestrator checks the diff. Regression tests need a red-green proof (revert the fix and the test fails). The builder verifies each review item against the code before changing anything.
- **Rule pressure tests and transcript retrospective** (`skill-test` 1.2.0 `--pressure`, `retrospective` 1.5.0 Step 1.5).
- `github-ops` 1.5.0: four ways to finish a branch, with a test run on the merged result.

## v4.29.0 - Deep security audit from Cloudflare, offered at the moments that matter (2026-10-22)

**Why:** `/audit` and `team-security` are fast, single-pass reviews. Neither tracks what was covered, and the agent that finds an issue is the one that judges it. The Cloudflare security-audit skill (MIT, the seed of their vulnerability harness) adds a coverage ledger, isolated hunters, adversarial verifiers and schema-validated findings.

**What ships.**
- `vendor/cloudflare-security-audit/`: upstream copied byte for byte at `c1c8a8c`, kept outside `skills/` because its name collides with the `security-audit` skill retired in v4.9.0.
- New skill `deep-security-audit` (SK-169, effort xhigh): the ADF overlay. Hunters, reconnaissance and critics run on the new `sec-hunter` agent (AG-060, Sonnet). Candidate and final-record verification runs on the new `sec-verifier` agent (AG-061, session model). Source-only: ADF has no OS sandbox, so target code never runs and runtime-dependent leads stay `needs_validation`.
- Windows support: upstream validators reject every input on Windows (no `O_NOFOLLOW` in Node). `scripts/patch-win32.cjs` generates `vendor/.../adf-win32/` with an lstat plus fstat-identity fallback, and `sec-validate.sh` picks the right copy. Upstream test suites: 53 pass, 0 fail on Windows.
- Reports with exploit paths stay in gitignored `AI_DOCS/.temp/security-audit/run-N/`. Only `AI_DOCS/audit/security-summary.md` (counts, fingerprints, areas, invariants, fix tasks) is committed.
- `/audit` 2.10.0 check 13: open confirmed critical or high = FAIL, medium or an incomplete run = CONCERNS, stale summary = CONCERNS plus a re-run offer.

**Offered, never forced.** The operator is asked once per HEAD, and every answer is logged in `decision-log.md`:
- `github-ops` 1.4.0: before merges that bring in sensitive files.
- `do` 6.28.0: after a sensitive task or feature, and at milestone close (Step 2.55, before the MAVS gate). Also routes "security audit" and "pen test", and adds `/do security-audit`.
- `ship` 2.3.0 and `deployment-planning` 2.5.0: before the first production release (`standard` profile).
- `assessment-package` 1.1.0: security engagements source their findings register from the deep audit.
- `team-security` 1.2.0 points to it.

**Updates are reviewed, never automatic.** New `scripts/sync-vendor.sh <name>` shows the upstream diff, and `--apply` replaces the copy, re-runs post-apply checks and moves the pin. `sync-global-skills.sh` now mirrors `vendor/` to `~/.claude/vendor` so mirrored skills find their data.

**Cost:** nothing per session. A run costs only on a yes: `quick` is capped at 25 agent calls, `standard` at 70, `deep` needs an operator cap.

**Migration:** `git pull` inside `.claude/`. Node is required for the validators. Confirm `AI_DOCS/.temp/` is gitignored in each project (the skill refuses to write otherwise).

## v4.28.0 - Token cost: the session model plans and validates, cheaper models execute (2026-10-21)

**Why:** most spend came from thinking tokens (billed as full-price output, never cached) and from subagents that all inherited Opus at xhigh effort, not from instruction files. Cached context costs 5 percent of the input price, so trimming files helps mainly on cache misses and in subagents.

**Model policy (reverses the 2026-08-20 "no model tags" decision for mechanical agents only).**
- Haiku: `explorer`, `skill-curator`, and the new project `Explore` override (AG-059), because the built-in Explore runs on the session model.
- Sonnet: `builder`, `test-writer`, `research-lead`, the nine `cq-*` scanners, `ap-data-reconciler`, `api-validator`, `component-inspector`, the ten platform specialists.
- Session model: every lead, Tier-1 authority, reviewer and client-facing writer. Their review validates what a cheaper agent produces.
- Skills never carry `model:` (it rebuilds the main conversation's prompt cache). `run-all-tests.sh` Check 3 enforces this and accepts only haiku or sonnet on agents.
- The markitdown visual pass runs on Sonnet, never Haiku, and the session model re-reads units with `[unreadable]` or with money, dates, limits, quantities or IDs.

**Effort policy.** Recommended user default `effortLevel: high`. `effort: xhigh` on workscope, tech-specification, architecture, estimation, requirement-finalization, gate-enforcement, code-quality-report, assessment-package, do, flow-prototypes and change-request. `effort: medium` on sixteen mechanical skills and on the Sonnet agents, `low` on the Haiku agents.

**Smaller fixed context.**
- `.claude/CLAUDE.md` goes from about 5,200 to 3,300 tokens: the three always-on rule summaries became one pointer, and the full file map moved to `docs/memory-map.md`.
- `CLAUDE.template.md` (the project root CLAUDE.md) goes from about 4,100 to 1,400 tokens and no longer repeats `.claude/CLAUDE.md`. It carries the `/do` commands, the agent and model policy, the hooks, the design standard and the cost guards.
- `rules/README.md` is now path-scoped (about 1,500 tokens off every session).
- Ten internal skill descriptions were trimmed to about 300 characters.
- **`/project-context` no longer writes `@` imports.** Its generated CLAUDE.md imported nine rule files plus the whole `api-contract.md`, `component-registry.md` and `design-dna.md`, and an `@` import loads the full file into every session and every subagent. That bypassed path scoping, and in a mature project the API contract alone can be tens of thousands of tokens per turn. They are now pointers read on demand. **Existing projects keep their old imports until `/project-context` regenerates the root CLAUDE.md**, which is the single biggest saving for an established project.

**Retired skills leave the global mirror.** `scripts/sync-global-skills.sh` refreshed only skills that still exist, so a skill the framework removed (for example `diagram-creator`, retired in v4.24.0) stayed in `~/.claude/skills/` and kept being listed and invoked. The sync now moves every retired WebOsmotic skill to `~/.claude/skills-archive-retired/` (a user's own skill with the same name is left alone). Diagrams come only from the `diagram-design` plugin.

**Discipline.** `context-efficiency-rules.md` 1.2.0 adds Rule 8 (model and effort policy) and Rule 9 (fan-out budget: delegate only large or parallel work, continue agents with SendMessage, one builder per area, /clear between unrelated tasks, no mid-session model switch, measure with /context and /usage). New `scripts/quiet-run.sh` wraps test and build commands, printing failures and summaries only while keeping the full log, and `build` and `builder` use it.

**Operator machine, outside the repo:** a hand-copied, unscoped `~/.claude/rules/` (about 21,000 tokens in every session and subagent) was moved to `~/.claude/rules-archive-2026-10/`. Check your own machine for the same: any unscoped file there loads everywhere.

**Migration:** `git pull` inside `.claude/`. The upgrade flags the project root CLAUDE.md as stale (marker 4.19 vs 4.28): run `/project-context` once to regenerate it from the slimmer template. Set `"effortLevel": "high"` in `~/.claude/settings.json` if it is higher. Measure before and after with `/context` and `/usage` in a fresh session.

## v4.27.0 - Smart scope: MVP first, ballpark quotes, client-problem questions (2026-10-14)

**Why:** every workscope was the full final document, and the estimate had no notion of releases, so "MVP strict, future scope tentative but still priced" could not be expressed.

**Scope strategy (workscope `SCOPE-STRATEGY.md`).** Before anything is written, the requirement is classified and shown to the operator as one decision card with evidence per feature:
- **A. Full quote** when the client asks for all features: one release, all committed.
- **B. Client-defined MVP**: MVP committed and strict, the rest estimated as tentative future phases.
- **C. MVP-first**, the default when the client has not asked for a full quote: the features the client most wants to release or validate first, plus the essentials a first release needs (auth, roles, security, privacy, data integrity, deployment, monitoring), which are never cut to lower the number. The rest becomes Phase 2, Phase 3. Interest signals across documents (repeated, listed first, marked must, emphasized in the newest document, tied to a deadline) are cited.
- The entry number is the honest MVP figure. Future phases are always shown with their tentative cost. A range appears only when the client asked for one.

**Workscope 3.0.0: two versions.**
- **Ballpark quote** (`BALLPARK-TEMPLATE.md`): what we will build per release, one to three diagram-design images, the cost per release, the fixed ballpark note, a one or two line payment note, and client questions. No payment schedule and no technical challenges section.
- **Final workscope**: the full 12-section document, now with releases (committed MVP milestones, priced tentative phases) and the commercial parts of the retired 13-section variant (investment table, Why WebOsmotic, relevant experience, Next Steps, Acceptance). `WORKSCOPE-TEMPLATE-13SECTION.md` is removed. Fixed company copy still comes from `docx-from-markdown/references/workscope-template.md`.
- A 7-question output intake (version, milestones, assumptions, out of scope, future scope, style, Why WebOsmotic) runs once and is saved to `AI_DOCS/planning/workscope-intake.md`.
- **Client-problem question rule:** a question reaches the client only if they can answer it without software knowledge and the answer changes scope, cost or feasibility (which OS the tablets run, whether we get test devices), never our build choices. In a ballpark every technical risk becomes such a question.
- **Conflicts** between documents are never silently picked: a client question naming both sources in a ballpark, resolved with citation or listed open in a final.
- `check_workscope.py --variant ballpark` fails on payment tables, challenge sections or a missing ballpark note, warns on questions naming build technology, and the `--estimate` cross-check works per release.

**Estimation 6.1.0.** Milestones carry `release` and `commitment` (Committed or Tentative). Summary groups milestones by release with separate Committed and Tentative subtotals, future phases get feature-level tentative hours, and the ETA dates committed work first. New checks 13 to 15: tentative hours never enter the committed total, committed features are P0 or P1 or carry a reason, every milestone has a release and commitment. v6.0 files still build (defaults: Full scope, Committed).

**Migration:** `git pull` inside `.claude/`. Existing workscopes without a `variant:` key are treated as final.

## v4.26.0 - Complete document reading: nothing in a source is skipped silently (2026-10-14)

**Why:** plain markitdown conversion lost content with no warning. Tested on probe files: text inside a PowerPoint picture became only `![req.png](Picture2.jpg)`, a shape diagram lost its connecting line, a scanned PDF page converted to an empty string, and a Word image and page header disappeared. The skill also claimed image OCR that does not exist on this machine.

**markitdown 2.0.0: inventory, visual pass, coverage check.**
- `inventory.py` opens the original file and lists every unit (slides, pages, sheets, sections) with its tables, pictures, charts, shape diagrams, SmartArt, notes, headers and footers, comments, footnotes, hidden content, merged ranges and formulas. Units that need visual reading are flagged and rendered to PNG (PowerPoint, Word and Excel through Office COM, PDF pages through pypdfium2, embedded media extracted as a fallback when Office is absent).
- `ingest.py` runs the inventory, adds what conversion drops (headers, footers, comments, footnotes, text boxes, hidden slides and sheets, cell comments, chart titles, connector lines) and places a `VISUAL-PENDING` marker at each flagged unit.
- The visual pass: the model reads each rendered image and writes a `VISUAL` block with every visible word verbatim, diagram relationships (`A -> B` only when an arrowhead exists, `A -- B` for a plain line), chart values, and `[unreadable: ...]` instead of a guess. It runs in subagents of about ten units so images never fill the main session.
- `verify_coverage.py` compares the inventory with the Markdown and prints `COVERAGE: COMPLETE` or `INCOMPLETE` with the gap list. The manifest gains a Coverage column (old rows read `unverified`).

**Wired in:** a source is read only at `COVERAGE: COMPLETE` (CLAUDE.md complete-reading rule). `pptx` 1.3.0, `pdf` 1.3.0, `docx` 1.9.0 and `xlsx` 1.2.0 send reading through the pipeline. `requirement-finalization` 1.2.0 shows Coverage in its source inventory and turns any unread unit into a High-impact Open question.

**Behaviour changes to know about.**
- Ingesting a deck or document with pictures, charts or diagrams now takes a visual pass before it counts as read, about 1,000 to 2,000 tokens per flagged unit on the session model. Text-only documents skip it.
- Without Microsoft Office (Mac, Linux), slides and Word pages cannot be rendered, so a chart-only or shape-only unit is marked unreadable instead of passing silently.

**Migration:** `git pull` inside `.claude/`. Re-ingest any requirement source whose manifest row reads `unverified` before trusting a baseline built from it.

## v4.25.0 - Simple estimation, workscope brought up to the sales edition, requirement readiness (2026-10-14)

**Theme:** the estimate, the workscope and the requirements baseline now answer the playbook questions in order: is the requirement understood, what is in scope, what does each feature cost in hours per role, and is anything being promised that was never estimated.

**Estimation 6.0.0 replaces the v5 workbook.** Five sheets: Summary, Features, Tasks, Recommended, Validation. Hours are typed in one place (Tasks) and everything else is a formula.
- Roles are typed hours, never a percentage: UI/UX, Frontend, Backend, AI, Mobile, DevOps, QA, PM, plus any named extra role. Cross-feature work is a SHARED task, so nothing is counted twice.
- Every feature carries a priority (P0 to P3), a recommendation (Build Now, Build Next, Defer, Skip, Needs Clarification) with its reasoning, a scope status and an estimate status.
- Approved, Proposed, Deferred and Excluded hours are separate labelled numbers. Only Approved is committed. Unestimated work is counted, never treated as zero. Recommended features never add to a total until they become real features.
- No margin, no markup, no buffer. An optional Max Hours per task gives a separate "Upper range (not committed)" line.
- Calendar ETA reads "Pending scheduling inputs" unless a start date and people per role are given, and is then labelled provisional. It is never total hours divided by eight.
- Twelve validation checks run as live formulas (PASS, FAIL, REVIEW).
- An independent estimate review runs before the workbook is built.
- Removed: the dual Developer and AI+Developer track, PERT statistics, the Confidence sheet, calibration priors, `estimate_stats.py`, `update_calibration.py`, `CALIBRATION.md`, `QUESTIONS.md`, `QUESTION-PROTOCOL.md`, `ESTIMATION-METHOD.md`. Past calibration data in `~/.adf/shared/estimation/` is left untouched.

**Workscope 2.9.0 is the sales 2.7.0 edition, ported and merged with the 2.6.0 ZENi5 alignment from main.** Dated milestones from kick-off, a payment table, timeline and flow images from the diagram-design plugin, one **Accepted when:** line per milestone (the checker fails a milestone without one), General Notes plus Assumptions in Section 12 with every open question in a draft review note, and the Section 7 Technology Stack fix. `scripts/check_workscope.py --estimate estimation-v<N>.json` reports every feature the workscope promises that the estimate does not include, and the reverse. Section 6's total cost is the estimate's Approved hours times the rate the operator states, never an assumed rate.

**Requirement-finalization 1.1.0.** Every requirement carries a Basis tag (Verified, Assumption, Open, Proposed). Open questions live in a clarification log with impact, owner role and status. A completeness matrix and a readiness verdict (Ready to scope, Ready with qualified assumptions, Not ready) close the baseline. Workscope, estimation, tech-specification, prd-generation and project-brief read the verdict and the tags.

**Also:** the merge brings in main's progress and ETA output for long-running `/do` actions and the ZENi5 renderer upgrade in `docx-from-markdown` (now 3.13.0). Retrospective records estimate vs actual hours per role in the retro, docx-from-markdown points at the right 12-section template, and references to the v5 estimate are updated across the router, registry, workflow catalog and trigger tests.

**Behaviour changes to know about.**
- An estimate built with v6 will not match a v5 estimate of the same scope: PM, QA and DevOps are now typed hours instead of percentages, and there is no margin.
- The workscope frontmatter carries `closing: "THANK YOU"` and `version: N`. Render with `md_to_docx.py --mode cover --version N`, which writes `workscope.docx` and archives `versions/workscope-v<N>.docx`. A standalone `
ewpage` line starts Sections 4 and 5 on a new page.

**Migration:** `git pull` inside `.claude/`, then restart the Claude Code session. Existing v5 estimation JSON files (schemaVersion 2) do not build with v6: re-run `/estimation` on the scope.

## v4.24.0 - diagram-design is the only diagram generator, installed as an auto-updating plugin (2026-10-14)

**New: the `diagram-design` Claude Code plugin** (cathrynlavery/diagram-design, MIT, by Cathryn Lavery, https://diagramdesign.dev). It draws 45 diagram types (architecture, architecture delta, IT current-state, flowchart, sequence, state machine, ER, swimlane, journey, deployment, dependency, UML class, Gantt, timeline, Sankey, fishbone, Wardley map and more) as self-contained HTML with inline SVG, exports SVG and PNG with `/diagram-design:export-diagram`, and imports Mermaid, draw.io and Excalidraw sources.

**Installed as a plugin, not copied into `skills/`.** `settings.template.json` registers its marketplace under `extraKnownMarketplaces` with `autoUpdate: true` and turns it on under `enabledPlugins`. Claude Code refreshes it in the background after session start, so upstream fixes arrive without an ADF release. `scripts/patch-settings.sh` now merges those two keys entry by entry: a project that already has other plugins keeps them, and a project that disabled diagram-design stays disabled.

**Removed: `diagram-creator` (SK-142).** Its five Pillow archetypes map to diagram-design types in `docx-from-markdown`'s Diagram R&D pass. `docx`, `docx-from-markdown`, `markdown-creator`, `workscope`, `architecture`, `tech-specification` and `skill-router` now point at the plugin. The old name resolves through `docs/skill-deprecations.md`, and `upgrade.sh` flags stale `/diagram-creator` references.

**Mermaid stays the source inside `AI_DOCS/`.** It diffs in review and renders on GitHub. Rendered and client-facing diagrams come from diagram-design, which redraws a Mermaid block with `/diagram-design:import-mermaid`.

**Behaviour changes to know about.**
- PNG export needs Playwright with Chromium in the Python 3.12 interpreter: `python3 -m pip install playwright` and `python3 -m playwright install chromium`. SVG export needs neither.
- The first diagram in a project asks for a brand style. For WebOsmotic documents paste ink `#0F2A43`, accent `#2E75B6`, paper `#FFFFFF` and save the profile as `webosmotic`.
- DOCX embeds use the `slide-4x3` preset. At the 7.4in embed width its node names land near 8pt, below the 10pt floor the Pillow canvas could reach, so keep embedded diagrams to six nodes with short names and check step 7's render.
- Claude Code honors the plugin keys in a project's `.claude/settings.json` only after the folder is trusted.

**Migration:** `git pull` inside `.claude/`, then restart the Claude Code session. The version bump runs the upgrade, which adds the two plugin keys to `settings.json`. Claude Code then offers to install the plugin, or run `/plugin install diagram-design@diagram-design`.

## v4.23.0 - Vue specialist, and Vue files get the frontend checks (2026-10-05)

**New agent: `vue-specialist`** (AG-058, Tier 3 platform specialist). It covers Vue 3 and Nuxt 3: the Composition API and `<script setup>`, reactivity pitfalls (destructured `reactive()` and stores, mutated props, `watch` used where `computed` belongs), Pinia, Vue Router, and Nuxt rendering modes, `useFetch`/`useAsyncData` and hydration. Vue was already a supported frontend in `templates/stack.md`, `workscope` and `design-discovery`, but no specialist could review it.

**Wired in everywhere the other platform specialists are.** `engineering-lead` routing table, `frontend-lead` (which now picks the specialist from `stack.md`, and gains the Angular specialist it was also missing), `team-design`, `team-feature`, `project-stage-detect`, the skill and agent registries, the relation and coordination maps, the decision tree, and the agent counts (48).

**Vue files are checked like React files.** `.vue` was invisible to most of the frontend tooling. The frontend, UI-engineering and component-reuse rules now load for `**/*.vue`. The Prettier and ESLint PostToolUse hooks and `fast-validate.sh` now run on `.vue` files (ESLint needs `eslint-plugin-vue` in the project, as for any Vue setup).

**Migration:** `git pull` inside `.claude/`, then restart the Claude Code session. The version bump runs the upgrade, which re-syncs the hook wiring.

## v4.22.1 - Full audit: an install that works, gates that fire, upgrades that reach existing projects (2026-10-05)

**Theme:** a full check of the framework from install to enforcement. Every defect was reproduced in a sandbox before it was fixed and re-run after. Three classes came out: the install and upgrade path failed on common machines, several blocking gates failed open or never armed, and fixes did not reliably reach projects that were already installed.

**Install works on a stock machine.** `setup.ps1` failed to parse under Windows PowerShell 5.1 (a UTF-8 dash inside a string), so the documented Windows command did nothing. `setup.sh` exited silently when no Python was on PATH or when Python lacked sqlite3, recreated the deprecated `AI_DOCS/plans/` on every re-run, and reported a state database it had not created. It now creates `.claude-project-id`, initialises the state database from the project root, scaffolds `AI_DOCS/review-mode.txt`, and stamps the framework version into the project `CLAUDE.md`. A clone at `~/.claude` is recognised as a user-level install: `setup.sh` and `upgrade.sh` no longer treat the home directory as a project.

**Upgrades reach existing projects and stop breaking pulls.** Hook-driven upgrade runs no longer edit tracked `SKILL.md` files: the frontmatter retrofit dirtied every consumer clone whenever a release shipped an unstamped skill, and the next pull aborted. A pull without a version bump skipped the global skills mirror. `hooks/git/post-merge` and the other scripts are now committed executable, so the upgrade fires on macOS and Linux. The session-start timebox was shorter than a full migration (30 s against about 40 s on Windows) and is now 120 s. The pre-commit wrapper blocked every commit inside a linked git worktree and is rewritten on upgrade. Existing projects receive a project id and state database. `scripts/patch-settings.sh` now makes the `hooks` object equal to the template, so a re-run of `setup.sh` cannot leave an old command next to its corrected version. Plugin hooks register in `settings.local.json`, which upgrades never touch. `sync-global-skills.sh` and `retrofit-frontmatter.sh` run on bash 3.2.

**The gates fire on real commands.** Without `jq`, `hooks/json-field.sh` cut a command at its first quote, so `cd "<path>" && git reset --hard`, a quoted `git merge`, and a quoted nested `AI_DOCS` path all passed their gates. The api-contract lock looked for a row no skill writes and never armed. Chunk scope read a doubled path and never enforced. The anchor and chunk-scope gates disabled themselves for good after three ordinary runs on Windows (a 50 ms budget, now 5000 ms). Gate status was a substring match, so `Gate 1 | FAILED | not LOCKED yet` passed Gate 1. The new `hooks/gate-status-read.sh` reads the gate's own row or line and its status position, and accepts the shapes projects already use. GIT-SAFETY missed `git restore <file>`, `git checkout .`, `git clean -xdf` and `git -C dir reset --hard`, and blocked `git rebase --abort`. Hook commands now run from the project root (`CLAUDE_PROJECT_DIR`), because a changed working directory turned every gate into a silent allow. Edits inside `.claude/worktrees/` (the builder agent) are gated against the main checkout. `session-start.sh` could run `git pull` on the user's project when `.claude` was not its own clone.

**The documented opt-out works.** An `export ADF_BYPASS=on` in a Bash call never reached the hook. A `## Bypass` entry dated today in `decision-log.md` is now sufficient on its own, and a later `## Resume framework` entry closes it.

**Logging, scanning and lifecycle.** The pre-commit scanner never detected private keys (the pattern began with a dash and grep read it as an option). `scrub.sh` let `password=`, `sk_live_`, `github_pat_` and AWS secret keys through to the logs. On macOS and Linux the scrubber and telemetry helpers were skipped entirely because they are called only when executable: they are now run with `bash`. `pre-compact.sh` died on a missing `session-state.md` and wrote no snapshot. `Stop` fires after every response, so the read log was wiped each turn and `session-end.sh` ran each turn: the cleanup moved to SessionStart and `session-end.sh` to the `SessionEnd` event. Drift Phase I reported six false findings on every fresh project. `fast-validate.sh` wrote PASS for files it never checked, and its typecheck is now timeboxed (`ADF_FAST_VALIDATE_TSC_SECONDS`, default 20, 0 turns it off).

**Skills and docs.** Three skills had invalid YAML frontmatter. Eighteen skills depended on skills that no longer exist. `project-types` now writes the classification file that six skills read and nothing wrote. `docs/workflow-catalog.yaml` pointed at v3 paths, so stage detection reported existing artifacts as missing. `README.md` and `skills/README.md` are rewritten against the code.

**Behaviour changes to know about.**
- `git push` is now in the template's `ask` list, as `rules/ops-safety-rules.md` requires. Claude asks before every push.
- The api-contract lock now arms when Gate 1 is recorded `LOCKED`. `/change-request` lifts it with a `| api-contract.md lock | CR-<NNN> | LIFTED |` row in `gate-status.md` and restores it in the same commit.
- A gate counts as passed only when its own row or line says PASSED, PASS or APPROVED (or LOCKED for Gate 1). A project that passed only through a stray word elsewhere on the line is blocked until the row is corrected.
- The pre-commit scanner now blocks PEM headers, `ASIA` and `ghs_` keys, `sk_live_`, `github_pat_`, AWS secret keys and amqp URLs with credentials. A dummy key in a test fixture needs a clearly fake value.
- Maintainers: the frontmatter retrofit no longer runs on pull. Run `bash skill-lab/retrofit-frontmatter.sh --apply` before a release, or pull with `ADF_MAINTAINER=1`.
- A seeded `AI_DOCS/quality/control-registry.md` reports the flow gate and the MAVS gate as changed since their last proof. Re-run the two tests and update the two dates. Phase I is advisory.

**Migration:** `git pull` inside `.claude/`. The post-merge hook runs the upgrade, which resets the `hooks` object of `settings.json` to the new template (with a backup). If the upgrade banner does not print, run `bash .claude/upgrade.sh` once. Restart the Claude Code session afterwards so the new hooks load. The `SessionEnd` event needs a current Claude Code.

## v4.22.0 - The workscope pipeline rebuilt against the workscopes we actually send (2026-08-26)

**Theme:** a full pass over `workscope` -> `markdown-creator` -> `diagram-creator` -> `docx-from-markdown`, driven by reading the five delivered WebOsmotic workscopes (Resolve IQ, QRSound, Progress Dialog, Meeting Bot, Nichiren) rather than reasoning from the generic proposal skeleton. The template now matches what clients receive, and a class of formatting defects that survived every XML assertion is fixed at the converter.

**The structure follows the delivered documents.** `WORKSCOPE-TEMPLATE.md` is rebuilt around 12 sections: Overview, User Roles and Features, Features Breakdown, Flow Plan, Milestones, Milestone and Payment, Technology Stack, Deliverables, Out of Scope, Future Scope, Client Responsibilities, Questions and Concerns. The old 13-section commercial-proposal shape is preserved at `WORKSCOPE-TEMPLATE-13SECTION.md` and offered on request. New `REFERENCE-LIBRARY.md` records the five source documents, what pattern each one establishes, and the reading technique: a Google Doc `/edit` URL renders to a canvas that returns no body text and 401s under WebFetch, so use the `/mobilebasic` view.

**Out of Scope and Future Scope are now different things.** Out of Scope carries only what WebOsmotic never does on any engagement (compliance certification and audit, all platform and infrastructure fees, domain and account purchase, legal drafting) in five to nine bullets plus a catch-all. Everything the client wants but this phase defers moves to Future Scope, closed with the fixed sentence that those items are not planned, not estimated, and not covered, and that a separate scope must be agreed first. The test: would we ever do this for them? Never means Out of Scope, just not now means Future Scope.

**Questions and Concerns replaces General Notes and the assumptions table.** A recommendation the requirement does not state (an accessibility target, a compliance posture, a security control) is presented as a Concern awaiting the client's agreement rather than asserted in the document's own voice. A final block of assumptions-that-change-the-estimate is kept deliberately, because a pure question list loses the commercial protection a stated assumption gives.

**Milestones carry a timeline and features, nothing else.** The narrative "by the end of this milestone" paragraph is removed: it restated Features Breakdown and is where a scope document starts contradicting itself. Lanes are level-0 bullets with work items as sub-bullets, one nested list per lane, replacing the bold-paragraph-plus-flat-list form that put label and items at the same level. Deliverables split by codebase component with a purpose line each. Flow Plan is image-led: a diagram plus a summary paragraph, no numbered steps.

**Six converter defects, each invisible to the XML checks and obvious in a render.** (1) A numbered list restarted at 1 under every themed sub-heading, so "question 3" named three different questions: a lane label between two numbered groups no longer ends the list. (2) `1. ### Heading` inside a list emitted literal `###` characters. (3) The master's bullet definition uses Courier lowercase `o` at level 1, which reads as the letter, and its decimal definition has an empty `lvlText` at levels 1 and 2 so a nested numbered item rendered unnumbered: both normalised. (4) The hanging indent doubles as the marker-to-text tab stop and is now per format, 0.15in for bullets and 0.25in for decimals, because one value cannot serve both and 288 twips left `10.Text` jammed together. (5) Table columns are sized from content length instead of split evenly, so a one-word Status column stops forcing its prose neighbours into four-line rows. (6) `arrow()` drew the shaft to the tip and painted the head over it, so a thick shaft bulged past the head.

**Visual verification is now a mandatory workflow step.** Every defect above passed the XML assertions. `docx-from-markdown` step 7 renders DOCX to PDF via Word COM and PDF to PNG via PyMuPDF, and requires reading the pages. `diagram-creator` gains the matching rules: a badge inside a rounded box must be inset past the corner radius, an annotation gutter is sized from its widest line before the body claims the space, a right-edge bleed check catches silently cropped text, and the canvas width is chosen against the 7.4in embed so the font floor is derived rather than guessed (a 1560px canvas puts 19px body text at 6.5pt on the page).

**Also:** body paragraphs are justified, the cover gains 24px above the title and carries people's names on both sides, and the cover date is written in human form because the converter passes it through verbatim.

## v4.21.0 - Impeccable adopted: a deterministic design detector and fix engine under /do (2026-08-21)

**Theme:** the operator adopted Impeccable v4.1.1 (pbakaus/impeccable, Apache 2.0, the design-quality toolkit by Paul Bakaus: 23 design commands plus a deterministic 59-rule anti-pattern detector) into the framework, installed at `skills/impeccable/` via `npx impeccable install`. Integration doctrine, wired across 12 files:

- **Vendored, never edited.** The skill folder is upstream-owned, updated only via `npx impeccable update`, deliberately absent from catalog.yaml so upgrade.sh treats it as EXTERNAL. docs/skill-registry.md carries the external-vendored-skills note.
- **Fix engine, not verdict.** ADF's DSC checklist and `mavs/visual.json` remain the verdict of record. /do (6.26.2) dispatches `polish` as the pre-visual-QA fix pass on UI tasks and `harden` at milestone close, so fixes land before the judgment. `live` and `shape` stay dormant unless the operator asks (they overlap /design-direction).
- **A new mechanical lane.** `npx impeccable detect --json` (deterministic, no LLM, exit codes 0/2/1) runs on changed UI files in /build's Exercise gate and over the full web source at milestone close, writing `mavs/slop.json` in the incremental tasks-array shape. Advisory pilot: top-level status ADVISORY so mavs-gate never blocks, promotion later is a status-rule flip plus a required.txt line.
- **Context derived, never re-interviewed.** design-tokens 1.10.1 derives DESIGN.md and `.impeccable/design.json` from the locked tokens.json via `/impeccable document` (tokens stay the source of truth, and this activates the detector's four design-system rules). design-discovery 2.7.1 generates PRODUCT.md from design-dna.md, project-context.md, and ux-brief.md instead of running Impeccable's interview, so two interviews cannot drift.
- **Routing preserved.** UI requests still route through /do (Activation Map row in templates/active-skills.md, CLAUDE.template line, decision-tree disambiguation: "impeccable audit" is a UI technical audit, /audit remains security and pre-ship). Impeccable's own per-edit hooks stay OFF, detection runs once per task at verify time instead. Consumer gitignores gain `.impeccable/config.local.json` and `.impeccable/hook.ndjson` via setup.sh and upgrade.sh.

## v4.20.1 - Hardening: the v4.20.0 enforcement points now provably fire (2026-08-21)

**Theme:** a five-pass adversarial revalidation of v4.20.0 (chain traces, subsystem verification, a read-based phrasing triage, and a repo-wide contradiction hunt) found the release's paperwork consistent while its two new enforcement points never executed: the same controls-that-never-fire disease v4.19.0 was written against. Full findings: PLAN-v4.20-hardening.md.

**The flow gate now fires, with proof.** All four new hook wirings in settings.template.json used a bare `hooks/` path that exits 127 in every deployed project: rewritten to the house `.claude/hooks/` fail-open pattern. `enforce-flow-gate.sh` rewritten (v2) fixing four logic defects: it now collects EVERY DOING row across the ledger and all milestone capsules (the ledger's tagless summary row can no longer short-circuit past the capsule tags), parses the Status CELL by pipe column so a flow named "Approved vendor onboarding" cannot fool it, anchors the tag regex so `workflow:` and `overflow:` cannot trigger it, and scopes both bypass variables (ADF_FLOW_GATE_BYPASS and ADF_BYPASS) to a same-UTC-day decision-log entry. A committed proving-it-fires test (`hooks/tests/enforce-flow-gate.test.sh`, 12 assertions, both directions, regressing each audited defect) passes, and the control-registry row carries the proof date. setup.sh and upgrade.sh now scaffold `AI_DOCS/quality/control-registry.md` into projects (previously nothing did, so drift-detector Phase I silently never ran), and the registry template's seed row no longer contains the pipe characters that broke Phase I's own parser.

**The visual lane now judges instead of silently skipping.** Nothing scaffolded the design-standards checklist, so every new project's visual QA degraded to SKIP forever while required.txt stayed satisfied. design-tokens 1.10.0 scaffolds it at Gate 3 (seed rows DSC-01 to DSC-14 plus project rows from the DNA), and /build's visual-QA step gains a backstop: a web non-POC project with no checklist at the first UI task scaffolds it and proceeds, SKIP remains only for POC and non-web. The incremental `mavs/visual.json` shape is now defined precisely (envelope plus a tasks array, worst-of top-level status, atomic whole-object rewrite, never text-append), closing the trap where a naive append produced unreadable JSON that mavs-gate hard-blocks.

**ui-review tells one truth everywhere.** The three FAIL triggers (confirmed functional defect, BLOCKING checklist row with DSC id, approved-journey deviation) now appear identically in its description, body, catalog note, /do step 2.65, and testing-rules Rule 32, replacing four surviving functional-only or advisory-never-blocks statements. mavs-gate exempts ADVISORY-status reports from the STALE block (proven against fixtures: stale ADVISORY allows, stale PASS still blocks, present FAIL still blocks), so an aesthetics-only report can no longer block a merge on being old.

**Model doctrine fully purged and Gate FLOW registered.** Five surviving model-tier prescriptions removed (CLAUDE.template's routing paragraph that shipped into every project, the authoring-guide checklist requiring `model`, skill-improve's add-a-model remedy, two Haiku parentheticals), REGISTRY's model column stripped, run-all-tests already warning on presence. Gate FLOW now exists in every registry surface: governance-gates catalog, both CLAUDE files, README, DEVELOPER, the hook family and escapes lists, with counts corrected to 101 skills and 47 agents and 47 hooks. design-screens 1.9.0 consumes approved journeys as the flow source for Tier F flows instead of re-authoring them, flow-prototypes 1.0.1 writes the canonical `Gate FLOW <flow-id>: PASS` and the previously unproduced WAIVED line, owns the late-promotion retro-tag, and the phantom estimation consumer claim is gone from both it and memory-protocol.

**Phrasing residue applied.** The read-based triage verdict on the v4.20.0 positive-direction pass: roughly 4 percent genuine residue. The 13 drafted conversions landed (6 in nextjs-rules, which also got the full em-dash sweep the pass missed, 2 in code-reviewer, 2 in frontend-rules which also fixed its duplicate rule number as 24b, plus engineering-lead, builder, estimation, design-tokens, ui-review). Hygiene riders: the 8-copy `_project_temp_dir` helper falls back to system temp on mkdir failure instead of crashing, `.temp/logs` is scaffolded, the code-rules error envelope gains its `success: false` wrapper, e2e-testing's Python pattern snippets are marked pseudocode with the canonical TypeScript runner named, rules/README indexes multi-path-rules, multi-path's ambiguity margin is defined once (top-two gap of 1 point or less, or any judge split), and the redundant permission allows are gone.

## v4.20.0 - Journeys approved before code, verification as committed tests, the orchestrator-only session (2026-08-20)

**Theme:** a full-repo audit against Anthropic's published guidance (the skills guide, 33 official docs pages, the prompt-engineering blog, and the how-we-claude-code workshop) plus direct operator field findings. The operator's headline number: task achievement and testing rated 80-85 percent while UIUX journeys rated 30 percent, because no journey was ever clickable before implementation. This release closes that gap and lands the alignment repairs. Plan documents: PLAN-official-alignment.md, PLAN-flow-validation.md, PLAN-testing-matrix.md, PLAN-execution-speed.md.

**The Flow Validation Gate.** New skill `flow-prototypes` (SK-168): Phase 0 triages every feature into Tier S (standard pipeline) or Tier F (3 or more screens in sequence, multiple roles, branching outcomes, user-visible business logic, state machines, cross-entity relations), the operator confirms the tiering as a checklist and the answers persist in `AI_DOCS/design/flow-validation-plan.md`. Each Tier F flow gets 3 clickable HTML journey variants (different interaction models from the new `rules/multi-path-rules.md` lens catalog), judged by ux-advisor plus principal-designer against the ux-brief, the operator picks, and Gate FLOW PASS lands in gate-status.md. Implementation tasks carry a `flow: <flow-id>` tag (milestone-planning) and `hooks/enforce-flow-gate.sh` blocks app-code edits for an unapproved flow (recorded-override escape ADF_FLOW_GATE_BYPASS). The approved variant becomes the fidelity reference and the ui-review click-path contract.

**Multi-path exploration.** `rules/multi-path-rules.md`: at wide-solution-space decision points (Tier F flows, ADR-class architecture, contested implementation designs), 4 parallel candidates under named lenses, domain-judge ranking, operator decides ambiguity, everything recorded. Never fans out on single-answer work.

**Verification as committed tests (testing-rules 1.10.0, rules 33-38).** From operator field evidence of generate-probe-then-delete scripts, AppData log files, and `until grep passed; sleep 20` polling: API, UIUX, and flow verification materializes as committed tests wired into the canonical scripts, verdicts come from the runner's parsed JSON and exit code never a log-tail grep, Playwright's `webServer` (now in the scaffolded config template) owns the dev-server lifecycle, long runs use harness background mode and Monitor instead of sleep loops, and service logs live in `AI_DOCS/.temp/logs/` for diagnosis only.

**Per-task visual QA (the testing matrix).** New canonical checklist `templates/design-standards-checklist.md` (DSC-01 through DSC-14, every row traced to an existing rule, severity per the source rule's own status). `/build`'s Exercise gate (2.23.0) captures 375/768/1440 screenshots in its existing browser session, component-inspector settles mechanical rows and principal-designer judges visual rows, a BLOCKING violation keeps the task DOING, results land in `mavs/visual.json` (new schema entry, required for web frontends, consolidated at milestone close by milestone-validation 1.12.0 and e2e-testing 1.9.0). ui-review 1.2.0 now writes FAIL on a confirmed BLOCKING checklist violation or a deviation from an approved journey.

**The orchestrator-only session and speed.** context-efficiency-rules Rule 7: the main session routes, dispatches, gates, and converses, everything read-heavy or edit-heavy runs in subagents. /do 6.26.0: flow triage dispatch, the flow gate check, next-task Brief prefetch during review, scope validation and code review dispatched in parallel and joined before stamping, verify-battery early checks concurrent, unattended milestone stretches under /goal with a turn bound. builder 1.3.0 uses platform `isolation: worktree` (bash worktree management retired) with a `.worktreeinclude` template. New hooks: subagent-bookkeeping.sh (SubagentStop queue so ledger writes leave the main loop), instructions-loaded-log.sh (runtime evidence of which rule files actually loaded, feeds control-registry reconciliation), post-compact-pointer.sh (re-anchors the active milestone after compaction and states that paths-scoped rules are not reloaded until a matching Read). session-state-refresher nudges delegation when the session grinds inline.

**Model policy.** Operator decision: every agent and skill inherits the model set in the Claude CLI's default settings. All `model:` frontmatter removed from the 47 agents, `preferred_model:` hints removed from skills, run-all-tests.sh now treats a present model tag as the warning, docs updated to state the inheritance policy. Isolation and context protection, not price tiers, are why subagents exist.

**Scratch and permissions.** New convention `AI_DOCS/.temp/` (gitignored, synced into existing projects by upgrade.sh): 8 docx-pipeline scripts redirect their temp artifacts there via a project-root-resolving helper, diagram-creator and pptx write intermediates there, setup.sh scaffolds it. settings.template.json gains narrowly-scoped allows so framework scripts, canonical test commands, and `.temp` cleanups run without permission prompts (broad `rm` stays on ask by design).

**Positive-direction phrasing pass.** Per the prompt-engineering guidance (state what to do with the reason, reserve bare prohibitions for mechanically enforced or safety-critical boundaries): roughly 70 style-tier rewrites across 8 rule files, 12 skills, and 11 agents, with every hard gate, threshold, rule ID, and verdict format kept verbatim. document-generation-rules gains Rule 9 (Positive-direction authoring) and the skill-authoring guide teaches it plus the 1,536-character description truncation budget. Tier-3 specialist persona openers thinned to one sentence.

**Registry and repair (from PLAN-official-alignment P0).** assessment-package, client-report-editing, code-quality-report registered as SK-165 to SK-167 with trigger specs (they previously mirrored as EXTERNAL and never reached `~/.claude/skills`), all 47 agents now have catalog rows and full frontmatter (AG-044 to AG-057 assigned, 8 v5-era rows backfilled). The docx skill's four missing validator modules vendored from the upstream anthropics/skills repo (plus helper merge and a dead `author` parameter removed), assessment-package's README moved to references/OVERVIEW.md, task-planner's description de-angle-bracketed, build/SKILL.md split to 2,557 words via VERIFY-BATTERY.md, codebase-migration modernized off the deprecated task.md schema, version markers and retired names refreshed across CLAUDE.md, DEVELOPER.md, README, and the three stale skill-map docs, five hooks gained shell-safety headers, and self-disabled chunk-scope or anchors gates now surface in the session banner.

## v4.19.0 - Controls must prove they fire (2026-08-18, renumbered 2026-08-20)

> Numbering note: this release was originally stamped v4.16.0 from a second checkout that
> had not pulled the 2026-08-06 releases below. v4.16.0 through v4.18.0 were already taken,
> so this entry was renumbered to v4.19.0 on 2026-08-20 when the two lines were reconciled.
> The rule-file versions it introduced were renumbered the same way: testing-rules.md's
> Control Verification line is 1.9.0 (was stamped 1.8.0) and frontend-rules.md's Rules 62-63
> line is 1.8.0 (was stamped 1.5.0).

**Theme:** one project recorded, nine separate times, a control that its own documentation described as active and enforcing while the control had never once executed. Every previous remedy hardened a control's LOGIC. None proved a control FIRES. This release adds the missing mechanism.

**Control verification (`rules/testing-rules.md` 1.9.0).** Any code whose job is to enforce, block, gate, lock, or refuse ships with a proving-it-fires test, distinct from its unit test, that drives the control from OUTSIDE through its real trigger with a known-bad input and asserts it BLOCKS. Both directions or it does not count: a test proving only that a control allows good input cannot distinguish "enforcing" from "absent". **Scope is load-bearing and non-retroactive:** it applies when a control is authored or materially changed, NOT to every pre-existing hook and guard in an existing project. Read as retroactive it would fail every project's existing controls on the next audit.

**Control registry (`templates/control-registry.md`, new).** One row per enforcing control: name, trigger, the file that wires it, the file that implements it, and the date its firing was last proven. `hooks/drift-detector.sh` gains **Phase I** to reconcile it and surface three things nobody notices unaided: a wiring file that no longer references its control (the shape that hid a dead lock hook for sixteen days while the status file claimed it verified), a proof older than the control's own mtime, and a control never proven at all. Advisory, never blocking.

**Milestone source drift (drift-detector Phase J).** A milestone planned against a 28-row findings document stayed green on every gate while the document grew to 50, because every gate compares the plan against the CODE and none compares it against its SOURCE. Capsules that cite an external document now record `Source fingerprint: <path> · <N> items · <date>` (`templates/milestone-capsule.md`), and Phase J re-checks it.

**Fixed while adding the above: drift-detector Phase H silently dropped every finding it produced.** `rbuf()` appends to a shell variable and the phase piped into a `while` loop, which bash runs in a SUBSHELL, so every bullet was written to a copy and discarded. The section header still printed and the finding still counted, which is exactly why it read as working. Phases H, I, and J now use a here-string.

**Uncommitted-work check rewritten (`hooks/uncommitted-work-check.sh`, new; replaces the inline Stop one-liner).** The old control ran `git diff AI_DOCS/`, so it watched the documentation directory and nothing else. A whole milestone of finished application code sat uncommitted on the production branch with no restore point and it said nothing. Now: whole working tree, escalating by size, escalating unconditionally when migrations or schema files are involved, plus a milestone-branch mismatch note gated on the project actually declaring a per-milestone strategy (silent for trunk-based and Kanban).

**New rules from field findings.** `api-rules.md` 1.3.0 Rule 29: a change to an entity's deletion semantics invalidates every guard keyed on that entity's existence, and both sides' tests keep passing because only the interaction is broken. `frontend-rules.md` 1.8.0 Rules 62-63: a permission-scoped name resolver renders name, pending, or hidden and never an id (an id fallback turns a 403 into what looks like corrupt data), and a control renders only in the views it actually drives. `code-rules.md` 1.6.0: user-sortable text columns declare an explicit, consistent collation, forward-looking only, NOT a mandate to re-migrate existing columns. `component-reuse-rules.md` 1.1.0 Rules 38-39: utility helpers are shared from their SECOND use, after a formatter was found defined seven times with six identical copies and one silently divergent.

**`code-reviewer` 1.7.0** gains five smells: silent field removal without a reader inventory, inert shared control, id as a display fallback, copy-pasted private helper, and a guard counting a changed lifecycle.

**Skills.** `requirement-finalization` gains Phase 0 steps 4a (capture expiring sources BEFORE planning against them) and 4b (declare precedence when two documents describe the same requirement, and record what the non-authoritative one uniquely contributes, usually the reproduction detail and sometimes the root cause). `debugger` gains canvas-rendered target guidance: detect it, then read by screenshot and region zoom, and never trust a text extraction from such a page including an empty one.

**Existing projects, what to expect on the next pull.** `frontend-rules.md` Rules 62-63 are additions to an already-BLOCKING section: a project with an id-fallback name resolver or an inert shared filter will newly surface findings the next time those screens are touched or fully audited. That is the intent, but it is a genuine change, not a free upgrade. Everything else in this release is additive or advisory.
## v4.18.0 - Structural pass: rules load on demand for real, skills slimmed, constants single-sourced (2026-08-06)

**Theme:** an audit against Anthropic's published Claude Code guidance found the framework's biggest silent defect: "on-demand rule loading" was prose, not mechanics. Claude Code autoloads every UNSCOPED `.claude/rules/*.md` (subfolders included) at session start, so every ADF project began every session carrying ~25 full rule files (HIPAA checklists during unrelated work). This release makes the tier design mechanical.

**Rules load on demand (the red item).** All ~55 rule files (including `compliance/*` and `design/*`) now carry `paths:` YAML frontmatter and load only when a matching file is touched or a skill Reads them explicitly. Three files had a `globs:` key, which the harness ignores: renamed to `paths:`. Exactly six stay always-on by design: writing-style, advisor-stance, response-markers, ops-safety, context-efficiency, and the rules index. `rules/README.md` gains "How loading actually works" and the discipline that a NEW rule file MUST declare `paths:`. Both CLAUDE files updated to state the mechanical policy. Known follow-up: the user-global `~/.claude/rules/` duplicates still autoload and deserve the same pruning (outside this repo).

**Skills slimmed (progressive disclosure).** `docx` 684 -> 212 lines (v1.6.0, four new reference files), `prd-generation` 641 -> 417 (v2.3.0), `workscope` 600 -> 346 (v2.1.0, the mandated 12-section client template moved INTACT to `WORKSCOPE-TEMPLATE.md` with a MANDATORY pointer). Nothing deleted, reference blocks moved to supporting files that load only when read. `estimation` (1507) and `do` (757) deliberately deferred: both are load-bearing and recently reworked, split them in a dedicated pass.

**Stack skills stop restating rules.** `python-testing` 1.8.0, `go-testing` 1.4.0, `python-ai-services` 1.3.0 replace duplicated rule content (coverage floors, naming mandates, isolation and race-detector rules) with pointers to `rules/python-rules.md` / `go-rules.md` / `testing-rules.md`, keeping only their procedures. Kills the drift class where a rule changes and its skill copies do not.

**Constants single-sourced.** The responsive width matrix and touch-target floor were restated in 8-15 files. The canonical statement lives in `frontend-rules.md` Responsive Design; `code-reviewer` 1.6.1, `component-inspector` 1.5.1, and `principal-designer` 1.1.4 now cite it instead of restating numbers (executable templates keep real numbers, they must run).

**Housekeeping.** Committed `__pycache__/*.pyc` junk deleted from five skill folders. `CLAUDE.template.md` trimmed 238 -> 213 lines toward the 200-line guidance (hook table compressed to families + escapes, version strings unstuck from 4.11.0). Confirmed aligned with guidance and left alone: hooks used for deterministic enforcement, no legacy `commands/`, agent frontmatter discipline (all 33 carry model + maxTurns).

## v4.17.0 - Design sourced from the live market: trend sweep, Figma ingestion, asset provenance (2026-08-06)

**Theme:** directions generated from a static trend catalog converge to the same AI look on every project. This release makes the market the source: live trend sourcing when design is our scope, machine-checked Figma ingestion when the client supplies it, and provenance for every asset either way.

**Live trend sweep (design-direction 1.5.0).** New Step 2b before the mockups: WebSearch the current trend roundups AND walk Dribbble/Behance/Awwwards through Claude-in-Chrome (the operator may log in on those platforms for full access), reviewing a minimum of 8-10 distinct designs with source URLs recorded. Every candidate passes a buildability screen (an extractable philosophy: color strategy, type, density, elevation, motion, signature components, AND survival of the design-rules minimums: states, responsive contracts, tokens, a11y, 10k-row density) or is dropped with the reason logged. Survivors land in `AI_DOCS/design/trend-sources.md`, the Step 3 directions draw their axes from them, and the chosen direction's philosophy is written into `chosen.md` as the GENERATIVE SOURCE every later screen and component derives from. `trends-2026.md` is demoted to explicit fallback.

**Client-supplied designs (design-discovery 2.7.0, design-tokens 1.9.0, mcp-rules 1.2.0).** Discovery Step 0 now asks the branch question: design in scope (ours) vs client-supplied. The client branch skips the trend sweep, connects the new gated **Figma Dev Mode MCP** (local server via the Figma desktop app with the client file open, REST-token fallback), and runs design-tokens' new Figma extraction variant: variables/styles become tokens, frames become the screen references `mavs/fidelity.json` compares built output against, Figma components become registry rows with undesigned states (skeletons, errors, filtered-empty) flagged as gaps, and exported assets land in the manifest. Client values are law; mobile behavior the client never drew is derived per the responsive contract and confirmed, never invented silently.

**Asset provenance (design-rules 1.7.0, image-assets 1.1.0, image-generation 1.1.0).** Free internet assets (photos, illustrations, 3D elements, characters, icons) and generated assets are explicitly allowed, license verified (Unsplash/Pexels/unDraw/Storyset-class sources). Every asset gets a row in `AI_DOCS/design/asset-manifest.md`: repo path, exact source URL or `generated:`/`client:` origin, license, date, where used. An unknown-license asset never ships in a client deliverable, and a screen shipping an unmanifested image is an incomplete task.

## v4.16.0 - Responsive testing made executable: the sweep, the mobile lane, components born responsive (2026-08-06)

**Theme:** the framework already MANDATED all-device responsiveness (frontend-rules 1.5.0/1.6.0) but the enforcement chain ran on a geometry dump nothing produced. This release ships the executor, so "no horizontal scroll, nothing hidden, tables contained, controls operable by touch" becomes a parsed verdict instead of prose.

**The responsive sweep (e2e-testing 1.8.0).** Three committed templates (`templates/geometry-dump.ts`, `responsive-sweep.spec.ts`, `responsive-report.mjs`) run every delivered screen at 375/768/1024/1440/1920 and emit two artifacts: the `mavs/geometry.<width>.json` dumps (previously spec-only, the ground truth `principal-designer` needs for `[Certain]` craft verdicts) and the new `mavs/responsive.json` verdict. The mechanical battery (RSP-01..09): page overflow, element outside viewport, covered or zero-size controls, sub-44px touch targets, tables that scroll the page instead of their own container, overflowing or distorted images, clipped text, content under fixed bars. Crit/high findings are functional and FAIL; med/low feed the judgment layer.

**The mobile interaction lane.** At 375 with touch emulation the sweep OPERATES the app rather than just rendering it: sidebar/nav drawer, top-bar menus, alerts, table sort, filters, pagination, row-action menus, each opened surface re-audited. A control that only works with a mouse, or opens a clipped panel, fails.

**Gate wiring.** `responsive` joins `required.txt` for web frontends (milestone-validation 1.11.0, mavs-report-schema updated), so a FAIL or missing report blocks the promotion merge. Cadence keeps tasks fast: `/build` (2.21.0) exercises UI tasks at 375 + 1440 only; the full 5-width sweep runs once at milestone close. testing-rules 1.8.0 records this as rules 30-32; frontend-rules 1.7.0 points its verification at the sweep.

**Judgment layer sharpened (ui-review 1.1.0).** Every finding now carries a suggested correction (component + file + the specific change) and is routed to `AI_DOCS/quality/defect-log.md`. Verdict is severity-split: a CONFIRMED functional defect (re-driven, not guessed) writes FAIL, which mavs-gate blocks on when present; aesthetics stay advisory and its absence (headless CI) still never blocks.

**Components born responsive (design-tokens 1.8.0, component-inspector 1.5.0).** Every core component now declares a per-breakpoint responsive contract (DataTable contained-scroll/card degrade, SideNav drawer, TopNav collapse, Modal full-screen sheet, pagination/toolbar overflow handling) and is verified at the 5 widths BEFORE its registry entry is written; the registry gains a mandatory Responsive column, with component-inspector asserting the contracts positively.

## v4.15.0 - Estimation v5.2.0: application/feature/task vocabulary, All-items pivot sheet, feature dependencies (2026-08-05)

**Theme:** the estimation workbook becomes an analysis instrument. One flat sheet drives every pivot, one vocabulary spans every lane, and feature dependencies make "what happens if we cut this" a computed answer instead of a meeting.

**Schema v2.** Tasks now carry `application` (the named surface: a project can have several backends and frontends, each named in an `applications` registry), `feature` (the canonical capability from a `features` registry, the SAME exact string in every lane: Authentication covers the backend login/signup/refresh-token APIs and the web and mobile login screens, integration, and state work), `task` (the work item), and a real `phase` field (the `remarks: "Phase 2"` sentinel is shimmed for old files). The engine validates registries, rejects unknown references, cycles, and feature names differing only by case or whitespace, and derives the lane from the sheet key. Old v1 JSONs still enrich and build unchanged through compat shims (a shown estimate is frozen).

**Dependencies.** `features[].dependsOn` records feature-to-feature edges (Dashboard depends on Authentication and Bookings). The engine computes `featureRollup` with direct and transitive dependents and at-risk hours, rendered as a Depends On column on every row plus a Dependencies sheet ranking features by at-risk exposure.

**Workbook.** New sheet order: Summary (feature breakdown + by-application blocks) | All items (the flat pivot source: Phase, Application, Feature, Task, Details, Dev and AI+Dev Min/Max, Lane, Milestone, all six classification dimensions, Depends On, Note) | per-lane sheets in the same vocabulary | Dependencies | Confidence | Risks | Assumptions | Timeline | Pivot (five SUMIFS tables over All items: by application, feature, lane, phase, milestone). Dev Min/Max stay the calibrated P50/P80 band. QA is now one derived row per application per milestone, same totals, finer analysis. verify() covers every new sheet.

**Discipline.** The committed-generator rule is hardened: per project the ONLY artifacts that change are the JSON, the XLSX, and the summary markdown. Scripts are never authored or edited per project. Naming discipline is now Step 4 of decomposition: exact-string feature names, standard names for QA and DevOps rows, dependency edges confirmed before any hours are discussed.

## v4.14.0 - Requirements canon, /requirement-finalization (SK-163), /project-brief (SK-164), document-generation discipline, workscope v2 (2026-08-05)

**Theme:** the document pipeline gets a spine. Client sources gain a canonical home, conflicting sources gain a reconciliation step, every generated document gains a human-first writing discipline, and the workscope stops being two documents wearing one name.

**Requirements canon.** `AI_DOCS/requirements/` is now the single home for raw client source material (PDFs, Word documents, design exports, pasted briefs saved as `.md`). `AI_DOCS/ingested/` remains the home for their markdown conversions, joined by the manifest. The legacy root `requirement.md` is deprecated: skills move it into `AI_DOCS/requirements/` on first contact and log the move. `setup.sh` scaffolds both folders. `/do` gains Step 0.5 (files-first requirement intake): it scans the folder, ingests, and never re-asks what the documents already answer. Swept into line: memory-protocol, CLAUDE.template.md, prd-generation Rule 2.6 (no more auto-copy to `planning/requirement.md`), gate-enforcement G0, session-management, skills/README onboarding, project-kickoff, ux-advisor, tech-stack-selection-rules, design-direction, estimation's source ladder.

**/requirement-finalization (SK-163).** When client sources disagree, this skill reconciles every source in `AI_DOCS/requirements/` into `AI_DOCS/planning/requirements-baseline.md`: numbered statements with source refs, six misalignment classes, a decision card for EVERY conflict (hard gate, nothing resolved silently, "park it" always available), conflict and decision registers, open items with owners, and a strict no-external-sources contract. Runs before workscope on any multi-source project. Downstream, workscope pre-fills its discovery from the baseline and converts answered questions into confirmations.

**/project-brief (SK-164).** A 2 to 4 page document that explains the full complexity of a project to a chosen audience: what is being built, why it is harder than it looks, the decisions that shaped it, the live risks, and what the client or team must provide. Mandatory audience/purpose/length/tone intake before a word is written. Client and team variants. Hard 300-line cap, never split.

**Document-generation discipline.** New `rules/document-generation-rules.md` (Tier 1): intake before ink (one-batch purpose/audience/tone/format gate), the purpose sentence, structure follows type, the human writing standard, a greppable banned-phrase list, evidence over assertion, a validation checklist, and scope carve-outs (skill-mandated structures and verbatim output stay exact). Twelve document skills now point at it, the duplicated humanization blocks in markdown-creator and docx collapse into pointers, `pptx` gains its first-ever intake gate, and `hooks/style-check.sh` gains an advisory banned-phrase pass. Registered in the project-context CLAUDE.md imports so every project inherits it.

**Workscope v2.0.0.** One canonical structure: the official 12-section client template, generated natively (DOCX conversion is now mechanical). New: per-milestone acceptance criteria (3 to 6 client-verifiable bullets, mandatory), structured assumptions (status + impact-if-wrong), 35 discovery questions (adds decision-maker, 90-day success KPI, cost of doing nothing, tone confirmation), baseline pre-flight, Investment sourced from an approved estimation on opt-in (a number is `XXXX` or estimation-sourced, never invented), an estimation handoff after approval, and the en-dash defect in the mandated closing line fixed.

**Housekeeping.** catalog.yaml header unstuck (was 4.11.0/94, now 4.14.0/97), the stale SK-073 "moved to claude-sales-skills" rows rewritten (SK-162 is internal since v4.13.0, SK-073 retired and never reused), estimation added to /do's dispatch table and the active-skills planning whitelist, stale RideIt paths removed from the docx skill, and the skill-versioning footer example now uses pipe separators.

## v4.13.0 - New skill: /estimation (SK-162), ballpark effort estimation (2026-08-03)

**Theme:** ADF could plan, build, audit, and ship, but it could not answer "how long will this take" with anything defensible. `/estimation` (SK-162) closes that, and it is built so the number traces from project to module to feature to task rather than appearing whole.

**The central idea: never ask an open question about an undefined thing.** The failure mode in every estimation tool is a blank box next to a feature name. "How long for Authentication?" gets a number pulled from the air, because the question carries no scope. Instead the skill states the countable scope and offers priced options:

```
[Frontend] M1 . Authentication . Login screen
WHAT THIS COVERS  1 screen, 4 inputs, 2 buttons, 1 role-based redirect, 2 API calls,
                  5 validation rules, 4 states, 2 breakpoints, 40% reuse
                  NOT here: signup, forgot-password, MFA, social login
ANCHOR            14h (derived from the countables)
OPTIONS           A 8/10/13 . B 11/14/20 (recommended) . C 15/20/31 . D 20/28/47.5 . E your own
```

ADF pre-fills those countables from `api-contract.md`, `database-schema.md`, tech-spec S3/S9/S19/S22, and `design/screens/`, so the answerer corrects a stated scope instead of inventing one.

**Four concepts kept strictly apart, each applied exactly once.** Most estimation inflates silently because the same worry is priced two or three times. Base effort is the answered three-point. Complexity and difficulty are priced in at question time and are NEVER re-applied as multipliers (the engine only cross-checks them and flags contradictions for review). Uncertainty floors the band width and never moves the expected value, so admitting you are unsure makes the range honest rather than the work bigger. Registered risk is quantified once at project level.

**Risk splits by impact type.** An effort risk adds hours. A timeline risk adds calendar weeks and zero hours, because waiting for a payment provider to approve an account delays delivery without making anyone type more. Conflating the two overcharges in one direction and produces an unachievable schedule in the other.

**Spreads aggregate under a correlated error model.** `sqrt(sum of SD^2)` assumes task errors are independent. They are not: optimism bias is systematic, which is the entire premise of the reference-class correction. Independence collapsed a 15-task band to roughly plus or minus 6% at workscope stage, contradicting the cone-of-uncertainty table. The engine uses `Var = (1-rho)*sum(SD^2) + rho*(sum SD)^2` with `rho = 0.35 - 0.20 * calibratedFraction`, so calibration tightens the estimate twice: once by correcting the centre, once by lowering the correlation.

**Contingency no longer double-counts.** It covers unknown-unknowns only, and is discounted by whatever the risk register has already itemised, floored at half the stage base. Without that subtraction a team doing careful risk analysis would land on a higher total than a team doing none.

**Excel is a committed generator, not per-project code.** `scripts/build_workbook.py` builds Summary (led by a module breakdown), per-stack sheets, Confidence, Risks, Assumptions, Timeline, and a SUMIFS Pivot. openpyxl cannot evaluate formulas, so its verifier re-implements SUM and SUMIFS against the written cells and checks every pivot grouping is exhaustive against the stack column total. Negative tests confirm it catches a wrong criteria column, a dropped module, and a short SUM range. It also drops the old divider-row rule, which was unachievable: a ListObject range is contiguous, so an interleaved divider lands inside the table and SUMIFS counts it as a junk data row.

**Judgment numbers are centralised and honest.** `priors.json` holds every tunable that is not derived from data (spread floors, confidence weights, option ladder, anchor rates, correlation base), each marked `documented-default` or `judgment`. It is a verified no-op: the engine carries identical built-in defaults and the selftest asserts the two agree, so a config file can never silently diverge from its fallback.

**Cone stage is where ADF wins.** A pre-sales estimate rarely gets past `workscope-approved` (25% base contingency). ADF reaches `tech-spec-complete` (15%) and `task-planned` (10%). The skill names that gain explicitly rather than burying it, because pushing one stage deeper beats any argument about individual hours.

**Calibration store** is the shared `~/.adf/shared/estimation/`, so actuals logged on any project on this machine tighten every later estimate. Reference-class correction engages per work class at n>=6.

**Files added:** `skills/estimation/` (SKILL.md, QUESTION-PROTOCOL.md, ESTIMATION-METHOD.md, QUESTIONS.md, EXCEL-FORMAT.md, CALIBRATION.md, priors.json, examples/estimation-example-v1.json, scripts/estimate_stats.py, scripts/build_workbook.py). **Files touched:** `skill-lab/catalog.yaml` (SK-162), `skills/REGISTRY.md`, `.adf-version`.

**Verification:** `python scripts/estimate_stats.py --selftest` and `python scripts/build_workbook.py --selftest` both pass and are the regression gate for this skill.

## v4.12.2 - DOCX formatting: markdown soft-wrap, list spacing, keep-with-next, pPr schema guard (2026-07-30)

**Theme:** generated DOCX layout. Client-facing proposals came out of `docx-from-markdown` with visibly wrong paragraph flow, broken bullets, and uneven spacing. The master template's brand styles were correct throughout. Every defect was in the converter, and the largest was a markdown parsing error rather than a spacing value. Both docx skills are now held to one written contract. No skill IDs, agents, or catalog entries changed.

**The root cause (the big one).** The conversion loop called `add_paragraph()` once **per source line**. Markdown soft-wrap means consecutive non-blank lines are ONE paragraph separated by blank lines, so every wrapped prose paragraph was exploded into one DOCX paragraph per line. On a representative 600-line proposal that turned 51 prose paragraphs into 271, injecting 176 spurious block gaps and rendering each wrapped line as a short stubby paragraph. Worse for lists: a wrapped bullet's continuation lines are indented and do not start with `-`, so the bullet regex missed them and they fell through to `add_paragraph`, dropping out of the list mid-item. A wrapped numbered item also reset `active_ordered_num`, restarting numbering at 1 on the next item. New `_starts_block` plus `_gather_wrapped` join each block before rendering, and the prose, bullet, numbered, and blockquote branches all route through them. Verified on that proposal: 51 of 51 prose paragraphs and 51 of 51 list items now land as exactly one paragraph each.

**Spacing.** A single 4pt scale is declared once (`SPACE_XS` 4pt / `SPACE_SM` 8pt / `SPACE_MD` 12pt) so no gap is inlined as a magic `Pt(n)`; the converter previously mixed 4, 6, 8 and 10pt with no rhythm. `SPACE_SM` deliberately equals the master's `Normal` `after=160` twips. Heading spacing remains owned by the master's brand styles and is never overridden from the script.

1. **Lists collapse between siblings.** The master's `ListParagraph` carries `before=120 after=120` with no `contextualSpacing`, so adjacent bullets sat 6pt after plus 6pt before, 12pt apart. `_collapse_within_list` adds `contextualSpacing` to every list paragraph, collapsing the gap between items of one list while keeping it before the first and after the last.
2. **Empty-paragraph spacers removed.** A bare `doc.add_paragraph()` after a table or code block inherits `Normal`, contributing a full empty text line plus 8pt after, and then the next block adds its own `space_before`, reaching 36pt before a heading. `_add_spacer` pins the line height to an exact 2pt so the gap is one `SPACE_SM` step.
3. **Blocks bind to what follows.** `_keep_with_next` (keepNext plus keepLines) on every heading, code language label, captioned figure, and table header band, so a heading cannot be the last line on a page with its content overleaf.
4. **Table cells and code** set spacing explicitly instead of inheriting `Normal` (which inflated row height), and the code cell uses an exact 12pt line on its 9.5pt font so code scans as a block.

**`pPr` child order is now enforced (silent-corruption class).** OOXML requires a fixed child order in `w:pPr`. Word does not report a violation, it silently repairs the paragraph by DROPPING the offending properties, so a formatting fix regresses invisibly with nothing to point at. `_apply_list_format` used raw `ppr.append`, placing numbering and spacing after any previously inserted property. All raw appends now go through the order-independent `_ppr_insert`, and `_assert_ppr_schema_order` runs on every `convert()` before save and RAISES on any violation.

**`/docx` aligned to the same contract.** The JS (`docx-js`) creation path in `skills/docx` declared its own heading spacing (H1 `before/after 240/240`, H2 `180/180`) which disagreed with the master's brand styles, so the same document built through the two skills came out differently, despite the skill already claiming the rules were shared. Heading spacing now matches the master (320/160, 220/100, plus a new Heading3 at 180/80) with `keepNext`/`keepLines`, list examples carry `contextualSpacing: true`, and a new "Vertical Rhythm" section maps the shared contract onto docx-js options.

**Files touched:** `skills/docx-from-markdown/scripts/md_to_docx.py` (block parsing, spacing scale, keep-with-next, spacer, schema guard), `skills/docx-from-markdown/SKILL.md` (3.4.0 to 3.5.0; new "Block structure" source convention and "Vertical rhythm" contract), `skills/docx-from-markdown/references/style-rules.md` (new section 12 block structure, new section 13 spacing contract, both with verification snippets), `skills/docx/SKILL.md` (1.3.0 to 1.4.0; heading spacing, list contextualSpacing, shared-contract section), `.adf-version`.

**Migration:** `git pull`. Nothing to run and no project state changes. Any DOCX generated after the pull picks up the corrected layout automatically. **Regenerate previously generated documents from their markdown source**, since the fix changes rendering, not stored files. Markdown sources need no edits: soft-wrapped prose is now read correctly, so existing files render better without being touched. If a future converter edit trips `_assert_ppr_schema_order`, replace the offending `ppr.append(...)` with `_ppr_insert(ppr, tag)` rather than weakening the check.

## v4.12.1 - Remote Control disabled framework-wide + enforced on every pull (2026-07-20)

**Theme:** operator security posture. Claude Code Remote Control (claude.ai/code, `claude remote-control`, the `--remote-control`/`--rc` flags, auto-start, and the in-session toggle) is now disabled for every project the framework touches, and the setting is re-asserted on every pull so it cannot silently drift back on. Disabling covers new sessions and any already-open session that re-reads settings.

**What changed.** `settings.template.json` gains the top-level `"disableRemoteControl": true`, so fresh `setup.sh` installs (which copy the template) and the `patch-settings.sh` add-if-missing sync both carry it. `upgrade.sh` gains an always-on `[remote-control-lock]` step that FORCES the value back to `true` on every pull. `patch-settings.sh` only fills a key that is absent and never overwrites an existing one, so a project that had `disableRemoteControl: false` needs this second step to be flipped. A timestamped `settings.json.backup.*` is written only when the value actually changes.

**Per-project opt-out.** A project that genuinely needs Remote Control sets `"disableRemoteControl": false` in `.claude/settings.local.json` (gitignored personal overrides). Claude Code merges local over project, so the local value wins at runtime, and the lock never touches `settings.local.json`.

**Files touched:** `settings.template.json` (new key + `//remoteControl` doc note), `upgrade.sh` (`[remote-control-lock]` step). No skills, agents, or catalog IDs changed.

**Migration:** `git pull` + `bash upgrade.sh`. The lock runs automatically and sets `disableRemoteControl: true` in each project's `settings.json` (backup written if the value changed). No manual step. To keep Remote Control on for a specific project, add `"disableRemoteControl": false` to that project's `.claude/settings.local.json`.

## v4.12.0 - Execution-quality upgrade: evidence-DONE, scope validation, package hygiene, task briefs, parallel waves, risk-class tests (2026-07-09)

**Theme:** field findings from a real client delivery (12 escaped defects, recorded in the operator's bugs.md) traced to five root causes: per-task DONE was self-attested from static checks, gates checked presence not correctness at task level, no per-task output-vs-scope validation, coverage-number-driven tests missing the edge classes that actually escape, and package hygiene living as prose. This release makes 100% workscope/requirement alignment mechanical at TASK granularity (MAVS already held it at milestone granularity). Full design + bug-to-gate replay matrix: `PLAN-execution-quality.md` at the repo root.

**The DONE contract (Track A).** A task is DONE only when its **Acceptance Evidence table** is complete (`skills/build/EVIDENCE-TABLE.md`): one row per acceptance criterion with implementing files on EVERY surface the criterion names, a named proving test that fails without the change, and an exercise result. New **Exercise gate** in the verify battery drives the changed flow once for real (API request asserting status + envelope + the changed action's authz allow AND deny cells, one Playwright pass for UI, local invoke for workers), killing the builds-green-but-broken-at-runtime class. `code-reviewer` gains a mandatory acceptance-coverage section (a criterion delivered on fewer surfaces than it names is CRITICAL + REWORK). `vertical-slice-rules.md` Rule 7 (multi-surface input symmetry: the FE must never advertise an input the worker cannot handle) with a `vertical-slice-check.sh` backstop on `surfaces:`/`symmetry:` tags.

**Orchestrator-only main session (Track E).** The `builder` agent is now the DEFAULT for every task outside the micro lane (inline implementation needs a logged reason). New **scope validation** step between verify and review: `quality-lead` compares the diff against the acceptance, the Task Brief, and the capsule scope, returning SCOPE-OK / UNDER (missing part goes back to the builder) / OVER (creep routes to change-request).

**Task Brief (Track D).** Every non-micro-lane task gets a pre-execution brief (`skills/task-planner/TASK-BRIEF.md`, produced by `explorer`/`research-lead`): the requirement slice quoted by ID, a reality check of every plan assumption against the current code (any DRIFT routes to change-request before coding), each criterion restated concrete + testable with its surfaces named, and the files-to-touch prediction.

**Package hygiene (Track B).** The dependency gate adds added-must-be-used (a package added but not imported by the task's diff is BLOCKED). `/audit` check 12 runs the whole-tree unused scan (knip / depcheck, deptry, go mod tidy): an unused production dependency is CONCERNS at audit and FAIL at ship without a logged exception. Compliance projects get a processing-location check for data-processing SDKs (an external-API parser on a gdpr project without an ADR entry is flagged) and native-binary deps must record their base-image requirement in the ADR. `guardrails` scaffolds knip/deptry + a `deps:check` script, and drift Phase H findings now block milestone close.

**Parallel wave lane (Track C, opt-in per wave).** /do may run provably independent tasks concurrently: no blockedBy edge, disjoint files-to-touch, no locked artifact, no shared entity write. Each wave member runs in its own worktree-isolated `builder` (cap = HEAVY_CAP), and merges are strictly SEQUENTIAL with the full battery re-run per merge (a conflict falls back to a sequential rebuild). `milestone-planning` seeds a `parallelizable` hint per task. Task Briefs for queued tasks always run in parallel while the current builder works.

**Risk-class edge battery (Track F).** `testing-rules.md` gains a BLOCKING per-code-shape table: serializer escapes (quotes/backslashes/newlines/unicode/empty/injection), list empty + pagination boundaries, form validation per component TYPE (select/radio/date/file, not text only), multi-tenant link builders (subdomain vs wildcard), RBAC allow AND deny cells (over-blocking is a defect equal to leaking), upload/format matrix through every service hop, rate-limiter scope + success-exclusion, and retry-clears-error. Wired into `qa-testing`, `python-testing`, `e2e-testing` (new executable format-conformance check: FE accept-list == API accept-list == worker handled-list), `authz-matrix` (changed cells run live in the per-task exercise gate), and the `test-writer` agent.

**Files touched:** skills do 6.24.0, build 2.20.0 (+ EVIDENCE-TABLE.md), audit 2.9.0, guardrails 1.4.0, architecture 1.5.0, milestone-planning 1.5.0, task-planner 3.2.0 (+ TASK-BRIEF.md), qa-testing 1.9.0, python-testing 1.7.0, e2e-testing 1.7.0, authz-matrix 2.4.0, session-management SETUP-TEMPLATES (deps:check). Agents builder 1.2.0, code-reviewer 1.6.0, quality-lead 1.1.0, explorer 1.1.0, research-lead 1.1.0, test-writer 1.2.0. Rules testing-rules 1.7.0, vertical-slice-rules 1.1.0, tech-stack-selection-rules 1.4.0. Hooks vertical-slice-check.sh (Rule 7 backstop), drift-detector.sh (Phase H close-blocking note), session-state-refresher.sh (Active wave). Docs coordination-rules.md (builder waves are HEAVY, merges sequential). No new skills, no new agents, no catalog ID changes (two new template files only).

**Migration:** `git pull` + `bash upgrade.sh`. Existing projects: add the `deps:check` script (knip for JS/TS, deptry for Python) per the guardrails Dependency-Hygiene Scaffold. Nothing else to migrate: the Task Brief, Evidence table, Exercise gate, and scope validation activate on the next `/do` task automatically, and the parallel wave lane is opt-in per wave (one decision-log line) until you use it.

## v4.11.2 - Canonical full-scope test command set + gitignored artifacts folder (2026-07-07)

**Theme:** one standard, scaffolded way to run the whole project's tests and validate the report, with all raw output in a single gitignored `AI_DOCS/` folder.

**What changed.** The framework now scaffolds a canonical test setup into every project (previously there was NO package.json script standard and NO jest/vitest/playwright config template):
- **Scripts:** `test` (unit+integration+coverage, 98% gate), `test:e2e` (Playwright), `test:full` / `test:ci` (whole scope: JS + Python + Go + E2E, auto-detected, then report validation), `test:validate` (re-check reports without re-running).
- **Config templates** (`skills/session-management/templates/`): `vitest.config.ts` + `jest.config.ts` (98% four-metric `coverageThreshold`, coverage into the artifacts dir), `playwright.config.ts` (JUnit + HTML into the artifacts dir, auth-state reuse, headless in CI).
- **Orchestrator + validator** (Node ESM, builtins only, verified against pass/fail/stale fixtures): `adf-test.mjs` runs every present stack's real runner, normalizes each into `AI_DOCS/quality/mavs/*.json` (same schema the merge gate reads), then runs `validate-test-reports.mjs`, which asserts 98% coverage + all suites PASS + not stale.
- **One artifacts folder, gitignored:** all raw runner output (coverage HTML/lcov/`coverage-summary.json`, pytest `coverage.json`, Go `cover.out`, Playwright HTML + JUnit) goes to `AI_DOCS/quality/test-artifacts/`, never `/tmp` or project root. The small validated verdict JSON in `AI_DOCS/quality/mavs/` stays tracked as evidence.

Wiring updated in `session-management` (SETUP-TEMPLATES.md + SCAFFOLDING.md .gitignore), `templates/stack.md` (canonical commands recorded, populating the `test.regression` field `/build` + `/do` read), `rules/testing-rules.md` (new Rule 7b), `docs/mavs-report-schema.md`, and `python-testing` / `go-testing` / `e2e-testing` (raw output routed to the artifacts dir). CI template now calls `npm run test:ci`. Self-test: 127/127.

**Migration:** `git pull` + `bash upgrade.sh`. New projects get the full setup at scaffold. Existing projects: copy the two config templates + `adf-test.mjs` + `validate-test-reports.mjs` (and the `check_func_coverage.*` helpers for polyglot) into the project, add the `scripts` block, add `AI_DOCS/quality/test-artifacts/` to `.gitignore`, and point CI at `npm run test:ci`.

## v4.11.1 - Test-coverage floor raised to a flat 98% on every stack and tier (2026-07-07)

**Theme:** one high, flat coverage bar. The framework requires a minimum 98% on lines, branches, AND functions for EVERY project type (POC included) and EVERY stack, with no exemptions (spike/prototype folders no longer skip coverage).

**What changed.** `testing-rules.md` Rule 7 no longer tier-scales the number (was MVP 60 / Production 80 / Enterprise 90 lines, 60/75/85 branches) and no longer exempts POC. Rule 7a sets the floor at 98% on lines, branches, and functions across all three stacks:
- **JS/TS:** Jest/Vitest `coverageThreshold: { statements: 98, branches: 98, functions: 98, lines: 98 }` (native four-metric).
- **Python:** pytest `--cov-branch --cov-fail-under=98` (lines + branches) PLUS a committed function-coverage helper `skills/python-testing/check_func_coverage.py` (stdlib `ast` + `coverage json`) that fails under 98% of functions exercised. The `--cov-report=json` addopt auto-writes the input.
- **Go:** committed helper `skills/go-testing/check_func_coverage.sh` gates BOTH the `go tool cover -func` statement total >= 98% AND >= 98% of functions with coverage above 0% (generated code + mocks excluded).

The floor propagated to `code-rules.md`, `python-rules.md`, `prototype-rules.md` (spike coverage exemption removed), and every skill that stated a coverage number: `qa-testing` (+ `COVERAGE-TARGETS.md`, the template the gates defer to), `python-testing`, `go-testing`, `code-quality`, `gate-enforcement`, `project-types`, `guardrails` (+ `RULE-DETAILS.md`), `session-management`, `milestone-validation`, `python-deployment`, `prd-generation/FRD-TEMPLATE.md`, and the shared-conventions template. Both helper scripts were verified against fail and pass fixtures. Self-test: 127/127.

**Migration:** `git pull` + `bash upgrade.sh`. Existing projects: raise Jest `coverageThreshold` to 98 on all four metrics; add `--cov-branch --cov-fail-under=98 --cov-report=json` to pytest and copy `check_func_coverage.py` into `scripts/`; copy `check_func_coverage.sh` into `scripts/` for Go and run it after `go test -coverprofile`. Code below the new floor fails Gate 4C until covered.

## v4.11.0 - Agent-centric v5: model routing, context isolation, governed builder (2026-07-02)

**Theme:** match model to task, run heavy work in isolated subagents so a single session stays lean, and let good learnings flow back to the shared framework safely. Every change is committed to `main` and self-test clean (127/127).

**Model routing (no Fable).** All agents now declare a `model:` in frontmatter: heavy-reasoning and gate-verdict agents on Opus, review/validate/author and platform specialists on Sonnet, cheap read-only investigation on Haiku. The `fable`/`best` aliases are never used.

**Context isolation.** New `agents/explorer.md` (Haiku, read-only) does read-heavy lookups and returns summaries so raw file contents never enter the main window. New `rules/context-efficiency-rules.md` (Tier 1) mandates dispatching read-heavy/mechanical/ingestion work to subagents. `/do` delegates investigation instead of reading many files inline.

**Domain leads + governed builder (the agent-centric loop).** Five leads (`frontend-lead`, `backend-lead`, `quality-lead`, `design-lead`, `research-lead`) carry the `Agent` tool and plan/advise/review in their own context (they never edit). The new `builder` agent applies a lead's plan in an isolated context and runs the verify battery there. This is safe because the PreToolUse governance hooks were verified to fire and block inside subagents (harness: `skill-lab/experiments/hooks-in-subagent.md`), so routing, shell-lock, api-contract-lock, chunk-scope, and cost/ship gates still enforce every edit a builder makes. `/do` (v6.23.x) dispatches leads for non-trivial tasks and the builder for implementation; it still runs the mandatory code-review and stamps the task. A trivial-change micro-lane and a stack-aware verify battery (adds the Go floor: `gofmt`/`go vet`/`go test -race`) were added.

**Cross-project self-improvement (isolation-guaranteed).** New `agents/learning-curator.md` + `templates/framework-feedback.md` + `rules/self-improvement-rules.md`: a project captures GENERALIZED learnings locally, the curator abstracts them into a human-gated promotion proposal, and only a deliberate human commit lands them in the shared framework. Project sessions still write only to `AI_DOCS/`; nothing auto-edits `.claude/`.

**Skill consolidation (96 to 94).** `python-backend` and `go-backend` were retired (deprecated in place, then removed). `/do`'s lead+builder loop plus `rules/python-rules.md`/`rules/go-rules.md` and the `fastapi-specialist`/`go-specialist` agents own that role now. Their `dependencies.required` on the removed skills were re-pointed; old-name references resolve via the alias table in `docs/skill-deprecations.md`.

| Removed | Replacement | Notes |
|---|---|---|
| `python-backend` | `build` + `fastapi-specialist` | conventions in `python-rules.md`; testing/deployment/ai-services skills kept |
| `go-backend` | `build` + `go-specialist` | conventions in `go-rules.md`; builder gained the Go verify floor |

**Defect fixes.** `nextjs`/`shadcn-ui` skill_ids aligned to the catalog (SK-102/SK-103). `milestone-validation` now consumes the `python-test`/`go-test` MAVS reports (stack-conditional validators) instead of leaving them orphaned. The always-loaded `CLAUDE.template.md` Agent Roster table was condensed to a summary (agents self-describe via frontmatter).

**Migration:** `git pull` + `bash upgrade.sh`. New projects get everything current. For an EXISTING project: the 8 new agents (5 leads, builder, explorer, learning-curator) appear after a session restart, no registration needed. Any lingering `python-backend`/`go-backend` reference in your files resolves via the alias table and is reported by `upgrade.sh`'s deprecated-skill scan (now covers both names); `/do` also maps a dangling `needs:python-backend`/`go-backend` to `build` + the specialist rather than failing. Your project `CLAUDE.md` and `AI_DOCS/memory/active-skills.md` are not auto-rewritten: if either literally lists `python-backend`/`go-backend`, remove those lines (they route to `build` + the specialist now) — `upgrade.sh`'s deprecated-skill scan prints the exact files. The `/project-context` generator was fixed this release: it now stamps the `adf-version` marker and carries the core operating rules (single-interface `/do`, framework routing, compaction recovery), so regenerating `CLAUDE.md` is safe, clears the staleness flag, and no longer drops governance.

## v4.10.0 - Context optimization + skill consolidation (2026-06-30)

**Theme:** shrink the always-loaded surface, remove drift-prone duplication, and make rule loading provably on-demand, aligned to the Anthropic skill-authoring guide.

**Descriptions.** The 22 heaviest skill descriptions were compressed to 600 characters or fewer (5 were over the guide's 1024-char hard limit). Triggers and negative-triggers were preserved. Version history and implementation detail moved out of the always-loaded frontmatter. The roughly 80 already-compact descriptions were left untouched.

**On-demand rule loading.** New `rules/README.md` is the single load index: Tier 0 (writing-style, advisor-stance, response-markers) every session, Tier 1 (code/security/ops/ai-safety) when engineering or running external ops, Tier 2 domain rules only on a domain match. `CLAUDE.md` and `CLAUDE.template.md` now reference it instead of restating the table, and the duplicate Compaction Instructions block in the template was folded to a pointer.

**Skill consolidation (101 to 96).** Five overlapping skills were merged. Unique capability and unique reference files were relocated into the target first, then the old folders were removed (the same model as the v3.1 removals). Old-name invocations still resolve through the alias table in `docs/skill-deprecations.md`.

| Removed | Replacement | Notes |
|---|---|---|
| `security-audit` | `audit` | `audit` already consolidated security + secrets + a11y + OWASP |
| `developer-workflow` | `build` | `STRUCTURE.md` relocated; ad-hoc-fix protocol folded in |
| `webapp-testing` | `e2e-testing` | browser primitives + visual-regression + UI MAVS validators folded in |
| `find-skills` | `skill-router` (+ `install-plugin`) | discovery vs install split between the two |
| `frd-generation` | `prd-generation` | new FRD Mode; `FRD-TEMPLATE.md` + `FRD-EXAMPLES.md` relocated |

**Housekeeping.** Refreshed the stale README, fixed the long-standing v3.1 staleness in `skill-router` and `REGISTRY.md` (they still listed `design-system`, `deployment`, and `claude-md` as live routes), and reconciled every version stamp to 4.10.0.

**Migration:** `git pull` + `bash upgrade.sh`. Nothing breaks for existing projects: the five old skill names resolve to their replacements via the alias table, and `upgrade.sh`'s deprecated-skill reference scan reports any lingering old-name mentions in your own files. If your project `CLAUDE.md` predates the rule-loading change, regenerate it with `/project-context` to pick up the `rules/README.md` pointer (optional, the global rules still load).

## v4.9.0 - Go and Desktop as first-class targets (2026-06-25)

Go became a real backend option: new `rules/go-rules.md`, the `go-specialist` agent, and a `go-backend` / `go-testing` / `go-deployment` skill cluster mirroring the Python cluster (`go-testing` emits the MAVS `go-test.json` report). Desktop became a real target: new `rules/desktop-rules.md` with Electron/Tauri security and signed-update patterns. `tech-stack-selection-rules` widened to the full menu (auth/identity, API style REST/tRPC/GraphQL/gRPC, ORM, BaaS, async/queue, serverless/edge, plus Spring/.NET/Laravel/Rails/Elixir), and `templates/stack.md` gained `api_style`, `auth_provider`, `orm`, `baas`, `queue`, and `desktop` keys. This release shipped to the repo but was not stamped until 4.10.0 reconciled the version markers.

**Migration:** `git pull` + `bash upgrade.sh`.

## v4.8.1 - MCP skill wiring, all-device responsive enforcement, style hook (2026-06-26)

**MCP adoption.** 17 more skills wired to MCP (each gains an `mcp_integrations` frontmatter field and a short "MCP Acceleration" section): browser/verify (`e2e-testing`, `accessibility-audit`, `build`, `feature-delivery` with playwright + context7), platform (`github-ops`, `shadcn-ui`, `nextjs`, `reactjs`), DB/ops (`data-migration`, `error-handling`, `deployment-planning`, `deployment-execution`), and design/spec (`design-tokens`, `design-discovery`, `architecture`, `tech-specification`, `developer-workflow`, `codebase-migration`). MCP-aware skills go from 6 to 23.

**All-device responsive (BLOCKING).** `frontend-rules.md` 1.5.0 makes responsive a testable acceptance bar at every breakpoint (Mobile 320-767, Tablet 768-1023, Desktop 1024-1440, Wide 1441+): no horizontal scroll, no overflow or clipping, fluid media, 44px touch targets, and a `max-width` cap on wide screens. Verified live with the `playwright` MCP at 375/768/1024/1440/1920.

**Validation baked into agents.** `component-inspector` 1.2.0 gains a "Responsive across all devices" check; `code-reviewer` 1.2.0 gains responsive review for UI files plus a writing-style file-cleanliness check (em/en-dashes, prose semicolons, status-marker emojis in files).

**Style hook.** New advisory `hooks/style-check.sh` (PostToolUse on Edit/Write/MultiEdit) flags em/en-dashes in edited Markdown. Non-blocking, always exits 0.

**Opt-out + perf for the migration (carried from the 4.8.0 line):** machine-wide `~/.adf/mcp-ignore` now merges with the project `.mcp-ignore`; registry verification runs in parallel and caches verified ids at `~/.adf/mcp-verify-cache`. `patch-settings.sh` no longer copies template comment keys (`//...`) into user settings.

**Migration:** `git pull` + `bash upgrade.sh` (settings-sync wires the new style-check hook; the rest arrive with the pull).

## v4.8.0 — MCP enforcement: free servers auto-provisioned, gated servers approved (2026-06-26)

**Theme:** use MCP to make three moments faster — stack finalize, project setup, debug/verify. Free, no-credential servers are enforced automatically. Credentialed servers stay gated behind approval.

**The model (headline):** new `rules/mcp-rules.md` defines two tiers.
- **Enforced (free):** no credentials, local `npx`. Auto-written to a project-root `.mcp.json`. Set = `sequential-thinking`, `context7` (always); `playwright` (any web frontend); `shadcn` / `next-devtools` / `@mui/mcp` / `prisma mcp` (stack-matched). `fetch`/`filesystem`/`git` deliberately excluded (Claude Code has native WebFetch/file/git). Package ids are verified against the npm registry before being written.
- **Gated (credentialed):** postgres / mongodb / supabase / stripe / sentry / github / aws / slack / maps — offered, approved, wired with `${ENV_VAR}` references only. A secret literal in `.mcp.json` is an `/audit` FAIL.

**Enforcement lever:** `settings.template.json` gains `enableAllProjectMcpServers: true` so the generated `.mcp.json` loads without a per-server trust prompt.

**Wiring:** `/do` 6.9.0 (Step 2 dispatch row 9 + Step 2.5 activation), `session-management` 1.3.0 (Step 1.7 + SCAFFOLDING), `debugger` 1.2.0 (MCP-acceleration table), `webapp-testing` 1.2.0 (Playwright-MCP-first), `audit` 2.5.0 (`.mcp.json` secret + integrity checks). `mcp-connector` 1.1.0 is the operating skill, and active servers are recorded in `stack.md → ## MCP Servers`. Browser servers target the project dev URL/port. DB/cloud servers bind dev-only by default (Rule 6b).

**Migration (existing projects):** `git pull` + `bash upgrade.sh` does it all automatically:
- `[settings-sync]` adds `enableAllProjectMcpServers` to your `settings.json` (existing keys untouched).
- New always-on `[mcp-sync]` step runs `scripts/migrate-mcp.sh`: detects your stack from `package.json` + `components.json` and seeds/tops-up `.mcp.json` with the matched **free** servers. It never overwrites an existing entry, never writes a credential, and leaves an unparseable `.mcp.json` untouched. Each package id is verified against the npm registry before being written (checks run in parallel; verified ids are cached at `~/.adf/mcp-verify-cache` so later projects do zero network calls; `MCP_VERIFY=0` disables). Gated servers your stack implies are reported, not wired — run `mcp-connector` (or `/do`) to wire them with credentials. Runs on every pull, including same-version pulls.
- **Opt out of a free server:** add its name to a `.mcp-ignore` file at the project root (one per line). It is never auto-added, and a framework-written entry matching it is removed so it stays gone. Your own/modified entries are never touched.
- `rules/mcp-rules.md` and the refreshed skills arrive with the pull itself.

A reference `.mcp.json` lives at `skills/mcp-connector/templates/mcp.json.example`.

## v4.7.0 — Single AI_DOCS at project root, enforced (2026-06-25)

**Theme:** one project, one `AI_DOCS/`. Stop a second `AI_DOCS/` from ever appearing inside the application code, and align the skills that still wrote the deprecated flat `memory/task.md`.

**The guard (headline):**
- New `hooks/enforce-single-aidocs.sh` (PreToolUse on Edit/Write/MultiEdit/Bash): blocks any tool call that would create or write into an `AI_DOCS/` folder whose parent is not the project root. Project root is resolved by walking up from the target path to the nearest ancestor containing `.git/` or an existing `AI_DOCS/`, falling back to cwd (so the first `AI_DOCS/` in a brand-new project is allowed). A substring like `AI_DOCSViewer.tsx` is not a path segment and passes. Escape: `ADF_ALLOW_NESTED_AIDOCS=on`.
- Wired into `settings.template.json` as the first PreToolUse hook.
- Documented in `CLAUDE.md` (Section 4 invariant + Section 7 safety), `CLAUDE.template.md` (hooks table), `DEVELOPER.md` (hook registry).

**Consistency fix:**
- `feature-delivery` 1.3.1: stopped writing the deprecated `AI_DOCS/memory/task.md`. It now updates the active milestone's `AI_DOCS/milestones/M<NN>-<slug>/tasks.md` + the global `task-ledger.md`, matching the canonical v3+ schema.

**Known follow-up (NOT in this release):** ~12 other skills/templates still reference the deprecated flat `memory/task.md` (analytics, deployment-execution, project-context, orchestrator, project-kickoff, codebase-migration, project-audit, and several templates). These need the same alignment to `milestones/M<NN>/tasks.md`. Tracked for a follow-up pass.

**Migration:** `git pull` + `bash upgrade.sh` (syncs the new hook into `settings.json`). No project-state changes required. Existing nested `AI_DOCS/` folders, if any, are not moved automatically — consolidate them into the root `AI_DOCS/` by hand.

## v4.5.0 — SDLC hardening: data-dependency ordering, vertical slices, live UIUX directions, real-auth E2E, branching strategy (2026-06-23)

**Theme:** close the SDLC gaps that produced low-quality deliveries — UIUX picked blind, milestones ordered before their data, half-built features, and E2E that could not log in.

**Phase A — intake + planning:**
- `/do` 6.5.0 intake gains 3 questions: SDLC methodology (Agile+Scrum+DevOps default), branching strategy, platform targets. Per-milestone promotion + deploy re-ask at milestone close. New `sdlc_methodology` / `branching_strategy` / `platform_targets` in project-context.md.
- New `rules/sdlc-methodology-rules.md`: each methodology's downstream effect (sprint grouping vs flow vs phases).
- `milestone-planning` 1.4.0: data-dependency ordering (BLOCKING) — producers precede consumers, dashboards/stats/reporting LAST. New `AI_DOCS/planning/dependency-graph.md`, auto-populated `blockedBy`, mobile milestones, SDLC consumption. Backstop `hooks/milestone-order-check.sh`.
- New `rules/vertical-slice-rules.md`: 7-layer slice (schema → API → backend RBAC → seed → UI → integration → frontend RBAC) = definition of DONE. `task-planner` 3.1.0 + `feature-delivery` 1.3.0 emit it; `/build` 2.9.0 adds Checks E (seed) + F (integration) + audit-log gate. Backstop `hooks/vertical-slice-check.sh`.

**Phase B — UIUX:**
- `design-discovery` 2.2.0: reference research now mandatory; brand voice / motion / a11y captured; hands off to the new skill.
- New `design-direction` (SK-149): renders 2-3 live HTML/Tailwind mockups from the DNA, user picks ONE before tokens lock (what you pick is what gets built), and flags requirement/UX gaps (control-pattern fitness — the chip-filter mistake) via the new `ux-advisor` agent. `design-tokens` 1.1.0 seeds from the chosen direction + dark-mode pairs + DNA sync check.
- New `agents/ux-advisor.md`; `workscope` 1.4.0 spawns it for early requirement-gap flagging.
- Component reuse is now a hard-blocking gate in `/build` 2.8.0 + backstop `hooks/enforce-component-reuse.sh`.

**Phase C — testing:**
- New `e2e-testing` (SK-150): seed-data logins, mock MFA/OTP/email (Mailhog + TEST_MODE), auth-state reuse, test-data isolation, web (Playwright) + native (Detox/Flutter). `mock-data` 1.3.0 + `data-migration` 1.2.0 write `AI_DOCS/quality/test-fixtures.md`.
- `milestone-validation` 1.2.0 Phase 1b: mandatory milestone E2E (non-POC) on every surface; `hooks/milestone-e2e-gate.sh` blocks the milestone → develop merge without `Verdict: PASS`. testing-rules + mobile-rules gain the E2E rules.

**Phase D — audit, compliance, deploy, branching:**
- Audit logging promoted to a baseline standard for EVERY project: new `docs/audit-log-standard.md`, scaffolded by `guardrails` 1.2.0, gated in `/build`, verified always-on by `/audit` 2.3.0 (+ compliance requirements matrix).
- New Gate 4.5 (Milestone Closure) in `docs/governance-gates.md`. `deployment-planning` 2.2.0 + `infra-planning` 1.2.0: CI/CD created but inactive until full-scope (Gate 5) approval.
- `github-ops` 1.2.0: branching strategy read from `AI_DOCS/deployment/git-strategy.md` — one-branch-per-milestone + staging tier (develop → staging → main), per-milestone promotion re-ask.

**Registry + wiring:** SK-149/SK-150 + ux-advisor registered in catalog.yaml (now 90 skills, 20 agents). 4 new hooks wired in settings.template.json. Framework → 4.5.0.

**Migration:** `git pull` + `bash upgrade.sh` (syncs the 4 new hooks into settings.json). Optional: install Mailhog for the mock-mail E2E path.

## v4.4.0 — QA tooling repairs, SAST/SBOM, branch coverage (2026-06-12)

**Theme:** make the framework's own QA honest, then close the last MEDIUM audit findings.

**skill-lab repairs (the headline):**
- `run-all-tests.sh` had NEVER tested a skill: `find -name "skill.md"` is case-sensitive and every file is `SKILL.md`, so all prior "ALL PASS" results covered agents only. Fixed (`-iname` + case-insensitive location check). The first honest run then exposed rubric drift, also fixed: `allowed-tools:`/`preferred_model:` accepted alongside `tools:`/`model:` (skills vs agents conventions), tools/model absence downgraded FAIL → WARN (optional fields), ADF semantic tiers recognized, placeholder regex word-bounded. External skills (in `skills/` but not in catalog.yaml) are skipped, mirroring retrofit-frontmatter.
- `run-trigger-tests.sh` scored 0 on Windows: the ~40KB catalog excerpt was passed as one `--system-prompt` argv element and Windows caps a command line at ~32,767 chars, so every `claude -p` spawn failed (silently mapped to "error"). The catalog now goes via stdin. First real run: `infra-cost-guard` trigger spec 20/20 PASS.
- `run-trigger-tests.sh` grading hardened: a failed classifier CALL is infrastructure failure, never a datum. Previously "error" counted as a correct negative (error != skill name), so a fully broken classifier scored 4/20 and looked like a description problem. Now: errored prompts are not scored, 3 errors abort the skill's run, any error invalidates the run (no score persisted to catalog.yaml), and the dashboard reports an `Errored` bucket pointing at the CLI/auth instead of `/skill-improve`. Dry-run no longer scores or writes report rows (it previously wrote fake "4/20 FAIL" entries) — it lists the prompts and exits.
- `yaml_helper.py` writes LF always (Windows text mode was rewriting the entire catalog with CRLF on every scoring run, breaking greps and bloating diffs) and `ruamel.yaml` is now installed, activating the helper's comment-preserving round-trip path (`python3.12 -m pip install ruamel.yaml` on other machines).
- Library state after repairs: **105 tested, 105 compliant, 0 warnings, 0 failures** (find-skills skipped as external).

**Metadata + registry hygiene:**
- docx (now SK-147, resolving the SK-047 collision with design-screens), pdf (SK-048), mock-data, python-ai-services/backend/deployment/testing: added `preferred_model: code_focused` + `allowed-tools` + missing ids, version bumps.
- Stale references to removed skills fixed across 11 files (workflow-catalog.yaml, agent-coordination-map, allowed-tools-matrix, model-selection, release-checklist, skill-router 1.0.6, orchestrator 2.0.2, team-release 1.1.2, accessibility-audit 1.0.2, ui-engineering-rules, skill-decision-tree).
- upgrade.sh deprecated-skill scanner fixed: scans only the framework dir in dev checkouts (not sibling collections), skips intentional-reference files (UPGRADING, SKILL-REFERENCE, skill-deprecations, project-context, README), and the pattern no longer false-positives on `/deployment-planning` (hyphen-boundary) or folder paths like `design-system/tokens.json`.

**New checks (closing the deferred MEDIUM audit findings):**
- **SAST** — `/audit` check 7 + `/do` Phase 2 check 6: bandit for Python (HIGH → FAIL), `eslint-plugin-security` presence for TS/JS, semgrep when available (non-Windows). Tool-missing grades CONCERNS, never silently passes.
- **License deny-list + SBOM** — `/audit` check 8 + `/do` Phase 2 check 7: AGPL/SSPL/GPL-3.0 in production deps → CONCERNS (FAIL under `stack.md → license_policy: strict`); `deployment-planning` 2.1.0 Phase 1 gains step 2.5: CycloneDX SBOM generated to `AI_DOCS/deployment/sbom-<version>.json` for production deploys, plus an infra-cost-approval freshness check.
- **Branch coverage** — testing-rules 1.1.0 Rule 7a: branch targets per project type (MVP 60 / Production 75 / Enterprise 85) configured as failing thresholds; Gate 4C (gate-enforcement 1.6.0) checks lines AND branches; qa-testing COVERAGE-TARGETS carries the callout.

**Migration:** `git pull` + `bash upgrade.sh`. No settings or hook changes. Optional: `python3.12 -m pip install bandit` to arm the Python SAST check.

## v4.3.0 — Stack decision matrices + shift-left security (2026-06-12)

**Theme:** recommend the right stack from evidence, and design security in at spec time instead of grepping for it at audit time.

**Stack selection (workscope TECH-OPTIONS.md):**
- **MongoDB vs PostgreSQL decision matrix** — four data-shape discovery questions (transactions/money? related entities + cross-entity reporting? self-contained documents? weekly schema churn?) map to a recommendation. Default when uncertain: PostgreSQL (JSONB covers document needs, the reverse is not true). Hybrid must be earned and name which entities live where.
- **Backend decision signals** — discovery-signal table for NestJS vs Express vs FastAPI vs Django vs Go, plus an explicit NestJS-vs-FastAPI tie-break (AI/ML → FastAPI, real-time/shared TS types → NestJS, else the team's stronger language).
- Every recommendation must cite the matrix and verify versions online (development-rules Rule 31), with the choice + revisit trigger logged in decision-log.

**Stack-vs-schema reconciliation (tech-spec S7):** when the drafted data model contradicts the locked DB (MongoDB + multi-entity transactions/money/3+ joined entities), the spec STOPS and routes through `/change-request` before `api-contract.md` locks. Outcome recorded in decision-log either way. Gate 1 S7 item enforces it (gate-enforcement 1.5.0).

**Shift-left security:**
- **STRIDE-lite threat model in tech-spec S20** — every critical flow (auth, payment, upload, export, admin) lists its top threats tagged S/T/R/I/D/E, each mapped to a mitigation AND an S18 test case. A critical flow with no threat entries fails Gate 1.
- **Security acceptance injection at task seeding** (milestone-planning 1.3.0) — tasks matching auth/payment/upload/export keyword groups get security acceptance criteria injected from S20 (rate limits, audit logs, hashing, idempotency keys, MIME allowlists, signed URLs). Gate 2 verifies the injection.
- **Dependency gate in /build** (2.6.0, mirrored in /do 6.3.0) — when a task touches a package manifest/lockfile: lockfile-sync check + immediate `pnpm audit --prod` / `pip-audit`. New HIGH/CRITICAL advisory on an added/updated package → BLOCKED at the task, not days later at `/audit`.
- **Canonical auth patterns** (security-rules.md 1.2.0, Rules 36-42) — session-vs-JWT decision rule, argon2id/bcrypt ≥12, refresh rotation with reuse detection, server-side logout, reset-token discipline, TOTP for admins, OAuth state/PKCE/claim verification. Projects stop reinventing auth.

**Migration:** `git pull` + `bash upgrade.sh`. No settings or hook changes in this release.

## v4.2.0 — Infra cost guard + enforcement pass (2026-06-12)

**Theme:** turn advisory rules into blocking gates. Infra spend now has the same guard as LLM spend, scope closure gates shipping, and drift findings block instead of sitting in a report.

**New skill:**

| ID | Name | What it does |
|---|---|---|
| SK-146 | `infra-cost-guard` | Infra sibling of `ai-cost-guard`: per-resource + total monthly cost table (with delta vs approved spend and growth projection), 10 risk flags, optimization recommendations, written user approval appended to `AI_DOCS/memory/infra-cost-approvals.md` |

**New hook:** `infra-cost-gate.sh` (PreToolUse on Bash) — blocks `terraform|tofu apply|destroy`, `pulumi up`, `cdk deploy`, CloudFormation stack mutations, and direct `aws`/`gcloud`/`az` instance/db/cluster creation unless the approvals ledger has an `APPROVED` entry dated today (UTC). Escape: `ADF_INFRA_APPROVED=on` (must be logged in decision-log). Fails open outside ADF projects (no `AI_DOCS/`).

**New ledger:** `AI_DOCS/memory/infra-cost-approvals.md` — append-only, written by the skill, read by the hook.

**Rule changes (`rules/infrastructure-rules.md` 1.4.0):**
- Rule 4 rewritten: staging is **production parity**. Same topology, services, engine versions, network shape, and deploy pipeline. Instance size is the only permitted delta, parity is the default, and a size delta needs a logged `/infra-cost-guard` approval. Dev stays minimal-cost.
- New Rule 19: infra cost guard mechanics + mandatory billing alarm / budget alert in every environment plan + re-approval triggers (new >$1/mo resource, >20% cost drift, environment promotion, region change).
- Rule 3 now names its enforcement (skill + ledger + hook). Rule 7 checklist gains item 13.

**Enforcement pass (existing skills):**
- `gate-enforcement` 1.3.0 — new **Gate 5: Scope Closure & Production Readiness**: feature-to-task closure map, gold-plating check, CR propagation check, drift freshness, written to `AI_DOCS/audit/scope-closure-report.md`. Gate 4D gains a fresh-drift-scan item (Phase A/C/D clean).
- `ship` 2.1.0 and `/do` 6.1.0 Phase 3 — pre-flight now refuses without Gate 5 PASS (report fresher than the last task-ledger change) and with unacknowledged drift findings.
- `build` 2.4.0 — new Drift refusal: Phase A (undocumented routes) and Phase D (unresolved STALE) findings block task pickup. Phase B (planned-not-built) never blocks.
- `/do` 6.1.0 — milestone close step 0 forces a fresh drift scan and keeps the milestone open while Phase A/C/D findings exist. Activation Map arms `infra-cost-guard` as BLOCKING when the infra plan has paid resources or a task touches `infrastructure/**`.

**Settings:** `settings.template.json` 4.2.0 adds the INFRA-COST-GATE PreToolUse entry. `upgrade.sh` syncs the hooks section automatically.

**Quality pass (same release):**

- **Full-suite regression per task** — `build` 2.5.0 verify step (d): after the scoped test run and build, the FULL test suite runs unscoped (or `stack.md → test.regression`). A previously green test failing → BLOCKED naming the regressing test and the suspect task. Mirrored in `/do` 6.2.0's verify table.
- **Mandatory per-task code review** — `/do` 6.2.0 dispatches the `code-reviewer` agent on every task's diff after verification passes. APPROVE → `✓ review` stamp. CONCERNS → fix or accept with reason (real defects cannot be accepted). REJECT → task flips BLOCKED + defect logged. POC projects may defer to milestone close, visibly stamped.
- **Defect ledger** — new `AI_DOCS/quality/defect-log.md` (schema in `/do` Phase 1 and `memory-protocol` 2.3.0): one row per defect found after its task was DONE, with phase-found, severity, escaped flag, prevention. Written by `/do`, `debugger` 1.1.0, QA. The escaped-defect rate (escaped / delivered tasks, target <1%) appears in `/do status`, `milestone-validation` 1.1.0 (new blocking Defect density check), and Gate 5.
- **Retrospective feedback loop** — `retrospective` 1.2.0 Step 2.5 (mandatory): every escaped defect must produce a named rule/gate/check edit, stamped back into the defect row. A retro that changes no rule is incomplete.
- **E2E golden path gates shipping** — `ship` 2.2.0, `/do` Phase 3, and Gate 5 Part D require a green `tests/e2e/` or `tests/smoke/` run. A UI project with no E2E suite is blocked until one exists (or an explicit logged override).
- **Change requests re-baseline** — `change-request` 2.1.0: the impact report gains an Estimate impact table (tasks/effort/dates/cost, "no impact" must be justified), new Step 5 re-baselines milestones, bumps the scope version in `requirement-changelog.md` (new versioned-row template), and produces a client-facing `CR-<NNN>-addendum.md` for sign-off. Removals walk the same protocol as additions.
- **Traceability closed end-to-end** — tech-spec S21 gains a **Task ID(s)** column. `milestone-planning` 1.2.0 writes seeded task IDs back into S21 (mandatory). Gate 2 verifies both directions (feature→task, task→feature). Gate 5 builds its scope-closure map from that column. Requirements without tests now fail Gate 1.

**Migration steps:**
```bash
cd .claude
git pull
bash upgrade.sh            # syncs new skill, hook, and settings hooks-section
```

**Verify after upgrade:**
1. `terraform apply` (or a dry `echo` test through the Bash tool matching the pattern) without a ledger entry → blocked with the INFRA COST GATE message.
2. Append `[<today UTC>] test — APPROVED by user — Est. $0/month` to `AI_DOCS/memory/infra-cost-approvals.md` → the same command passes.
3. `/do ship` on a project without `AI_DOCS/audit/scope-closure-report.md` → refuses and names Gate 5.

## v4.0.0 — ADF v4 (2026-05-13)

**Breaking:** `settings.template.json` has a new SessionStart hook (`cron-tick`). Run `bash setup.sh --update-settings` to merge it.

**New directories created by setup.sh:**
- `cron/jobs.json` — initialized from `cron/jobs.json.template` (3 built-in jobs, all disabled)
- `plugins/official/`, `plugins/user/` — plugin directories
- `~/.adf/shared/`, `~/.adf/projects/` — cross-project memory home

**New skills:**

| ID | Name | What it does |
|---|---|---|
| SK-135 | `schedule` | Manage recurring automated tasks (cron) |
| SK-136 | `install-plugin` | Install an ADF plugin |
| SK-137 | `list-plugins` | List installed and available plugins |
| SK-138 | `skill-curator` | Grade skill library quality + write improvement roadmap |
| SK-139 | `share-decision` | Promote a decision to cross-project shared memory |
| SK-140 | `import-conventions` | Bootstrap a new project from shared team conventions |
| SK-141 | `history-query` | Search cross-session decisions/tasks via SQLite FTS5 |

**New agent:** `skill-curator` (AG-018, Sonnet tier)

**New hooks:**
- `cron-tick.sh` — SessionStart: checks for due scheduled tasks
- `shared-memory-sync.sh` — Stop: syncs [SHARED] decisions to `~/.adf/`

**New directories in framework:**
- `cron/` — scheduler.py, jobs.json.template
- `state/` — schema.sql, db.py
- `plugins/` — plugin system
- `scripts/` — install-plugin.sh

**Requirements:**
- Python 3.8+ on `PATH` (check: `python3 --version`). All scripts use stdlib only — no `pip install` needed.
- SQLite FTS5 must be enabled (it is in the default Python builds on macOS, Windows, and most Linux distros).
  Verify: `python3 -c "import sqlite3; sqlite3.connect(':memory:').execute('CREATE VIRTUAL TABLE t USING fts5(x)')"`
  If that raises `OperationalError: no such module: fts5`, rebuild Python with `--enable-loadable-sqlite-extensions` or install `libsqlite3-dev` and recompile.

**Migration steps:**
```bash
cd .claude
git pull

# 1. Verify Python 3.8+ is available
python3 --version

# 2. Merge new SessionStart hook (cron-tick) into your project's settings.json
bash setup.sh --update-settings

# 3. Create new directories and initialize cross-project home (~/.adf/)
bash setup.sh

# 4. Initialize the SQLite state database for this project
#    (requires .claude-project-id in the project root — created by /do on first run)
python3 state/db.py init
```

---

## 🚨 After you pull — action required (one-time, per-project)

When you `git pull` into an existing project that was set up before v3.2, the framework files are updated but **your project's `settings.json` is NOT touched** (it's gitignored — your personal copy of the template). That means any hook events added after your original install don't fire until you reconcile.

**Run this after every major pull:**

```bash
cd .claude
git pull                         # you'll do this anyway
bash upgrade.sh                  # reports what changed (auto-runs via post-merge hook too)
bash setup.sh --update-settings  # REQUIRED if upgrade.sh flags missing events
bash setup.sh                    # also installs any new dependencies (e.g. BurntToast on Windows)
```

`upgrade.sh` now detects the drift explicitly. If your `settings.json` is missing any of the v3.2+ hook events (`PreCompact`, `UserPromptSubmit`, `Notification`), you'll see:

```
[4/5] settings.json freshness check...

  ACTION REQUIRED - your settings.json is missing hook events:
       - PreCompact
       - UserPromptSubmit
       - Notification

  Fastest fix:
    bash .claude/setup.sh --update-settings
```

When it runs in auto mode (via `post-merge` or `version-check.sh`), the same notice is written to `AI_DOCS/memory/pending-migration.md`, which `session-start.sh` surfaces in the next session's banner — so you can't miss it.

### What `--update-settings` does

1. Backs up your current `settings.json` to `settings.json.backup.YYYYMMDD-HHMMSS`
2. Copies the latest `settings.template.json` over `settings.json`
3. Clears any pending-migration notice

**You lose any custom permissions** added to `settings.json` — reinstate them manually from the backup. This is why the backup is created with a timestamp.

### If you don't want the notifications dependency

```bash
bash setup.sh --no-notifications --update-settings
```

Skips the BurntToast install (Windows) and prints the apt/dnf command only for Linux.

### Version-specific post-pull checklists

Quick reference for what changed in each release (details further below):

| From → To | Must do after pull |
|---|---|
| pre-v3.2 → v3.8 | **`bash setup.sh --update-settings`** (adds 9 new hook events); **`bash setup.sh`** (installs BurntToast on Windows); in Claude Code run `/project-context` to refresh CLAUDE.md |
| v3.1 → v3.2+ | Above — v3.2 introduced `PreCompact`, which is the easiest missing-event to verify with `grep PreCompact .claude/settings.json` |
| v3.6 → v3.7 | `--update-settings` is optional (no new hook events added in 3.7 — ledger-writer is called by other hooks, not a lifecycle event). But re-read DEVELOPER.md Section 5.1 to adopt the task-ledger workflow. |
| v3.7 → v3.8 | `--update-settings` required (adds `Notification` event); re-run `setup.sh` to install BurntToast |

### Zero-downtime path for existing clones (recommended)

If you have active work you don't want interrupted:

```bash
# 1. Pull framework files (auto-migrates version marker, hooks, docs, template)
cd .claude && git pull

# 2. Check drift — does NOT change your settings.json
bash upgrade.sh

# 3. When you're ready to adopt the new hooks (end of workday, between features):
bash setup.sh --update-settings
# Restart any open Claude Code session so it re-reads settings.json
```

Until step 3, you stay on your existing hook set. The framework files are new but the active event wiring is unchanged.

---

## How to update in any project

As of v3.1.1, `upgrade.sh` fires automatically in two places so you never have to remember it:

1. **Git `post-merge` hook** (`hooks/git/post-merge`) — runs after every `git pull` inside `.claude/`. Wired up via `core.hooksPath` by `setup.sh` on install, and self-healed by `upgrade.sh` on first manual run for existing installs.
2. **Claude Code `SessionStart` hook** (`hooks/version-check.sh`) — fallback for pulls done outside `.claude/` (IDE git UI, editor plugins). On session start, it compares `.adf-version` vs `.adf-version.previous` and runs `upgrade.sh --auto` if they differ.

You can still run it manually any time:

```bash
bash .claude/upgrade.sh           # interactive, with recommended next steps
bash .claude/upgrade.sh --auto    # quiet, hook-friendly
```

`settings.json` and `AI_DOCS/` are never touched by `git pull`.

`upgrade.sh` is **safe to re-run**: it detects already-applied migrations and skips them. It does NOT modify your code — only `.claude/skills/**/SKILL.md` frontmatters (idempotent retrofit) and `.adf-version.previous` (version marker).

### What `upgrade.sh` does

1. **Frontmatter retrofit** — adds `license: Proprietary`, `compatibility: "Claude Code 1.x"`, `metadata.author: WebOsmotic Private Limited` to any SKILL.md missing them (framework skills + any project-level custom skills in `.claude/skills/`). Idempotent.

2. **Stale reference scan** — greps your project for references to removed skills (`/claude-md`, `/deployment`, `/design-system`) and lists them so you can fix manually.

3. **CLAUDE.md staleness check** — detects if your `CLAUDE.md` was generated by v3.0 (references `/claude-md` skill, missing v3.1 gates) and prompts you to regenerate via `/project-context`.

4. **Pre-commit hook reminder** — offers to install the secrets scanner at `.git/hooks/pre-commit`.

### CLAUDE.md regeneration after upgrade

Because `CLAUDE.md` sits at your project root (not inside `.claude/`), `git pull` doesn't touch it. `upgrade.sh` detects staleness but can't regenerate it directly — it needs Claude Code's context.

**After running `upgrade.sh`, open Claude Code and invoke:**

```
/project-context
```

(This is the skill formerly known as `/claude-md`.) It reads your current `AI_DOCS/memory/` state and regenerates `CLAUDE.md` with v3.1 gates + updated skill references. No data loss — your project state is preserved; only the summary file rewrites.

---

## v3.8.0 (current)

Release focus: **Cross-platform desktop notifications with auto-install.** Claude Code's `Notification` event (fired when it needs your attention) now surfaces as a native OS toast. Works on Windows 10/11, macOS, and Linux out of the box.

### What changed (non-breaking)

1. **`hooks/notify.sh`** *(new)* — bash dispatcher. Reads Claude Code's JSON payload from stdin, detects OS via `uname -s`, extracts message (and — for Stop events — enriches with the active task's Request from task-ledger.md), delegates to the platform notifier. Fire-and-forget; never blocks the triggering event. Honors two env vars:
   - `ADF_NOTIFY_DISABLED=1` — global opt-out
   - `ADF_NOTIFY_ON_STOP=1` — opt-in for Stop-event notifications (default: off, Notification-only)

2. **`hooks/notify-windows.ps1`** *(new)* — PowerShell notifier. Prefers `BurntToast` module; falls back to raw `Windows.UI.Notifications`; last-resort fallback to `System.Windows.Forms.NotifyIcon` balloon. Robust across PowerShell contexts.

3. **`hooks/notify-macos.sh`** *(new)* — uses built-in `osascript`. No install needed. Prefers `terminal-notifier` if present (brew).

4. **`hooks/notify-linux.sh`** *(new)* — uses `notify-send` (libnotify-bin). Falls back to `dunstify` for dunst users.

5. **`setup.sh`** *(extended)* — platform detection + auto-install of notification dependencies:
   - **Windows**: runs `Install-Module BurntToast -Scope CurrentUser -Force -AllowClobber`. If already installed, skips. If install fails (offline, corporate policy), continues gracefully — raw API fallback still works.
   - **macOS**: no-op (osascript is built-in). Suggests `brew install terminal-notifier` as optional upgrade.
   - **Linux**: checks `notify-send`; if missing, prints the correct install command for detected package manager (`apt`, `dnf`, `pacman`).
   - **New flag**: `bash setup.sh --no-notifications` skips this entire block.

6. **`settings.template.json`** — new `Notification` event block wiring `notify.sh`. Version comment bumped.

7. **`CLAUDE.template.md`** — hooks table refreshed.

8. **`DEVELOPER.md`** — new Section 13b "Desktop notifications" with platform specifics, disable instructions, and troubleshooting.

### Migration from v3.7

Auto-applied by `upgrade.sh` / `git pull` post-merge hook:

1. `settings.template.json` gains a new `Notification` event block. If you have customized `settings.json`, merge manually using `settings.template.json` as reference.
2. All four new hook files ship executable; no action needed.
3. `.adf-version` bumps `3.7.0` → `3.8.0`.
4. **BurntToast install is not retroactive.** Existing clones do NOT auto-install BurntToast when they pull v3.8. To get it, either:
   - Re-run setup: `bash .claude/setup.sh` (safe — it skips already-configured pieces)
   - Manually: `powershell -Command "Install-Module BurntToast -Scope CurrentUser -Force"`
   - Skip entirely: the raw Windows.UI.Notifications fallback works without BurntToast (less reliable)

### Gotchas

- **Windows notification permission.** Windows 10/11 may prompt to allow notifications for "Claude Code" on first fire. Approve it — otherwise subsequent toasts are silently suppressed.
- **macOS notification permission.** Same pattern: first `osascript` call triggers a system prompt to allow "Script Editor" (or whatever host) to post notifications. Grant once, works forever.
- **Linux Wayland quirks.** Some Wayland compositors (sway, Hyprland without mako) ignore `notify-send`. Install `dunst` + `dunstify` or the compositor's native notifier.
- **Corporate PowerShell policy.** If `Install-Module` is blocked, setup.sh reports the failure and moves on. Notifications still work via the raw API fallback — just less polished.
- **Stop-event noise.** If you opt into `ADF_NOTIFY_ON_STOP=1` and you run many quick turns, every single turn will toast. Consider using it only for long-running work (e.g. overnight batch refactors).

### Verification

After upgrading:

1. Check hooks exist: `ls .claude/hooks/notify*` — expect 4 files (dispatcher + 3 platform).
2. Windows: `powershell -Command "Get-Module -ListAvailable BurntToast"` should show the module. If empty, re-run `bash .claude/setup.sh`.
3. Manual fire test:
   ```bash
   echo '{"hook_event_name":"Notification","message":"hello from ADF"}' | bash .claude/hooks/notify.sh
   ```
   A toast should appear within 1–2 seconds.
4. Stop-event enrichment: with `ADF_NOTIFY_ON_STOP=1` set and an active task in `task-ledger.md`:
   ```bash
   ADF_NOTIFY_ON_STOP=1 bash -c 'echo "{\"hook_event_name\":\"Stop\"}" | bash .claude/hooks/notify.sh'
   ```
   Toast title should read "Claude Code — task paused" with the active Request as body.
5. Opt-out: `ADF_NOTIFY_DISABLED=1 echo '{"message":"test"}' | bash .claude/hooks/notify.sh` — silent no-op.

### Cumulative framework footprint (v3.1 → v3.8)

20 hooks. 9 standard memory files. Cross-platform desktop notifications. Compaction survival mechanical. Task decomposition + chunked execution + code review + drift detection + milestone auditing all event-driven and advisory.

The framework now stays out of your way until you need it — and pings your desktop the moment you do.

---

## v3.7.0

Release focus: **Unified compaction memory via the Task Ledger.** Closes the gap where the originating user request, the overall plan shape, and cumulative progress were each only partially preserved across compaction.

### What changed (non-breaking)

1. **`hooks/ledger-writer.sh`** *(new)* — shared helper for the task ledger. Four subcommands:
   - `--open REQUEST PLAN_PATH CHUNK_COUNT TASK_ID [--force]` — seed the Active block. Refuses if another task is already active.
   - `--progress CHUNK_PATH` — append a Progress log entry, regenerate the Status 1-liner from `plan.md`.
   - `--close [COMMIT_HASH]` — move Active → Archive (1-liner row), trim Archive to 20 most-recent, clear Active.
   - `--refresh-status` — regenerate the Status field only; idempotent.

   Uses `awk` for sentinel-bounded rewrites. Scrubs secrets via `hooks/scrub.sh`. Telemetry via `hooks/log-event.sh`.

2. **`AI_DOCS/memory/task-ledger.md`** *(new standard memory file)* — stores the current task's Request, Plan, Status, Next action, and Progress log between `<!-- @active-begin -->` / `<!-- @active-end -->` sentinels, plus an Archive of up to 20 closed tasks below.

3. **`hooks/pre-compact.sh`** *(extended)* — reads the ledger Active block and emits it as the FIRST section of every compaction snapshot. ~400 bytes. 3 KB cap unchanged (typical snapshot now ~2 KB).

4. **`hooks/session-start.sh`** *(extended)* — new "Current Work (task-ledger)" banner section showing Request / Plan / Status / Next action in 4 lines.

5. **`hooks/post-chunk-review-detect.sh`** *(extended)* — on chunk DONE: existing review-queue write PLUS `ledger-writer.sh --progress` to update ledger automatically.

6. **`hooks/task-router.sh`** *(extended)* — opt-in ad-hoc auto-seed. When `LEDGER_AUTOSEED_ADHOC=on` AND task-intent detected AND no active ledger, seeds a minimal Active block with the user's prompt as Request and `(ad-hoc)` as Plan. **Default OFF** — enable explicitly in `.claude/settings.local.json` env if desired.

7. **`hooks/memory-curator.sh`** *(extended)* — new check #7: Archive rows > 30 → suggest truncation to 20.

8. **`skills/task-planner/SKILL.md`** — Phase 3.4 (Update INDEX.md) now documents the `ledger-writer.sh --open` call. Phase 5.6 (Update Memory) documents `--close`.

9. **`skills/memory-protocol/SKILL.md`** — adds `task-ledger.md` to the memory file map with the six Active fields documented.

10. **`CLAUDE.template.md` / `README.md` / `DEVELOPER.md`** — updated. DEVELOPER.md gains a new Section 5.1 "The Task Ledger" section; Section 14 "five questions" now has the ledger as answers 1 and 2.

11. **`settings.template.json`** — version comment bumped. No new hook wiring (ledger-writer is called by other hooks/skills, not wired as a lifecycle hook).

### New canonical memory file

| Path | Purpose | Written by |
|---|---|---|
| `AI_DOCS/memory/task-ledger.md` | Active task + progress + archive of closed tasks | `hooks/ledger-writer.sh` via `/task-planner` + `post-chunk-review-detect.sh` + (opt-in) `task-router.sh` |

### Migration from v3.6

Auto-applied by `upgrade.sh` / `git pull` post-merge hook:

1. `settings.template.json` version comment bumped. No hook wiring changes (ledger-writer is invoked by other components, not Claude Code lifecycle events).
2. `ledger-writer.sh` ships executable; no action needed.
3. `.adf-version` bumps `3.6.0` → `3.7.0`.
4. `task-ledger.md` is created on first `ledger-writer.sh` call — no pre-seeding needed.

**Retroactive state:** if you upgrade mid-task, the ledger Active block is initially empty. It gets populated on the next `/task-planner` invocation or (opt-in) on the next task-intent prompt. Existing projects are otherwise unaffected.

### Gotchas

- **One active task at a time.** `--open` refuses with exit code 3 if Active is already populated. Close the prior task or pass `--force` as a 5th argument. This enforces the ADF single-active-task invariant.
- **Ledger vs plan.md.** `plan.md` remains the authoritative source for chunk state. `ledger-writer.sh --progress` reads plan.md read-only to regenerate Status — never writes to plan.md.
- **Scope creep within a task.** The Request field is NOT rewritten when the user adds scope mid-task. Append a Progress log line instead: `Scope added: audit logging (user request mid-task)`.
- **Archive truncation is manual.** Memory-curator suggests it when rows > 30; `--close` trims Active's impact but does not trim archive. Use `head -n 20` on rows after `## Archive` heading when you want to prune older entries.
- **Sentinels must be preserved.** Hand-edits outside the sentinels are safe. Deleting the sentinels will cause `--open` / `--progress` / `--close` to recreate them, but Active-block content may be lost.

### Verification

After upgrading:

1. Fresh open: `bash .claude/hooks/ledger-writer.sh --open "Test task" "AI_DOCS/planning/tasks/active-task.md" 3 "T-TEST"` — confirm `AI_DOCS/memory/task-ledger.md` is created with the Active block populated.
2. Progress: with a mock chunk file `Status: DONE`, run `bash .claude/hooks/ledger-writer.sh --progress <chunk-path>` — confirm a new Progress log line and regenerated Status.
3. Compaction integration: trigger `/compact`. Confirm `AI_DOCS/memory/compaction-snapshot.md` starts with `## Current task (from task-ledger)` and includes Request/Plan/Status/Next action + last 3 progress entries.
4. Session-start banner: start a new session with a populated ledger. Confirm `=== Current Work (task-ledger) ===` appears in the banner with the 4 fields.
5. Close: `bash .claude/hooks/ledger-writer.sh --close abc1234` — confirm Active clears and Archive gains a 1-liner row.

### Cumulative memory-survival story (v3.1 → v3.7)

| Layer | Survives compaction via | Added in |
|---|---|---|
| Current task Request/Plan/Status/Next | `task-ledger.md` Active block (first snapshot section) | **v3.7** |
| Last 3 raw user prompts | `user-prompts.log` tail | v3.3 |
| Last 5 decisions | `decision-log.md` tail | v3.3 |
| Active chunk excerpt | Pre-compact section | v3.3 |
| Gate status | Pre-compact section | v3.2 |
| Unresolved CRITICAL/HIGH findings | Pre-compact section | v3.2 |
| Pending AI cost approvals | Pre-compact section | v3.2 |
| Recent skill invocations | Pre-compact section | v3.2 |

Seven layers of preservation. The ledger is now the canonical first stop post-compaction.

---

## v3.6.0

Release focus: **Close the remaining quality-per-token gaps.** Three small additions that complete the "event-driven automation" arc started in v3.3 and document everything that's accumulated since.

### What changed (non-breaking)

1. **`hooks/session-state-refresher.sh`** *(new)* — `UserPromptSubmit`. Counts prompts since `session-state.md` was last written. Every 15 prompts without a refresh, emits a short stdout nudge suggesting the user update `session-state.md`. Counter auto-resets on mtime change. State in `AI_DOCS/memory/.prompt-counter` and `.prompt-counter-last-mtime`.

2. **`hooks/session-start.sh` Next Chunk Preview** *(extended)* — when `INDEX.md` has a complex active task with a PENDING chunk, the banner now shows the upcoming chunk's file path, title, `## Files Affected` list, and verification command — without loading file contents. Lightweight orientation primer.

3. **`hooks/drift-detector.sh` Phase C remediation** *(sharpened)* — when uncovered acceptance criteria are found, the report now includes a ready-to-paste `/task-planner` command that delegates to `test-writer`. One-click remediation instead of "figure it out."

4. **`DEVELOPER.md`** *(major update)* — new section 13a "Automation — the hooks that work while you work" fully catalogs all 18 hooks, when each fires, rate limits, outputs, and your expected action. Memory files table rewritten to separate human-authored vs hook-authored. Six new FAQ entries for v3.4–3.6 behaviors. Habits list grows to 11 with "When a queue surfaces on SessionStart, act on it before new work."

5. **`settings.template.json`** — new `UserPromptSubmit` entry wiring session-state-refresher. Version comment bumped.

6. **`CLAUDE.template.md`** — hooks table refreshed with the two v3.6 additions.

### Migration from v3.5

Auto-applied by `upgrade.sh` / `git pull` post-merge hook:

1. `settings.template.json` gains one new `UserPromptSubmit` entry. If you have customized `settings.json`, merge manually.
2. The new hook ships executable; no action needed.
3. `.adf-version` bumps `3.5.0` → `3.6.0`.

No memory model changes. The session-state-refresher's internal state files (`.prompt-counter`, `.prompt-counter-last-mtime`) are created on demand; safe to delete anytime (counter simply restarts).

### Gotchas

- **Refresher nudge appears mid-turn.** Because it's stdout from a `UserPromptSubmit` hook, the nudge lands in Claude's context alongside your prompt. Claude will see it and either (a) refresh `session-state.md`, (b) explain why it's not refreshing, or (c) ignore. This is working as intended — the point is to surface it, not enforce.
- **Next Chunk Preview only fires for complex tasks.** Simple tasks stored in `active-task.md` don't have per-chunk files; the existing simple-task resume banner covers them.
- **Counter file is per-project, not per-session.** A long project that runs across multiple sessions keeps counting. If the first 14 prompts of a session were from a prior machine, the 1st prompt on the new machine may trigger the nudge immediately. That's desired — the goal is refresh cadence, not session boundaries.

### Verification

After upgrading:
1. Send 14 prompts that don't modify `session-state.md`. Confirm no nudge. Send the 15th — expect the nudge to appear in Claude's context.
2. Touch `session-state.md` (`touch AI_DOCS/memory/session-state.md`). Send another prompt. Counter should reset to 1.
3. With a complex active task and a PENDING chunk, start a new session. Banner should show `=== Next Chunk Preview ===` with the upcoming chunk's metadata.
4. Re-run drift-detector against a spec with an uncovered criterion. Phase C output now includes a remediation block with an exact `/task-planner` command.

### Cumulative automation footprint (v3.3 → v3.6)

| Version | Hook | Kind |
|---|---|---|
| v3.3 | `user-prompt-log.sh` | capture |
| v3.3 | `task-router.sh` | nudge |
| v3.3 | `enforce-chunk-scope.sh` | enforcement |
| v3.3 | `pre-compact.sh` (enriched) | snapshot |
| v3.4 | `post-chunk-review-detect.sh` | queue |
| v3.4 | `memory-curator.sh` | advisory |
| v3.5 | `drift-detector.sh` | scanner |
| v3.5 | `milestone-audit-detect.sh` | queue |
| v3.6 | `session-state-refresher.sh` | nudge |

Nine new automations in four versions. Each is advisory or trivially escapable. Combined, they close the major context-loss, scope-drift, and quality-leak paths.

---

## v3.5.0

Release focus: **Cross-artifact drift detection + milestone-close auditing.** Two new detect-and-queue hooks that catch the divergence classes `/milestone-validation` only surfaces at release time.

### What changed (non-breaking)

1. **`hooks/drift-detector.sh`** *(new)* — `SessionStart`, rate-limited to once per 24h. Three independent phases, each skipped if its input is missing:
   - **Phase A** — routes in code (`src/`, `app/`, `backend/`, `api/`) that are NOT documented in `AI_DOCS/architecture/api-contract.md`.
   - **Phase B** — routes in `api-contract.md` that are NOT implemented in code.
   - **Phase C** — acceptance criteria in `AI_DOCS/planning/tech-spec.md` whose keywords have no matching test file in `tests/`, `test/`, `__tests__/`, `spec/`, or `src/**/*.test.*`.

   Supports Express, Fastify, NestJS decorators, FastAPI/Flask decorators. Output: `AI_DOCS/quality/drift-report.md`. Advisory — no agent invocation, pure bash/grep/awk. Deletes the report when drift clears.

2. **`hooks/milestone-audit-detect.sh`** *(new)* — `PostToolUse` on Edit/Write to `AI_DOCS/memory/gate-status.md`. When a `PHASE-GATE` row reaches `APPROVED`, queue an entry in `AI_DOCS/memory/milestone-audit-queue.jsonl`:
   ```json
   {"ts":"...","key":"M2|2026-04-20","milestone":"M2","gate_date":"2026-04-20","summary":"...","status":"pending"}
   ```
   Idempotent per (milestone, date) pair. Next session banner prompts running `/project-audit` to close out.

3. **`hooks/session-start.sh`** *(extended)* — two new banner sections:
   - **Drift Report** — summarizes A/B/C counts and points to the full report path.
   - **Milestone Audit Queue** — lists pending PHASE-GATE approvals awaiting `/project-audit`.

4. **`settings.template.json`** — new `SessionStart` entry for drift-detector (runs before `session-start.sh` so the banner finds the report). New `PostToolUse` entry for milestone-audit-detect. Version comment bumped.

5. **`CLAUDE.template.md`** — hooks table refreshed.

### New memory/quality files in v3.5

| File | Purpose | Written by |
|---|---|---|
| `AI_DOCS/quality/drift-report.md` | Advisory drift findings (routes, contract, tests) | `drift-detector.sh` (auto) |
| `AI_DOCS/memory/milestone-audit-queue.jsonl` | Queue of PHASE-GATE approvals awaiting project audit | `milestone-audit-detect.sh` (auto) |
| `AI_DOCS/memory/.drift-last-run` | Unix timestamp for 24h rate limit | `drift-detector.sh` internal |

### Migration from v3.4

Auto-applied by `upgrade.sh` / `git pull` post-merge hook:

1. `settings.template.json` gains a new `SessionStart` entry (drift-detector) and a new `PostToolUse` entry (milestone-audit-detect). If you have customized `settings.json`, merge manually.
2. Both new hooks ship executable; no action needed.
3. `.adf-version` bumps `3.4.0` → `3.5.0`.

**No retroactive scanning.** The drift-detector runs on the first SessionStart after upgrade; milestone-audit-detect only fires on the *transition* to APPROVED, not on existing APPROVED rows.

### Gotchas

- **Drift detector is heuristic.** Expect some false positives from route patterns not matched by the stock regexes (e.g., custom route helpers). Every finding includes the file:line — verify before acting. Route extraction supports the common Node/Python decorators; if you use a less common framework, the findings may under-report.
- **Phase C keyword matching is imperfect.** A criterion like "the system shall return 401 on invalid token" maps to keywords `system / return / invalid / token`. If your test is named `should_reject_bad_auth`, the match may miss even though coverage exists. Treat Phase C as a pointer, not a verdict.
- **Milestone audit queue doesn't self-clear.** After running `/project-audit`, update the queue entry's `"status"` from `"pending"` to `"reviewed"` or `"closed"`. Memory-curator flags the queue if depth ≥ 3 unclaimed.
- **Drift scan can be slow on large repos.** If `grep -rn` across `src/` exceeds a few seconds, consider tightening the search via settings.local.json (skip the hook) or forking the hook to limit scope.

### Verification

After upgrading:
1. Add a route in code (e.g. `router.get('/new', …)`) but don't update `api-contract.md`. Force the scan: `rm AI_DOCS/memory/.drift-last-run; bash .claude/hooks/drift-detector.sh`. Confirm `drift-report.md` lists the route in Phase A.
2. Add `| PHASE-GATE (M2) | 2026-04-23 | APPROVED | ... |` to `gate-status.md` via an Edit tool call. Confirm `milestone-audit-queue.jsonl` gets one entry.
3. Start a new session — banner should show `=== Drift Report ===` and `=== Milestone Audit Queue (1) ===`.

---

## v3.4.0

Release focus: **Event-driven automation.** Two new hooks turn manual chores ("remember to code-review this chunk", "remember to prune memory files") into automatic detect → queue → session-start surface cycles. Both are advisory — they never modify your code or memory without your say-so.

### What changed (non-breaking)

1. **`hooks/post-chunk-review-detect.sh`** *(new)* — `PostToolUse` on Edit/Write/MultiEdit. When a `chunk-NN-*.md` file's `Status:` header flips to `DONE`, appends a pending entry to `AI_DOCS/memory/pending-reviews.jsonl`:
   ```json
   {"ts":"...","chunk_file":"active/slug/chunk-02-*.md","plan":"active/slug/plan.md","files":[...],"status":"pending"}
   ```
   Idempotent per chunk path; duplicate queueing is skipped.

2. **`hooks/memory-curator.sh`** *(new)* — `Stop` event, rate-limited to once per 24h via `AI_DOCS/memory/.curator-last-run`. Checks:
   - `decision-log.md` row count > 100
   - `metrics.jsonl` size > 5 MB
   - `user-prompts.log` size > 5 MB
   - Active task mtime > 14 days
   - `compaction-snapshot.md` age > 7 days
   - `pending-reviews.jsonl` queue depth ≥ 3

   If any breach, writes `AI_DOCS/memory/curator-suggestions.md` with remediation commands. Never auto-modifies.

3. **`hooks/session-start.sh`** *(extended)* — two new banner sections:
   - **Pending Chunk Reviews** — lists up to 5 chunks awaiting review with a pointer to `agents/code-reviewer.md` Chunk Review Mode.
   - **Memory Curator Suggestions** — prints the `## Suggestions` section from `curator-suggestions.md`.

4. **`agents/code-reviewer.md`** *(bumped to v1.1.0)* — adds a Chunk Review Mode section:
   - Read the chunk file; review ONLY `## Files Affected`.
   - Append findings under a new `## Review Findings` section in the chunk file itself.
   - Recommend `APPROVE` or `REWORK` based on severity.
   - Rewrite the matching `pending-reviews.jsonl` row to `"status":"reviewed"` or `"status":"blocked"`.
   - `tools` gains `Edit` (needed to append findings and update the queue); still no `Write` or `Bash`.

5. **`settings.template.json`** — new PostToolUse entry for chunk-review-detect, new Stop entry for memory-curator. Version comment bumped.

6. **`CLAUDE.template.md`** — hooks table refreshed with both new hooks.

### New memory files in v3.4

| File | Purpose | Written by |
|---|---|---|
| `AI_DOCS/memory/pending-reviews.jsonl` | Queue of chunks closed without code review | `post-chunk-review-detect.sh` (automatic) |
| `AI_DOCS/memory/curator-suggestions.md` | Advisory list of memory hygiene actions | `memory-curator.sh` (automatic, 24h cadence) |
| `AI_DOCS/memory/.curator-last-run` | Unix timestamp for rate-limiting | `memory-curator.sh` internal |

### Migration from v3.3

Auto-applied by `upgrade.sh` / `git pull` post-merge hook:

1. `settings.template.json` gains two new hook entries (PostToolUse and Stop). If you have customized `settings.json`, merge manually.
2. Both new hooks ship executable; no action needed.
3. `agents/code-reviewer.md` gains a Chunk Review Mode section — backward-compatible; the default (non-chunk) invocation still works.
4. `.adf-version` bumps `3.3.0` → `3.4.0`.

No memory migration. The two new memory files are created on-demand.

### Gotchas

- **Pending review queue doesn't self-clear.** When a review is done, Claude (or you) must rewrite the entry with `"status":"reviewed"` / `"blocked"`. See `agents/code-reviewer.md` step 5 for the exact pattern. If the queue grows un-actioned, the memory curator will flag it once the queue depth ≥ 3.
- **Chunk review is soft-gated.** CRITICAL/HIGH findings recommend `REWORK` but do not block tool calls. This is intentional for v3.4.0 — observe behavior first, escalate to a hard gate in a future version if needed.
- **Curator only checks thresholds.** It does not truncate or summarize on its own. You (or Claude invoked explicitly) run the suggested commands.
- **First-time post-merge will not retroactively queue reviews** for already-DONE chunks. The hook only fires on the transition, not on existing state.

### Verification

After upgrading:
1. Open a chunk file, set `Status: DONE`, save. Confirm one new line in `AI_DOCS/memory/pending-reviews.jsonl`.
2. Start a new session. The banner should show `=== Pending Chunk Reviews (1) ===`.
3. Run the memory curator with forced thresholds: temporarily set `DECISION_ROWS_THRESHOLD=1` in the hook and trigger a `Stop`. Confirm `curator-suggestions.md` is written.
4. Confirm next session surfaces `=== Memory Curator Suggestions ===`.

---

## v3.3.0

Release focus: **Compaction resilience + chunked-execution enforcement.** Closes the remaining context-loss gaps after v3.2's mechanical PreCompact snapshot.

### What changed (non-breaking)

1. **`hooks/user-prompt-log.sh`** *(new)* — `UserPromptSubmit` hook. Appends every user prompt (scrubbed) to `AI_DOCS/memory/user-prompts.log`. This is the **only** place raw user words are guaranteed to survive compaction. Silent hook.
2. **`hooks/task-router.sh`** *(new)* — `UserPromptSubmit` hook. When a prompt looks task-intent (Fix/Build/Add/Implement/…) and `INDEX.md` has no active plan, emits a short nudge to run `/task-planner` first. Silent when a plan is active or a slash-command was used.
3. **`hooks/enforce-chunk-scope.sh`** *(new)* — `PreToolUse` hook sibling of `enforce-anchors.sh`. When a complex task has a PENDING chunk, blocks Edit/Write/MultiEdit to files outside that chunk's `## Files Affected` list. Keeps per-chunk context tight; prevents drift. Escape: `CHUNK_SCOPE_ENFORCE=off` env var, or add the file to the chunk.
4. **`hooks/pre-compact.sh`** *(extended)* — snapshot now also includes:
   - **Active chunk excerpt** — first 20 lines of the pending chunk file (for complex tasks).
   - **Last 3 user prompts** from `user-prompts.log`.
   - **Last 5 decisions** from `decision-log.md`.
   - Cap raised from 2 KB to 3 KB (~750 tokens). Priority ordering means low-priority sections (skill invocations, then decisions) truncate first.
5. **`settings.template.json`** — new `UserPromptSubmit` block wiring hooks 1–2; new `PreToolUse` entry for hook 3; version comment bumped.
6. **`skills/memory-protocol/SKILL.md`** — clarifies that `decision-log.md` should capture **conversational** preferences (not just formal skill outputs). Documents `user-prompts.log` as a first-class memory file.
7. **`CLAUDE.template.md`** — hooks table and memory files table refreshed.

### Memory model impact

Two new standard memory files are introduced:

| File | Written by | Guarantee |
|---|---|---|
| `AI_DOCS/memory/user-prompts.log` | `user-prompt-log.sh` (automatic) | Every user turn, forever |
| `AI_DOCS/memory/decision-log.md` | Skills and Claude (manual) | Already a v3.1 convention — v3.3 clarifies it should include conversational decisions |

### Migration from v3.2

Auto-applied by `upgrade.sh` / `git pull` post-merge hook:

1. `settings.template.json` gains a `UserPromptSubmit` block and a new `PreToolUse` entry. If you have customized `settings.json`, merge manually using `settings.template.json` as reference.
2. All three new hooks ship executable; no action needed.
3. `.adf-version` bumps `3.2.0` → `3.3.0`.

**Nothing is retroactive**: `user-prompts.log` only starts recording from the first v3.3 session. Historical prompts are not recoverable.

### Gotchas

- **Chunk-scope can feel noisy during exploratory refactors.** Set `CHUNK_SCOPE_ENFORCE=off` in `.claude/settings.local.json` env, or work outside the chunked flow (no active plan = no enforcement).
- **The task-router is advisory.** It nudges; it does not block. Claude can still write code without `/task-planner`, but the nudge will fire every turn until a plan is recorded in `INDEX.md`.
- **Large user-prompt logs grow unbounded.** Consider adding a monthly prune (`tail -1000 user-prompts.log > tmp && mv tmp user-prompts.log`) if the file exceeds ~5 MB.

### Verification

After upgrading:
1. Send any prompt — confirm `AI_DOCS/memory/user-prompts.log` gets a new timestamped line.
2. Send "fix the login bug" with no active `INDEX.md` — task-router should emit the nudge.
3. Send `/workscope` — task-router should be silent (slash-command detected).
4. With an active chunk whose `Files Affected` is `src/foo.ts`, try editing `src/bar.ts` — enforce-chunk-scope should block with a clear message.
5. Trigger `/compact` — `compaction-snapshot.md` should contain the new sections and stay ≤ 3 KB.

---

## v3.2.0

Release focus: Mechanical session survival across context compaction. Reconciles doc/implementation drift from v3.1.

### Non-breaking

- **New hook: `hooks/pre-compact.sh`** — mechanical safety net that runs on every `PreCompact` event. Reads `AI_DOCS/memory/session-state.md`, the active task file, `gate-status.md`, unresolved CRITICAL/HIGH security findings, pending AI cost approvals, and the last 5 skill invocations from `metrics.jsonl`. Emits a scrubbed (<2 KB) summary to stdout (injected into compacted context) and persists `AI_DOCS/memory/compaction-snapshot.md` as audit.
- **`settings.template.json`** — new `PreCompact` entry wired to the hook above.
- **Doc drift fix** — `CLAUDE.template.md` previously documented `pre-compact.sh` and `post-compact.sh` as shipped hooks but neither file existed. v3.2 ships `pre-compact.sh` and removes the stale `post-compact.sh` row (post-compaction recovery already happens via `session-start.sh` on the next turn).
- **README companion-tools section** — documents [context-mode](https://github.com/mksglu/context-mode) as an optional complementary plugin for context-window engineering. Not a dependency.

### Migration from v3.1

Auto-applied by `upgrade.sh` / `git pull` post-merge hook:

1. `settings.template.json` gains a new `PreCompact` block — if you have customized `settings.json`, merge manually using `settings.template.json` as reference.
2. `hooks/pre-compact.sh` is shipped executable; no action needed.
3. `.adf-version` bumps `3.1.0` → `3.2.0`.

No `CLAUDE.md` regeneration required — but consider running `/project-context` at your convenience so the memory-files table surfaces `compaction-snapshot.md`.

### Verification

After upgrading, trigger a `/compact` in a session with an active task. Confirm:
- `AI_DOCS/memory/compaction-snapshot.md` is written.
- The compacted context includes an `=== ADF COMPACTION SNAPSHOT ===` block near the top.
- Subsequent `/session-management` can recover working state without re-reading full docs.

---

## v3.1.0

Release focus: Anthropic skill-building guide compliance + telemetry + structural skill cleanup. This section is the migration summary; the rest of the framework artifacts (new skills, docs, hooks, rules) reflect the full scope.

### Skill inventory change

| | v3.0 | v3.1 |
|---|---|---|
| Total skills | 62 (earlier docs said "69" by mistake) | 72 (62 original + 4 new Tier 1 + 3 from deployment split + 3 from design-system split) |
| Renames | 0 | 1 (`/claude-md` → `/project-context`) |
| Splits | 0 | 2 (`/deployment` + `/design-system`) |
| Deprecation stubs | 0 | 3 (original skill folders kept as routers through v3.3) |

### Structural changes

1. **ID collisions resolved:**
   - `/task-planner` SK-090 → **SK-098**
   - `/team-security` SK-090 → **SK-099**
   - `/team-design` SK-091 → **SK-101**
   - `/feature-delivery` SK-092 → **SK-097**
   - (`/orchestrator` SK-090 and `/project-kickoff` SK-091 and `/project-stage-detect` SK-092 retain their IDs)

2. **Renamed:** `/claude-md` → `/project-context` (reserved-prefix violation; `claude-md` remains as router stub until v3.3.0).

3. **Split:** `/deployment` → `/deployment-planning` (phases 1-2, keeps SK-008) + `/deployment-execution` (phases 3-5, new SK-045).

4. **Split:** `/design-system` → `/design-discovery` (gates 1-2, keeps SK-004) + `/design-tokens` (gate 3, new SK-046) + `/design-screens` (gates 4-5, new SK-047).

5. **New Tier 1 skills:**
   - `/retrospective` (SK-013) — post-milestone learning loop
   - `/accessibility-audit` (SK-014) — dedicated WCAG 2.1 AA audit
   - `/milestone-validation` (SK-015) — replaces per-feature heavy validation
   - `/skill-authoring` (SK-016) — framework-aware skill-creator

6. **Orchestrator demoted:** `/orchestrator` is no longer user-facing (internal meta-skill only). `/team-feature` and `/team-release` triggers sharpened to cover the use cases.

### Frontmatter standard (now enforced)

Every SKILL.md gains (via `skill-lab/retrofit-frontmatter.sh`):

```yaml
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
```

The retrofit script is idempotent — re-running is safe. Skills that already had the fields are skipped.

### New infrastructure

**Hooks (`hooks/`):**
- `log-event.sh` — append structured events to `AI_DOCS/memory/metrics.jsonl`
- `scrub.sh` — redacts secrets from any stdin stream before write
- `session-end.sh` — writes per-project memory pointer on session Stop
- `enforce-anchors.sh` — PreToolUse blocker for unread critical anchors (advisory default)
- `fast-validate.sh` — inline lint + typecheck on edited files
- `pre-commit-scan.sh` — staged-file secret scanner

**Rules (`rules/`):**
- `secrets-patterns.md` — canonical secret-pattern catalogue
- `platform-rules.md` — Windows/Git Bash command conventions
- `design-rules.md` — contextual design bans (border-only forbidden in data-heavy projects)

**Docs (`docs/`):**
- `telemetry.md`, `secrets-policy.md`, `model-selection.md`
- `allowed-tools-matrix.md` — per-category default tool surfaces
- `skill-authoring-guide.md` — internal conventions + Anthropic-guide reference
- `skill-registry.md` — ID allocation + short-form aliases
- `skill-decision-tree.md` — disambiguation matrix
- `skill-deprecations.md` — alias resolution table
- `skill-backlog.md` — Tier 2/3 skills deferred to v3.2+
- `agents-vs-skills.md` — taxonomy

### Settings.template.json hooks added

- `PreToolUse: Edit|Write|MultiEdit` — anchor-enforce hook
- `PostToolUse: Read` — marks file as read in `session-reads.log`
- `PostToolUse: Edit|Write|MultiEdit` — fast-validate
- `Stop` — session-end + cleanup of session-reads.log

### Migration steps from v3.0

```bash
cd .claude
git pull          # pulls new skills, docs, hooks, rules
bash upgrade.sh   # runs post-pull migration (idempotent)
```

Then open Claude Code in the project and invoke:

```
/project-context
```

to regenerate `CLAUDE.md` with v3.1 gates + new skill references.

No `AI_DOCS/` changes required. Project data is preserved.

**Important — old skill names removed, not aliased:** Unlike earlier drafts that proposed keeping router stubs until v3.3.0, v3.1.0 **deletes** the old skill folders immediately (`skills/claude-md/`, `skills/deployment/`, `skills/design-system/`). All companion content (RELEASE-PROTOCOL.md, STRATEGIES.md, UI-MANDATES.md, ACCESSIBILITY.md, SCREEN-DESIGN.md, CLAUDE-template.md, etc.) was copied to the new skills' `references/` + `templates/` directories before removal — no content loss.

Your project may have references to the old skill names. `upgrade.sh` lists them; fix manually:

- `/claude-md` → `/project-context`
- `/deployment` → `/deployment-planning` or `/deployment-execution`
- `/design-system` → `/design-discovery`, `/design-tokens`, or `/design-screens`

### What's preserved automatically

- **All custom skill IDs**: the retrofit script doesn't touch existing `skill_id` or other declared fields
- **Your project's tech-spec, workscope, milestones**: untouched
- **Gate status, decision log, memory files**: untouched
- **CLAUDE.md** (until you regenerate): untouched, but likely out-of-date — see above

### Breaking changes (explicit)

- **`/claude-md` removed** → use `/project-context` (same behavior).
- **`/deployment` removed** → use `/deployment-planning` (phases 1-2: runbook generation) or `/deployment-execution` (phases 3-5: live deploy + sign-off).
- **`/design-system` removed** → use `/design-discovery`, `/design-tokens`, or `/design-screens` depending on phase.
- **`/orchestrator` demoted** → no longer user-facing. Use `/team-feature` (features) or `/team-release` (releases). Direct invocation still works but the skill is now an internal meta-primitive.
- **ID reassignments:** `task-planner` SK-090→SK-098, `team-security` SK-090→SK-099, `team-design` SK-091→SK-101, `feature-delivery` SK-092→SK-097. Any project-level code that referenced old IDs needs updating; names are unchanged.
- **Pre-commit hook is opt-in** (install via `hooks/pre-commit-scan.sh` → `.git/hooks/pre-commit`). Not installed automatically; see `docs/secrets-policy.md`.

### Full changelog

- `docs/skill-deprecations.md` — removal record
- `docs/skill-registry.md` — complete ID allocation + aliases
- `docs/skill-backlog.md` — Tier 2/3 skills deferred to v3.2+
- `docs/skill-authoring-guide.md` — internal conventions (references Anthropic PDF)
- `docs/allowed-tools-matrix.md` — per-category default tool surfaces
- `docs/model-selection.md` — Opus/Sonnet/Haiku tier guidance
- `docs/telemetry.md` — local-only event stream schema
- `docs/secrets-policy.md` — pattern library, scrubbing, pre-commit scan
- `docs/agents-vs-skills.md` — taxonomy
- `docs/skill-decision-tree.md` — when-to-use disambiguation

### Testing (deferred)

Layer 1–6 testing scaffolding is planned but not yet enabled (awaiting user authorization). Broad strokes:

- **Layer 1** — Structural validator (unique IDs, kebab-case, SKILL.md case, ≤1024 desc, ≤5000 word body, no reserved names)
- **Layer 2** — Per-skill unit: `tests/triggers.yaml` (should / should-not phrases) + `tests/snapshots/` (golden outputs)
- **Layer 3** — Hook behavior tests (anchor-enforce, scrub, platform-detect)
- **Layer 4** — End-to-end regression fixture (calculator-app — deterministic input, diff output vs. v3.0 baseline)
- **Layer 5** — Dogfood (framework applied to its own development)
- **Layer 6** — Update-regression (trigger stability + snapshot diff + contract stability + alias verify + version-bump enforcement)

---

## v3.0.0 (previous)

- 62 skills (earlier docs said "69" — audit corrected the count in v3.1)
- 17 agents
- Install method: `git clone <url> .claude` + `bash .claude/setup.sh`
- New: `/brainstorm` + `business-strategist` agent for pre-requirements ideation
- New: `skill-lab/` self-testing framework (static tests, quality rubric, catalog)
- Team pipelines: `team-feature`, `team-release`, `team-security`, `team-design`
- Design consistency gates via `component-inspector` in `team-feature`

---

## Migrating from WMADS / older ADF versions

This guide also helps adopt claude-skills into an existing project that was using
`web-mobile-app-development-skills` (WMADS).

---

## Table of Contents

- [Find Your Current Version](#find-your-current-version)
- [Upgrade Strategies](#upgrade-strategies)
- [WMADS → ADF 3.0 (Initial Migration)](#wmads--adf-30-initial-migration)
- [Skill Interface Changes by Version](#skill-interface-changes-by-version)
- [New Skills Added in ADF 3.0](#new-skills-added-in-adf-30)
- [New Agents Added in ADF 3.0](#new-agents-added-in-adf-30)
- [Hook Changes](#hook-changes)
- [Breaking Changes](#breaking-changes)

---

## Find Your Current Version

Check your `CLAUDE.md` header:
```
> Version: 3.0.0 | Evolved from web-mobile-app-development-skills (WMADS)
```

Or check `settings.json`:
```json
"//version": "3.0.0 — Full lifecycle hooks + agent audit trail"
```

---

## Upgrade Strategies

### Strategy A — Copy updated files manually (recommended for most)

Best when: you're using ADF as a standalone framework folder alongside your project.

1. Download or clone the latest `app-development-framework/`
2. Copy `.claude/agents/`, `.claude/hooks/`, `.claude/docs/`, `.claude/rules/` into your project
3. Merge `.claude/settings.json` — keep your project-specific customizations, adopt new hook entries
4. Merge `CLAUDE.md` — keep your project-specific routing and team info, adopt structural additions
5. Run `/skill-test audit` to verify all skills pass structural compliance

### Strategy B — Selective file adoption

Best when: you only want specific new capabilities (e.g., just the hooks, or just the new agents).

Copy only the specific files you need from `app-development-framework/.claude/`:
- Just hooks → copy `.claude/hooks/*.sh` and merge `settings.json` hook entries
- Just agents → copy `.claude/agents/[agent-name].md`
- Just governance → copy `.claude/docs/governance-gates.md` and update `gate-enforcement` skill

### Strategy C — Git remote merge

Best when: your project *is* the ADF folder (you're building in it directly).

```bash
# Add ADF as a remote (one-time setup)
git remote add adf https://github.com/your-org/app-development-framework.git

# Fetch the new version
git fetch adf main

# Merge into your branch
git merge adf/main --allow-unrelated-histories
```

Resolve conflicts in `CLAUDE.md` and `settings.json` — keep your project content, adopt framework structure.

---

## WMADS → ADF 3.0 (Initial Migration)

If you're moving from `web-mobile-app-development-skills` to ADF:

### What's new (you need to add)

| Item | Action |
|------|--------|
| `CLAUDE.md` | Create at project root — see template in ADF root |
| `.claude/hooks/` directory | Copy all 4 hook scripts |
| `settings.json` hooks | Add `SubagentStart`, `SubagentStop`, updated `SessionStart` |
| `.claude/docs/` directory | Copy `context-management.md`, `governance-gates.md`, `coordination-rules.md`, `agent-coordination-map.md`, `workflow-catalog.yaml` |
| `AI_DOCS/review-mode.txt` | Create with content `lean` |
| `AI_DOCS/memory/session-state.md` | Create as empty template |
| 3 leadership agents | Copy `solutions-architect.md`, `product-director.md`, `engineering-lead.md` |
| 8 specialist agents | Copy all `*-specialist.md` agents |
| 7 new skills | `team-feature`, `team-release`, `team-security`, `team-design`, `project-stage-detect`, `skill-test`, `skill-improve` |
| 2 new rules | `prototype-rules.md`, `data-migration-rules.md` |
| Test evidence matrix | Append to `testing-rules.md` |
| 9 templates | Copy `.claude/docs/templates/*.md` |

### What to keep from WMADS (don't overwrite)

| Item | Why |
|------|-----|
| All 61 existing skills | Already correct — ADF adds to them, doesn't replace |
| All 10 existing rules | Keep them; ADF adds 2 more |
| All 5 existing agents | Keep them; ADF updates their YAML frontmatter and adds new ones |
| `REGISTRY.md` and `SKILL-REFERENCE.md` | Update to add new skills, don't overwrite |
| `AI_DOCS/` project-specific files | These are your project data — never overwrite |

### What WMADS does better (preserve these innovations)

- Skill versioning rules (`skill-versioning-rules.md`) — keep as-is
- Python backend skill chain (python-backend → python-ai-services → python-testing → python-deployment)
- Document generation skills (docx, pdf, pptx, xlsx, image-generation)
- Auto-format PostToolUse hook (Prettier + ESLint)
- API contract lock PreToolUse hook
- `context: fork` pattern in skill frontmatter for heavy skills
- `excludedFiles` list in settings.json

---

## Skill Interface Changes by Version

### ADF 3.0 (current)

#### `/session-management` — updated behavior
- **Added**: Reads `AI_DOCS/review-mode.txt` and shows current mode
- **Added**: Reads `workflow-catalog.yaml` to show "next recommended skill" based on detected phase
- **Added**: Writes `AI_DOCS/memory/session-state.md` on restore
- **No breaking change**: Existing invocation `restore | new | onboard` still works

#### `/gate-enforcement` — updated behavior
- **Added**: Reads `AI_DOCS/review-mode.txt` before running gates
- **Added**: Resolves gate prompts from `governance-gates.md` by gate ID
- **Breaking change**: Inline gate prompts in skills are deprecated — move them to `governance-gates.md` and reference by ID
- **Migration**: Run `/skill-test static gate-enforcement` to verify compliance

#### `/project-audit` — new model assignment
- **Added**: Now assigned `model: opus` for full synthesis capability
- **No breaking change**: Invocation unchanged

#### `/security-audit` — new model assignment
- **Added**: Now assigned `model: opus`
- **No breaking change**: Invocation unchanged

---

## New Skills Added in ADF 3.0

| Skill | SK-ID | Purpose |
|-------|-------|---------|
| `/team-feature` | SK-088 | Orchestrate frontend + backend + QA in parallel for feature delivery |
| `/team-release` | SK-089 | Orchestrate engineering-lead + qa-lead + deployment pipeline |
| `/team-security` | SK-090 | Spawn security-auditor + api-validator + code-reviewer in parallel |
| `/team-design` | SK-091 | Orchestrate product-director + platform specialist + component-inspector |
| `/project-stage-detect` | SK-092 | Auto-detect SDLC phase from codebase + AI_DOCS state |
| `/skill-test` | SK-093 | Validate skill structural compliance (static, spec, category, audit modes) |
| `/skill-improve` | SK-094 | Full skill improvement loop: test → diagnose → fix → retest |

---

## New Agents Added in ADF 3.0

### Tier 1 — Leadership (Opus)
| Agent | Purpose |
|-------|---------|
| `solutions-architect` | Architecture review, ADR sign-off, tech stack decisions |
| `product-director` | Scope validation, milestone risk, prioritization |
| `engineering-lead` | Code standards, cross-team coordination, tech debt |

### Tier 3 — Platform Specialists (Sonnet)
| Agent | Purpose |
|-------|---------|
| `react-specialist` | React patterns, hooks, state management (Zustand/Redux) |
| `nextjs-specialist` | App Router, RSC, SSR/SSG/ISR, deployment |
| `angular-specialist` | Angular architecture, RxJS, NgRx, standalone components |
| `nodejs-specialist` | Node.js runtime, streams, Express/Fastify |
| `nestjs-specialist` | NestJS modules, Prisma, microservices, CQRS |
| `fastapi-specialist` | FastAPI, Pydantic v2, SQLAlchemy async |
| `flutter-specialist` | Flutter, Riverpod/Bloc, platform channels |
| `react-native-specialist` | React Native + Expo, New Architecture (JSI/Fabric) |

---

## Hook Changes

### Added in ADF 3.0

| Event | Script | Purpose |
|-------|--------|---------|
| `SubagentStart` | `log-agent.sh` | Audit trail for agent invocations |
| `SubagentStop` | `log-agent-stop.sh` | Audit trail completion |

### Updated in ADF 3.0

| Event | Change |
|-------|--------|
| `SessionStart` | Split into 3 hooks: session-start.sh + detect-gaps.sh + skill-router |
| `SessionStart` | `detect-gaps.sh` now auto-detects missing docs for web/mobile projects |
| `Stop` | Updated warning message to include `/session-management` hint |

---

## Breaking Changes

### ADF 3.0

1. **Gate prompts must not be inline** — if a skill embeds a gate prompt as text, move it to `governance-gates.md` and reference the gate ID. Run `/skill-test static [skill-name]` to find violations.

2. **Agent YAML must include `model` and `maxTurns`** — all agent frontmatter now requires these fields. Without them, `/skill-test static [agent-name]` will report FAIL.

3. **`AI_DOCS/review-mode.txt` is required** — `gate-enforcement` reads this file. Default value is `lean`. If missing, gates will default to `full` mode.

---

## Deprecations

| Deprecated | Replacement | When removed |
|-----------|-------------|-------------|
| Inline gate prompts in skills | Gate IDs in `governance-gates.md` | ADF 4.0 |
| WMADS `settings.json` version string | ADF version string | ADF 3.0 (already updated) |
| `session-management` as both `/help` and `/start` | `/project-stage-detect` handles detection; `session-management` handles restore | ADF 4.0 split |
