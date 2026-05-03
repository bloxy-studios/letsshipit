import type { Command } from 'commander';
import { createLogger } from '../core/logger.js';

export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('Update shipit')
    .action(() => {
      const logger = createLogger();
      logger.info('Update support depends on how shipit was installed.');
      logger.info('For now, reinstall using your package manager or the install script.');
    });
}
