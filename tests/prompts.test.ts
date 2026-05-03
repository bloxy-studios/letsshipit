import { describe, expect, it } from 'vitest';
import { buildCommitMessages } from '../src/ai/prompts.js';
import type { CommitMessageInput } from '../src/ai/provider.js';

describe('commit prompt formatting', () => {
  it('includes conventional instructions and sanitized diff', () => {
    const input: CommitMessageInput = {
      style: 'conventional',
      analysis: {
        cwd: '/tmp/app',
        git: {
          isRepo: true,
          branch: 'feat/auth',
          staged: ['src/auth.ts'],
          unstaged: [],
          untracked: [],
          changed: ['src/auth.ts'],
          files: [],
          clean: false,
        },
        projectType: 'typescript',
        projectLabel: 'Node.js / TypeScript',
        packageManager: 'pnpm',
        scripts: {},
        checks: {},
        sensitiveFiles: [],
      },
      diff: {
        diff: '+export const auth = true;',
        stat: 'src/auth.ts | 1 +',
        files: ['src/auth.ts'],
        excludedSensitiveFiles: [],
        truncated: false,
        warnings: [],
      },
    };

    const messages = buildCommitMessages(input);
    expect(messages[1].content).toContain('Write a Conventional Commit message.');
    expect(messages[1].content).toContain('Branch: feat/auth');
    expect(messages[1].content).toContain('+export const auth = true;');
  });
});
