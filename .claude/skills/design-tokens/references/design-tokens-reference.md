# Design Tokens & UI Consistency Standards

> **Purpose**: Centralized design token specifications for consistent UI components
> **Audience**: AI Designers and Developers generating UI code

---

## 🚨 Critical Rule

> [!CAUTION]
> **ALL UI components MUST use these standard tokens. Arbitrary values are PROHIBITED.**

---

## 1. Component Size Tokens

### Size Scale (MANDATORY)

| Size | Height | Padding X | Icon Size | Use Case |
|------|--------|-----------|-----------|----------|
| `sm` | 32px (h-8) | 12px (px-3) | 16px (w-4 h-4) | Dense UIs, inline actions, table cells |
| `md` | 40px (h-10) | 16px (px-4) | 20px (w-5 h-5) | **Default for all components** |
| `lg` | 48px (h-12) | 24px (px-6) | 24px (w-6 h-6) | Hero CTAs, mobile primary actions |

### Component Size Matrix

| Component | `sm` | `md` (Default) | `lg` |
|-----------|------|----------------|------|
| Button | `h-8 px-3 text-sm` | `h-10 px-4 text-base` | `h-12 px-6 text-lg` |
| Input | `h-8 text-sm` | `h-10 text-base` | `h-12 text-lg` |
| Select | `h-8 text-sm` | `h-10 text-base` | `h-12 text-lg` |
| Textarea | `min-h-20` | `min-h-24` | `min-h-32` |
| Badge | `h-5 px-2 text-xs` | `h-6 px-2.5 text-sm` | `h-7 px-3 text-base` |
| Avatar | `w-8 h-8` | `w-10 h-10` | `w-12 h-12` |

---

## 2. Spacing Scale

### Base Unit: 4px

| Token | Value | Tailwind | Use Case |
|-------|-------|----------|----------|
| `--space-1` | 4px | `p-1`, `gap-1` | Tight spacing, icon gaps |
| `--space-2` | 8px | `p-2`, `gap-2` | Component internal padding |
| `--space-3` | 12px | `p-3`, `gap-3` | Form field gaps |
| `--space-4` | 16px | `p-4`, `gap-4` | Section spacing |
| `--space-5` | 20px | `p-5`, `gap-5` | Card padding |
| `--space-6` | 24px | `p-6`, `gap-6` | Container padding |
| `--space-8` | 32px | `p-8`, `gap-8` | Section breaks |
| `--space-10` | 40px | `p-10`, `gap-10` | Large spacing |
| `--space-12` | 48px | `p-12`, `gap-12` | Hero sections |
| `--space-16` | 64px | `p-16`, `gap-16` | Page margins |

> [!WARNING]
> **PROHIBITED**: `gap-3.5`, `p-[15px]`, `mt-[22px]` - No arbitrary values!

---

## 3. Border Radius Tokens

| Token | Value | Tailwind | Use Case |
|-------|-------|----------|----------|
| `--radius-sm` | 4px | `rounded-sm` | Small elements, badges |
| `--radius-md` | 6px | `rounded-md` | Buttons, inputs, cards |
| `--radius-lg` | 8px | `rounded-lg` | Modals, larger cards |
| `--radius-xl` | 12px | `rounded-xl` | Feature cards, hero sections |
| `--radius-full` | 9999px | `rounded-full` | Avatars, pills, circular buttons |

---

## 4. Touch Target Requirements

| Device | Minimum Size | Requirement |
|--------|--------------|-------------|
| Mobile | 44x44px | WCAG 2.5.5 compliance |
| Desktop | 32x32px | Clickable area minimum |

---

## 5. CSS Variables Template

```css
:root {
  /* Size Tokens */
  --size-sm: 32px;
  --size-md: 40px;
  --size-lg: 48px;
  
  /* Spacing Scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  
  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  
  /* Icon Sizes */
  --icon-sm: 16px;
  --icon-md: 20px;
  --icon-lg: 24px;
}
```

---

## 6. Common Violations

### ❌ BAD Examples
```tsx
// Arbitrary heights
<button className="h-9 py-2.5 px-3.5">Save</button>

// Custom spacing
<div className="gap-[15px] p-[22px]">

// Inconsistent sizing
<input className="h-[38px]" />
```

### ✅ GOOD Examples
```tsx
// Token-based sizing
<Button size="md">Save</Button>

// Standard spacing
<div className="gap-4 p-6">

// Consistent sizing
<Input size="md" />
```

---

## 7. Enforcement Checklist

Before generating UI code, verify:

- [ ] All buttons use `size="sm|md|lg"` prop
- [ ] All inputs use `size="sm|md|lg"` prop
- [ ] Spacing uses 4px-based scale only
- [ ] Border radius uses token values only
- [ ] Icons match component size (sm=16px, md=20px, lg=24px)
- [ ] Mobile touch targets are minimum 44x44px

---

## 8. Layout Direction (RTL/LTR) & i18n

> [!CAUTION]
> **Use Logical Properties** for spacing/positioning to support RTL automatically.

### Logical Properties (MANDATORY)

| Use This | Not This | Purpose |
|----------|----------|---------|
| `ps-4` (padding-start) | `pl-4` | Auto-flips for RTL |
| `pe-4` (padding-end) | `pr-4` | Auto-flips for RTL |
| `ms-2` (margin-start) | `ml-2` | Auto-flips for RTL |
| `me-2` (margin-end) | `mr-2` | Auto-flips for RTL |
| `start-0` | `left-0` | Positioning |
| `end-0` | `right-0` | Positioning |
| `text-start` | `text-left` | Text alignment |
| `text-end` | `text-right` | Text alignment |

### i18n Key Format

```
Pattern: [module].[screen].[element]
Example: auth.login.submitButton, dashboard.stats.title
```

### Date/Number Formatting

```typescript
// ✅ GOOD - Locale-aware
new Intl.DateTimeFormat(locale).format(date)
new Intl.NumberFormat(locale).format(number)

// ❌ BAD - Hardcoded format
date.toLocaleDateString('en-US')
```

---

*Part of AI_SKILLS Framework*
*Referenced by: design-system, build skills*
