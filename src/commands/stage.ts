import { minimatch } from 'minimatch';
import prompts from 'prompts';
import type { Command } from 'commander';
import { getStatus, stageFiles } from '../core/git.js';
import { createLogger } from '../core/logger.js';
import { filterSafeFiles } from '../core/safety.js';
import { ShipitError } from '../core/errors.js';
import { printJson } from '../utils/json.js';
import { isNonInteractive } from './helpers.js';

interface StageOptions {
  all?: boolean;
  interactive?: boolean;
  exclude?: string[];
  dryRun?: boolean;
  json?: boolean;
  quiet?: boolean;
}

export function registerStageCommand(program: Command): void {
  program
    .command('stage')
    .description('Stage files safely')
    .argument('[files...]', 'files to stage')
    .option('--all', 'stage all safe files')
    .option('--interactive', 'select files interactively')
    .option('--exclude <pattern>', 'exclude glob pattern', collect, [])
    .option('--dry-run', 'show what would be staged')
    .option('--json', 'output JSON')
    .action(async (files: string[], options: StageOptions) => {
      await stageCommand(process.cwd(), files, options);
    });
}

export async function stageCommand(cwd: string, files: string[] = [], options: StageOptions = {}) {
  const logger = createLogger({ json: options.json || options.quiet });
  const status = await getStatus(cwd);

  if (!status.isRepo) {
    throw new ShipitError('Not a Git repository. Run `shipit init` first.', 'NOT_GIT_REPO');
  }

  const candidates = applyExcludes(files.length > 0 ? files : status.changed, options.exclude ?? []);
  let selected = candidates;

  if (!options.all && files.length === 0) {
    if (isNonInteractive(options) && !options.interactive) {
      throw new ShipitError('No files provided. Use `shipit stage --all` in non-interactive mode.');
    }

    const { safe, sensitive } = filterSafeFiles(candidates);
    if (safe.length === 0) {
      throw new ShipitError('No safe files to stage.');
    }

    const response = await prompts({
      type: 'multiselect',
      name: 'files',
      message: 'Select files to stage',
      choices: safe.map((file) => ({ title: file, value: file, selected: true })),
      min: 1,
    });

    selected = response.files ?? [];
    if (sensitive.length > 0) {
      logger.warn(`Skipped sensitive files: ${sensitive.join(', ')}`);
    }
  }

  const { safe, sensitive } = filterSafeFiles(selected);

  if (options.dryRun) {
    const result = { success: true, dryRun: true, staged: safe, skipped: sensitive };
    if (options.json) printJson(result);
    else if (!options.quiet) {
      logger.info(`Would stage ${safe.length} file(s):`);
      for (const file of safe) logger.info(`  ${file}`);
      if (sensitive.length > 0) logger.warn(`Would skip sensitive files: ${sensitive.join(', ')}`);
    }
    return result;
  }

  const result = await stageFiles(cwd, safe);
  const output = { success: true, staged: result.staged, skipped: [...sensitive, ...result.skipped] };

  if (options.json) printJson(output);
  else if (!options.quiet) {
    logger.success(`Staged ${output.staged.length} file(s).`);
    if (output.skipped.length > 0) logger.warn(`Skipped sensitive files: ${output.skipped.join(', ')}`);
  }

  return output;
}

function applyExcludes(files: string[], excludes: string[]): string[] {
  if (excludes.length === 0) return files;
  return files.filter((file) => !excludes.some((pattern) => minimatch(file, pattern)));
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}
