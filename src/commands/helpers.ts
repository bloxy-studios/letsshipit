import prompts from 'prompts';
import pc from 'picocolors';
import type { CommitStyle, DiffContext, ProjectAnalysis, ResolvedConfig, ShipitConfig } from '../types.js';
import { ShipitError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';
import { resolveConfig } from '../config/load.js';
import { OpenRouterProvider } from '../ai/openrouter.js';
import type { AiProvider } from '../ai/provider.js';

export interface BaseOptions {
  yes?: boolean;
  json?: boolean;
  dryRun?: boolean;
  model?: string;
  quiet?: boolean;
}

export function isNonInteractive(options: BaseOptions): boolean {
  return options.yes === true || options.json === true || !process.stdin.isTTY;
}

export function assertInteractive(options: BaseOptions, message: string): void {
  if (isNonInteractive(options)) {
    throw new ShipitError(message);
  }
}

export async function confirmOrSkip(
  message: string,
  options: BaseOptions,
  defaultValue = true,
): Promise<boolean> {
  if (options.yes) return true;
  assertInteractive(options, `${message} Pass --yes to continue non-interactively.`);

  const response = await prompts({
    type: 'confirm',
    name: 'value',
    message,
    initial: defaultValue,
  });

  return response.value === true;
}

export async function resolveAiProvider(
  cwd: string,
  options: BaseOptions,
  configOverrides: ShipitConfig = {},
): Promise<{ provider: AiProvider; config: ResolvedConfig }> {
  const config = await resolveConfig(
    cwd,
    options.model
      ? {
          ...configOverrides,
          openrouter: {
            ...configOverrides.openrouter,
            model: options.model,
          },
        }
      : configOverrides,
  );
  return { provider: new OpenRouterProvider(config), config };
}

export function printWarnings(diff: DiffContext, options: BaseOptions): void {
  const logger = createLogger({ json: options.json || options.quiet });
  for (const warning of diff.warnings) {
    logger.warn(warning);
  }
}

export function renderProjectSummary(analysis: ProjectAnalysis): string {
  return [
    `${pc.bold('Project')}: ${analysis.projectLabel}`,
    `${pc.bold('Package manager')}: ${analysis.packageManager}`,
    `${pc.bold('Git repo')}: ${analysis.git.isRepo ? 'yes' : 'no'}`,
    analysis.git.branch ? `${pc.bold('Branch')}: ${analysis.git.branch}` : undefined,
    analysis.git.remoteUrl ? `${pc.bold('Remote')}: ${analysis.git.remoteUrl}` : undefined,
    `${pc.bold('Changed files')}: ${analysis.git.changed.length}`,
    `${pc.bold('Staged files')}: ${analysis.git.staged.length}`,
    `${pc.bold('Untracked files')}: ${analysis.git.untracked.length}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function normalizeCommitStyle(value: unknown, fallback: CommitStyle): CommitStyle {
  if (value === 'conventional' || value === 'simple' || value === 'detailed' || value === 'emoji') {
    return value;
  }
  return fallback;
}
