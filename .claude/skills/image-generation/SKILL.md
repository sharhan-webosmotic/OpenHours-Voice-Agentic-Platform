---
name: image-generation
description: "Generate logos, favicons, icons, illustrations, and UI mockups using Claude's native image generation. Use when creating a logo, favicon, app icon, illustration, or any visual asset for the project. Also triggers on: 'Generate image', 'Create logo', 'Create favicon', 'Generate icon', 'Create illustration', 'Design logo'."
effort: medium
next_skill: null
required_gate: null
skill_id: SK-IMG
context_budget:
  load_kb: 30
  scope: task
version: 1.2.0
dependencies:
  required: []
  optional: [design-discovery, design-tokens, design-screens]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

# Image Generation (Claude Native)

> **No external dependencies** — uses Claude's built-in image generation.
> **No API keys needed** — works natively in Claude Code.

## When to Use

- Generate logos, favicons, app icons
- Create illustrations for UI/marketing
- Generate placeholder images during design phase
- Create icons and visual assets
- Generate OG images and social media graphics

## Supported Output

Claude can generate images directly. Request specific formats:

| Asset | Recommended Size | Format |
|-------|-----------------|--------|
| **Favicon** | 32x32, 16x16 | PNG (transparent) |
| **App Icon** | 1024x1024 (source) | PNG (square, no transparency) |
| **Logo** | Vector-style, various | PNG/SVG description |
| **OG Image** | 1200x630 | PNG/JPG |
| **Illustration** | Context-dependent | PNG |

## Workflow

### Step 1: Gather Design Context

Before generating any image, read:
- `AI_DOCS/design/design-dna.md` — color palette, brand feel, typography
- `AI_DOCS/memory/project-context.md` — project name, industry, audience

### Step 2: Generate with Design DNA

Always reference the project's Design DNA when generating:

```
Generate a favicon for [project name]:
- Primary color: [from design-dna.md]
- Style: [from design-dna.md design feel]
- Industry: [from project-context.md]
- Must work at 16x16 and 32x32
- Transparent background
- Simple, recognizable at small sizes
```

### Step 3: Generate App Icons (if mobile)

```
Generate an app icon for [project name]:
- Size: 1024x1024 (will be scaled down)
- NO transparency (app stores require solid background)
- Primary color: [from design-dna.md]
- Simple, bold shape — recognizable at 60x60
- No text (unreadable at small sizes)
- Follow iOS/Android guidelines:
  - iOS: Rounded corners applied by OS (don't add them)
  - Android: Adaptive icon with foreground + background layers
```

### Step 4: Generate Logos

```
Generate a logo for [project name]:
- Brand colors: [from design-dna.md]
- Style: [clean/modern/playful/corporate — from design feel]
- Variations needed:
  1. Full logo (icon + text)
  2. Icon only (for small spaces)
  3. Dark background version
  4. Light background version
```

## Integration with Design System

When the `design-system` skill captures Design DNA (Batch A — Brand Identity), this skill is invoked for:
- Favicon generation (Question about favicon in Batch A)
- App icon generation (if mobile project)
- Logo generation (if no existing brand guidelines)

The generated assets are saved to:
```
AI_DOCS/design/assets/
├── favicon-16.png
├── favicon-32.png
├── app-icon-1024.png
├── logo-full.png
├── logo-icon.png
└── logo-dark.png
```

## Rules

1. **Always use project's Design DNA colors** — never generate with random colors
2. **Simple over complex** — favicons/icons must be recognizable at 16x16
3. **No text in app icons** — unreadable at small sizes
4. **Generate variations** — light bg, dark bg, icon-only, full logo
5. **Save to `AI_DOCS/design/assets/`** — not in code/ until design is approved
6. **Claude models only** — no external AI image APIs (DALL-E, Midjourney, FLUX, etc.)
7. **Record every generated asset in `AI_DOCS/design/asset-manifest.md`** (`rules/design-rules.md` "Asset sourcing & provenance"): repo path, `generated: <one-line prompt summary>`, date, where used — so a future need (regenerate larger, restyle, replace) finds the origin instantly.

## Inspect before handoff (BLOCKING)

Open every generated image or SVG (Read the file) and read dimensions with PIL. Confirm: it matches the Design DNA colors, stays legible at the intended embed size (favicons at 16x16), any text is spelled right, nothing is cut off. Regenerate what fails. Handoff block per `rules/document-generation-rules.md` (Render, inspect, then hand off): Opened / Found and fixed / Please verify. Example Please verify items: brand fit, wording, subject, the variations requested.

## Cross-References

- Design DNA and brand identity → `design-system/SKILL.md`
- Color palette selection → `.claude/rules/component-reuse-rules.md`
- OG image generation (Next.js) → `nextjs/SKILL.md`

<!-- Version: 1.1.2 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
<!-- Version: 1.2.0 | 2026-10-22 | Inspect before handoff for generated images -->
