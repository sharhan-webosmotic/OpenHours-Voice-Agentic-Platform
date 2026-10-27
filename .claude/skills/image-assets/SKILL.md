---
name: image-assets
description: "Optimize images for web: compression, WebP/AVIF conversion, lazy loading, responsive srcset. Use when optimizing images, compressing assets, or adding lazy loading. Also triggers on: 'Hero', 'Banner', 'Icon', 'Logo'."
effort: medium
next_skill: null
skill_id: SK-051
context_budget:
  load_kb: 30
  scope: task
version: 1.2.0
dependencies:
  required: [design-discovery, design-tokens, design-screens]
  optional: []
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---
# Image Assets

> Business-quality images. Web-optimized. Fast loading.

---

## 🚨 Initialization & Memory Logic
> [!NOTE]
> **Gated Approach**: Memory initialization handled by [session-management](../session-management/SKILL.md). Gate status checked before skill handoff.

---

## Image Types

| Type | Size | Format | Use |
|------|------|--------|-----|
| Hero | 1920x1080 | WebP | Landing pages |
| Card | 400x300 | WebP | Product cards |
| Thumbnail | 150x150 | WebP | Lists, grids |
| Icon | 24-48px | SVG | UI elements |
| Logo | Variable | SVG | Branding |

## Optimization Rules

1. **Format**: WebP primary, AVIF where supported
2. **Responsive**: srcset with 1x, 2x, 3x
3. **Lazy Load**: loading="lazy" + blur placeholder
4. **Alt Text**: Descriptive for SEO
5. **CDN**: Serve from edge

## Generation Context

When generating images, provide:
- Business context (brand, industry)
- Color palette (from `AI_DOCS/design/design-dna.md` — Colors section)
- Style (professional, playful, minimal — from Design DNA Tone)
- Purpose (hero, illustration, icon)

## Output Template

```markdown
## Generated Image

**Purpose**: [Hero/Card/Icon]
**Dimensions**: [WxH]
**Format**: WebP
**Alt Text**: [Descriptive]

Optimizations applied:
- [x] Compressed
- [x] Responsive variants
- [x] Lazy load ready
- [x] CDN path
```

## Rules
1. ALWAYS optimize before use
2. ALWAYS provide alt text
3. Match brand colors and tone from `AI_DOCS/design/design-dna.md`
4. Prefer SVG for icons/logos
5. **Provenance is mandatory** (`rules/design-rules.md` "Asset sourcing & provenance"): free internet assets (photos, illustrations, 3D elements, characters) are welcome when the license permits commercial use (Unsplash, Pexels, unDraw, Storyset, and equivalent explicitly-licensed sources). Record EVERY imported or optimized asset as a row in `AI_DOCS/design/asset-manifest.md`: repo path, exact source URL (or `generated:` / `client:`), license, date, where used. An asset with an unknown license never ships in a client deliverable.

<!-- Version: 1.1.2 | 2026-10-21 | effort set per the v4.28.0 cost policy -->

## Inspect before handoff (BLOCKING)

Open every produced or optimized image (Read the file) and print its dimensions and byte size with PIL (`Image.open(p).size`). Confirm: dimensions match the intended slot, it stays legible at the intended embed size, any text in it is spelled right, no cropping or artifacts, alt text recorded. Fix and re-check. Handoff block per `rules/document-generation-rules.md` (Render, inspect, then hand off): Opened / Found and fixed / Please verify. Example Please verify items: brand fit, text wording, the right subject.
<!-- Version: 1.2.0 | 2026-10-22 | Inspect before handoff for produced images -->
