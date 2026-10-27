---
name: audit-logs
description: "Implement audit trail logging for compliance. Track who-did-what with immutable event logs. Use when adding audit logging, compliance tracking, or investigating changes. Also triggers on: 'Track changes', 'Activity log', 'Compliance logging'."
next_skill: null
required_gate: null
skill_id: SK-042
context_budget:
  load_kb: 30
  scope: task
version: 1.0.4
dependencies:
  required: [build]
  optional: [tech-specification]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---
# 📋 Audit Logs Skill

> **Purpose**: Implement comprehensive audit logging for security, compliance, and debugging — runtime events only.
> **Output**: Audit schema, logging middleware, query patterns, retention policies
> **Scope**: Runtime/compliance logging ONLY. For code quality enforcement, see [code-quality](../code-quality/SKILL.md) skill.

---

## 🚨 Initialization & Memory Logic
> [!NOTE]
> **Gated Approach**: Memory initialization handled by [session-management](../session-management/SKILL.md). Gate status checked before skill handoff.

---

## 1. What to Audit

> [!CRITICAL]
> **Audit ALL state-changing operations. This is non-negotiable for compliance.**

### Mandatory Audit Events

| Category | Events |
|----------|--------|
| **Authentication** | Login, logout, failed login, password reset, 2FA enable/disable |
| **Authorization** | Permission granted, permission revoked, role assignment |
| **Data CRUD** | Create, update, delete on sensitive entities |
| **Admin Actions** | User creation, user suspension, config changes |
| **System Events** | Deployment, config reload, maintenance mode |

---

## 2. Audit Log Schema

```typescript
// types/audit.ts
interface AuditLog {
  id: string;                    // UUID
  timestamp: Date;               // ISO 8601
  actor: {
    id: string;                  // User ID or 'system'
    type: 'user' | 'service' | 'system';
    ip?: string;
    userAgent?: string;
  };
  action: string;                // e.g., 'user.create', 'order.update'
  resource: {
    type: string;                // Entity type: 'user', 'order', etc.
    id: string;                  // Entity ID
  };
  changes?: {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
  result: 'success' | 'failure';
  errorMessage?: string;
}
```

### Action Naming Convention
```
[resource].[action]

Examples:
- user.create
- user.update
- user.delete
- auth.login
- auth.logout
- permission.grant
- permission.revoke
- order.status_change
```

---

## 3. Implementation Patterns

### Prisma Middleware
```typescript
// lib/audit/prisma-audit.ts
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';

const AUDITED_MODELS = ['User', 'Order', 'Permission', 'Role'];
const AUDITED_ACTIONS = ['create', 'update', 'delete'];

export const auditMiddleware: Prisma.Middleware = async (params, next) => {
  const { model, action } = params;
  
  if (!AUDITED_MODELS.includes(model) || !AUDITED_ACTIONS.includes(action)) {
    return next(params);
  }

  const session = await getServerSession();
  const before = action === 'update' || action === 'delete' 
    ? await prisma[model].findUnique({ where: params.args.where })
    : null;

  const result = await next(params);

  await prisma.auditLog.create({
    data: {
      action: `${model.toLowerCase()}.${action}`,
      actorId: session?.user?.id ?? 'system',
      actorType: session ? 'user' : 'system',
      resourceType: model,
      resourceId: result?.id ?? params.args.where?.id,
      changesBefore: before ? JSON.stringify(before) : null,
      changesAfter: result ? JSON.stringify(result) : null,
      result: 'success',
    },
  });

  return result;
};
```

### API Route Decorator (Next.js)
```typescript
// lib/audit/with-audit.ts
import { NextRequest, NextResponse } from 'next/server';

export function withAudit(
  action: string,
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const startTime = Date.now();
    let result: 'success' | 'failure' = 'success';
    let errorMessage: string | undefined;

    try {
      const response = await handler(req);
      if (!response.ok) result = 'failure';
      return response;
    } catch (error) {
      result = 'failure';
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      await logAuditEvent({
        action,
        actorId: req.headers.get('x-user-id') ?? 'anonymous',
        ip: req.headers.get('x-forwarded-for') ?? req.ip,
        userAgent: req.headers.get('user-agent'),
        result,
        errorMessage,
        duration: Date.now() - startTime,
      });
    }
  };
}
```

---

## 4. Querying Audit Logs

### Common Queries
```typescript
// Get all actions by a user
const userActions = await prisma.auditLog.findMany({
  where: { actorId: userId },
  orderBy: { timestamp: 'desc' },
  take: 100,
});

// Get all changes to a specific resource
const resourceHistory = await prisma.auditLog.findMany({
  where: { 
    resourceType: 'Order',
    resourceId: orderId,
  },
  orderBy: { timestamp: 'asc' },
});

// Get failed actions (security monitoring)
const failedActions = await prisma.auditLog.findMany({
  where: { 
    result: 'failure',
    timestamp: { gte: subDays(new Date(), 7) },
  },
});
```

---

## 5. Retention & Compliance

### Retention Policies

| Compliance | Minimum Retention | Notes |
|------------|------------------|-------|
| **GDPR** | Until deletion request | Must support right to erasure |
| **SOC 2** | 1 year | Security events |
| **HIPAA** | 6 years | Healthcare data |
| **PCI-DSS** | 1 year | Payment data |
| **Default** | 90 days | General audit |

### Archival Strategy
```typescript
// scripts/archive-audit-logs.ts
async function archiveOldLogs(daysOld: number = 90) {
  const cutoffDate = subDays(new Date(), daysOld);
  
  // Export to cold storage (S3, etc.)
  const logsToArchive = await prisma.auditLog.findMany({
    where: { timestamp: { lt: cutoffDate } },
  });
  
  await uploadToS3(`audit-archive-${format(new Date(), 'yyyy-MM')}.json`, logsToArchive);
  
  // Delete from primary database
  await prisma.auditLog.deleteMany({
    where: { timestamp: { lt: cutoffDate } },
  });
}
```

---

## 6. Sensitive Data Handling

> [!WARNING]
> **NEVER log passwords, tokens, or full credit card numbers.**

### Redaction Rules
```typescript
const REDACT_FIELDS = ['password', 'token', 'secret', 'creditCard', 'ssn'];

function redactSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...data };
  for (const field of REDACT_FIELDS) {
    if (field in redacted) {
      redacted[field] = '[REDACTED]';
    }
  }
  return redacted;
}
```

---

## 7. Memory Integration

After implementing audit logging:
1. Update `AI_DOCS/memory/context-map.md` with audit schema
2. Document retention policy in `milestone-status.md`
3. Cross-reference logged events with Section 13 of `AI_DOCS/planning/tech-spec.md`
4. Add audit queries to admin dashboard backlog

---

## Rules Integration

> Claude Code auto-loads these rules when editing matching files:
> - `.claude/rules/development-rules.md` — architecture, naming
> - `.claude/rules/security-rules.md` — data protection, never log sensitive data
> - `.claude/rules/api-rules.md` — audit endpoint patterns

## Suggested Next Actions
1. Create AuditLog Prisma model
2. Add audit middleware to Prisma client
3. Implement audit query UI for admins

## Next Step
Proceed to `guardrails` skill to ensure AUDIT-001 rules are enforced.
