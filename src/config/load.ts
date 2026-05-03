import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CheckCommands, ResolvedConfig, ShipitConfig } from '../types.js';
import { readJsonFile } from '../utils/fs.js';
import { maskSecret } from '../utils/redact.js';
import { defaultConfig, normalizeConfig } from './schema.js';

export function getGlobalConfigPath(): string {
  const root = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(root, 'shipit', 'config.json');
}

export function getProjectConfigPath(cwd: string): string {
  return join(cwd, '.shipit.json');
}

export async function loadConfigFile(path: string): Promise<ShipitConfig> {
  const raw = await readJsonFile<unknown>(path);
  return normalizeConfig(raw ?? {});
}

export async function resolveConfig(
  cwd: string,
  cliOverrides: ShipitConfig = {},
): Promise<ResolvedConfig> {
  const globalConfig = await loadConfigFile(getGlobalConfigPath());
  const projectConfig = await loadConfigFile(getProjectConfigPath(cwd));
  const envConfig = configFromEnv();

  return mergeResolved(
    defaultConfig,
    globalConfig,
    projectConfig,
    envConfig,
    cliOverrides,
  );
}

export function configFromEnv(): ShipitConfig {
  const config: ShipitConfig = {};

  if (process.env.OPENROUTER_API_KEY) {
    config.openrouter = { ...config.openrouter, apiKey: process.env.OPENROUTER_API_KEY };
  }
  if (process.env.SHIPIT_MODEL) {
    config.openrouter = { ...config.openrouter, model: process.env.SHIPIT_MODEL };
  }
  if (process.env.SHIPIT_COMMIT_STYLE) {
    config.commit = { ...config.commit, style: process.env.SHIPIT_COMMIT_STYLE as any };
  }
  if (process.env.SHIPIT_PR_BASE) {
    config.pr = { ...config.pr, base: process.env.SHIPIT_PR_BASE };
  }

  return config;
}

export function mergeResolved(...configs: Array<ShipitConfig | ResolvedConfig>): ResolvedConfig {
  const result: ResolvedConfig = structuredClone(defaultConfig);

  for (const config of configs) {
    if (config.openrouter?.apiKey !== undefined) result.openrouter.apiKey = config.openrouter.apiKey;
    if (config.openrouter?.model !== undefined) result.openrouter.model = config.openrouter.model;
    if (config.commit?.style !== undefined) result.commit.style = config.commit.style;
    if (config.pr?.base !== undefined) result.pr.base = config.pr.base;
    if (config.pr?.useGithubCli !== undefined) result.pr.useGithubCli = config.pr.useGithubCli;
    result.checks = mergeChecks(result.checks, config.checks);
  }

  return result;
}

export function maskConfig(config: ResolvedConfig): ResolvedConfig {
  return {
    ...config,
    openrouter: {
      ...config.openrouter,
      apiKey: maskSecret(config.openrouter.apiKey),
    },
  };
}

function mergeChecks(a: CheckCommands = {}, b: CheckCommands = {}): CheckCommands {
  return {
    ...a,
    ...Object.fromEntries(Object.entries(b).filter(([, value]) => value !== undefined)),
  };
}
