/**
 * Errors are AppError subclasses rendered as RFC 7807 problem+json (root CLAUDE.md).
 * Only the few subclasses this skeleton needs exist; the rest arrive with real routes.
 */
export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly type: string;
  abstract readonly title: string;

  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ServiceUnavailableError extends AppError {
  readonly status = 503;
  readonly type = 'https://openhours.health/problems/service-unavailable';
  readonly title = 'Service Unavailable';
}
