import type { NextFunction, Request, Response } from 'express';
import type { ZodType, ZodError } from 'zod';
import { ValidationError, type FieldError } from './errors.js';
import type { RouteSchemas } from './route-registry.js';

/**
 * Validated request data.
 *
 * Results do NOT go back onto `req.params` / `req.query`, because Express 5 defines
 * `req.query` as a getter-only property and assigning to it throws.
 *
 * They are held in a WeakMap keyed by the request rather than on a `req.validated`
 * property, which avoids augmenting Express's global Request type and means no handler
 * or third-party middleware can fabricate "validated" data: the only way in is through
 * `validate()`. Entries are collected with the request object.
 */
export type ValidatedRequestData<Params = unknown, Query = unknown, Body = unknown> = {
  readonly params: Params;
  readonly query: Query;
  readonly body: Body;
};

const store = new WeakMap<Request, ValidatedRequestData>();

const toFieldErrors = (error: ZodError, source: string): FieldError[] =>
  error.issues.map((issue) => ({
    // Qualify with the source so `body.email` and `query.email` are distinguishable.
    field: [source, ...issue.path.map(String)].join('.'),
    message: issue.message,
    code: issue.code,
  }));

/**
 * Builds middleware that validates whichever of params/query/body have a schema.
 *
 * All three are checked before rejecting, so the client receives every field problem in
 * one response instead of discovering them one request at a time.
 */
export const validate = (schemas: RouteSchemas) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: FieldError[] = [];
    let params: unknown = req.params;
    let query: unknown = req.query;
    let body: unknown = req.body;

    const check = (
      schema: ZodType | undefined,
      source: 'params' | 'query' | 'body',
      raw: unknown,
      assign: (value: unknown) => void,
    ): void => {
      if (schema === undefined) {
        return;
      }
      const result = schema.safeParse(raw);
      if (result.success) {
        assign(result.data);
      } else {
        errors.push(...toFieldErrors(result.error, source));
      }
    };

    check(schemas.params, 'params', req.params, (value) => {
      params = value;
    });
    check(schemas.query, 'query', req.query, (value) => {
      query = value;
    });
    check(schemas.body, 'body', req.body, (value) => {
      body = value;
    });

    if (errors.length > 0) {
      // The messages name fields and constraints, never the rejected values: a bad
      // body may contain patient data and a response is not a safe place for it.
      next(new ValidationError('request validation failed', 'The request is invalid.', errors));
      return;
    }

    store.set(req, { params, query, body });
    next();
  };
};

/** Reads validated data, throwing if `validate` did not run for this route. */
export const validatedData = <Params = unknown, Query = unknown, Body = unknown>(
  req: Request,
): ValidatedRequestData<Params, Query, Body> => {
  const data = store.get(req);
  if (data === undefined) {
    throw new Error('validatedData called on a route without validate() middleware');
  }
  return data as ValidatedRequestData<Params, Query, Body>;
};
