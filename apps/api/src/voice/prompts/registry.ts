import { MASTER_PROMPT_V0_PLACEHOLDER } from './master-v0-placeholder.js';
import { MASTER_PROMPT_V0_CALLER_IDENTITY } from './master-v0-caller-identity.js';

/**
 * Every master prompt version the platform knows, keyed by the string a clinic stores.
 *
 * WHY VERSIONS IN FILES RATHER THAN ROWS IN A TABLE. The prompt determines what a machine
 * says to a patient about their healthcare. A change to it deserves the same review as a
 * change to a permission check: a diff, an approver and a commit that says why. A prompt
 * stored in the database would be edited through a form, by whoever happened to be logged
 * in, with the previous wording gone. Nothing about that is reconstructable six months
 * later when a patient says the agent told them something.
 *
 * WHY A CLINIC STORES A VERSION STRING. The platform does not push prompts: a person pastes
 * the rendered text into Sarvam's console by hand (D-004, D-005). So the prompt a clinic's
 * agent is actually running is whatever was pasted, and `voice_agents.prompt_version` is our
 * record of which version that was. Adding `v2` here therefore changes nothing for a clinic
 * still marked `v1`, which is the point: a prompt change rolls out clinic by clinic, as
 * somebody re-pastes it, and the stored version is how you tell which clinics still owe that.
 *
 * ADDING A VERSION: add the file, add the entry, leave the existing ones alone. Never edit a
 * version that a clinic is marked as running, for the same reason an applied migration is
 * never edited: the record would then describe something that was never pasted.
 */

/** The substitutions a template may use. Closed set: the renderer fills exactly these. */
export const PROMPT_PLACEHOLDERS = [
  'clinicName',
  'tone',
  'languages',
  'greeting',
  'address',
  'clinicPhone',
  'timezone',
  'mapLine',
  'openingHours',
  'services',
  'doctors',
  'bookingPolicy',
  'fullyBookedResponse',
  'escalationRules',
  'neverPromise',
  'faqs',
  'recording',
] as const;

export type PromptPlaceholder = (typeof PROMPT_PLACEHOLDERS)[number];

export type PromptValues = Readonly<Record<PromptPlaceholder, string>>;

export type PromptVersion = {
  readonly version: string;
  readonly template: string;
  /**
   * Whether this version's wording has been approved for use with real callers.
   *
   * `false` for the placeholder. The renderer prints a warning rather than refusing,
   * because the template, the substitutions and the command all need to be usable before
   * the final wording exists; refusing would make the whole path untestable until then.
   */
  readonly approved: boolean;
};

const VERSIONS: readonly PromptVersion[] = [
  {
    version: 'v0-placeholder',
    template: MASTER_PROMPT_V0_PLACEHOLDER,
    approved: false,
  },
  {
    version: 'v0-caller-identity',
    template: MASTER_PROMPT_V0_CALLER_IDENTITY,
    approved: false,
  },
];

/** The version a newly created clinic is marked as using. */
export const DEFAULT_PROMPT_VERSION = 'v0-caller-identity';

export const PROMPT_VERSIONS: readonly string[] = VERSIONS.map((entry) => entry.version);

export const findPromptVersion = (version: string): PromptVersion | undefined =>
  VERSIONS.find((entry) => entry.version === version);

export class UnknownPromptVersion extends Error {
  constructor(version: string) {
    super(
      `unknown master prompt version "${version}". Known versions: ${PROMPT_VERSIONS.join(', ')}. ` +
        'A clinic marked with a version this build does not have means the version was ' +
        'removed, which must not happen, or that the clinic was configured by a newer build.',
    );
    this.name = 'UnknownPromptVersion';
  }
}

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

/** A template line holding nothing but one placeholder, with its line break. */
const PLACEHOLDER_LINE = /^\{\{(\w+)\}\}\n/gm;

const isPlaceholder = (name: string): name is PromptPlaceholder =>
  (PROMPT_PLACEHOLDERS as readonly string[]).includes(name);

/**
 * Substitutes the values into the template.
 *
 * CLINIC TEXT IS INERT. The values are typed by people at a clinic and the output becomes the
 * agent's instructions, so a value that could change the template would be prompt injection
 * through a settings form. The template is scanned ONCE and each placeholder is replaced by a
 * function, which means a value is never scanned again (`{{doctors}}` in a greeting stays as
 * those characters) and `$'`, `$&` and `` $` `` have no special meaning (a string replacement
 * expands them into the surrounding template). Nothing after substitution looks at the output:
 * every rule below is checked against the template and the values separately.
 *
 * REFUSES ON A PLACEHOLDER THE TEMPLATE INVENTED rather than rendering `{{greeting}}` into
 * text somebody is about to paste into a provider console, where the agent would read it out.
 */
export const renderPromptTemplate = (version: string, values: PromptValues): string => {
  const entry = findPromptVersion(version);

  if (entry === undefined) {
    throw new UnknownPromptVersion(version);
  }

  const unknown = [...entry.template.matchAll(PLACEHOLDER)]
    .map((match) => match[1] ?? '')
    .filter((name) => !isPlaceholder(name));

  if (unknown.length > 0) {
    throw new Error(
      `master prompt ${version} uses placeholders that are not in PROMPT_PLACEHOLDERS: ` +
        `${[...new Set(unknown)].join(', ')}.`,
    );
  }

  /**
   * Every value is checked to be a string BEFORE substitution.
   *
   * Without this, a missing value substitutes as the literal text "undefined". That is worse
   * than a visible `{{greeting}}`: a placeholder looks like a bug to whoever is pasting the
   * prompt, and "undefined" looks like a deliberate instruction.
   */
  const missing = PROMPT_PLACEHOLDERS.filter(
    (placeholder) => typeof values[placeholder] !== 'string',
  );

  if (missing.length > 0) {
    throw new Error(
      `master prompt ${version} was given no value for: ${missing.join(', ')}. ` +
        'Every declared placeholder needs a string, even an empty one.',
    );
  }

  /**
   * A placeholder that sits alone on its line and renders empty, such as the map link when a
   * clinic has none, takes its line with it rather than leaving a blank one.
   *
   * Done on the TEMPLATE, before substitution, so it can never touch what a clinic wrote. The
   * earlier version collapsed runs of newlines across the whole output, which also rewrote any
   * clinic text that happened to contain blank lines.
   */
  const template = entry.template.replace(PLACEHOLDER_LINE, (line, name: string) =>
    isPlaceholder(name) && values[name] === '' ? '' : line,
  );

  return template.replace(PLACEHOLDER, (_match, name: string) =>
    isPlaceholder(name) ? values[name] : '',
  );
};
