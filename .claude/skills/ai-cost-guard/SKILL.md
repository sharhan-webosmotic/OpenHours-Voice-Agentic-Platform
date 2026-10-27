---
name: ai-cost-guard
skill_id: SK-095
context_budget:
  load_kb: 30
  scope: task
version: 1.0.2
description: "AI token cost estimation, risk analysis, and written approval gate before any LLM API implementation. Calculates per-call and monthly cost estimates, flags high-risk patterns (unbounded loops, per-user Opus calls, no caching, missing max_tokens), recommends optimizations, and requires written user approval before proceeding. Use before implementing any Anthropic/OpenAI/LLM API call in code."
allowed-tools: Read Grep Glob
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

# /ai-cost-guard — AI Cost Estimation & Risk Analysis

Before implementing any LLM API integration, this skill estimates costs, flags risks, and gets written approval.

## When to Run This Skill

Run BEFORE implementing:
- Any `anthropic.messages.create()` or `openai.chat.completions.create()` call
- Any loop that calls an LLM API
- Any RAG pipeline, embedding generation, or batch processing
- Any streaming response handler
- Any agent-to-agent orchestration
- Any feature that could call an LLM on user action (per-user cost)

## Step 1 — Read the Proposed Implementation

Read the feature spec or the code being proposed. Extract:
- How many LLM calls per user action?
- Are there loops? Nested loops?
- What model is being used? (Haiku / Sonnet / Opus)
- What is the estimated input token count per call?
- What is the estimated output token count per call?
- How many users/requests per day is expected?

## Step 2 — Cost Estimation

### Current Pricing Reference (verify at anthropic.com/pricing before finalizing)

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Cache Write | Cache Hit |
|-------|----------------------|----------------------|-------------|-----------|
| claude-haiku-4-5 | $0.80 | $4.00 | $1.00 | $0.08 |
| claude-sonnet-4-6 | $3.00 | $15.00 | $3.75 | $0.30 |
| claude-opus-4-8 | $15.00 | $75.00 | $18.75 | $1.50 |

### Calculation Template

```
Per-call cost:
  Input tokens:  [N] × [model input price per token] = $[X]
  Output tokens: [N] × [model output price per token] = $[X]
  Total per call: $[X]

Daily cost at [N] requests/day:
  Without caching: $[X]/call × [N] calls = $[X]/day
  With prompt caching (80% hit rate): $[X]/day

Monthly projection:
  Without caching: ~$[X]/month
  With prompt caching: ~$[X]/month

Savings from prompt caching: ~$[X]/month
```

## Step 3 — Risk Flag Analysis

Flag each of these if present:

| Risk | Pattern | Severity |
|------|---------|---------|
| Unbounded loop | `while True`, `for item in large_list` with LLM call inside | CRITICAL |
| Nested LLM loops | LLM call inside a loop that is itself inside a loop | CRITICAL |
| Per-user Opus calls | Using Opus for per-request user features | HIGH |
| No caching on repeated prompts | Same system prompt sent every call | HIGH |
| Large context without chunking | Sending entire codebase or document per call | HIGH |
| Streaming without backpressure | Streaming to user without rate limiting | MEDIUM |
| No token limit on output | Missing `max_tokens` parameter | MEDIUM |
| Missing error handling | No retry logic, no cost guard on failures | MEDIUM |
| No usage tracking | No logging of tokens used | MEDIUM |

## Step 4 — Cost Optimization Recommendations

Always provide these recommendations:

1. **Prompt Caching**: Can the system prompt be cached? (>1024 tokens = eligible for Haiku/Sonnet, >2048 = eligible for Opus)
2. **Model Downgrade**: Can Haiku replace Sonnet? Can Sonnet replace Opus for this task?
3. **Batching**: Can multiple requests be batched into one LLM call?
4. **Chunking**: Should large inputs be chunked and processed separately?
5. **Caching Results**: Can LLM outputs be cached in Redis/database for repeated identical inputs?
6. **Short-circuit**: Can rule-based pre-processing avoid LLM calls entirely for simple cases?

## Step 5 — Written Approval Required

**Before implementing any LLM integration, present this approval request:**

```markdown
## AI Cost Approval Required

### Feature: [feature name]
### Estimated Cost:
- Per call: ~$[X]
- Daily (at [N] req/day): ~$[X]
- Monthly: ~$[X]
- With prompt caching: ~$[X]/month

### Risk Flags: [list or NONE]

### Optimizations Applied:
- [list of optimizations already in the design]

### Optimizations Recommended (not yet applied):
- [list with effort estimate]

**Do you approve this implementation? (yes / no / modify)**
**If modify: what should change?**
```

Wait for written approval. Do NOT proceed with implementation until approval is received.
Write the approval to `AI_DOCS/memory/ai-cost-approvals.md`:
```
[date] [feature] — APPROVED by user — Est. $[X]/month — [model] — [optimizations noted]
```

## Step 6 — Implementation Guidelines (Post-Approval)

When implementing, enforce:

1. **Always set `max_tokens`** — never allow unbounded output
2. **Always implement prompt caching** for system prompts > 1024 tokens
3. **Always log token usage** — read `usage.input_tokens`, `usage.output_tokens` from response
4. **Rate limit per user** — no unbounded LLM calls per user request
5. **Timeout and retry** — LLM calls can hang; set 30s timeout, retry with exponential backoff (max 3 retries)
6. **Cost kill switch** — implement a per-user or per-day spending cap
7. **Monitor** — write token usage to your analytics/logging system

## Quick Reference: When to Use Each Model

| Task | Model |
|------|-------|
| Classification, routing, simple extraction | Haiku |
| Code generation, analysis, tool use, default | Sonnet |
| Complex reasoning, multi-document synthesis, high-stakes decisions | Opus |
| Embeddings | Use dedicated embedding model (text-embedding-3-small etc.) — not chat models |
