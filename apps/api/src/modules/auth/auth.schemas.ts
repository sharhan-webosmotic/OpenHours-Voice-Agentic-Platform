import { z } from 'zod';
import { MINIMUM_PASSWORD_LENGTH } from '../../common/passwords.js';

/**
 * Request schemas. The messages name the constraint, never the submitted value: a
 * rejected body may contain a password.
 */

export const loginBodySchema = z.object({
  email: z.string().email().max(320),
  // No minimum on login: an old password that predates the policy must still work, and a
  // length rule here would leak the policy to an attacker guessing.
  password: z.string().min(1).max(1024),
});

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(MINIMUM_PASSWORD_LENGTH).max(1024),
});

export const pairDeviceBodySchema = z.object({
  code: z.string().trim().length(6),
  label: z.string().trim().min(1).max(120),
});

export const pairingCodeBodySchema = z.object({
  // Nothing is required to request a code; the organisation comes from the token.
});
