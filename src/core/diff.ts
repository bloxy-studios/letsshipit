import type { DiffContext } from '../types.js';
import { containsSuspiciousSecret, redactText } from '../utils/redact.js';
import {
  getChangedFilesAgainstBase,
  getDiffAgainstBase,
  getDiffStat,
  getStagedDiff,
  getStagedFiles,
  getUnstagedDiff,
  getUnstagedFiles,
} from './git.js';
import { filterSafeFiles } from './safety.js';

const MAX_DIFF_CHARS = 14_000;

export type DiffMode = 'staged' | 'unstaged' | 'all' | 'base';

export async function buildDiffContext(
  cwd: string,
  mode: DiffMode,
  options: { base?: string } = {},
): Promise<DiffContext> {
  const files = await getFilesForMode(cwd, mode, options.base);
  const { safe, sensitive } = filterSafeFiles(files);
  const warnings: string[] = [];

  if (sensitive.length > 0) {
    warnings.push(`Excluded sensitive files: ${sensitive.join(', ')}`);
  }

  if (safe.length === 0) {
    return {
      diff: '',
      stat: '',
      files: [],
      excludedSensitiveFiles: sensitive,
      truncated: false,
      warnings,
    };
  }

  const rawDiff = await getRawDiff(cwd, mode, safe, options.base);
  const stat = await getRawStat(cwd, mode, safe, options.base);

  if (containsSuspiciousSecret(rawDiff)) {
    warnings.push('Potential secrets were detected and redacted before sending context to AI.');
  }

  const sanitized = redactText(rawDiff);
  const truncated = sanitized.length > MAX_DIFF_CHARS;
  const diff = truncated
    ? `${sanitized.slice(0, MAX_DIFF_CHARS)}\n\n[Diff truncated by shipit for safety and context size.]`
    : sanitized;

  return {
    diff,
    stat: redactText(stat),
    files: safe,
    excludedSensitiveFiles: sensitive,
    truncated,
    warnings,
  };
}

async function getFilesForMode(cwd: string, mode: DiffMode, base?: string): Promise<string[]> {
  if (mode === 'staged') return getStagedFiles(cwd);
  if (mode === 'unstaged') return getUnstagedFiles(cwd);
  if (mode === 'base') return getChangedFilesAgainstBase(cwd, base ?? 'main');
  const staged = await getStagedFiles(cwd);
  const unstaged = await getUnstagedFiles(cwd);
  return [...new Set([...staged, ...unstaged])];
}

async function getRawDiff(cwd: string, mode: DiffMode, files: string[], base?: string): Promise<string> {
  if (mode === 'staged') return getStagedDiff(cwd, files);
  if (mode === 'unstaged') return getUnstagedDiff(cwd, files);
  if (mode === 'base') return getDiffAgainstBase(cwd, base ?? 'main', files);
  return getStagedDiff(cwd, files).then(async (staged) => {
    const unstaged = await getUnstagedDiff(cwd, files);
    return [staged, unstaged].filter(Boolean).join('\n');
  });
}

async function getRawStat(cwd: string, mode: DiffMode, files: string[], base?: string): Promise<string> {
  if (mode === 'staged') return getDiffStat(cwd, ['--cached'], files);
  if (mode === 'unstaged') return getDiffStat(cwd, [], files);
  if (mode === 'base') return getDiffStat(cwd, [`${base ?? 'main'}...HEAD`], files);
  return getDiffStat(cwd, ['HEAD'], files);
}
