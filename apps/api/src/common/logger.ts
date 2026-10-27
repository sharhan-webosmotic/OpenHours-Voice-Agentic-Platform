import { pino } from 'pino';
import { config } from '../config.js';

/**
 * Redaction is mandatory (root CLAUDE.md rule 4: never log patient data or secrets).
 * This list is the safety net, not the primary control: callers log IDs only.
 * Extend it whenever a new PHI-bearing or secret field enters a log path.
 */
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.refreshToken',
  '*.accessToken',
  '*.secret',
  '*.apiKey',
  '*.name',
  '*.firstName',
  '*.lastName',
  '*.patientName',
  '*.phone',
  '*.phoneNumber',
  '*.email',
  '*.dateOfBirth',
  '*.dob',
  '*.address',
  '*.notes',
  '*.transcript',
  '*.prescription',
  '*.diagnosis',
  '*.recordingUrl',
];

export const logger = pino({
  level: config.LOG_LEVEL,
  redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
  // Pretty output is a development convenience only; staging and production emit JSON.
  ...(config.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { translateTime: 'SYS:standard' } } }
    : {}),
});

export type Logger = typeof logger;
