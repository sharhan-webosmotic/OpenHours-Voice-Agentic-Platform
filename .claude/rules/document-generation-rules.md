---
paths:
  - "AI_DOCS/planning/**"
  - "AI_DOCS/requirements/**"
  - "AI_DOCS/ingested/**"
---

# Document Generation Rules (Human-First Writing)

> Always-on discipline for every generated client-facing or team-facing document:
> workscopes, PRDs and FRDs, tech-spec prose, estimation prose, requirement
> baselines, project briefs, markdown deliverables, Word and PDF documents,
> presentations, and landing-page copy. Loaded whenever a task generates such a
> document (Tier 1 in `rules/README.md`). Sibling of `writing-style-rules.md`:
> that file governs punctuation, this one governs purpose, voice, and process.
>
> The one sentence that controls everything below: the finished document should
> read as if an experienced professional wrote it for a specific reader, because
> the purpose, audience, and tone were established before the first word.

## Rule 1: Intake before ink (BLOCKING)

Never load-and-generate. Before writing any document, establish four things:
purpose, audience, tone, and format with length. Ask in ONE inline conversational
batch, and only for what is not already known. If the owning skill's own intake
already collected an answer (workscope's discovery batches, estimation's cards,
docx-from-markdown's mode question), confirm the inherited answer instead of
re-asking it. Never fire questions one at a time across turns, and never chain
`/ask` calls for this.

The intake gate contract every document skill points at:

```
Before generating, confirm in ONE batch (skip anything already answered):
  1. Purpose: what should the reader decide or do after reading this?
  2. Audience: who reads it (client executive, client technical, internal team)?
  3. Tone: formal proposal, plain business English, or direct technical?
  4. Format and length: markdown only or destined for docx/pptx, and how long?
Record the answers in the working notes, and add a decision-log.md row when
they shape scope.
```

## Rule 2: The purpose sentence

Before drafting, write one sentence: "This document exists so that [audience]
can [decide or do X]." If you cannot write that sentence, you are not ready to
write the document. Every section you then draft must serve that sentence, and
the finished draft is checked against it (Rule 7).

## Rule 3: Structure follows document type

When the owning skill mandates a skeleton (the workscope's 12 sections, the
requirements-baseline structure, the project-brief variants, a gate verdict
format), that skeleton wins and is never reshaped. When no skeleton is mandated,
derive the structure from the purpose sentence and the document type, never from
habit. A proposal is not a spec. A brief is not a report. An SOW is not a
marketing page. Do not force different document types into one template.

## Rule 4: The human writing standard

Write the way a thoughtful senior practitioner explains something to a
colleague, not the way a press release reads.

- Vary sentence length. Never three same-shape sentences in a row.
- Active voice, one idea per sentence, concrete nouns and numbers over
  abstractions.
- Contractions are fine in conversational documents. Avoid them in formal
  proposals and compliance documents.
- The read-aloud test: if a sentence sounds odd spoken, rewrite it.
- Explain before you abbreviate, and prefer the plain word over the impressive
  one.

## Rule 5: Prefer concrete language over machine-written tells (greppable)

Choose specific, concrete language over the phrases below, because each one is
a tell that costs the reader's trust: a reader who spots one starts scanning
for more, and reads the rest of the document more skeptically. The advisory
pass in `hooks/style-check.sh` greps for them.

| Category | Banned |
|---|---|
| Openers | "In today's fast-paced world", "In the ever-evolving landscape", "In the digital age", "Now more than ever" |
| Filler verbs | leverage, utilize, synergize, delve into, embark on, unlock, harness, empower, foster, elevate |
| Decorative adjectives | robust, seamless, cutting-edge, best-in-class, holistic, state-of-the-art, world-class, game-changing, and "innovative" without evidence |
| Throat-clearing | "It is important to note", "It should be mentioned", "It is worth noting", "Needless to say", "As we all know" |
| Closers | "In conclusion, it is clear that", "The possibilities are endless", "Look no further" |

The test: delete the phrase. If the sentence still stands, leave it deleted. If
the sentence collapses, it was carrying no content, so rewrite it around a
concrete claim.

Quoting a banned phrase inside an "avoid this" example (as this file does) is
not a violation. Using one in delivered prose is.

## Rule 6: Evidence over assertion

Every claim about the project traces to an artifact: the requirements baseline,
the workscope, the tech spec, the decision log, or the estimation. No invented
facts, metrics, percentages, case studies, or testimonials. If a claim has no
artifact behind it, either mark it as an assumption or cut it. This is the
document-level form of the framework's "never invent" rule.

## Rule 7: Validation before finalizing (the gate)

Before presenting or writing the final document, verify:

- The purpose sentence (Rule 2) is still true of the finished draft.
- The named audience could act on it without asking what it means.
- Zero banned phrases (grep the Rule 5 list).
- Zero em-dashes and en-dashes (`writing-style-rules.md`).
- Sentence rhythm varies. No wall of same-shape bullets where prose belongs.
- Every heading earns its place. A section that restates another gets cut.
- The one-thing test: you can name the single thing the reader will remember.
- The closing question: would a domain expert who writes well produce this page?

A no on any item means revise before delivering, not deliver with a caveat.

## Rule 8: Scope and carve-outs

This rule governs generated document PROSE. It applies to: `workscope`,
`prd-generation`, `tech-specification` (narrative sections), `estimation`
(summary and narrative prose), `project-brief`, `requirement-finalization`,
`markdown-creator`, `docx`, `docx-from-markdown`, `pptx` (slide copy),
`landing-page` (page copy), and `brainstorm` (ideation documents).

Carve-outs, in priority order:

1. **Skill-mandated structures and fixed copy win.** The workscope's verbatim
   "Why WebOsmotic" and "Terms and Next Steps" blocks, gate verdict first lines,
   the Section 5 handoff block, and any template a skill declares fixed are
   reproduced exactly, never rewritten for voice.
2. **Verbatim and mechanical output is exempt.** Format conversions, quoted
   source text, data tables, generated code and config, XLSX cell content,
   manifest rows, and legal terms carry no voice and are not rewritten.
3. **Chat replies are out of scope.** Conversational replies to the operator are
   governed by `advisor-stance-rules.md` and `response-markers-rules.md`, and
   those stances never bleed into client deliverables, exactly as before.

## Rule 9: Positive-direction authoring (for anyone writing rules, skills, or agent prompts)

When drafting a new rule, skill instruction, or agent prompt, state the desired
behavior first and give the reason, because a model complies with a stated
preference more reliably than with a bare prohibition, and a reason lets it
generalize the rule to cases the author did not anticipate. Pattern: what to
do, why, then the narrow exception if one exists.

Reserve a bare "never" or "don't" for boundaries that are mechanically
enforced (a hook, a grep gate, a regex, a threshold check) or safety-critical
(security, secrets, compliance, cost, destructive operations, locked
artifacts, coverage floors). Those stay blunt and verbatim: a categorical
constraint a machine checks does not need to persuade a model, it needs to be
unambiguous.

Never weaken an existing constraint while rephrasing it. Rule IDs, file paths,
grep patterns, thresholds, BLOCKING labels, and verdict formats stay exact. A
rewritten rule must remain enforceable: a reviewer must still be able to point
at it and call a violation. Prefer the smallest diff when rephrasing an
existing rule for this reason: usually one "because" clause and a sentence
reordered to lead with the desired behavior, with the prohibition kept as the
boundary.

## Render, inspect, then hand off (BLOCKING)

A generated DOCX, PDF, PPTX, XLSX, PNG or SVG is not done until the producing skill has opened it. DOCX: export to PDF and look at every page. PPTX: render every slide. PDF: render every page. XLSX: recalculate and read the computed values back. Images: read them directly. The skill fixes what it finds and renders again. The handoff then carries this block, 3 to 5 items, each one only the human can judge (names, numbers, dates, intent, whether a diagram shows what they expect), never "check the formatting":

```
Opened: <file>, <N pages or slides rendered>, <what was confirmed: TOC resolves, N diagrams legible, formulas recalculated with 0 errors>
Found and fixed: <defects caught in the render, or "none">
Please verify (<about N> min): 1) <item> 2) <item> 3) <item>
```

A handoff without the Opened line is a defect, the same class as an unverified test claim (`rules/testing-rules.md` Verify Before Claim).

## Verification (what /audit and style-check.sh check)

- `bash hooks/style-check.sh <file>` reports (advisory, never blocking) any
  Rule 5 phrase and any em/en dash in a generated document.
- A document skill that generated output with no recorded intake answers
  (Rule 1) is flagged in review as load-and-generate, the exact failure this
  rule exists to prevent.

<!-- Version: 1.0.0 | 2026-08-05 | Initial: human-first document generation discipline -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
<!-- Version: 1.1.0 | 2026-08-20 | positive-direction phrasing pass, constraints unchanged; added Rule 9 (Positive-direction authoring) -->
<!-- Version: 1.2.0 | 2026-10-22 | added Render, inspect, then hand off (BLOCKING): generated files are opened and looked at before handoff, with a short Please verify block for the human -->
