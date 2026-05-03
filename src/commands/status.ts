import type { Command } from 'commander';
import pc from 'picocolors';
import { getStatus } from '../core/git.js';
import { createLogger } from '../core/logger.js';
import { printJson } from '../utils/json.js';

interface StatusOptions {
  json?: boolean;
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show enhanced Git status')
    .option('--json', 'output JSON')
    .action(async (options: StatusOptions) => {
      await statusCommand(process.cwd(), options);
    });
}

export async function statusCommand(cwd: string, options: StatusOptions = {}) {
  const status = await getStatus(cwd);

  if (options.json) {
    printJson(status);
    return status;
  }

  const logger = createLogger();
  if (!status.isRepo) {
    logger.warn('Not a Git repository.');
    return status;
  }

  logger.info(`${pc.bold('Branch')}: ${status.branch ?? 'unknown'}`);
  logger.info(`${pc.bold('Upstream')}: ${status.upstream ?? 'none'}`);
  logger.info(`${pc.bold('Remote')}: ${status.remoteUrl ?? 'none'}`);
  logger.info(`${pc.bold('Clean')}: ${status.clean ? 'yes' : 'no'}`);

  printFiles('Staged', status.staged);
  printFiles('Unstaged', status.unstaged);
  printFiles('Untracked', status.untracked);

  return status;
}

function printFiles(label: string, files: string[]): void {
  if (files.length === 0) return;
  process.stdout.write(`\n${pc.bold(label)}\n`);
  for (const file of files) process.stdout.write(`  ${file}\n`);
}
