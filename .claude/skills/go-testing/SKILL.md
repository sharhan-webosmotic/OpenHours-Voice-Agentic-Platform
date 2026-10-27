---
name: go-testing
description: "Write Go tests for net/http and chi/echo/gin backends, services, and stores: table-driven tests, subtests with t.Run, httptest for handlers, testify assertions, gomock/interface fakes at the boundary, the race detector, and coverage. Use when writing Go tests, setting up table-driven cases, testing handlers, mocking a store, or running QA for a Go service. Do NOT use for Go implementation (use build), deployment (use go-deployment), or Python tests (use python-testing). Also triggers on: 'Test Go', 'go test', 'table-driven test', 'httptest', 'race detector'."
next_skill: go-deployment
required_gate: "Gate 4 (QA Sign-off)"
skill_id: SK-160
allowed-tools: Read Write Edit Grep Glob Bash
context_budget:
  load_kb: 30
  scope: task
version: 1.4.1
dependencies:
  required:
    - code-quality
  optional:
    - tech-specification
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

# Go Testing Skill (SK-160)

## MAVS report (machine-checked contract, BLOCKING)

After running the suite, emit a normalized report to `AI_DOCS/quality/mavs/go-test.json` per `docs/mavs-report-schema.md`, generated FROM the real runner output (never hand-written). Runner: `go test -race -json -coverprofile=cover.out ./...`, then parse the JSON action stream into counts (`pass`/`fail`/`skip` events) and failure detail. Stamp `source_commit` with `git rev-parse HEAD` and `generated_at` with the real run time. `status` is `PASS` only when `go test` exited 0 and `failed` is 0. Any failure is `FAIL`. The `go` toolchain absent is `MISSING_TOOL`, never a silent `PASS`. `hooks/mavs-gate.sh` PARSES this report at the promotion merge: a `FAIL`, a STALE report (`source_commit != HEAD`), or a missing required report blocks the merge. The verdict is parsed from the runner, not asserted.

> **ACT AS** a Senior Go QA Engineer with 15+ years in `testing`, table-driven design, and concurrent-system verification. You write tests that are fast, deterministic, and meaningful: you mock at the interface boundary, run with `-race`, and test behaviour, not implementation.
>
> **CORE VALUES**: Table-Driven By Default · Mock at the Interface Boundary · Always `-race` · Coverage Is a Floor Not a Target · No Skipped Tests
>
> **Isolation is mandatory (`.claude/rules/testing-rules.md` 19a-19f):** no real/production env vars in tests (use `t.Setenv` with placeholders, never the real environment), mock every external service (DB in unit tests via an interface fake, outbound HTTP via `httptest.Server`, payment, email/SMS, storage, LLM providers), and cause NO real side effects. A test must never send a real email, charge a card, call a billed endpoint, or write to production. Assert the fake was called with the right arguments; never let the real call happen. `/build`'s test-isolation gate blocks violations.

---

## Table of Contents

1. [Initialization & Context](#1-initialization--context)
2. [Test File Layout](#2-test-file-layout)
3. [Table-Driven Tests](#3-table-driven-tests)
4. [Handler Tests (httptest)](#4-handler-tests-httptest)
5. [Mocking at the Interface Boundary](#5-mocking-at-the-interface-boundary)
6. [Concurrency & the Race Detector](#6-concurrency--the-race-detector)
7. [Coverage Rules](#7-coverage-rules)
8. [Test Naming Conventions](#8-test-naming-conventions)
9. [Pre-QA Checklist](#9-pre-qa-checklist)
10. [Rules Integration](#10-rules-integration)

---

## 1. Initialization & Context

On activation:

1. Check current test state: list `*_test.go` files next to the packages under test.
2. Read `AI_DOCS/planning/tech-spec.md` Section 18 (test cases) for the acceptance criteria to trace tests to.
3. Read `AI_DOCS/memory/project-context.md` for any `Unit Testing: DISABLED` override and the project type.
4. Identify project type from memory: coverage floor applies to ALL types per `testing-rules.md` Rule 7a (Section 7 below has this skill's enforcement commands).
5. Announce: "Go Testing Skill active. Test target: [package/feature]. Coverage target: [X%]. Race detector: on."

---

## 2. Test File Layout

Go tests live next to the code they test (same package for white-box, `package x_test` for black-box). No separate `tests/` tree.

```
internal/
  service/order/
    order.go
    order_test.go        # table-driven service tests, store faked
  store/order/
    order.go
    order_test.go        # store tests against a real test DB or a transaction rollback
  httpapi/
    order.go
    order_test.go        # handler tests via httptest.NewRecorder
testdata/                # fixture files (golden files, sample payloads)
```

- Black-box (`package order_test`) for testing the exported surface the way callers use it.
- White-box (`package order`) only when a test genuinely needs an unexported helper.
- Fixtures go in `testdata/` (the toolchain ignores it for builds).

---

## 3. Table-Driven Tests

The default shape for any function with more than one case:

```go
func TestService_Create(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    Thing
		wantErr error
	}{
		{name: "valid name", input: "widget", want: Thing{Name: "widget"}},
		{name: "empty name rejected", input: "", wantErr: ErrInvalidName},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			svc := NewThingService(&fakeStore{out: tc.want})
			got, err := svc.Create(context.Background(), tc.input)
			if tc.wantErr != nil {
				if !errors.Is(err, tc.wantErr) {
					t.Fatalf("err = %v, want %v", err, tc.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected err: %v", err)
			}
			if got.Name != tc.want.Name {
				t.Errorf("Name = %q, want %q", got.Name, tc.want.Name)
			}
		})
	}
}
```

### Table-Driven Rules

Baseline mandate (table-driven tests with `t.Run` subtests, error checks via `errors.Is` / `errors.As`): `go-rules.md` (Style & tooling section, Errors section). This skill adds:

1. **`t.Parallel()`** inside subtests only when cases are independent (and the loop var is captured safely, Go 1.22+ makes this the default).
2. **`t.Helper()`** in any assertion helper so failures point at the call site.
3. **One behaviour per case**: split edge cases into their own table rows.

---

## 4. Handler Tests (httptest)

```go
func TestThingHandler_Create(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		svc        ThingService
		wantStatus int
	}{
		{name: "201 on valid", body: `{"name":"widget"}`, svc: okSvc(), wantStatus: http.StatusCreated},
		{name: "400 on bad json", body: `{`, svc: okSvc(), wantStatus: http.StatusBadRequest},
		{name: "400 on empty name", body: `{"name":""}`, svc: okSvc(), wantStatus: http.StatusBadRequest},
		{name: "401 without auth", body: `{"name":"widget"}`, svc: okSvc(), wantStatus: http.StatusUnauthorized},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			h := NewThingHandler(tc.svc)
			req := httptest.NewRequest(http.MethodPost, "/things", strings.NewReader(tc.body))
			rec := httptest.NewRecorder()
			h.Create(rec, req)
			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tc.wantStatus)
			}
		})
	}
}
```

### Handler Test Rules

Outbound-call mocking via `httptest.Server` (never a real host) is already covered by the isolation rules above (`testing-rules.md` 19a-19f). This skill adds:

1. **Test these per endpoint**: 2xx happy path, 400 validation error, 401 unauthenticated, 404 not found.
2. **`httptest.NewRecorder`** for unit-level handler tests, `httptest.NewServer` when you need a real client round-trip.
3. **Validate both `rec.Code` and the response body** (decode the envelope, assert fields).
4. **Error envelope** matches the standard shape from `api-rules.md`.

---

## 5. Mocking at the Interface Boundary

The service depends on a small interface (`ThingStore`). Fake THAT, not the database driver.

```go
type fakeStore struct {
	out     Thing
	err     error
	gotName string
}

func (f *fakeStore) Create(_ context.Context, name string) (Thing, error) {
	f.gotName = name
	return f.out, f.err
}
```

### Mocking Rules

Interface-boundary mocking (fake the consumer-defined interface, never the DB driver) is a baseline from `go-rules.md` (Style & tooling section). DB and network isolation in unit tests is covered by the isolation rules above (`testing-rules.md` 19a-19f). This skill adds:

1. **`gomock` is fine for large interfaces**, but a hand-written fake is clearer for one or two methods. Use whichever is installed (`stack.md`/`go.mod`).
2. **Assert call arguments** (the fake records `gotName`), not just that a method ran.

Store-layer DB tests live separately and run against a disposable test DB or a rolled-back transaction.

---

## 6. Concurrency & the Race Detector

Running `-race` in CI and the goroutine cancellation/bounded-lifetime contract are baseline requirements from `go-rules.md` (Concurrency & context section, Style & tooling section). This skill tests them:

1. **Test cancellation**: pass a `context` that you cancel, assert the function returns promptly with `context.Canceled`.
2. **Test bounded fan-out**: assert the worker pool respects its limit and all goroutines exit (no leak).
3. **Use `t.Cleanup`** to stop background goroutines a test starts, so they never leak into the next test.

---

## 7. Coverage Rules

Coverage floor (98% on both statement and function coverage, every project type including POC): `testing-rules.md` Rule 7a (Go two-gate detail) and `go-rules.md`. This skill's enforcement procedure:

Measure and gate both axes with the committed helper (this skill folder; copy to the project's `scripts/`). Write the profile into the gitignored artifacts dir, never the project root:
```
go test -coverprofile=AI_DOCS/quality/test-artifacts/go/cover.out ./...
bash scripts/check_func_coverage.sh AI_DOCS/quality/test-artifacts/go/cover.out 98
```
It parses `go tool cover -func`, excludes generated code (`*.pb.go`, `*_gen.go`, `mocks/`), prints both percentages, lists any uncalled function, and exits non-zero if either axis is below 98%. (The full-scope `npm run test:full` orchestrator runs this automatically when `go.mod` is present.)

> Coverage is a floor, not a target. Reach the 98% floor with real assertions, never by padding it with trivial pass-through checks.

---

## 8. Test Naming Conventions

Go convention: `Test{Type}_{Method}` for the function, subtest names carry the case.

| Good | Bad |
|---|---|
| `TestThingService_Create` + subtest `"empty name rejected"` | `TestCreate` |
| `TestThingHandler_Create` + subtest `"401 without auth"` | `TestHandler` |
| `TestStore_GetByID` + subtest `"returns ErrNotFound on missing"` | `TestGet` |

Each subtest reads as Given-When-Then in its `name` and body: the table row is the Given, the call is the When, the assertion is the Then.

---

## 9. Pre-QA Checklist

Before marking QA complete (Gate 4):

- [ ] `go test -race ./...` passes (zero failures, zero races).
- [ ] No skipped tests: `go test -v ./... | grep -c -- "--- SKIP"` returns 0 (or each skip is justified in code).
- [ ] Coverage >= 98% on both axes: `bash scripts/check_func_coverage.sh AI_DOCS/quality/test-artifacts/go/cover.out 98` exits 0 (statement total AND function coverage).
- [ ] Every new service function has a table-driven test with an error case.
- [ ] Every new handler has 2xx, 400, 401 cases (404 where applicable).
- [ ] Mocks fake the interface boundary, not the DB driver.
- [ ] `gofmt -l .` clean; `go vet ./...` clean.
- [ ] The MAVS report `AI_DOCS/quality/mavs/go-test.json` was generated from the real `go test -json` run.

---

## 10. Rules Integration

| Rule File | What It Enforces |
|---|---|
| `go-rules.md` | Concurrency + context conventions, error wrapping, the verification list |
| `testing-rules.md` | Coverage targets, test-spec traceability, isolation (19a-19f) |
| `security-rules.md` | No real credentials in tests; test auth flows |
| `development-rules.md` | No skipped tests in CI; tests committed with features |

---

**Next Step**: After tests pass and coverage meets threshold, run `go-deployment` (SK-161) to prepare the deployment runbook.

<!-- Version: 1.4.0 | 2026-08-06 | de-duplicated rule content into rules/go-rules.md and rules/testing-rules.md pointers (v4.18.0 structural pass); procedures retained -->
