---
name: ui-design-system
description: Use for visual and UX decisions in the clinic dashboard and admin console - layout, typography, colour tokens, component choice, tables, calendar, forms, empty states, density, accessibility and healthcare-appropriate tone. Use before building any new screen.
---

# UI design system

## Principles
Calm, fast, unambiguous. Clinic staff are busy and often interrupted: show what needs action first, keep the main flow to few clicks, never hide critical status. Prefer clarity over decoration. One consistent look across both web apps.

## Tokens (define once in Tailwind theme; never hard-code hex values in components)
- Colour roles: `surface`, `surface-muted`, `border`, `text`, `text-muted`, `primary`, `primary-foreground`, `success`, `warning`, `danger`, `info`. Status colours always pair with an icon or label (never colour alone).
- Type scale: 12/14/16/20/24/30; base 14 for dense tables, 16 for forms; one sans family; tabular numbers in tables and times.
- Spacing on a 4px grid; radius 6/8; one elevation for popovers and dialogs. Light theme required; dark theme optional later.

## Components (build in `components/ui`, reuse everywhere)
Button (primary, secondary, ghost, destructive; loading state), Input/Select/DatePicker/TimePicker (with label, hint, error), Table (sticky header, sortable, pagination, row actions, empty state), Dialog and Drawer, Toast, Badge (appointment and follow-up status), Tabs, Skeleton, EmptyState, ConfirmDialog, PageHeader, Calendar (day/week by doctor), Stat card.

## Screen patterns
- List pages: filters row, search, table, pagination, primary action top right.
- Detail pages: header with identity + status, tabs for related data (appointments, calls, prescriptions, follow-ups).
- Calendar: doctor columns/filters, colour by status, click to create, drag to reschedule only when conflicts are validated by the server, visible working hours and time off.
- Forms: single column, group related fields, inline validation after blur, clear primary action, cancel always available.
- Dashboard: today's appointments, missed/needs-follow-up calls, pending follow-ups, failed reminders; links straight into the action.

## Healthcare UX rules
Show time with timezone-aware clinic time and make AM/PM unambiguous. Confirm cancellations and anything that notifies a patient. Mask sensitive values by default where reasonable (e.g. phone partially hidden in lists for roles without need). Never auto-play recordings. Make errors human: say what happened and what to do.

## Accessibility and responsiveness
WCAG AA contrast, visible focus rings, 40px minimum touch targets, full keyboard support, reduced-motion respected. Desktop-first (reception PCs) but usable on tablet widths; tables scroll inside their container, never the page.

## Process
Before building a new screen: list its states (loading, empty, error, success, no-permission), its roles, and reuse existing components. Review in the browser at 1280px and 768px before calling it done.
