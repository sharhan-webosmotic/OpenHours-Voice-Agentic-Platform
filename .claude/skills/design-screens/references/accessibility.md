# Accessibility Requirements

> WCAG 2.1 AA compliance rules extracted from the Design System skill.
> Referenced by `SKILL.md` — do not use independently.

---

> [!CAUTION]
> **WCAG 2.1 AA compliance is MANDATORY for Production-Grade applications.**

## Color Contrast

- Normal text (< 24px): **4.5:1** contrast ratio
- Large text (>= 24px): **3:1** contrast ratio
- Interactive elements: **3:1** contrast ratio
- **CONTRAST VERIFICATION**: Since you cannot run external tools, you MUST explicitly calculate the relative luminance of your chosen color pairs in the chat output to PROVE they meet the 4.5:1 ratio before finalizing the palette.

## Keyboard Navigation

- All interactive elements must be keyboard accessible
- Visible focus indicators (outline, border, background change)
- Logical tab order (top to bottom, left to right)
- Skip navigation links for screen readers

## Screen Reader Support

- Semantic HTML (`<nav>`, `<main>`, `<article>`, `<button>`)
- ARIA labels for icon-only buttons
- ARIA live regions for dynamic content
- Alt text for all images

## Touch Targets

- Minimum size: **44x44px** (iOS HIG, Android Material)
- Adequate spacing between touch targets (8px minimum)
