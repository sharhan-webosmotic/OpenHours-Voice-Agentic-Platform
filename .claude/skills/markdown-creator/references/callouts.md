# GFM Callouts — Full Catalog

> Part of [/markdown-creator](../SKILL.md). When and how to use GitHub-flavored callouts (alerts).

---

## The five canonical callouts

GitHub Flavored Markdown supports exactly these five alert keywords. They render as colored boxes on GitHub, GitLab, and most modern Markdown renderers.

```markdown
> [!NOTE]
> Useful information that users should know, even when skimming.

> [!TIP]
> Helpful advice for doing things better or more easily.

> [!IMPORTANT]
> Key information users need to know to achieve their goal.

> [!WARNING]
> Urgent info that needs immediate user attention to avoid problems.

> [!CAUTION]
> Advises about risks or negative outcomes of certain actions.
```

---

## When to use which

| Callout | Use for | Colour (GitHub) |
|---|---|---|
| `[!NOTE]` | Background context, sidebars, "by the way" info. | Blue |
| `[!TIP]` | Non-obvious shortcut, best practice, optimization. | Green |
| `[!IMPORTANT]` | Must-know to succeed; not dangerous, just load-bearing. | Purple |
| `[!WARNING]` | Likely to cause problems; read before acting. | Yellow/Orange |
| `[!CAUTION]` | Destructive, irreversible, or security-sensitive. | Red |

Rule of thumb: WARNING = "this might hurt", CAUTION = "this will definitely hurt if you mess up".

---

## Syntax rules

1. **`[!KEYWORD]` is all uppercase, inside square brackets with a leading bang.**
2. **Exactly one space after `>` on the first line; nothing else on that line.**
3. **Content starts on the second line**, prefixed with `> `.
4. **Multi-paragraph content**: separate with a blank `>` line.
5. **No callouts inside list items** on GitHub — they render as plain blockquotes.

### Correct

```markdown
> [!WARNING]
> First paragraph of the warning.
>
> Second paragraph, separated by a blank `>` line.
```

### Incorrect

```markdown
> [!warning]             <-- lowercase, won't render as callout
> [!WARNING] inline text <-- text on same line as keyword, won't render
- > [!NOTE]              <-- inside a list, degrades to plain blockquote
  > Content
```

---

## Renderer compatibility matrix

| Renderer | NOTE | TIP | IMPORTANT | WARNING | CAUTION | Degrades to |
|---|:-:|:-:|:-:|:-:|:-:|---|
| GitHub | ✓ | ✓ | ✓ | ✓ | ✓ | native |
| GitLab (15.11+) | ✓ | ✓ | ✓ | ✓ | ✓ | native |
| VS Code preview | ✓ | ✓ | ✓ | ✓ | ✓ | native (1.80+) |
| Bitbucket | × | × | × | × | × | plain blockquote |
| Docusaurus | via admonitions (`:::note`) | | | | | plugin or rewrite |
| MkDocs Material | via admonitions (`!!! note`) | | | | | plugin or rewrite |
| Hugo | × (default) | | | | | plain blockquote |
| Jekyll | × (default) | | | | | plain blockquote |
| Pandoc | × | | | | | plain blockquote |

### Graceful degradation

On renderers without callout support, GFM callouts fall back to plain blockquotes — the content remains readable, just without the colored box. This is usually acceptable.

If you need first-class callouts on a static-site generator, convert at generation time:

- Docusaurus: `> [!NOTE]\n> text` → `:::note\ntext\n:::`
- MkDocs Material: `> [!NOTE]\n> text` → `!!! note "Note"\n    text`

Write a small preprocessor in CI or a Pandoc filter.

---

## Alternatives when GFM callouts aren't supported

### Labeled blockquote (universal fallback)

```markdown
> **Warning:** Description of the risky thing.
```

Renders everywhere. Not as visually distinct as a callout, but semantic.

### Emoji + bold (avoid unless asked)

Some teams use `⚠️ **Warning:**` or similar. Per this framework's convention, avoid emoji in generated docs unless the user explicitly asks. If you must, include the word ("Warning") so screen readers aren't left with just the emoji name.

### HTML `<aside>` or styled `<div>`

Portable to any HTML renderer, ignored by plain Markdown renderers. Overkill for most docs.

---

## Anti-patterns

1. **Callout everywhere** — every section has a NOTE box. If everything is emphasized, nothing is. Use callouts sparingly (a handful per doc).
2. **CAUTION for non-destructive things** — reserve CAUTION for actions that can lose data, break production, or trigger real-world consequences.
3. **Full paragraphs inside a WARNING** — callouts are for short, attention-grabbing text. If the warning needs three paragraphs, lead with one strong sentence in the callout, then a normal section below with the details.
4. **Nested callouts** — not supported by GFM.
5. **Replacing headings with callouts** — a callout is an inline emphasis, not a structural element. Don't use it where H3 belongs.

---

## Pairing callouts with other elements

### Callout + code block

```markdown
> [!CAUTION]
> This command is destructive. Confirm the target branch first.
>
> ```bash
> git reset --hard origin/main
> ```
```

Most renderers handle this correctly, but test before shipping.

### Callout + list

```markdown
> [!IMPORTANT]
> Before merging, verify:
> - Tests pass
> - Migration dry-run is clean
> - Sign-off from the on-call engineer
```

---

## Quick-copy templates

```markdown
> [!NOTE]
> <one sentence>

> [!TIP]
> <one sentence>

> [!IMPORTANT]
> <one sentence>
>
> <optional elaboration>

> [!WARNING]
> <one sentence about likely failure mode>

> [!CAUTION]
> <one sentence about irreversible or destructive effect>
```
