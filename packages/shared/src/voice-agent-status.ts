/**
 * Whether a clinic's AI receptionist can actually answer a call, and if not, why not.
 *
 * ─── COMPUTED ONCE, ON THE SERVER ───────────────────────────────────────────────
 *
 * The API calls this and returns the result on the clinic; every screen that shows the
 * agent's state reads that one value. The first version read the agent row's `status`, which
 * defaults to ACTIVE and is set when the clinic is created, so a clinic nobody had connected
 * to Sarvam showed "Live" and a receptionist reading it could stop answering the phone.
 *
 * ─── LIVE NEEDS EVERY PART ──────────────────────────────────────────────────────
 *
 * The agent is switched on, and it has the Sarvam app and deployment it runs as, the number
 * patients dial, the secret its tool calls present and the secret its webhooks carry. Missing
 * any one, calls either never reach it or reach it and fail. Nothing is inferred from a call
 * having happened, because a call log proves the past and not the present.
 *
 * NOT CONFIGURED means none of the five configuration parts exists, which is the shape of a
 * clinic straight out of the admin console. PARTLY CONFIGURED names what is still missing,
 * including the agent being switched off.
 */

export const VOICE_AGENT_STATES = ['LIVE', 'PARTLY_CONFIGURED', 'NOT_CONFIGURED'] as const;

export type VoiceAgentState = (typeof VOICE_AGENT_STATES)[number];

export const VOICE_AGENT_REQUIREMENTS = [
  'ACTIVE',
  'SARVAM_APP',
  'SARVAM_DEPLOYMENT',
  'AGENT_NUMBER',
  'TOOL_SECRET',
  'WEBHOOK_SECRET',
] as const;

export type VoiceAgentRequirement = (typeof VOICE_AGENT_REQUIREMENTS)[number];

/** Written for the clinic, which is who reads it. */
export const VOICE_AGENT_REQUIREMENT_LABELS: Record<VoiceAgentRequirement, string> = {
  ACTIVE: 'the agent switched on',
  SARVAM_APP: 'a Sarvam app',
  SARVAM_DEPLOYMENT: 'a Sarvam deployment',
  AGENT_NUMBER: 'a phone number for the agent',
  TOOL_SECRET: 'the tool secret',
  WEBHOOK_SECRET: 'the webhook secret',
};

export type VoiceAgentStatus = {
  readonly state: VoiceAgentState;
  /** Empty when LIVE. Always in the order of `VOICE_AGENT_REQUIREMENTS`. */
  readonly missing: readonly VoiceAgentRequirement[];
};

export type VoiceAgentStatusInput = {
  readonly active: boolean;
  readonly sarvamAppId: string | null;
  readonly sarvamDeploymentId: string | null;
  readonly agentPhone: string | null;
  readonly toolSecretSet: boolean;
  readonly webhookSecretSet: boolean;
};

const present = (value: string | null): boolean => value !== null && value.trim() !== '';

/** `null` when the clinic has no agent row at all, which is NOT_CONFIGURED. */
export const voiceAgentStatus = (agent: VoiceAgentStatusInput | null): VoiceAgentStatus => {
  if (agent === null) {
    return { state: 'NOT_CONFIGURED', missing: [...VOICE_AGENT_REQUIREMENTS] };
  }

  const has: Record<VoiceAgentRequirement, boolean> = {
    ACTIVE: agent.active,
    SARVAM_APP: present(agent.sarvamAppId),
    SARVAM_DEPLOYMENT: present(agent.sarvamDeploymentId),
    AGENT_NUMBER: present(agent.agentPhone),
    TOOL_SECRET: agent.toolSecretSet,
    WEBHOOK_SECRET: agent.webhookSecretSet,
  };
  const missing = VOICE_AGENT_REQUIREMENTS.filter((requirement) => !has[requirement]);
  const configured = VOICE_AGENT_REQUIREMENTS.some(
    (requirement) => requirement !== 'ACTIVE' && has[requirement],
  );

  if (missing.length === 0) {
    return { state: 'LIVE', missing };
  }
  return { state: configured ? 'PARTLY_CONFIGURED' : 'NOT_CONFIGURED', missing };
};
