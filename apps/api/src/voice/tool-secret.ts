import { timingSafeEqual } from 'node:crypto';
import { UnauthorizedError } from '../common/errors.js';
import { hashToken } from '../common/tokens.js';
import { asAuthenticator } from '../db/tenant-client.js';
import * as repository from './voice.repository.js';

/**
 * Authenticating a voice tool call: a per-clinic secret, and the clinic it resolves to.
 *
 * THE SECRET IS THE WHOLE AUTHENTICATION for these endpoints (D-004, D-012). There is no
 * session, no user and no token. So three things matter here and nothing else does:
 * the comparison leaks no timing, a clinic is resolved from the secret and never from
 * anything the caller sends, and a clinic that is not active is refused.
 */

/** 64 hex characters that no secret hashes to, for the comparison on the not-found path. */
const DECOY_HASH = '0'.repeat(64);

/**
 * A constant-time comparison of two hex digests.
 *
 * `timingSafeEqual` throws on a length mismatch, which would itself be a timing signal and
 * a crash, so the lengths are checked first and a mismatch compares the decoy instead of
 * returning early. A plain `===` on a hash is the thing this exists to avoid: it returns as
 * soon as two bytes differ, and the time it takes is a measurement of how much of the value
 * the attacker already has right.
 */
const digestsMatch = (left: string, right: string): boolean => {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right.length === left.length ? right : DECOY_HASH, 'hex');

  return a.length === b.length && timingSafeEqual(a, b) && left.length === right.length;
};

export type VoiceAgentIdentity = {
  readonly voiceAgentId: string;
  readonly organisationId: string;
  readonly sarvamAppId: string | null;
};

/**
 * Every refusal is the same error with the same message.
 *
 * A caller must not be able to tell a secret that belongs to nobody from one that belongs
 * to a suspended clinic: the first would tell an attacker when they had guessed a real
 * value, and the second tells anyone holding an old secret something about the clinic. The
 * reason is in the server-side log message, which the client never sees.
 */
const refuse = (reason: string): never => {
  throw new UnauthorizedError(reason, 'This voice agent is not authorised.');
};

/**
 * Resolves a presented tool secret to the clinic whose agent it belongs to.
 *
 * ONE INDEXED READ. The hash is a unique index on `voice_agents`, so this is a probe
 * rather than a scan, and it is the only query on the authentication path.
 *
 * The lookup by hash is an optimisation and NOT the comparison: the row it finds is then
 * compared in constant time. Looking a credential up by its own hash does leak, through
 * the index, whether a given hash exists, but a hash is not a secret and inverting SHA-256
 * is the attack that would be needed to use that.
 */
export const authenticateToolSecret = async (presented: string): Promise<VoiceAgentIdentity> => {
  const hash = hashToken(presented);

  const agent = await asAuthenticator('voice-tool-secret', (db) =>
    repository.findAgentBySecretHash(db, hash),
  );

  if (agent === null || agent.toolSecretHash === null) {
    // Compared anyway, so that an unknown secret costs the same as a known one.
    digestsMatch(DECOY_HASH, hash);
    return refuse('voice tool secret matched no agent');
  }

  if (!digestsMatch(agent.toolSecretHash, hash)) {
    // Unreachable while the lookup is by hash. Kept because the comparison, not the
    // lookup, is what this function promises, and a future lookup by app id would make
    // this the only thing standing between a wrong secret and a clinic's patients.
    return refuse('voice tool secret did not match the stored digest');
  }

  if (agent.status !== 'ACTIVE') {
    return refuse(`voice agent ${agent.id} is ${agent.status}`);
  }

  if (agent.organisationStatus !== 'ACTIVE') {
    return refuse(`organisation of voice agent ${agent.id} is ${agent.organisationStatus}`);
  }

  return {
    voiceAgentId: agent.id,
    organisationId: agent.organisationId,
    sarvamAppId: agent.sarvamAppId,
  };
};

/**
 * Exported for this module's own unit test.
 *
 * The comparison is the whole of note 3: a `===` on a secret's digest leaks, through its
 * running time, how much of the value the caller already has right. A behavioural test can
 * only see a 401, which is the same 401 a string comparison would produce, so the function
 * itself is asserted directly.
 */
export const internals = { digestsMatch, DECOY_HASH };
