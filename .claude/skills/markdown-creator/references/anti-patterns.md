# Markdown Anti-Patterns

> Part of [/markdown-creator](../SKILL.md). Common failure modes with before/after examples.

Each entry: the pattern, why it's wrong, and the fix.

---

## 1. Multiple H1s

**Wrong:**

```markdown
# Setup

## Prerequisites

# Configuration
```

**Why wrong:** Two top-level headings break the document outline. Screen readers, static-site nav, and AI summarizers all assume one H1 per file.

**Fix:**

```markdown
# Setup

## Prerequisites

## Configuration
```

---

## 2. Skipped heading levels

**Wrong:**

```markdown
# Title

#### Subsection
```

**Why wrong:** H1 → H4 skips H2 and H3. Breaks TOC generation and accessibility-tree outlines.

**Fix:**

```markdown
# Title

## Section

### Subsection
```

---

## 3. Bare URLs in prose

**Wrong:**

```markdown
For more info see https://github.com/org/repo/issues/42.
```

**Why wrong:** URLs in prose look broken, aren't descriptive, and strain readers.

**Fix:**

```markdown
For more info see [issue #42](https://github.com/org/repo/issues/42).
```

---

## 4. Mystery-meat link text

**Wrong:**

```markdown
Learn more about our API [here](https://docs.example.com/api).
Or read [this](https://docs.example.com/auth) for auth.
```

**Why wrong:** "here" and "this" say nothing when read out of context (e.g., by a screen reader listing all links on a page).

**Fix:**

```markdown
Learn more from our [API documentation](https://docs.example.com/api).
Read the [authentication guide](https://docs.example.com/auth) for auth.
```

---

## 5. Untagged code fences

**Wrong:**

````markdown
```
npm run build
```
````

**Why wrong:** No syntax highlighting, no language-aware tooling, no signal to the reader about what kind of code this is.

**Fix:**

````markdown
```bash
npm run build
```
````

When the language is genuinely "not code" (output, ASCII art, plain text), use `text`:

````markdown
```text
Build complete — 312 modules, 1.2MB gzipped
```
````

---

## 6. Images without alt text

**Wrong:**

```markdown
![](./diagram.png)
```

**Why wrong:** Screen readers announce "image" with no content. Users on slow connections see nothing. SEO loses context.

**Fix:**

```markdown
![System architecture: API gateway routes to three microservices backed by PostgreSQL](./diagram.png)
```

For **truly decorative** images, empty alt is correct:

```markdown
![](./decorative-separator.png)
```

---

## 7. Tables without header rows

**Wrong:**

```markdown
| data | data | data |
| data | data | data |
```

**Why wrong:** Renderer may not detect this as a table at all. Screen readers announce cells without column context.

**Fix:**

```markdown
| Column A | Column B | Column C |
| -------- | -------- | -------- |
| data     | data     | data     |
| data     | data     | data     |
```

---

## 8. Mismatched table pipes

**Wrong:**

```markdown
| A | B | C |
|---|---|
| x | y | z |
```

**Why wrong:** Three columns in header, two in separator → renderer fails or produces garbage.

**Fix:** Auto-format with Prettier or VS Code's Markdown All in One.

---

## 9. Tables used for layout

**Wrong:**

```markdown
|       |              |
| :---: | :----------- |
| ![Logo](./logo.png) | This is our company tagline. |
```

**Why wrong:** Tables are for tabular data. Using them for side-by-side layout hurts accessibility, responsive rendering, and screen readers.

**Fix:** Use prose with an inline image, or — if you genuinely need layout — switch to an actual HTML or framework component (not the right job for Markdown).

---

## 10. Inconsistent list bullets

**Wrong:**

```markdown
- First
* Second
+ Third
  - Nested
  * Also nested
```

**Why wrong:** Inconsistent bullets create visual noise in source and make diffs churnier.

**Fix:** Pick one (`-`) and use it everywhere.

---

## 11. Mixing ordered-list numbering styles

**Wrong:**

```markdown
1. First step
3. Second step
2. Third step
```

**Why wrong:** Works (renderer auto-numbers) but is confusing in source. Diff noise on reordering.

**Fix:** Either all `1.` (renderer auto-increments) or correct sequential numbers. Pick one style per repo.

---

## 12. Hard-wrapping prose inconsistently

**Wrong:**

```markdown
This paragraph soft-wraps freely without hard breaks.

This paragraph is
hard-wrapped at
an arbitrary width.
```

**Why wrong:** Mixed wrapping is a signal of drift. Diffs will be noisy when one style is edited in another.

**Fix:** Pick soft wrap (recommended for most docs) OR hard wrap at a consistent column (80 or 100). Stick to it per-repo.

---

## 13. Emoji as load-bearing content

**Wrong:**

```markdown
Status: ✅
```

**Why wrong:** Screen reader reads "check mark button". Searching/grepping the doc for "pass" or "done" finds nothing. If emoji rendering breaks (older terminal, older reader), content is lost.

**Fix:**

```markdown
Status: Done ✅
```

Or, if avoiding emoji per project convention:

```markdown
Status: Done
```

---

## 14. HTML soup instead of Markdown

**Wrong:**

```markdown
<div style="color: red"><p><strong>Warning:</strong> Don't do this.</p></div>
```

**Why wrong:** Half the renderers strip HTML for security. The rest render it inconsistently. And none of it participates in the Markdown outline.

**Fix:**

```markdown
> [!WARNING]
> Don't do this.
```

HTML is fine for things Markdown can't do (e.g., `<details>`, `<summary>`, explicit `<img width="...">`), but prefer Markdown constructs where they exist.

---

## 15. Trailing whitespace everywhere

**Wrong:**

```markdown
This line has trailing spaces.•••
So does this one.•••
```

**Why wrong:** Two-trailing-spaces is the Markdown hard-break syntax. If every line has them, every line becomes a hard break — breaking paragraph flow.

**Fix:** Trim trailing whitespace on save. `editorconfig` + `trim_trailing_whitespace = true` makes this automatic.

---

## 16. Too-deep nesting

**Wrong:**

```markdown
# T

## A

### B

#### C

##### D

###### E
```

**Why wrong:** H5/H6 rarely needed and usually signals structural drift. Renders as tiny text on most renderers.

**Fix:** Split the document. Each H2 could become its own file; the parent file becomes an index.

---

## 17. Orphaned footnotes and references

**Wrong:**

```markdown
See more in [the docs][docs-link].

[api-ref]: https://api.example.com
```

**Why wrong:** `[docs-link]` reference isn't defined; `[api-ref]` is defined but never used. Both go unnoticed because Markdown doesn't error on them.

**Fix:** Lint with markdownlint (MD053) or scan for dangling refs in CI.

---

## 18. TODO markers left in shipped docs

**Wrong:**

```markdown
## Configuration

TODO: fill this in once we finalize the schema.
```

**Why wrong:** TODOs in shipped docs mislead readers and rot.

**Fix:** Either write the content, or remove the section. If you need to track the gap, file an issue and link to it:

```markdown
> [!NOTE]
> Configuration details are pending schema finalization — see [#123](https://github.com/org/repo/issues/123).
```

---

## 19. Duplicating the H1 in frontmatter and body

**Wrong:**

```markdown
---
title: My Doc
---

# My Doc

Content starts here.
```

**Why wrong:** Static-site generators often render `title` as the page H1. This produces two H1s in the output.

**Fix:** Either omit the frontmatter `title`, or omit the body `# My Doc`. Check what your site generator does.

---

## 20. File ends without a newline

**Wrong:** File ends immediately after the last content character.

**Why wrong:** POSIX convention says text files end with `\n`. Many tools (cat, git diff, linters) complain. Some renderers produce subtly different output.

**Fix:** Single trailing newline. `editorconfig` + `insert_final_newline = true` enforces this.
