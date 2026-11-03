import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Bot, Building2, CalendarClock, Clock, Stethoscope } from 'lucide-react';
import {
  AGENT_TONES,
  agentProfileSchema,
  bookingPolicySchema,
  clinicHoursSchema,
  clinicProfileSchema,
  type AgentProfileInput,
  type BookingPolicyInput,
  type ClinicProfileInput,
} from '@clinicai/shared';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { SelectField, TextAreaField } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { cn } from '../../components/ui/cn';
import { useCan } from '../../lib/useCan';
import { errorMessage } from '../../lib/problem';
import {
  useClinic,
  useReplaceHoursMutation,
  useUpdateAgentProfileMutation,
  useUpdateBookingPolicyMutation,
  useUpdateProfileMutation,
} from '../clinic/api';
import { DoctorAvailability } from './DoctorAvailability';
import { WeeklyHoursEditor, type WeekHours } from './WeeklyHoursEditor';

/**
 * Clinic settings: a section index on the left and ONE section on the right at a time, held
 * in the URL (`?section=hours`) so a link or a reload lands on the same panel. Each section is
 * a card with its heading, a sentence under it, its fields, and its own save.
 *
 * ─── FOUR DEVIATIONS, AND THE FIRST ONE IS THE IMPORTANT ONE ────────────────────
 *
 * 1. EACH SECTION SAVES ITSELF. The prototype has one "Save changes" bar for the whole page.
 *    The API replaces sections one at a time, so a single button would fire four requests and
 *    then have to explain a partial failure: profile saved, booking policy refused, two
 *    unknown. A per-section button says exactly what was saved.
 * 2. THE CLINIC NAME AND PUBLIC NUMBER ARE READ-ONLY HERE. They live on the organisation,
 *    which the matrix lets a clinic owner READ and not write; a platform administrator
 *    changes them in the admin console. Showing them as editable and having the server refuse
 *    the save would be the product offering a door that is locked.
 * 3. OPENING HOURS ARE EDITED HERE, a day at a time, and nowhere else. The prototype has an
 *    editor on two screens; two editors for one record is two things to keep in step, so the
 *    one on Doctors and Staff now points here.
 * 4. THERE IS NO ON/OFF SWITCH FOR THE AI RECEPTIONIST. The capture has a green toggle and a
 *    line admitting it is simulated. Nothing in the platform turns an agent on or off: a
 *    clinic's calls reach the agent because a number is mapped to it, and that mapping is
 *    changed in the admin console. A switch that did nothing would be worse than no switch.
 */

const SectionCard = ({
  title,
  description,
  children,
  footer,
}: {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode | undefined;
}) => (
  <Card padded={false} className="flex flex-col">
    <div className="flex flex-col gap-1 border-border-chrome border-b px-6 py-5">
      <h2 className="m-0 font-bold text-default text-lg">{title}</h2>
      <p className="m-0 max-w-3xl text-muted text-sm">{description}</p>
    </div>

    <div className="flex flex-col gap-6 px-6 py-6">{children}</div>

    {footer !== undefined && (
      <div className="flex items-center justify-end gap-3 rounded-b-card border-border-chrome border-t bg-surface-sunken px-6 py-4">
        {footer}
      </div>
    )}
  </Card>
);

/** A titled group of fields inside a section, so a long form reads as parts. */
const FieldGroup = ({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) => (
  <fieldset className="m-0 flex flex-col gap-4 border-0 p-0">
    <legend className="mb-3 p-0 font-semibold text-muted text-xs uppercase tracking-[0.6px]">
      {title}
    </legend>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
  </fieldset>
);

const SECTIONS = [
  { id: 'profile', label: 'Clinic profile', hint: 'Name, contact and address', Icon: Building2 },
  { id: 'hours', label: 'Opening hours', hint: 'When patients can book', Icon: Clock },
  {
    id: 'doctors',
    label: 'Doctor availability',
    hint: "Each doctor's working week",
    Icon: Stethoscope,
  },
  {
    id: 'booking',
    label: 'Booking preferences',
    hint: 'Notice, grid and limits',
    Icon: CalendarClock,
  },
  { id: 'agent', label: 'AI receptionist', hint: 'What callers hear', Icon: Bot },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

const isSection = (value: string | null): value is SectionId =>
  SECTIONS.some((section) => section.id === value);

const toWeekInput = (week: WeekHours) => ({
  days: week.map((day) => ({ weekday: day.weekday, segments: [...day.segments] })),
});

export const SettingsPage = () => {
  const { data: clinic, isLoading, isError, error, refetch } = useClinic();
  const canWrite = useCan('clinic_settings', 'write');

  const [updateProfile, savingProfile] = useUpdateProfileMutation();
  const [updateBookingPolicy, savingPolicy] = useUpdateBookingPolicyMutation();
  const [updateAgentProfile, savingAgent] = useUpdateAgentProfileMutation();
  const [replaceHours, savingHours] = useReplaceHoursMutation();
  const [params, setParams] = useSearchParams();
  const requested = params.get('section');
  const section: SectionId = isSection(requested) ? requested : 'profile';

  const [profile, setProfile] = useState<ClinicProfileInput | undefined>(undefined);
  const [policy, setPolicy] = useState<BookingPolicyInput | undefined>(undefined);
  const [agent, setAgent] = useState<AgentProfileInput | undefined>(undefined);
  const [saved, setSaved] = useState<string | undefined>(undefined);
  const [problem, setProblem] = useState<string | undefined>(undefined);

  /**
   * Seeded once, when the clinic arrives, and not re-synchronised afterwards.
   *
   * A save invalidates the clinic query, so re-seeding on every refetch would wipe
   * half-finished typing in one section every time another section was saved.
   */
  useEffect(() => {
    if (clinic === undefined) {
      return;
    }

    setProfile(
      clinic.profile ?? {
        legalName: null,
        contactEmail: null,
        contactPhone: null,
        website: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        mapUrl: null,
      },
    );
    setPolicy(
      clinic.bookingPolicy ?? {
        slotGranularityMinutes: null,
        minimumNoticeMinutes: null,
        maximumAdvanceDays: null,
        cancellationWindowHours: null,
        acceptsNewPatients: null,
        defaultBufferMinutes: null,
        maxPerSlot: null,
        noShowPolicy: null,
      },
    );
    setAgent(
      clinic.agentProfile === null
        ? {
            greeting: null,
            languages: [],
            tone: null,
            fullyBookedResponse: null,
            escalationRules: null,
            neverPromise: [],
          }
        : {
            greeting: clinic.agentProfile.greeting,
            languages: [...clinic.agentProfile.languages],
            tone: clinic.agentProfile.tone as AgentProfileInput['tone'],
            fullyBookedResponse: clinic.agentProfile.fullyBookedResponse,
            escalationRules: clinic.agentProfile.escalationRules,
            neverPromise: [...clinic.agentProfile.neverPromise],
          },
    );
  }, [clinic]);

  if (isLoading) {
    return <Spinner />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Alert kind="danger">{errorMessage(error, 'The settings could not be loaded.')}</Alert>
        <Button
          kind="secondary"
          onClick={() => {
            void refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (
    clinic === undefined ||
    profile === undefined ||
    policy === undefined ||
    agent === undefined
  ) {
    return <Spinner />;
  }

  const organisationId = clinic.organisation.id;

  const save = async (
    section: string,
    run: () => Promise<unknown>,
    parse: () => { readonly ok: true } | { readonly ok: false; readonly message: string },
  ): Promise<void> => {
    setSaved(undefined);
    setProblem(undefined);

    const checked = parse();

    if (!checked.ok) {
      setProblem(checked.message);
      return;
    }

    try {
      await run();
      setSaved(section);
    } catch (caught) {
      setProblem(errorMessage(caught, 'The section was not saved.'));
    }
  };

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <Card padded={false} className="p-2 lg:sticky lg:top-[92px]">
        <nav aria-label="Settings sections" className="flex flex-col gap-1">
          {SECTIONS.map(({ id, label, hint, Icon }) => {
            const current = id === section;

            return (
              <button
                key={id}
                type="button"
                aria-current={current ? 'page' : undefined}
                onClick={() => {
                  setSaved(undefined);
                  setProblem(undefined);
                  setParams({ section: id }, { replace: true });
                }}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
                  current ? 'bg-accent-surface' : 'hover:bg-background',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-md',
                    current ? 'bg-accent text-inverse' : 'bg-background text-muted',
                  )}
                >
                  <Icon size={16} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span
                    className={cn(
                      'font-semibold text-sm',
                      current ? 'text-accent' : 'text-default',
                    )}
                  >
                    {label}
                  </span>
                  <span className="truncate text-muted text-xs">{hint}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </Card>

      <div className="flex min-w-0 flex-col gap-4">
        {problem !== undefined && <Alert kind="danger">{problem}</Alert>}
        {saved !== undefined && <Alert kind="success">{saved} saved.</Alert>}

        {section === 'profile' && (
          <SectionCard
            title="Clinic profile"
            description="The clinic's own details. The agent reads the address and the contact number to callers, so what is here is what a patient is told."
            footer={
              canWrite ? (
                <Button
                  loading={savingProfile.isLoading}
                  onClick={() => {
                    void save(
                      'Clinic profile',
                      () => updateProfile({ organisationId, input: profile }).unwrap(),
                      () => {
                        const parsed = clinicProfileSchema.safeParse(profile);
                        return parsed.success
                          ? { ok: true }
                          : {
                              ok: false,
                              message: parsed.error.issues
                                .map((issue) => `${issue.path.join('.')} ${issue.message}`)
                                .join(' '),
                            };
                      },
                    );
                  }}
                >
                  Save clinic profile
                </Button>
              ) : undefined
            }
          >
            <FieldGroup title="Identity">
              <Field
                label="Clinic name"
                hint="Changed by a platform administrator, not here."
                value={clinic.organisation.name}
                readOnly
                disabled
              />
              <Field
                label="Public phone number"
                hint="The number patients call. Also changed in the admin console."
                value={clinic.organisation.clinicPhone ?? 'Not recorded'}
                readOnly
                disabled
              />
              <Field
                label="Legal name"
                value={profile.legalName ?? ''}
                disabled={!canWrite}
                onChange={(event) => {
                  setProfile({ ...profile, legalName: event.target.value });
                }}
              />
            </FieldGroup>

            <FieldGroup title="Contact">
              <Field
                label="Contact email"
                type="email"
                value={profile.contactEmail ?? ''}
                disabled={!canWrite}
                onChange={(event) => {
                  setProfile({ ...profile, contactEmail: event.target.value });
                }}
              />
              <Field
                label="Contact phone"
                value={profile.contactPhone ?? ''}
                disabled={!canWrite}
                onChange={(event) => {
                  setProfile({ ...profile, contactPhone: event.target.value });
                }}
              />
              <Field
                label="Website"
                value={profile.website ?? ''}
                disabled={!canWrite}
                onChange={(event) => {
                  setProfile({ ...profile, website: event.target.value });
                }}
              />
            </FieldGroup>

            <FieldGroup title="Address">
              <Field
                label="Address line 1"
                value={profile.addressLine1 ?? ''}
                disabled={!canWrite}
                onChange={(event) => {
                  setProfile({ ...profile, addressLine1: event.target.value });
                }}
              />
              <Field
                label="Address line 2"
                value={profile.addressLine2 ?? ''}
                disabled={!canWrite}
                onChange={(event) => {
                  setProfile({ ...profile, addressLine2: event.target.value });
                }}
              />
              <Field
                label="City"
                value={profile.city ?? ''}
                disabled={!canWrite}
                onChange={(event) => {
                  setProfile({ ...profile, city: event.target.value });
                }}
              />
              <Field
                label="State"
                value={profile.state ?? ''}
                disabled={!canWrite}
                onChange={(event) => {
                  setProfile({ ...profile, state: event.target.value });
                }}
              />
              <Field
                label="Postal code"
                value={profile.postalCode ?? ''}
                disabled={!canWrite}
                onChange={(event) => {
                  setProfile({ ...profile, postalCode: event.target.value });
                }}
              />
            </FieldGroup>
          </SectionCard>
        )}

        {section === 'hours' && (
          <SectionCard
            title="Opening hours"
            description="When the clinic takes appointments. Every slot the agent and the desk can offer is calculated from these, each doctor's own hours and the booking preferences."
          >
            {clinic.organisation.openingHoursCollectedAt === null && (
              <Alert kind="warning">
                Nobody has confirmed this clinic&apos;s opening hours yet, so the agent will not
                state any and no slots can be offered. Save the week below to confirm them.
              </Alert>
            )}
            <WeeklyHoursEditor
              week={clinic.hours}
              canWrite={canWrite}
              saving={savingHours.isLoading}
              noun="The clinic"
              onSave={async (week) => {
                const parsed = clinicHoursSchema.safeParse(toWeekInput(week));
                if (!parsed.success) {
                  return parsed.error.issues.map((issue) => issue.message).join(' ');
                }
                try {
                  await replaceHours({ organisationId, input: parsed.data }).unwrap();
                  return undefined;
                } catch (caught) {
                  return errorMessage(caught, 'The opening hours were not saved.');
                }
              }}
            />
          </SectionCard>
        )}

        {section === 'doctors' && (
          <SectionCard
            title="Doctor availability"
            description="Each doctor's working week and breaks. Patients are offered a doctor's times only inside these hours and the clinic's opening hours."
          >
            <DoctorAvailability organisationId={organisationId} doctors={clinic.doctors} />
          </SectionCard>
        )}

        {section === 'booking' && (
          <SectionCard
            title="Booking preferences"
            description="The rules the slot engine applies: the grid times sit on, how much notice the clinic needs, and how far ahead it takes bookings."
            footer={
              canWrite ? (
                <Button
                  loading={savingPolicy.isLoading}
                  onClick={() => {
                    void save(
                      'Booking preferences',
                      () => updateBookingPolicy({ organisationId, input: policy }).unwrap(),
                      () => {
                        const parsed = bookingPolicySchema.safeParse(policy);
                        return parsed.success
                          ? { ok: true }
                          : {
                              ok: false,
                              message: parsed.error.issues
                                .map((issue) => `${issue.path.join('.')} ${issue.message}`)
                                .join(' '),
                            };
                      },
                    );
                  }}
                >
                  Save booking preferences
                </Button>
              ) : undefined
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Slot grid, in minutes"
                hint="Times are offered on this grid: 15 gives 09:00, 09:15, 09:30."
                type="number"
                min={5}
                max={240}
                step={5}
                value={policy.slotGranularityMinutes ?? ''}
                disabled={!canWrite}
                onChange={(event) => {
                  setPolicy({
                    ...policy,
                    slotGranularityMinutes:
                      event.target.value === '' ? null : Number(event.target.value),
                  });
                }}
              />
              <Field
                label="Minimum notice, in minutes"
                hint="How close to a slot a booking may still be made."
                type="number"
                min={0}
                value={policy.minimumNoticeMinutes ?? ''}
                disabled={!canWrite}
                onChange={(event) => {
                  setPolicy({
                    ...policy,
                    minimumNoticeMinutes:
                      event.target.value === '' ? null : Number(event.target.value),
                  });
                }}
              />
              <Field
                label="Maximum advance, in days"
                hint="How far ahead the agent may book."
                type="number"
                min={1}
                max={365}
                value={policy.maximumAdvanceDays ?? ''}
                disabled={!canWrite}
                onChange={(event) => {
                  setPolicy({
                    ...policy,
                    maximumAdvanceDays:
                      event.target.value === '' ? null : Number(event.target.value),
                  });
                }}
              />
              <Field
                label="Gap after each appointment, in minutes"
                hint="Applied unless a doctor has a buffer of their own."
                type="number"
                min={0}
                max={120}
                value={policy.defaultBufferMinutes ?? ''}
                disabled={!canWrite}
                onChange={(event) => {
                  setPolicy({
                    ...policy,
                    defaultBufferMinutes:
                      event.target.value === '' ? null : Number(event.target.value),
                  });
                }}
              />
              <Field
                label="Patients per slot"
                hint="More than one only for a clinic that deliberately overbooks."
                type="number"
                min={1}
                max={10}
                value={policy.maxPerSlot ?? ''}
                disabled={!canWrite}
                onChange={(event) => {
                  setPolicy({
                    ...policy,
                    maxPerSlot: event.target.value === '' ? null : Number(event.target.value),
                  });
                }}
              />
              <Field
                label="Cancellation window, in hours"
                hint="How late a patient may cancel without it counting against them."
                type="number"
                min={0}
                value={policy.cancellationWindowHours ?? ''}
                disabled={!canWrite}
                onChange={(event) => {
                  setPolicy({
                    ...policy,
                    cancellationWindowHours:
                      event.target.value === '' ? null : Number(event.target.value),
                  });
                }}
              />
            </div>

            <TextAreaField
              label="No-show policy"
              hint="In the clinic's own words. The agent reads this out when a caller asks."
              rows={2}
              value={policy.noShowPolicy ?? ''}
              disabled={!canWrite}
              onChange={(event) => {
                setPolicy({ ...policy, noShowPolicy: event.target.value });
              }}
            />
          </SectionCard>
        )}

        {section === 'agent' && (
          <SectionCard
            title="AI receptionist"
            description="What the agent says and how it says it. This is the text a patient hears, so it is written here rather than in a prompt file."
            footer={
              canWrite ? (
                <Button
                  loading={savingAgent.isLoading}
                  onClick={() => {
                    void save(
                      'AI receptionist',
                      () => updateAgentProfile({ organisationId, input: agent }).unwrap(),
                      () => {
                        const parsed = agentProfileSchema.safeParse(agent);
                        return parsed.success
                          ? { ok: true }
                          : {
                              ok: false,
                              message: parsed.error.issues
                                .map((issue) => `${issue.path.join('.')} ${issue.message}`)
                                .join(' '),
                            };
                      },
                    );
                  }}
                >
                  Save AI receptionist
                </Button>
              ) : undefined
            }
          >
            <Alert kind="info">
              There is no switch that turns the agent on or off. A clinic&apos;s calls reach the
              agent because its number is mapped to one, and that mapping is managed in the admin
              console.
            </Alert>

            <TextAreaField
              label="Greeting"
              hint="The first thing a caller hears."
              rows={2}
              value={agent.greeting ?? ''}
              disabled={!canWrite}
              onChange={(event) => {
                setAgent({ ...agent, greeting: event.target.value });
              }}
            />

            <SelectField
              label="Tone"
              value={agent.tone ?? ''}
              disabled={!canWrite}
              options={[
                { value: '', label: 'Not set' },
                ...AGENT_TONES.map((tone) => ({
                  value: tone,
                  label: tone.charAt(0) + tone.slice(1).toLowerCase(),
                })),
              ]}
              onChange={(event) => {
                setAgent({
                  ...agent,
                  tone:
                    event.target.value === ''
                      ? null
                      : (event.target.value as AgentProfileInput['tone']),
                });
              }}
            />

            <TextAreaField
              label="What to say when fully booked"
              rows={2}
              value={agent.fullyBookedResponse ?? ''}
              disabled={!canWrite}
              onChange={(event) => {
                setAgent({ ...agent, fullyBookedResponse: event.target.value });
              }}
            />

            <TextAreaField
              label="When to put a caller through to a person"
              hint="The agent never diagnoses, prescribes or decides anything clinical. This is where a clinic adds its own escalations on top of that."
              rows={2}
              value={agent.escalationRules ?? ''}
              disabled={!canWrite}
              onChange={(event) => {
                setAgent({ ...agent, escalationRules: event.target.value });
              }}
            />
          </SectionCard>
        )}
      </div>
    </div>
  );
};
