---
name: analytics
description: "Implement event tracking, analytics dashboards, and user behavior monitoring with GA4, PostHog, or Mixpanel. Use when adding analytics, tracking events, or setting up dashboards. Also triggers on: 'Add analytics', 'Track events', 'Setup GA4'."
next_skill: null
required_gate: null
skill_id: SK-043
context_budget:
  load_kb: 30
  scope: task
version: 1.0.6
dependencies:
  required: [build]
  optional: [deployment-planning, deployment-execution]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---
# 📊 Analytics Skill - Event Tracking & User Behavior

> **Purpose**: Implement world-class analytics with privacy-first approach
> **Output**: Tracking plan, event schema, dashboard requirements

---

> [!NOTE]
> **Gated Approach**: Memory initialization handled by [session-management](../session-management/SKILL.md). Gate status checked before skill handoff.

---


## 1. Event Naming Convention

> [!CRITICAL]
> **All events MUST follow this naming convention:**

### Format
```
[category]_[action]_[target]
```

### Examples
| Event | Category | Action | Target |
|-------|----------|--------|--------|
| `user_signup_completed` | user | signup | completed |
| `page_view_dashboard` | page | view | dashboard |
| `button_click_submit` | button | click | submit |
| `form_submit_contact` | form | submit | contact |
| `error_display_validation` | error | display | validation |

### Rules
1. **All lowercase** with underscores
2. **No PII** in event names or properties
3. **Max 40 characters** per event name
4. **Prefix by feature** for complex apps

---

## 2. Tracking Plan Template

### Required Events (Every App)

| Event | When | Properties |
|-------|------|------------|
| `page_view` | Every page load | `page_path`, `page_title`, `referrer` |
| `user_signup_started` | Signup form opened | `method` (email/social) |
| `user_signup_completed` | Account created | `method`, `user_id` (hashed) |
| `user_login_success` | Login successful | `method` |
| `user_login_failed` | Login failed | `error_type` |
| `user_logout` | User logs out | - |
| `error_displayed` | Error shown to user | `error_code`, `error_message` |

### Feature-Specific Events

```markdown
## [Feature Name] Events

| Event | Trigger | Properties |
|-------|---------|------------|
| `[feature]_started` | User begins flow | `entry_point` |
| `[feature]_step_completed` | Step finished | `step_name`, `step_number` |
| `[feature]_completed` | Flow finished | `duration_seconds` |
| `[feature]_abandoned` | User leaves mid-flow | `last_step` |
```

---

## 3. Provider Integration

### GA4 (Google Analytics 4)

```typescript
// lib/analytics/gtag.ts
export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID;

export const pageview = (url: string) => {
  window.gtag('config', GA_TRACKING_ID, {
    page_path: url,
  });
};

export const event = (action: string, params: Record<string, unknown>) => {
  window.gtag('event', action, params);
};
```

### PostHog (Privacy-First)

```typescript
// lib/analytics/posthog.ts
import posthog from 'posthog-js';

export const initPostHog = () => {
  if (typeof window !== 'undefined') {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      capture_pageview: false, // Manual control
      respect_dnt: true, // Privacy
    });
  }
};

export const track = (event: string, properties?: Record<string, unknown>) => {
  posthog.capture(event, properties);
};
```

---

## 4. Privacy & GDPR Compliance

> [!IMPORTANT]
> **GDPR/CCPA compliance is MANDATORY**

### Consent Management

```typescript
// hooks/useConsent.ts
export const useConsent = () => {
  const [consent, setConsent] = useState<'pending' | 'granted' | 'denied'>('pending');
  
  const grantConsent = () => {
    setConsent('granted');
    localStorage.setItem('analytics_consent', 'granted');
    initAnalytics();
  };
  
  const denyConsent = () => {
    setConsent('denied');
    localStorage.setItem('analytics_consent', 'denied');
  };
  
  return { consent, grantConsent, denyConsent };
};
```

### Data Rules
1. **No PII** in events (email, phone, name)
2. **Hash user IDs** before sending
3. **Respect DNT** (Do Not Track) header
4. **Cookie consent** before tracking
5. **Data retention** policy documented

---

## 5. Dashboard KPIs

### Essential Metrics (Every App)

| Metric | Formula | Target |
|--------|---------|--------|
| **DAU/MAU** | Daily Active / Monthly Active | > 20% |
| **Retention D1** | Users returning Day 1 | > 40% |
| **Retention D7** | Users returning Day 7 | > 20% |
| **Conversion Rate** | Signups / Visitors | > 2% |
| **Error Rate** | Errors / Sessions | < 1% |

### Role-Based Dashboards

| Role | Key Metrics |
|------|-------------|
| **Product** | Feature adoption, user flows, drop-off |
| **Engineering** | Error rates, performance, API latency |
| **Marketing** | Acquisition, conversion, campaign ROI |
| **Support** | Error frequency, help searches, ticket correlation |

---

## 6. Memory Integration

After implementing analytics:
1. Update `AI_DOCS/memory/project-context.md` — note analytics provider and consent model
2. Append to `AI_DOCS/memory/decision-log.md`: which provider was chosen and why (GA4 vs PostHog vs Mixpanel)
3. Update the active milestone's `tasks.md` — mark the analytics task DONE (summary row in `AI_DOCS/memory/task-ledger.md`)

---

## Rules Integration

> Claude Code auto-loads these rules when editing matching files:
> - `.claude/rules/development-rules.md` — naming conventions
> - `.claude/rules/security-rules.md` — PII protection, data privacy
> - `.claude/rules/frontend-rules.md` — performance (lazy load tracking scripts)

## Suggested Next Actions
1. Create tracking plan for current milestone
2. Implement consent management
3. Set up dashboards

## Next Step
Proceed to the next skill in the workflow as indicated in the YAML frontmatter.

<!-- Version: 1.0.4 — 2026-06-29 — Track E T-E.11: swept deprecated memory/task.md reference to the active milestone tasks.md + task-ledger summary. -->
