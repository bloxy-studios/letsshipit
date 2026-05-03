import { z } from 'zod';
import type { CommitStyle, ResolvedConfig, ShipitConfig } from '../types.js';

export const commitStyleSchema = z.enum(['conventional', 'simple', 'detailed', 'emoji']);

export const shipitConfigSchema = z
  .object({
    openrouter: z
      .object({
        apiKey: z.string().min(1).optional(),
        model: z.string().min(1).optional(),
      })
      .optional(),
    commit: z
      .object({
        style: commitStyleSchema.optional(),
      })
      .optional(),
    pr: z
      .object({
        base: z.string().min(1).optional(),
        useGithubCli: z.boolean().optional(),
      })
      .optional(),
    checks: z
      .object({
        lint: z.string().min(1).optional(),
        test: z.string().min(1).optional(),
        build: z.string().min(1).optional(),
      })
      .optional(),
    model: z.string().min(1).optional(),
    commitStyle: commitStyleSchema.optional(),
    defaultBaseBranch: z.string().min(1).optional(),
    runChecksBeforeCommit: z.boolean().optional(),
  })
  .passthrough();

export const defaultConfig: ResolvedConfig = {
  openrouter: {
    model: 'openai/gpt-4o-mini',
  },
  commit: {
    style: 'conventional',
  },
  pr: {
    base: 'main',
    useGithubCli: true,
  },
  checks: {},
};

export function normalizeConfig(input: unknown): ShipitConfig {
  const parsed = shipitConfigSchema.parse(input ?? {});
  const normalized: ShipitConfig = {
    openrouter: { ...parsed.openrouter },
    commit: { ...parsed.commit },
    pr: { ...parsed.pr },
    checks: { ...parsed.checks },
  };

  if (parsed.model) normalized.openrouter = { ...normalized.openrouter, model: parsed.model };
  if (parsed.commitStyle) normalized.commit = { ...normalized.commit, style: parsed.commitStyle };
  if (parsed.defaultBaseBranch) normalized.pr = { ...normalized.pr, base: parsed.defaultBaseBranch };

  return pruneEmpty(normalized);
}

export function isCommitStyle(value: unknown): value is CommitStyle {
  return commitStyleSchema.safeParse(value).success;
}

function pruneEmpty(config: ShipitConfig): ShipitConfig {
  return Object.fromEntries(
    Object.entries(config).filter(([, value]) => {
      if (!value || typeof value !== 'object') return value !== undefined;
      return Object.keys(value).length > 0;
    }),
  ) as ShipitConfig;
}
