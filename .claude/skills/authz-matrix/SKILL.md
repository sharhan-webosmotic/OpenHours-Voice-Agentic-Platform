---
name: authz-matrix
description: "Generates the RBAC/PBAC source of truth (permissions catalog, action and field matrices, role bundles) from the tech spec and api-contract, then data-driven API and Playwright persona tests from it. Dispatched by /do during planning and milestone validation. Not user-facing."
mcp_integrations: [playwright]
skill_id: SK-153
version: 2.4.1
context_budget:
  load_kb: 30
  scope: task
dependencies:
  required: [mock-data]
  optional: [tech-specification, change-request, qa-testing, e2e-testing, gate-enforcement]
license: Proprietary
compatibility: "Claude Code 1.x"
produces:
  - path: AI_DOCS/architecture/authz-matrix.yaml
    consumers: [build, api-validator, gate-enforcement]
  - path: AI_DOCS/quality/mavs/authz.json
    consumers: [mavs-gate.sh, milestone-validation]
consumes:
  - path: AI_DOCS/architecture/api-contract.md
    required_sections: []
  - path: AI_DOCS/planning/spec/03-roles.md
    required_sections: []
metadata:
  author: WebOsmotic Private Limited
  category: gate
  user_facing: false
---

# authz-matrix — RBAC as a tested contract (API + browser, field-level)

> The role/permission matrix in tech-spec S3 is prose, so a build gate can only grep
> that "a role word appears near the handler". It cannot tell whether the guard is the
> RIGHT role, whether a forbidden role is actually denied, whether one tenant can reach
> another's rows, whether a forbidden FIELD leaks, or whether the UI still SHOWS a button
> the API forbids. This skill turns S3/S7 into a machine-readable matrix and GENERATES the
> tests from it, at the API layer AND the browser layer, so RBAC correctness is verified by
> a runner, not assumed, and updating a permission means editing ONE cell.

## Design principle: one source, generated tests (so it is easy to change)

`authz-matrix.yaml` is the SINGLE source of truth. Every test is GENERATED/parametrized
from it. You never hand-write or hand-edit a per-cell test: change a permission in the yaml,
regenerate, and the API + UI suites cover the new state automatically. This is what keeps a
growing role/permission set maintainable instead of a swamp of copy-paste test files.

## Two access-control models: static role-based vs dynamic permission-based (PBAC)

There are two kinds of authorization, and the validation differs. `mode:` in the yaml says which.

- **static** — a FIXED set of roles, each with a FIXED permission set. Checking by role is acceptable, because role name maps one-to-one to a known capability set. The role x action/field matrix below is the source of truth.
- **dynamic (PBAC)** — roles are created and edited at RUNTIME (custom roles), permissions are toggled per role or per user (the checkmark grid), plus direct per-user grants. Here access MUST be validated by the actual PERMISSION the user effectively holds, NEVER by role name or id. Two users with the same role NAME can hold different effective permissions, and a custom role is an arbitrary bundle of checkmarks. So **the permission is the atomic unit, the role is just a bundle**, and every test decides expected access from the persona's EFFECTIVE PERMISSION SET, not its role name.

In dynamic mode the yaml carries `permissions:` (the atomic capability catalog), `requires:` (each `resource.action` -> the permission(s) it needs), `fields_require:` (each `resource.field` read/write -> the permission it needs), `role_permissions:` (a fixed role = a fixed bundle), and `personas:` (test identities defined by an effective permission set: a named role, a custom role = arbitrary bundle, or a base role + direct grants/revokes). The role x decision `matrix:` becomes a DERIVED convenience view (a static cell must equal what `role_permissions[role]` ∩ `requires[action]` implies; a mismatch is a spec/generation bug). Each field and each permission checkmark is validated by ITS permission, independently (Step 3.5).

## When it runs (dispatched by /do)

- **Generate / refresh** during Phase 0 planning, after `tech-specification` writes S3 + S7 and `api-contract.md`: produce `authz-matrix.yaml`. Gate 1 LOCKS it (`enforce-artifact-lock.sh`).
- **Run** at milestone validation (Gate 4.5) and whenever a task touches a protected endpoint or a gated field: regenerate the tests from the matrix, run both layers, write `mavs/authz.json`.

## Step 1 — Generate `authz-matrix.yaml` (action + field + screens)

Build from the locked sources (format + cell meanings: `templates/authz-matrix.yaml`):

1. **Roles** from S3, least to most privileged.
2. **Endpoints**: every non-public `api-contract.md` row, tagged with its `resource.action`.
3. **`matrix:`** action cells from S3: `allow | deny | own-only | tenant-scoped`. Every endpoint x role cell filled (a blank is a generation bug: if S3 is silent, STOP and make it explicit via `/change-request`). Multi-tenant entities default ambiguous read/list/update/delete to `tenant-scoped`, never `allow`.
4. **`fields:`** field cells from S7 + S3: `write | read | masked | none` per (resource.field, role). EVERY field carrying PII or a privileged value MUST appear, with a cell for every role.
5. **`screens:`** the UI routes that render each resource's gated controls/fields, so the Playwright layer knows where to navigate.

Never hand-edit the locked file. A permission change goes through `/change-request` (updates S3/S7 + the matrix + re-locks + regenerates tests).

## Step 2 — The `data-perm` DOM convention (the bridge to robust UI tests)

Permission-gated UI elements carry a stable attribute, so the Playwright suite locates them
generically instead of by brittle CSS that breaks on a restyle:

- action controls: `data-perm="<resource>.<action>"` (e.g. `<button data-perm="case.delete">`)
- field elements: `data-perm-field="<resource>.<field>"` (e.g. `<input data-perm-field="case.client_ssn">`)

`/build`'s RBAC gate checks that a gated control rendered in changed UI carries the attribute.
Adding a gated element = add the attribute + a matrix/fields cell. Nothing else.

## Step 3 — Generate the API layer (data-driven, parametrized)

ONE parametrized test module that iterates the matrix + fields cells (do NOT write one test
per cell). Reuse the one-user-per-role fixtures from `mock-data` (a seeded user per role, plus
a SECOND user in a different ownership/tenant for own-only/tenant-scoped). Shape:

```python
# tests/authz/test_authz_api.py  (pytest + httpx; Supertest equivalent for Node)
import itertools, yaml
M = yaml.safe_load(open("AI_DOCS/architecture/authz-matrix.yaml"))
ACTION_CELLS = [(ra, role, dec) for ra, row in M["matrix"].items() for role, dec in row.items()]
FIELD_CELLS  = [(rf, role, vis) for rf, row in M["fields"].items()  for role, vis in row.items()]

@pytest.mark.parametrize("res_action, role, decision", ACTION_CELLS, ids=lambda c: c)
@pytest.mark.req_from_matrix                      # tags @req to the S21 row
def test_action_cell(client, seeded, res_action, role, decision):
    ep = endpoint_for(M, res_action)              # method + path from endpoints:
    r  = client.as_role(seeded, role).request(ep.method, ep.path, own_record=True)
    if decision == "allow":         assert r.status in (200, 201)
    elif decision == "deny":        assert r.status == 403       # 403 not 401: authenticated, unauthorized
    elif decision in ("own-only", "tenant-scoped"):
        assert r.status in (200, 201)                            # own / in-tenant record
        other = client.as_role(seeded, role).request(ep.method, ep.path, own_record=False)
        assert other.status in (403, 404)                        # the isolation negative

@pytest.mark.parametrize("res_field, role, vis", FIELD_CELLS, ids=lambda c: c)
def test_field_cell(client, seeded, res_field, role, vis):
    body = client.as_role(seeded, role).get_resource(res_field).json()
    field = res_field.split(".", 1)[1]
    if vis == "none":      assert field not in flatten(body)
    elif vis == "masked":  assert is_masked(body[field])         # ***-**-1234, raw value absent
    elif vis in ("read", "write"):
        assert field in flatten(body)
        w = client.as_role(seeded, role).patch_field(res_field, NEW_VALUE)
        if vis == "write": assert w.status in (200, 204) and reread(res_field) == NEW_VALUE
        else:              assert w.status in (403, 422) and reread(res_field) != NEW_VALUE
```

## Step 3.5 — Dynamic mode (PBAC): validate by PERMISSION, not role name

When `mode: dynamic`, the generator does not trust the role x decision matrix as the source of truth. It derives the expected outcome from each persona's EFFECTIVE PERMISSION SET and the `requires:` map, so the tests stay correct for custom roles and per-user grants that no role name describes.

**Effective permission set per persona** (`personas:` in the yaml):
- `role` persona -> `role_permissions[role]`.
- `custom_role` persona -> exactly its listed `permissions:` (an arbitrary runtime bundle).
- `base` persona -> `role_permissions[role]` + `grants:` - `revokes:` (a base role plus direct per-user changes).

**Derived expectation** (no role name in the assertion): for an action, `allow` iff `eff_perms ⊇ requires[resource.action]`, else `deny` (the `own-only`/`tenant-scoped` scope still applies on top, tested with the second-user/second-tenant record). For a field, `read`/`write` iff `eff_perms` holds `fields_require[field].read`/`.write`, else `masked` (if a mask perm is defined) or `none`. The generated API + UI tests then run exactly as Steps 3-4, but the expected value comes from permissions, parametrized over `personas`, not over role names.

```python
# dynamic-mode expectation, derived from permissions (never from the role name)
def expected_action(eff_perms, resource_action, M):
    need = set(M["requires"].get(resource_action, []))
    return "allow" if need.issubset(eff_perms) else "deny"
# Two personas with the SAME role name but different effective perms get DIFFERENT expectations.
```

**The teaching case the operator named:** `member_user` (role member) and `member_plus_delete` (role member + a direct `case.delete` grant) share the role NAME "member" but differ by one permission. A guard that checks `role === 'member'` gives them the same answer and is therefore WRONG: the granted user is denied a delete they hold, or worse, a role-name allow leaks an action a custom role must not have.

### Per-permission independence (the checkmark requirement)

Each permission must independently gate EXACTLY its capability, nothing more. For every permission `P` in the catalog, generate a triplet against a synthetic persona:
1. **Baseline** persona WITHOUT `P` (a minimal bundle): every capability whose `requires`/`fields_require` includes `P` is DENIED (API 403, the `data-perm` control absent in the DOM, the field not editable/visible per its rule).
2. **Grant only `P`** (add exactly `P` to the bundle, change nothing else): EXACTLY the capabilities that require `P` now appear (API allows, the matching `data-perm` control becomes visible/enabled), and NO other capability changed (assert the full action+field set is otherwise identical to baseline). A capability reachable without `P`, or an unrelated capability that flipped, is a finding.
3. **Revoke `P`**: exactly those capabilities disappear again.
Run at the API layer AND the Playwright UI layer (the checkmark literally toggles the control). This proves each checkmark maps to its capability and only its capability.

### Permission dependencies (a permission needs another to be functional)

Some permissions only work when another is also held (`permission_dependencies` in the yaml, a DAG). Example: `project.assign` needs `user.read` to search for the user to assign to. The EFFECTIVE requirement for an action is the dependency CLOSURE of its required permission(s). Generate four checks per dependency edge `A -> B` (A depends on B):
1. **Consistency:** flag any persona/role that holds `A` but not `B` (a broken grant). The dependent capability must NOT be silently broken-but-clickable.
2. **Functional:** a persona with `A` + `B` can complete the flow end to end (e.g. assign works: the user-search returns results, the assign succeeds). A persona with `A` but WITHOUT `B`: the dependent capability is correctly DISABLED or blocked (the search is empty/403 and the UI disables the control with a reason), not broken mid-flow. Asserted at the API + the Playwright UI layer.
3. **Grant-time:** when Actor A grants `A` to a persona lacking `B`, the system handles the dependency one of three correct ways: auto-grants `B`, requires `B` (blocks the grant with a message), or disables the feature. The permission-management UI surfaces the dependency (checking `A` warns about or auto-checks `B`).
4. **Revoke cascade:** revoking `B` while `A` is still held makes the dependent capability unavailable. A dependent capability still working after its dependency is revoked is an inconsistency.
A capability that is reachable or half-working without its dependency closure is a `LEAK`. Record per-edge coverage in `authz.json` (`dependencies` section).

### Permission-not-role-name guard correctness (BLOCKING in dynamic mode)

In dynamic mode the application code MUST gate on the permission (`hasPermission('case.delete')`, `can(user, 'case.delete')`, `authorize('case.delete')`), NEVER on the role name or id (`role === 'admin'`, `roles.includes('manager')`, `user.roleId === 3`). A role-name guard silently breaks for custom roles and direct grants. The generator emits a static guard check (also wired into `/build` Check A): grep the changed handler/guard/middleware files for a role-name/id branch (`role\s*===|roles?\.(includes|indexOf|some)\(|roleId\s*===|isAdmin\b|=== *['"](admin|manager|member|super_admin)['"]`) used as an AUTHORIZATION decision. In `mode: dynamic` that is a FAIL (`detail`: "role-name guard in `<file>` decides access by role, not permission: breaks for custom roles + per-user grants. Use hasPermission('<resource.action>')."). Role checks are allowed only for the explicitly static parts (or `mode: static`). Record the project `mode` in the report.

## Step 4 — Generate the UI layer: Playwright E2E that finds elements by permission

This is the centerpiece the operator asked for: PROVE in a real browser that the UI enforces
the matrix. ONE reusable harness loops over (role x cell), locating elements by the data-perm
attributes. Headed real Chrome (per `e2e-testing` launch convention) so the role-switching
run is watchable; auto-headless in CI / `ADF_HEADLESS`. Log in ONCE per role and reuse the
storageState (do not re-login per assertion).

```js
// tests/authz/authz.ui.spec.ts  (Playwright, data-driven from the same yaml)
const M = parseYaml(read("AI_DOCS/architecture/authz-matrix.yaml"));
for (const role of M.roles) {
  test.describe(`RBAC UI: ${role}`, () => {
    test.use({ storageState: authState(role) });        // seeded login reused

    // ACTION controls, located by data-perm, asserted against the cell
    for (const [ra, row] of Object.entries(M.matrix)) {
      const decision = row[role];
      test(`action ${ra} -> ${decision}`, async ({ page }) => {
        await page.goto(screenFor(M, ra));               // from screens:
        const ctrl = page.locator(`[data-perm="${ra}"]`);
        if (decision === "allow") {
          await expect(ctrl).toBeVisible(); await expect(ctrl).toBeEnabled();
        } else {                                          // deny / out-of-scope
          await expect(ctrl).toHaveCount(0);              // NOT in the DOM (or assert disabled)
          const res = await page.goto(routeFor(M, ra));   // and the route is guarded
          expect([403, 404]).toContain(res.status());     // direct nav blocked, or redirected to /403|/login
        }
      });
    }

    // FIELD elements, located by data-perm-field, asserted against the cell
    for (const [rf, row] of Object.entries(M.fields)) {
      const vis = row[role];
      test(`field ${rf} -> ${vis}`, async ({ page }) => {
        await page.goto(screenForField(M, rf));
        const el = page.locator(`[data-perm-field="${rf}"]`);
        if (vis === "none")        await expect(el).toHaveCount(0);
        else if (vis === "read")   { await expect(el).toBeVisible(); await expect(el).not.toBeEditable(); }
        else if (vis === "write")  { await expect(el).toBeVisible(); await expect(el).toBeEditable(); }
        else if (vis === "masked") { await expect(el).toContainText(/[*]{2,}/); /* raw value absent from DOM */ }
      });
    }
  });
}
```

Key assertions: a `deny` control that is actually PRESENT and clickable in the DOM for a
forbidden role is a FAIL (a real privilege-escalation leak), and a `none`/`masked` field whose
raw value appears in the DOM is a leak. The UI layer proves the front end enforces RBAC, not
just that the API would.

## Step 5 — Run both layers, emit `mavs/authz.json` with the 100% coverage gate

Run the API suite always, the UI suite when a running app + Playwright exist. Normalize to the
MAVS schema (`docs/mavs-report-schema.md`) at `AI_DOCS/quality/mavs/authz.json`, adding coverage:

```json
{ "validator": "authz", "status": "PASS|FAIL|MISSING_TOOL", "mode": "static|dynamic",
  "coverage": { "cells_total": N, "cells_tested": N, "cells_passed": N,
                "action_cells": N, "field_cells": N,
                "leaks": N, "inconclusive": N,
                "api":  {"tested": N, "passed": N},
                "ui":   {"tested": N, "passed": N},
                "dynamic": {"tested": N, "passed": N},
                "chains":  {"idor": N, "csrf": N, "refresh": N},
                "permissions": {"total": N, "validated_independently": N},
                "personas": {"total": N, "tested": N, "custom": N, "direct_grant": N},
                "role_name_guards": N },
  "total": N, "passed": N, "failed": N, "skipped": N, "source_commit": "...",
  "findings": [ {"id":"case.delete:manager:ui", "cell_state":"LEAK", "severity":"crit",
                 "detail":"manager sees an enabled [data-perm=case.delete] button (API forbids it: privilege-escalation leak)",
                 "location":"tests/authz/authz.ui.spec.ts"} ] }
```

In `mode: dynamic`, `permissions.validated_independently` MUST equal `permissions.total` (every checkmark proven by the per-permission triplet), `personas.tested` MUST include the custom-role and direct-grant personas, and `role_name_guards` (the count of authorization decisions made by role name instead of permission) MUST be 0. Any of these unmet is a FAIL.

**Three-state cell results (the AuthMatrix green/red/blue model).** A binary pass/fail hides false positives. Every cell resolves to one of:
- `PASS` — behaves exactly as the matrix expects (allowed where allow, denied where deny).
- `LEAK` — a real authorization bypass: a forbidden request returned 2xx, a `deny` control is present and clickable in the DOM for a forbidden role, an IDOR chain reached another user's resource, actor B keeps access after a revoke, a capability was reachable WITHOUT the permission its `requires` map demands (a persona without `P` performed a `P`-gated action), or (dynamic mode) a role-name guard granted a custom-role/granted user the wrong access. This is AuthMatrix red.
- `INCONCLUSIVE` — the test could not decide for a NON-authorization reason: a session/login setup failed, a token expired mid-run, a locator was missing because the page errored, the management UI was unreachable. This is AuthMatrix blue, a suspected false positive, NOT proof of a bypass.

`status` rules (100% coverage enforced):
- `FAIL` if `cells_tested < cells_total` (ANY untested role x action or role x field cell), OR any cell is a `LEAK`, OR any cell genuinely failed at either layer.
- `INCONCLUSIVE` cells are surfaced for review and do NOT block by themselves (a setup error is not a bypass), but they do NOT count as `PASS` toward coverage either: an inconclusive cell is not-yet-verified, so it keeps `cells_tested < cells_total` and must be re-run to reach `PASS`.
- `PASS` only at 100% coverage with every cell `PASS` (zero `LEAK`, zero `INCONCLUSIVE`) at BOTH layers, including the dynamic + chain flows where the matrix marks them applicable.
- `MISSING_TOOL` for the UI / dynamic / chain layers only when no running app / no Playwright (the API layer still runs and is reported); never a silent PASS.

`mavs-gate.sh` blocks the milestone merge on any FAIL or a stale report. A `LEAK` is always a FAIL.

## Step 6 — Dynamic permission-change validation (two-actor)

Static cells prove "role X can or cannot do Y" at a frozen moment. They do NOT prove the system reacts correctly when a permission CHANGES, which is where most real RBAC incidents live (a revoked admin who still acts as admin until their token expires). Test the change itself, with two Playwright browser contexts (headed Chrome per `e2e-testing`'s launch convention, so the operator watches the role switch live), driven from the matrix. Roles that can manage permissions are marked in the yaml (`manages: [roles]` and/or `manages: [permissions]` per role); the targets are the mutable cells.

For each mutable (target user B, permission) pair:

1. **Baseline.** Confirm B's current access to a gated control (by `data-perm`) AND the matching API endpoint, per the matrix.
2. **Change (as Actor A).** A managing role toggles a SINGLE permission checkmark on B's role or directly on user B (the atomic case, `manage_ui.perm_control`), or assigns B a different role/custom role, through the REAL management UI (located by `data-perm`) or the management API. Capture the change response. The single-checkmark toggle is the important one: it proves the permission, not the whole role, is what moves access.
3. **Re-validate (as Actor B).** Granting EXACTLY one permission must make EXACTLY the capabilities that require it appear (the `data-perm` control + the API), and nothing else change; revoking it must make exactly those disappear. Asserted on B's real DOM + real API response. The expectation is derived from B's NEW effective permission set (Step 3.5), never from B's role name.
4. **Propagation model (the stale-role test, security-rules Rule 34, caught live).** Record WHEN the change takes effect: immediately, on next request, or only after re-login. A REVOKE that keeps working on B's existing session/token until it expires is a `LEAK`, not a `PASS`. A GRANT that requires a full re-login to appear is recorded (a UX/timing note, not a leak).
5. **Restore.** Revert B's permission to baseline so the flow is idempotent and re-runnable.

Each pair is a cell in the `dynamic` coverage block. A revoke that does not propagate is the highest-severity finding the suite produces.

## Step 7 — Chained / stateful flows (AuthMatrix model)

AuthMatrix replays a request under each role's session and CHAINS requests (extract a value from one response, inject it into the next). Generate three chain types from the matrix, with per-role session management: each role's cookies / `Authorization` header / token is captured once (reuse the `e2e-testing` storageState per role) and substituted into the replayed request.

- **Cross-user IDOR chain.** Create a resource AS Actor A, capture its `id` from the create response, then GET / PATCH / DELETE it AS Actor B by that id. For an `own-only` or `tenant-scoped` cell this MUST return 403/404. This turns those cells into a real create-then-access-as-another-user proof, not just an empty-list check. B reaching A's resource by id is a `LEAK`.
- **CSRF chain.** Extract the CSRF token from a GET or the page, inject it into the mutating request. A mutating request with a missing or invalid CSRF token must be rejected. A mutation that succeeds without a valid token is a `LEAK`.
- **Credential / token refresh chain.** Re-authenticate or refresh a token mid-flow. This is the mechanism Step 6 uses to test the propagation model (does B's NEW token reflect the changed permission, does the OLD one stop working).

## Step 8 — The matrix-grid output (scannable result)

Beyond `authz.json` (the machine verdict), write a human grid to `AI_DOCS/quality/mavs/authz-matrix.md` and link it from `mavs/SUMMARY.md`: a role x request table (and a role x field table) with each cell rendered `PASS` / `LEAK` / `INCONCLUSIVE` (plus an icon, e.g. ok / LEAK / `?`), so a bypass is visible at a glance the way AuthMatrix's red cell is. This is the AuthMatrix color matrix in markdown. The machine gate still reads `authz.json`, never this file.

## /build integration (per task)

`/build`'s RBAC gate Check A2 (per task touching a protected endpoint or a gated field) requires:
the touched resource's action AND field cells exist in the matrix, have generated passing tests
in `mavs/authz.json` at both layers, touched gated controls carry the `data-perm`/`data-perm-field`
attribute, and there is NO untested matrix cell for the touched resource. Stamp
`✓ authz N/N (api+ui, fields)`. A gap is BLOCKED: add the cell + regenerate first.

**Dynamic mode (PBAC) additions to Check A:** when the matrix `mode: dynamic`, the gate also (a) FAILS a changed guard/middleware/handler that decides authorization by a role NAME or id instead of a permission (the `hasPermission` rule above), and (b) requires the touched action/field to have a `requires:`/`fields_require:` entry (so it is gated by a permission, not just a role). Stamp the mode: `✓ authz N/N (api+ui, fields, pbac)`.

**Exercise-gate cells (per task, both directions):** /build's Exercise gate runs the CHANGED action's matrix cells live against the dev server at task time, not only at milestone close: every `allow` cell must succeed AND every `deny` cell must 403. Over-blocking is a first-class failure, equal to a leak: an allowed role that gets denied (the field case: a reassign check wrongly blocking a role from case edits it holds) FAILS the cell the same way a forbidden role getting through does. The matrix is the source for both directions; a guard change that narrows an `allow` cell without a matrix change is a defect, not a hardening.

## Coverage / drift

`drift-detector.sh` (authz phase) flags any `api-contract.md` endpoint, S3 action, or S7 field
with no matrix cell (coverage drift). Target: 100% of action AND field cells tested for every role
at both layers. A missing cross-tenant negative on a multi-tenant entity, or a missing field cell on
a PII field, is a HIGH finding.

## Boundaries

- Generates the matrix + tests (API + Playwright UI); does not write app authorization code (that is `/build`) and does not write the `data-perm` attributes (the UI task does, the gate checks them).
- Does not edit the locked matrix without `/change-request`.
- Does not invent roles, permissions, or fields: every cell traces to S3 / S7.
- UI layer is HEAVY (headed Chrome): under a parallel run it obeys `HEAVY_CAP` (`docs/coordination-rules.md`). The dynamic two-actor flow runs TWO headed contexts, so it counts as a heavy slot, do not run several dynamic flows at once on a low-RAM host.

<!-- v2.3.0 (2026-06-29): Permission dependencies (permission_dependencies DAG): consistency + functional + grant-time + revoke-cascade checks, the effective requirement is the dependency closure, a half-working dependent capability is a LEAK. v2.2.0 (2026-06-29): Dynamic permission-based access (PBAC). Added the two-models distinction (static role-based vs dynamic permission-based), the permission-as-atomic-unit model (permissions catalog + requires/fields_require maps + role_permissions bundles + personas defined by effective permission set incl. custom roles and direct grants), Step 3.5 dynamic-mode permission-derived expectations + per-permission independence triplet (each checkmark validated by its own permission) + the BLOCKING permission-not-role-name guard check (a role-name authorization branch in dynamic mode is a FAIL), the permission-level single-checkmark two-actor toggle, and authz.json mode + per-permission/persona/role_name_guard coverage. A capability reachable without its required permission, or a role-name guard, is a LEAK. v2.1.0 (2026-06-29): Dynamic + AuthMatrix patterns. Added Step 6 dynamic two-actor permission-change validation (grant/revoke propagation, the stale-role bug caught live), Step 7 chained/stateful flows (cross-user IDOR, CSRF, credential refresh) with per-role session substitution, three-state cell results PASS/LEAK/INCONCLUSIVE (AuthMatrix green/red/blue) with leaks/inconclusive counts, and Step 8 the scannable role x request matrix-grid output (authz-matrix.md). Prior art: AuthMatrix (PortSwigger). v2.0.0: field-level matrix + data-perm UI harness + 100% coverage. v1.0.0: action-level API tests only. -->

<!-- Version: 2.4.1 | 2026-10-21 | description trimmed per the v4.28.0 cost policy -->
