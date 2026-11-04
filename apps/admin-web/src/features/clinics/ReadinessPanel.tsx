import type { ReadinessView } from '@clinicai/api-client';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Table';

/**
 * What is still missing before this clinic's voice agent can take a real call.
 *
 * ADVISORY, AND IT SAYS SO. Nothing here blocks a save: configuration is collected over
 * several conversations and a half-collected clinic is a legitimate stored state. What this
 * prevents is somebody believing a clinic is live when its opening hours have never been
 * asked about.
 *
 * IT NAMES THE GAP AND LINKS TO THE FORM THAT CLOSES IT. A checklist of field names a
 * person then has to go hunting for is a checklist nobody finishes, so each item is a
 * sentence in the language we would use on the telephone to the clinic, and each links to
 * its section.
 *
 * THE LIST COMES FROM THE SERVER, which computes it from the one declared set of
 * requirements in `packages/shared`. There is no second opinion here about what "ready"
 * means: the same function answers the console, the API response and `pnpm prompt:render`.
 */
export const ReadinessPanel = ({ readiness }: { readonly readiness: ReadinessView }) => (
  <Card>
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-md font-semibold text-default">Readiness</h2>
          <p className="m-0 text-xs text-muted">
            {readiness.ready
              ? 'Everything we need has been collected. The remaining steps are in Sarvam and are done by hand.'
              : 'Collected so far. Nothing here stops you saving: a clinic is configured over several conversations.'}
          </p>
        </div>

        {readiness.ready ? (
          <Badge kind="success">Ready to go live</Badge>
        ) : (
          <Badge kind="warning">Not ready</Badge>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/*
          A progress bar AND the numbers. The bar is the glance and the numbers are the
          fact, because progress carried by a bar alone is unreadable to a screen reader
          and imprecise to everyone else.
        */}
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-background"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={readiness.totalCount}
          aria-valuenow={readiness.satisfiedCount}
          aria-label="Configuration requirements met"
        >
          <div
            className={readiness.ready ? 'h-full bg-success' : 'h-full bg-accent'}
            style={{ width: `${String((readiness.satisfiedCount / readiness.totalCount) * 100)}%` }}
          />
        </div>
        <span className="shrink-0 font-semibold text-xs text-default">
          {readiness.satisfiedCount} of {readiness.totalCount}
        </span>
      </div>

      {readiness.missing.length > 0 && (
        <div className="flex flex-col gap-2">
          <strong className="font-semibold text-xs text-default">Still needed</strong>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {readiness.missing.map((requirement) => (
              <li key={requirement.key} className="text-xs text-muted">
                <a href={`#${requirement.section}`} className="text-default hover:underline">
                  {requirement.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  </Card>
);
