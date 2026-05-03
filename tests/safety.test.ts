import { describe, expect, it } from 'vitest';
import { filterSafeFiles, isSensitiveFile } from '../src/core/safety.js';
import { containsSuspiciousSecret, maskSecret, redactText } from '../src/utils/redact.js';

describe('safety', () => {
  it('detects sensitive files', () => {
    expect(isSensitiveFile('.env')).toBe(true);
    expect(isSensitiveFile('.env.local')).toBe(true);
    expect(isSensitiveFile('certs/prod.pem')).toBe(true);
    expect(isSensitiveFile('keys/private.key')).toBe(true);
    expect(isSensitiveFile('.ssh/id_rsa')).toBe(true);
    expect(isSensitiveFile('src/index.ts')).toBe(false);
  });

  it('filters safe files', () => {
    expect(filterSafeFiles(['src/app.ts', '.env.local'])).toEqual({
      safe: ['src/app.ts'],
      sensitive: ['.env.local'],
    });
  });

  it('redacts secrets', () => {
    const input = 'OPENROUTER_API_KEY=sk-or-v1-secret\npassword=hunter2';
    const redacted = redactText(input);
    expect(redacted).not.toContain('sk-or-v1-secret');
    expect(redacted).not.toContain('hunter2');
    expect(containsSuspiciousSecret(input)).toBe(true);
  });

  it('masks API keys', () => {
    expect(maskSecret('sk-or-v1-abcdefghijkl')).toMatch(/^sk-o\*+ijkl$/);
  });
});
