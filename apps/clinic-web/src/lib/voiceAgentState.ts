import {
  VOICE_AGENT_REQUIREMENT_LABELS,
  type VoiceAgentState,
  type VoiceAgentStatus,
} from '@clinicai/shared';
import type { BadgeKind } from '../components/ui/Table';

/**
 * How the AI receptionist's state reads on screen. The state itself is the server's
 * (`clinic.voiceAgent`); this only words it, so the Overview and Call History cannot disagree.
 */
export const VOICE_AGENT_BADGE: Record<
  VoiceAgentState,
  { readonly label: string; readonly kind: BadgeKind }
> = {
  LIVE: { label: 'Live', kind: 'success' },
  PARTLY_CONFIGURED: { label: 'Partly configured', kind: 'warning' },
  NOT_CONFIGURED: { label: 'Not configured', kind: 'neutral' },
};

/** `the tool secret and the webhook secret`, for "It still needs …". */
export const missingSentence = (status: VoiceAgentStatus): string => {
  const parts = status.missing.map((requirement) => VOICE_AGENT_REQUIREMENT_LABELS[requirement]);
  return parts.length <= 1
    ? (parts[0] ?? '')
    : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1) ?? ''}`;
};

/** One sentence for the clinic: what the agent is doing, or what it still needs. */
export const voiceAgentSentence = (status: VoiceAgentStatus): string => {
  switch (status.state) {
    case 'LIVE':
      return 'Your AI receptionist is answering calls and booking appointments.';
    case 'PARTLY_CONFIGURED':
      return `Your AI receptionist is not taking calls yet. It still needs ${missingSentence(status)}.`;
    case 'NOT_CONFIGURED':
      return 'Your AI receptionist has not been connected to Sarvam yet.';
  }
};
