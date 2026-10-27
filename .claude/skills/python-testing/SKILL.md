---
name: python-testing
description: "Write pytest tests for FastAPI backends, async services, and AI provider integrations. Covers unit tests with AsyncMock, integration tests with httpx.AsyncClient, pytest-asyncio, fixtures, conftest patterns, and coverage targets. Use when writing Python tests, setting up pytest configuration, testing FastAPI endpoints, mocking async providers, or running QA for the ai-server. Also triggers on: 'Test Python', 'pytest async', 'Test FastAPI', 'Unit test Python', 'Integration test Python', 'Test coverage', 'Mock provider', 'Python QA', 'test ai-server'."
next_skill: python-deployment
required_gate: "Gate 4 (QA Sign-off)"
skill_id: SK-084
allowed-tools: Read Write Edit Grep Glob Bash
context_budget:
  load_kb: 30
  scope: task
version: 1.8.1
dependencies:
  required:
    - code-quality
  optional:
    - python-ai-services
    - tech-specification
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

# Python Testing Skill (SK-084)

## MAVS report (machine-checked contract, BLOCKING)

After running the suite, emit a normalized report to `AI_DOCS/quality/mavs/python-test.json` per `docs/mavs-report-schema.md`, generated FROM the real runner output (never hand-written). Runner: `pytest --junitxml=<tmp>.xml`, then parse counts + failures into the report. Stamp `source_commit` with `git rev-parse HEAD` and `generated_at` with the real run time. `status` is `PASS` only when pytest exited clean and `failed` is 0. Any failure is `FAIL`. pytest absent is `MISSING_TOOL`, never a silent `PASS`. `hooks/mavs-gate.sh` PARSES this report at the promotion merge: a `FAIL`, a STALE report (`source_commit != HEAD`), or a missing required report blocks the merge. The verdict is parsed from the runner, not asserted.

> **ACT AS** a Senior Python QA Engineer and Test Automation Architect with 20+ years of experience in pytest, async testing, and AI/ML service verification. You write tests that are fast, deterministic, and meaningful — you mock at the right boundary and always test behaviour, not implementation.
>
> **CORE VALUES**: Test Behaviour Not Implementation · Mock at the Provider Boundary · Async-Native · Coverage Is a Floor Not a Target · No Skipped Tests
>
> **Isolation is mandatory (`.claude/rules/testing-rules.md` 19a-19f):** no real/production env vars in tests (use `monkeypatch.setenv` with placeholders or a `.env.test`, never the real environment), mock every external service (DB in unit tests, httpx/requests, payment, email/SMS, storage, LLM providers via `AsyncMock`/`responses`/`respx`), and cause NO real side effects. A test must never actually send an email, charge a card, call a billed LLM endpoint, or write to production. Assert the mock was awaited with the right arguments; never let the real call happen. `/build`'s test-isolation gate blocks violations.

---

## Table of Contents

1. [Initialization & Context](#1-initialization--context)
2. [Test Directory Structure](#2-test-directory-structure)
3. [pytest Configuration](#3-pytest-configuration)
4. [Core Fixtures (conftest.py)](#4-core-fixtures-conftestpy)
5. [Unit Test Patterns](#5-unit-test-patterns)
6. [FastAPI Integration Test Patterns](#6-fastapi-integration-test-patterns)
7. [AI Provider Test Patterns](#7-ai-provider-test-patterns)
8. [Coverage Rules](#8-coverage-rules)
9. [Test Naming Conventions](#9-test-naming-conventions)
10. [Required Dev Packages](#10-required-dev-packages)
11. [Pre-QA Checklist](#11-pre-qa-checklist)
12. [Rules Integration](#12-rules-integration)

---

## 1. Initialization & Context

On activation:

1. Check current test state: `ls ai-server/tests/` — the `tests/` directory currently contains only `test.md` (green field)
2. Read `AI_DOCS/planning/tech-spec.md` Section 18 (test cases) for the feature acceptance criteria to trace tests to
3. Read `AI_DOCS/memory/project-context.md` — check `Unit Testing: DISABLED` override before writing tests
4. Identify project type from memory — coverage floor applies to ALL types per `testing-rules.md` Rule 7/7a and `python-rules.md` section 11.7 (Section 8 below has this skill's enforcement commands)
5. Announce: "Python Testing Skill active. Test target: [service/feature]. Coverage target: [X%]. New test infra needed: [yes/no]."

---

## 2. Test Directory Structure

Bootstrap this structure inside `ai-server/tests/` (currently a green field):

```
ai-server/
├── tests/
│   ├── conftest.py                          # App fixture, AsyncClient, auth headers, shared mocks
│   ├── unit/
│   │   ├── conftest.py                      # Unit-specific fixtures (no real app)
│   │   ├── integrations/
│   │   │   ├── test_llm_providers.py        # AnthropicProvider, OpenAIProvider, GeminiProvider
│   │   │   ├── test_embedding_providers.py  # EmbeddingModel, BaseEmbeddingProvider
│   │   │   ├── test_vector_stores.py        # BaseVectorStore, PGVectorStore/MilvusClient
│   │   │   ├── test_tools.py                # ToolRegistry, ToolExecutor
│   │   │   └── test_skills.py               # SkillLoader, SkillExecutor
│   │   └── services/
│   │       ├── test_agents_handler.py       # invoke_agents_status and agent pipeline
│   │       ├── test_rag_handler.py          # invoke_rag_status and RAG pipeline
│   │       ├── test_voice_handler.py        # invoke_voice_agents_status and voice pipeline
│   │       └── test_mcp_handler.py          # invoke_mcp_status and MCP bridge
│   ├── integration/
│   │   ├── conftest.py                      # Real app loaded, dependency overrides
│   │   ├── test_auth_endpoints.py           # POST /api/auth/login — all scenarios
│   │   ├── test_agent_endpoints.py          # GET /api/agents/status and future routes
│   │   └── test_rag_endpoints.py            # GET /api/rag/status and future routes
│   └── e2e/
│       └── test_full_rag_flow.py            # End-to-end: ingest → embed → query → respond
├── pyproject.toml                           # pytest config lives here
```

---

## 3. pytest Configuration

Add to `ai-server/pyproject.toml`:

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
python_files = "test_*.py"
python_functions = "test_*"
python_classes = "Test*"
addopts = [
    "--cov=app",
    "--cov=src",
    "--cov-branch",
    "--cov-report=term-missing",
    "--cov-report=json:AI_DOCS/quality/test-artifacts/coverage/coverage.json",
    "--cov-fail-under=98",
    "-v",
]

[tool.coverage.run]
omit = [
    "tests/*",
    "**/__init__.py",
    "**/schemas/__init__.py",
]
```

> [!NOTE]
> `asyncio_mode = "auto"` eliminates the need for `@pytest.mark.asyncio` on every async test. All `async def test_*` functions run automatically.

---

## 4. Core Fixtures (conftest.py)

The root `tests/conftest.py` must provide these fixtures for all test levels:

```python
"""
Shared test fixtures for the ai-server test suite.
"""

import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock

from app.main import app
from app.middleware.jwt_auth import verify_jwt_token
from src.integrations.llm.base import BaseLLMProvider
from src.integrations.vectorstores.base.base_store import BaseVectorStore
from src.integrations.embeddings.base.provider import BaseEmbeddingProvider


@pytest.fixture
async def app_client() -> AsyncClient:
    """Async HTTP client wired to the FastAPI app for integration tests."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture
def mock_llm_provider() -> AsyncMock:
    """AsyncMock of BaseLLMProvider — returns deterministic responses."""
    mock = AsyncMock(spec=BaseLLMProvider)
    mock.generate_response.return_value = "test response"
    mock.count_tokens.return_value = 42
    return mock


@pytest.fixture
def mock_vector_store() -> AsyncMock:
    """AsyncMock of BaseVectorStore — returns deterministic search results."""
    mock = AsyncMock(spec=BaseVectorStore)
    mock.search_vectors.return_value = [
        {"text": "test document", "source": "test.pdf", "score": 0.95}
    ]
    return mock


@pytest.fixture
def mock_embedding_provider() -> AsyncMock:
    """AsyncMock of BaseEmbeddingProvider — returns fixed-dimension vectors."""
    mock = AsyncMock(spec=BaseEmbeddingProvider)
    mock.embed_query.return_value = [0.1] * 1536
    mock.embed_texts.return_value = [[0.1] * 1536]
    return mock


@pytest.fixture
def auth_headers() -> dict[str, str]:
    """Valid test JWT headers for authenticated endpoint tests."""
    # Use a test-only JWT signed with a test secret; never a real credential
    return {"Authorization": "Bearer test_jwt_token"}


@pytest.fixture
def override_auth(app_client: AsyncClient):
    """Overrides JWT verification dependency to skip auth in integration tests."""
    app.dependency_overrides[verify_jwt_token] = lambda: None
    yield
    app.dependency_overrides.clear()
```

---

## 5. Unit Test Patterns

### Testing Async Service Handlers

```python
"""
Unit tests for the agents service handler.
"""

from unittest.mock import AsyncMock, patch

from src.services.agents.handler.invoke import invoke_agents_status


async def test_invoke_agents_status_returns_active_dict():
    """Given the agents service is running, when status is requested, then return active status dict."""
    result = await invoke_agents_status()

    assert result["status"] == "agents_service_active"
    assert "version" in result
```

### Testing ABC Provider Implementations

```python
"""
Unit tests for the Anthropic LLM provider.
"""

from unittest.mock import AsyncMock, patch

from src.integrations.llm.providers.anthropic_provider import AnthropicProvider


async def test_anthropic_provider_generate_response_returns_text():
    """Given a valid prompt, when generate_response is called, then return non-empty text."""
    provider = AnthropicProvider()

    with patch("src.integrations.llm.providers.anthropic_provider.anthropic") as mock_sdk:
        mock_sdk.AsyncAnthropic.return_value.messages.create = AsyncMock(
            return_value=type("Response", (), {"content": [type("Block", (), {"text": "hello"})()]})()
        )
        result = await provider.generate_response(prompt="test", model="claude-3-5-sonnet-20241022")

    assert result == "hello"


async def test_anthropic_provider_raises_not_implemented_without_api_key():
    """Given no API key in settings, when generate_response is called, then raise configuration error."""
    provider = AnthropicProvider()

    with patch("src.integrations.llm.providers.anthropic_provider.settings") as mock_settings:
        mock_settings.anthropic_api_key = ""
        with pytest.raises((ValueError, RuntimeError)):
            await provider.generate_response(prompt="test", model="claude-3-5-sonnet-20241022")
```

### Unit Test Rules

Baseline async testing conventions (async test functions, `AsyncMock` for async callables, one assertion per test, no real network calls in unit tests): `python-rules.md` section 11 and `testing-rules.md` (Test Structure, and Environment & Service Isolation 19a-19f, summarized above). This skill adds:

1. **Mock at the provider boundary** — mock `AnthropicProvider`, not `anthropic.AsyncAnthropic`
2. **Test the `raise NotImplementedError` on every ABC base method** — confirm abstract contract

---

## 6. FastAPI Integration Test Patterns

### Controller Endpoint Tests

```python
"""
Integration tests for the agents controller endpoints.
"""

import pytest
from httpx import AsyncClient


async def test_get_agents_status_returns_200(app_client: AsyncClient, override_auth):
    """
    Given: The agents service is running
    When: GET /api/agents/status is called with valid auth
    Then: Returns 200 with status dict
    """
    response = await app_client.get("/api/agents/status")

    assert response.status_code == 200
    assert response.json()["status"] == "agents_service_active"


async def test_get_agents_status_returns_401_without_auth(app_client: AsyncClient):
    """
    Given: No auth token in request
    When: GET /api/agents/status is called
    Then: Returns 401 Unauthorized
    """
    response = await app_client.get("/api/agents/status")

    assert response.status_code == 401


async def test_login_returns_200_with_valid_credentials(app_client: AsyncClient):
    """
    Given: Valid username and password
    When: POST /api/auth/login is called
    Then: Returns 200 with access_token
    """
    response = await app_client.post(
        "/api/auth/login",
        json={"username": "test@example.com", "password": "valid_password"},
    )

    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"


async def test_login_returns_422_with_missing_fields(app_client: AsyncClient):
    """
    Given: Request body missing password field
    When: POST /api/auth/login is called
    Then: Returns 422 Unprocessable Entity (Pydantic validation)
    """
    response = await app_client.post(
        "/api/auth/login",
        json={"username": "test@example.com"},
    )

    assert response.status_code == 422
```

### Integration Test Rules

1. **Always test these 4 scenarios per endpoint**: 200 happy path, 422 validation error, 401 unauthenticated, 404 not found
2. **`app.dependency_overrides[verify_jwt_token]`** — use the `override_auth` fixture to bypass real JWT in integration tests
3. **Use `app_client` fixture** — never instantiate `TestClient` or `httpx.AsyncClient` directly in test functions
4. **Validate response shape** — check both `status_code` and response body fields
5. **Test error response envelope** — confirm errors follow the standard shape from `api-rules.md`

---

## 7. AI Provider Test Patterns

### Streaming Response Tests

```python
async def test_llm_provider_stream_yields_tokens(mock_llm_provider: AsyncMock):
    """
    Given: A mock LLM provider configured to stream
    When: generate_stream is called
    Then: Yields at least one token
    """
    async def token_generator():
        yield "Hello"
        yield " world"

    mock_llm_provider.generate_stream.return_value = token_generator()

    tokens = []
    async for token in await mock_llm_provider.generate_stream(prompt="test", model="test"):
        tokens.append(token)

    assert len(tokens) > 0
    assert "Hello" in tokens
```

### RAG Pipeline Tests

```python
async def test_rag_pipeline_returns_response_with_sources(
    mock_llm_provider: AsyncMock,
    mock_vector_store: AsyncMock,
    mock_embedding_provider: AsyncMock,
):
    """
    Given: A query with matching documents in the vector store
    When: The full RAG pipeline is invoked
    Then: Returns a response with source citations
    """
    # Arrange: mock at the provider boundaries
    mock_embedding_provider.embed_query.return_value = [0.1] * 1536
    mock_vector_store.search_vectors.return_value = [
        {"text": "relevant content", "source": "doc.pdf", "score": 0.9}
    ]
    mock_llm_provider.generate_response.return_value = "Based on the document..."

    # Act
    result = await invoke_rag_pipeline(
        query="test query",
        llm=mock_llm_provider,
        store=mock_vector_store,
        embedder=mock_embedding_provider,
    )

    # Assert
    assert "response" in result
    assert len(result["sources"]) > 0
    mock_embedding_provider.embed_query.assert_awaited_once_with("test query")
    mock_vector_store.search_vectors.assert_awaited_once()
```

### AI Provider Test Rules

1. **Mock at integration boundaries** — `mock_llm_provider`, `mock_vector_store`, `mock_embedding_provider` from `conftest.py`
2. **Test empty retrieval path** — what happens when `search_vectors` returns `[]`
3. **Test token budget exceeded** — mock `count_tokens` to return a value above `settings.max_input_tokens`
4. **Async generator for streams** — use `async def` generator functions as `side_effect` for streaming mocks
5. **Assert call arguments** — verify providers are called with correct model names, not just that they were called

---

## 8. Coverage Rules

Coverage floor (98% on lines, branches, AND functions, every project type including POC): `testing-rules.md` Rule 7 / 7a and `python-rules.md` section 11.7. This skill's enforcement procedure:

Lines + branches come from pytest-cov (`--cov-branch --cov-fail-under=98`). Functions are enforced by the committed helper `check_func_coverage.py` (this skill folder; copy it to the project's `scripts/`). The `--cov-report=json:...` addopt auto-writes the report into the gitignored artifacts dir on each run. Then run `python scripts/check_func_coverage.py --coverage AI_DOCS/quality/test-artifacts/coverage/coverage.json --fail-under 98 --include app --include src`. It fails when under 98% of functions were exercised (any function with zero executed body lines was never called).

**Coverage exclusions** (in `pyproject.toml`):
- All `__init__.py` files (re-exports only)
- All `schemas/__init__.py` files (Pydantic models)
- All `prompts/` directories (markdown files)
- All stub files where `return None` is the entire body (auto-excluded if covered by integration tests)

> [!IMPORTANT]
> Coverage is a floor, not a target. 98% with meaningful assertions beats a higher number reached with trivial pass-through tests. Hit the 98% floor with real behavioral assertions, never by padding it with tests that assert nothing.

---

## 9. Test Naming Conventions

Baseline naming format and Given-When-Then structure: `python-rules.md` section 11.5 and `testing-rules.md` (Test Structure). Applied to this codebase, using `test_{function_or_class}_{condition}_{expected_outcome}`:

| Good ✓ | Bad ✗ |
|--------|-------|
| `test_login_with_invalid_password_returns_401` | `test_login_failure` |
| `test_invoke_rag_status_returns_active_dict` | `test_rag_works` |
| `test_anthropic_provider_raises_when_api_key_missing` | `test_anthropic_error` |
| `test_vector_store_search_returns_empty_list_on_no_match` | `test_search` |
| `test_get_agents_status_returns_200_with_valid_auth` | `test_agents_endpoint` |

Given-When-Then docstring format for all tests:

```python
async def test_login_returns_401_with_wrong_password(app_client: AsyncClient):
    """
    Given: A valid username but wrong password
    When: POST /api/auth/login is called
    Then: Returns 401 Unauthorized with generic error message
    """
```

---

## 10. Required Dev Packages

Add to `ai-server/requirements-dev.txt` (create if it doesn't exist):

```
pytest>=8.0
pytest-asyncio>=0.23
pytest-cov>=5.0
pytest-mock>=3.12
httpx>=0.27
```

> [!NOTE]
> `httpx>=0.27` is required for `AsyncClient` transport support with FastAPI/Starlette. Do NOT use `requests` or `aiohttp` in tests.

---

## 11. Pre-QA Checklist

Before marking QA as complete (Gate 4):

- [ ] All tests pass: `pytest tests/` (zero failures, zero errors)
- [ ] No skipped tests: `pytest --tb=short | grep SKIPPED` returns nothing
- [ ] Line + branch coverage >= 98%: `--cov-branch --cov-fail-under=98` passes
- [ ] Function coverage >= 98%: `python scripts/check_func_coverage.py --coverage AI_DOCS/quality/test-artifacts/coverage/coverage.json --fail-under 98 --include app --include src` exits 0 (the JSON is auto-written there by the `--cov-report=json:...` addopt; the folder is gitignored)
- [ ] Every new handler has at least one unit test
- [ ] Every new controller endpoint has: 200, 422, 401 test cases
- [ ] AI provider tests mock at the provider boundary (not SDK)
- [ ] Async tests use `async def` with `asyncio_mode = "auto"`
- [ ] `conftest.py` fixtures used — no duplicate setup code in test functions
- [ ] Test names follow `test_{function}_{condition}_{outcome}` format
- [ ] Given-When-Then docstrings present on all integration tests
- [ ] `requirements-dev.txt` updated with all test dependencies
- [ ] Risk-class edge battery covered for every matching code shape (`testing-rules.md` Risk-Class Edge Battery): serializers/string-builders tested with quotes, backslashes, newlines, unicode, empty, and injection-shaped input (YAML/JSON/markdown builders are the classic escape-bug source), list endpoints tested at pagination boundaries (0 results, single page, last page), upload handlers tested per advertised format + explicit rejection per unsupported format, rate limiters tested for scope and success-exclusion, RBAC tested on allow AND deny cells

---

## 12. Rules Integration

| Rule File | What It Enforces |
|-----------|-----------------|
| `python-rules.md` | Section 11 — async testing conventions, `AsyncMock`, naming |
| `testing-rules.md` | Coverage targets, test-spec traceability, Given-When-Then |
| `security-rules.md` | No real credentials in tests; test auth flows |
| `development-rules.md` | No skipped tests in CI; tests committed with features |

---

**Next Step**: After tests pass and coverage meets threshold → run `python-deployment` skill (SK-085) to prepare the deployment runbook.

<!-- Version: 1.8.0 | 2026-08-06 | de-duplicated rule content into rules/python-rules.md and rules/testing-rules.md pointers (v4.18.0 structural pass); procedures retained -->
