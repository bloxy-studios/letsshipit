import type { Command } from 'commander';
import { getCurrentBranch, hasUpstream, push as gitPush } from '../core/git.js';
import { createLogger } from '../core/logger.js';
import { ShipitError } from '../core/errors.js';
import { printJson } from '../utils/json.js';
import { confirmOrSkip } from './helpers.js';

interface PushOptions {
  remote?: string;
  branch?: string;
  setUpstream?: boolean;
  forceWithLease?: boolean;
  yes?: boolean;
  dryRun?: boolean;
  json?: boolean;
  quiet?: boolean;
}

export function registerPushCommand(program: Command): void {
  program
    .command('push')
    .description('Push current branch safely')
    .option('--remote <remote>', 'remote name', 'origin')
    .option('--branch <branch>', 'branch to push')
    .option('--set-upstream', 'set upstream')
    .option('--force-with-lease', 'force push with lease')
    .option('--yes', 'do not prompt')
    .option('--dry-run', 'show operations without mutating state')
    .option('--json', 'output JSON')
    .action(async (options: PushOptions) => {
      await pushCommand(process.cwd(), options);
    });
}

export async function pushCommand(cwd: string, options: PushOptions = {}) {
  const logger = createLogger({ json: options.json || options.quiet });
  const branch = options.branch || (await getCurrentBranch(cwd));
  if (!branch) throw new ShipitError('Could not determine current branch.', 'NO_BRANCH');

  let setUpstream = options.setUpstream === true;
  if (!(await hasUpstream(cwd, branch))) {
    if (options.yes) {
      setUpstream = true;
    } else if (!setUpstream) {
      setUpstream = await confirmOrSkip(`No upstream for ${branch}. Push and set upstream?`, options, true);
    }
  }

  if (!options.yes && !options.dryRun) {
    const ok = await confirmOrSkip(`Push ${branch} to ${options.remote || 'origin'}?`, options, true);
    if (!ok) throw new ShipitError('Push cancelled.', 'CANCELLED', 0);
  }

  if (options.dryRun) {
    const result = {
      success: true,
      dryRun: true,
      branch,
      remote: options.remote || 'origin',
      setUpstream,
      forceWithLease: options.forceWithLease === true,
    };
    if (options.json) printJson(result);
    else if (!options.quiet)
      logger.info(`Dry run: would push ${branch} to ${result.remote}${setUpstream ? ' and set upstream' : ''}.`);
    return result;
  }

  await gitPush(cwd, {
    remote: options.remote,
    branch,
    setUpstream,
    forceWithLease: options.forceWithLease,
  });

  const result = { success: true, branch, remote: options.remote || 'origin', setUpstream };
  if (options.json) printJson(result);
  else if (!options.quiet) logger.success(`Pushed ${branch}.`);
  return result;
}
