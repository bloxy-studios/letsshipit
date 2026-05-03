import pc from 'picocolors';
import ora, { type Ora } from 'ora';

export interface Logger {
  info(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  spinner(message: string): OraLike;
}

export interface OraLike {
  start(): OraLike;
  succeed(message?: string): OraLike;
  fail(message?: string): OraLike;
  stop(): OraLike;
}

class NoopSpinner implements OraLike {
  start(): OraLike {
    return this;
  }
  succeed(): OraLike {
    return this;
  }
  fail(): OraLike {
    return this;
  }
  stop(): OraLike {
    return this;
  }
}

export function createLogger(options: { json?: boolean } = {}): Logger {
  const quiet = options.json === true;

  return {
    info(message) {
      if (!quiet) process.stdout.write(`${message}\n`);
    },
    success(message) {
      if (!quiet) process.stdout.write(`${pc.green('✓')} ${message}\n`);
    },
    warn(message) {
      if (!quiet) process.stderr.write(`${pc.yellow('!')} ${message}\n`);
    },
    error(message) {
      if (!quiet) process.stderr.write(`${pc.red('✖')} ${message}\n`);
    },
    spinner(message) {
      if (quiet) return new NoopSpinner();
      return ora(message) as Ora;
    },
  };
}
