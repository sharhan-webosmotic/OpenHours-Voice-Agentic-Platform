---
name: ask
description: "Ask the user a single, well-formed question with 2-3 options and a recommended default. Used by /do, /plan, /build, /audit when truly blocked. Logs the answer to AI_DOCS/memory/decision-log.md before returning. NEVER chains multiple questions in one turn."
skill_id: SK-130
context_budget:
  load_kb: 20
  scope: session
version: 2.0.0
dependencies:
  required: []
  optional: []
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
  category: meta
  user_facing: false
---

# /ask — single, well-formed question protocol

> Sub-skill. Other skills delegate to this when they need a user choice. The user is told upfront which skill is asking and why.

## When to invoke
Other lean skills call `/ask` only when ONE of:
- Scope or feature change ("Add password reset to MVP?")
- Tradeoff with user-visible impact (UI library, deployment target, paid vs free tier)
- Missing external info (API key, business rule, third-party access)
- Two valid implementation paths with different cost/UX
- Blocker after `/build` retried twice

Never use `/ask` for:
- Naming, file structure, refactor style, lint config — `/build` decides silently.
- Stacking many questions — split across runs of `/ask`.
- Reading what's already in `intent.md` / `stack.md` / `decision-log.md`.

## Question format (strict)

```
[Q from /<calling-skill>]
Read: <file path, section or row, the exact place to look>
Wording: "<the text at issue, quoted verbatim>"
Conflict: <the scope line, SOW section or requirement id it conflicts with, and why it matters in one or two sentences>
Question: <one sentence ending in ?>
  1. <answer A> (recommended: <one short reason>)
  2. <answer B> (<consequence, for example: then it needs a change request>)
  3. <skip / decide later> (optional)

Reply with the number or short text.
```

Rules:
- Exactly one question. No preamble paragraphs.
- 2 or 3 options (a third "skip / decide later" is fine when applicable).
- Always mark a recommended default on option 1, with a one-line reason.
- The `Read:` line is mandatory whenever the question is about something written down (a document, a plan, a spec row, a requirement). It names the file and the exact section or row.
- Never refer to an item by number alone ("item 5") without quoting it in `Wording:`.
- `Conflict:` names the scope source (`AI_DOCS/planning/requirements-baseline.md` R-NNN, the workscope section, or the SOW clause) and why it matters, or says "no scope conflict, this is a preference".
- Check the recommendation against the scope baseline before asking (Rule 9 in `rules/advisor-stance-rules.md`).
- Context is the Read, Wording and Conflict lines, nothing else. No code blocks, tables, or preamble.

If `AskUserQuestion` is available in the runtime, use it instead with the same rules: put Read, Wording and Conflict in the question text, give the answers as options (at most 3), recommended first.

### Examples

```
[Q from /workscope]
Read: AI_DOCS/planning/requirements-baseline.md, Section 2, row R-014
Wording: "Users can pay by Stripe or Razorpay, whichever is cheaper"
Conflict: Workscope Section 4 (Payments) lists Razorpay only. Supporting both adds a second gateway integration and PCI scope.
Question: Should the MVP support only Razorpay as the workscope states?
  1. Razorpay only (recommended: matches Workscope Section 4 and the India-only user base)
  2. Both gateways (then it needs a change request and adds about one milestone task)
  3. Decide later
```

```
[Q from /build]
Read: src/components/Header.tsx, line 42
Wording: "// TODO: hide on mobile?"
Conflict: no scope conflict, this is a preference.
Question: Should the header stay visible on mobile?
  1. Keep visible (recommended: matches the approved design in AI_DOCS/design/screens/home.md)
  2. Hide on mobile (then the design needs an update first)
```

## After the answer

1. Append to `AI_DOCS/memory/decision-log.md` (newest entry on top):
   ```
   ## YYYY-MM-DD — <question, shortened>
   - **Asked by:** /<calling-skill>
   - **Options:** A, B, C
   - **Decision:** <chosen>
   - **Why:** <user's reason in their words, or "no reason given">
   - **Decided by:** user
   - **Affected:** <files/components/tasks the calling skill said this affects>
   ```
2. Return the chosen option to the calling skill in a one-line summary: `Decision: <chosen>. Logged to decision-log.md.`

## Boundaries
- Does not edit code, configs, or stack/intent files. Pure Q&A + log write.
- Does not interpret the answer beyond capturing it. The calling skill applies it.
- If user gives a free-text answer that doesn't match any option, log it verbatim under "Decision" and return as-is.

## Verification
- `/ask` returns exactly one question per invocation.
- decision-log.md gains exactly one new section per invocation.
- No unrelated files are touched.

<!-- Version: 2.0.0 | 2026-10-22 | context-rich format: Read, Wording, Conflict lines, scope check before recommending -->
