---
paths:
  - "AI_DOCS/planning/**"
  - "AI_DOCS/architecture/**"
  - "AI_DOCS/design/**"
---

# Mermaid Diagram Rules

> Always-on authoring rule for Mermaid diagrams. Governs HOW every Mermaid block
> is written so it renders without "Syntax error in text" on GitHub, in VS Code,
> and through the docx/pdf pipeline.
> Loaded by any skill that emits a ```mermaid block: `tech-specification` (S19
> sequence diagrams), `design-screens` (UX flows), `prd-generation`,
> `prd-generation`, `architecture`, `markdown-creator`, `docx-from-markdown`.
> Sibling of `writing-style-rules.md`.
>
> Scope: Mermaid is the text source for diagrams inside working docs
> (`AI_DOCS/`), where it diffs in review and renders on GitHub. Every rendered
> or client-facing diagram is drawn by the `diagram-design` plugin instead,
> which imports a Mermaid block with `/diagram-design:import-mermaid`.
>
> The single cause behind most Mermaid failures: an unquoted label that contains a
> character the parser treats as syntax. Quote the label and 80% of breakage
> disappears.

---

## Rule 1: Quote every label that contains a special character (BLOCKING)

Wrap any node, edge, or subgraph label in double quotes when it contains any of:
`( ) [ ] { } : ; / \ # @ ! ? < > " ' ,` or a leading/trailing space.

```
BAD:   A[User's profile (admin)]
GOOD:  A["User's profile (admin)"]

BAD:   B[Cost: $50/mo]
GOOD:  B["Cost: $50/mo"]
```

When in doubt, quote. A quoted plain label never breaks. Prefer bracket nodes
`A["Label"]` over parenthesis nodes `A("Label")`, which are more parser-fragile.

## Rule 2: Reserved words break the parser (BLOCKING)

The lowercase word `end` breaks flowcharts and subgraphs. Capitalize at least one
letter, or quote it as a label.

```
BAD:   A --> end
GOOD:  A --> End
GOOD:  A --> n1["end"]
```

Do not use these as bare node IDs or unquoted labels: `end`, `default`, `style`,
`linkStyle`, `classDef`, `class`, `click`, `href`, `call`, `subgraph`, `graph`.
Quote them if they must appear as text: `n1["default"]`.

## Rule 3: Node IDs are ASCII identifiers, never start with `o` or `x` (BLOCKING)

Node IDs (the token before the `[` / `(`) must be simple: letters, digits,
underscores. No spaces, no hyphens, no special characters. Put the human text in
the quoted label, not the ID.

An ID starting with lowercase `o` or `x` next to an edge is read as a circle or
cross edge. Capitalize or rename.

```
BAD:   order node[Order]          (space in ID)
BAD:   cloud-db[Database]         (hyphen in ID)
BAD:   A---oNode["Order"]         (o read as circle edge)
GOOD:  orderNode["Order"]
GOOD:  cloudDb["Database"]
GOOD:  A---orderNode["Order"]
```

## Rule 4: Line breaks use `<br/>` inside a quoted label (BLOCKING for multi-line)

For a multi-line label, use `<br/>` inside double quotes. This is the portable
form that renders on GitHub, VS Code, and the docx/pdf pipeline. Do not rely on
raw newlines inside a label (markdown-string newlines need a recent renderer and
fail in the docx path).

```
BAD:   A[Validate
       input]
GOOD:  A["Validate<br/>input"]
```

## Rule 5: Angle brackets and other markup become HTML entities

Inside a label, escape `<` and `>` as `&lt;` and `&gt;` (still quote the label).
Other characters that need entities: `#` is `&#35;`, a literal `"` inside a label
is `&quot;` (or switch to single quotes).

```
BAD:   A[List<Item>]
GOOD:  A["List&lt;Item&gt;"]

BAD:   A["He said "hi""]
GOOD:  A["He said 'hi'"]
```

## Rule 6: Sequence diagram discipline

- Declare participants at the top in display order. Use `participant` for system
  boxes and `actor` for people. Alias with `as`: `participant DB as Database`,
  then type `DB` everywhere.
- A literal `;` inside a message breaks the line. Use the entity `#59;`.
- Wrap `alt` / `opt` / `loop` / `par` blocks with a matching `end` (this `end` is
  required block syntax and is correct, unlike the flowchart reserved-word case).

```
BAD:   A->>B: save key;value
GOOD:  A->>B: save key#59;value
```

## Rule 7: Structural rules

- Comments start with `%%`, never a single `%`.
- A `---` frontmatter config block, if used, must be the very first line (no
  blank line or content above it).
- Quote subgraph titles that contain spaces or breaks: `subgraph "Order flow"`.
- Link to nodes inside a subgraph, never to the subgraph ID itself.
- In `linkStyle`, put the color before width: `linkStyle 0 stroke:#FF69B4,stroke-width:4px`.

## Rule 8: Stay in the widely-supported subset

ADF diagrams render on GitHub, in editors, and through the docx/pdf pipeline.
Target the common denominator:

- Use the stable diagram types: `flowchart` / `graph`, `sequenceDiagram`,
  `classDiagram`, `erDiagram`, `stateDiagram-v2`, `gantt`.
- Avoid experimental types and brand-new v11 features in client deliverables
  unless the target renderer is known to support them.
- Keep one diagram per ```mermaid fence.

## Rule 9: Validate before shipping (BLOCKING for deliverables)

Before a Mermaid block goes into a spec, a client doc, or a committed artifact,
validate it. Paste it into the live editor at https://mermaid.live and confirm it
renders with no error. A diagram that has never been rendered is unverified and
must not be presented as final. For a generated batch, spot-check at least the
most complex diagram of each type.

---

## Quick pre-flight checklist (run on every diagram)

- [ ] Every label with a special character is double-quoted (Rule 1).
- [ ] No lowercase `end` or other reserved word as a bare ID/label (Rule 2).
- [ ] Node IDs are plain identifiers, none start with `o`/`x` next to an edge (Rule 3).
- [ ] Multi-line labels use `<br/>` inside quotes (Rule 4).
- [ ] `<` `>` `#` escaped as entities (Rule 5).
- [ ] Sequence diagram: participants declared, `;` in messages is `#59;` (Rule 6).
- [ ] Comments use `%%`, subgraph titles with spaces are quoted (Rule 7).
- [ ] Rendered clean in mermaid.live (Rule 9).

## Verification (what /audit and the doc pipeline check)

- Grep committed/generated Markdown for ```mermaid blocks whose labels contain
  unquoted `(` `)` `:` `<` `>` or a lowercase ` end ` token. Any hit is a defect.
- `docx-from-markdown` / `docx` must fail loudly (not silently drop) when a Mermaid
  block does not render, so a broken diagram never ships as a blank space.

<!-- Version: 1.0.0 (2026-06-23): initial Mermaid authoring rule, grounded in mermaid.js.org flowchart docs + common-error catalogues -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
<!-- Version: 1.2.0 | 2026-10-14 | diagram-creator retired. Scope note added: Mermaid stays the in-AI_DOCS text source, rendered and client-facing diagrams come from the diagram-design plugin. -->
