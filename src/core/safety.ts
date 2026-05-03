import { basename } from 'node:path';

const SENSITIVE_EXTENSIONS = ['.pem', '.key'];
const SENSITIVE_BASENAMES = new Set(['id_rsa', 'id_ed25519', '.npmrc', '.pypirc']);

export function normalizePath(filePath: string): string {
  return filePath.replaceAll('\\', '/').replace(/^"\s*/, '').replace(/\s*"$/, '');
}

export function isSensitiveFile(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  const name = basename(normalized);
  const parts = normalized.split('/');

  if (parts.includes('.ssh')) {
    return true;
  }

  if (name === '.env' || name.startsWith('.env.')) {
    return true;
  }

  if (SENSITIVE_BASENAMES.has(name)) {
    return true;
  }

  return SENSITIVE_EXTENSIONS.some((extension) => name.endsWith(extension));
}

export function filterSafeFiles(files: string[]): { safe: string[]; sensitive: string[] } {
  const sensitive: string[] = [];
  const safe: string[] = [];

  for (const file of files) {
    if (isSensitiveFile(file)) {
      sensitive.push(file);
    } else {
      safe.push(file);
    }
  }

  return { safe, sensitive };
}
