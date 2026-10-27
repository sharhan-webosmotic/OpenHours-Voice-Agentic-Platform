---
name: incident-response
description: "Drive a live production incident: classify severity (SEV1-4), run the incident-commander loop (assess, mitigate, communicate, resolve), capture the timeline, drive comms (status page + stakeholders), and hand off to a blameless postmortem. Use when production is down, degraded, or a security/data incident is suspected. Pairs with /operations (which runs the hotfix) and /retrospective (the postmortem). Also triggers on: 'Production is down', 'Outage', 'Incident', 'SEV1', 'SEV2', 'Site is broken in prod', 'Data breach', 'Security incident', 'Declare an incident', 'Status page', 'Postmortem'."
skip:
  - "Routine hotfix, no incident (use /operations)"
  - "Post-incident learning doc (use /retrospective)"
next_skill: retrospective
required_gate: null
allowed-tools: "Read Write Edit Grep Glob Bash(git:*) Bash(gh:*) WebFetch"
skill_id: SK-157
context_budget:
  load_kb: 25
  scope: task
version: 1.0.1
license: Proprietary
compatibility: "Claude Code 1.x"
dependencies:
  required: [memory-protocol]
  optional: [operations, deployment-execution, debugger, retrospective]
produces:
  - path: AI_DOCS/operations/incidents/INC-[ID].md
    consumers: [retrospective, operations]
metadata:
  author: WebOsmotic Private Limited
  category: reliability
  user_facing: true
  role: "incident-command"
---

# /incident-response — drive a live production incident

> Referenced by `deployment-execution` and `/do` Phase 3 but historically absent. This is the skill that turns "prod is on fire" into a structured, communicated, time-stamped response that ends in a fix and a lesson, not a second incident.

## Step 0: declare and classify (do this FIRST, in under a minute)

Declaring an incident is cheap. Not declaring one is how a degradation becomes an outage. Classify severity now, re-classify as you learn more:

| Severity | Definition | Response |
|---|---|---|
| **SEV1** | Full outage, data loss, or active security breach. Revenue/safety impact. | Page now. Incident commander + comms within 5 min. Status page updated. |
| **SEV2** | Major feature down, severe degradation, or partial data risk for many users. | Page. Commander within 15 min. Status page if user-visible. |
| **SEV3** | Minor feature degraded, workaround exists, limited blast radius. | Business-hours response. Track in the incident log. |
| **SEV4** | Cosmetic or single-user, no workaround needed. | Normal `/operations` maintenance, not an incident. |

For a suspected **security/data incident**, escalate to SEV1/SEV2 by default and follow the compliance breach-notification clock (HIPAA 60-day, GDPR 72-hour to the supervisory authority). Do not delete evidence.

## Step 1: incident-commander loop

One person is the incident commander (IC). The IC coordinates, does not also debug head-down. Run the loop:

1. **Assess** — what is the blast radius, what changed recently (last deploy, last migration, last flag flip)? `/operations` knows the last shipped change.
2. **Mitigate before fixing** — restore service first (roll back the last deploy, flip a feature flag off, scale up, fail over). A clean root-cause fix can wait; users cannot. Rollback decisions are human-approved (`ops-safety-rules` graduated autonomy).
3. **Communicate** — update the status page and stakeholders on a fixed cadence (SEV1: every 30 min even if "still investigating"). Silence reads as a worse outage than the outage.
4. **Resolve** — confirm recovery with the health checks + the relevant MAVS smoke, not by assumption.
5. **Hand off** — the durable fix goes to `/operations` (hotfix workflow), the learning goes to `/retrospective`.

## Step 2: timeline capture (as you go, not after)

Write `AI_DOCS/operations/incidents/INC-<ID>.md` live: every detection, decision, mitigation, and comms with a UTC timestamp. The timeline is the spine of the postmortem and, for a security incident, the forensic record. Capture: what was detected, when, by what signal, what was tried, what worked.

## Step 3: comms templates

- **Status page (investigating):** "We are investigating reports of <symptom> affecting <scope>. Next update by <time>."
- **Status page (identified):** "We have identified the cause and are applying a mitigation. Next update by <time>."
- **Status page (resolved):** "<Symptom> is resolved as of <time>. A postmortem will follow."
- **Stakeholder (internal):** severity, blast radius, current mitigation, ETA, IC name.

## Step 4: close out

An incident is not closed until: service is confirmed recovered, the timeline is complete, the durable fix is tracked in `/operations`, and a `/retrospective` is scheduled (mandatory for SEV1/SEV2). The retrospective is blameless and MUST convert the root cause into a rule, gate, or check (the defect-prevention loop), not just a writeup.

<!-- Version: 1.0.0 — 2026-06-29 — New skill (Track E T-E.3): incident command (SEV matrix, IC loop, timeline, comms, blameless postmortem handoff). Wires the previously-dangling incident-response references in deployment-execution + team-release. -->
<!-- Version: 1.0.1 | 2026-10-22 | v4.32.0: team-feature, team-design and team-release retired, reference repointed to /do Phase 3 -->
