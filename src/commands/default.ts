import prompts from 'prompts';
import { createLogger } from '../core/logger.js';
import { analyzeProject } from '../core/project.js';
import { renderProjectSummary } from './helpers.js';
import { initCommand } from './init.js';
import { analyzeCommand } from './analyze.js';
import { stageCommand } from './stage.js';
import { suggestCommand } from './suggest.js';
import { commitCommand } from './commit.js';
import { pushCommand } from './push.js';
import { prCommand } from './pr.js';
import { goCommand } from './go.js';
import { configInteractive } from './config.js';
import { doctorCommand } from './doctor.js';

export async function defaultInteractiveCommand(cwd: string): Promise<void> {
  const logger = createLogger();
  const analysis = await analyzeProject(cwd);

  if (!analysis.git.isRepo) {
    logger.warn('No git repository found.');
    await initCommand(cwd, {});
    return;
  }

  logger.info(renderProjectSummary(analysis));

  const response = await prompts({
    type: 'select',
    name: 'action',
    message: 'What do you want to do?',
    choices: [
      { title: 'Analyze project', value: 'analyze' },
      { title: 'Stage changes', value: 'stage' },
      { title: 'Suggest commit message', value: 'suggest' },
      { title: 'Commit', value: 'commit' },
      { title: 'Push', value: 'push' },
      { title: 'Create PR', value: 'pr' },
      { title: 'Full flow: stage -> commit -> push -> PR', value: 'go' },
      { title: 'Configure', value: 'config' },
      { title: 'Doctor', value: 'doctor' },
    ],
  });

  switch (response.action) {
    case 'analyze':
      await analyzeCommand(cwd);
      break;
    case 'stage':
      await stageCommand(cwd);
      break;
    case 'suggest':
      await suggestCommand(cwd);
      break;
    case 'commit':
      await commitCommand(cwd);
      break;
    case 'push':
      await pushCommand(cwd);
      break;
    case 'pr':
      await prCommand(cwd);
      break;
    case 'go':
      await goCommand(cwd);
      break;
    case 'config':
      await configInteractive(cwd);
      break;
    case 'doctor':
      await doctorCommand(cwd);
      break;
  }
}
