# API surface

> One line per endpoint. The contract. Once an endpoint is listed, its method + path + request/response shape is locked. API changes require an entry in decision-log.md.

| Method | Path | Auth | Request body | Response | Notes |
|--------|------|------|--------------|----------|-------|
| POST   | /auth/signup       | public | `{email}` | `{ok, sentLink}` | magic link sent |
| POST   | /auth/verify       | public | `{token}` | `{user, sessionToken}` | sets session cookie |
| POST   | /auth/logout       | session | — | `{ok}` | |
| GET    | /me                | session | — | `{user}` | |
| GET    | /channels          | session | — | `Channel[]` | |
| POST   | /channels          | session | `{name, isPrivate}` | `Channel` | |
| GET    | /channels/:id/messages | session | `?cursor&limit` | `{items, nextCursor}` | paginated |
| POST   | /channels/:id/messages | session | `{text, replyTo?}` | `Message` | broadcasts via WS |

## Error contract
All errors return: `{error: {code, message, details?}}`
Standard codes: `unauthorized | forbidden | not_found | validation | conflict | rate_limited | internal`

## WebSocket events (if any)
- `message:new` `{channelId, message}`
- `message:edit` `{channelId, messageId, text}`
- `presence:update` `{userId, status}`
