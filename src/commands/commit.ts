import prompts from 'prompts';
import type { Command } from 'commander';
import {
  commit as gitCommit,
  getCommitsSince,
  getLastCommitHash,
  getStagedFiles,
  getStatus,
  stageAllSafe,
  stageFiles,
} from '../core/git.js';
import { buildDiffContext } from '../core/diff.js';
import { createLogger } from '../core/logger.js';
import { analyzeProject } from '../core/project.js';
import { ShipitError } from '../core/errors.js';
import { resolveConfig } from '../config/load.js';
import { printJson } from '../utils/json.js';
import { normalizeCommitStyle, printWarnings, resolveAiProvider, isNonInteractive } from './helpers.js';

interface CommitOptions {
  all?: boolean;
  message?: string;
  yes?: boolean;
  dryRun?: boolean;
  style?: string;
  scope?: string;
  type?: string;
  model?: string;
  json?: boolean;
  quiet?: boolean;
}

export function registerCommitCommand(program: Command): void {
  program
    .command('commit')
    .description('Generate and create a commit')
    .option('--all', 'stage all safe files before committing')
    .option('-m, --message <message>', 'commit message')
    .option('--yes', 'accept defaults and do not prompt')
    .option('--dry-run', 'show operations without mutating state')
    .option('--style <style>', 'commit style')
    .option('--scope <scope>', 'conventional commit scope')
    .option('--type <type>', 'conventional commit type')
    .option('--model <model>', 'OpenRouter model override')
    .option('--json', 'output JSON')
    .action(async (options: CommitOptions) => {
      await commitCommand(process.cwd(), options);
    });
}

export async function commitCommand(cwd: string, options: CommitOptions = {}) {
  const logger = createLogger({ json: options.json || options.quiet });
  const analysis = await analyzeProject(cwd);

  if (!analysis.git.isRepo) {
    throw new ShipitError('Not a Git repository. Run `shipit init` first.', 'NOT_GIT_REPO');
  }

  let stagedFiles = await getStagedFiles(cwd);
  let stagedByShipit: string[] = [];
  let skipped: string[] = [];

  if (stagedFiles.length === 0) {
    if (options.dryRun && !options.all) {
      const result = {
        success: true,
        dryRun: true,
        stagedFiles: [],
        message: options.message,
        note: 'No staged files; nothing would be committed.',
      };
      if (options.json) printJson(result);
      else if (!options.quiet) logger.info('Dry run: no staged files; nothing would be committed.');
      return result;
    }

    if (options.all) {
      const status = await getStatus(cwd);
      const planned = status.changed;
      if (options.dryRun) {
        const result = { success: true, dryRun: true, wouldStage: planned, message: options.message };
        if (options.json) printJson(result);
        else if (!options.quiet) logger.info(`Dry run: would stage ${planned.length} file(s) and commit.`);
        return result;
      }
      const staged = await stageAllSafe(cwd);
      stagedByShipit = staged.staged;
      skipped = staged.skipped;
    } else if (!isNonInteractive(options)) {
      const response = await prompts({
        type: 'select',
        name: 'mode',
        message: 'No staged files. What should shipit stage?',
        choices: [
          { title: 'Stage all safe files', value: 'all' },
          { title: 'Select files', value: 'select' },
          { title: 'Cancel', value: 'cancel' },
        ],
      });

      if (response.mode === 'cancel' || !response.mode) {
        throw new ShipitError('Commit cancelled.', 'CANCELLED', 0);
      }

      if (response.mode === 'all') {
        const staged = await stageAllSafe(cwd);
        stagedByShipit = staged.staged;
        skipped = staged.skipped;
      } else {
        const status = await getStatus(cwd);
        const select = await prompts({
          type: 'multiselect',
          name: 'files',
          message: 'Select files to stage',
          choices: status.changed.map((file) => ({ title: file, value: file, selected: true })),
          min: 1,
        });
        const staged = await stageFiles(cwd, select.files ?? []);
        stagedByShipit = staged.staged;
        skipped = staged.skipped;
      }
    } else {
      throw new ShipitError('No staged files. Use `shipit commit --all --yes` to stage safe files.', 'NO_STAGED_FILES');
    }
  }

  stagedFiles = await getStagedFiles(cwd);
  if (stagedFiles.length === 0) {
    throw new ShipitError('No staged files to commit.', 'NO_STAGED_FILES');
  }

  let message = options.message;
  if (!message) {
    const diff = await buildDiffContext(cwd, 'staged');
    if (!diff.diff) throw new ShipitError('No safe staged diff available for AI commit generation.', 'NO_SAFE_DIFF');
    printWarnings(diff, options);

    const config = await resolveConfig(cwd, { openrouter: { model: options.model } });
    const style = normalizeCommitStyle(options.style, config.commit.style);
    const { provider } = await resolveAiProvider(cwd, options);
    const recentCommits = analysis.defaultBranch
      ? await getCommitsSince(cwd, analysis.defaultBranch).catch(() => [])
      : [];

    let accepted = false;
    while (!accepted) {
      const spinner = logger.spinner('Generating commit message...').start();
      message = await provider.generateCommitMessage({
        analysis,
        diff,
        style,
        type: options.type,
        scope: options.scope,
        recentCommits,
      });
      spinner.succeed('Generated commit message.');

      if (isNonInteractive(options)) {
        accepted = true;
        break;
      }

      logger.info(`\n${message}\n`);
      const response = await prompts({
        type: 'select',
        name: 'action',
        message: 'Use this commit message?',
        choices: [
          { title: 'Yes', value: 'yes' },
          { title: 'Edit', value: 'edit' },
          { title: 'Regenerate', value: 'regenerate' },
          { title: 'Cancel', value: 'cancel' },
        ],
      });

      if (response.action === 'yes') accepted = true;
      else if (response.action === 'edit') {
        const edit = await prompts({
          type: 'text',
          name: 'message',
          message: 'Commit message',
          initial: message,
        });
        message = edit.message;
        accepted = Boolean(message);
      } else if (response.action === 'cancel' || !response.action) {
        throw new ShipitError('Commit cancelled.', 'CANCELLED', 0);
      }
    }
  }

  if (!message) {
    throw new ShipitError('Commit message is empty.', 'EMPTY_COMMIT_MESSAGE');
  }

  if (options.dryRun) {
    const result = { success: true, dryRun: true, stagedFiles, stagedByShipit, skipped, message };
    if (options.json) printJson(result);
    else if (!options.quiet) logger.info(`Dry run: would commit ${stagedFiles.length} staged file(s) with:\n\n${message}`);
    return result;
  }

  await gitCommit(cwd, message);
  const hash = await getLastCommitHash(cwd);
  const result = { success: true, commit: hash, message, stagedByShipit, skipped };

  if (options.json) printJson(result);
  else if (!options.quiet) logger.success(`Committed ${hash}.`);

  return result;
}
