import type { Command } from 'commander';
import { buildDiffContext } from '../core/diff.js';
import { getCommitsSince, getStagedFiles } from '../core/git.js';
import { createLogger } from '../core/logger.js';
import { analyzeProject } from '../core/project.js';
import { ShipitError } from '../core/errors.js';
import { resolveConfig } from '../config/load.js';
import { printJson } from '../utils/json.js';
import { confirmOrSkip, normalizeCommitStyle, printWarnings, resolveAiProvider } from './helpers.js';

interface SuggestOptions {
  staged?: boolean;
  all?: boolean;
  style?: string;
  json?: boolean;
  model?: string;
  yes?: boolean;
}

export function registerSuggestCommand(program: Command): void {
  program
    .command('suggest')
    .description('Generate a commit message without committing')
    .option('--staged', 'use staged diff')
    .option('--all', 'use all safe changes')
    .option('--style <style>', 'commit style: conventional, simple, detailed, emoji')
    .option('--json', 'output JSON')
    .option('--model <model>', 'OpenRouter model override')
    .option('--yes', 'do not prompt')
    .action(async (options: SuggestOptions) => {
      await suggestCommand(process.cwd(), options);
    });
}

export async function suggestCommand(cwd: string, options: SuggestOptions = {}) {
  const logger = createLogger({ json: options.json });
  const analysis = await analyzeProject(cwd);

  if (!analysis.git.isRepo) {
    throw new ShipitError('Not a Git repository. Run `shipit init` first.', 'NOT_GIT_REPO');
  }

  const stagedFiles = await getStagedFiles(cwd);
  let mode: 'staged' | 'unstaged' | 'all' = options.all ? 'all' : 'staged';

  if (mode === 'staged' && stagedFiles.length === 0) {
    const useUnstaged = await confirmOrSkip('No staged diff. Use unstaged safe changes instead?', options, true);
    if (!useUnstaged) throw new ShipitError('No staged changes to suggest a commit message for.', 'NO_STAGED_DIFF');
    mode = 'unstaged';
  }

  const diff = await buildDiffContext(cwd, mode);
  if (!diff.diff) {
    throw new ShipitError('No safe diff available for commit message generation.', 'NO_SAFE_DIFF');
  }

  printWarnings(diff, options);
  const config = await resolveConfig(cwd, {
    openrouter: { model: options.model },
  });
  const style = normalizeCommitStyle(options.style, config.commit.style);
  const { provider } = await resolveAiProvider(cwd, options);
  const spinner = logger.spinner('Generating commit message...').start();
  const recentCommits = analysis.defaultBranch
    ? await getCommitsSince(cwd, analysis.defaultBranch).catch(() => [])
    : [];
  const message = await provider.generateCommitMessage({ analysis, diff, style, recentCommits });
  spinner.succeed('Generated commit message.');

  if (options.json) printJson({ success: true, message });
  else logger.info(`\n${message}`);

  return message;
}
