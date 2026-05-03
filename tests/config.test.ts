import { describe, expect, it, vi } from 'vitest';
import { mergeResolved } from '../src/config/load.js';
import { defaultConfig, normalizeConfig } from '../src/config/schema.js';

describe('config', () => {
  it('normalizes legacy project config keys', () => {
    expect(
      normalizeConfig({
        model: 'anthropic/claude-3.5-sonnet',
        commitStyle: 'simple',
        defaultBaseBranch: 'develop',
      }),
    ).toEqual({
      openrouter: { model: 'anthropic/claude-3.5-sonnet' },
      commit: { style: 'simple' },
      pr: { base: 'develop' },
    });
  });

  it('merges with later config taking precedence', () => {
    const merged = mergeResolved(
      defaultConfig,
      { openrouter: { model: 'global' }, commit: { style: 'simple' } },
      { openrouter: { model: 'project' } },
      { openrouter: { model: 'env' } },
      { openrouter: { model: 'cli' } },
    );

    expect(merged.openrouter.model).toBe('cli');
    expect(merged.commit.style).toBe('simple');
  });

  it('keeps tests isolated from env', () => {
    vi.stubEnv('SHIPIT_MODEL', 'test-model');
    expect(process.env.SHIPIT_MODEL).toBe('test-model');
    vi.unstubAllEnvs();
  });
});
