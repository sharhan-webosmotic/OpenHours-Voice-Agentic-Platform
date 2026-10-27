import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 removed `url` from the datasource block, so migrate and introspect read the
 * connection from here. The running API never loads this file: it is read only by the
 * Prisma CLI, and the API's own connection string still comes from src/config.ts, which
 * remains the only reader of process.env in the application itself.
 *
 * The datasource is attached only when DATABASE_URL is present, because `prisma generate`
 * runs during the build and must not require a database. Prisma's own `env()` helper
 * throws eagerly, which would break that.
 */
const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  ...(databaseUrl === undefined ? {} : { datasource: { url: databaseUrl } }),
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
