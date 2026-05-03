import { execa } from 'execa';
import { GitError } from './errors.js';
import { filterSafeFiles } from './safety.js';
import type { FileState, GitStatus } from '../types.js';
import { tryRunCommand } from '../utils/shell.js';

export interface PushOptions {
  remote?: string;
  branch?: string;
  setUpstream?: boolean;
  forceWithLease?: boolean;
  dryRun?: boolean;
}

async function git(cwd: string, args: string[], options: { reject?: boolean } = {}): Promise<string> {
  try {
    const result = await execa('git', args, {
      cwd,
      reject: options.reject ?? true,
    });
    return result.stdout.trim();
  } catch (error: any) {
    const stderr = error?.stderr ? `\n${error.stderr}` : '';
    throw new GitError(`Git command failed: git ${args.join(' ')}${stderr}`);
  }
}

async function tryGit(cwd: string, args: string[]): Promise<string | undefined> {
  try {
    return await git(cwd, args);
  } catch {
    return undefined;
  }
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  const output = await tryGit(cwd, ['rev-parse', '--is-inside-work-tree']);
  return output === 'true';
}

export async function initGit(cwd: string, branch = 'main'): Promise<void> {
  await git(cwd, ['init', '-b', branch]);
}

export async function getCurrentBranch(cwd: string): Promise<string | undefined> {
  return tryGit(cwd, ['branch', '--show-current']);
}

export async function getRemoteUrl(cwd: string, remote = 'origin'): Promise<string | undefined> {
  return tryGit(cwd, ['remote', 'get-url', remote]);
}

export async function getDefaultBranch(cwd: string, remote = 'origin'): Promise<string | undefined> {
  const symbolic = await tryGit(cwd, ['symbolic-ref', `refs/remotes/${remote}/HEAD`, '--short']);
  if (symbolic) {
    return symbolic.replace(`${remote}/`, '');
  }

  const branches = await tryGit(cwd, ['branch', '--list', 'main', 'master', '--format=%(refname:short)']);
  return branches?.split('\n').find(Boolean);
}

export async function getUpstream(cwd: string, branch?: string): Promise<string | undefined> {
  const target = branch ? `${branch}@{upstream}` : '@{upstream}';
  return tryGit(cwd, ['rev-parse', '--abbrev-ref', target]);
}

export async function hasUpstream(cwd: string, branch?: string): Promise<boolean> {
  return (await getUpstream(cwd, branch)) !== undefined;
}

export async function getStatus(cwd: string): Promise<GitStatus> {
  if (!(await isGitRepo(cwd))) {
    return {
      isRepo: false,
      staged: [],
      unstaged: [],
      untracked: [],
      changed: [],
      files: [],
      clean: true,
    };
  }

  const output = await git(cwd, ['status', '--porcelain=v1', '-b', '-uall']);
  const lines = output ? output.split('\n') : [];
  const branchLine = lines[0]?.startsWith('## ') ? lines.shift() : undefined;
  const branchInfo = parseBranchLine(branchLine);
  const files = lines.filter(Boolean).map(parseStatusLine);

  const staged = unique(files.filter((file) => file.staged).map((file) => file.path));
  const unstaged = unique(files.filter((file) => file.unstaged).map((file) => file.path));
  const untracked = unique(files.filter((file) => file.untracked).map((file) => file.path));
  const changed = unique([...staged, ...unstaged, ...untracked]);

  return {
    isRepo: true,
    branch: branchInfo.branch || (await getCurrentBranch(cwd)),
    upstream: branchInfo.upstream || (await getUpstream(cwd, branchInfo.branch)),
    remote: 'origin',
    remoteUrl: await getRemoteUrl(cwd),
    staged,
    unstaged,
    untracked,
    changed,
    files,
    clean: changed.length === 0,
  };
}

export async function getChangedFiles(cwd: string): Promise<string[]> {
  return (await getStatus(cwd)).changed;
}

export async function getStagedFiles(cwd: string): Promise<string[]> {
  return (await getStatus(cwd)).staged;
}

export async function getUnstagedFiles(cwd: string): Promise<string[]> {
  const status = await getStatus(cwd);
  return unique([...status.unstaged, ...status.untracked]);
}

export async function stageFiles(cwd: string, files: string[]): Promise<{ staged: string[]; skipped: string[] }> {
  const { safe, sensitive } = filterSafeFiles(unique(files));
  if (safe.length > 0) {
    await git(cwd, ['add', '--', ...safe]);
  }
  return { staged: safe, skipped: sensitive };
}

export async function stageAllSafe(cwd: string): Promise<{ staged: string[]; skipped: string[] }> {
  const status = await getStatus(cwd);
  return stageFiles(cwd, status.changed);
}

export async function getStagedDiff(cwd: string, files?: string[]): Promise<string> {
  return diff(cwd, ['--cached'], files);
}

export async function getUnstagedDiff(cwd: string, files?: string[]): Promise<string> {
  return diff(cwd, [], files);
}

export async function getDiffStat(cwd: string, args: string[] = [], files?: string[]): Promise<string> {
  return diff(cwd, ['--stat', ...args], files);
}

export async function commit(cwd: string, message: string): Promise<void> {
  await git(cwd, ['commit', '-m', message]);
}

export async function getLastCommitHash(cwd: string): Promise<string> {
  return git(cwd, ['rev-parse', '--short', 'HEAD']);
}

export async function push(cwd: string, options: PushOptions = {}): Promise<void> {
  const branch = options.branch || (await getCurrentBranch(cwd));
  if (!branch) {
    throw new GitError('Could not determine current branch.');
  }

  const remote = options.remote || 'origin';
  const args = ['push'];

  if (options.dryRun) args.push('--dry-run');
  if (options.forceWithLease) args.push('--force-with-lease');
  if (options.setUpstream) args.push('-u', remote, branch);
  else args.push(remote, branch);

  await git(cwd, args);
}

export async function addRemote(cwd: string, remoteUrl: string, name = 'origin'): Promise<void> {
  await git(cwd, ['remote', 'add', name, remoteUrl]);
}

export async function getMergeBase(cwd: string, base: string): Promise<string | undefined> {
  return tryGit(cwd, ['merge-base', base, 'HEAD']);
}

export async function getDiffAgainstBase(cwd: string, base: string, files?: string[]): Promise<string> {
  const mergeBase = await getMergeBase(cwd, base);
  const target = mergeBase || base;
  return diff(cwd, [`${target}...HEAD`], files);
}

export async function getChangedFilesAgainstBase(cwd: string, base: string): Promise<string[]> {
  const mergeBase = await getMergeBase(cwd, base);
  const target = mergeBase || base;
  const output = await tryGit(cwd, ['diff', '--name-only', `${target}...HEAD`]);
  return output ? output.split('\n').filter(Boolean) : [];
}

export async function getCommitsSince(cwd: string, base: string): Promise<string[]> {
  const output = await tryGit(cwd, ['log', '--oneline', `${base}..HEAD`]);
  return output ? output.split('\n').filter(Boolean) : [];
}

export async function gitInstalled(): Promise<boolean> {
  return (await tryRunCommand('git', ['--version'])) !== undefined;
}

async function diff(cwd: string, args: string[], files?: string[]): Promise<string> {
  const pathspec = files && files.length > 0 ? ['--', ...files] : [];
  return git(cwd, ['diff', ...args, ...pathspec]);
}

function parseBranchLine(line: string | undefined): { branch?: string; upstream?: string } {
  if (!line) return {};
  const raw = line.slice(3);
  const [branchPart, upstreamPart] = raw.split('...');
  const branch = branchPart.replace('No commits yet on ', '').trim();
  const upstream = upstreamPart?.split(' ')[0]?.trim();
  return { branch: branch || undefined, upstream };
}

export function parseStatusLine(line: string): FileState {
  const index = line[0] ?? ' ';
  const workingTree = line[1] ?? ' ';
  const rawPath = line.slice(3);
  const path = rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1)! : rawPath;
  const untracked = index === '?' && workingTree === '?';

  return {
    path,
    staged: !untracked && index !== ' ',
    unstaged: !untracked && workingTree !== ' ',
    untracked,
    status: `${index}${workingTree}`,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
