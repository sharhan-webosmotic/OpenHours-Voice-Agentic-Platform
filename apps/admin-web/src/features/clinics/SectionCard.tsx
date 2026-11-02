import type { ReactNode } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Table';

/**
 * One editable configuration section.
 *
 * The chrome is here rather than in each of the nine sections because every one of them
 * needs the same four things and would otherwise forget one: a heading, the gap count for
 * this section, a save control that reports pending and failure, and the read-only state a
 * role without write permission sees.
 *
 * READ-ONLY IS A FIRST-CLASS STATE, not a disabled form. An INTERNAL_ADMIN may read a
 * clinic's services and doctors and may not change them, because the matrix gives that role
 * read on `doctors_services_hours`. Rendering the form with a dead button would invite them
 * to type into it and lose the work; saying so up front does not. Hiding the control is
 * cosmetic either way: the API refuses the write.
 */
export const SectionCard = ({
  id,
  title,
  description,
  missingCount,
  canWrite,
  saving,
  error,
  success,
  onSubmit,
  submitDisabled = false,
  children,
}: {
  /**
   * Anchor target, so the readiness panel can link to the section that closes a gap.
   *
   * A `ReadinessSection` for the eight sections readiness tracks, and a plain name for the
   * one it does not: frequently asked answers are worth collecting and are not required
   * before go-live, because a clinic with no stored answers has an agent that says it will
   * check rather than one that invents an answer.
   */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly missingCount: number;
  readonly canWrite: boolean;
  readonly saving: boolean;
  readonly error?: string | undefined;
  readonly success?: string | undefined;
  /** Omitted for a section that saves through its own controls, such as services. */
  readonly onSubmit?: (() => void) | undefined;
  /**
   * Blocks the save without hiding it.
   *
   * Used by the one section whose save can be destructive: changing a clinic's status to
   * suspended or deactivated requires a confirmation first, and a button that disappears
   * until a box is ticked is harder to understand than one that is visibly unavailable.
   */
  readonly submitDisabled?: boolean | undefined;
  readonly children: ReactNode;
}) => {
  const body = (
    <div className="flex flex-col gap-4">
      {error !== undefined && <Alert kind="danger">{error}</Alert>}
      {success !== undefined && <Alert kind="success">{success}</Alert>}

      {children}

      {onSubmit !== undefined && canWrite && (
        <div>
          <Button type="submit" loading={saving} disabled={submitDisabled}>
            Save {title.toLowerCase()}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <Card className="scroll-mt-6">
      {/* The id sits on a heading wrapper rather than on the Card, so the anchor lands
          above the heading rather than mid-section. */}
      <div id={id} className="mb-4 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-md font-semibold text-default">{title}</h2>
          <p className="m-0 max-w-prose text-xs text-muted">{description}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {missingCount > 0 ? (
            <Badge kind="warning">{missingCount} still needed</Badge>
          ) : (
            <Badge kind="success">Complete</Badge>
          )}
        </div>
      </div>

      {!canWrite && (
        <div className="mb-4">
          <Alert kind="info">
            Your role can read this section but not change it. A super admin can.
          </Alert>
        </div>
      )}

      {onSubmit === undefined ? (
        body
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          noValidate
        >
          {body}
        </form>
      )}
    </Card>
  );
};
