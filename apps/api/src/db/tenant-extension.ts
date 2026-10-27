import { CrossTenantWriteError, TenantScopeMissingError } from './errors.js';
import { ORGANISATION_MODEL, TENANT_MODELS } from './tenant-models.js';
import { currentScope } from './tenant-scope.js';

/**
 * The tenant isolation extension, kept free of config and of client construction.
 *
 * Separate module so tests (and anything else) can exercise the rules without importing
 * src/config.ts, which validates the environment at import time and would demand a
 * DATABASE_URL just to read the logic.
 *
 * NOTE ON TYPES: Prisma's generated `create` input requires organisationId, so callers
 * pass it and this extension VERIFIES it matches the active scope. For `where`, which is
 * optional in the generated types, the extension genuinely INJECTS the scope. The
 * verification is the security property; the injection is the convenience.
 */

/** Operations whose `where` identifies which rows are touched. */
const WHERE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
]);

/** Operations that write new rows and therefore need organisation_id in `data`. */
const CREATE_OPERATIONS = new Set(['create', 'createMany', 'createManyAndReturn', 'upsert']);

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  typeof value === 'object' && value !== null ? (value as UnknownRecord) : {};

/**
 * Rejects input that names a different organisation instead of silently overwriting it.
 *
 * Overwriting would be safe but would hide a caller that believes it is writing
 * somewhere else, and root CLAUDE.md rule 2 says organisation never comes from input.
 */
const assertSameOrganisation = (value: unknown, organisationId: string, what: string): void => {
  if (value !== undefined && value !== organisationId) {
    throw new CrossTenantWriteError(`${what} names another organisation`);
  }
};

const scopeWhere = (
  args: UnknownRecord,
  field: string,
  organisationId: string,
  model: string,
  isOrganisationModel: boolean,
): UnknownRecord => {
  const where = asRecord(args.where);
  const supplied = where[field];

  if (isOrganisationModel) {
    /**
     * Organisation is scoped by its PRIMARY KEY, so `where.id` is also the ordinary way
     * to fetch one by id. Rejecting a foreign id here would answer a cross-tenant read
     * with an error, when root CLAUDE.md rule 7 requires NotFound: an error that only
     * appears for rows that exist is itself a disclosure.
     *
     * So the scope is injected only when the caller gave no id. With an id supplied,
     * the query goes to the database and row-level security returns no rows, which the
     * repository surfaces as NotFound.
     */
    if (supplied === undefined) {
      return { ...args, where: { ...where, [field]: organisationId } };
    }
    return args;
  }

  // Every other model: organisation_id must never come from input (rule 2). A caller
  // naming another organisation is a bug or an attack, and is told so.
  assertSameOrganisation(supplied, organisationId, `${model}.where.${field}`);
  return { ...args, where: { ...where, [field]: organisationId } };
};

const scopeCreateData = (
  args: UnknownRecord,
  organisationId: string,
  model: string,
): UnknownRecord => {
  const data = args.data;

  if (Array.isArray(data)) {
    return {
      ...args,
      data: data.map((row) => {
        const record = asRecord(row);
        assertSameOrganisation(record.organisationId, organisationId, `${model}.data`);
        return { ...record, organisationId };
      }),
    };
  }

  if (data === undefined) {
    return args;
  }

  const record = asRecord(data);
  assertSameOrganisation(record.organisationId, organisationId, `${model}.data`);
  return { ...args, data: { ...record, organisationId } };
};

/**
 * Prisma's $allOperations hook, typed structurally.
 *
 * The real signature is a union across every model and operation, which cannot be named
 * without enumerating all of them. `unknown` for args is honest and still safe: this
 * code only ever reads and sets `where` and `data`, both validated before use.
 */
type OperationParams = {
  readonly model?: string;
  readonly operation: string;
  readonly args: unknown;
  readonly query: (args: unknown) => Promise<unknown>;
};

export const buildTenantExtension = () => ({
  name: 'tenant-isolation',
  query: {
    $allModels: {
      $allOperations: ({ model, operation, args, query }: OperationParams): Promise<unknown> => {
        const scope = currentScope();

        if (scope === undefined) {
          throw new TenantScopeMissingError(`${String(model)}.${String(operation)}`);
        }

        // Platform scope is explicitly cross-organisation, so nothing is injected. The
        // database still applies app.platform = 'on', and every entry is audited.
        if (scope.kind === 'platform') {
          return query(args);
        }

        const modelName = String(model);
        const operationName = String(operation);
        let next = asRecord(args);

        const field =
          modelName === ORGANISATION_MODEL
            ? 'id'
            : TENANT_MODELS.has(modelName)
              ? 'organisationId'
              : undefined;

        if (field === undefined) {
          // A model with no organisation column and not Organisation: refuse rather than
          // pass it through unscoped, so a new model cannot slip past this lock.
          throw new TenantScopeMissingError(
            `${modelName} is not a known tenant model; add it to TENANT_MODELS`,
          );
        }

        if (WHERE_OPERATIONS.has(operationName)) {
          next = scopeWhere(
            next,
            field,
            scope.organisationId,
            modelName,
            modelName === ORGANISATION_MODEL,
          );
        }

        if (CREATE_OPERATIONS.has(operationName) && modelName !== ORGANISATION_MODEL) {
          next = scopeCreateData(next, scope.organisationId, modelName);
        }

        if (operationName === 'upsert') {
          const create = next.create;
          if (create !== undefined && modelName !== ORGANISATION_MODEL) {
            const record = asRecord(create);
            assertSameOrganisation(
              record.organisationId,
              scope.organisationId,
              `${modelName}.create`,
            );
            next = { ...next, create: { ...record, organisationId: scope.organisationId } };
          }
        }

        return query(next);
      },
    },
  },
});
