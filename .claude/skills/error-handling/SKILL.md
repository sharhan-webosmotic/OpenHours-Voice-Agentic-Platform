---
name: error-handling
description: "Specialized skill for the error/resilience/logging layer: implement React error boundaries, global error handlers, structured logging (Sentry/Pino/Winston/Bunyan), user-friendly error messages, retry-with-backoff patterns, fallback UI, exception strategy. Use specifically when the task is about error handling, resilience, fallbacks, observability/logging setup, or any failure-path infrastructure. Prefer this OVER build whenever the work is error/logging/resilience-specific: build is for generic coding, this is the error/resilience specialist. Also triggers on: 'Add error handling', 'Error logging'."
mcp_integrations: [sentry]
next_skill: null
required_gate: null
skill_id: SK-040
context_budget:
  load_kb: 30
  scope: task
version: 1.2.2
dependencies:
  required: [build]
  optional: [audit-logs]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

> **Comments & docs:** Docstrings/JSDoc on every function. No inline comments except a one-line *why* for genuinely complex logic (calculations, time conversions, deliberate workarounds). No commented-out code. Put rationale, decisions, and feature context in `AI_DOCS/planning/` + `AI_DOCS/memory/decision-log.md` and keep it updated in the same change. Full policy: `.claude/rules/development-rules.md` -> Code Comments & Documentation.
# 🚨 Error Handling Skill

> **Purpose**: Graceful error handling with logging and user recovery
> **Output**: Error boundaries, logging setup, user-friendly messages

## MCP Acceleration

Per `.claude/rules/mcp-rules.md`, use these MCP servers to work faster (free servers are auto-provisioned in the project `.mcp.json`, and gated servers need approval + `${ENV_VAR}` credentials). Wire the stack-conditional ones only when that technology is in `stack.md`:

- `sentry` (gated): configure error monitoring and inspect live issues and dashboards while wiring resilience.

Target the dev environment. Treat staging/production access as a separate approved step.

---

## 🚨 Initialization & Memory Logic
> [!NOTE]
> **Gated Approach**: Memory initialization handled by [session-management](../session-management/SKILL.md). Gate status checked before skill handoff.

---

## 1. Error Categories

| Category | HTTP Code | User Impact | Recovery |
|----------|-----------|-------------|----------|
| Validation | 400 | Inline feedback | Fix input |
| Authentication | 401 | Redirect to login | Re-authenticate |
| Authorization | 403 | Access denied message | Request access |
| Not Found | 404 | 404 page | Navigate elsewhere |
| Server Error | 500 | Error page + retry | Retry/refresh |
| Network | - | Toast + retry | Retry button |

---

## 2. React Error Boundaries

### Global Error Boundary
```tsx
// components/ErrorBoundary.tsx
'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Error caught:', error, info);
    // Send to error tracking (Sentry, etc.)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

### Error Fallback UI
```tsx
// components/ErrorFallback.tsx
export const ErrorFallback = ({ 
  error, 
  resetError 
}: { 
  error?: Error; 
  resetError?: () => void;
}) => (
  <div className="error-container">
    <h1>Something went wrong</h1>
    <p>We're sorry for the inconvenience. Please try again.</p>
    {resetError && (
      <button onClick={resetError}>Try Again</button>
    )}
    {process.env.NODE_ENV === 'development' && error && (
      <pre>{error.message}</pre>
    )}
  </div>
);
```

---

## 3. API Error Handling

### Standardized Error Response
```typescript
// types/api.ts
interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
  requestId?: string;
}

// Example response
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid input data",
  "details": {
    "email": ["Email format is invalid"],
    "password": ["Password must be at least 8 characters"]
  },
  "requestId": "req_abc123"
}
```

### Error Handler Middleware
```typescript
// middleware/errorHandler.ts
export const errorHandler = (
  err: Error, 
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  const requestId = crypto.randomUUID();
  
  // Log error
  console.error({
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Determine status code
  const statusCode = err instanceof ValidationError ? 400
    : err instanceof UnauthorizedError ? 401
    : err instanceof ForbiddenError ? 403
    : err instanceof NotFoundError ? 404
    : 500;

  // Send response
  res.status(statusCode).json({
    code: err.name || 'SERVER_ERROR',
    message: statusCode === 500 ? 'Internal server error' : err.message,
    requestId,
  });
};
```

---

## 4. User-Friendly Messages

### Error Message Mapping
```typescript
// lib/errors/messages.ts
export const errorMessages: Record<string, string> = {
  VALIDATION_ERROR: 'Please check your input and try again.',
  UNAUTHORIZED: 'Please sign in to continue.',
  FORBIDDEN: 'You don\'t have permission to access this.',
  NOT_FOUND: 'The requested resource was not found.',
  RATE_LIMITED: 'Too many requests. Please wait a moment.',
  NETWORK_ERROR: 'Unable to connect. Please check your internet.',
  SERVER_ERROR: 'Something went wrong. Please try again later.',
};

export const getUserMessage = (code: string): string => {
  return errorMessages[code] || errorMessages.SERVER_ERROR;
};
```

---

## 5. Error Logging

### Structured Logging
```typescript
// lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
});

// Usage
logger.error({
  err: error,
  requestId,
  userId: user?.id,
  action: 'createOrder',
}, 'Failed to create order');
```

### Error Tracking (Sentry)
```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

export const captureError = (error: Error, context?: Record<string, unknown>) => {
  Sentry.captureException(error, { extra: context });
};
```

---

## 6. Recovery Patterns

### Retry with Exponential Backoff
```typescript
// lib/retry.ts
export const retry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
    }
  }
  throw new Error('Max retries reached');
};
```

---

## Rules Integration

> Claude Code auto-loads these rules when editing matching files:
> - `.claude/rules/development-rules.md` — error handling patterns, custom error classes
> - `.claude/rules/security-rules.md` — never expose stack traces, generic auth errors

## Suggested Next Actions
1. Set up error boundary in app root
2. Create API error handler middleware
3. Configure error tracking (Sentry)

## Next Step
Proceed to the next skill in the workflow as indicated in the YAML frontmatter.
