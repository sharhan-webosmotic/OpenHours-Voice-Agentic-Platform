# Writing Style Rules

> Always-on writing rule. Applies to every reply in chat, every generated
> document, and the prose produced by every skill. Loaded alongside the other
> baseline rules. This governs HOW text reads, not what the task does.

## Rule 1: No em-dashes or en-dashes (BLOCKING for prose)

Do not use the em-dash (Unicode `U+2014`, the long `—`) or the en-dash
(Unicode `U+2013`, the shorter `–`) anywhere in prose. This includes chat
replies, Markdown files, Word and PDF documents, proposals, specs, commit
bodies, and any text a skill emits.

**Do not just replace the character.** Re-create the sentence so it reads well
without a dash. Pick whichever of these fits:

- a comma, when the aside is light
- a colon, when what follows explains or lists
- parentheses, when the aside is truly parenthetical
- two sentences, when both halves can stand on their own

### Examples

| Avoid (uses a dash) | Prefer (rewritten) |
|---|---|
| `The build passed — all tests are green.` | `The build passed. All tests are green.` |
| `Three files changed — config, schema, and route.` | `Three files changed: config, schema, and route.` |
| `Narad.io — our compliance platform — ships citations.` | `Narad.io (our compliance platform) ships citations.` |
| `Lead with the hook — not the call.` | `Lead with the hook, not the call.` |

## Rule 2: Hyphens are allowed

The ordinary hyphen (`-`, Unicode `U+002D`) is fine and expected in:

- compound modifiers, for example `real-time`, `source-grounded`, `multi-turn`
- command-line flags, for example `--force`, `-rf`
- numeric ranges inside code or file names

Only the longer em-dash and en-dash are banned.

## Rule 3: Colons are allowed (often the right fix)

The colon (`:`) is fully allowed, and it is frequently the correct replacement
for a banned dash. Use it freely to introduce a list, an explanation, or a value.
The colon was never restricted, so do not avoid it.

- `label: description` is correct. Never write `label.description` or
  `label - description` to dodge the colon. Field-style and key-value writing
  keeps the colon: `Status: PASSED`, `Cost: unknown`, `Auth: session`.
- A colon that introduces a clause explaining the first half is preferred over a
  dash: `Three files changed: config, schema, and route.`
- Use a single space after the colon, never before it.

### Examples

| Avoid (dropped or mangled the colon) | Prefer |
|---|---|
| `Deploy status reads Status.PASSED.` | `Deploy status reads Status: PASSED.` |
| `Cost unknown, check billing` | `Cost: unknown (check billing)` |
| `Three files changed. config, schema, route` | `Three files changed: config, schema, route` |

## Rule 4: Limit semicolons (prefer reframing)

Avoid the semicolon (`;`) in prose. It usually signals two ideas forced into
one sentence. Do not just swap the semicolon for a dash or a comma. Rewrite the
sentence so it reads cleanly. Pick whichever fits:

- two sentences, when both halves can stand on their own (the most common fix)
- a comma, when the second half is a light continuation
- a colon, when the second half explains what came before or introduces a list
- a bulleted list, when several parallel items are piling up in one sentence

### Examples

| Avoid (uses a semicolon) | Prefer (rewritten) |
|---|---|
| `The build passed; all tests are green.` | `The build passed. All tests are green.` |
| `AI is advisory; a dentist always approves.` | `AI is advisory. A dentist always approves.` |
| `We ship fast; we also test thoroughly.` | `We ship fast, and we test thoroughly.` |
| `Three layers exist; each adds a control.` | `Three layers exist, each adding a control.` |

Narrow cases where a semicolon may stay:

- separating items in an inline list whose items already contain commas
- inside quoted source code, file paths, or data preserved verbatim

## Rule 5: Scope and enforcement

- These rules apply to generated **prose**. They do not rewrite dashes or
  semicolons that appear inside quoted source code, user-supplied text being
  preserved verbatim, or data files whose values must stay unchanged.
- When editing an existing document, do not introduce new em-dashes, en-dashes,
  or stray semicolons. Rewrite any sentence you author so it does not need one.
- If asked to scrub an existing file, replace each em-dash, en-dash, or
  semicolon by re-creating the sentence, not by swapping in a hyphen or comma
  where the grammar wants a cleaner break.
- The colon is never a target of scrubbing. Leave every `label: description` and
  every introductory colon intact.

<!-- Version: 1.1.0 — 2026-06-08 — Added Rule 3 (colons allowed); renumbered semicolons to Rule 4 and scope to Rule 5 -->
<!-- Version: 1.2.0 | 2026-08-20 | audit pass: clarified Rule 3 example row so `Status.PASSED` reads as prose, not ambiguous with real enum-property-access code -->
