# Style Rules — Casing and Formatting

This file is the canonical reference for casing, naming, and formatting rules across markdown sources, DOCX outputs, and diagram labels. `docx-from-markdown` honors these rules, and labels given to the `diagram-design` plugin follow them. Cite this file when justifying a style choice.

## 1. Heading Case

Headings use **Title Case**. Capitalize:

- The first word and the last word of the heading, always.
- All "major" words: nouns, pronouns, verbs, adjectives, adverbs, conjunctions of 4+ letters.

Keep lowercase (except as first or last word):

- Articles: `a`, `an`, `the`.
- Short prepositions (3 letters or fewer): `at`, `by`, `in`, `of`, `on`, `to`, `up`, `via`, `for`.
- Short conjunctions: `and`, `or`, `but`, `nor`, `yet`.

Examples that are **correct**:

- "System Overview"
- "Multi-Tenant Model"
- "How Different Verticals Map to the Same Backend"
- "GPS and Realtime Tracking"
- "MVP Timeline"

Examples that are **wrong**:

- "system overview" (lowercase major words)
- "SYSTEM OVERVIEW" (all caps — feels like shouting)
- "How different verticals map to the same backend" (sentence case)
- "How Different Verticals Map To The Same Backend" (Title-Cased `to` and `the`)

## 2. Body Prose Case

Body paragraphs use **sentence case**. Do not Title-Case mid-paragraph nouns:

- Correct: "The database itself refuses the wrong row."
- Wrong: "The Database Itself Refuses the Wrong Row."

Bolded inline labels at the start of a paragraph use the same rule:

- Correct: `**Client layer:** five surfaces share one backend`
- Wrong: `**Client Layer:** Five Surfaces Share One Backend`

## 3. Code Identifiers — Preserve Source Case

Code identifiers stay in their declared case, always. Do not "correct" them.

| Identifier kind | Convention | Examples |
|---|---|---|
| Database columns | `snake_case` | `tenant_id`, `created_at`, `last_seq` |
| Enum / state values | `UPPER_SNAKE_CASE` | `DRAFT`, `ENROUTE_PICKUP`, `NO_SHOW` |
| Function and method names | `camelCase` (JS) / `snake_case` (Python) | `getUserById`, `handle_submit` |
| Class / type names | `PascalCase` | `TenantInterceptor`, `BaseLLMProvider` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT_MS` |
| File names | `kebab-case` | `user-profile.service.ts`, `tenant-context.ts` |

When mentioning these in prose, wrap them in single backticks: `` `tenant_id` ``, `` `ENROUTE_PICKUP` ``.

## 4. Product Names — Spell Them Officially

Product names render exactly as the vendor spells them. When in doubt, check the official site.

| Wrong | Correct |
|---|---|
| postgresql, postgres | **PostgreSQL** (the official product), `postgres` (the binary / lowercase usage) |
| timescaledb | **TimescaleDB** |
| nestjs, nest.js, NEST JS | **NestJS** |
| socketio, socket-io | **Socket.IO** |
| bullmq, BullMq | **BullMQ** |
| stripe connect | **Stripe Connect** |
| google maps, googlemaps | **Google Maps** |
| twilio | **Twilio** |
| jwt, Jwt | **JWT** (acronym, all caps) |
| oauth, OAuth2 | **OAuth** (or **OAuth 2.0** when the version matters) |
| github | **GitHub** |
| nodejs, node js | **Node.js** |
| typescript, TypeScript | **TypeScript** (Title-cased as a single proper noun) |

## 5. Acronyms

Acronyms stay in upper case in prose:

- `API`, `URL`, `JWT`, `MVP`, `NEMT`, `GPS`, `CMS`, `SLA`, `RBAC`, `RLS`, `SaaS`, `PII`, `FCM`, `APNS`.

The article in front of an acronym is governed by how the acronym is pronounced:

- "an API" (vowel sound), "a JWT", "an SLA" (vowel sound from "ess").

## 6. Em-dash and En-dash (forbidden)

- The **em-dash** (`—`) is forbidden everywhere. Rewrite the sentence: a comma for a light aside, a colon when what follows explains, parentheses for a true parenthetical, or two sentences.
- The **en-dash** (`–`) is forbidden. Numeric and date ranges use the word `to`: "Phase 2 lasts 4 weeks", "13 to 16 weeks", "2026 to 2027".
- A regular hyphen (`-`) is fine for compound modifiers: `multi-tenant`, `per-tenant`, `state-machine config`.

## 7. List Lead-In Format

When introducing a bulleted or numbered list, the lead-in line ends with a colon:

```markdown
**External APIs:** wrapped in adapter modules so they are easy to mock in tests and swap regionally:

- **Google Maps:** routing, ETA, place autocomplete.
- **Stripe Connect:** per-tenant payouts. We never custody funds.
- **Twilio:** SMS for trip updates and OTP fallback.
```

The lead label is bold with the colon inside the bold span (`**Label:**`, never `**Label**:`). Each bullet leads with a **bold label and colon**, then the description in sentence case.

## 8. Numbered List vs Bulleted List (by purpose)

The list kind is a content decision made in the Markdown. The converter never
changes one kind into another. Three kinds, each with one house format (from the
approved ZENi5 work scope):

- **Unordered list** (`- `) when the items are simply a set to share: parallel
  options, examples, a handful of facts. Brand Symbol bullet.
- **Ordered list** (`1. `) when the order carries meaning (steps, a timeline,
  milestones) or the reader needs a number to point at an item (deliverables,
  exclusions, assumptions, client responsibilities, risks, questions). The number
  is bold when the item leads with a bold label.
- **Grouped ordered list** (`1. **Group title**` with nested `  - ` sub-items) for
  feature modules, milestone lanes, and any list whose items are groups of work.
  Numbers at the template indent, sub-bullets with the glyph under the parent's text.

In a workscope the top-level lists of Sections 3, 5 and 7 to 12 are ordered
(feature modules, lanes, stack, deliverables, exclusions, future scope,
responsibilities, notes, assumptions), and their work items are nested bullets.
Never number a list only to make it look formal, and never leave a sequence or a
referenced list as bullets.

## 9. Table Header Case

Pipe-table headers use **sentence case** (not Title Case):

```markdown
| Driver state | Emit cadence | Notes |
|---|---|---|
| `ON_TRIP` | 5 seconds | Critical for ETA |
| `AVAILABLE` | 15 seconds | Keeps Redis Geo fresh |
```

Title Case in table headers is acceptable when the headers are short proper nouns (e.g., "Phase", "Weeks", "Status").

## 10. URLs and Paths

- **Absolute URLs** in their canonical case: `https://app.example.com/v1/trips`.
- **Relative paths** in posix style: `code-samples/01-tenant-isolation.md`. Never backslashes.
- **File paths in prose** in single backticks: `` `AI_DOCS/memory/session-state.md` ``.

## 11. Common Mistakes To Avoid

- Writing `Postgres` in prose when referring to the product (write `PostgreSQL` for first mention, then `Postgres` is acceptable shorthand).
- Title-casing every word in a heading including articles and short prepositions.
- Forgetting that acronyms are all caps even when the surrounding text is not.
- Sneaking an em-dash or en-dash back in (use a colon, comma, parentheses, the word `to`, or split the sentence).
- Inconsistent capitalization across a single document (e.g., "Postgres" in one paragraph, "postgresql" in another).
- Putting code identifiers (`ENROUTE_PICKUP`) into sentence case as if they were words.

When in doubt, default to **the most respectful version of the name** — the product owners chose their spelling; respect it.

## 12. Block Structure (soft-wrap is honored)

> The single biggest source of "the spacing looks wrong" is not a spacing value at
> all, it is block boundaries being read incorrectly.

Markdown paragraphs are **soft-wrapped**: consecutive non-blank lines are ONE
paragraph, and a blank line separates paragraphs. The converter honors this.

- A prose paragraph wrapped across five source lines renders as **one** DOCX
  paragraph, not five. Treating each line as a paragraph injects a spurious block
  gap per line and renders every wrapped line as a short stubby paragraph, which is
  what the layout complaint actually looks like.
- A **list item** whose text wraps keeps its continuation lines. They are indented
  and do not start with `-`, so a naive line-per-paragraph reader drops them out of
  the list entirely, breaking the bullet mid-item.
- Consecutive `> ` lines are **one** blockquote.
- A wrapped **numbered** item does not reset the list. Reading continuation lines as
  non-list lines restarts numbering at 1 on the next item.

Implementation: `_starts_block` decides where a block ends, `_gather_wrapped` joins
it. Every prose, bullet, and numbered branch in the conversion loop goes through
`_gather_wrapped`. Never advance the loop one line at a time for these blocks.

Verify block integrity on any generated file by reconstructing the expected blocks
from the source and confirming each lands as exactly one paragraph. When comparing,
strip inline markup (`**bold**`, backticks, `[text](url)`) from the expected text
first, because the DOCX stores it as formatting with the markers removed. Both counts
must be zero-missing:

```
PROSE  expected N | intact N | missing 0
LISTS  expected M | intact M | missing 0
```

## 13. Vertical Rhythm (DOCX spacing contract)

> Applies to `scripts/md_to_docx.py`. This is a **contract, not a preference**. A
> document can pass every casing rule above and still read as amateur because the
> gaps between blocks are arbitrary. Any edit to the converter honors this section.

### The scale

One 4pt base grid. Three steps, defined once in the script as constants and never
inlined as a magic `Pt(n)`:

| Constant | Value | Used for |
|---|---|---|
| `SPACE_XS` | 4pt | Inside a container (code cell padding, caption to figure) |
| `SPACE_SM` | 8pt | The standard block gap. Deliberately equals the master's `Normal` `spacing after=160` twips, so script-set gaps stay in step with the template's own paragraph rhythm |
| `SPACE_MD` | 12pt | A block deliberately separated from what precedes it (code label, figure) |

Heading spacing is **not** in this list. It comes from the master's `Heading 1/2/3`
styles (`before=320/220/180`, `after=160/100/80`) and is approved brand styling. Do
not override it from the script.

### Rules

1. **Never inline a spacing value.** Use a constant. A `Pt(6)` somewhere in the
   converter is how the rhythm drifted to four different gaps in the first place.
2. **Lists collapse between siblings.** The master's `ListParagraph` carries
   `before=120 after=120` with no `contextualSpacing`, so adjacent bullets sit 12pt
   apart and a list reads as a stack of unrelated paragraphs. Every list paragraph
   gets `contextualSpacing` (`_collapse_within_list`), which suppresses the gap
   between items of the same list while keeping it before the first and after the
   last.
3. **Never use an empty paragraph as a spacer.** A bare `doc.add_paragraph()`
   inherits `Normal`, contributing a full ~12pt empty text line *plus* 8pt after,
   and then the next block adds its own `space_before`. Use `_add_spacer`, which
   pins the line height to an exact 2pt so the gap is one `SPACE_SM` step.
4. **Bind a block to what follows it** with `_keep_with_next` wherever a split would
   be nonsense: every heading, a code language label, a figure with a caption, and a
   table's header band. Without it a heading strands at the foot of a page with its
   content overleaf.
5. **Table cells set spacing explicitly** (`space_before=0`, `space_after=0`,
   `line_spacing=1.1`). Inheriting `Normal` inside a cell inflates row height.
6. **Code is tighter than prose.** The code cell paragraph uses an exact 12pt line
   on a 9.5pt font. Inheriting `Normal`'s 1.08 auto leaves it too airy to scan as a
   block.

### pPr child order (BLOCKING)

OOXML defines a **required order** for `w:pPr` children. Word does not report a
violation: it silently repairs the paragraph by **dropping the offending
properties**, so the file opens looking subtly wrong with nothing to point at. This
is exactly how a spacing fix regresses invisibly.

- **Never call `ppr.append(...)` directly.** Always go through `_ppr_insert(ppr, tag)`,
  which places the child at its schema position and is order-independent, so it does
  not matter which helper runs first.
- `_assert_ppr_schema_order` runs on every `convert()` before the file is saved and
  **raises** on any violation. If a change trips it, fix the `append`, do not weaken
  the check.

### Verification

The spacing contract is machine-checkable. On a generated file:

```bash
python -c "
import zipfile, re
z = zipfile.ZipFile('<output>.docx')
xml = z.read('word/document.xml').decode('utf-8')
paras = re.findall(r'<w:p[ >].*?</w:p>', xml, re.S)
lists = [p for p in paras if 'w:val=\"ListParagraph\"' in p]
heads = [p for p in paras if re.search(r'w:val=\"Heading\d\"', p)]
print('lists w/ contextualSpacing:', sum('<w:contextualSpacing' in p for p in lists), '/', len(lists))
print('headings w/ keepNext      :', sum('<w:keepNext' in p for p in heads), '/', len(heads))
print('bare empty paragraphs     :', sum(1 for p in paras if not re.search(r'<w:t[^>]*>[^<]', p) and '<w:spacing' not in p))
"
```

Expected: lists and headings both fully covered, and bare empty paragraphs no more
than 3 (the cover drawing, the cover band, and the TOC field paragraph, all template
chrome). Any higher means an empty-paragraph spacer crept back in.

<!-- Version: 2026-10-05 | Section 8 rewritten to the list-kind-by-purpose rule of the approved ZENi5 work scope (unordered, ordered, grouped ordered), ported from the reference style rules. Rendered by docx-from-markdown 3.12.0. -->
