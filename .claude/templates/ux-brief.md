# UX Brief — <Project>

> Phase 0 of the design pipeline (produced by `/ux-foundation`). Decomposes the requirement before any visual work. Consumed by design-discovery, design-direction, design-screens, ux-advisor, principal-designer, accessibility-audit. Gate UX-0 must pass before Phase 1 (UX structure).

## 1. Role x JTBD (outcomes, not features)

| Role | Job (outcome) | Context (when/where) | Permission scope (tech-spec S3) | Done-signal |
|---|---|---|---|---|
| <role> | <outcome the role needs, not a screen> | <when/where/device> | <read/write/approve scope> | <how they know it worked> |

> If a job reads like a screen or a feature, rewrite it as the outcome. If roles + primary jobs cannot be named, STOP (Gate UX-0 stop-rule).

## 2. Functional vs non-functional split (the UX contract)

### Functional
- <role-job grouped, each traced to a tech-spec FR-id>

### Non-functional contract
- **Performance budget (per primary flow):** <target time-on-task + interaction latency>
- **Accessibility target:** WCAG 2.2 AA baseline. AAA-required flows: <list, or "none">.
- **Security UX:** sensitive fields to mask: <list>. Step-up re-auth actions: <list>. Session handling: <expectation>.
- **Audit / compliance:** actions requiring a visible trail or confirmation: <list>.
- **Data residency:** <region constraint and its UX consequence, or N/A>.
- **i18n:** locales: <list>. RTL: <yes/no>. Text-expansion budget: <yes/no + which locales>.

## 3. Constraints
- **Platforms:** <web / iOS / Android / desktop>
- **Design system:** <greenfield | extend existing: name>
- **Stack:** <from stack.md>
- **Timeline:** <milestone horizon>

## 4. Success metrics (measurable)

| Top flow | Task-completion target | Time-on-task target | Error-rate target | How measured |
|---|---|---|---|---|
| <flow> | <%> | <seconds> | <%> | <analytics / test / observation> |

## 5. Multi-role product note
- Roles treated as distinct products sharing a codebase: <yes/no + why>.
- Surface count per role: <role: N surfaces>.

## Gate UX-0 verdict
- Status: <PASS | FAIL>
- Date: <YYYY-MM-DD>
- Notes: <blocking items if FAIL, or "all rows PASS / N-A with reason">
