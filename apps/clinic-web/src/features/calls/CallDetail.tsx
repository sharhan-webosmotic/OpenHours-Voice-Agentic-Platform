import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { CallView } from '@clinicai/api-client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Overlay } from '../../components/ui/Overlay';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Table';
import { useCan } from '../../lib/useCan';
import { errorMessage } from '../../lib/problem';
import { formatDate, formatTime } from '../../lib/clinicTime';
import { useCallQuery, useCallRecordingUrlMutation } from './api';
import {
  callerLabel,
  directionLabel,
  durationLabel,
  outcomeLabel,
  statusBadge,
  statusLabel,
} from './status';

/**
 * One call, in the drawer from `docs/prototype/laptop-15-call-detail.png`.
 *
 * The capture's structure is kept: the eyebrow, the caller as the title, a highlighted card
 * at the top, then labelled detail rows, then the actions stacked at full width.
 *
 * ─── WHAT THE CAPTURE PROMISES THAT THE PLATFORM CANNOT KEEP ────────────────────
 *
 * The prototype's own banner says it: "AI call records and summaries are fictional." Four of
 * the things in that drawer are fiction, and each is handled by saying so rather than by
 * leaving a hole or by inventing a value:
 *
 * 1. **The conversation summary.** Nothing generates one. The card keeps its place and says
 *    there is no summary, because a summary of a clinical conversation invented by this
 *    screen would be read as the clinic's own record of the call.
 * 2. **Call type** ("New patient", "Reschedule"). No such field, and deriving one from a
 *    transcript is an inference the clinic would act on. Direction is shown instead.
 * 3. **Required action and "Mark as reviewed".** There is no review state on a call. The
 *    control is rendered as the capture draws it and visibly disabled, which is the same
 *    arrangement as the header's search box: a missing control is a visible difference from
 *    the prototype, a working-looking one is a lie, and disabled is neither.
 * 4. **"Create follow-up".** Follow-ups were left out of this feature entirely, so the same
 *    treatment.
 *
 * ─── WHAT IT ADDS THAT THE CAPTURE DOES NOT HAVE ────────────────────────────────
 *
 * The transcript and the recording, agreed as an addition, built in the drawer's own idiom.
 * Both have real states rather than a spinner that never ends: a transcript may be empty
 * because the provider had not written it when the call was ingested, and a recording may be
 * absent because consent was declined or because the copy has not run yet. The screen says
 * which, because "no audio" and "not yet" are different things to a receptionist.
 */

const Field = ({ label, children }: { readonly label: string; readonly children: ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 border-border border-b py-3 last:border-b-0">
    <span className="font-semibold text-[0.6875rem] text-muted uppercase tracking-wide">
      {label}
    </span>
    <span className="text-right font-semibold text-default text-xs">{children}</span>
  </div>
);

/** A control the prototype draws and the platform cannot yet honour. See the note above. */
const NotYet = ({ label, children }: { readonly label: string; readonly children: string }) => (
  <button
    type="button"
    disabled
    aria-disabled="true"
    title={children}
    className="w-full cursor-not-allowed rounded-md border border-border bg-background px-4 py-2.5 text-center font-semibold text-muted text-xs"
  >
    {label}
    <span className="ml-2 rounded-full bg-surface px-2 py-0.5 font-semibold text-[0.625rem] text-subtle uppercase">
      Soon
    </span>
  </button>
);

export const CallDetail = ({
  call,
  timeZone,
  onClose,
}: {
  readonly call: CallView;
  readonly timeZone: string;
  readonly onClose: () => void;
}) => {
  const detail = useCallQuery(call.id);
  const canHearRecording = useCan('recordings', 'read');
  const [mintUrl, minting] = useCallRecordingUrlMutation();
  const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);
  const [audioError, setAudioError] = useState<string | undefined>(undefined);

  const started = call.startedAt ?? call.createdAt;

  return (
    <Overlay variant="drawer" title={callerLabel(call)} eyebrow="AI call details" onClose={onClose}>
      <div className="flex flex-col gap-5">
        {/*
         * ONLY for a call Sarvam's own records do not hold (D-006, checked after the call
         * arrived). Not for one that has not been checked yet, and never for a call that simply
         * has no recording: a clinic that does not record would see it on every call, and staff
         * would learn to ignore the one time it matters.
         */}
        {call.verification === 'NOT_FOUND' && (
          <Alert kind="warning">
            Sarvam has no record of this call, so it may not have come through the clinic's voice
            agent. Treat its transcript with caution, and confirm with the caller before acting on
            it.
          </Alert>
        )}

        <div className="flex flex-col gap-2 rounded-lg bg-accent-surface p-4">
          <Badge kind={statusBadge(call.status)}>{statusLabel(call.status)}</Badge>
          <strong className="font-semibold text-default text-md">Conversation summary</strong>
          <p className="m-0 text-muted text-xs">
            {/*
             * Not a summary, and not an empty box pretending to be one. The prototype's own
             * banner admits its summaries are fictional; this says what exists instead.
             */}
            No summary is generated for a call. The transcript below is what was said, as the
            provider recorded it.
          </p>
        </div>

        <div>
          <Field label="Timestamp">
            {formatDate(started, timeZone)}, {formatTime(started, timeZone)}
          </Field>
          <Field label="Duration">{durationLabel(call.durationSeconds)}</Field>
          <Field label="Direction">{directionLabel(call.direction)}</Field>
          <Field label="Outcome">{outcomeLabel(call.outcome)}</Field>
          <Field label="Caller number">{call.fromE164 ?? 'Hidden'}</Field>
          <Field label="Reference">
            {/* The provider's interaction id, which is what a support request needs. */}
            <code className="break-all font-mono text-[0.6875rem] text-muted">
              {call.externalCallId}
            </code>
          </Field>
        </div>

        <section className="flex flex-col gap-2">
          <strong className="font-semibold text-default text-xs">Recording</strong>

          {!canHearRecording && (
            <p className="m-0 text-muted text-xs">
              {/* The matrix, in words. A doctor and a platform role are denied outright, and
                  staff only while the clinic has switched it on. */}
              Your role cannot play call recordings at this clinic.
            </p>
          )}

          {canHearRecording && !call.hasRecording && (
            <p className="m-0 text-muted text-xs">
              There is no recording for this call yet. It may not have been recorded, or the copy
              from the provider may still be running.
            </p>
          )}

          {canHearRecording && call.hasRecording && audioUrl === undefined && (
            <>
              <Button
                kind="secondary"
                disabled={minting.isLoading}
                onClick={() => {
                  setAudioError(undefined);
                  mintUrl(call.id)
                    .unwrap()
                    .then((result) => {
                      setAudioUrl(result.url);
                    })
                    .catch((caught: unknown) => {
                      setAudioError(errorMessage(caught, 'The recording could not be opened.'));
                    });
                }}
              >
                {minting.isLoading ? 'Opening…' : 'Play recording'}
              </Button>
              <p className="m-0 text-subtle text-xs">
                {/* Said out loud, because it is true and because it explains the button: the
                    URL is short-lived and every play is recorded against your name. */}
                Opening a recording is logged against your account, and the link expires shortly
                after it is opened.
              </p>
            </>
          )}

          {audioUrl !== undefined && (
            // The browser's own player. A custom one would be a scrubber, a volume slider and
            // a set of keyboard behaviours to get wrong.
            <audio controls src={audioUrl} className="w-full">
              <track kind="captions" />
            </audio>
          )}

          {audioError !== undefined && <Alert kind="danger">{audioError}</Alert>}
        </section>

        <section className="flex flex-col gap-2">
          <strong className="font-semibold text-default text-xs">Transcript</strong>

          {detail.isLoading && <Spinner />}

          {detail.isError && (
            <Alert kind="danger">
              {errorMessage(detail.error, 'The transcript could not be loaded.')}
            </Alert>
          )}

          {detail.data !== undefined && detail.data.transcript.length === 0 && (
            <p className="m-0 text-muted text-xs">
              {/* Three different reasons, and the screen cannot tell them apart, so it says
                  all three rather than picking one. */}
              No transcript was stored for this call. It may not have been written by the provider
              yet, the call may have ended before anybody spoke, or your role may not be allowed to
              read it.
            </p>
          )}

          {detail.data !== undefined && detail.data.transcript.length > 0 && (
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {detail.data.transcript.map((turn, index) => (
                <li
                  key={`${String(index)}-${turn.role}`}
                  className="flex flex-col gap-0.5 rounded-md bg-background p-3"
                >
                  <span className="font-semibold text-[0.6875rem] text-muted uppercase tracking-wide">
                    {turn.role === 'AGENT' ? 'Agent' : turn.role === 'CALLER' ? 'Caller' : 'Other'}
                  </span>
                  <span className="text-default text-xs">{turn.text}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="flex flex-col gap-2">
          {call.appointmentId === null ? (
            <p className="m-0 text-muted text-xs">No appointment is linked to this call.</p>
          ) : (
            <Link
              to={`/appointments?appointmentId=${call.appointmentId}`}
              className="rounded-md bg-accent px-4 py-2.5 text-center font-semibold text-inverse text-xs hover:opacity-90"
            >
              View related appointment
            </Link>
          )}

          <NotYet label="Create follow-up">Follow-ups are not part of this release.</NotYet>
          <NotYet label="Mark as reviewed">A call has no review state in the platform yet.</NotYet>
        </div>
      </div>
    </Overlay>
  );
};
