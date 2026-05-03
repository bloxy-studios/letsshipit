import type { Command } from 'commander';
import { resolveConfig } from '../config/load.js';
import { runChecks, selectChecks } from '../core/checks.js';
import { ShipitError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';
import { analyzeProject } from '../core/project.js';
import { printJson } from '../utils/json.js';

interface CheckOptions {
  lint?: boolean;
  test?: boolean;
  build?: boolean;
  beforeCommit?: boolean;
  dryRun?: boolean;
  json?: boolean;
  quiet?: boolean;
}

export function registerCheckCommand(program: Command): void {
  program
    .command('check')
    .description('Run detected or configured project checks')
    .option('--lint', 'run lint check')
    .option('--test', 'run test check')
    .option('--build', 'run build check')
    .option('--before-commit', 'alias for default selected checks')
    .option('--dry-run', 'show checks without running them')
    .option('--json', 'output JSON')
    .action(async (options: CheckOptions) => {
      await checkCommand(process.cwd(), options);
    });
}

export async function checkCommand(cwd: string, options: CheckOptions = {}) {
  const logger = createLogger({ json: options.json || options.quiet });
  const analysis = await analyzeProject(cwd);
  const config = await resolveConfig(cwd);
  const checks = { ...analysis.checks, ...config.checks };
  const selected = selectChecks(checks, options);

  if (selected.length === 0) {
    throw new ShipitError('No checks detected. Configure checks in `.shipit.json` or package scripts.', 'NO_CHECKS');
  }

  if (!options.json && !options.quiet) {
    logger.info(`Running checks:\n${selected.map((name) => `  ${checks[name]}`).join('\n')}`);
  }

  const results = await runChecks(cwd, checks, selected, { json: options.json, dryRun: options.dryRun });
  const output = { success: true, results };
  if (options.json) printJson(output);
  else if (!options.quiet) logger.success('Checks passed.');
  return output;
}
