import { Command } from 'commander';
import pc from 'picocolors';
import { asShipitError } from './core/errors.js';
import { defaultInteractiveCommand } from './commands/default.js';
import { registerAnalyzeCommand } from './commands/analyze.js';
import { registerCheckCommand } from './commands/check.js';
import { registerCommitCommand } from './commands/commit.js';
import { registerConfigCommand } from './commands/config.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerGoCommand } from './commands/go.js';
import { registerInitCommand } from './commands/init.js';
import { registerPrCommand } from './commands/pr.js';
import { registerPushCommand } from './commands/push.js';
import { registerStageCommand } from './commands/stage.js';
import { registerStatusCommand } from './commands/status.js';
import { registerSuggestCommand } from './commands/suggest.js';
import { registerUpdateCommand } from './commands/update.js';

export const version = '0.1.1';

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name('shipit')
    .description('Safely analyze, commit, push, and open pull requests with AI assistance')
    .version(version)
    .showHelpAfterError()
    .action(() => defaultInteractiveCommand(process.cwd()));

  registerInitCommand(program);
  registerAnalyzeCommand(program);
  registerStatusCommand(program);
  registerStageCommand(program);
  registerSuggestCommand(program);
  registerCommitCommand(program);
  registerPushCommand(program);
  registerPrCommand(program);
  registerGoCommand(program);
  registerCheckCommand(program);
  registerConfigCommand(program);
  registerDoctorCommand(program);
  registerUpdateCommand(program);

  try {
    await program.parseAsync(argv);
  } catch (error) {
    const shipitError = asShipitError(error);
    if (shipitError.exitCode !== 0) {
      if (argv.includes('--json')) {
        process.stdout.write(
          `${JSON.stringify(
            {
              success: false,
              error: {
                code: shipitError.code,
                message: shipitError.message,
              },
            },
            null,
            2,
          )}\n`,
        );
      } else {
        process.stderr.write(`${pc.red('shipit:')} ${shipitError.message}\n`);
      }
    }
    process.exitCode = shipitError.exitCode;
  }
}
