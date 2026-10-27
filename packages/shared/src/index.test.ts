import { describe, expect, it } from 'vitest';
import { SHARED_CONTRACT_VERSION } from './index.js';

describe('shared package', () => {
  it('exposes a semver contract version', () => {
    expect(SHARED_CONTRACT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
