import type { Command } from 'commander';
import pc from 'picocolors';
import { analyzeProject } from '../core/project.js';
import { createLogger } from '../core/logger.js';
import { printJson } from '../utils/json.js';
import { renderProjectSummary } from './helpers.js';

interface AnalyzeOptions {
  json?: boolean;
  changedOnly?: boolean;
}

export function registerAnalyzeCommand(program: Command): void {
  program
    .command('analyze')
    .description('Analyze the current project')
    .option('--json', 'output JSON')
    .option('--changed-only', 'focus output on changed files')
    .action(async (options: AnalyzeOptions) => {
      await analyzeCommand(process.cwd(), options);
    });
}

export async function analyzeCommand(cwd: string, options: AnalyzeOptions = {}) {
  const analysis = await analyzeProject(cwd);

  if (options.json) {
    printJson(analysis);
    return analysis;
  }

  const logger = createLogger();
  logger.info(renderProjectSummary(analysis));

  if (options.changedOnly) {
    logger.info(`\n${pc.bold('Changed files')}`);
    for (const file of analysis.git.changed) logger.info(`  ${file}`);
    return analysis;
  }

  if (Object.keys(analysis.checks).length > 0) {
    logger.info(`\n${pc.bold('Suggested checks')}`);
    for (const command of Object.values(analysis.checks)) logger.info(`  ${command}`);
  }

  if (analysis.sensitiveFiles.length > 0) {
    logger.warn(`Sensitive changed files will be excluded: ${analysis.sensitiveFiles.join(', ')}`);
  }

  return analysis;
}
