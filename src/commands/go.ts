import prompts from 'prompts';
import type { Command } from 'commander';
import { createLogger } from '../core/logger.js';
import { analyzeProject } from '../core/project.js';
import { printJson } from '../utils/json.js';
import { initCommand } from './init.js';
import { checkCommand } from './check.js';
import { stageCommand } from './stage.js';
import { commitCommand } from './commit.js';
import { pushCommand } from './push.js';
import { prCommand } from './pr.js';
import { confirmOrSkip, isNonInteractive, renderProjectSummary } from './helpers.js';
import { ShipitError } from '../core/errors.js';

interface GoOptions {
  yes?: boolean;
  pr?: boolean;
  draft?: boolean;
  base?: string;
  runChecks?: boolean;
  style?: string;
  dryRun?: boolean;
  json?: boolean;
  model?: string;
}

export function registerGoCommand(program: Command): void {
  program
    .command('go')
    .description('Full flow: analyze, stage, commit, push, and create PR')
    .option('--yes', 'accept defaults and do not prompt')
    .option('--no-pr', 'skip pull request creation')
    .option('--draft', 'create draft PR')
    .option('--base <branch>', 'PR base branch')
    .option('--run-checks', 'run checks before committing')
    .option('--style <style>', 'commit style')
    .option('--dry-run', 'show planned flow without mutating state')
    .option('--json', 'output JSON')
    .option('--model <model>', 'OpenRouter model override')
    .action(async (options: GoOptions) => {
      await goCommand(process.cwd(), options);
    });
}

export async function goCommand(cwd: string, options: GoOptions = {}) {
  const logger = createLogger({ json: options.json });
  let analysis = await analyzeProject(cwd);
  const plan: string[] = [];

  if (!options.json) logger.info(renderProjectSummary(analysis));

  if (!analysis.git.isRepo) {
    plan.push('initialize git');
  }
  if (options.runChecks) plan.push('run checks');
  plan.push('stage safe changes', 'generate commit message', 'commit', 'push');
  if (options.pr !== false) plan.push('create pull request');

  if (options.dryRun) {
    const result = { success: true, dryRun: true, plan };
    if (options.json) printJson(result);
    else logger.info(`Dry run flow:\n${plan.map((step) => `  - ${step}`).join('\n')}`);
    return result;
  }

  if (!analysis.git.isRepo) {
    const ok = options.yes || (await confirmOrSkip('Git is not initialized. Initialize it now?', options, true));
    if (!ok) throw new ShipitError('Cannot continue without a Git repository.', 'NOT_GIT_REPO');
    await initCommand(cwd, { yes: true, branch: 'main', quiet: options.json });
    analysis = await analyzeProject(cwd);
  }

  if (options.runChecks) {
    await checkCommand(cwd, { quiet: options.json });
  } else if (!isNonInteractive(options)) {
    const response = await prompts({
      type: 'confirm',
      name: 'runChecks',
      message: 'Run checks before committing?',
      initial: false,
    });
    if (response.runChecks) await checkCommand(cwd, { quiet: options.json });
  }

  await stageCommand(cwd, [], { all: true, quiet: options.json });
  const commitResult = await commitCommand(cwd, {
    yes: options.yes,
    style: options.style,
    model: options.model,
    quiet: options.json,
  });
  const pushResult = await pushCommand(cwd, { yes: options.yes, quiet: options.json });
  const prResult =
    options.pr === false
      ? undefined
      : await prCommand(cwd, {
          yes: options.yes,
          draft: options.draft,
          base: options.base,
          model: options.model,
          quiet: options.json,
        });

  const result = { success: true, commit: commitResult, push: pushResult, pr: prResult };
  if (options.json) printJson(result);
  else logger.success('Ship flow complete.');
  return result;
}
