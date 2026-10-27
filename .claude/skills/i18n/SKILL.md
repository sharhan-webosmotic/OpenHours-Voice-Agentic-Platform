---
name: i18n
description: "Implement multi-language support, translations, RTL layout, and locale-aware formatting. Use when adding internationalization, translations, multi-language, or RTL support. Also triggers on: 'Add translations', 'Localization'."
next_skill: null
required_gate: null
skill_id: SK-034
context_budget:
  load_kb: 30
  scope: task
version: 1.0.5
dependencies:
  required: [build]
  optional: [design-discovery, design-tokens, design-screens]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---
# 🌍 Internationalization (i18n) Skill

> **Purpose**: World-class multi-language support with RTL and locale management
> **Output**: Translation structure, locale config, formatting utilities

---

## 🚨 Initialization & Memory Logic
> [!NOTE]
> **Gated Approach**: Memory initialization handled by [session-management](../session-management/SKILL.md). Gate status checked before skill handoff.

---

## 1. Setup (Next.js with next-intl)

### Installation
```bash
npm install next-intl
```

### Directory Structure
```
src/
├── i18n/
│   ├── config.ts           # Locale configuration
│   ├── request.ts          # Server-side i18n
│   └── routing.ts          # Locale routing
├── messages/
│   ├── en.json             # English translations
│   ├── es.json             # Spanish translations
│   ├── ar.json             # Arabic (RTL)
│   └── index.ts            # Export all locales
└── middleware.ts           # Locale detection
```

---

## 2. Translation File Structure

### Flat Keys (Recommended)
```json
{
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.loading": "Loading...",
  "auth.login.title": "Sign In",
  "auth.login.email": "Email Address",
  "auth.login.password": "Password",
  "auth.login.submit": "Sign In",
  "auth.login.error.invalid": "Invalid email or password",
  "dashboard.welcome": "Welcome, {name}!",
  "dashboard.stats.users": "{count, plural, =0 {No users} =1 {1 user} other {# users}}"
}
```

### Key Naming Convention
```
[module].[feature].[element].[state]
```

| Pattern | Example |
|---------|---------|
| Buttons | `common.save`, `form.submit` |
| Labels | `auth.login.email` |
| Messages | `auth.login.error.invalid` |
| Plurals | `dashboard.stats.users` |

---

## 3. RTL Support

### Detect RTL Locale
```typescript
// lib/i18n/rtl.ts
export const RTL_LOCALES = ['ar', 'he', 'fa', 'ur'];

export const isRTL = (locale: string): boolean => {
  return RTL_LOCALES.includes(locale);
};
```

### Apply RTL Styles
```tsx
// app/[locale]/layout.tsx
import { isRTL } from '@/lib/i18n/rtl';

export default function LocaleLayout({ 
  children, 
  params: { locale } 
}: { 
  children: React.ReactNode;
  params: { locale: string };
}) {
  const dir = isRTL(locale) ? 'rtl' : 'ltr';
  
  return (
    <html lang={locale} dir={dir}>
      <body className={dir === 'rtl' ? 'font-arabic' : ''}>
        {children}
      </body>
    </html>
  );
}
```

### RTL CSS Utilities
```css
/* styles/rtl.css */
[dir="rtl"] .ml-4 { margin-left: 0; margin-right: 1rem; }
[dir="rtl"] .mr-4 { margin-right: 0; margin-left: 1rem; }
[dir="rtl"] .text-left { text-align: right; }
[dir="rtl"] .text-right { text-align: left; }
```

---

## 4. Formatting Utilities

### Date & Time
```typescript
// lib/i18n/formatters.ts
export const formatDate = (date: Date, locale: string) => {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

export const formatTime = (date: Date, locale: string) => {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};
```

### Numbers & Currency
```typescript
export const formatNumber = (num: number, locale: string) => {
  return new Intl.NumberFormat(locale).format(num);
};

export const formatCurrency = (
  amount: number, 
  locale: string, 
  currency: string
) => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
};
```

---

## 5. Translation Workflow

### Process
1. **Extract**: Identify all user-facing strings
2. **Key**: Assign translation keys
3. **Translate**: Professional translation or AI-assisted
4. **Review**: Native speaker review
5. **Test**: Visual testing in each locale

### Missing Translation Fallback
```typescript
// i18n/config.ts
// Import your structured logger: import { logger } from '@/lib/logger';
export const i18nConfig = {
  defaultLocale: 'en',
  locales: ['en', 'es', 'ar'],
  onError: (error: { code: string; key: string; message?: string }) => {
    if (error.code === 'MISSING_MESSAGE') {
      // ✅ Use structured logger, not console.warn
      logger.warn('Missing i18n translation', { key: error.key });
      return error.key; // Fallback to key
    }
    throw error;
  },
};
```

---

## 6. Memory Integration

After implementing i18n:
1. Update `AI_DOCS/memory/context-map.md` with supported locales
2. Add translation keys to component documentation

---

## Rules Integration

> Claude Code auto-loads these rules when editing matching files:
> - `.claude/rules/frontend-rules.md` — accessibility, responsive design
> - `.claude/rules/ui-engineering-rules.md` — locale formatting (Intl.DateTimeFormat, Intl.NumberFormat)

## Suggested Next Actions
1. Set up locale routing
2. Create base translation files
3. Add RTL support if needed

## Next Step
Proceed to the next skill in the workflow as indicated in the YAML frontmatter.
