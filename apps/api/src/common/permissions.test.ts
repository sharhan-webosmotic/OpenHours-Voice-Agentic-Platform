import { describe, expect, it } from 'vitest';
import type { Role } from '@clinicai/shared';
import { ForbiddenError, UnauthorizedError } from './errors.js';
import { runWithContext } from './request-context.js';
import {
  MASKED_PATIENT_FIELDS,
  currentPrincipal,
  maskPatientFields,
  requirePermission,
  scopeFilter,
  shouldMask,
  type Principal,
} from './permissions.js';

const principal = (role: Role, organisationId: string | undefined = 'org-1'): Principal => ({
  userId: 'usr-1',
  role,
  organisationId,
});

describe('currentPrincipal', () => {
  const context = { requestId: 'req-1' };

  it('reads the actor from the request context', () => {
    runWithContext({ ...context, userId: 'usr-1', role: 'DOCTOR', organisationId: 'org-1' }, () => {
      expect(currentPrincipal()).toEqual({
        userId: 'usr-1',
        role: 'DOCTOR',
        organisationId: 'org-1',
      });
    });
  });

  /**
   * The role used to be cast with `as Role`, asserting something nothing had verified, so
   * an unrecognised value reached the matrix and threw a TypeError there. Review finding
   * I13. The token verifier refuses such a claim first, so reaching this is a bug rather
   * than an attack, and it must fail closed.
   */
  it('refuses a role the matrix does not list instead of casting it', () => {
    runWithContext({ ...context, userId: 'usr-1', role: 'ADMIN', organisationId: 'org-1' }, () => {
      expect(() => currentPrincipal()).toThrow(UnauthorizedError);
    });
  });

  it('does not name the role to the client', () => {
    runWithContext({ ...context, userId: 'usr-1', role: 'ADMIN' }, () => {
      try {
        currentPrincipal();
        expect.unreachable('should have thrown');
      } catch (error) {
        expect((error as UnauthorizedError).detail).toBe('Authentication is required.');
      }
    });
  });
});

describe('requirePermission', () => {
  it('returns the scope so the caller must apply it', () => {
    // A boolean gate would let a doctor read the whole clinic; the scope is the point.
    expect(requirePermission('appointments', 'read', principal('DOCTOR'))).toBe('own');
    expect(requirePermission('appointments', 'read', principal('CLINIC_OWNER'))).toBe('all');
    expect(requirePermission('patients', 'read', principal('SUPER_ADMIN', undefined))).toBe(
      'masked',
    );
  });

  it('throws Forbidden for a denied action', () => {
    expect(() =>
      requirePermission('recordings', 'read', principal('SUPER_ADMIN', undefined)),
    ).toThrow(ForbiddenError);
    expect(() => requirePermission('prescriptions', 'read', principal('STAFF'))).toThrow(
      ForbiddenError,
    );
    expect(() => requirePermission('appointments', 'delete', principal('DOCTOR'))).toThrow(
      ForbiddenError,
    );
  });

  it('does not leak the role or resource to the client', () => {
    try {
      requirePermission('platform_users', 'read', principal('STAFF'));
      expect.unreachable('should have thrown');
    } catch (error) {
      // The detail is generic; the specifics are in the message, which is logged only.
      expect((error as ForbiddenError).detail).toBe('You do not have permission to do that.');
    }
  });
});

describe('patient field masking', () => {
  it('nulls every identifying field and keeps the rest', () => {
    const masked = maskPatientFields({
      id: 'pat-1',
      organisationId: 'org-1',
      fullName: 'Priya Sharma',
      phone: '+919876500000',
      dateOfBirth: new Date('1990-01-01'),
      notes: 'chest pain',
      createdAt: new Date('2026-01-01'),
    });

    for (const field of MASKED_PATIENT_FIELDS) {
      if (field in masked) {
        expect(masked[field as keyof typeof masked]).toBeNull();
      }
    }
    // The row is still returned: a platform admin needs to see THAT a record exists in
    // order to diagnose a booking problem, just not who it is for.
    expect(masked.id).toBe('pat-1');
    expect(masked.organisationId).toBe('org-1');
    expect(masked.createdAt).toBeInstanceOf(Date);
  });

  it('does not mutate the row it was given', () => {
    const row = { fullName: 'Priya Sharma' };
    maskPatientFields(row);
    expect(row.fullName).toBe('Priya Sharma');
  });

  it('masks only when the scope is masked and no session is active', () => {
    expect(shouldMask('masked', false)).toBe(true);
    // A support session unmasks one organisation.
    expect(shouldMask('masked', true)).toBe(false);
    // A clinic role was never masked to begin with.
    expect(shouldMask('all', false)).toBe(false);
    expect(shouldMask('own', false)).toBe(false);
  });
});

describe('scopeFilter', () => {
  it('turns "own" into a doctor filter', () => {
    expect(scopeFilter('own', principal('DOCTOR'))).toEqual({
      kind: 'own-doctor',
      doctorUserId: 'usr-1',
    });
  });

  it('turns "assigned" into a user filter', () => {
    expect(scopeFilter('assigned', principal('STAFF'))).toEqual({
      kind: 'assigned-user',
      userId: 'usr-1',
    });
  });

  it('fails closed for a clinic opt-in scope', () => {
    // Staff recordings require recordings_visible_to_staff. Until the caller checks the
    // setting this is a denial, so forgetting the check cannot grant access.
    expect(scopeFilter('clinic_opt_in', principal('STAFF'))).toEqual({
      kind: 'denied-without-opt-in',
    });
  });

  it('adds nothing for an unrestricted scope', () => {
    expect(scopeFilter('all', principal('CLINIC_OWNER'))).toEqual({ kind: 'none' });
  });
});
