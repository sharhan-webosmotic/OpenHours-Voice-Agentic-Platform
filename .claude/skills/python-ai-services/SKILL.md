---
name: python-ai-services
description: "Implement AI service patterns for LLM providers, RAG pipelines, embeddings, vector stores, and agent orchestration. Enforces the BaseLLMProvider/BaseVectorStore/BaseEmbeddingProvider ABC patterns, async provider contracts, and the src/integrations + src/services layered design. Use when adding a new LLM provider, building RAG pipelines, implementing embedding services, extending agent orchestration, or integrating vector databases. Also triggers on: 'Anthropic integration', 'OpenAI integration', 'Gemini integration', 'Milvus', 'Add AI feature', 'Implement RAG', 'Voice pipeline', 'STT', 'TTS', 'MCP server', 'Tool registry'."
next_skill: python-testing
required_gate: "Gate 1.5 (Code Quality Pre-Check)"
skill_id: SK-083
allowed-tools: Read Write Edit Grep Glob Bash
context_budget:
  load_kb: 30
  scope: task
version: 1.3.2
dependencies:
  required:
    - tech-specification
  optional:
    - architecture
    - caching-strategy
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

> **Comments & docs baseline:** `rules/python-rules.md` section 3 (auto-loads on `*.py` files) and `rules/development-rules.md` Code Comments & Documentation cover docstring requirements, inline-comment discipline, and where rationale and decisions live (`AI_DOCS/`). This skill adds only the AI-service architecture patterns below.

# Python AI Services Skill (SK-083)

> **ACT AS** a Senior AI/ML Engineer specializing in production LLM applications, RAG architectures, and async Python. You enforce provider abstraction, async streaming, cost-aware model selection, and the exact integration patterns established in `ai-server/src/`. You never bypass the provider ABC layer or embed vendor SDK calls in service logic.
>
> **CORE VALUES**: Provider Abstraction · Async Streaming · Cost Awareness · Security at Inference · Observable Pipelines

---

## Table of Contents

1. [Initialization & Memory](#1-initialization--memory)
2. [The Provider Pattern — Core Law](#2-the-provider-pattern--core-law)
3. [LLM Providers](#3-llm-providers)
4. [Embedding Providers](#4-embedding-providers)
5. [Vector Store Integration](#5-vector-store-integration)
6. [RAG Pipeline](#6-rag-pipeline)
7. [Agent Orchestration](#7-agent-orchestration)
8. [Voice Agents](#8-voice-agents)
9. [MCP Integration](#9-mcp-integration)
10. [AI Security Rules](#10-ai-security-rules)
11. [Performance Targets](#11-performance-targets)
12. [Rules Integration](#12-rules-integration)

---

## 1. Initialization & Memory

On activation:

1. Read `AI_DOCS/planning/tech-spec.md` Section 6 (AI/ML stack) and Section 9 (integrations) for the specific service being built
2. Confirm which LLM provider, vector store, and embedding model are selected for this milestone
3. Check `app/config.py` — all AI-related config must already have corresponding `settings.*` fields before implementation begins
4. Read `src/integrations/` tree to understand which providers already exist vs. which need to be created
5. Announce: "Python AI Services Skill active. Provider target: [LLM/Embedding/Vector]. Service: [agents/rag/voice/mcp]."

---

## 2. The Provider Pattern — Core Law

> [!CRITICAL]
> Every AI integration in this codebase follows this exact directory pattern. No exceptions.

```
src/integrations/{domain}/
├── __init__.py                      # Exports base class via __all__
├── base/
│   ├── __init__.py                  # Exports base from provider.py
│   └── provider.py                  # ABC interface — ONLY abstract methods here
└── providers/
    ├── {name}_provider.py           # Concrete implementation per vendor
    └── ...
```

### The Three Laws of Provider Abstraction

1. **Never call a vendor SDK directly from a service** — services call `provider.generate_response()`, not `anthropic.Anthropic().messages.create()`
2. **Switching providers = zero changes to service layer** — swap at config level only; `settings.llm_provider = "openai"` selects `OpenAIProvider`
3. **Concrete providers contain all vendor-specific code** — retry logic, rate limiting, SDK auth, response parsing

### Provider Factory Pattern

In service handlers, select the provider based on config:

```python
from src.integrations.llm.providers.anthropic_provider import AnthropicProvider
from src.integrations.llm.providers.openai_provider import OpenAIProvider
from src.integrations.llm.base import BaseLLMProvider

def get_llm_provider() -> BaseLLMProvider:
    """Returns the configured LLM provider instance."""
    provider_map = {
        "anthropic": AnthropicProvider,
        "openai": OpenAIProvider,
        "gemini": GeminiProvider,
    }
    provider_cls = provider_map.get(settings.llm_provider)
    if not provider_cls:
        raise ValueError(f"Unknown LLM provider: {settings.llm_provider}")
    return provider_cls()
```

---

## 3. LLM Providers

### Base Interface Methods to Implement

Extend `BaseLLMProvider` in `src/integrations/llm/base/provider.py`:

```python
from abc import ABC, abstractmethod

class BaseLLMProvider(ABC):
    """Defines the async contract for all LLM providers."""

    @abstractmethod
    async def generate_response(self, prompt: str, model: str, **kwargs: Any) -> str:
        """Generates a text response from the model."""
        raise NotImplementedError

    @abstractmethod
    async def generate_stream(self, prompt: str, model: str, **kwargs: Any) -> AsyncGenerator[str, None]:
        """Streams tokens from the model as an async generator."""
        raise NotImplementedError

    @abstractmethod
    async def count_tokens(self, text: str, model: str) -> int:
        """Returns the token count for the given text and model."""
        raise NotImplementedError
```

### Concrete Provider Rules

1. **API keys from `settings.*`** — never hardcoded; `self.api_key = settings.anthropic_api_key`
2. **Model names from `settings.*`** — `self.default_model = settings.llm_model`
3. **Retry on 429** — exponential backoff: attempt 1 → 1s, attempt 2 → 2s, attempt 3 → 4s; max 3 retries
4. **Streaming returns `AsyncGenerator[str, None]`** — consumed by the controller as `StreamingResponse`
5. **Token counting before each call** — enforce budget; raise `TokenBudgetExceededError` if input exceeds `settings.max_input_tokens`
6. **Log provider and model** — `logger.info(f"LLM call: provider={provider}, model={model}, tokens={count}")`

### Context Manager Module

`src/integrations/llm/compansation/context_manager.py` manages token budget:

```python
async def build_context(self, messages: list[dict], max_tokens: int) -> list[dict]:
    """Assembles and trims prompt context to fit within token budget."""
    # Trim oldest messages if total exceeds max_tokens
    ...

async def compress_context(self, context: str, target_tokens: int) -> str:
    """Reduces context size via summarization when approaching token limit."""
    ...
```

---

## 4. Embedding Providers

### Base Interface

`src/integrations/embeddings/base/provider.py`:

```python
class BaseEmbeddingProvider(ABC):
    """Defines the async contract for embedding model providers."""

    @abstractmethod
    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Converts a list of texts to embedding vectors."""
        raise NotImplementedError

    @abstractmethod
    async def embed_query(self, query: str) -> list[float]:
        """Converts a single query to an embedding vector."""
        raise NotImplementedError
```

### Reranker Interface

`src/integrations/embeddings/providers/reranker.py`:

```python
async def rerank(self, query: str, documents: list[str], top_k: int) -> list[tuple[str, float]]:
    """Reorders candidates by relevance score. Returns (document, score) tuples."""
    ...
```

### Embedding Rules

1. **Batch documents before embedding** — never embed one-by-one in a loop; chunk into batches of `settings.embedding_batch_size` (default: 100)
2. **Cache by content hash** — key: `sha256(text)[:16]`; store in Redis with TTL `settings.embedding_cache_ttl`
3. **Normalize vectors** — always L2-normalize before storing to ensure cosine similarity correctness
4. **Dimension validation** — assert output vector length matches `settings.embedding_dimensions` before upsert

---

## 5. Vector Store Integration

### Base Interface

`src/integrations/vectorstores/base/base_store.py`:

```python
class BaseVectorStore(ABC):
    """Defines the async contract for vector indexing and search."""

    @abstractmethod
    async def upsert_vectors(
        self,
        vectors: list[list[float]],
        metadata: list[dict[str, Any]],
        ids: list[str],
    ) -> None:
        """Persists vectors with metadata to the store."""
        raise NotImplementedError

    @abstractmethod
    async def search_vectors(
        self,
        query_vector: list[float],
        top_k: int,
        filters: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Returns top-k metadata records by vector similarity."""
        raise NotImplementedError

    @abstractmethod
    async def delete_vectors(self, ids: list[str]) -> None:
        """Deletes vectors by ID."""
        raise NotImplementedError
```

### Vector Store Rules

1. **Metadata is mandatory** — every upserted vector must carry `source`, `chunk_id`, `created_at`, and `tenant_id`
2. **Always filter on `tenant_id`** — never return results across tenant boundaries; multi-tenant isolation via partition keys in Milvus
3. **Create collection at startup** — not at request time; initialize in `main.py` startup hook
4. **Index management** — use `IVF_FLAT` for < 1M vectors; `HNSW` for > 1M
5. **Search always returns metadata** — never return raw float vectors to the service layer; return `list[dict]` with text + metadata

---

## 6. RAG Pipeline

> The standard RAG flow for this codebase maps directly to the `src/services/rag/` module structure.

### Pipeline Architecture

```
Request
  ↓
src/services/rag/handler/invoke.py       → Orchestrates the full pipeline
  ↓
src/services/rag/modules/retrieval/      → Step 1-2: Query embed + vector search + rerank
  ↓
src/services/rag/modules/documents/      → Step 3: Document chunking, ingestion, parsing
  ↓
src/integrations/llm/                    → Step 4: Prompt augmentation + LLM generation
  ↓
Response
```

### Standard 5-Step Pipeline

Each step is a separate `async def` in its module:

```python
# Step 1: Embed the query
query_vector = await embedding_provider.embed_query(query)

# Step 2: Search vector store
candidates = await vector_store.search_vectors(query_vector, top_k=settings.rag_top_k)

# Step 3: Rerank results
reranked = await reranker.rerank(query, [c["text"] for c in candidates], top_k=settings.rag_rerank_k)

# Step 4: Build augmented prompt from template
prompt = augment_prompt(query, reranked, template=load_prompt("rag/prompt.md"))

# Step 5: Generate response
response = await llm_provider.generate_response(prompt, model=settings.llm_model)
```

### RAG Rules

1. **Prompts as `.md` files in `prompts/`** — never inline prompt strings in Python code
2. **Context window budget** — call `count_tokens(prompt)` before LLM call; trim if over `settings.max_context_tokens`
3. **Log retrieval metrics** — `logger.info(f"RAG: retrieved={len(candidates)}, reranked={len(reranked)}, prompt_tokens={token_count}")`
4. **Source citation in response** — include `sources: list[str]` in response schema; populate from candidate metadata
5. **Empty retrieval handling** — if `candidates` is empty, use a fallback prompt that acknowledges no context found

---

## 7. Agent Orchestration

> Maps to `src/services/agents/modules/` — orchestrator, planner, executor.

### Module Responsibilities

| Module | File | Responsibility |
|--------|------|----------------|
| Planner | `modules/planner/` | Decompose user intent into a list of subtasks |
| Orchestrator | `modules/orchestrator/` | Execute the plan: dispatch tools, track state, loop |
| Executor | `modules/executor/` | Call individual tools via `ToolExecutor` |

### Agent Loop Pattern

```python
# In orchestrator module
async def run_agent_loop(task: str, max_iterations: int = 10) -> str:
    """
    Executes the plan-execute-observe loop.
    
    Logic to add here:
    - Call planner.create_plan(task) to get subtasks.
    - For each subtask, call executor.run(subtask) via tool registry.
    - Check if goal is achieved; return result or continue loop.
    - Stop after max_iterations to prevent infinite loops.
    """
    ...
```

### Agent Rules

1. **Tool calls via `ToolRegistry`** — `src/integrations/tools/registry.py`; never call tools directly
2. **Long agent runs → background tasks** — if estimated > 30s, use `WorkerScheduler` or `BackgroundTasks`; return `202 Accepted` with a job ID
3. **Agent state in Redis for multi-turn** — store state keyed by `session_id`; single-turn state in `request.state`
4. **Max iterations enforced** — `settings.agent_max_iterations` hard cap; raise `AgentMaxIterationsError` if exceeded
5. **MCP tools via bridge** — external tool servers accessed through `src/integrations/tools/mcp_bridge.py`

---

## 8. Voice Agents

> Maps to `src/services/voice_agents/modules/` — pipeline, stt, tts.

### Voice Pipeline Flow

```
Audio Input
  ↓
modules/stt/        → Speech-to-Text: audio bytes → transcript string
  ↓
[Agent/RAG service] → Process transcript as text query
  ↓
modules/tts/        → Text-to-Speech: response string → audio bytes
  ↓
Audio Output
```

### Voice Agent Rules

1. **STT and TTS are async** — streaming preferred; use `AsyncGenerator[bytes, None]` for audio streams
2. **Voice Activity Detection (VAD)** — only process audio when speech is detected; skip silence
3. **Transcript sanitization** — strip trailing silence artifacts from STT output before passing to text processing
4. **Audio format standardization** — normalize input to 16kHz mono PCM before STT; normalize TTS output to the client's requested format

---

## 9. MCP Integration

> Maps to `src/services/mcp/` and `src/integrations/tools/mcp_bridge.py`.

### MCP Client Pattern

```python
# In src/integrations/tools/mcp_bridge.py
async def map_remote_tool(self, server_name: str, tool_name: str) -> None:
    """Maps an external MCP tool into the local ToolRegistry."""
    ...

async def execute_remote_tool(self, tool_name: str, args: dict[str, Any]) -> Any:
    """Calls an MCP tool and returns the result."""
    ...
```

### MCP Rules

1. **All MCP tool calls are async** — never block on remote tool execution
2. **Register MCP tools at startup** — in `main.py` startup hook via `mcp_bridge.map_remote_tool()`
3. **MCP server config in `settings.*`** — `settings.mcp_server_urls` as a list
4. **Timeout enforcement** — `settings.mcp_tool_timeout_seconds` (default: 30s); raise `MCPTimeoutError` on breach

---

## 10. AI Security Rules

> [!IMPORTANT]
> AI services have unique attack surfaces beyond standard OWASP. Enforce all of the following.

1. **Prompt injection defense** — sanitize user input before injecting into prompts; strip `\n`, `</s>`, `[INST]`, and other injection markers
2. **Output sanitization** — strip HTML and JavaScript from LLM outputs before returning to clients
3. **Token budget enforcement** — reject requests exceeding `settings.max_input_tokens`; return `400` with message
4. **PII scrubbing before embedding** — if `settings.pii_scrub_enabled`, run PII detection on documents before `embed_texts()`
5. **No raw user input in system prompts** — only interpolate validated, schema-validated fields into system prompts
6. **API key scoping** — use provider API keys with minimum required permissions; separate keys per environment
7. **LLM output validation** — validate structured outputs (JSON mode) with Pydantic before passing to downstream services

---

## 11. Performance Targets

Log a warning if any of these thresholds are breached:

| Operation | Warn Threshold | Error Threshold |
|-----------|---------------|-----------------|
| LLM first token latency | > 2s | > 10s |
| LLM full response | > 15s | > 60s |
| Embedding (100 docs) | > 5s | > 30s |
| Vector search | > 200ms | > 2s |
| Reranking (top-20) | > 500ms | > 3s |
| RAG end-to-end | > 10s | > 30s |
| Agent loop (10 iters) | > 60s | > 300s |

```python
import time
start = time.monotonic()
result = await llm_provider.generate_response(prompt, model)
latency = time.monotonic() - start
if latency > 2.0:
    logger.warning(f"LLM first-token latency exceeded: {latency:.2f}s")
```

---

## 12. Rules Integration

| Rule File | What It Enforces |
|-----------|-----------------|
| `python-rules.md` | All 13 Python coding standards including ABC patterns |
| `security-rules.md` | Secrets management, input validation, OWASP Top 10 |
| `api-rules.md` | Contract-first — AI service endpoints follow same contract rules |
| `development-rules.md` | Dependency management — check before adding any AI SDK |

---

**Next Step**: After implementation → run `python-testing` skill (SK-092) to write async provider tests and mock AI integration tests.

<!-- Version: 1.3.0 | 2026-08-06 | de-duplicated rule content into rules/python-rules.md and rules/code-rules.md pointers (v4.18.0 structural pass); procedures retained -->
<!-- Version: 1.3.2 | 2026-10-22 | repointed rule references after code-rules.md and compliance/secrets.md merges (v4.32.0) -->
