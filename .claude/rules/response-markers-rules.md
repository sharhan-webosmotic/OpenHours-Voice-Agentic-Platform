# Response Marker Rules

> Always-on output rule. Governs colored status markers in operator-facing CLI
> chat replies. It is a sibling of `writing-style-rules.md` and
> `advisor-stance-rules.md`. Those govern prose and posture. This one governs the
> visual severity signal. Loaded alongside the other baseline rules.
>
> Background: Claude Code renders replies as Markdown in the terminal. It does not
> apply arbitrary font color to assistant prose, and raw ANSI color codes are
> stripped or shown as literal text. Colored emoji markers are the reliable way to
> signal severity at a glance, so they are the chosen mechanism.

## Rule 1: The three markers

Prefix a chat line with one of these when, and only when, the line carries that
status meaning:

- 🔴 **must-fix / blocking** : the user has to act on it, fix it, or decide it before moving on. Broken builds, failing tests, security findings, a question that blocks progress.
- 🟡 **warning / caution** : it works for now, but there is a risk, a tradeoff, an assumption, or a thing to watch. Missing index, deprecated API, untested path, cost implication.
- 🟢 **good / confirmed** : verified success. Tests pass, build is clean, the change is done and safe to proceed.

## Rule 2: Use sparingly

A marker earns its place by being rare enough to scan. Do not prefix every
sentence. A normal explanatory reply, a plain answer to a question, or a
discussion needs no markers at all. Reserve them for lines where severity is the
point.

## Rule 3: Match the marker to real status

Do not paint a 🟢 on something unverified, and do not soften a 🔴 into a 🟡 to be
polite. The marker is a claim about state. Hold it to the same confidence bar as
the `[Certain]` / `[Likely]` / `[Guessing]` tags in `advisor-stance-rules.md`. If
you have not verified success, it is not 🟢.

## Rule 4: Scope is CLI chat only (BLOCKING)

These markers live ONLY in conversational terminal output. They must NEVER appear
in:

- files written to disk (source, config, data)
- generated Markdown, including AI_DOCS, runbooks, specs, decision logs
- docx / pdf / pptx / xlsx and any client-facing deliverable
- code, comments, docstrings, or commit messages
- any skill's mandated file output

Files and artifacts stay clean. A marker that leaks into a written file is a
defect, the same as a stray dash from `writing-style-rules.md`.

## Rule 5: Never override a mandated structure

When a skill defines a fixed output format, that format wins. Do not prepend a
marker to a gate verdict's first line (`APPROVE` / `CONCERNS` / `REJECT`), the
`/ask` format, or the Section 5 handoff block. The marker convention lives in the
surrounding conversation, never inside a templated artifact.
