import { execa } from 'execa';
import { ShipitError } from '../core/errors.js';
import { commandExists } from '../utils/shell.js';

export async function ensureGithubCli(): Promise<void> {
  if (!(await commandExists('gh'))) {
    throw new ShipitError(
      'GitHub CLI is not installed. Install it from https://cli.github.com/ or create PRs manually.',
      'GH_MISSING',
      1,
    );
  }
}

export async function isGithubCliAuthenticated(): Promise<boolean> {
  const result = await execa('gh', ['auth', 'status', '-h', 'github.com'], {
    reject: false,
  });
  return result.exitCode === 0;
}

export async function ensureGithubAuth(): Promise<void> {
  await ensureGithubCli();
  if (!(await isGithubCliAuthenticated())) {
    throw new ShipitError('GitHub CLI is not authenticated. Run `gh auth login` first.', 'GH_AUTH_MISSING', 1);
  }
}

export async function createPullRequestWithGh(options: {
  cwd: string;
  base: string;
  title: string;
  body: string;
  draft?: boolean;
  web?: boolean;
}): Promise<string> {
  const args = ['pr', 'create', '--base', options.base, '--title', options.title, '--body', options.body];
  if (options.draft) args.push('--draft');
  if (options.web) args.push('--web');

  const result = await execa('gh', args, {
    cwd: options.cwd,
    reject: true,
  });

  return extractUrl(result.stdout.trim()) || result.stdout.trim();
}

function extractUrl(output: string): string | undefined {
  return output.match(/https:\/\/github\.com\/\S+/)?.[0];
}
