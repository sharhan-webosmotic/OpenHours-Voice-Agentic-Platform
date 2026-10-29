import { join } from 'node:path';
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
/**
 * Loads `.env` for the Prisma CLI, which is the one caller of this file.
 *
 * Nothing in this repository loaded `.env` before, so `pnpm db:migrate`, `pnpm db:seed`
 * and `pnpm provision:clinic` all failed on a fresh shell with "expected string, received
 * undefined", and so did `pnpm --filter @clinicai/api dev`. The documented local setup
 * could not be followed. Prisma 7 stopped reading `.env` itself once a `prisma.config.ts`
 * exists, which is what removed it.
 *
 * `process.loadEnvFile` is built into Node 22, so this costs no dependency. It is here and
 * not in `src/config.ts`: the running API must keep taking its environment from the process,
 * because in production there is no `.env` and the values come from the secret manager.
 * This file is a development-time tool that the API never loads.
 *
 * Absent or unreadable is not an error. `prisma generate` runs during the build, where there
 * is no `.env` and no database, and must still work.
 */
for (const candidate of [
  join(import.meta.dirname, '../../.env'),
  join(import.meta.dirname, '.env'),
]) {
  try {
    // The repository keeps one `.env` at the root, which is also where docker compose reads
    // it from. An `apps/api/.env` is honoured second so it can override for one developer.
    process.loadEnvFile(candidate);
  } catch {
    // Absent or unreadable is fine, and must be: `prisma generate` runs during the build,
    // where there is no `.env` and no database, and still has to work.
  }
}

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
