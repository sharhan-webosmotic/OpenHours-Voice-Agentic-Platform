---
description: Python backend rules — enforces type annotations, async conventions, FastAPI patterns, docstring format, and AI service architecture for the ai-server
paths:
  - "**/*.py"
  - "**/requirements*.txt"
  - "**/Dockerfile*"
  - "**/pyproject.toml"
  - "**/.env.example"
---

# Python Backend Rules

Rules enforced for all Python files in the project. Derived from the actual code patterns in `ai-server/`. All rules apply unless explicitly disabled via the User Override Protocol in the active skill.

---

## 1. Type Annotations (MANDATORY)

1. **Every function must have a return type annotation** — `async def foo() -> None:` not `async def foo():`
2. **No bare `Any`** — only allowed with an accompanying type guard or comment explaining why it cannot be narrowed
3. **Use built-in generic syntax** — `list[str]`, `dict[str, Any]`, `tuple[int, ...]` — never `List`, `Dict`, `Tuple` from `typing` (Python 3.10+)
4. **Use union syntax** — `X | None` instead of `Optional[X]`; `int | str` instead of `Union[int, str]`
5. **Pydantic fields must be fully annotated** — including validators and computed fields
6. **TypeVar for reusable generic patterns** — use when writing ABC base classes that return `Self` or typed subclasses

---

## 2. Async/Await Conventions

1. **All I/O-bound functions must be `async def`** — any function that touches network, file system, database, cache, or external APIs
2. **No `time.sleep()` in async context** — use `await asyncio.sleep()`
3. **No blocking HTTP in async** — never `requests.get()`; always `httpx.AsyncClient` with `async with`
4. **Background tasks via scheduler or FastAPI** — use `WorkerScheduler` (`app/worker/scheduler.py`) for recurring jobs; use `BackgroundTasks` for fire-and-forget in request context
5. **`async with` for all async context managers** — database connections, HTTP clients, file handles
6. **`async for` for async iterators** — streaming LLM responses, async generators
7. **Startup/shutdown hooks in `main.py`** — use `@app.on_event("startup")` / `@app.on_event("shutdown")` for connection pool management

---

## 3. Docstring Format (MANDATORY)

1. **Module-level docstring on every `.py` file** — the very first statement after any imports must be a triple-quoted description of the module's purpose. Example:
   ```python
   """
   Controller handling HTTP operations for the Agents service.
   """
   ```
2. **Class docstring** — one sentence describing the class responsibility
3. **Function/method docstring** — describes what the function does; includes a "Logic to add here:" block for placeholder stubs listing what needs to be implemented
4. **No inline comments in production code** — code should be self-documenting. The only allowed inline comment is a one-line *why* for genuinely non-obvious logic (a tricky calculation, a unit/time-zone conversion, a deliberate workaround). Section-separator comments (`# --- section name ---`) are allowed only in large files. Rationale and context go to `AI_DOCS/` (see `development-rules.md` → Code Comments & Documentation), updated in the same change. Docstrings (this section) are the required form of in-code documentation.
5. **Google-style docstrings for complex public functions** — use Args/Returns/Raises sections when a function has 3+ parameters or non-obvious return shape

---

## 4. ABC and Abstract Class Patterns

1. **All provider interfaces subclass `ABC`** — `from abc import ABC, abstractmethod`
2. **Every abstract method uses `@abstractmethod`** decorator and `raise NotImplementedError` as the body
3. **Abstract base naming: `Base{Domain}`** — `BaseLLMProvider`, `BaseVectorStore`, `BaseEmbeddingProvider`, `BaseTool`, `BaseSkill`
4. **Concrete provider naming: `{Name}Provider`** — `AnthropicProvider`, `OpenAIProvider`, `GeminiProvider`
5. **Base class lives in `base/provider.py`** within its integration domain; concrete classes live in `providers/{name}_provider.py`
6. **Register concrete classes in the domain's `__init__.py`** via `__all__`

---

## 5. Pydantic Model Conventions

1. **Request schemas named `{Action}Request`** — `LoginRequest`, `CreateAgentRequest`, `QueryRAGRequest`
2. **Response schemas named `{Action}Response` or `{Resource}Response`** — `LoginResponse`, `AgentStatusResponse`
3. **Models live in the `schemas/` subdirectory of their service domain** — `src/services/agents/schemas/`, `src/services/rag/schemas/`
4. **Use `Field(...)` for required fields** with a `description=` argument to auto-document the API
5. **Use `@field_validator`** (Pydantic v2) — never the deprecated `@validator`
6. **No mutable default values** — use `default_factory=list` not `default=[]`
7. **`BaseModel` for data schemas; `RootModel` for typed primitive wrappers**

---

## 6. FastAPI Routing Patterns

1. **Router defined at top of each controller file**:
   ```python
   router = APIRouter(prefix="/{resource}", tags=["{resource}"])
   ```
2. **Tags match the resource as a plural noun** — `["agents"]`, `["auth"]`, `["rag"]`
3. **All route handlers are `async def`**
4. **`response_model=` on every route** — never return unvalidated dicts from production routes
5. **`status_code=201` explicitly on creation endpoints** — do not rely on FastAPI defaults for POST
6. **Auth via `Depends(verify_jwt_token)`** from `app/middleware/jwt_auth.py` on all protected routes
7. **Register routers only in `app/route/__init__.py`** via `api_router.include_router()` — never import routers in `main.py`
8. **Split controller at 300 lines** — if a controller exceeds 300 lines, split by sub-resource

---

## 7. Configuration Management

1. **Single `Settings` class in `app/config.py`** — the only place where `os.getenv()` is called
2. **All env access via `settings.*`** — `from app.config import settings` then `settings.api_prefix`; never `os.getenv()` outside `config.py`
3. **Safe defaults for local development** — `os.getenv("HOST", "127.0.0.1")` with sensible fallbacks
4. **Migrate to `pydantic-settings BaseSettings`** for new config additions — provides auto-validation and type coercion
5. **Every env variable documented in `.env.example`** with a comment explaining its purpose
6. **Fail fast for required production values** — raise `ValueError` at startup if a required variable is missing in non-development environment

---

## 8. Import Organization

Imports must follow this three-block order with a single blank line between blocks:

```python
# Block 1 — stdlib
import os
import multiprocessing
from abc import ABC, abstractmethod

# Block 2 — third-party
from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from pydantic import BaseModel, Field

# Block 3 — local application
from app.config import settings
from src.integrations.llm.base import BaseLLMProvider
```

1. **Sort alphabetically within each block**
2. **No wildcard imports** — `from module import *` is forbidden
3. **Absolute imports for cross-package** — `from src.integrations...` not `from ..integrations...`
4. **Relative imports only within the same package level**

---

## 9. Error Handling (HTTP Exceptions)

1. **`HTTPException` raised at controller layer only** — never in services or integrations
2. **Services raise domain exceptions** — e.g., `ProviderNotFoundError`, `EmbeddingError`, `RAGRetrievalError`; controllers catch and convert to `HTTPException`
3. **Standard HTTP codes**:
   - `400` — bad request / validation
   - `401` — unauthenticated (no/invalid token)
   - `403` — forbidden (valid token, insufficient permission)
   - `404` — resource not found
   - `409` — conflict (duplicate, stale state)
   - `422` — unprocessable entity (FastAPI default for Pydantic errors)
   - `500` — internal server error (never expose internals)
4. **Register exception handlers** via `@app.exception_handler()` in `main.py` for all custom domain exceptions
5. **Log before responding** — `logger.error()` with full traceback for 5xx; `logger.warning()` for 4xx
6. **Never expose stack traces** in production responses — generic message only

---

## 10. Security

1. **JWT via `python-jose`** — always call `jose.jwt.decode()` with explicit `algorithms=`, `audience=`, and expiry check
2. **Never decode JWT without signature verification** — no `options={"verify_signature": False}` outside test mocks
3. **All secrets via `settings.*`** — API keys, JWT secrets, database URLs must never appear as string literals in any `.py` file
4. **`passlib` or `bcrypt` for password hashing** — never `hashlib.md5`, `hashlib.sha1`, or plain SHA-256
5. **`secrets.token_urlsafe()` for token generation** — never `random.random()` or `str(uuid.uuid4())`
6. **Attach decoded JWT payload to `request.state.user`** — the established pattern from `app/middleware/jwt_auth.py`
7. **Cross-reference `security-rules.md`** for OWASP Top 10 controls and input sanitization requirements

---

## 11. Testing Conventions

1. **Test files mirror source structure** — `ai-server/tests/unit/`, `tests/integration/`, `tests/e2e/`
2. **`pytest-asyncio` with `asyncio_mode = "auto"`** — eliminates per-test `@pytest.mark.asyncio` decorator
3. **FastAPI integration tests use `httpx.AsyncClient`** — not `TestClient`; `AsyncClient(app=app, base_url="http://test")`
4. **Mock async methods with `AsyncMock`** — regular `Mock` will break `await` calls on async methods
5. **Test naming: `test_{function}_{condition}_{outcome}`** — e.g., `test_login_with_invalid_password_returns_401`
6. **One assertion per test where possible** — test one behaviour at a time
7. **Coverage floor** — minimum 98% on lines, branches, AND functions for all project types (POC included). Lines + branches via `--cov-branch --cov-fail-under=98`; functions via the committed helper `scripts/check_func_coverage.py` (stdlib `ast` + `coverage json`), which fails under 98% of functions exercised. See `python-testing` for the script and `testing-rules.md` Rule 7 / 7a.

---

## 12. Logging (loguru)

1. **`from loguru import logger`** — never `print()` or `logging.getLogger()` in new code
2. **Log levels**:
   - `logger.debug()` — detailed diagnostics; disabled in production
   - `logger.info()` — request/response lifecycle, service startup
   - `logger.warning()` — 4xx client errors, recoverable service issues
   - `logger.error()` — 5xx server errors, unhandled exceptions with full traceback
3. **Structured context via `logger.bind()`** — `logger.bind(user_id=..., request_id=...)` for fields attached to a log scope
4. **Never log sensitive data** — no passwords, tokens, API keys, PII, or full request bodies on auth endpoints
5. **Loguru configured in `app/logger.py`** — the stub uses standard `logging`; replace with loguru `configure()` for production
6. **Correlation IDs** — attach `request_id` to every log line within a request lifecycle for distributed tracing

---

## 13. Common Footguns (silent-behavior-change class)

1. **No mutable default arguments**: `def f(items: list[X] | None = None)` then `items = items if items is not None else []`. Never `def f(items=[])` or `def f(opts={})`. The default object is shared across all calls and accumulates state. (Pydantic models use `default_factory`, see 5.6.)
2. **`is None` / `is not None` for nullish checks**: never `== None` / `!= None`. Use `is` for singletons (`None`, `True`, `False`), `==` for values. (See `development-rules.md` rules 72-77.)
3. **No bare `except:` and no blanket `except Exception:` that swallows**: catch the specific exception you expect. If you must catch broadly, log with traceback and re-raise, or convert to a domain exception (see 9.2). A bare `except:` also swallows `KeyboardInterrupt` and `SystemExit`.
4. **`isinstance(x, T)` for type checks**: never `type(x) == T`, which breaks on subclasses.
5. **No lint or type autofix that changes behavior**: same discipline as `development-rules.md` rules 72-77. A `ruff` or `mypy` suggestion that alters runtime semantics is reviewed, not blind-applied, never blindly accepted just because the tool suggested it.
6. **Suppression comments are banned**: never write `# noqa`, `# type: ignore`, `# pyright: ignore`, `# pylint: disable`, `# ruff: noqa`, `# mypy: ignore-errors`, or `# fmt: off`. Solve the real cause so `ruff`, `mypy`, `pyright`, and `pylint` pass honestly: add the precise type, narrow the exception, restructure the code. The only sanctioned relaxation is a documented project-level config (`pyproject.toml` / `ruff.toml` / `mypy.ini`) set once at setup, never an inline per-line ignore. If the ONLY ways to satisfy a tool are a suppression comment or a behavior-changing rewrite, stop and raise it with the user via `/ask`. (Mirrors `development-rules.md` rules 72-77.)

---

## Cross-References

- `security-rules.md` — OWASP Top 10 controls, secrets management, CORS, rate limiting
- `api-rules.md` — contract-first development, endpoint naming, error response envelope format
- `testing-rules.md` — test-spec traceability, coverage targets by project type, Given-When-Then format
- `development-rules.md` — git discipline, branch naming (`feat/mN-{feature}`), dependency management

<!-- Version: 1.2.0 - 2026-06-23 - Added section 13 Common Footguns: no mutable default args, is None idiom, no bare/swallowing except, isinstance over type==, no behavior-changing lint/type autofix (mirrors code-rules.md N and O) -->
<!-- Version: 1.3.0 - 2026-06-24 - Section 13.6: suppression comments banned (noqa, type:ignore, pyright:ignore, pylint:disable, ruff:noqa, mypy:ignore-errors, fmt:off); fix the cause or escalate via /ask; only sanctioned relaxation is setup-time project config (mirrors code-rules.md N) -->
<!-- Version: 1.1.0 — 2026-06-03 — Section 3.4 aligned with development-rules Code Comments policy: inline comments only for non-obvious logic, context to AI_DOCS kept up to date -->
<!-- Version: 1.0.0 — 2026-04-09 — Initial creation: 12-section Python rules file derived from ai-server code patterns -->
