# API Contract

**Version**: 1.0.0
**Status**: DRAFT | LOCKED (after Gate 1 approval)
**Last updated**: [YYYY-MM-DD]
**Gate**: Gate 1 — SA-ARCH required before LOCK

---

> ⚠️ This file is LOCKED after Gate 1 approval. Any modification requires a Change Request (CR) and re-running the SA-ARCH gate.

---

## Base URL

```
Development:  http://localhost:3000/api
Staging:      https://api-staging.[project].com/api
Production:   https://api.[project].com/api
```

## Authentication

```
Type: Bearer Token (JWT)
Header: Authorization: Bearer <token>
Token expiry: 15 minutes (access), 7 days (refresh)
```

## Standard Response Envelope

All responses follow this structure:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {
    "timestamp": "2026-04-14T12:00:00Z",
    "requestId": "uuid"
  }
}
```

Error response:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": []
  }
}
```

## Endpoints

---

### Auth

#### POST /auth/register
**Auth required**: No
**Request**:
```json
{
  "email": "string (required, valid email)",
  "password": "string (required, min 8 chars)",
  "name": "string (required)"
}
```
**Response 201**:
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "string", "name": "string" },
    "token": "string",
    "refreshToken": "string"
  }
}
```
**Errors**: 400 (validation), 409 (email exists)

---

#### POST /auth/login
**Auth required**: No
**Request**:
```json
{
  "email": "string",
  "password": "string"
}
```
**Response 200**:
```json
{
  "success": true,
  "data": {
    "token": "string",
    "refreshToken": "string",
    "user": { "id": "uuid", "email": "string", "name": "string" }
  }
}
```
**Errors**: 401 (invalid credentials), 429 (rate limited)

---

### [Resource Name]

#### GET /[resource]
**Auth required**: Yes
**Query params**: `page` (int, default 1), `limit` (int, default 20, max 100)
**Response 200**:
```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "pages": 5
    }
  }
}
```

---

## Error Codes

| Code | HTTP Status | Meaning |
|------|------------|---------|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Duplicate resource |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limits

| Endpoint Group | Limit |
|---------------|-------|
| Auth endpoints | 10 req/minute per IP |
| General API | 100 req/minute per user |
| File upload | 10 req/minute per user |
