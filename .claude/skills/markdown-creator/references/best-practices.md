# Markdown Best Practices — Full Rulebook

> Part of [/markdown-creator](../SKILL.md). Extended rationale for the checklist in SKILL.md.

This file is the authoritative ruleset. SKILL.md carries the short-form checklist; anything ambiguous there gets resolved here.

---

## 1. Document structure

### 1.1 One H1 per file

Every Markdown document has exactly one `#` heading, and it is the first non-frontmatter, non-comment line. HTML `<h1>` mixed with `#` counts as multiple H1s — don't.

**Why:** Screen readers, static-site generators, and AI tools use the H1 as the document title. Two H1s confuse the accessibility tree and break site navigation.

### 1.2 No skipped heading levels

H1 → H2 → H3 → H4. Never H2 → H4. The visual hierarchy must match the semantic hierarchy.

**Why:** Skipping levels breaks document outlines for screen readers and tools that build TOCs from heading structure.

### 1.3 Sentence-case headings

`## Set up the database`, not `## Set Up The Database` or `## SET UP THE DATABASE`.

**Exception:** Proper nouns, acronyms, and product names retain their canonical casing (`## Configure AWS S3`).

### 1.4 Stop at H4 for most docs

H1–H4 is enough for 95% of docs. If you need H5 or H6, the doc is probably too deep and should be split (either into separate files or with a different structure).

### 1.5 Heading lengths

Keep headings under ~60 characters. Long headings wrap awkwardly in TOCs and rendered sidebars.

---

## 2. Line and paragraph

### 2.1 Blank line between block elements

Paragraphs, headings, lists, code blocks, tables — each separated by exactly one blank line. Most renderers require this; some collapse missing blank lines silently, producing subtle bugs.

### 2.2 Soft wrap vs hard wrap

Prefer soft wrap (no manual line breaks inside paragraphs) for content that will be read in rendered form. Use hard wrap at 80–100 chars only if the team's convention demands it (reviewed via diff) and the tooling supports it.

### 2.3 Trailing whitespace

No trailing spaces except the deliberate `  \n` (two spaces + newline) for hard line breaks inside a paragraph — and even then, prefer a blank line or an explicit `<br>` for clarity.

### 2.4 Single trailing newline

File ends with exactly one `\n`. Many editors enforce this; `editorconfig` makes it enforceable in CI.

---

## 3. Emphasis

### 3.1 Pick one style and stay consistent

`**bold**` over `__bold__`. `*italic*` over `_italic_`. Mixing both in one file makes diffs noisy and readers confused.

### 3.2 Don't over-emphasize

If everything is bold, nothing is bold. Reserve **bold** for terms and key actions; *italic* for titles of works, introduced terms, and rare emphasis.

### 3.3 `***bold italic***` is usually wrong

If you need both, the content is probably shouting. Rewrite.

---

## 4. Lists

### 4.1 Unordered: always `-`

Pick `-` for unordered lists. Avoid `*` (conflicts with emphasis) and `+` (inconsistent rendering in some tools).

### 4.2 Ordered: `1.` or auto-increment

Either hand-number every item (`1.`, `2.`, `3.`) or use `1.` for every item and let the renderer auto-increment. Never mix.

### 4.3 Nested lists: 2 or 4 spaces consistently

Pick an indent (2 spaces is GFM-safe) and keep it. Never mix tabs and spaces.

### 4.4 Task lists

```markdown
- [ ] Unfinished task
- [x] Completed task
```

Only renderable as interactive checkboxes on GitHub/GitLab issues and PRs. In regular docs they render as `[ ]` / `[x]` text, which is still useful.

### 4.5 Prose inside list items

Indent continuation lines to match the first character of the list item's text:

```markdown
- Primary line of the item.
  Continuation wrapped to the same indent as "Primary".

  A second paragraph, blank line above, indented four spaces.
```

---

## 5. Code

### 5.1 Inline code for identifiers

Variables, function names, file paths, flags: wrap in backticks. `foo()`, `/etc/hosts`, `--dry-run`.

### 5.2 Fenced code blocks with language tags

Always:

````markdown
```bash
npm run build
```
````

Common tags: `bash`, `sh`, `ts`, `tsx`, `js`, `jsx`, `py`, `go`, `rs`, `java`, `kt`, `swift`, `sql`, `json`, `yaml`, `toml`, `xml`, `html`, `css`, `scss`, `diff`, `dockerfile`, `makefile`, `mermaid`, `text`, `md`.

### 5.3 Inside a code fence, no Markdown

`**bold**` inside a code block is literal `**bold**`, not bold. Use this to your advantage for showing raw markdown.

### 5.4 Escaping backticks

To show a triple-backtick fence in a code block, wrap the outer fence in four backticks (see the example in this file's section 5.2).

### 5.5 Long lines in code blocks

Let them wrap; don't manually break. Use `# ...` or language-appropriate continuation when you do need to break.

---

## 6. Links

### 6.1 Descriptive link text

Link text makes sense read aloud out of context. Good: `[GitHub Alerts spec](https://docs.github.com/...)`. Bad: `[click here](...)`, `[this](...)`, `[link](...)`.

### 6.2 Inline vs reference-style

- **Inline**: one-off links. `[name](url)`.
- **Reference-style**: many uses of the same few URLs, or URLs so long they hurt prose readability.

```markdown
See [our setup guide][setup] and the [API reference][api].

[setup]: https://docs.example.com/setup
[api]: https://docs.example.com/api
```

Place reference definitions at the bottom of the file (or end of the relevant section).

### 6.3 Relative links for same-repo references

`[sibling doc](./sibling.md)` survives repo rename. `[distant cousin](https://github.com/org/repo/blob/main/path)` does not. Prefer relative.

### 6.4 Anchor links

`[Setup section](#setup)` where the anchor is the lowercased heading with spaces → hyphens and punctuation dropped. Verify anchors after heading changes.

---

## 7. Images

### 7.1 Alt text is required

`![A descriptive sentence](path.png)`. What would a screen reader user need to know?

- **Informational image**: describe the content.
- **Decorative image**: empty alt `![](path.png)`. Screen readers skip it.

### 7.2 Relative paths for repo-local images

`![Chart](./images/monthly-signups.png)`. Keep images near the doc that uses them.

### 7.3 Size hints with HTML when needed

Markdown has no sizing syntax. If you need `width="400"`, switch to an `<img>` tag — sparingly.

---

## 8. Tables

### 8.1 Header row + separator row, always

```markdown
| Column A | Column B |
|----------|----------|
| data     | data     |
```

### 8.2 Alignment

```markdown
| Left | Center | Right |
| :--- | :----: | ----: |
```

### 8.3 Pipe counts match

Every row has the same number of `|` pipes, including leading and trailing. Auto-format in VS Code with "Markdown All in One" or the Prettier Markdown plugin.

### 8.4 Keep cells short

If a cell has more than ~15 words, extract to a footnote, a sub-section, or restructure the data. Long cells make tables unreadable.

### 8.5 Tables for data, not layout

If you reach for a table because you want two columns of prose side by side, you don't want a table — you want either prose with clear headings or a proper layout in an actual web page.

---

## 9. Frontmatter

### 9.1 Only if a consumer parses it

Static-site generators (Docusaurus, MkDocs, Jekyll, Hugo, Astro) read YAML frontmatter for title, date, tags, description, layout, etc. If no consumer exists, don't add frontmatter — it's noise.

### 9.2 Valid YAML

```yaml
---
title: My doc title
date: 2026-04-22
tags: [topic-a, topic-b]
description: A one-line summary.
---
```

- Strings with `:` or leading spaces need quoting.
- Dates are ISO 8601.
- Lists use `[a, b]` or dashed form.

### 9.3 Don't duplicate H1 in frontmatter and body

If the site generator renders `title` as the page H1, don't also put `# My doc title` as the first body line — it produces two H1s.

---

## 10. Accessibility

### 10.1 Alt text on images (covered above)

### 10.2 Descriptive link text (covered above)

### 10.3 Don't rely on color/emoji alone

Meaningful distinction must survive monochrome rendering and screen readers. `✅` alone says "check mark button" — add a word: `- [x] Done: Feature X`.

### 10.4 Tables with headers

Tables without header rows are unreadable for screen readers.

### 10.5 Heading hierarchy is accessibility

Proper H1→H2→H3 descent *is* the document outline for assistive tech.

---

## 11. Portability and rendering

### 11.1 Know your renderer

GitHub (GFM), GitLab (GFM+), VS Code preview (GFM-ish), static-site generators (varies). Test in the intended renderer before shipping.

### 11.2 Callouts (alerts)

`> [!NOTE]` etc. are GitHub-originated. GitLab supports them. Most static-site generators need a plugin. Renderers that don't understand them fall back to plain blockquotes — which is acceptable graceful degradation.

### 11.3 Mermaid diagrams

Render on GitHub (inside ```mermaid fences), GitLab, VS Code with extension. Not everywhere — document the dependency.

### 11.4 Math

`$inline$` and `$$display$$` KaTeX on GitHub since 2022. Elsewhere varies. Prefer rendered images if portability matters.

### 11.5 Emoji

Inline Unicode emoji render everywhere modern. `:shortcode:` renders on GitHub/GitLab but not in CommonMark-only renderers. Per this framework's convention, avoid emoji in generated docs unless the user explicitly asks.

---

## 12. Comments and TODOs

### 12.1 HTML comments for hidden content

`<!-- internal note, not rendered -->`. Useful for adf-version markers, review checklists, etc.

### 12.2 TODO markers

`<!-- TODO: @bhavesh - add screenshot by 2026-04-30 -->` or a plain `**TODO**: ...` in the body. Never leave TODOs unaddressed at ship time.

---

## 13. Versioning and provenance

### 13.1 Embed a version marker when the doc is regenerated by a tool

`<!-- adf-version: 3.1.0 -->` at the top of generated files (see `CLAUDE.template.md` for the canonical example). Lets upgrade scripts detect staleness.

### 13.2 Date stamps

For time-sensitive docs (runbooks, release notes): `**Last updated**: 2026-04-22` near the top. Update on every material change.

### 13.3 Source-of-truth links

If this doc mirrors or derives from another source, link to the upstream canonical location and note the relationship (`Generated from AI_DOCS/...`).

---

## 14. Review checklist (before handing off)

Run this mentally (or via a linter) before calling the doc done:

- [ ] Exactly one H1
- [ ] No skipped heading levels
- [ ] TOC if >150 lines
- [ ] All code fences have language tags
- [ ] All links have descriptive text
- [ ] All images have alt text
- [ ] All tables have header + separator rows
- [ ] Under 300 lines (or split into folder)
- [ ] Consistent emphasis style
- [ ] Single trailing newline
- [ ] No TODO markers left unresolved
- [ ] Links verified (relative paths exist, anchors match headings)

---

## 15. Tooling

- **Prettier** — auto-format Markdown on save; catches table alignment, list bullets, trailing whitespace.
- **markdownlint** — lint rules (MD001–MD045) catch most structure violations.
- **markdown-toc** — generate TOCs from headings.
- **VS Code "Markdown All in One"** — table formatter, TOC generator, auto-numbering.
- **Vale** — prose linting (style guide enforcement, beyond pure Markdown).

Wire at least Prettier + markdownlint into pre-commit for any project that generates Markdown at scale.
