import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 removed `url` from the datasource block, so migrate and introspect read the
 * connection from here. The running API never loads this file: it is read only by the
 * Prisma CLI, and the API's own connection string still comes from src/config.ts, which
 * remains the only reader of process.env in the application itself.
 *
 * Both URLs are attached only when present, because `prisma generate` runs during the
 * build and must not require a database. Prisma's own `env()` helper throws eagerly,
 * which would break that.
 *
 * SHADOW_DATABASE_URL is set by prisma/create-migration.ts to a throwaway container, so
 * `migrate diff --from-migrations` can replay history without a persistent shadow
 * database and without `migrate dev`, which would offer to reset the real one.
 */
const databaseUrl = process.env.DATABASE_URL;
const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;

const datasource = {
  ...(databaseUrl === undefined ? {} : { url: databaseUrl }),
  ...(shadowDatabaseUrl === undefined ? {} : { shadowDatabaseUrl }),
};

export default defineConfig({
  schema: 'prisma/schema.prisma',
  ...(Object.keys(datasource).length === 0 ? {} : { datasource }),
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
