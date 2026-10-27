# Database schema

> Skip this file if the project has no DB. Keep models concise — full DDL lives in migrations.

## Models

### User
- `id` uuid pk
- `email` text unique
- `name` text
- `avatarUrl` text?
- `createdAt` timestamptz default now()

### Channel
- `id` uuid pk
- `name` text
- `isPrivate` bool default false
- `createdById` uuid fk → User
- `createdAt` timestamptz

### Membership
- `userId` uuid fk → User
- `channelId` uuid fk → Channel
- `role` enum(`owner`, `member`)
- pk: (userId, channelId)

### Message
- `id` uuid pk
- `channelId` uuid fk → Channel
- `authorId` uuid fk → User
- `text` text
- `replyToId` uuid? fk → Message
- `createdAt` timestamptz
- `editedAt` timestamptz?
- index: (channelId, createdAt desc)

## Migrations
Live in `prisma/migrations/` (or equivalent). Never edit applied migrations — add new ones.

## Seed
`pnpm db:seed` creates: 1 admin user, 2 channels, 5 sample messages.
