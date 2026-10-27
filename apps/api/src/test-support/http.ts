import type { Response } from 'supertest';
import type { FieldError } from '../common/errors.js';

/**
 * supertest types `response.body` as `any`, which defeats the type-aware lint rules
 * and hides typos in assertions. These helpers give it a shape once, so tests assert
 * against real types.
 */

export type ProblemBody = {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly requestId?: string;
  readonly errors?: readonly FieldError[];
};

export const problemBody = (response: Response): ProblemBody => response.body as ProblemBody;

export const fieldErrors = (response: Response): readonly FieldError[] =>
  problemBody(response).errors ?? [];

export const jsonBody = <T>(response: Response): T => response.body as T;
