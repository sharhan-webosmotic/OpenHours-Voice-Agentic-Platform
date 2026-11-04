import { CrossTenantWriteError, TenantScopeMissingError } from './errors.js';
import { JSON_FIELDS, ORGANISATION_MODEL, TENANT_MODELS } from './tenant-models.js';
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
  // Missing until the Feature 3 review (I2): under the platform-organisation scope it updated
  // and returned another clinic's rows, because nothing injected its `where`.
  'updateManyAndReturn',
  'delete',
  'deleteMany',
  'upsert',
]);

/** Operations that write new rows and therefore need organisation_id in `data`. */
const CREATE_OPERATIONS = new Set(['create', 'createMany', 'createManyAndReturn', 'upsert']);

/**
 * EVERY OPERATION THIS EXTENSION KNOWS HOW TO CONFINE, and nothing else is let through.
 *
 * The list used to be consulted only to decide what to inject, so an operation missing from it
 * was simply passed on unscoped: `updateManyAndReturn` was, and changed another clinic's rows
 * (review I2). Now an operation that is not here is REFUSED on a confined scope, so the next
 * query shape Prisma adds fails loudly in the first test that uses it instead of quietly
 * crossing a tenant. `tenant-extension.test.ts` asserts this covers every operation the
 * generated client declares.
 */
export const CONFINED_OPERATIONS: ReadonlySet<string> = new Set([
  ...WHERE_OPERATIONS,
  ...CREATE_OPERATIONS,
]);

/** Operations whose `data` (or an upsert's `create` and `update`) is written to rows. */
const DATA_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
]);

/**
 * The operators that write THROUGH a relation, inside `data`.
 *
 * `set` is not in this list because it is also the scalar update operator; it is handled
 * below by the shape of its value.
 */
const RELATION_WRITE_KEYS = new Set([
  'connect',
  'connectOrCreate',
  'create',
  'createMany',
  'delete',
  'deleteMany',
  'disconnect',
  'update',
  'updateMany',
  'upsert',
]);

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  typeof value === 'object' && value !== null ? (value as UnknownRecord) : {};

/**
 * An existing `AND` as a list, so a caller's own conditions are kept rather than replaced.
 *
 * Prisma accepts `AND` as either one condition or an array of them, and overwriting it would
 * silently widen a query the caller deliberately narrowed.
 */
const toConditionList = (value: unknown): readonly unknown[] => {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

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

/** A literal object, as opposed to a Date, a Decimal, an array or null. */
const isPlainObject = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

/**
 * Whether a field's value in `data` writes through a relation.
 *
 * A relation `set` takes unique-where objects, while a scalar `set` takes a plain value, a
 * Date or a list of plain values, so the shape tells them apart.
 */
const isRelationWrite = (value: unknown): boolean =>
  isPlainObject(value) &&
  Object.entries(value).some(
    ([key, inner]) =>
      RELATION_WRITE_KEYS.has(key) ||
      (key === 'set' &&
        (isPlainObject(inner) || (Array.isArray(inner) && inner.some(isPlainObject)))),
  );

/**
 * REFUSES A NESTED RELATION WRITE, because nothing here can confine it (review I3).
 *
 * This extension sees the top-level operation only. `appointment.update({ data: { patient: {
 * connect: { id } } } })` names a patient the injection never looks at, and under the
 * platform-organisation scope, where row-level security is off, it linked one clinic's
 * appointment to another clinic's patient. No repository uses a nested write, so refusing them
 * costs nothing today and keeps a later one from becoming a hole. Write the child row with its
 * own top-level call, which this extension does scope.
 */
const assertNoNestedWrites = (data: unknown, where: string): void => {
  const rows = Array.isArray(data) ? data : [data];

  for (const row of rows) {
    if (!isPlainObject(row)) {
      continue;
    }

    for (const [field, value] of Object.entries(row)) {
      if (!JSON_FIELDS.has(field) && isRelationWrite(value)) {
        throw new CrossTenantWriteError(
          `${where}.${field} is a nested relation write, which the tenant scope cannot confine`,
        );
      }
    }
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
     * With no id supplied, the scope is injected and that is the whole story.
     */
    if (supplied === undefined) {
      return { ...args, where: { ...where, [field]: organisationId } };
    }

    /**
     * WITH AN ID SUPPLIED, THE SCOPE IS ADDED AS A SECOND CONDITION RATHER THAN TRUSTED.
     *
     * This used to pass straight through, on the reasoning that row-level security would
     * return no rows for a foreign id. That reasoning held for exactly as long as every
     * cross-tenant read ran with row-level security ON. `asOrganisationSystem` (D-017) sets
     * `app.platform = 'on'`, which switches it off, so `organisation.findUnique({ where: {
     * id: someoneElse } })` returned the other clinic's row: measured, not theorised.
     *
     * An `AND` on the scoped id makes a mismatch match nothing, so the answer is still the
     * null that rule 7 wants, with no error and no disclosure. It costs one redundant
     * predicate on the clinic path, where the ids are equal and the planner drops it.
     */
    return {
      ...args,
      where: {
        ...where,
        AND: [...toConditionList(where.AND), { [field]: organisationId }],
      },
    };
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

        /**
         * Unbounded platform scope is explicitly cross-organisation, so nothing is injected.
         * The database still applies app.platform = 'on', and every entry is audited.
         *
         * `platform-organisation` is NOT this case: it names one clinic and falls through to
         * the injection below, so a platform read of a clinic's patients is confined by the
         * same lock a clinic user's read is. That is the whole reason the kind exists.
         */
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

        if (!CONFINED_OPERATIONS.has(operationName)) {
          throw new TenantScopeMissingError(
            `${modelName}.${operationName} is not an operation the tenant extension confines`,
          );
        }

        if (DATA_OPERATIONS.has(operationName)) {
          assertNoNestedWrites(next.data, `${modelName}.data`);
          assertNoNestedWrites(next.create, `${modelName}.create`);
          assertNoNestedWrites(next.update, `${modelName}.update`);
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
