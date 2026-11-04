import { pathToFileURL } from 'node:url';
import { asSystem, disconnectDatabase } from '../src/db/tenant-client.js';
import { findClinicConfiguration } from '../src/modules/organisations/organisations.repository.js';
import { readinessFor } from '../src/modules/organisations/organisations.service.js';
import { renderClinicPrompt } from '../src/voice/prompts/render.js';
import { DEFAULT_PROMPT_VERSION } from '../src/voice/prompts/registry.js';

/**
 * Writes one clinic's rendered master prompt to stdout, for pasting into Sarvam.
 *
 * STDOUT AND NOTHING ELSE on the success path, so the prompt can be piped or redirected:
 * `pnpm prompt:render <clinic> > prompt.txt`. Every warning goes to stderr for the same
 * reason, which means a clinic that is not ready still produces a usable prompt and a
 * visible complaint, rather than one polluting the other.
 *
 * READ-ONLY, so it carries no confirmation variable and no local-host guard: pointing it at
 * production is the normal case, because production is where the clinic being configured
 * lives.
 *
 * IT GOES THROUGH `asSystem` RATHER THAN OPENING ITS OWN CLIENT. Two reasons, and the
 * second is the real one. It needs the extended client's type to call the repository, and
 * an ordinary transaction client is not assignable to it; casting past that would have
 * silenced a real mismatch as easily as a harmless one. More importantly, `asSystem` writes
 * an audit row for every use of cross-tenant scope, so reading a clinic's whole
 * configuration from a terminal leaves the same trace as reading it through the console.
 * An operator action that bypassed the trail purely because it was a command would be a
 * hole in the trail.
 *
 * THE COST IS THAT IT NEEDS THE API'S ENVIRONMENT, not just `DATABASE_URL`, because
 * `src/config.ts` validates everything at import time. That is the environment it runs in
 * as a one-off task anyway, and `docs/features/pilot-clinic.md` says so.
 *
 * It takes the clinic's organisation id, or a fragment of its name when that is unambiguous.
 * Typing a uuid off a screen is how transcription errors happen, and rendering the wrong
 * clinic's prompt into a provider console is not a mistake that announces itself.
 */

const out = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

const warn = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Resolved = { readonly organisationId: string; readonly note?: string };

/** An argument that names no clinic, or more than one: the operator's to correct. */
class CannotResolve extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CannotResolve';
  }
}

/**
 * Resolves the argument to exactly one organisation, or explains why it cannot.
 *
 * AMBIGUITY IS AN ERROR, never a "first match". Clinics in a chain share most of their
 * name, and silently picking one would render the wrong clinic's hours into a prompt that
 * somebody then pastes live.
 */
const resolveOrganisation = async (argument: string): Promise<Resolved> => {
  if (UUID.test(argument)) {
    return { organisationId: argument };
  }

  const matches = await asSystem('prompt.render.resolve', (db) =>
    db.organisation.findMany({
      where: { name: { contains: argument, mode: 'insensitive' } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 10,
    }),
  );

  if (matches.length > 1) {
    throw new CannotResolve(
      `"${argument}" matches ${String(matches.length)} clinics. Pass the organisation id instead:\n` +
        matches.map((match) => `  ${match.id}  ${match.name}`).join('\n'),
    );
  }

  const only = matches[0];

  if (only === undefined) {
    throw new CannotResolve(`no clinic matches "${argument}"`);
  }

  return {
    organisationId: only.id,
    note: `Resolved "${argument}" to ${only.name} (${only.id})`,
  };
};

export type CommandOutput = {
  /** The prompt, and nothing else, so it can be redirected into a file. */
  readonly out: (line: string) => void;
  /** Every warning and refusal. */
  readonly err: (line: string) => void;
};

/**
 * The command, as a function of its argument, returning the exit code.
 *
 * Separated from the process so a test can drive the real resolution, the warnings and the
 * stdout and stderr split. It neither exits the process nor closes the database connection:
 * the wrapper at the bottom does both, and a test shares the connection with everything else.
 */
export const runRenderPromptCommand = async (
  argument: string | undefined,
  output: CommandOutput,
): Promise<number> => {
  const { out, err: warn } = output;

  if (argument === undefined) {
    warn('Usage: pnpm prompt:render <organisation-id | part of the clinic name>');
    warn('');
    warn('Writes the rendered master prompt to stdout. Redirect it to a file or paste it');
    warn('into the Sarvam console. See docs/features/pilot-clinic.md for the order of the');
    warn('manual Sarvam steps.');
    return 1;
  }

  let resolved: Resolved;
  try {
    resolved = await resolveOrganisation(argument);
  } catch (error) {
    if (error instanceof CannotResolve) {
      warn(error.message);
      return 1;
    }
    throw error;
  }

  if (resolved.note !== undefined) {
    warn(resolved.note);
  }

  const configuration = await asSystem('prompt.render', (db) =>
    findClinicConfiguration(db, resolved.organisationId),
  );

  if (configuration === null) {
    warn(`no clinic with id ${resolved.organisationId}`);
    return 1;
  }

  const readiness = readinessFor(configuration);
  const rendered = renderClinicPrompt(configuration, readiness, DEFAULT_PROMPT_VERSION);

  if (!rendered.approved) {
    warn('');
    warn(`WARNING: master prompt version ${rendered.version} is a PLACEHOLDER.`);
    warn('Its wording has not been approved for use with real callers. What is being');
    warn('exercised here is the template, the substitutions and this command, not the words.');
  }

  if (!readiness.ready) {
    warn('');
    warn(
      `WARNING: this clinic is not ready to go live. ${String(readiness.satisfiedCount)} of ` +
        `${String(readiness.totalCount)} requirements are met. Still missing:`,
    );
    for (const requirement of readiness.missing) {
      warn(`  - [${requirement.section}] ${requirement.label}`);
    }
    warn('');
    warn('The prompt below is rendered anyway, because a partly configured clinic is worth');
    warn('inspecting. Do not put it in front of real callers in this state.');
  }

  warn('');
  out(rendered.text);
  return 0;
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = await runRenderPromptCommand(process.argv[2], { out, err: warn });
  } finally {
    await disconnectDatabase();
  }
}
