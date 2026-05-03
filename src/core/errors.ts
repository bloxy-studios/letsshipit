export class ShipitError extends Error {
  readonly code: string;
  readonly exitCode: number;

  constructor(message: string, code = 'SHIPIT_ERROR', exitCode = 1) {
    super(message);
    this.name = 'ShipitError';
    this.code = code;
    this.exitCode = exitCode;
  }
}

export class MissingConfigError extends ShipitError {
  constructor(message: string) {
    super(message, 'MISSING_CONFIG', 1);
    this.name = 'MissingConfigError';
  }
}

export class GitError extends ShipitError {
  constructor(message: string) {
    super(message, 'GIT_ERROR', 1);
    this.name = 'GitError';
  }
}

export function asShipitError(error: unknown): ShipitError {
  if (error instanceof ShipitError) {
    return error;
  }

  if (error instanceof Error) {
    return new ShipitError(error.message);
  }

  return new ShipitError(String(error));
}
