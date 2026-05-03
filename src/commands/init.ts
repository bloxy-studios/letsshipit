import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import prompts from 'prompts';
import type { Command } from 'commander';
import { addRemote, commit as gitCommit, getLastCommitHash, initGit, isGitRepo, stageAllSafe } from '../core/git.js';
import { createLogger } from '../core/logger.js';
import { analyzeProject, readGitignoreTemplate } from '../core/project.js';
import { pathExists } from '../utils/fs.js';
import { printJson } from '../utils/json.js';
import { assertInteractive, confirmOrSkip, isNonInteractive } from './helpers.js';

interface InitOptions {
  yes?: boolean;
  branch?: string;
  remote?: string;
  gitignore?: string;
  initialCommit?: boolean;
  dryRun?: boolean;
  json?: boolean;
  quiet?: boolean;
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize Git if missing')
    .option('--yes', 'accept defaults and do not prompt')
    .option('--branch <branch>', 'default branch', 'main')
    .option('--remote <url>', 'add origin remote URL')
    .option('--gitignore <template>', 'create .gitignore template')
    .option('--initial-commit', 'create initial commit')
    .option('--dry-run', 'show operations without mutating state')
    .option('--json', 'output JSON')
    .action(async (options: InitOptions) => {
      await initCommand(process.cwd(), options);
    });
}

export async function initCommand(cwd: string, options: InitOptions = {}) {
  const logger = createLogger({ json: options.json || options.quiet });
  const alreadyRepo = await isGitRepo(cwd);

  if (alreadyRepo) {
    const result = { success: true, initialized: false, message: 'Git repository already exists.' };
    if (options.json) printJson(result);
    else if (!options.quiet) logger.info(result.message);
    return result;
  }

  let branch = options.branch || 'main';
  let gitignore = options.gitignore;
  let initialCommit = options.initialCommit === true;

  if (!isNonInteractive(options)) {
    const analysis = await analyzeProject(cwd);
    const response = await prompts([
      {
        type: 'confirm',
        name: 'init',
        message: 'Initialize git here?',
        initial: true,
      },
      {
        type: (_, values) => (values.init ? 'text' : null),
        name: 'branch',
        message: 'Default branch',
        initial: branch,
      },
      {
        type: (_, values) => (values.init ? 'confirm' : null),
        name: 'createGitignore',
        message: 'Create a .gitignore?',
        initial: true,
      },
      {
        type: (_, values) => (values.createGitignore ? 'text' : null),
        name: 'gitignore',
        message: 'Gitignore template',
        initial: analysis.projectType === 'generic' ? 'generic' : analysis.projectType === 'typescript' ? 'node' : analysis.projectType,
      },
      {
        type: (_, values) => (values.init ? 'confirm' : null),
        name: 'initialCommit',
        message: 'Create initial commit?',
        initial: false,
      },
    ]);

    if (!response.init) {
      return { success: false, initialized: false, cancelled: true };
    }

    branch = response.branch || branch;
    gitignore = response.createGitignore ? response.gitignore : gitignore;
    initialCommit = response.initialCommit === true;
  } else if (!options.yes && !options.dryRun) {
    assertInteractive(options, 'Not a Git repository. Run `shipit init --yes` to initialize non-interactively.');
  }

  const operations = [
    `git init -b ${branch}`,
    gitignore && gitignore !== 'none' ? `create .gitignore (${gitignore})` : undefined,
    options.remote ? `git remote add origin ${options.remote}` : undefined,
    initialCommit ? 'create initial commit' : undefined,
  ].filter(Boolean);

  if (options.dryRun) {
    const result = { success: true, dryRun: true, operations };
    if (options.json) printJson(result);
    else if (!options.quiet) logger.info(`Dry run:\n${operations.map((operation) => `  - ${operation}`).join('\n')}`);
    return result;
  }

  await initGit(cwd, branch);

  if (gitignore && gitignore !== 'none' && !(await pathExists(join(cwd, '.gitignore')))) {
    await writeFile(join(cwd, '.gitignore'), `${await readGitignoreTemplate(gitignore)}\n`, 'utf8');
  }

  if (options.remote) {
    await addRemote(cwd, options.remote);
  }

  let commitHash: string | undefined;
  if (initialCommit && (await confirmOrSkip('Stage safe files and create initial commit?', options))) {
    await stageAllSafe(cwd);
    await gitCommit(cwd, 'chore: initial commit');
    commitHash = await getLastCommitHash(cwd);
  }

  const result = { success: true, initialized: true, branch, remote: options.remote, commit: commitHash };
  if (options.json) printJson(result);
  else if (!options.quiet) logger.success(`Initialized Git repository on ${branch}.`);
  return result;
}
