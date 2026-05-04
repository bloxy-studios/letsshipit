import type { Command } from 'commander';
import pc from 'picocolors';
import { resolveConfig } from '../config/load.js';
import { gitInstalled } from '../core/git.js';
import { createLogger } from '../core/logger.js';
import { analyzeProject } from '../core/project.js';
import { commandExists } from '../utils/shell.js';
import { printJson } from '../utils/json.js';
import { isGithubCliAuthenticated } from '../integrations/githubCli.js';

interface DoctorOptions {
  json?: boolean;
}

interface DoctorCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Check shipit environment health')
    .option('--json', 'output JSON')
    .action(async (options: DoctorOptions) => {
      await doctorCommand(process.cwd(), options);
    });
}

export async function doctorCommand(cwd: string, options: DoctorOptions = {}) {
  const logger = createLogger({ json: options.json });
  const analysis = await analyzeProject(cwd);
  const config = await resolveConfig(cwd);
  const ghInstalled = await commandExists('gh');
  const ghAuthed = ghInstalled ? await isGithubCliAuthenticated() : false;

  const checks: DoctorCheck[] = [
    { name: 'Node', ok: Number(process.versions.node.split('.')[0]) >= 24, detail: process.versions.node },
    { name: 'Git', ok: await gitInstalled() },
    { name: 'Repository', ok: analysis.git.isRepo, detail: analysis.git.isRepo ? 'initialized' : 'not initialized' },
    {
      name: 'OpenRouter API key',
      ok: Boolean(config.openrouter.apiKey),
      detail: config.openrouter.apiKey ? 'configured' : 'missing',
    },
    { name: 'Model', ok: Boolean(config.openrouter.model), detail: config.openrouter.model },
    { name: 'GitHub CLI', ok: ghInstalled, detail: ghInstalled ? 'installed' : 'missing' },
    { name: 'GitHub auth', ok: ghAuthed, detail: ghAuthed ? 'authenticated' : 'not authenticated or unavailable' },
    { name: 'Remote', ok: Boolean(analysis.git.remoteUrl), detail: analysis.git.remoteUrl ?? 'none' },
    { name: 'Branch', ok: Boolean(analysis.git.branch), detail: analysis.git.branch ?? 'none' },
    { name: 'Project type', ok: analysis.projectType !== 'generic', detail: analysis.projectLabel },
    { name: 'Package manager', ok: analysis.packageManager !== 'unknown', detail: analysis.packageManager },
    {
      name: 'Checks',
      ok: Object.keys({ ...analysis.checks, ...config.checks }).length > 0,
      detail: Object.values({ ...analysis.checks, ...config.checks }).join(', ') || 'none',
    },
  ];

  const output = { success: checks.every((check) => check.ok), checks, analysis };
  if (options.json) {
    printJson(output);
    return output;
  }

  for (const check of checks) {
    const marker = check.ok ? pc.green('OK') : pc.yellow('WARN');
    logger.info(`${marker.padEnd(10)} ${check.name}${check.detail ? `: ${check.detail}` : ''}`);
  }

  return output;
}
