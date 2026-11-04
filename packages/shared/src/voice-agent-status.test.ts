import { describe, expect, it } from 'vitest';
import { voiceAgentStatus, type VoiceAgentStatusInput } from './voice-agent-status.js';

const complete: VoiceAgentStatusInput = {
  active: true,
  sarvamAppId: 'app_1',
  sarvamDeploymentId: 'dep_1',
  agentPhone: '+918000012345',
  toolSecretSet: true,
  webhookSecretSet: true,
};

describe('voiceAgentStatus', () => {
  it('is live only with every part present', () => {
    expect(voiceAgentStatus(complete)).toEqual({ state: 'LIVE', missing: [] });
  });

  it('is not configured for a clinic straight out of the console, active or not', () => {
    // The row the console creates: switched on, nothing else. The old check called this Live.
    const shell = {
      active: true,
      sarvamAppId: null,
      sarvamDeploymentId: null,
      agentPhone: null,
      toolSecretSet: false,
      webhookSecretSet: false,
    };

    expect(voiceAgentStatus(shell).state).toBe('NOT_CONFIGURED');
    expect(voiceAgentStatus(null).state).toBe('NOT_CONFIGURED');
  });

  it('names exactly what is missing when part of it is there', () => {
    const result = voiceAgentStatus({ ...complete, agentPhone: null, webhookSecretSet: false });

    expect(result.state).toBe('PARTLY_CONFIGURED');
    expect(result.missing).toEqual(['AGENT_NUMBER', 'WEBHOOK_SECRET']);
  });

  it('is not live when every secret exists but the agent was never configured', () => {
    const result = voiceAgentStatus({
      ...complete,
      sarvamAppId: null,
      sarvamDeploymentId: null,
      agentPhone: null,
    });

    expect(result.state).toBe('PARTLY_CONFIGURED');
    expect(result.missing).toEqual(['SARVAM_APP', 'SARVAM_DEPLOYMENT', 'AGENT_NUMBER']);
  });

  it('is not live when fully configured but switched off', () => {
    expect(voiceAgentStatus({ ...complete, active: false })).toEqual({
      state: 'PARTLY_CONFIGURED',
      missing: ['ACTIVE'],
    });
  });

  it('treats a blank identifier as missing', () => {
    expect(voiceAgentStatus({ ...complete, sarvamAppId: '  ' }).missing).toEqual(['SARVAM_APP']);
  });
});
