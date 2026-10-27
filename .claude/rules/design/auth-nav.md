---
paths:
  - "AI_DOCS/design/**"
  - "design-system/**"
---

# Auth, Navigation, and Exit-Path Principles

> Section C of the design-language knowledge base. Index: `rules/design-language.md`. Read by `design-screens` (Auth / Navigation / Exit-path Gate). The product must never lose its front door or its back button. The enforceable version is in `rules/design-rules.md` (Auth, navigation & exit paths); the gate is in `skills/design-screens`. This file is the underlying knowledge.

## C.1 Authentication

- Treat login as the front door: clear Sign In and Register entries, social or passwordless options where they fit, show/hide password, inline validation, MFA prompts where the domain requires.
- A user-friendly, secure login builds trust: people give details more readily when the process feels safe and simple.
- Accessibility is non-negotiable: login forms work with a screen reader and keyboard, inputs have real labels (not placeholder-only).
- Cover the session edges: password reset, email verification, 2FA where required, and a session-timeout re-auth that preserves in-progress form state.
- Every authenticated app has a visible sign-out, normally in the avatar/secondary menu.

## C.2 Navigation and exit paths

- Keep navigation consistent and visible: a top bar or side menu on desktop, a bottom tab bar or drawer on mobile, applied uniformly across authenticated screens.
- Every page and function needs an exit pathway. On mobile that is almost always the top-left back arrow; on web it is a breadcrumb or a persistent navbar; modals get a close. No screen is a dead end.
- For complex tasks use progressive disclosure (step-by-step), showing only what is needed at each step with a clear way back.
- Role-based items are hidden, not merely disabled, when the current role lacks access (mirrors RBAC).
- Mark the post-login default landing page, and on single-page apps keep the browser back working (History API) so there are no dead ends.

## C.3 Calls to action (in-app)

- One clear primary action per screen, using size, color, and whitespace so the click path is obvious. Secondary actions use a quieter style. This pairs with the "one clear CTA" minimum in `rules/design-rules.md`.

<!-- Version: 1.0.0 (2026-06-30): split from design-language.md Section C. -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
