import { MASTER_PROMPT_V0_PLACEHOLDER } from './master-v0-placeholder.js';

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
];

/** The version a newly created clinic is marked as using. */
export const DEFAULT_PROMPT_VERSION = 'v0-placeholder';

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

/**
 * Substitutes the values into the template.
 *
 * REFUSES ON AN UNFILLED PLACEHOLDER rather than rendering `{{greeting}}` into text
 * somebody is about to paste into a provider console. A prompt with a visible placeholder
 * is a prompt an agent will read out, and the failure is silent at exactly the moment it
 * matters. The check runs after substitution so it catches both a value the renderer forgot
 * and a placeholder the template invented.
 */
export const renderPromptTemplate = (version: string, values: PromptValues): string => {
  const entry = findPromptVersion(version);

  if (entry === undefined) {
    throw new UnknownPromptVersion(version);
  }

  /**
   * Every value is checked to be a string BEFORE substitution.
   *
   * Without this, a missing value substitutes as the literal text "undefined", because
   * `replaceAll` stringifies its replacement. That is worse than a visible `{{greeting}}`:
   * a placeholder looks like a bug to whoever is pasting the prompt, and "undefined" looks
   * like a deliberate instruction. The leftover check below cannot catch it either, since
   * the placeholder is gone.
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

  const substituted = PROMPT_PLACEHOLDERS.reduce(
    (text, placeholder) => text.replaceAll(`{{${placeholder}}}`, values[placeholder]),
    entry.template,
  );

  const leftover = [...substituted.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]);

  if (leftover.length > 0) {
    throw new Error(
      `master prompt ${version} still contains unfilled placeholders after rendering: ` +
        `${[...new Set(leftover)].join(', ')}. Either the template uses a placeholder that ` +
        'is not in PROMPT_PLACEHOLDERS, or the renderer did not supply a value for one.',
    );
  }

  /**
   * Collapse the blank lines a deliberately empty value leaves behind.
   *
   * A placeholder that renders as an empty string, such as the map link when a clinic has
   * none, leaves its whole line blank and the template's own blank line beside it, so the
   * output grows a run of three or more newlines. This is cosmetic rather than dangerous,
   * which is exactly why it would never get fixed later: somebody pastes the prompt into a
   * provider console and nobody wants to tidy a text file by hand.
   */
  return substituted.replace(/\n{3,}/g, '\n\n');
};
