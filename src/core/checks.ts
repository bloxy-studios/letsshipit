import { execa } from 'execa';
import type { CheckCommands } from '../types.js';
import { ShipitError } from './errors.js';

export interface CheckResult {
  name: keyof CheckCommands;
  command: string;
  success: boolean;
  exitCode?: number;
}

export async function runChecks(
  cwd: string,
  checks: CheckCommands,
  selected: Array<keyof CheckCommands>,
  options: { json?: boolean; dryRun?: boolean } = {},
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  for (const name of selected) {
    const command = checks[name];
    if (!command) continue;

    if (options.dryRun) {
      results.push({ name, command, success: true });
      continue;
    }

    const subprocess = execa(command, {
      cwd,
      shell: true,
      stdio: options.json ? 'pipe' : 'inherit',
      reject: false,
    });
    const result = await subprocess;
    const success = result.exitCode === 0;
    results.push({ name, command, success, exitCode: result.exitCode ?? undefined });

    if (!success) {
      throw new ShipitError(`Check failed: ${command}`, 'CHECK_FAILED', result.exitCode || 1);
    }
  }

  return results;
}

export function selectChecks(
  checks: CheckCommands,
  options: { lint?: boolean; test?: boolean; build?: boolean },
): Array<keyof CheckCommands> {
  const selected: Array<keyof CheckCommands> = [];

  if (options.lint) selected.push('lint');
  if (options.test) selected.push('test');
  if (options.build) selected.push('build');

  if (selected.length > 0) return selected.filter((name) => checks[name]);

  return (['lint', 'test', 'build'] as Array<keyof CheckCommands>).filter((name) => checks[name]);
}
