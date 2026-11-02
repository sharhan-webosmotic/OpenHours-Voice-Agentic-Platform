/**
 * What the rest of the platform knows about a voice provider.
 *
 * NOTHING OUTSIDE `providers/sarvam` KNOWS A SARVAM FIELD NAME. That is the whole point of
 * this file: `interaction_id`, `interaction_transcript` and `en_text` appear in the adapter
 * and in its fixtures, and nowhere else. A second provider, or a change Sarvam makes to its
 * payload, then touches one directory.
 *
 * The normalised shapes below are deliberately smaller than what Sarvam sends. A field is
 * here because something does something with it, not because it arrived.
 */

/** A call that has finished, as the platform understands one. */
export type CallEvent = {
  /**
   * The provider's identifier for the conversation, unique per provider.
   *
   * For Sarvam this is `interaction_id`, which is `<YYYYMMDD>/<id>` and CONTAINS A SLASH
   * (contract section 1). It is stored verbatim and encoded at the point of use, because
   * reformatting an identifier to make a URL convenient is how it stops matching the one
   * the provider sent next time.
   */
  readonly externalCallId: string;
  readonly direction: 'INBOUND' | 'OUTBOUND';
  /** The caller, in E.164 when the provider gave a usable number. PHI. */
  readonly fromE164: string;
  /** The number that was dialled: the clinic's agent number. */
  readonly toE164: string;
  readonly startedAt: Date | null;
  readonly endedAt: Date | null;
  readonly durationSeconds: number | null;
  /** Everything the platform uses to decide WHICH CLINIC this belongs to. */
  readonly routing: {
    /** The provider's deployment, which is the primary way a clinic is resolved. */
    readonly deploymentId: string | null;
    readonly agentNumber: string | null;
    /**
     * Whatever we asked the provider to echo back, as a cross-check and never as the
     * answer. Sarvam returns `webhook_config.metadata` verbatim, so this is OUR data
     * coming back through an unauthenticated channel: anything in it can be forged.
     */
    readonly claimedClinicId: string | null;
  };
  /** Turns of the conversation, in order. PHI, every word of it. */
  readonly transcript: readonly CallTranscriptTurn[];
};

export type CallTranscriptTurn = {
  readonly role: 'AGENT' | 'CALLER' | 'OTHER';
  readonly text: string;
};

/** One interaction as the provider's own records have it, for the re-read and the catch-up. */
export type ProviderInteraction = {
  readonly externalCallId: string;
  readonly startedAt: Date | null;
  readonly endedAt: Date | null;
  readonly durationSeconds: number | null;
  readonly direction: 'INBOUND' | 'OUTBOUND';
  readonly fromE164: string | null;
  readonly toE164: string | null;
  readonly endedBy: string | null;
  readonly failureReason: string | null;
};

export type VoiceProvider = {
  readonly name: 'SARVAM';
  /**
   * Parses a raw webhook body into a `CallEvent`, or throws.
   *
   * TOLERANT OF UNKNOWN FIELDS, STRICT ABOUT THE ONES IT USES. A provider adding a field
   * must not take a clinic's telephone line off the air, and a provider changing the shape
   * of a field we read must not be absorbed silently.
   */
  readonly parseWebhook: (raw: unknown) => CallEvent;
  /** The provider's own record of one interaction, or null if it does not have one. */
  readonly getInteraction: (
    agent: ProviderAgentRef,
    externalCallId: string,
  ) => Promise<ProviderInteraction | null>;
  /** Interactions in a window, for the catch-up job. */
  readonly listInteractions: (
    agent: ProviderAgentRef,
    window: { readonly from: Date; readonly to: Date },
  ) => Promise<readonly ProviderInteraction[]>;
  /** The transcript, which may legitimately be empty for a while after a call. */
  readonly fetchTranscript: (
    agent: ProviderAgentRef,
    externalCallId: string,
  ) => Promise<readonly CallTranscriptTurn[]>;
  /** The recording as bytes. Never a URL for a browser: see D-007 and D-018. */
  readonly fetchRecording: (
    agent: ProviderAgentRef,
    externalCallId: string,
  ) => Promise<{ readonly bytes: Uint8Array; readonly contentType: string } | null>;
};

/** Which agent to ask about. Sarvam's analytics paths are scoped to one app id. */
export type ProviderAgentRef = {
  readonly appId: string;
};

/** Thrown when the provider is reachable but answered something unusable. */
export class ProviderContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderContractError';
  }
}

/** Thrown when the provider is not configured, rather than failing deep inside a fetch. */
export class ProviderNotConfiguredError extends Error {
  constructor(setting: string) {
    super(`${setting} is not configured, so the voice provider cannot be reached`);
    this.name = 'ProviderNotConfiguredError';
  }
}
