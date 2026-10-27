---
description: "AI integration safety rules. Enforces cost controls, approval gates, and safe patterns for any LLM API usage in code."
paths:
  - "**/*.py"
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
---

# AI Integration Safety Rules

These rules apply to any code that calls an LLM API (Anthropic, OpenAI, Google, etc.).

## Rule 1: Cost Approval Gate (BLOCKING)

**Every new LLM integration requires `/ai-cost-guard` approval before implementation.**

The approval record must exist in `AI_DOCS/memory/ai-cost-approvals.md` before any LLM API code is committed.

If you see an LLM API call in a PR without a corresponding approval record: BLOCK the PR.

## Rule 2: Model Tier Discipline

**Use the cheapest model that can do the job correctly.**

| Task | Allowed Models | Forbidden |
|------|---------------|---------|
| Classification, routing, yes/no decisions | Haiku | Sonnet, Opus |
| Extraction, summarization, simple generation | Haiku or Sonnet | Opus |
| Code generation, tool use, analysis | Sonnet | Opus (unless synthesis) |
| Multi-document synthesis, high-stakes | Opus | — |

Any Opus usage for per-user-request features requires explicit written justification in `AI_DOCS/memory/ai-cost-approvals.md`.

## Rule 3: max_tokens Required (BLOCKING)

Every LLM call MUST include `max_tokens`. No exceptions.

```python
# WRONG — unbounded output
client.messages.create(model="claude-sonnet-4-6", messages=[...])

# RIGHT
client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,  # Always set this
    messages=[...]
)
```

## Rule 4: Prompt Caching Required for Repeated Calls

If the same system prompt is sent in multiple calls, prompt caching MUST be implemented.

```python
# WRONG — system prompt sent uncached every time
messages.create(
    model="claude-sonnet-4-6",
    system="You are a helpful assistant...",  # 2000 tokens, sent 1000x/day = expensive
    messages=[...]
)

# RIGHT — system prompt cached
messages.create(
    model="claude-sonnet-4-6",
    system=[{
        "type": "text",
        "text": "You are a helpful assistant...",
        "cache_control": {"type": "ephemeral"}
    }],
    messages=[...]
)
```

Eligible for caching: system prompts > 1024 tokens (Haiku/Sonnet) or > 2048 tokens (Opus).

## Rule 5: No LLM Calls in Loops Without Approval (BLOCKING)

Any loop that calls an LLM API requires explicit written approval in `AI_DOCS/memory/ai-cost-approvals.md`.

```python
# REQUIRES APPROVAL — LLM call inside loop
for item in items:  # Could be thousands of items
    result = client.messages.create(...)

# REQUIRES APPROVAL — nested loops
for doc in documents:
    for chunk in doc.chunks:
        embedding = openai.embeddings.create(...)
```

When approved, the code MUST include:
- A hard limit on loop iterations (e.g., `max_items = 100`)
- Logging of total cost after the loop
- A cost kill-switch (stop if estimated cost exceeds a threshold)

## Rule 6: Token Usage Logging Required

Every LLM call MUST log input and output token counts.

```python
# WRONG — no usage tracking
response = client.messages.create(...)
return response.content[0].text

# RIGHT — with usage tracking
response = client.messages.create(...)
logger.info(f"LLM usage: input={response.usage.input_tokens}, output={response.usage.output_tokens}, model={model}")
# Optionally write to your metrics system
return response.content[0].text
```

## Rule 7: Timeout and Retry Required

All LLM API calls MUST have:
- Timeout: 30 seconds maximum
- Retry: exponential backoff, maximum 3 retries
- Error handling: `APIError`, `APITimeoutError`, `RateLimitError` caught separately

```python
# Required pattern
import anthropic
from anthropic import APIError, APITimeoutError, RateLimitError
import time

def call_llm_with_retry(client, **kwargs, max_retries=3):
    for attempt in range(max_retries):
        try:
            return client.messages.create(timeout=30.0, **kwargs)
        except RateLimitError:
            wait = 2 ** attempt
            logger.warning(f"Rate limited. Retrying in {wait}s...")
            time.sleep(wait)
        except APITimeoutError:
            if attempt == max_retries - 1:
                raise
        except APIError as e:
            logger.error(f"API error: {e}")
            raise
    raise RuntimeError("Max retries exceeded")
```

## Rule 8: Per-User Rate Limiting Required

Any LLM feature accessible to users MUST have per-user rate limiting.

```python
# Minimum required
MAX_LLM_CALLS_PER_USER_PER_HOUR = 20
MAX_LLM_CALLS_PER_USER_PER_DAY = 100
```

Implement using Redis with sliding window or token bucket algorithm.

## Rule 9: No Streaming Without Backpressure

Streaming LLM responses to end users MUST implement backpressure:
- Use server-sent events (SSE) or WebSockets with flow control
- Do not buffer the entire stream in memory before sending
- Handle client disconnect — stop the LLM call if the client drops

## Rule 10: No Hardcoded API Keys

LLM API keys MUST come from environment variables. Never hardcoded.

```python
# WRONG
client = anthropic.Anthropic(api_key="sk-ant-...")

# RIGHT
client = anthropic.Anthropic()  # Reads ANTHROPIC_API_KEY from env automatically
```
