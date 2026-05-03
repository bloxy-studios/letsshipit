import prompts from 'prompts';
import type { Command } from 'commander';
import { buildDiffContext } from '../core/diff.js';
import { getCommitsSince, getCurrentBranch, hasUpstream } from '../core/git.js';
import { createLogger } from '../core/logger.js';
import { analyzeProject } from '../core/project.js';
import { ShipitError } from '../core/errors.js';
import { resolveConfig } from '../config/load.js';
import { ensureGithubAuth, createPullRequestWithGh } from '../integrations/githubCli.js';
import { printJson } from '../utils/json.js';
import { confirmOrSkip, isNonInteractive, printWarnings, resolveAiProvider } from './helpers.js';
import { pushCommand } from './push.js';

interface PrOptions {
  base?: string;
  draft?: boolean;
  title?: string;
  body?: string;
  yes?: boolean;
  web?: boolean;
  model?: string;
  dryRun?: boolean;
  json?: boolean;
  quiet?: boolean;
}

export function registerPrCommand(program: Command): void {
  program
    .command('pr')
    .description('Create a pull request')
    .option('--base <branch>', 'base branch')
    .option('--draft', 'create draft PR')
    .option('--title <title>', 'PR title')
    .option('--body <body>', 'PR body')
    .option('--yes', 'do not prompt')
    .option('--web', 'open PR flow in browser')
    .option('--model <model>', 'OpenRouter model override')
    .option('--dry-run', 'show operations without mutating state')
    .option('--json', 'output JSON')
    .action(async (options: PrOptions) => {
      await prCommand(process.cwd(), options);
    });
}

export async function prCommand(cwd: string, options: PrOptions = {}) {
  const logger = createLogger({ json: options.json || options.quiet });
  const analysis = await analyzeProject(cwd);

  if (!analysis.git.isRepo) throw new ShipitError('Not a Git repository. Run `shipit init` first.', 'NOT_GIT_REPO');
  if (analysis.remoteHost !== 'github') {
    throw new ShipitError('Pull request creation currently supports GitHub remotes via `gh` only.', 'UNSUPPORTED_REMOTE');
  }

  const config = await resolveConfig(cwd, { openrouter: { model: options.model } });
  const base = options.base || config.pr.base || analysis.defaultBranch || 'main';
  const branch = (await getCurrentBranch(cwd)) || analysis.git.branch;
  if (!branch) throw new ShipitError('Could not determine current branch.', 'NO_BRANCH');

  if (!(await hasUpstream(cwd, branch))) {
    const shouldPush = options.yes || (await confirmOrSkip(`Branch ${branch} is not pushed. Push it now?`, options, true));
    if (!shouldPush) throw new ShipitError('PR cancelled because branch is not pushed.', 'BRANCH_NOT_PUSHED');
    await pushCommand(cwd, { yes: true, setUpstream: true, dryRun: options.dryRun, quiet: true });
  }

  let title = options.title;
  let body = options.body;

  if (!title || !body) {
    const diff = await buildDiffContext(cwd, 'base', { base });
    printWarnings(diff, options);
    const commits = await getCommitsSince(cwd, base).catch(() => []);
    const { provider } = await resolveAiProvider(cwd, options);

    let accepted = false;
    while (!accepted) {
      const spinner = logger.spinner('Generating pull request draft...').start();
      const generated = await provider.generatePullRequest({ analysis, baseBranch: base, currentBranch: branch, commits, diff });
      spinner.succeed('Generated pull request draft.');
      title ||= generated.title;
      body ||= generated.body;

      if (isNonInteractive(options)) {
        accepted = true;
        break;
      }

      logger.info(`\nTitle:\n${title}\n\nBody:\n${body}\n`);
      const response = await prompts({
        type: 'select',
        name: 'action',
        message: 'Use this pull request draft?',
        choices: [
          { title: 'Yes', value: 'yes' },
          { title: 'Edit title/body', value: 'edit' },
          { title: 'Regenerate', value: 'regenerate' },
          { title: 'Cancel', value: 'cancel' },
        ],
      });

      if (response.action === 'yes') accepted = true;
      else if (response.action === 'edit') {
        const edit = await prompts([
          { type: 'text', name: 'title', message: 'PR title', initial: title },
          { type: 'text', name: 'body', message: 'PR body', initial: body },
        ]);
        title = edit.title;
        body = edit.body;
        accepted = Boolean(title && body);
      } else if (response.action === 'regenerate') {
        title = options.title;
        body = options.body;
      } else {
        throw new ShipitError('PR creation cancelled.', 'CANCELLED', 0);
      }
    }
  }

  if (!title || !body) throw new ShipitError('PR title and body are required.', 'MISSING_PR_CONTENT');

  if (!options.yes && !options.dryRun) {
    const ok = await confirmOrSkip('Create this pull request?', options, true);
    if (!ok) throw new ShipitError('PR creation cancelled.', 'CANCELLED', 0);
  }

  if (options.dryRun) {
    const result = { success: true, dryRun: true, base, branch, title, body, draft: options.draft === true };
    if (options.json) printJson(result);
    else if (!options.quiet) logger.info(`Dry run: would create PR into ${base}:\n\n${title}\n\n${body}`);
    return result;
  }

  await ensureGithubAuth();
  const url = await createPullRequestWithGh({
    cwd,
    base,
    title,
    body,
    draft: options.draft,
    web: options.web,
  });

  const result = { success: true, url, title, base, branch };
  if (options.json) printJson(result);
  else if (!options.quiet) logger.success(`Created PR: ${url}`);
  return result;
}
