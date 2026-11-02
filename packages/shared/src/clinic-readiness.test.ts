import { describe, expect, it } from 'vitest';
import {
  READINESS_REQUIREMENTS,
  READINESS_SECTIONS,
  clinicReadiness,
  type ReadinessInput,
} from './clinic-readiness.js';

/**
 * Readiness is advisory and must stay honest in both directions: a clinic with nothing
 * collected must not read as ready, and a fully collected one must not report a phantom
 * gap that nobody can close.
 */

const nothingCollected: ReadinessInput = {
  name: null,
  timezone: null,
  clinicPhone: null,
  addressLine1: null,
  city: null,
  hoursCollected: false,
  openWeekdays: [],
  activeServiceCount: 0,
  activeDoctorCount: 0,
  slotGranularityMinutes: null,
  maximumAdvanceDays: null,
  greeting: null,
  languageCount: 0,
  fullyBookedResponse: null,
  escalationRules: null,
  recordingConsentMode: null,
  consentConfirmed: false,
  sarvamAppId: null,
  sarvamDeploymentId: null,
  agentPhone: null,
  toolSecretSet: false,
  promptVersion: null,
};

const fullyCollected: ReadinessInput = {
  name: 'Sunrise Dental',
  timezone: 'Asia/Kolkata',
  clinicPhone: '+919876543210',
  addressLine1: '12 MG Road',
  city: 'Bengaluru',
  hoursCollected: true,
  openWeekdays: ['MONDAY', 'TUESDAY'],
  activeServiceCount: 3,
  activeDoctorCount: 2,
  slotGranularityMinutes: 15,
  maximumAdvanceDays: 60,
  greeting: 'Thank you for calling Sunrise Dental.',
  languageCount: 2,
  fullyBookedResponse: 'I can take your number and have the desk call you back.',
  escalationRules: 'Transfer anything clinical to the desk.',
  recordingConsentMode: 'ANNOUNCEMENT',
  consentConfirmed: true,
  sarvamAppId: 'app_123',
  sarvamDeploymentId: 'dep_123',
  agentPhone: '+919000000001',
  toolSecretSet: true,
  promptVersion: 'v0-placeholder',
};

describe('clinicReadiness', () => {
  it('reports every requirement missing for a clinic with nothing collected', () => {
    const readiness = clinicReadiness(nothingCollected);

    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toHaveLength(READINESS_REQUIREMENTS.length);
    expect(readiness.satisfiedCount).toBe(0);
    expect(readiness.incompleteSections).toEqual(READINESS_SECTIONS);
  });

  it('reports ready with nothing missing once everything is collected', () => {
    const readiness = clinicReadiness(fullyCollected);

    expect(readiness.ready).toBe(true);
    expect(readiness.missing).toEqual([]);
    expect(readiness.incompleteSections).toEqual([]);
    expect(readiness.satisfiedCount).toBe(readiness.totalCount);
  });

  it('treats whitespace as uncollected, so a space bar does not make a clinic ready', () => {
    const readiness = clinicReadiness({ ...fullyCollected, greeting: '   ' });

    expect(readiness.ready).toBe(false);
    expect(readiness.missing.map((requirement) => requirement.key)).toEqual([
      'agentProfile.greeting',
    ]);
  });

  it('distinguishes a weekly off from hours never having been asked about', () => {
    // Hours collected, every weekday closed: the hours were asked about, and the answer
    // leaves the clinic with nothing bookable. Both facts are reported.
    const closedAllWeek = clinicReadiness({
      ...fullyCollected,
      hoursCollected: true,
      openWeekdays: [],
    });
    expect(closedAllWeek.missing.map((requirement) => requirement.key)).toEqual([
      'hours.openAtLeastOneDay',
    ]);

    const neverAsked = clinicReadiness({
      ...fullyCollected,
      hoursCollected: false,
      openWeekdays: [],
    });
    expect(neverAsked.missing.map((requirement) => requirement.key)).toEqual([
      'hours.collected',
      'hours.openAtLeastOneDay',
    ]);
  });

  it('requires a consent decision even when the decision is not to record', () => {
    const readiness = clinicReadiness({
      ...fullyCollected,
      recordingConsentMode: 'NOT_RECORDED',
    });
    expect(readiness.ready).toBe(true);
  });

  it('is not satisfied by a Sarvam mapping without its tool secret', () => {
    const readiness = clinicReadiness({ ...fullyCollected, toolSecretSet: false });

    expect(readiness.ready).toBe(false);
    expect(readiness.incompleteSections).toEqual(['sarvamMapping']);
  });

  it('exposes a stable, unique key for every requirement', () => {
    const keys = READINESS_REQUIREMENTS.map((requirement) => requirement.key);
    expect(new Set(keys).size).toBe(keys.length);

    // Every requirement belongs to a declared section, so the console can always place it
    // beside the form that closes it.
    for (const requirement of READINESS_REQUIREMENTS) {
      expect(READINESS_SECTIONS).toContain(requirement.section);
    }
  });
});
