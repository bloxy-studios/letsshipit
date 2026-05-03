import { getGlobalConfigPath, loadConfigFile, maskConfig, mergeResolved } from './load.js';
import { defaultConfig, normalizeConfig } from './schema.js';
import { removeFileIfExists, writeJsonFile } from '../utils/fs.js';
import type { ShipitConfig } from '../types.js';

export async function getStoredGlobalConfig(): Promise<ShipitConfig> {
  return loadConfigFile(getGlobalConfigPath());
}

export async function setGlobalConfigValue(key: string, value: unknown): Promise<ShipitConfig> {
  const config = await getStoredGlobalConfig();
  setByPath(config as Record<string, unknown>, key, coerceValue(key, value));
  const normalized = normalizeConfig(config);
  await writeJsonFile(getGlobalConfigPath(), normalized);
  return normalized;
}

export async function resetGlobalConfig(): Promise<void> {
  await removeFileIfExists(getGlobalConfigPath());
}

export async function getMaskedStoredConfig() {
  const config = await getStoredGlobalConfig();
  return maskConfig(mergeResolved(defaultConfig, config));
}

export function getByPath(source: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[part];
  }, source);
}

function setByPath(target: Record<string, unknown>, key: string, value: unknown): void {
  const parts = key.split('.');
  let current = target;

  for (const part of parts.slice(0, -1)) {
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts.at(-1)!] = value;
}

function coerceValue(key: string, value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (key.endsWith('useGithubCli')) return value === 'true';
  return value;
}
